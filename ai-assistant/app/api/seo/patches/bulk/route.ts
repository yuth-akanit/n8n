import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { requireOneOf } from '@/lib/api/validate'
import { handleRouteError } from '@/lib/api/errors'

/**
 * POST /api/seo/patches/bulk
 * Body: { ids: string[], action: 'approve' | 'reject' }
 * Bulk approve or reject multiple SEO patches in one request.
 */
export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as { ids?: unknown; action?: unknown }

    // Validate action
    const action = requireOneOf(body.action, 'action', ['approve', 'reject'] as const)

    // Validate ids array
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
    }
    if (body.ids.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 patches per bulk action' }, { status: 400 })
    }
    const ids = body.ids as string[]

    const supabase = createServiceClient()
    const { workspaceId, user } = ctx

    // Verify all patches belong to this workspace and are in 'proposed' status
    const { data: patches, error: fetchErr } = await supabase
      .from('seo_patches')
      .select('id, status, seo_audits!inner(seo_sites!inner(workspace_id))')
      .in('id', ids)
      .eq('seo_audits.seo_sites.workspace_id', workspaceId)

    if (fetchErr) throw fetchErr

    const found = patches ?? []
    const notFound = ids.filter((id) => !found.find((p) => p.id === id))
    if (notFound.length > 0) {
      return NextResponse.json(
        { error: `Patches not found or unauthorized: ${notFound.join(', ')}` },
        { status: 404 }
      )
    }

    const nonProposed = found.filter((p) => p.status !== 'proposed')
    if (nonProposed.length > 0) {
      return NextResponse.json(
        { error: `${nonProposed.length} patch(es) are not in 'proposed' status` },
        { status: 409 }
      )
    }

    // Apply the bulk update
    const updatePayload =
      action === 'approve'
        ? { status: 'approved' as const, approved_by: user.id, approved_at: new Date().toISOString() }
        : { status: 'rejected' as const }

    const { data: updated, error: updateErr } = await supabase
      .from('seo_patches')
      .update(updatePayload)
      .in('id', ids)
      .select()

    if (updateErr) throw updateErr

    return NextResponse.json({ updated: updated?.length ?? 0, patches: updated })
  } catch (err) {
    return handleRouteError(err, 'api/seo/patches/bulk')
  }
}
