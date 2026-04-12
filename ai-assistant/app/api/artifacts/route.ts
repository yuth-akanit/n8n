export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'

export async function GET(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)
  const type = searchParams.get('type') // optional artifact_type filter

  const supabase = createServiceClient()
  // Images are independent artifacts (not versioned sequences) — show all of them
  const skipLatestFilter = type === 'image'

  let query = supabase
    .from('artifacts')
    .select('id, title, artifact_type, format, content, created_at, project_id')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!skipLatestFilter) query = query.eq('is_latest', true)
  if (type) query = query.eq('artifact_type', type)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
