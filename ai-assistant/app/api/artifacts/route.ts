export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId') ?? '00000000-0000-0000-0000-000000000001'
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('artifacts')
    .select('id, title, artifact_type, format, created_at, project_id')
    .eq('workspace_id', workspaceId)
    .eq('is_latest', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
