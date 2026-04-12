/**
 * Artifact versioning helper.
 *
 * Every time we generate a new artifact of the same type for the same
 * workspace+project, we:
 *   1. Mark the current latest as is_latest = false
 *   2. Return the next version number (previous + 1, or 1 if none exist)
 *
 * Usage:
 *   const version = await resolveNextArtifactVersion(supabase, { workspaceId, projectId, artifactType })
 *   // then insert with { version, is_latest: true }
 */
import type { ArtifactType } from '@/types'

// We accept any Supabase client-shaped object to avoid importing the SDK type directly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

export async function resolveNextArtifactVersion(
  supabase: SupabaseLike,
  opts: {
    workspaceId: string
    projectId?: string | null
    artifactType: ArtifactType
  }
): Promise<number> {
  const { workspaceId, projectId, artifactType } = opts

  // Find the current latest version for this scope
  let query = supabase
    .from('artifacts')
    .select('id, version')
    .eq('workspace_id', workspaceId)
    .eq('artifact_type', artifactType)
    .eq('is_latest', true)
    .order('version', { ascending: false })
    .limit(1)

  if (projectId) {
    query = query.eq('project_id', projectId)
  } else {
    query = query.is('project_id', null)
  }

  const { data: existing } = await query.single()

  if (existing) {
    // Mark old version as superseded
    await supabase
      .from('artifacts')
      .update({ is_latest: false })
      .eq('id', existing.id)

    return (existing.version as number) + 1
  }

  return 1
}
