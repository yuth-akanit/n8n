import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('projects')
    .select(`*, milestones(*), tasks(*), project_docs(*)`)
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId) // Scope to user's workspace
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
