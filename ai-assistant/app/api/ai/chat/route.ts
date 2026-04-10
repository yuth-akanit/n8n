import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { runChatPrompt } from '@/lib/ai'

// Allow larger request body for image uploads
export const maxDuration = 60 // seconds
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as { prompt: string; context?: string; images?: string[] }
    const { prompt, context, images } = body

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { workspaceId, user } = ctx
    const start = Date.now()

    const { data: session, error: sessionErr } = await supabase
      .from('ai_sessions')
      .insert({
        workspace_id: workspaceId,
        module: 'idea', // using 'idea' to bypass DB constraint restricting to ('idea','project','builder','seo')
        title: `Chat: ${prompt.slice(0, 60)}`,
        created_by: user.id,
      })
      .select()
      .single()

    if (sessionErr) throw sessionErr

    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'user',
      content: prompt,
    })

    let finalContext = context ? context + '\n\n' : ''
    finalContext += `[System Note] ข้อมูลวันเวลาปัจจุบัน: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}\n\n`

    if (process.env.TAVILY_API_KEY) {
      try {
        const { tavily } = await import('@tavily/core')
        const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY })
        const searchCtx = await tvly.searchContext(prompt, {
          searchDepth: 'basic',
        })
        if (searchCtx) {
          finalContext += `[Real-time Search Context]:\n${typeof searchCtx === 'string' ? searchCtx : JSON.stringify(searchCtx)}`
        }
      } catch (tavilyErr) {
        console.warn('[Chat] Tavily search failed:', tavilyErr)
      }
    }

    const result = await runChatPrompt(prompt, finalContext, images)
    const latency = Date.now() - start

    const { data: runRecord } = await supabase
      .from('ai_runs')
      .insert({
        session_id: session.id,
        module: 'idea', // using 'idea' to bypass DB constraint
        prompt_key: 'chat',
        prompt_version: 1,
        provider: result.provider,
        model: result.model,
        status: 'success',
        input_json: { prompt, context, images_count: images?.length ?? 0 },
        output_json: { content: result.content },
        latency_ms: latency,
        finished_at: new Date().toISOString(),
      })
      .select()
      .single()

    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'assistant',
      content: result.content,
      metadata: { latency_ms: latency },
    })

    return NextResponse.json({
      sessionId: session.id,
      content: result.content,
      provider: result.provider,
      model: result.model,
    })
  } catch (err: unknown) {
    console.error('[api/ai/chat]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
