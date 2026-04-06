import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils'
import type { Idea } from '@/types'

// POST /api/ideas/promote — convert idea to project
export async function POST(request: Request) {
  try {
    const body = await request.json() as { ideaId: string; workspaceId: string }
    const { ideaId, workspaceId } = body

    if (!ideaId || !workspaceId) {
      return NextResponse.json({ error: 'ideaId and workspaceId are required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Fetch idea
    const { data: idea, error: ideaErr } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', ideaId)
      .single()

    if (ideaErr || !idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
    }

    const i = idea as Idea

    // Generate unique slug
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

    // Create project from idea
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
      })
      .select()
      .single()

    if (projectErr) throw projectErr

    // Mark idea as converted
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
