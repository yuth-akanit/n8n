/**
 * Load the active workspace context doc (brand guide / brief)
 * and return it formatted as a system prompt prefix.
 *
 * Returns '' if no context is configured — callers can safely append/ignore.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getWorkspaceContext(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data } = await supabase
    .from('workspace_context')
    .select('title, content_md')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .single()

  if (!data?.content_md?.trim()) return ''

  return `[${data.title ?? 'Workspace Brief'}]\n${data.content_md.trim()}`
}

/** Prepend workspace context to a system prompt if available */
export function withWorkspaceContext(systemPrompt: string, wsContext: string): string {
  if (!wsContext) return systemPrompt
  return `${wsContext}\n\n---\n\n${systemPrompt}`
}
