/**
 * Server-side auth helpers.
 *
 * getAuthContext()    — use in Server Components (reads cookies via createClient)
 * requireApiAuth()   — use in Route Handlers (same, but throws NextResponse on failure)
 *
 * Both:
 *  1. Verify the user is authenticated
 *  2. Resolve (or auto-create) their workspace membership
 *  3. Return { user, workspaceId }
 */
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils'

export interface AuthContext {
  user: { id: string; email?: string }
  workspaceId: string
}

// ── Server Component usage ───────────────────────────────────

/**
 * Returns auth context or null (caller decides how to handle unauthenticated).
 * Safe to call from any Server Component.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const workspaceId = await resolveWorkspace(user.id, user.email ?? undefined)
  return { user: { id: user.id, email: user.email ?? undefined }, workspaceId }
}

// ── Route Handler usage ──────────────────────────────────────

/**
 * Returns auth context or throws a NextResponse with the appropriate status.
 * Use this at the top of every mutation Route Handler.
 */
export async function requireApiAuth(): Promise<AuthContext> {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaceId = await resolveWorkspace(user.id, user.email ?? undefined)
  return { user: { id: user.id, email: user.email ?? undefined }, workspaceId }
}

/**
 * Like requireApiAuth but also validates the client-supplied workspaceId
 * matches the user's membership. Useful for multi-workspace flows.
 */
export async function requireWorkspaceAccess(requestedWorkspaceId: string): Promise<AuthContext> {
  const ctx = await requireApiAuth()

  if (ctx.workspaceId !== requestedWorkspaceId) {
    // Check if the user is a member of the requested workspace
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', ctx.user.id)
      .eq('workspace_id', requestedWorkspaceId)
      .single()

    if (!data) {
      throw NextResponse.json({ error: 'Forbidden: no access to this workspace' }, { status: 403 })
    }

    return { ...ctx, workspaceId: requestedWorkspaceId }
  }

  return ctx
}

// ── Workspace bootstrap ──────────────────────────────────────

/**
 * Finds the user's primary workspace, or creates one if they have none.
 * Uses the service-role client so it works regardless of RLS state.
 */
async function resolveWorkspace(userId: string, email?: string): Promise<string> {
  const supabase = createServiceClient()

  // Find existing membership (return first workspace)
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (membership?.workspace_id) return membership.workspace_id

  // Bootstrap: create a personal workspace for this user
  const displayName = email?.split('@')[0] ?? 'workspace'
  const baseSlug = slugify(displayName)
  // Append short user-id suffix to ensure uniqueness
  const slug = `${baseSlug}-${userId.slice(0, 8)}`

  const { data: workspace, error: wsErr } = await supabase
    .from('workspaces')
    .insert({ name: `${displayName}'s Workspace`, slug })
    .select()
    .single()

  if (wsErr || !workspace) {
    // Slug collision — try with timestamp
    const { data: ws2 } = await supabase
      .from('workspaces')
      .insert({ name: `${displayName}'s Workspace`, slug: `${slug}-${Date.now()}` })
      .select()
      .single()
    if (!ws2) throw new Error('Failed to create workspace')
    await addOwnerMembership(supabase, ws2.id, userId)
    return ws2.id
  }

  await addOwnerMembership(supabase, workspace.id, userId)
  return workspace.id
}

async function addOwnerMembership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  userId: string
) {
  await supabase.from('workspace_members').insert({
    workspace_id: workspaceId,
    user_id: userId,
    role: 'owner',
  })
}
