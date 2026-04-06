'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import type { GeneratedIdea } from '@/types'

export default function NewIdeaPage() {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [constraints, setConstraints] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ideas, setIdeas] = useState<GeneratedIdea[]>([])
  const [artifactId, setArtifactId] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIdeas([])
    setLoading(true)

    try {
      const res = await fetch('/api/ai/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          prompt,
          constraints,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setIdeas(data.ideas)
      setArtifactId(data.artifactId)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function saveIdea(idea: GeneratedIdea) {
    setSaving(idea.title)
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          ...idea,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      router.push(`/dashboard/ideas/${data.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save idea')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Generate Ideas"
        description="Enter a brief and AI will generate practical ideas"
        action={<Link href="/dashboard/ideas" className="btn-secondary">← Back</Link>}
      />

      <form onSubmit={handleGenerate} className="card p-5 mb-6 space-y-4">
        <div>
          <label className="label">What do you need ideas for?</label>
          <textarea
            className="input"
            rows={3}
            placeholder="e.g. We need a way to improve customer retention after service visits..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Constraints (optional)</label>
          <input
            className="input"
            placeholder="e.g. Low cost, must work with existing tools, no new software"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
        )}
        <button type="submit" className="btn-primary" disabled={loading || !prompt.trim()}>
          {loading ? 'Generating…' : 'Generate Ideas'}
        </button>
      </form>

      {loading && (
        <div className="card p-8 text-center">
          <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">AI is thinking…</p>
        </div>
      )}

      {ideas.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Generated Ideas</h2>
          <div className="space-y-4">
            {ideas.map((idea, i) => (
              <div key={i} className="card p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="font-semibold text-gray-900">{idea.title}</h3>
                  <div className="flex gap-3 flex-shrink-0">
                    <ScorePill label="Impact" value={idea.score_impact} />
                    <ScorePill label="Ease" value={idea.score_ease} />
                    <ScorePill label="ROI" value={idea.score_roi} />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">{idea.brief}</p>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div>
                    <span className="font-medium text-gray-700">Audience: </span>
                    <span className="text-gray-600">{idea.audience}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Problem: </span>
                    <span className="text-gray-600">{idea.problem}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-700">Solution: </span>
                    <span className="text-gray-600">{idea.solution}</span>
                  </div>
                </div>
                {idea.channel && idea.channel.length > 0 && (
                  <div className="flex gap-2 mb-3">
                    {idea.channel.map((c) => (
                      <Badge key={c} label={c} />
                    ))}
                  </div>
                )}
                <button
                  onClick={() => saveIdea(idea)}
                  disabled={saving === idea.title}
                  className="btn-primary text-xs py-1.5"
                >
                  {saving === idea.title ? 'Saving…' : 'Save this idea'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ScorePill({ label, value }: { label: string; value: number }) {
  const color = value >= 8 ? 'text-green-700' : value >= 5 ? 'text-yellow-700' : 'text-red-600'
  return (
    <div className="text-center">
      <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
