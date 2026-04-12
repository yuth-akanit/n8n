/**
 * Weekly Idea Digest cron endpoint.
 *
 * Triggered by VPS cron:
 *   0 8 * * 1 curl -s -X POST https://ai-workspace.paaair.online/api/cron/idea-digest \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Env vars required: CRON_SECRET, LINE_NOTIFY_TOKEN (and/or RESEND_API_KEY + NOTIFY_EMAIL_TO)
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runChatPrompt } from '@/lib/ai'
import { sendLineNotify } from '@/lib/notify/line'
import { sendEmail } from '@/lib/notify/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('Authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return false // If no secret configured, deny all
  return auth === `Bearer ${secret}`
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results: Array<{ workspaceId: string; status: string; summary?: string }> = []

  try {
    // Get all workspaces
    const { data: workspaces } = await supabase.from('workspaces').select('id, name')
    if (!workspaces?.length) return NextResponse.json({ message: 'No workspaces', results: [] })

    for (const ws of workspaces) {
      try {
        // Get recent ideas from the past 7 days
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data: ideas } = await supabase
          .from('ideas')
          .select('title, brief, status, score_impact, score_roi, tags')
          .eq('workspace_id', ws.id)
          .gte('created_at', since)
          .order('score_roi', { ascending: false })
          .limit(10)

        if (!ideas?.length) {
          await logCronRun(supabase, ws.id, 'idea-digest', 'skipped', { reason: 'no new ideas' })
          results.push({ workspaceId: ws.id, status: 'skipped' })
          continue
        }

        const ideaList = ideas
          .map((i, n) => `${n + 1}. "${i.title}" — ${i.brief?.slice(0, 80)} [ROI:${i.score_roi ?? '?'} Impact:${i.score_impact ?? '?'}]`)
          .join('\n')

        const aiResult = await runChatPrompt(
          `สรุป weekly idea digest สั้น ๆ ภายใน 5 ประโยค ไฮไลต์ idea ที่น่าสนใจที่สุดและ action ที่แนะนำ:\n\n${ideaList}`
        )

        const msg = `📊 Weekly Idea Digest — ${ws.name}\n${new Date().toLocaleDateString('th-TH')}\n\n${aiResult.content}\n\n🔗 ดู ideas ทั้งหมด: ai-workspace.paaair.online/dashboard/ideas`

        await sendLineNotify(msg)
        await sendEmail({
          subject: `Weekly Idea Digest — ${ws.name}`,
          html: `<h2>Weekly Idea Digest</h2><p>${ws.name} · ${new Date().toLocaleDateString('th-TH')}</p><hr><pre style="font-family:sans-serif;white-space:pre-wrap">${aiResult.content}</pre>`,
        })

        await logCronRun(supabase, ws.id, 'idea-digest', 'success', { ideas_count: ideas.length, summary: aiResult.content.slice(0, 300) })
        results.push({ workspaceId: ws.id, status: 'success', summary: aiResult.content.slice(0, 200) })
      } catch (wsErr) {
        console.error(`[cron/idea-digest] workspace ${ws.id}:`, wsErr)
        await logCronRun(supabase, ws.id, 'idea-digest', 'failed', { error: String(wsErr) })
        results.push({ workspaceId: ws.id, status: 'failed' })
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('[cron/idea-digest]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

async function logCronRun(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  jobName: string,
  status: 'success' | 'failed' | 'skipped',
  resultJson: Record<string, unknown>
) {
  await supabase.from('cron_runs').insert({ workspace_id: workspaceId, job_name: jobName, status, result_json: resultJson })
}
