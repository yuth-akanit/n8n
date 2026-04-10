export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { timeAgo } from '@/lib/utils'

export default async function DashboardPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')

  const { workspaceId } = ctx
  const supabase = createServiceClient()

  const [
    { data: projects },
    { data: artifacts },
    { data: tasks },
    { data: seoPatches },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, status, priority, updated_at')
      .eq('workspace_id', workspaceId)
      .in('status', ['planning', 'building', 'active'])
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('artifacts')
      .select('id, title, artifact_type, created_at')
      .eq('workspace_id', workspaceId)
      .eq('is_latest', true)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('tasks')
      .select('id, title, status, priority, project_id')
      .in('status', ['todo', 'in_progress', 'blocked'])
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('seo_patches')
      .select('id, patch_type, status, created_at, audit_id')
      .eq('status', 'proposed')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Internal AI Workspace — overview of active work"
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'New Idea', href: '/dashboard/ideas/new', color: 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100' },
          { label: 'New Project', href: '/dashboard/projects/new', color: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100' },
          { label: 'Open Builder', href: '/dashboard/builder', color: 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100' },
          { label: 'SEO Audit', href: '/dashboard/seo', color: 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100' },
          { label: 'AI Chat (ทุกเรื่อง)', href: '/dashboard/chat', color: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100' },
        ].map((a) => (
          <Link key={a.href} href={a.href}
            className={`card border px-4 py-3 text-sm font-medium text-center transition-colors ${a.color}`}>
            {a.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Projects */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Active Projects</h2>
            <Link href="/dashboard/projects" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {projects && projects.length > 0 ? (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/dashboard/projects/${p.id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50 group">
                    <span className="text-sm text-gray-900 group-hover:text-blue-600 font-medium truncate">{p.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <Badge label={p.priority} status={p.priority} />
                      <Badge label={p.status} status={p.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No active projects</p>
          )}
        </section>

        {/* Recent Artifacts */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Recent Artifacts</h2>
          </div>
          {artifacts && artifacts.length > 0 ? (
            <ul className="space-y-2">
              {artifacts.map((a) => (
                <li key={a.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 font-medium truncate">{a.title}</p>
                    <p className="text-xs text-gray-400">{timeAgo(a.created_at)}</p>
                  </div>
                  <Badge label={a.artifact_type} className="ml-2 flex-shrink-0" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No artifacts yet</p>
          )}
        </section>

        {/* Open Tasks */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Open Tasks</h2>
          </div>
          {tasks && tasks.length > 0 ? (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                  <span className="text-sm text-gray-900 truncate">{t.title}</span>
                  <div className="flex gap-1.5 ml-2 flex-shrink-0">
                    <Badge label={t.priority} status={t.priority} />
                    <Badge label={t.status} status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No open tasks</p>
          )}
        </section>

        {/* SEO Pending */}
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">SEO Patches Pending Review</h2>
            <Link href="/dashboard/seo" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {seoPatches && seoPatches.length > 0 ? (
            <ul className="space-y-2">
              {seoPatches.map((p) => (
                <li key={p.id}>
                  <Link href={`/dashboard/seo/patches/${p.id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50 group">
                    <span className="text-sm text-gray-900 group-hover:text-blue-600 font-medium">
                      {p.patch_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(p.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No patches pending</p>
          )}
        </section>
      </div>
    </div>
  )
}
