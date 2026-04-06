import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { SeoPatch } from '@/types'
import { PatchReviewActions } from './PatchReviewActions'

interface Props {
  params: { id: string }
}

export default async function SeoPatchDetailPage({ params }: Props) {
  const supabase = createClient()
  const { data: patch, error } = await supabase
    .from('seo_patches')
    .select('*, seo_audits(target_url, id)')
    .eq('id', params.id)
    .single()

  if (error || !patch) notFound()

  const p = patch as SeoPatch & { seo_audits: { target_url: string; id: string } | null }

  return (
    <div>
      <PageHeader
        title="SEO Patch Review"
        description={p.seo_audits?.target_url}
        action={
          <Link href={`/dashboard/seo/audits/${p.audit_id}`} className="btn-secondary">
            ← Back to Audit
          </Link>
        }
      />

      <div className="max-w-2xl space-y-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">{p.patch_type.replace(/_/g, ' ')}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.created_at)}</p>
            </div>
            <Badge label={p.status} status={p.status} />
          </div>

          {/* Before / After comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Before</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-900 font-mono whitespace-pre-wrap">
                {p.before_json
                  ? typeof p.before_json === 'object'
                    ? JSON.stringify(p.before_json, null, 2)
                    : String(p.before_json)
                  : <span className="text-gray-400 italic">None / Missing</span>}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">After (Proposed)</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-900 font-mono whitespace-pre-wrap">
                {typeof p.after_json === 'object'
                  ? JSON.stringify(p.after_json, null, 2)
                  : String(p.after_json)}
              </div>
            </div>
          </div>
        </div>

        {/* Important notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <strong>Human review required.</strong> This patch has not been applied. Approving it marks it for manual implementation — the system will not auto-apply changes.
        </div>

        {/* Review actions */}
        {p.status === 'proposed' && (
          <PatchReviewActions patchId={p.id} />
        )}

        {p.status === 'approved' && p.approved_at && (
          <div className="card p-4 bg-green-50 border-green-200 text-sm text-green-800">
            Approved on {formatDate(p.approved_at)}. Ready for manual implementation.
          </div>
        )}

        {p.status === 'rejected' && (
          <div className="card p-4 bg-gray-50 border-gray-200 text-sm text-gray-600">
            This patch was rejected.
          </div>
        )}
      </div>
    </div>
  )
}
