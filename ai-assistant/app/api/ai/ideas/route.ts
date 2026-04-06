import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runIdeaPrompt } from '@/lib/ai'
import type { GenerateIdeasRequest } from '@/types'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateIdeasRequest
    const { workspaceId, prompt, constraints } = body

    if (!workspaceId || !prompt) {
      return NextResponse.json({ error: 'workspaceId and prompt are required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const start = Date.now()

    // Create AI session
    const { data: session, error: sessionErr } = await supabase
      .from('ai_sessions')
      .insert({
        workspace_id: workspaceId,
        module: 'idea',
        title: prompt.slice(0, 80),
      })
      .select()
      .single()

    if (sessionErr) throw sessionErr

    // Save user message
    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'user',
      content: prompt,
      metadata: { constraints },
    })

    // Run AI
    const result = await runIdeaPrompt(prompt, constraints)
    const latency = Date.now() - start

    // Save AI run record
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

    // Save AI assistant message
    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'assistant',
      content: JSON.stringify({ ideas: result.ideas }),
      metadata: { latency_ms: latency },
    })

    // Save artifact
    const { data: artifact } = await supabase
      .from('artifacts')
      .insert({
        workspace_id: workspaceId,
        ai_run_id: runRecord?.id ?? null,
        artifact_type: 'idea_doc',
        title: `Ideas: ${prompt.slice(0, 60)}`,
        content: JSON.stringify({ prompt, constraints, ideas: result.ideas }, null, 2),
        format: 'json',
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
