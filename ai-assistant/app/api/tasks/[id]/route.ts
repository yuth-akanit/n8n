import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { requireString, optionalString, requireOneOf, optionalUuid } from '@/lib/api/validate'
import { handleRouteError } from '@/lib/api/errors'
import type { TaskStatus, Priority } from '@/types'

interface Props { params: { id: string } }

const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'review', 'done'] as const
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

/** PATCH /api/tasks/[id] — update title, status, priority, description, milestone_id */
export async function PATCH(request: Request, { params }: Props) {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  try {
    const body = await request.json() as {
      title?: unknown; description?: unknown; status?: unknown;
      priority?: unknown; milestone_id?: unknown; estimate_hours?: unknown
    }

    const update: Record<string, unknown> = {}
    if (body.title !== undefined)       update.title = requireString(body.title, 'title', { max: 300 })
    if (body.description !== undefined) update.description = optionalString(body.description, 'description', { max: 2000 })
    if (body.status !== undefined)      update.status = requireOneOf<TaskStatus>(body.status, 'status', TASK_STATUSES)
    if (body.priority !== undefined)    update.priority = requireOneOf<Priority>(body.priority, 'priority', PRIORITIES)
    if (body.milestone_id !== undefined) update.milestone_id = optionalUuid(body.milestone_id, 'milestone_id')
    if (typeof body.estimate_hours === 'number') update.estimate_hours = body.estimate_hours > 0 ? body.estimate_hours : null
    update.updated_at = new Date().toISOString()

    if (Object.keys(update).length <= 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify task belongs to this workspace via project
    const { data: task } = await supabase
      .from('tasks')
      .select('id, projects!inner(workspace_id)')
      .eq('id', params.id)
      .eq('projects.workspace_id', ctx.workspaceId)
      .single()

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('tasks')
      .update(update)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    return handleRouteError(err, 'api/tasks/[id] PATCH')
  }
}

/** DELETE /api/tasks/[id] */
export async function DELETE(_req: Request, { params }: Props) {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  const supabase = createServiceClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('id, projects!inner(workspace_id)')
    .eq('id', params.id)
    .eq('projects.workspace_id', ctx.workspaceId)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const { error } = await supabase.from('tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
