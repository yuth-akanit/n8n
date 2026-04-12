'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { timeAgo } from '@/lib/utils'

interface SeoAuditRow {
  id: string
  target_url: string
  status: string
  score_overall: number | null
  created_at: string
  seo_sites: { name: string } | null
}

export function SeoClient({ workspaceId }: { workspaceId: string }) {
  const [url, setUrl] = useState('')
  const [siteName, setSiteName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [audits, setAudits] = useState<SeoAuditRow[]>([])
  const [loadingAudits, setLoadingAudits] = useState(true)
  const [auditsError, setAuditsError] = useState('')

  useEffect(() => {
    loadAudits()
  }, [])

  async function loadAudits() {
    setAuditsError('')
    try {
      const res = await fetch('/api/seo/audits')
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setAudits(Array.isArray(data) ? data : [])
    } catch (err) {
      setAuditsError(err instanceof Error ? err.message : 'โหลดรายการ audit ไม่ได้')
    } finally {
      setLoadingAudits(false)
    }
  }

  async function handleAudit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/seo-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: url,
          siteName: siteName || new URL(url).hostname,
          workspaceId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Audit failed')
      await loadAudits()
      setUrl('')
      setSiteName('')
      // Navigate to audit detail
      window.location.href = `/dashboard/seo/audits/${data.auditId}`
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Audit failed')
    } finally {
      setLoading(false)
    }
  }

  function scoreColor(score: number | null) {
    if (score === null) return 'text-gray-400'
    if (score >= 80) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div>
      <PageHeader
        title="SEO Doctor"
        description="Audit pages, detect issues, and propose fixes — requires human review before applying"
      />

      {/* New audit form */}
      <form onSubmit={handleAudit} className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Run New Audit</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Target URL</label>
            <input
              type="url"
              className="input"
              placeholder="https://example.com/page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Site Name (optional)</label>
            <input
              className="input"
              placeholder="My Website"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 mt-2 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        <button type="submit" className="btn-primary mt-3" disabled={loading || !url.trim()}>
          {loading ? 'Running audit…' : 'Run SEO Audit'}
        </button>
      </form>

      {/* Past audits */}
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Past Audits</h2>

      {loadingAudits ? (
        <div className="card p-8 text-center">
          <div className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : auditsError ? (
        <div className="card p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-600">{auditsError}</p>
          <button onClick={loadAudits} className="text-xs text-blue-600 hover:underline flex-shrink-0">ลองใหม่</button>
        </div>
      ) : audits.length === 0 ? (
        <EmptyState title="No audits yet" description="Enter a URL above to run your first SEO audit." />
      ) : (
        <div className="space-y-2">
          {audits.map((audit) => (
            <Link
              key={audit.id}
              href={`/dashboard/seo/audits/${audit.id}`}
              className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{audit.target_url}</p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(audit.created_at)}</p>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                {audit.score_overall !== null && (
                  <span className={`text-lg font-bold ${scoreColor(audit.score_overall)}`}>
                    {audit.score_overall}
                  </span>
                )}
                <Badge label={audit.status} status={audit.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
