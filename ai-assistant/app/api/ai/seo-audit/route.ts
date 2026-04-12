import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { fetchAndExtractPage } from '@/lib/seo/scraper'
import { runSeoRules, computeSeoScore } from '@/lib/seo/rules'
import { runSeoSummaryPrompt } from '@/lib/ai'
import { getModulePrompt } from '@/lib/ai/module-prompts'
import { requireUrl, optionalString } from '@/lib/api/validate'
import { handleRouteError } from '@/lib/api/errors'
import { resolveNextArtifactVersion } from '@/lib/artifacts'
import type { SeoAuditScope } from '@/types'

const VALID_SCOPES = ['single_url', 'multi_url', 'site_scan'] as const

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as { targetUrl?: unknown; siteName?: unknown; scope?: unknown }

    const targetUrl = requireUrl(body.targetUrl, 'targetUrl')
    const siteName = optionalString(body.siteName, 'siteName', { max: 200 })
    const rawScope = body.scope ?? 'single_url'
    const scope: SeoAuditScope = VALID_SCOPES.includes(rawScope as SeoAuditScope)
      ? (rawScope as SeoAuditScope)
      : 'single_url'

    const supabase = createServiceClient()
    const { workspaceId, user } = ctx

    // Upsert site record scoped to this workspace
    const baseUrl = new URL(targetUrl).origin
    let siteId: string

    const { data: existingSite } = await supabase
      .from('seo_sites')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('base_url', baseUrl)
      .single()

    if (existingSite) {
      siteId = existingSite.id
    } else {
      const { data: newSite, error: siteErr } = await supabase
        .from('seo_sites')
        .insert({ workspace_id: workspaceId, name: siteName ?? baseUrl, base_url: baseUrl })
        .select()
        .single()
      if (siteErr || !newSite) throw siteErr ?? new Error('Failed to create site')
      siteId = newSite.id
    }

    const { data: audit, error: auditErr } = await supabase
      .from('seo_audits')
      .insert({
        site_id: siteId,
        status: 'running',
        audit_scope: scope,
        target_url: targetUrl,
        created_by: user.id,
      })
      .select()
      .single()

    if (auditErr) throw auditErr

    // Fetch and extract page data
    let pageData
    try {
      pageData = await fetchAndExtractPage(targetUrl)
    } catch (fetchErr) {
      await supabase
        .from('seo_audits')
        .update({ status: 'failed', finished_at: new Date().toISOString() })
        .eq('id', audit.id)
      return NextResponse.json({ error: String(fetchErr) }, { status: 422 })
    }

    const { data: auditPage } = await supabase
      .from('seo_audit_pages')
      .insert({
        audit_id: audit.id,
        url: pageData.url,
        title: pageData.title,
        meta_description: pageData.meta_description,
        canonical_url: pageData.canonical_url,
        h1: pageData.h1,
        word_count: pageData.word_count,
        status_code: pageData.status_code,
        raw_html: pageData.raw_html,
        extracted_json: {
          img_missing_alt: pageData.img_missing_alt,
          internal_links: pageData.internal_links,
        },
      })
      .select()
      .single()

    const ruleIssues = runSeoRules(pageData)
    const score = computeSeoScore(ruleIssues)

    if (ruleIssues.length > 0) {
      await supabase.from('seo_issues').insert(
        ruleIssues.map((issue) => ({
          audit_id: audit.id,
          page_id: auditPage?.id ?? null,
          ...issue,
        }))
      )
    }

    // AI summary — best-effort
    let aiSummary = ''
    try {
      let competitorContext = ''
      if (process.env.TAVILY_API_KEY && (pageData.title || pageData.h1)) {
        try {
          const { tavily } = await import('@tavily/core')
          const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY })
          const query = pageData.h1 ?? pageData.title ?? ''
          competitorContext = await tvly.searchContext(query, { searchDepth: 'basic' })
          if (typeof competitorContext !== 'string') {
            competitorContext = JSON.stringify(competitorContext)
          }
        } catch (tavilyErr) {
          console.warn('[SEO] Tavily search failed:', tavilyErr)
        }
      }

      const seoModulePrompt = await getModulePrompt(supabase, ctx.workspaceId, 'seo_module_prompt')
      const summaryResult = await runSeoSummaryPrompt(
        {
          url: pageData.url, title: pageData.title, meta_description: pageData.meta_description,
          h1: pageData.h1, canonical_url: pageData.canonical_url,
          word_count: pageData.word_count, status_code: pageData.status_code,
        },
        ruleIssues.map((i) => ({ issue_type: i.issue_type, message: i.message })),
        competitorContext,
        seoModulePrompt.text
      )
      aiSummary = summaryResult.summary
    } catch {
      // optional — continue without
    }

    const version = await resolveNextArtifactVersion(supabase, {
      workspaceId,
      artifactType: 'seo_report',
    })

    const { data: artifact } = await supabase
      .from('artifacts')
      .insert({
        workspace_id: workspaceId,
        artifact_type: 'seo_report',
        title: `SEO Audit: ${targetUrl}`,
        content: JSON.stringify({ url: targetUrl, score, issues: ruleIssues, summary: aiSummary }, null, 2),
        format: 'json',
        version,
        is_latest: true,
        created_by: user.id,
      })
      .select()
      .single()

    await supabase
      .from('seo_audits')
      .update({
        status: 'completed',
        score_overall: score,
        summary: aiSummary || null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', audit.id)

    return NextResponse.json({
      auditId: audit.id,
      artifactId: artifact?.id,
      pageData,
      issues: ruleIssues,
      score,
      summary: aiSummary,
    })
  } catch (err) {
    return handleRouteError(err, 'api/ai/seo-audit')
  }
}
