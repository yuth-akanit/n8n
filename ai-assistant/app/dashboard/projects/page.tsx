export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { timeAgo } from '@/lib/utils'
import type { Project } from '@/types'

export default async function ProjectsPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')

  const supabase = createServiceClient()
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('updated_at', { ascending: false })

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Track all active projects and plans"
        action={<Link href="/dashboard/projects/new" className="btn-primary">+ New Project</Link>}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 mb-4">
          {error.message}
        </div>
      )}

      {!projects || projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project manually or convert an idea into a project."
          action={<Link href="/dashboard/projects/new" className="btn-primary">New Project</Link>}
        />
      ) : (
        <div className="grid gap-3">
          {(projects as Project[]).map((p) => (
            <Link key={p.id} href={`/dashboard/projects/${p.id}`}
              className="card p-4 flex items-start justify-between hover:shadow-md transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-semibold text-gray-900">{p.name}</h2>
                  <Badge label={p.project_type.replace('_', ' ')} />
                </div>
                {p.summary && <p className="text-sm text-gray-500 truncate">{p.summary}</p>}
                <p className="text-xs text-gray-400 mt-1">{timeAgo(p.updated_at)}</p>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <Badge label={p.priority} status={p.priority} />
                <Badge label={p.status} status={p.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
