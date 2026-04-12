/**
 * Multi-turn idea refinement — streaming chat with a specific idea as context.
 * Supports session continuation (sessionId) for full conversation memory.
 */
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { streamChat, type ChatMessage } from '@/lib/ai'
import { requireString, optionalString } from '@/lib/api/validate'
import { handleRouteError } from '@/lib/api/errors'
import { getWorkspaceContext, withWorkspaceContext } from '@/lib/ai/workspace-context'
import { queryPineconeAssistant } from '@/lib/ai/pinecone-assistant'
import { SYSTEM_PROMPTS } from '@/lib/ai/prompts'
import type { Idea } from '@/types'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  try {
    const body = await request.json() as { prompt?: unknown; sessionId?: unknown }
    const prompt = requireString(body.prompt, 'prompt', { max: 4000 })
    const sessionId = optionalString(body.sessionId, 'sessionId')

    const supabase = createServiceClient()
    const { workspaceId, user } = ctx

    // Load and verify idea
    const { data: idea, error: ideaErr } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', workspaceId)
      .single()

    if (ideaErr || !idea) {
      return Response.json({ error: 'Idea not found' }, { status: 404 })
    }

    const i = idea as Idea

    // Build idea context for the system prompt
    const ideaContext = [
      `Title: ${i.title}`,
      `Brief: ${i.brief}`,
      i.problem ? `Problem: ${i.problem}` : '',
      i.solution ? `Solution: ${i.solution}` : '',
      i.audience ? `Audience: ${i.audience}` : '',
      i.channel?.length ? `Channels: ${i.channel.join(', ')}` : '',
      `Scores — Impact: ${i.score_impact ?? '?'}/10, Ease: ${i.score_ease ?? '?'}/10, ROI: ${i.score_roi ?? '?'}/10`,
      i.status !== 'new' ? `Status: ${i.status}` : '',
    ].filter(Boolean).join('\n')

    // Load workspace context
    const wsContext = await getWorkspaceContext(supabase, workspaceId)
    const baseSystemPrompt = `${SYSTEM_PROMPTS.ideas}

You are helping refine and expand a specific business idea. Here is the current idea:

${ideaContext}

Help the user analyze, expand, or improve this idea through conversation.
When suggesting changes to the idea, be explicit about what field should change and how.`

    const systemPrompt = withWorkspaceContext(baseSystemPrompt, wsContext)

    // Load or create session
    let activeSessionId: string
    let historyMessages: ChatMessage[] = []

    if (sessionId) {
      const { data: session } = await supabase
        .from('ai_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('workspace_id', workspaceId)
        .single()

      if (session) {
        activeSessionId = session.id
        const { data: prev } = await supabase
          .from('ai_messages')
          .select('role, content')
          .eq('session_id', activeSessionId)
          .order('created_at', { ascending: true })
          .limit(20)
        if (prev) historyMessages = prev as ChatMessage[]
      } else {
        activeSessionId = await createSession()
      }
    } else {
      activeSessionId = await createSession()
    }

    async function createSession(): Promise<string> {
      const { data: s, error } = await supabase
        .from('ai_sessions')
        .insert({
          workspace_id: workspaceId,
          module: 'idea',
          title: `Refine: ${i.title.slice(0, 60)}`,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (error) throw error
      return s.id
    }

    // Save user message
    await supabase.from('ai_messages').insert({
      session_id: activeSessionId,
      role: 'user',
      content: prompt,
    })

    // Enrich system prompt with Pinecone company documents if relevant
    const pineconeCtx = await queryPineconeAssistant(`${i.title} ${prompt}`)
    const enrichedSystemPrompt = pineconeCtx
      ? `${systemPrompt}\n\n${pineconeCtx}`
      : systemPrompt

    const aiMessages: ChatMessage[] = [
      ...historyMessages,
      { role: 'user', content: prompt },
    ]

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = ''

        function send(data: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          for await (const chunk of streamChat(aiMessages, enrichedSystemPrompt)) {
            fullContent += chunk
            send({ text: chunk })
          }

          await supabase.from('ai_messages').insert({
            session_id: activeSessionId,
            role: 'assistant',
            content: fullContent,
          })

          send({ done: true, sessionId: activeSessionId })
        } catch (err) {
          send({ error: err instanceof Error ? err.message : 'Stream error' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    return handleRouteError(err, `api/ai/ideas/${params.id}/refine`)
  }
}
