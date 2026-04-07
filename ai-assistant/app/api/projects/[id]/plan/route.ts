import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import type { GeneratedMilestone } from '@/types'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as { milestones: GeneratedMilestone[]; summary?: string }
    const { milestones, summary } = body
    const projectId = params.id

    if (!milestones?.length) {
      return NextResponse.json({ error: 'milestones are required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify project belongs to user's workspace
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('workspace_id', ctx.workspaceId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (summary) {
      await supabase
        .from('projects')
        .update({ summary, status: 'planning', updated_at: new Date().toISOString() })
        .eq('id', projectId)
    }

    // Replace existing plan
    await supabase.from('tasks').delete().eq('project_id', projectId)
    await supabase.from('milestones').delete().eq('project_id', projectId)

    for (const m of milestones) {
      const { data: milestone, error: mErr } = await supabase
        .from('milestones')
        .insert({ project_id: projectId, title: m.title, description: m.description, sort_order: m.sort_order })
        .select()
        .single()

      if (mErr) throw mErr

      if (m.tasks?.length) {
        const { error: tErr } = await supabase.from('tasks').insert(
          m.tasks.map((t) => ({
            project_id: projectId,
            milestone_id: milestone.id,
            title: t.title,
            description: t.description,
            task_type: t.task_type,
            priority: t.priority,
            estimate_hours: t.estimate_hours,
            status: 'todo',
            created_by: ctx.user.id,
          }))
        )
        if (tErr) throw tErr
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[api/projects/[id]/plan]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
