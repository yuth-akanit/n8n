'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import type { ProjectType, Priority } from '@/types'

export default function NewProjectPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    project_type: 'app' as ProjectType,
    goal: '',
    summary: '',
    priority: 'medium' as Priority,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          ...form,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create project')
      router.push(`/dashboard/projects/${data.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="New Project"
        action={<Link href="/dashboard/projects" className="btn-secondary">← Back</Link>}
      />

      <div className="max-w-lg">
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <div>
            <label className="label">Project Name</label>
            <input name="name" className="input" value={form.name} onChange={handleChange} required placeholder="e.g. Customer Portal v2" />
          </div>
          <div>
            <label className="label">Type</label>
            <select name="project_type" className="input" value={form.project_type} onChange={handleChange}>
              {(['app','automation','seo','content','internal_tool','idea'] as ProjectType[]).map((t) => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Goal</label>
            <textarea name="goal" className="input" rows={2} value={form.goal} onChange={handleChange} placeholder="What does this project aim to achieve?" />
          </div>
          <div>
            <label className="label">Summary (optional)</label>
            <textarea name="summary" className="input" rows={2} value={form.summary} onChange={handleChange} placeholder="Brief description..." />
          </div>
          <div>
            <label className="label">Priority</label>
            <select name="priority" className="input" value={form.priority} onChange={handleChange}>
              {(['low','medium','high','critical'] as Priority[]).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  )
}
