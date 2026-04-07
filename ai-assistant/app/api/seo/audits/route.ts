export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'

export async function GET() {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('seo_audits')
    .select(`id, target_url, status, score_overall, created_at, seo_sites!inner(name, workspace_id)`)
    .eq('seo_sites.workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
