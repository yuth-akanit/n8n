import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { handleRouteError } from '@/lib/api/errors'
import { requireString, optionalString } from '@/lib/api/validate'

export const dynamic = 'force-dynamic'

export async function GET() {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('workspace_context')
      .select('id, title, content_md, is_active, updated_at')
      .eq('workspace_id', ctx.workspaceId)
      .single()

    return NextResponse.json(data ?? { title: 'Workspace Brief', content_md: '', is_active: true })
  } catch (err) {
    return handleRouteError(err, 'api/workspace/context GET')
  }
}

export async function POST(request: Request) {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  try {
    const body = await request.json() as { title?: unknown; content_md?: unknown; is_active?: unknown }
    const title = optionalString(body.title, 'title', { max: 200 }) ?? 'Workspace Brief'
    const content_md = requireString(body.content_md, 'content_md', { max: 20000 })
    const is_active = body.is_active !== false

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('workspace_context')
      .upsert(
        {
          workspace_id: ctx.workspaceId,
          title,
          content_md,
          is_active,
          created_by: ctx.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id' }
      )
      .select('id, title, content_md, is_active, updated_at')
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    return handleRouteError(err, 'api/workspace/context POST')
  }
}
