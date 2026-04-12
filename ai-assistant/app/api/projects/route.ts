export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { slugify } from '@/lib/utils'
import { requireString, requireOneOf, optionalString } from '@/lib/api/validate'
import { handleRouteError } from '@/lib/api/errors'
import type { ProjectType, Priority } from '@/types'

const PROJECT_TYPES = ['idea', 'app', 'automation', 'seo', 'content', 'internal_tool'] as const
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

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
      name?: unknown
      project_type?: unknown
      goal?: unknown
      summary?: unknown
      priority?: unknown
    }

    const name = requireString(body.name, 'name', { max: 200 })
    const project_type = requireOneOf<ProjectType>(body.project_type, 'project_type', PROJECT_TYPES)
    const goal = optionalString(body.goal, 'goal', { max: 2000 })
    const summary = optionalString(body.summary, 'summary', { max: 500 })
    const priority = body.priority
      ? requireOneOf<Priority>(body.priority, 'priority', PRIORITIES)
      : 'medium'

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
        priority,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'api/projects POST')
  }
}
