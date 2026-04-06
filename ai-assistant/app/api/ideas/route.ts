export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { GeneratedIdea } from '@/types'

// POST /api/ideas — save a generated idea to the database
export async function POST(request: Request) {
  try {
    const body = await request.json() as GeneratedIdea & { workspaceId: string }
    const { workspaceId, title, brief, audience, problem, solution, channel, score_impact, score_ease, score_roi } = body

    if (!workspaceId || !title || !brief) {
      return NextResponse.json({ error: 'workspaceId, title, and brief are required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('ideas')
      .insert({
        workspace_id: workspaceId,
        title,
        brief,
        audience,
        problem,
        solution,
        channel: channel ?? [],
        score_impact,
        score_ease,
        score_roi,
        status: 'new',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    console.error('[api/ideas]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
