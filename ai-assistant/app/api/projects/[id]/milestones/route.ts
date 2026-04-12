import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { requireString, optionalString } from '@/lib/api/validate'
import { handleRouteError } from '@/lib/api/errors'

interface Props { params: { id: string } }

/** GET /api/projects/[id]/milestones */
export async function GET(_req: Request, { params }: Props) {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  const supabase = createServiceClient()

  // Verify project belongs to this workspace
  const { data: project } = await supabase
    .from('projects').select('id').eq('id', params.id).eq('workspace_id', ctx.workspaceId).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('milestones')
    .select('*, tasks(*)')
    .eq('project_id', params.id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** POST /api/projects/[id]/milestones — create a milestone */
export async function POST(request: Request, { params }: Props) {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  try {
    const body = await request.json() as { title?: unknown; description?: unknown; due_date?: unknown; sort_order?: unknown }

    const title = requireString(body.title, 'title', { max: 200 })
    const description = optionalString(body.description, 'description', { max: 1000 })
    const due_date = optionalString(body.due_date, 'due_date')
    const sort_order = typeof body.sort_order === 'number' ? body.sort_order : 0

    const supabase = createServiceClient()

    // Verify project belongs to this workspace
    const { data: project } = await supabase
      .from('projects').select('id').eq('id', params.id).eq('workspace_id', ctx.workspaceId).single()
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('milestones')
      .insert({ project_id: params.id, title, description, due_date, sort_order })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'api/projects/[id]/milestones POST')
  }
}
