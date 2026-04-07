export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { timeAgo } from '@/lib/utils'
import type { Idea } from '@/types'

export default async function IdeasPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')

  const supabase = createServiceClient()
  const { data: ideas, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader
        title="Idea Lab"
        description="Brainstorm and evaluate ideas with AI"
        action={<Link href="/dashboard/ideas/new" className="btn-primary">+ New Idea</Link>}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 mb-4">
          Failed to load ideas: {error.message}
        </div>
      )}

      {!ideas || ideas.length === 0 ? (
        <EmptyState
          title="No ideas yet"
          description="Start by entering a brief and let AI generate practical ideas for your team."
          action={<Link href="/dashboard/ideas/new" className="btn-primary">Generate Ideas</Link>}
        />
      ) : (
        <div className="space-y-3">
          {(ideas as Idea[]).map((idea) => (
            <Link key={idea.id} href={`/dashboard/ideas/${idea.id}`}
              className="card p-4 flex items-start justify-between hover:shadow-md transition-shadow block">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-semibold text-gray-900 truncate">{idea.title}</h2>
                  <Badge label={idea.status} status={idea.status} />
                </div>
                <p className="text-sm text-gray-500 truncate">{idea.brief}</p>
                <p className="text-xs text-gray-400 mt-1">{timeAgo(idea.created_at)}</p>
              </div>
              {idea.score_roi !== null && (
                <div className="flex gap-3 ml-4 flex-shrink-0 text-center">
                  <ScorePill label="Impact" value={idea.score_impact} />
                  <ScorePill label="Ease" value={idea.score_ease} />
                  <ScorePill label="ROI" value={idea.score_roi} />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function ScorePill({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  const color = value >= 8 ? 'text-green-700' : value >= 5 ? 'text-yellow-700' : 'text-red-600'
  return (
    <div className="text-center">
      <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
