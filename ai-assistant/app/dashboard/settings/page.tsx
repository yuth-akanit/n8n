export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth/server'
import { createServiceClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function SettingsPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')

  const supabase = createServiceClient()
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, slug, created_at')
    .eq('id', ctx.workspaceId)
    .single()

  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, created_at')
    .eq('workspace_id', ctx.workspaceId)

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Workspace configuration and environment info"
      />

      <div className="max-w-xl space-y-4">
        {/* Workspace info */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Workspace</h2>
          <dl className="space-y-2 text-sm">
            <SettingRow label="Name" value={workspace?.name ?? '—'} />
            <SettingRow label="Slug" value={workspace?.slug ?? '—'} />
            <SettingRow label="ID" value={ctx.workspaceId} mono />
            <SettingRow label="Members" value={String(members?.length ?? 1)} />
          </dl>
        </div>

        {/* Current user */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Your Account</h2>
          <dl className="space-y-2 text-sm">
            <SettingRow label="User ID" value={ctx.user.id} mono />
            <SettingRow label="Email" value={ctx.user.email ?? '—'} />
            <SettingRow label="Role" value={members?.find(m => m.user_id === ctx.user.id)?.role ?? 'owner'} />
          </dl>
        </div>

        {/* Environment */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Environment</h2>
          <dl className="space-y-2 text-sm">
            <SettingRow
              label="AI Provider"
              value={process.env.AI_PROVIDER === 'anthropic' && process.env.ANTHROPIC_API_KEY
                ? 'Anthropic (live)'
                : 'Mock (no key configured)'}
            />
            <SettingRow label="Supabase URL" value={process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'Not set'} />
          </dl>
        </div>

        {/* Config reference */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Environment Variables</h2>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs space-y-1 text-gray-700">
            <p className="text-gray-400"># Required</p>
            <p>NEXT_PUBLIC_SUPABASE_URL</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
            <p>SUPABASE_SERVICE_ROLE_KEY</p>
            <p className="pt-2 text-gray-400"># Optional — defaults to mock</p>
            <p>ANTHROPIC_API_KEY</p>
            <p>AI_PROVIDER=anthropic</p>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Modules</h2>
          <ul className="text-sm space-y-2">
            {[
              { name: 'Idea Lab', path: '/dashboard/ideas' },
              { name: 'Project Planner', path: '/dashboard/projects' },
              { name: 'Builder Studio', path: '/dashboard/builder' },
              { name: 'SEO Doctor', path: '/dashboard/seo' },
            ].map((m) => (
              <li key={m.name} className="flex justify-between">
                <span className="text-gray-700">{m.name}</span>
                <span className="text-green-600 text-xs font-medium">Active</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500 flex-shrink-0">{label}</dt>
      <dd className={`text-gray-900 text-right truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
