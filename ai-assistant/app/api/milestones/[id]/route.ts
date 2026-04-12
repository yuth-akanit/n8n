import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { requireString, optionalString, requireOneOf } from '@/lib/api/validate'
import { handleRouteError } from '@/lib/api/errors'
import type { MilestoneStatus } from '@/types'

interface Props { params: { id: string } }

const MILESTONE_STATUSES = ['todo', 'in_progress', 'blocked', 'done'] as const

/** PATCH /api/milestones/[id] — update title, description, status, due_date */
export async function PATCH(request: Request, { params }: Props) {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  try {
    const body = await request.json() as {
      title?: unknown; description?: unknown; status?: unknown; due_date?: unknown
    }

    const update: Record<string, unknown> = {}
    if (body.title !== undefined) update.title = requireString(body.title, 'title', { max: 200 })
    if (body.description !== undefined) update.description = optionalString(body.description, 'description', { max: 1000 })
    if (body.status !== undefined) update.status = requireOneOf<MilestoneStatus>(body.status, 'status', MILESTONE_STATUSES)
    if (body.due_date !== undefined) update.due_date = optionalString(body.due_date, 'due_date')

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify milestone belongs to this workspace via project
    const { data: ms } = await supabase
      .from('milestones')
      .select('id, projects!inner(workspace_id)')
      .eq('id', params.id)
      .eq('projects.workspace_id', ctx.workspaceId)
      .single()

    if (!ms) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('milestones')
      .update(update)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    return handleRouteError(err, 'api/milestones/[id] PATCH')
  }
}

/** DELETE /api/milestones/[id] */
export async function DELETE(_req: Request, { params }: Props) {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  const supabase = createServiceClient()

  const { data: ms } = await supabase
    .from('milestones')
    .select('id, projects!inner(workspace_id)')
    .eq('id', params.id)
    .eq('projects.workspace_id', ctx.workspaceId)
    .single()

  if (!ms) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })

  const { error } = await supabase.from('milestones').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
