export const dynamic = 'force-dynamic'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { CopyButton } from '@/components/ui/CopyButton'
import { formatDate } from '@/lib/utils'
import type { ProjectDoc } from '@/types'

interface Props {
  params: { id: string }
}

export default async function ProjectDocsPage({ params }: Props) {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  const supabase = createServiceClient()

  const [{ data: project }, { data: docs }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', params.id).eq('workspace_id', ctx.workspaceId).single(),
    supabase.from('project_docs').select('*').eq('project_id', params.id).order('created_at'),
  ])

  if (!project) notFound()

  return (
    <div>
      <PageHeader
        title={`${project.name} — Docs`}
        action={<Link href={`/dashboard/projects/${params.id}`} className="btn-secondary">← Project</Link>}
      />

      {!docs || docs.length === 0 ? (
        <EmptyState
          title="No docs yet"
          description="Docs are auto-generated when you run the AI planner."
          action={<Link href={`/dashboard/projects/${params.id}/plan`} className="btn-primary">Run AI Planner</Link>}
        />
      ) : (
        <div className="space-y-6">
          {(docs as ProjectDoc[]).map((doc) => (
            <div key={doc.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-gray-900">{doc.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge label={doc.doc_type} />
                    <span className="text-xs text-gray-400">v{doc.version} · {formatDate(doc.created_at)}</span>
                  </div>
                </div>
                <CopyButton text={doc.content_md} />
              </div>
              <pre className="bg-gray-50 border border-gray-200 rounded p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono overflow-auto max-h-96">
                {doc.content_md}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
