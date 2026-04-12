export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { TasksListClient } from '@/components/tasks/TasksListClient'

const STATUSES = ['todo', 'in_progress', 'blocked', 'review', 'done'] as const
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const

export type TaskWithProject = {
  id: string
  title: string
  status: string
  priority: string
  task_type: string
  estimate_hours: number | null
  created_at: string
  project_id: string
  projects: { id: string; name: string }
}

interface Props {
  searchParams: { status?: string; priority?: string }
}

export default async function TasksPage({ searchParams }: Props) {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')

  const { workspaceId } = ctx
  const supabase = createServiceClient()

  const { data: raw, error } = await supabase
    .from('tasks')
    .select('id, title, status, priority, task_type, estimate_hours, created_at, project_id, projects!inner(id, name, workspace_id)')
    .eq('projects.workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(300)

  const allTasks = (raw ?? []) as unknown as TaskWithProject[]

  const statusFilter = searchParams.status ?? 'all'
  const priorityFilter = searchParams.priority ?? 'all'

  const filtered = allTasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  const countByStatus = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = allTasks.filter((t) => t.status === s).length
    return acc
  }, {})

  function tabHref(status: string) {
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    if (priorityFilter !== 'all') params.set('priority', priorityFilter)
    const q = params.toString()
    return `/dashboard/tasks${q ? `?${q}` : ''}`
  }

  function priorityHref(priority: string) {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (priority !== 'all') params.set('priority', priority)
    const q = params.toString()
    return `/dashboard/tasks${q ? `?${q}` : ''}`
  }

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="All tasks across projects"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 mb-4">
          {error.message}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Link
          href={tabHref('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            statusFilter === 'all'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          All ({allTasks.length})
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={tabHref(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              statusFilter === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {s.replace('_', ' ')} ({countByStatus[s] ?? 0})
          </Link>
        ))}
      </div>

      {/* Priority filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        <span className="text-xs text-gray-400 self-center">Priority:</span>
        <Link
          href={priorityHref('all')}
          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
            priorityFilter === 'all'
              ? 'bg-gray-700 text-white border-gray-700'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}
        >
          All
        </Link>
        {PRIORITIES.map((p) => (
          <Link
            key={p}
            href={priorityHref(p)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              priorityFilter === p
                ? 'bg-gray-700 text-white border-gray-700'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {p}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">No tasks found</p>
      ) : (
        <TasksListClient tasks={filtered} />
      )}
    </div>
  )
}
