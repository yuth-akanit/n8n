'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { timeAgo } from '@/lib/utils'
import type { TaskWithProject } from '@/app/dashboard/tasks/page'

const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'review', 'done'] as const

const statusDot: Record<string, string> = {
  done: 'bg-green-500',
  in_progress: 'bg-blue-500',
  blocked: 'bg-red-500',
  review: 'bg-yellow-500',
  todo: 'bg-gray-300',
}

export function TasksListClient({ tasks }: { tasks: TaskWithProject[] }) {
  const router = useRouter()
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function changeStatus(taskId: string, status: string) {
    setUpdating(taskId)
    setError('')
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Update failed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-1">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2 mb-2">
          {error}
        </div>
      )}

      <div className="card divide-y divide-gray-50">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group"
          >
            {/* Status dot */}
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot[task.status] ?? 'bg-gray-300'} ${updating === task.id ? 'animate-pulse' : ''}`}
            />

            {/* Title */}
            <span
              className={`flex-1 min-w-0 text-sm truncate ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}
            >
              {task.title}
            </span>

            {/* Project link */}
            <Link
              href={`/dashboard/projects/${task.projects.id}`}
              className="text-xs text-blue-600 hover:underline flex-shrink-0 hidden sm:block max-w-[120px] truncate"
              title={task.projects.name}
            >
              {task.projects.name}
            </Link>

            {/* Task type */}
            <span className="text-xs text-gray-400 flex-shrink-0 hidden md:block w-16 truncate">
              {task.task_type}
            </span>

            {/* Priority */}
            <div className="flex-shrink-0 hidden sm:block">
              <Badge label={task.priority} status={task.priority} />
            </div>

            {/* Hours */}
            {task.estimate_hours !== null ? (
              <span className="text-xs text-gray-400 flex-shrink-0 w-10 text-right hidden md:block">
                {task.estimate_hours}h
              </span>
            ) : (
              <span className="w-10 hidden md:block" />
            )}

            {/* Status select — visible on hover */}
            <select
              value={task.status}
              onChange={(e) => changeStatus(task.id, e.target.value)}
              disabled={updating === task.id}
              className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>

            {/* Age */}
            <span className="text-xs text-gray-400 flex-shrink-0 w-14 text-right hidden lg:block">
              {timeAgo(task.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
