export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { timeAgo } from '@/lib/utils'
import { ArtifactPreview } from '@/components/artifacts/ArtifactPreview'
import type { ArtifactType } from '@/types'

const ARTIFACT_TYPES: ArtifactType[] = [
  'idea_doc', 'project_plan', 'markdown', 'json', 'sql', 'code', 'seo_report', 'patch', 'image',
]

const TYPE_LABELS: Record<string, string> = {
  idea_doc: 'Idea Doc',
  project_plan: 'Plan',
  markdown: 'Markdown',
  json: 'JSON',
  sql: 'SQL',
  code: 'Code',
  seo_report: 'SEO Report',
  patch: 'Patch',
  image: 'Image',
}

interface Props {
  searchParams: { type?: string }
}

export default async function ArtifactsPage({ searchParams }: Props) {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')

  const { workspaceId } = ctx
  const supabase = createServiceClient()

  const typeFilter = ARTIFACT_TYPES.includes(searchParams.type as ArtifactType)
    ? (searchParams.type as ArtifactType)
    : null

  let query = supabase
    .from('artifacts')
    .select('id, title, artifact_type, format, content, created_at, project_id, version, is_latest')
    .eq('workspace_id', workspaceId)
    .eq('is_latest', true)
    .order('created_at', { ascending: false })
    .limit(100)

  if (typeFilter) {
    query = query.eq('artifact_type', typeFilter)
  }

  const { data: artifacts, error } = await query

  // Counts per type (from is_latest=true set)
  const { data: countRows } = await supabase
    .from('artifacts')
    .select('artifact_type')
    .eq('workspace_id', workspaceId)
    .eq('is_latest', true)

  const countByType = ARTIFACT_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = countRows?.filter((a) => a.artifact_type === t).length ?? 0
    return acc
  }, {})
  const total = countRows?.length ?? 0

  return (
    <div>
      <PageHeader
        title="Artifacts"
        description="All AI-generated outputs — specs, code, reports, images"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 mb-4">
          {error.message}
        </div>
      )}

      {/* Type filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Link
          href="/dashboard/artifacts"
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            !typeFilter
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          All ({total})
        </Link>
        {ARTIFACT_TYPES.filter((t) => (countByType[t] ?? 0) > 0).map((t) => (
          <Link
            key={t}
            href={`/dashboard/artifacts?type=${t}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              typeFilter === t
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {TYPE_LABELS[t]} ({countByType[t]})
          </Link>
        ))}
      </div>

      {!artifacts || artifacts.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">No artifacts found</p>
      ) : (
        <div className="space-y-2">
          {artifacts.map((a) => (
            <ArtifactPreview
              key={a.id}
              id={a.id}
              title={a.title}
              artifactType={a.artifact_type}
              format={a.format}
              content={a.content}
              projectId={a.project_id}
              createdAt={a.created_at}
              version={a.version}
            />
          ))}
        </div>
      )}
    </div>
  )
}
