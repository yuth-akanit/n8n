export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'

interface Props { params: { id: string } }

/**
 * GET /api/artifacts/[id]/versions
 * Returns all versions of the same artifact family
 * (same workspace_id + artifact_type + project_id as the given artifact).
 */
export async function GET(_req: Request, { params }: Props) {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  const supabase = createServiceClient()

  // First, fetch the reference artifact to find its family
  const { data: ref, error: refErr } = await supabase
    .from('artifacts')
    .select('id, workspace_id, artifact_type, project_id')
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .single()

  if (refErr || !ref) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
  }

  // Fetch all versions in this artifact family
  let query = supabase
    .from('artifacts')
    .select('id, title, artifact_type, format, version, is_latest, created_at, ai_run_id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('artifact_type', ref.artifact_type)
    .order('version', { ascending: false })

  if (ref.project_id) {
    query = query.eq('project_id', ref.project_id)
  } else {
    query = query.is('project_id', null)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
