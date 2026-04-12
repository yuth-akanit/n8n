'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Milestone, Task, TaskType, Priority, MilestoneStatus } from '@/types'

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

interface Props {
  projectId: string
  milestones: Milestone[]
  tasks: Task[]
}

const TASK_TYPES: TaskType[] = ['research', 'planning', 'backend', 'frontend', 'seo', 'content', 'qa', 'deploy']
const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical']
const MILESTONE_STATUSES: MilestoneStatus[] = ['todo', 'in_progress', 'blocked', 'done']
const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'review', 'done'] as const

// ────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────

export function TaskManagerClient({ projectId, milestones, tasks }: Props) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [addTaskFor, setAddTaskFor] = useState<string | null>(null) // milestoneId

  const tasksByMilestone = milestones.reduce<Record<string, Task[]>>((acc, m) => {
    acc[m.id] = tasks.filter((t) => t.milestone_id === m.id)
    return acc
  }, {})
  const unassigned = tasks.filter((t) => !t.milestone_id)

  async function api<T>(path: string, method: string, body?: unknown): Promise<T> {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? `${method} ${path} failed`)
    return data as T
  }

  async function withRefresh(fn: () => Promise<void>) {
    setError('')
    try {
      await fn()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  // ── Milestone actions ──

  async function createMilestone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await withRefresh(async () => {
      await api(`/api/projects/${projectId}/milestones`, 'POST', {
        title: fd.get('title'),
        description: fd.get('description') || undefined,
        sort_order: milestones.length,
      })
      setShowAddMilestone(false)
    })
  }

  async function updateMilestoneStatus(milestoneId: string, status: MilestoneStatus) {
    await withRefresh(() => api(`/api/milestones/${milestoneId}`, 'PATCH', { status }))
  }

  async function deleteMilestone(milestoneId: string) {
    if (!confirm('Delete this milestone and all its tasks?')) return
    await withRefresh(() => api(`/api/milestones/${milestoneId}`, 'DELETE'))
  }

  // ── Task actions ──

  async function createTask(e: React.FormEvent<HTMLFormElement>, milestoneId: string | null) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await withRefresh(async () => {
      await api(`/api/projects/${projectId}/tasks`, 'POST', {
        title: fd.get('title'),
        task_type: fd.get('task_type'),
        priority: fd.get('priority'),
        milestone_id: milestoneId ?? undefined,
        estimate_hours: fd.get('estimate_hours') ? Number(fd.get('estimate_hours')) : undefined,
      })
      setAddTaskFor(null)
    })
  }

  async function updateTaskStatus(taskId: string, status: string) {
    await withRefresh(() => api(`/api/tasks/${taskId}`, 'PATCH', { status }))
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return
    await withRefresh(() => api(`/api/tasks/${taskId}`, 'DELETE'))
  }

  // ────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-2">
          {error}
        </div>
      )}

      {/* Milestones */}
      {milestones.map((m) => (
        <div key={m.id} className="card p-4">
          {/* Milestone header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-sm">{m.title}</h3>
              {m.description && <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={m.status}
                onChange={(e) => updateMilestoneStatus(m.id, e.target.value as MilestoneStatus)}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
              >
                {MILESTONE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <button
                onClick={() => deleteMilestone(m.id)}
                className="text-red-400 hover:text-red-600 text-xs"
                title="Delete milestone"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tasks */}
          <div className="space-y-1 mb-3">
            {(tasksByMilestone[m.id] ?? []).map((t) => (
              <TaskRow key={t.id} task={t} onStatusChange={updateTaskStatus} onDelete={deleteTask} />
            ))}
            {(tasksByMilestone[m.id] ?? []).length === 0 && (
              <p className="text-xs text-gray-400">No tasks yet</p>
            )}
          </div>

          {/* Add task form */}
          {addTaskFor === m.id ? (
            <AddTaskForm
              milestoneId={m.id}
              onSubmit={(e) => createTask(e, m.id)}
              onCancel={() => setAddTaskFor(null)}
            />
          ) : (
            <button
              onClick={() => setAddTaskFor(m.id)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              + Add task
            </button>
          )}
        </div>
      ))}

      {/* Unassigned tasks */}
      {unassigned.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">Unassigned Tasks</h3>
          <div className="space-y-1">
            {unassigned.map((t) => (
              <TaskRow key={t.id} task={t} onStatusChange={updateTaskStatus} onDelete={deleteTask} />
            ))}
          </div>
        </div>
      )}

      {/* Add Milestone */}
      {showAddMilestone ? (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">New Milestone</h3>
          <form onSubmit={createMilestone} className="space-y-3">
            <input name="title" required placeholder="Milestone title" className="input w-full" />
            <input name="description" placeholder="Description (optional)" className="input w-full" />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Create</button>
              <button type="button" onClick={() => setShowAddMilestone(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <button onClick={() => setShowAddMilestone(true)} className="btn-secondary w-full">
          + Add Milestone
        </button>
      )}
    </div>
  )
}

// ────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────

function TaskRow({
  task,
  onStatusChange,
  onDelete,
}: {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  const statusColors: Record<string, string> = {
    done: 'bg-green-500',
    in_progress: 'bg-blue-500',
    blocked: 'bg-red-500',
    review: 'bg-yellow-500',
    todo: 'bg-gray-300',
  }

  return (
    <div className="flex items-center gap-2 text-sm py-1 group">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[task.status] ?? 'bg-gray-300'}`} />
      <span className={`flex-1 min-w-0 truncate ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {task.title}
      </span>
      <select
        value={task.status}
        onChange={(e) => onStatusChange(task.id, e.target.value)}
        className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
      <button
        onClick={() => onDelete(task.id)}
        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs flex-shrink-0"
        title="Delete task"
      >
        ✕
      </button>
    </div>
  )
}

function AddTaskForm({
  milestoneId,
  onSubmit,
  onCancel,
}: {
  milestoneId: string | null
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit} className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2 border border-gray-200">
      <input name="title" required placeholder="Task title" className="input w-full text-sm" />
      <div className="flex gap-2">
        <select name="task_type" required defaultValue="backend" className="input flex-1 text-sm">
          {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select name="priority" defaultValue="medium" className="input flex-1 text-sm">
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input name="estimate_hours" type="number" min="0.5" step="0.5" placeholder="hrs"
          className="input w-20 text-sm" />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-sm">Add</button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
      </div>
    </form>
  )
}
