import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { streamChat, type ChatMessage } from '@/lib/ai'
import { requireString, optionalString } from '@/lib/api/validate'
import { handleRouteError } from '@/lib/api/errors'
import { findRelevantContext } from '@/lib/ai/rag'
import { queryPineconeAssistant } from '@/lib/ai/pinecone-assistant'

export const maxDuration = 120 // seconds — streaming needs longer window
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as {
      prompt?: unknown
      context?: unknown
      images?: unknown
      sessionId?: unknown
    }

    const prompt = requireString(body.prompt, 'prompt', { max: 8000 })
    const context = optionalString(body.context, 'context', { max: 4000 })
    const sessionId = optionalString(body.sessionId, 'sessionId')

    // Validate images
    let images: string[] | undefined
    if (body.images !== undefined) {
      if (!Array.isArray(body.images)) {
        return Response.json({ error: 'images must be an array' }, { status: 400 })
      }
      if (body.images.length > 5) {
        return Response.json({ error: 'Maximum 5 images per request' }, { status: 400 })
      }
      for (const img of body.images) {
        if (typeof img !== 'string' || !img.startsWith('data:image/')) {
          return Response.json({ error: 'Each image must be a base64 data URL' }, { status: 400 })
        }
      }
      images = body.images as string[]
    }

    const supabase = createServiceClient()
    const { workspaceId, user } = ctx

    // Load or create session
    const createSession = async (): Promise<string> => {
      const { data: session, error } = await supabase
        .from('ai_sessions')
        .insert({
          workspace_id: workspaceId,
          module: 'chat',
          title: `Chat: ${prompt.slice(0, 60)}`,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (error) throw error
      return session.id
    }

    let activeSessionId: string
    let historyMessages: ChatMessage[] = []

    if (sessionId) {
      // Verify session belongs to this workspace
      const { data: session } = await supabase
        .from('ai_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('workspace_id', workspaceId)
        .single()

      if (session) {
        activeSessionId = session.id
        // Load previous messages (last 20 to keep context window reasonable)
        const { data: prevMessages } = await supabase
          .from('ai_messages')
          .select('role, content')
          .eq('session_id', activeSessionId)
          .order('created_at', { ascending: true })
          .limit(20)

        if (prevMessages) {
          historyMessages = prevMessages as ChatMessage[]
        }
      } else {
        // Session not found or doesn't belong — start fresh
        activeSessionId = await createSession()
      }
    } else {
      activeSessionId = await createSession()
    }

    // Save the user message immediately
    await supabase.from('ai_messages').insert({
      session_id: activeSessionId,
      role: 'user',
      content: prompt,
      ...(images?.length ? { metadata: { images_count: images.length } } : {}),
    })

    // Build message history for the AI call
    const contextNote = `[วันเวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}]`
    let finalContext = contextNote
    if (context) finalContext = `${context}\n\n${contextNote}`

    // RAG: inject relevant workspace artifacts as context
    const ragContext = await findRelevantContext(supabase, prompt, workspaceId)
    if (ragContext) finalContext += `\n\n${ragContext}`

    // Pinecone Assistant: query company documents (service standards, guides, etc.)
    const pineconeContext = await queryPineconeAssistant(prompt)
    if (pineconeContext) finalContext += `\n\n${pineconeContext}`

    // Optionally enrich with Tavily web search
    if (process.env.TAVILY_API_KEY) {
      try {
        const { tavily } = await import('@tavily/core')
        const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY })
        const searchCtx = await tvly.searchContext(prompt, { searchDepth: 'basic' })
        if (searchCtx) {
          finalContext += `\n\n[Real-time Search]:\n${typeof searchCtx === 'string' ? searchCtx : JSON.stringify(searchCtx)}`
        }
      } catch {
        // Tavily is optional — continue without it
      }
    }

    const aiMessages: ChatMessage[] = [
      ...historyMessages,
      { role: 'user', content: prompt },
    ]

    const start = Date.now()

    // SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = ''

        function send(data: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          for await (const chunk of streamChat(aiMessages, finalContext, images)) {
            fullContent += chunk
            send({ text: chunk })
          }

          // Persist assistant message + ai_run after stream completes
          const latency = Date.now() - start

          const { data: runRecord } = await supabase
            .from('ai_runs')
            .insert({
              session_id: activeSessionId,
              module: 'chat',
              prompt_key: 'chat',
              prompt_version: 1,
              provider: process.env.AI_PROVIDER ?? 'anthropic',
              model: process.env.ANTHROPIC_MODEL ?? process.env.OPENAI_MODEL ?? 'claude-sonnet-4-6',
              status: 'success',
              input_json: { prompt, context, images_count: images?.length ?? 0 },
              output_json: { content: fullContent },
              latency_ms: latency,
              finished_at: new Date().toISOString(),
            })
            .select('id')
            .single()

          await supabase.from('ai_messages').insert({
            session_id: activeSessionId,
            role: 'assistant',
            content: fullContent,
            metadata: { latency_ms: latency, run_id: runRecord?.id },
          })

          // Signal done with sessionId so client can continue the conversation
          send({ done: true, sessionId: activeSessionId })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error'
          send({ error: msg })
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
        'X-Accel-Buffering': 'no', // Disable nginx/caddy buffering
      },
    })
  } catch (err) {
    return handleRouteError(err, 'api/ai/chat')
  }
}
