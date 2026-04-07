import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me — returns the current user's auth context.
 * Used by client components that need userId / workspaceId.
 */
export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    userId: ctx.user.id,
    workspaceId: ctx.workspaceId,
  })
}
