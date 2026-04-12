export const dynamic = 'force-dynamic'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { TaskManagerClient } from '@/components/projects/TaskManagerClient'
import type { Project, Milestone, Task } from '@/types'

interface Props {
  params: { id: string }
}

export default async function ProjectPage({ params }: Props) {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  const supabase = createServiceClient()

  const [
    { data: project, error },
    { data: milestones },
    { data: tasks },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', params.id).eq('workspace_id', ctx.workspaceId).single(),
    supabase.from('milestones').select('*').eq('project_id', params.id).order('sort_order'),
    supabase.from('tasks').select('*').eq('project_id', params.id).order('created_at'),
  ])

  if (error || !project) notFound()

  const p = project as Project
  const ms = (milestones ?? []) as Milestone[]
  const ts = (tasks ?? []) as Task[]

  return (
    <div>
      <PageHeader
        title={p.name}
        description={p.summary ?? undefined}
        action={
          <div className="flex gap-2">
            <Link href="/dashboard/projects" className="btn-secondary">← Projects</Link>
            <Link href={`/dashboard/projects/${p.id}/plan`} className="btn-secondary">AI Plan</Link>
            <Link href={`/dashboard/projects/${p.id}/docs`} className="btn-secondary">Docs</Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Goal */}
          {p.goal && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Goal</h3>
              <p className="text-sm text-gray-900">{p.goal}</p>
            </div>
          )}

          {/* Milestones & Tasks — editable */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Milestones & Tasks</h3>
            {ms.length === 0 && ts.length === 0 ? (
              <div className="card p-6 text-center mb-4">
                <p className="text-sm text-gray-500 mb-3">No milestones yet.</p>
                <Link href={`/dashboard/projects/${p.id}/plan`} className="btn-primary">
                  Generate Plan with AI
                </Link>
              </div>
            ) : null}
            <TaskManagerClient
              projectId={p.id}
              milestones={ms}
              tasks={ts}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Project Info</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd><Badge label={p.status} status={p.status} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Priority</dt>
                <dd><Badge label={p.priority} status={p.priority} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Type</dt>
                <dd className="text-gray-900">{p.project_type.replace('_', ' ')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">{formatDate(p.created_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Task Summary</h3>
            <TaskSummary tasks={ts} />
          </div>

          <div className="space-y-2">
            <Link href={`/dashboard/projects/${p.id}/plan`} className="btn-secondary w-full text-center">
              AI Planner
            </Link>
            <Link href={`/dashboard/projects/${p.id}/docs`} className="btn-secondary w-full text-center">
              View Docs
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskSummary({ tasks }: { tasks: Task[] }) {
  const counts = {
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
  }
  if (tasks.length === 0) return <p className="text-xs text-gray-400">No tasks yet</p>
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs">
      {Object.entries(counts).map(([k, v]) => (
        <div key={k} className="flex justify-between">
          <dt className="text-gray-500 capitalize">{k.replace('_', ' ')}</dt>
          <dd className="font-medium text-gray-900">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
