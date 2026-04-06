import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { SeoAudit, SeoAuditPage, SeoIssue, SeoPatch } from '@/types'
import { GeneratePatchesButton } from './GeneratePatchesButton'

interface Props {
  params: { id: string }
}

export default async function SeoAuditDetailPage({ params }: Props) {
  const supabase = createClient()

  const [
    { data: audit, error },
    { data: pages },
    { data: issues },
    { data: patches },
  ] = await Promise.all([
    supabase.from('seo_audits').select('*').eq('id', params.id).single(),
    supabase.from('seo_audit_pages').select('*').eq('audit_id', params.id).limit(5),
    supabase.from('seo_issues').select('*').eq('audit_id', params.id).order('severity'),
    supabase.from('seo_patches').select('*').eq('audit_id', params.id).order('created_at', { ascending: false }),
  ])

  if (error || !audit) notFound()

  const a = audit as SeoAudit
  const page = (pages ?? [])[0] as SeoAuditPage | undefined
  const issueList = (issues ?? []) as SeoIssue[]
  const patchList = (patches ?? []) as SeoPatch[]

  function scoreColor(score: number | null) {
    if (score === null) return 'text-gray-400'
    if (score >= 80) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const issuesBySeverity = ['critical', 'high', 'medium', 'low'] as const
  const issueCounts = {
    critical: issueList.filter(i => i.severity === 'critical').length,
    high: issueList.filter(i => i.severity === 'high').length,
    medium: issueList.filter(i => i.severity === 'medium').length,
    low: issueList.filter(i => i.severity === 'low').length,
  }

  return (
    <div>
      <PageHeader
        title="SEO Audit"
        description={a.target_url}
        action={
          <div className="flex gap-2">
            <Link href="/dashboard/seo" className="btn-secondary">← SEO Doctor</Link>
            {issueList.length > 0 && patchList.length === 0 && (
              <GeneratePatchesButton auditId={a.id} />
            )}
          </div>
        }
      />

      {/* Score & metadata */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className={`text-3xl font-bold ${scoreColor(a.score_overall)}`}>
            {a.score_overall ?? '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Overall Score</p>
        </div>
        {issuesBySeverity.map((sev) => (
          <div key={sev} className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{issueCounts[sev]}</p>
            <p className="text-xs text-gray-500 mt-1">{sev} issues</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Page data */}
          {page && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Page Data</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <PageDataRow label="Title" value={page.title} />
                <PageDataRow label="H1" value={page.h1} />
                <PageDataRow label="Meta Description" value={page.meta_description} />
                <PageDataRow label="Canonical" value={page.canonical_url} />
                <PageDataRow label="Status Code" value={page.status_code?.toString()} />
                <PageDataRow label="Word Count" value={page.word_count?.toString()} />
              </dl>
            </div>
          )}

          {/* Issues */}
          {issueList.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Issues ({issueList.length})
              </h3>
              <div className="space-y-3">
                {issueList.map((issue) => (
                  <div key={issue.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge label={issue.severity} status={issue.severity} />
                      <span className="text-xs text-gray-500 font-mono">{issue.issue_type}</span>
                    </div>
                    <p className="text-sm text-gray-900">{issue.message}</p>
                    {issue.recommendation && (
                      <p className="text-xs text-gray-500 mt-1">
                        <strong>Fix:</strong> {issue.recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Summary */}
          {a.summary && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">AI Summary</h3>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{a.summary}</p>
            </div>
          )}
        </div>

        {/* Patches sidebar */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Proposed Patches ({patchList.length})
            </h3>
            {patchList.length === 0 ? (
              <p className="text-xs text-gray-400">
                {issueList.length > 0
                  ? 'Click "Generate Patches" to get AI-suggested fixes.'
                  : 'No issues detected — no patches needed.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {patchList.map((patch) => (
                  <li key={patch.id}>
                    <Link
                      href={`/dashboard/seo/patches/${patch.id}`}
                      className="block p-2 rounded hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">
                          {patch.patch_type.replace(/_/g, ' ')}
                        </span>
                        <Badge label={patch.status} status={patch.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Audit Info</h3>
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd><Badge label={a.status} status={a.status} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-700">{formatDate(a.created_at)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

function PageDataRow({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
      <dd className={`text-sm ${value ? 'text-gray-900' : 'text-red-500 italic'}`}>
        {value ?? 'Missing'}
      </dd>
    </div>
  )
}
