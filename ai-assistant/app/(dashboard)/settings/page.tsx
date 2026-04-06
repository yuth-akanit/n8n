export const dynamic = 'force-dynamic'
import { PageHeader } from '@/components/ui/PageHeader'

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Workspace configuration and environment info"
      />

      <div className="max-w-xl space-y-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Environment</h2>
          <dl className="space-y-3 text-sm">
            <SettingRow
              label="AI Provider"
              value={process.env.AI_PROVIDER ?? 'mock (no ANTHROPIC_API_KEY set)'}
            />
            <SettingRow
              label="Supabase URL"
              value={process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Configured' : '✗ Not configured'}
            />
            <SettingRow
              label="Default Workspace"
              value="Internal Team (00000000-0000-0000-0000-000000000001)"
            />
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Configuration</h2>
          <p className="text-sm text-gray-600 mb-3">
            This is an internal MVP. All settings are managed via environment variables in{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code>.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs space-y-1 text-gray-700">
            <p># Required</p>
            <p>NEXT_PUBLIC_SUPABASE_URL=...</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=...</p>
            <p>SUPABASE_SERVICE_ROLE_KEY=...</p>
            <p className="pt-2"># Optional (defaults to mock)</p>
            <p>ANTHROPIC_API_KEY=sk-ant-...</p>
            <p>AI_PROVIDER=anthropic</p>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Modules</h2>
          <ul className="text-sm space-y-2">
            {[
              { name: 'Idea Lab', status: 'Active', path: '/dashboard/ideas' },
              { name: 'Project Planner', status: 'Active', path: '/dashboard/projects' },
              { name: 'Builder Studio', status: 'Active', path: '/dashboard/builder' },
              { name: 'SEO Doctor', status: 'Active', path: '/dashboard/seo' },
            ].map((m) => (
              <li key={m.name} className="flex justify-between">
                <span className="text-gray-700">{m.name}</span>
                <span className="text-green-600 text-xs font-medium">{m.status}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500 flex-shrink-0">{label}</dt>
      <dd className="text-gray-900 text-right font-mono text-xs">{value}</dd>
    </div>
  )
}
