import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { handleRouteError } from '@/lib/api/errors'

export const dynamic = 'force-dynamic'

/** GET /api/ai/chat/sessions/[id] — load messages for a session */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  try {
    const supabase = createServiceClient()

    // Verify session belongs to workspace
    const { data: session } = await supabase
      .from('ai_sessions')
      .select('id, title, created_at')
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .eq('module', 'chat')
      .single()

    if (!session) return Response.json({ error: 'Not found' }, { status: 404 })

    const { data: messages, error } = await supabase
      .from('ai_messages')
      .select('role, content, created_at')
      .eq('session_id', params.id)
      .order('created_at', { ascending: true })

    if (error) throw error
    return Response.json({ session, messages: messages ?? [] })
  } catch (err) {
    return handleRouteError(err, `api/ai/chat/sessions/${params.id}`)
  }
}
