import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAndExtractPage } from '@/lib/seo/scraper'
import { runSeoRules, computeSeoScore } from '@/lib/seo/rules'
import { runSeoSummaryPrompt } from '@/lib/ai'
import type { SeoAuditRequest } from '@/types'

export async function POST(request: Request) {
  try {
    const body = await request.json() as SeoAuditRequest & {
      workspaceId: string
      siteName?: string
    }
    const { workspaceId, targetUrl, siteName, scope } = body

    if (!targetUrl) {
      return NextResponse.json({ error: 'targetUrl is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Ensure site exists (upsert by base_url)
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
        .insert({
          workspace_id: workspaceId,
          name: siteName ?? baseUrl,
          base_url: baseUrl,
        })
        .select()
        .single()

      if (siteErr) throw siteErr
      siteId = newSite.id
    }

    // Create audit record
    const { data: audit, error: auditErr } = await supabase
      .from('seo_audits')
      .insert({
        site_id: siteId,
        status: 'running',
        audit_scope: scope ?? 'single_url',
        target_url: targetUrl,
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

    // Save audit page
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

    // Run deterministic SEO rules
    const ruleIssues = runSeoRules(pageData)
    const score = computeSeoScore(ruleIssues)

    // Save issues
    if (ruleIssues.length > 0) {
      const issueRows = ruleIssues.map((issue) => ({
        audit_id: audit.id,
        page_id: auditPage?.id ?? null,
        ...issue,
      }))
      await supabase.from('seo_issues').insert(issueRows)
    }

    // AI summary (best-effort, non-blocking failure)
    let aiSummary = ''
    try {
      const summaryResult = await runSeoSummaryPrompt(
        { url: pageData.url, title: pageData.title, meta_description: pageData.meta_description, h1: pageData.h1, canonical_url: pageData.canonical_url, word_count: pageData.word_count, status_code: pageData.status_code },
        ruleIssues.map((i) => ({ issue_type: i.issue_type, message: i.message }))
      )
      aiSummary = summaryResult.summary
    } catch {
      // AI summary is optional
    }

    // Save artifact
    const { data: artifact } = await supabase
      .from('artifacts')
      .insert({
        workspace_id: workspaceId,
        artifact_type: 'seo_report',
        title: `SEO Audit: ${targetUrl}`,
        content: JSON.stringify({ url: targetUrl, score, issues: ruleIssues, summary: aiSummary }, null, 2),
        format: 'json',
      })
      .select()
      .single()

    // Update audit as completed
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
  } catch (err: unknown) {
    console.error('[api/ai/seo-audit]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
