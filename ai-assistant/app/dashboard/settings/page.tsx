export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth/server'
import { createServiceClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { WorkspaceContextEditor } from './WorkspaceContextEditor'

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

  const { data: wsContext } = await supabase
    .from('workspace_context')
    .select('title, content_md, is_active')
    .eq('workspace_id', ctx.workspaceId)
    .single()

  const { data: cronRuns } = await supabase
    .from('cron_runs')
    .select('job_name, status, ran_at, result_json')
    .eq('workspace_id', ctx.workspaceId)
    .order('ran_at', { ascending: false })
    .limit(10)

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Workspace configuration and environment info"
      />

      <div className="max-w-2xl space-y-4">

        {/* ── Workspace Context Doc ─────────────────────────── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Workspace Context / Brand Guide</h2>
          <p className="text-xs text-gray-500 mb-4">
            ข้อมูลนี้จะถูก inject อัตโนมัติใน system prompt ทุก AI module
          </p>
          <WorkspaceContextEditor
            initial={{
              title: wsContext?.title ?? 'Workspace Brief',
              content_md: wsContext?.content_md ?? '',
              is_active: wsContext?.is_active ?? true,
            }}
          />
        </div>

        {/* ── Cron / Scheduled Runs ────────────────────────── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Scheduled AI Runs</h2>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs space-y-1 text-gray-700 mb-4">
            <p className="text-gray-400"># เพิ่มใน VPS crontab: crontab -e</p>
            <p className="text-gray-400"># Weekly idea digest — ทุกวันจันทร์ 08:00</p>
            <p>{'0 8 * * 1 curl -s -X POST https://ai-workspace.paaair.online/api/cron/idea-digest \\'}</p>
            <p className="pl-4">{'-H "Authorization: Bearer $CRON_SECRET"'}</p>
            <p className="text-gray-400 mt-2"># SEO re-audit — ทุกอาทิตย์ 02:00</p>
            <p>{'0 2 * * 0 curl -s -X POST https://ai-workspace.paaair.online/api/cron/seo-audit \\'}</p>
            <p className="pl-4">{'-H "Authorization: Bearer $CRON_SECRET"'}</p>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            ต้องตั้ง env: <code className="bg-gray-100 px-1 rounded">CRON_SECRET</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">LINE_NOTIFY_TOKEN</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">RESEND_API_KEY</code>
          </p>
          {cronRuns && cronRuns.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Recent runs</p>
              <div className="space-y-1">
                {cronRuns.map((run, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                    <span className="text-gray-700 font-medium">{run.job_name}</span>
                    <div className="flex items-center gap-3">
                      <span className={run.status === 'success' ? 'text-green-600' : run.status === 'skipped' ? 'text-gray-400' : 'text-red-500'}>
                        {run.status}
                      </span>
                      <span className="text-gray-400">{new Date(run.ran_at).toLocaleString('th-TH')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
              value={
                process.env.AI_PROVIDER === 'openai' && process.env.OPENAI_API_KEY ? 'OpenAI (live)' :
                process.env.AI_PROVIDER === 'together' && process.env.TOGETHER_API_KEY ? 'Together.ai (live)' :
                process.env.AI_PROVIDER === 'kie' && process.env.KIE_API_KEY ? 'KIE AI (live)' :
                process.env.AI_PROVIDER === 'anthropic' && process.env.ANTHROPIC_API_KEY ? 'Anthropic (live)' :
                'Mock (no key configured)'
              }
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
            <p>AI_PROVIDER=openai /* openai, together, kie, anthropic, mock */</p>
            <p className="pt-2 text-gray-400"># AI Providers</p>
            <p>OPENAI_API_KEY</p>
            <p>OPENAI_MODEL</p>
            <p>TOGETHER_API_KEY</p>
            <p>TOGETHER_MODEL</p>
            <p>KIE_API_KEY</p>
            <p>KIE_MODEL</p>
            <p>KIE_BASE_URL</p>
            <p>ANTHROPIC_API_KEY</p>
            <p className="pt-2 text-gray-400"># Additional Services</p>
            <p>TAVILY_API_KEY</p>
            <p>PINECONE_API_KEY</p>
            <p>PINECONE_ASSISTANT_HOST</p>
            <p>PINECONE_ASSISTANT_NAME</p>
            <p className="pt-2 text-gray-400"># Notifications (cron)</p>
            <p>CRON_SECRET  /* openssl rand -hex 32 */</p>
            <p className="pt-2 text-gray-400"># LINE Messaging API (notify-bot ปิดแล้ว)</p>
            <p>LINE_CHANNEL_ACCESS_TOKEN</p>
            <p>LINE_USER_ID</p>
            <p className="pt-2 text-gray-400"># Email via Resend (resend.com)</p>
            <p>RESEND_API_KEY</p>
            <p>NOTIFY_EMAIL_TO</p>
            <p>NOTIFY_EMAIL_FROM</p>
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
              { name: 'AI Chat', path: '/dashboard/chat' },
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
