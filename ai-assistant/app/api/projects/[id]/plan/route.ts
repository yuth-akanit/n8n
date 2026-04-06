import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { GeneratedMilestone } from '@/types'

// POST /api/projects/[id]/plan — save AI-generated plan (milestones + tasks + docs)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as {
      milestones: GeneratedMilestone[]
      summary?: string
    }
    const { milestones, summary } = body
    const projectId = params.id

    if (!milestones?.length) {
      return NextResponse.json({ error: 'milestones are required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Update project summary if provided
    if (summary) {
      await supabase
        .from('projects')
        .update({ summary, status: 'planning', updated_at: new Date().toISOString() })
        .eq('id', projectId)
    }

    // Delete existing milestones + tasks (replace strategy)
    await supabase.from('tasks').delete().eq('project_id', projectId)
    await supabase.from('milestones').delete().eq('project_id', projectId)

    // Insert milestones and their tasks
    for (const m of milestones) {
      const { data: milestone, error: mErr } = await supabase
        .from('milestones')
        .insert({
          project_id: projectId,
          title: m.title,
          description: m.description,
          sort_order: m.sort_order,
        })
        .select()
        .single()

      if (mErr) throw mErr

      if (m.tasks?.length) {
        const taskRows = m.tasks.map((t) => ({
          project_id: projectId,
          milestone_id: milestone.id,
          title: t.title,
          description: t.description,
          task_type: t.task_type,
          priority: t.priority,
          estimate_hours: t.estimate_hours,
          status: 'todo',
        }))

        const { error: tErr } = await supabase.from('tasks').insert(taskRows)
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
