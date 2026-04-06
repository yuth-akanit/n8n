import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runSeoPatchPrompt } from '@/lib/ai'
import type { SeoPatchRequest, SeoPatchType } from '@/types'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SeoPatchRequest
    const { auditId, pageId } = body

    if (!auditId) {
      return NextResponse.json({ error: 'auditId is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Load audit + page
    const { data: audit } = await supabase
      .from('seo_audits')
      .select('*')
      .eq('id', auditId)
      .single()

    if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })

    const { data: pages } = await supabase
      .from('seo_audit_pages')
      .select('*')
      .eq('audit_id', auditId)
      .limit(1)

    const page = (pages ?? [])[0]
    if (!page) return NextResponse.json({ error: 'No page data for this audit' }, { status: 404 })

    const { data: issues } = await supabase
      .from('seo_issues')
      .select('issue_type, message')
      .eq('audit_id', auditId)

    const issueList = (issues ?? []) as Array<{ issue_type: string; message: string }>

    const pageDataForAi = {
      url: page.url,
      title: page.title,
      meta_description: page.meta_description,
      canonical_url: page.canonical_url,
      h1: page.h1,
      word_count: page.word_count,
    }

    // Run AI patch generation
    const result = await runSeoPatchPrompt(pageDataForAi, issueList)

    // Deterministic patches for common issues (always add even if AI fails)
    const detPatchTypes: Array<{ condition: boolean; type: SeoPatchType; before: unknown; after: unknown }> = [
      {
        condition: !page.meta_description,
        type: 'update_meta_description',
        before: null,
        after: { meta_description: `Discover ${page.title ?? page.url}. Learn more about our services and how we can help you.` },
      },
      {
        condition: !!page.title && page.title.length < 30,
        type: 'update_title',
        before: { title: page.title },
        after: { title: `${page.title} | Professional Service` },
      },
      {
        condition: !page.canonical_url,
        type: 'set_canonical',
        before: null,
        after: { canonical_url: page.url },
      },
    ]

    const detPatches = detPatchTypes
      .filter((p) => p.condition)
      .map((p) => ({
        audit_id: auditId,
        page_id: pageId ?? page.id,
        patch_type: p.type,
        before_json: p.before,
        after_json: p.after,
        status: 'proposed',
      }))

    // AI patches
    const aiPatches = result.patches
      .filter((p) => ['update_title', 'update_meta_description', 'set_canonical', 'rewrite_content', 'add_alt_text'].includes(p.patch_type))
      .map((p) => ({
        audit_id: auditId,
        page_id: pageId ?? page.id,
        patch_type: p.patch_type as SeoPatchType,
        before_json: p.before ? { value: p.before } : null,
        after_json: { value: p.after, reason: p.reason },
        status: 'proposed',
      }))

    // Merge (deterministic patches take priority, skip duplicates)
    const usedTypes = new Set(detPatches.map(p => p.patch_type))
    const mergedPatches = [
      ...detPatches,
      ...aiPatches.filter(p => !usedTypes.has(p.patch_type)),
    ]

    if (mergedPatches.length === 0) {
      return NextResponse.json({ patches: [] })
    }

    const { data: savedPatches, error: patchErr } = await supabase
      .from('seo_patches')
      .insert(mergedPatches)
      .select()

    if (patchErr) throw patchErr

    return NextResponse.json({ patches: savedPatches })
  } catch (err: unknown) {
    console.error('[api/ai/seo-patch]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
