export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { timeAgo } from '@/lib/utils'
import type { Project } from '@/types'

interface Props {
  searchParams: { q?: string; status?: string }
}

const STATUS_OPTIONS = ['draft', 'planning', 'building', 'active', 'paused', 'done', 'archived']

export default async function ProjectsPage({ searchParams }: Props) {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')

  const q = searchParams.q?.trim() ?? ''
  const statusFilter = searchParams.status ?? ''

  const supabase = createServiceClient()
  let query = supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('updated_at', { ascending: false })

  if (q) {
    query = query.or(`name.ilike.%${q}%,summary.ilike.%${q}%,goal.ilike.%${q}%`)
  }
  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data: projects, error } = await query

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Track all active projects and plans"
        action={
          <div className="flex items-center gap-2">
            <SearchInput placeholder="Search projects…" />
            <Link href="/dashboard/projects/new" className="btn-primary">+ New Project</Link>
          </div>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 mb-4">
          {error.message}
        </div>
      )}

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <StatusPill label="All" value="" current={statusFilter} />
        {STATUS_OPTIONS.map((s) => (
          <StatusPill key={s} label={s} value={s} current={statusFilter} />
        ))}
      </div>

      {(q || statusFilter) && (
        <p className="text-sm text-gray-500 mb-4">
          {projects?.length ?? 0} project{projects?.length !== 1 ? 's' : ''}
          {q && ` matching "${q}"`}
          {statusFilter && ` with status "${statusFilter}"`}
        </p>
      )}

      {!projects || projects.length === 0 ? (
        <EmptyState
          title={q || statusFilter ? 'No projects match your filter' : 'No projects yet'}
          description={
            q || statusFilter
              ? 'Try a different search or clear the filters.'
              : 'Create a project manually or convert an idea into a project.'
          }
          action={
            q || statusFilter ? undefined : (
              <Link href="/dashboard/projects/new" className="btn-primary">New Project</Link>
            )
          }
        />
      ) : (
        <div className="grid gap-3">
          {(projects as Project[]).map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="card p-4 flex items-start justify-between hover:shadow-md transition-shadow"
            >
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

function StatusPill({ label, value, current }: { label: string; value: string; current: string }) {
  const isActive = value === current
  return (
    <Link
      href={value ? `?status=${value}` : '?'}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        isActive
          ? 'bg-gray-900 text-white border-gray-900'
          : 'text-gray-600 border-gray-200 hover:border-gray-400'
      }`}
    >
      {label}
    </Link>
  )
}
