import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  const supabase = createServiceClient()

  const { data: patch } = await supabase
    .from('seo_patches')
    .select('id, status, seo_audits!inner(seo_sites!inner(workspace_id))')
    .eq('id', params.id)
    .eq('seo_audits.seo_sites.workspace_id', ctx.workspaceId)
    .single()

  if (!patch) {
    return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
  }
  if (patch.status !== 'proposed') {
    return NextResponse.json({ error: 'Patch is not in proposed status' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('seo_patches')
    .update({ status: 'rejected' })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
