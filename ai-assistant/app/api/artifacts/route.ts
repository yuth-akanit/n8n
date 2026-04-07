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

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('artifacts')
    .select('id, title, artifact_type, format, created_at, project_id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('is_latest', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
