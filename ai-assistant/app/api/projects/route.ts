export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { slugify } from '@/lib/utils'
import type { ProjectType, Priority } from '@/types'

export async function GET() {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as {
      name: string
      project_type: ProjectType
      goal?: string
      summary?: string
      priority?: Priority
    }
    const { name, project_type, goal, summary, priority } = body

    if (!name || !project_type) {
      return NextResponse.json({ error: 'name and project_type are required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { workspaceId, user } = ctx

    const baseSlug = slugify(name)
    let slug = baseSlug
    let attempt = 0

    while (true) {
      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('slug', slug)
        .single()
      if (!existing) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        workspace_id: workspaceId,
        name,
        slug,
        project_type,
        goal,
        summary,
        priority: priority ?? 'medium',
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    console.error('[api/projects POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
