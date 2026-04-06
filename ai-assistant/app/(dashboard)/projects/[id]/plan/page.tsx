'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import type { GeneratedMilestone } from '@/types'

interface Props {
  params: { id: string }
}

export default function ProjectPlanPage({ params }: Props) {
  const router = useRouter()
  const [goal, setGoal] = useState('')
  const [scope, setScope] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    summary: string
    milestones: GeneratedMilestone[]
    artifactId: string
  } | null>(null)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const res = await fetch('/api/ai/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          projectId: params.id,
          goal,
          scope,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePlan() {
    if (!result) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/projects/${params.id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestones: result.milestones,
          summary: result.summary,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      router.push(`/dashboard/projects/${params.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Project Planner"
        description="Generate a project plan with milestones and tasks"
        action={<Link href={`/dashboard/projects/${params.id}`} className="btn-secondary">← Project</Link>}
      />

      <form onSubmit={handleGenerate} className="card p-5 mb-6 space-y-4">
        <div>
          <label className="label">Project Goal</label>
          <textarea
            className="input"
            rows={2}
            placeholder="What does this project need to accomplish?"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Scope / Constraints (optional)</label>
          <input
            className="input"
            placeholder="e.g. 4-week timeline, 2 developers, must integrate with Supabase"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Generating plan…' : 'Generate Plan'}
        </button>
      </form>

      {loading && (
        <div className="card p-8 text-center">
          <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">Building your project plan…</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.summary && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Plan Summary</h3>
              <p className="text-sm text-gray-900">{result.summary}</p>
            </div>
          )}

          {result.milestones.map((m, mi) => (
            <div key={mi} className="card p-4">
              <h3 className="font-semibold text-gray-900 mb-2">
                Milestone {m.sort_order}: {m.title}
              </h3>
              {m.description && <p className="text-sm text-gray-500 mb-3">{m.description}</p>}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-1 font-medium">Task</th>
                    <th className="text-left pb-1 font-medium">Type</th>
                    <th className="text-left pb-1 font-medium">Priority</th>
                    <th className="text-right pb-1 font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {m.tasks.map((t, ti) => (
                    <tr key={ti} className="border-b border-gray-50">
                      <td className="py-1.5 pr-2 text-gray-900">{t.title}</td>
                      <td className="py-1.5 pr-2 text-gray-500">{t.task_type}</td>
                      <td className="py-1.5 pr-2 text-gray-500">{t.priority}</td>
                      <td className="py-1.5 text-right text-gray-500">{t.estimate_hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="flex gap-3">
            <button
              onClick={handleSavePlan}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving…' : 'Save Plan to Project'}
            </button>
            <button
              onClick={() => setResult(null)}
              className="btn-secondary"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
