export const dynamic = 'force-dynamic'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { CopyButton } from '@/components/ui/CopyButton'
import { ExportButton } from '@/components/artifacts/ExportButton'
import { VersionHistory } from '@/components/artifacts/VersionHistory'
import { formatDate } from '@/lib/utils'
import type { Artifact } from '@/types'

interface Props {
  params: { id: string }
}

export default async function ArtifactDetailPage({ params }: Props) {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  const supabase = createServiceClient()
  const { data: artifact, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .single()

  if (error || !artifact) notFound()

  const a = artifact as Artifact

  return (
    <div>
      <PageHeader
        title={a.title}
        description={`${a.artifact_type} · v${a.version} · ${formatDate(a.created_at)}`}
        action={
          <div className="flex gap-2 flex-wrap">
            <Link href="/dashboard/builder" className="btn-secondary">← Builder</Link>
            <CopyButton text={a.content} />
            <ExportButton content={a.content} title={a.title} format={a.format} />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content */}
        <div className="lg:col-span-3">
          <div className="card p-2">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
              <Badge label={a.artifact_type} />
              <Badge label={a.format} />
              <span className="text-xs text-gray-400 ml-auto">
                v{a.version}{a.is_latest ? ' (latest)' : ''}
              </span>
            </div>
            <pre className="p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono overflow-auto max-h-[70vh]">
              {a.content}
            </pre>
          </div>
        </div>

        {/* Sidebar — version history */}
        <div className="space-y-4">
          <VersionHistory artifactId={a.id} currentVersion={a.version} />
        </div>
      </div>
    </div>
  )
}
