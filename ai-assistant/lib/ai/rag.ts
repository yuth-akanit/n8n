/**
 * Retrieval-Augmented Generation helpers.
 * Finds relevant artifacts from the workspace using pgvector similarity search,
 * then formats them as context to inject into AI prompts.
 */
import { generateEmbedding } from './embed'
import type { SupabaseClient } from '@supabase/supabase-js'

interface ArtifactMatch {
  id: string
  title: string
  content: string
  artifact_type: string
  similarity: number
}

/**
 * Find workspace artifacts relevant to the query and return them as a
 * formatted context string ready to inject into a system/user prompt.
 * Returns '' if embeddings are unavailable or no matches found.
 */
export async function findRelevantContext(
  supabase: SupabaseClient,
  query: string,
  workspaceId: string,
  opts: { matchCount?: number; threshold?: number } = {}
): Promise<string> {
  const { matchCount = 3, threshold = 0.6 } = opts

  const embedding = await generateEmbedding(query)
  if (!embedding) return ''

  const { data, error } = await supabase.rpc('match_artifacts', {
    query_embedding: embedding,
    workspace_id_param: workspaceId,
    match_count: matchCount,
    match_threshold: threshold,
  })

  if (error || !data || data.length === 0) return ''

  const matches = data as ArtifactMatch[]
  const sections = matches.map((m) =>
    `[${m.artifact_type}] "${m.title}" (ความเกี่ยวข้อง ${Math.round(m.similarity * 100)}%)\n${m.content.slice(0, 600)}`
  )

  return `[ข้อมูลที่เกี่ยวข้องจาก workspace]\n${sections.join('\n\n---\n\n')}`
}

/**
 * Save an embedding for an artifact — call fire-and-forget after artifact creation.
 */
export async function embedArtifact(
  supabase: SupabaseClient,
  artifactId: string,
  text: string
): Promise<void> {
  const embedding = await generateEmbedding(text)
  if (!embedding) return

  const { error } = await supabase
    .from('artifacts')
    .update({ embedding })
    .eq('id', artifactId)

  if (error) console.warn('[rag] Failed to save embedding:', error.message)
}
