import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { Idea } from '@/types'
import { PromoteToProjectButton } from './PromoteToProjectButton'

interface Props {
  params: { id: string }
}

export default async function IdeaDetailPage({ params }: Props) {
  const supabase = createClient()
  const { data: idea, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !idea) notFound()

  const i = idea as Idea

  return (
    <div>
      <PageHeader
        title={i.title}
        action={
          <div className="flex gap-2">
            <Link href="/dashboard/ideas" className="btn-secondary">← Ideas</Link>
            {i.status !== 'converted' && (
              <PromoteToProjectButton ideaId={i.id} workspaceId={i.workspace_id} />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Brief</h3>
            <p className="text-gray-900">{i.brief}</p>
          </div>

          {(i.problem || i.solution) && (
            <div className="card p-5 space-y-4">
              {i.problem && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Problem</h3>
                  <p className="text-gray-900 text-sm">{i.problem}</p>
                </div>
              )}
              {i.solution && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Solution</h3>
                  <p className="text-gray-900 text-sm">{i.solution}</p>
                </div>
              )}
            </div>
          )}

          {i.audience && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Target Audience</h3>
              <p className="text-gray-900 text-sm">{i.audience}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd><Badge label={i.status} status={i.status} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">{formatDate(i.created_at)}</dd>
              </div>
              {i.channel && i.channel.length > 0 && (
                <div>
                  <dt className="text-gray-500 mb-1">Channels</dt>
                  <dd className="flex flex-wrap gap-1">
                    {i.channel.map((c) => <Badge key={c} label={c} />)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {(i.score_impact !== null || i.score_ease !== null || i.score_roi !== null) && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Scores</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <ScoreBox label="Impact" value={i.score_impact} />
                <ScoreBox label="Ease" value={i.score_ease} />
                <ScoreBox label="ROI" value={i.score_roi} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ScoreBox({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  const color = value >= 8 ? 'text-green-700 bg-green-50' : value >= 5 ? 'text-yellow-700 bg-yellow-50' : 'text-red-600 bg-red-50'
  return (
    <div className={`rounded-lg p-2 ${color}`}>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-xs mt-1">{label}</p>
    </div>
  )
}
