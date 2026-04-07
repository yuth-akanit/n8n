export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import type { GeneratedIdea } from '@/types'

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as Omit<GeneratedIdea, never> & { workspaceId?: string }
    const { title, brief, audience, problem, solution, channel, score_impact, score_ease, score_roi } = body

    if (!title || !brief) {
      return NextResponse.json({ error: 'title and brief are required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('ideas')
      .insert({
        workspace_id: ctx.workspaceId,
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
        created_by: ctx.user.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    console.error('[api/ideas POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
