import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { handleRouteError } from '@/lib/api/errors'

export const dynamic = 'force-dynamic'

/** GET /api/ai/chat/sessions — list recent chat sessions for the workspace */
export async function GET() {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  try {
    const supabase = createServiceClient()
    const { data: sessions, error } = await supabase
      .from('ai_sessions')
      .select('id, title, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .eq('module', 'chat')
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error
    return Response.json({ sessions: sessions ?? [] })
  } catch (err) {
    return handleRouteError(err, 'api/ai/chat/sessions')
  }
}
