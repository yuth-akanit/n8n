import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runBuilderPrompt } from '@/lib/ai'
import type { BuilderRequest } from '@/types'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BuilderRequest
    const { workspaceId, projectId, mode, prompt } = body

    if (!workspaceId || !mode || !prompt) {
      return NextResponse.json({ error: 'workspaceId, mode, and prompt are required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const start = Date.now()

    // Create AI session
    const { data: session, error: sessionErr } = await supabase
      .from('ai_sessions')
      .insert({
        workspace_id: workspaceId,
        project_id: projectId ?? null,
        module: 'builder',
        title: `${mode}: ${prompt.slice(0, 60)}`,
      })
      .select()
      .single()

    if (sessionErr) throw sessionErr

    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'user',
      content: prompt,
      metadata: { mode },
    })

    const result = await runBuilderPrompt(mode, prompt)
    const latency = Date.now() - start

    const { data: runRecord } = await supabase
      .from('ai_runs')
      .insert({
        session_id: session.id,
        module: 'builder',
        prompt_key: `builder_${mode}`,
        prompt_version: 1,
        provider: result.provider,
        model: result.model,
        status: 'success',
        input_json: { mode, prompt },
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

    const artifactTypeMap: Record<string, string> = {
      spec: 'markdown',
      sql: 'sql',
      api: 'markdown',
      ui: 'markdown',
      code_patch: 'code',
    }

    const formatMap: Record<string, string> = {
      spec: 'md',
      sql: 'sql',
      api: 'md',
      ui: 'md',
      code_patch: 'ts',
    }

    const { data: artifact } = await supabase
      .from('artifacts')
      .insert({
        workspace_id: workspaceId,
        project_id: projectId ?? null,
        ai_run_id: runRecord?.id ?? null,
        artifact_type: artifactTypeMap[mode] ?? 'markdown',
        title: `${result.title}: ${prompt.slice(0, 50)}`,
        content: result.content,
        format: formatMap[mode] ?? 'md',
      })
      .select()
      .single()

    return NextResponse.json({
      sessionId: session.id,
      artifactId: artifact?.id,
      content: result.content,
      title: `${result.title}: ${prompt.slice(0, 50)}`,
    })
  } catch (err: unknown) {
    console.error('[api/ai/builder]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
