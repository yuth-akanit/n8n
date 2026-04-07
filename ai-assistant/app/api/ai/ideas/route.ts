import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { runIdeaPrompt } from '@/lib/ai'

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as { prompt: string; constraints?: string }
    const { prompt, constraints } = body

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
        module: 'idea',
        title: prompt.slice(0, 80),
        created_by: user.id,
      })
      .select()
      .single()

    if (sessionErr) throw sessionErr

    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'user',
      content: prompt,
      metadata: { constraints },
    })

    const result = await runIdeaPrompt(prompt, constraints)
    const latency = Date.now() - start

    const { data: runRecord } = await supabase
      .from('ai_runs')
      .insert({
        session_id: session.id,
        module: 'idea',
        prompt_key: 'ideas_generate',
        prompt_version: 1,
        provider: result.provider,
        model: result.model,
        status: 'success',
        input_json: { prompt, constraints },
        output_json: { ideas: result.ideas },
        latency_ms: latency,
        finished_at: new Date().toISOString(),
      })
      .select()
      .single()

    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'assistant',
      content: JSON.stringify({ ideas: result.ideas }),
      metadata: { latency_ms: latency },
    })

    const { data: artifact } = await supabase
      .from('artifacts')
      .insert({
        workspace_id: workspaceId,
        ai_run_id: runRecord?.id ?? null,
        artifact_type: 'idea_doc',
        title: `Ideas: ${prompt.slice(0, 60)}`,
        content: JSON.stringify({ prompt, constraints, ideas: result.ideas }, null, 2),
        format: 'json',
        created_by: user.id,
      })
      .select()
      .single()

    return NextResponse.json({
      sessionId: session.id,
      artifactId: artifact?.id,
      ideas: result.ideas,
    })
  } catch (err: unknown) {
    console.error('[api/ai/ideas]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
