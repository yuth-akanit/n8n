'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { CopyButton } from '@/components/ui/CopyButton'
import { EmptyState } from '@/components/ui/EmptyState'
import type { BuilderMode } from '@/types'

const MODES: { value: BuilderMode; label: string; description: string }[] = [
  { value: 'spec', label: 'Spec', description: 'Technical specification document' },
  { value: 'sql', label: 'SQL Schema', description: 'Database schema and migrations' },
  { value: 'api', label: 'API Contract', description: 'REST API endpoint definitions' },
  { value: 'ui', label: 'UI Plan', description: 'Screen layout and component plan' },
  { value: 'code_patch', label: 'Code', description: 'Code scaffolding and patches' },
]

interface ArtifactPreview {
  id: string
  title: string
  artifact_type: string
  created_at: string
  content: string
}

export function BuilderClient({ workspaceId }: { workspaceId: string }) {
  const [mode, setMode] = useState<BuilderMode>('code_patch')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ content: string; title: string; artifactId: string } | null>(null)
  const [recentArtifacts, setRecentArtifacts] = useState<ArtifactPreview[]>([])

  useEffect(() => {
    fetch('/api/artifacts?limit=5')
      .then(r => r.json())
      .then(data => setRecentArtifacts(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [result])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const res = await fetch('/api/ai/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          mode,
          prompt,
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

  return (
    <div>
      <PageHeader
        title="Builder Studio"
        description="Generate technical artifacts from prompts — spec, SQL, API, UI, code"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mode selector */}
          <div className="card p-4">
            <label className="label mb-3">Output Mode</label>
            <div className="grid grid-cols-5 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={`p-2 rounded-lg border text-center text-xs font-medium transition-colors ${
                    mode === m.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {MODES.find(m => m.value === mode)?.description}
            </p>
          </div>

          <form onSubmit={handleGenerate} className="card p-4 space-y-3">
            <div>
              <label className="label">What do you want to build?</label>
              <textarea
                className="input"
                rows={5}
                placeholder={
                  mode === 'sql' ? 'Describe the data model you need...' :
                  mode === 'api' ? 'Describe the API endpoints you need...' :
                  mode === 'spec' ? 'Describe the feature or system to spec out...' :
                  mode === 'ui' ? 'Describe the screen or UI component...' :
                  'Describe what code you need to generate...'
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <button type="submit" className="btn-primary" disabled={loading || !prompt.trim()}>
              {loading ? 'Generating…' : `Generate ${MODES.find(m => m.value === mode)?.label}`}
            </button>
          </form>

          {loading && (
            <div className="card p-8 text-center">
              <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">Generating your artifact…</p>
            </div>
          )}

          {result && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{result.title}</h3>
                <CopyButton text={result.content} />
              </div>
              <pre className="bg-gray-950 text-gray-100 rounded-lg p-4 text-sm overflow-auto max-h-[32rem] whitespace-pre-wrap font-mono">
                {result.content}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar: recent artifacts */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Artifacts</h3>
            {recentArtifacts.length === 0 ? (
              <EmptyState title="No artifacts yet" />
            ) : (
              <ul className="space-y-2">
                {recentArtifacts.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/dashboard/builder/${a.id}`}
                      className="block p-2 rounded hover:bg-gray-50"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                      <Badge label={a.artifact_type} className="mt-1" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
