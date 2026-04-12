import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { runProjectPlannerPrompt } from '@/lib/ai'
import { requireString, requireUuid, optionalString } from '@/lib/api/validate'
import { handleRouteError } from '@/lib/api/errors'
import { resolveNextArtifactVersion } from '@/lib/artifacts'

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as { projectId?: unknown; goal?: unknown; scope?: unknown }

    const projectId = requireUuid(body.projectId, 'projectId')
    const goal = requireString(body.goal, 'goal', { max: 2000 })
    const scope = optionalString(body.scope, 'scope', { max: 1000 })

    const supabase = createServiceClient()
    const { workspaceId, user } = ctx
    const start = Date.now()

    // Verify project belongs to this workspace
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data: session, error: sessionErr } = await supabase
      .from('ai_sessions')
      .insert({
        workspace_id: workspaceId,
        project_id: projectId,
        module: 'project',
        title: `Plan: ${goal.slice(0, 80)}`,
        created_by: user.id,
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

    const version = await resolveNextArtifactVersion(supabase, {
      workspaceId,
      projectId,
      artifactType: 'project_plan',
    })

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
        version,
        is_latest: true,
        created_by: user.id,
      })
      .select()
      .single()

    if (result.docs?.length) {
      const docRows = result.docs.map((d) => ({
        project_id: projectId,
        doc_type: d.doc_type,
        title: d.title,
        content_md: d.content_md,
        created_by: user.id,
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
  } catch (err) {
    return handleRouteError(err, 'api/ai/projects')
  }
}
