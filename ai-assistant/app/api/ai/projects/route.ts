import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runProjectPlannerPrompt } from '@/lib/ai'
import type { GenerateProjectPlanRequest } from '@/types'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateProjectPlanRequest
    const { workspaceId, projectId, goal, scope } = body

    if (!workspaceId || !projectId || !goal) {
      return NextResponse.json({ error: 'workspaceId, projectId, and goal are required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const start = Date.now()

    // Create AI session
    const { data: session, error: sessionErr } = await supabase
      .from('ai_sessions')
      .insert({
        workspace_id: workspaceId,
        project_id: projectId,
        module: 'project',
        title: `Plan: ${goal.slice(0, 80)}`,
      })
      .select()
      .single()

    if (sessionErr) throw sessionErr

    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'user',
      content: goal,
      metadata: { scope },
    })

    const result = await runProjectPlannerPrompt(goal, scope)
    const latency = Date.now() - start

    const { data: runRecord } = await supabase
      .from('ai_runs')
      .insert({
        session_id: session.id,
        module: 'project',
        prompt_key: 'project_plan',
        prompt_version: 1,
        provider: result.provider,
        model: result.model,
        status: 'success',
        input_json: { goal, scope },
        output_json: { milestones: result.milestones, docs: result.docs },
        latency_ms: latency,
        finished_at: new Date().toISOString(),
      })
      .select()
      .single()

    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'assistant',
      content: JSON.stringify({ milestones: result.milestones }),
      metadata: { latency_ms: latency },
    })

    // Save project plan as artifact
    const { data: artifact } = await supabase
      .from('artifacts')
      .insert({
        workspace_id: workspaceId,
        project_id: projectId,
        ai_run_id: runRecord?.id ?? null,
        artifact_type: 'project_plan',
        title: `Project Plan: ${goal.slice(0, 60)}`,
        content: JSON.stringify({ goal, scope, milestones: result.milestones, docs: result.docs }, null, 2),
        format: 'json',
      })
      .select()
      .single()

    // Save generated docs to project_docs
    if (result.docs?.length) {
      const docRows = result.docs.map((d) => ({
        project_id: projectId,
        doc_type: d.doc_type,
        title: d.title,
        content_md: d.content_md,
      }))
      await supabase.from('project_docs').insert(docRows)
    }

    return NextResponse.json({
      sessionId: session.id,
      artifactId: artifact?.id,
      summary: result.summary,
      milestones: result.milestones,
      docs: result.docs,
    })
  } catch (err: unknown) {
    console.error('[api/ai/projects]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
