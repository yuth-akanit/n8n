/**
 * Scheduled SEO re-audit cron endpoint.
 * Re-audits sites that haven't been checked in the past N days.
 *
 * VPS cron (every Sunday 02:00):
 *   0 2 * * 0 curl -s -X POST https://ai-workspace.paaair.online/api/cron/seo-audit \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAndExtractPage } from '@/lib/seo/scraper'
import { runSeoRules, computeSeoScore } from '@/lib/seo/rules'
import { runSeoSummaryPrompt } from '@/lib/ai'
import { getModulePrompt } from '@/lib/ai/module-prompts'
import { sendLineNotify } from '@/lib/notify/line'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const STALE_DAYS = parseInt(process.env.SEO_AUDIT_INTERVAL_DAYS ?? '7', 10)

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('Authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const since = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const audited: string[] = []
  const errors: string[] = []

  try {
    // Find sites with no recent audit
    const { data: sites } = await supabase
      .from('seo_sites')
      .select(`id, workspace_id, name, base_url, seo_audits(id, created_at)`)
      .order('created_at', { referencedTable: 'seo_audits', ascending: false })

    const staleSites = (sites ?? []).filter((site) => {
      const lastAudit = (site.seo_audits as Array<{ created_at: string }>)?.[0]
      return !lastAudit || lastAudit.created_at < since
    })

    for (const site of staleSites.slice(0, 5)) { // cap at 5 per run
      try {
        const pageData = await fetchAndExtractPage(site.base_url)
        const issues = runSeoRules(pageData as Parameters<typeof runSeoRules>[0])
        const score = computeSeoScore(issues)

        const { data: audit } = await supabase
          .from('seo_audits')
          .insert({
            site_id: site.id,
            status: 'running',
            audit_scope: 'single_url',
            target_url: site.base_url,
            created_by: null,
          })
          .select('id')
          .single()

        if (!audit) continue

        const seoModulePrompt = await getModulePrompt(supabase, site.workspace_id, 'seo_module_prompt')
        const aiResult = await runSeoSummaryPrompt(pageData as unknown as Record<string, unknown>, issues, undefined, seoModulePrompt.text)

        await supabase.from('seo_audits').update({
          status: 'completed',
          summary: aiResult.summary,
          score_overall: score,
          finished_at: new Date().toISOString(),
        }).eq('id', audit.id)

        await supabase.from('cron_runs').insert({
          workspace_id: site.workspace_id,
          job_name: 'seo-audit',
          status: 'success',
          result_json: { site: site.name, url: site.base_url, score },
        })

        audited.push(site.name)
      } catch (siteErr) {
        console.error(`[cron/seo-audit] site ${site.name}:`, siteErr)
        errors.push(site.name)
      }
    }

    if (audited.length > 0) {
      await sendLineNotify(`🔍 SEO Auto-Audit เสร็จสิ้น\nตรวจ ${audited.length} เว็บไซต์: ${audited.join(', ')}\n${errors.length > 0 ? `⚠️ Error: ${errors.join(', ')}` : ''}`)
    }

    return NextResponse.json({ ok: true, audited, errors, skipped: (sites?.length ?? 0) - staleSites.length })
  } catch (err) {
    console.error('[cron/seo-audit]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
