import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { slugify } from '@/lib/utils'
import type { Idea } from '@/types'

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as { ideaId: string }
    const { ideaId } = body

    if (!ideaId) {
      return NextResponse.json({ error: 'ideaId is required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { workspaceId, user } = ctx

    // Fetch idea and verify it belongs to the user's workspace
    const { data: idea, error: ideaErr } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', ideaId)
      .eq('workspace_id', workspaceId)
      .single()

    if (ideaErr || !idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
    }

    const i = idea as Idea

    const baseSlug = slugify(i.title)
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

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .insert({
        workspace_id: workspaceId,
        idea_id: ideaId,
        name: i.title,
        slug,
        project_type: 'idea',
        summary: i.brief,
        goal: i.solution ?? i.brief,
        status: 'planning',
        priority: 'medium',
        created_by: user.id,
      })
      .select()
      .single()

    if (projectErr) throw projectErr

    await supabase
      .from('ideas')
      .update({ status: 'converted', updated_at: new Date().toISOString() })
      .eq('id', ideaId)

    return NextResponse.json({ projectId: project.id, slug: project.slug })
  } catch (err: unknown) {
    console.error('[api/ideas/promote]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
