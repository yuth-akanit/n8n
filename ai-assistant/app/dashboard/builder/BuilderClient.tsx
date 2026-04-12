'use client'

import { useState, useEffect, useCallback } from 'react'
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

interface ClarificationOption {
  label: string
  mode: BuilderMode
  prompt: string
}

interface ClarificationResult {
  type: 'clarification'
  intent: string
  message: string
  options: ClarificationOption[]
}

interface ArtifactResult {
  type: 'artifact'
  content: string
  title: string
  artifactId: string
  sessionId: string
}

export function BuilderClient({ workspaceId }: { workspaceId: string }) {
  const [mode, setMode] = useState<BuilderMode>('code_patch')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [artifact, setArtifact] = useState<ArtifactResult | null>(null)
  const [clarification, setClarification] = useState<ClarificationResult | null>(null)
  const [recentArtifacts, setRecentArtifacts] = useState<ArtifactPreview[]>([])
  const [artifactsError, setArtifactsError] = useState('')

  useEffect(() => {
    setArtifactsError('')
    fetch('/api/artifacts?limit=5')
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then(data => setRecentArtifacts(Array.isArray(data) ? data : []))
      .catch((err: unknown) => setArtifactsError(err instanceof Error ? err.message : 'โหลดไม่ได้'))
  }, [artifact])

  const callBuilder = useCallback(async (targetMode: BuilderMode, targetPrompt: string) => {
    setError('')
    setArtifact(null)
    setClarification(null)
    setLoading(true)

    try {
      const res = await fetch('/api/ai/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, mode: targetMode, prompt: targetPrompt }),
      })
      const data = await res.json() as ClarificationResult | ArtifactResult | { error?: string }

      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? 'Generation failed')
      }

      if ((data as ClarificationResult).type === 'clarification') {
        setClarification(data as ClarificationResult)
      } else {
        setArtifact(data as ArtifactResult)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    await callBuilder(mode, prompt)
  }

  async function handleOptionSelect(option: ClarificationOption) {
    setMode(option.mode)
    setPrompt(option.prompt)
    await callBuilder(option.mode, option.prompt)
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
              {loading ? 'Analysing…' : `Generate ${MODES.find(m => m.value === mode)?.label}`}
            </button>
          </form>

          {loading && (
            <div className="card p-8 text-center">
              <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">Analysing your request…</p>
            </div>
          )}

          {/* ── Clarification / Intent Gate ─────────────────────────────────── */}
          {clarification && !loading && (
            <div className="card p-5 border-amber-200 bg-amber-50">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-amber-500 text-lg leading-none mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-1">
                    คำขอนี้ยังไม่ระบุ artifact ที่ชัดเจน
                  </p>
                  <p className="text-xs text-amber-700">
                    {clarification.message || 'โปรดเลือกประเภท artifact ที่ต้องการสร้าง หรือคลิกเพื่อสร้างทันที'}
                  </p>
                </div>
              </div>

              <p className="text-xs font-medium text-gray-600 mb-3">แนะนำ artifacts ที่เหมาะสม:</p>
              <div className="space-y-2">
                {clarification.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleOptionSelect(opt)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                          {opt.label}
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{opt.prompt}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        {MODES.find(m => m.value === opt.mode)?.label ?? opt.mode}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-amber-100">
                <p className="text-xs text-amber-600">
                  หากต้องการ brainstorm ก่อน ให้ไปที่{' '}
                  <a href="/dashboard/ideas" className="underline font-medium">Idea Lab</a>
                </p>
              </div>
            </div>
          )}

          {/* ── Artifact result ──────────────────────────────────────────────── */}
          {artifact && !loading && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{artifact.title}</h3>
                <CopyButton text={artifact.content} />
              </div>
              <pre className="bg-gray-950 text-gray-100 rounded-lg p-4 text-sm overflow-auto max-h-[32rem] whitespace-pre-wrap font-mono">
                {artifact.content}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar: recent artifacts */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Artifacts</h3>
            {artifactsError ? (
              <p className="text-xs text-red-500">{artifactsError}</p>
            ) : recentArtifacts.length === 0 ? (
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

          {/* Intent guide */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Mode Guide</h3>
            <div className="space-y-1.5 text-xs text-gray-500">
              {[
                { input: 'ออกแบบ flow รับ lead', mode: 'Spec' },
                { input: 'เขียน schema เก็บ lead', mode: 'SQL' },
                { input: 'ออกแบบ API รับ booking', mode: 'API' },
                { input: 'ออกแบบหน้า landing page', mode: 'UI' },
                { input: 'เขียน Next.js page', mode: 'Code' },
              ].map((row) => (
                <div key={row.input} className="flex items-center justify-between gap-2">
                  <span className="truncate">{row.input}</span>
                  <span className="flex-shrink-0 font-medium text-blue-600">{row.mode}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100">
                <span className="text-amber-600">ช่วยเพิ่มยอดขาย →</span>
                <span className="text-gray-400"> Idea Lab</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

