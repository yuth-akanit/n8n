import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { runSeoPatchPrompt } from '@/lib/ai'
import type { SeoPatchType } from '@/types'

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as { auditId: string; pageId?: string }
    const { auditId, pageId } = body

    if (!auditId) {
      return NextResponse.json({ error: 'auditId is required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { workspaceId } = ctx

    // Verify the audit belongs to this workspace via site
    const { data: audit } = await supabase
      .from('seo_audits')
      .select('*, seo_sites!inner(workspace_id)')
      .eq('id', auditId)
      .eq('seo_sites.workspace_id', workspaceId)
      .single()

    if (!audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    const { data: pages } = await supabase
      .from('seo_audit_pages')
      .select('*')
      .eq('audit_id', auditId)
      .limit(1)

    const page = (pages ?? [])[0]
    if (!page) {
      return NextResponse.json({ error: 'No page data for this audit' }, { status: 404 })
    }

    const { data: issues } = await supabase
      .from('seo_issues')
      .select('issue_type, message')
      .eq('audit_id', auditId)

    const issueList = (issues ?? []) as Array<{ issue_type: string; message: string }>

    const pageDataForAi = {
      url: page.url, title: page.title, meta_description: page.meta_description,
      canonical_url: page.canonical_url, h1: page.h1, word_count: page.word_count,
    }

    const result = await runSeoPatchPrompt(pageDataForAi, issueList)

    // Deterministic patches for common issues
    const targetPageId = pageId ?? page.id
    const detPatches: Array<{
      audit_id: string; page_id: string; patch_type: SeoPatchType;
      before_json: unknown; after_json: unknown; status: string
    }> = []

    if (!page.meta_description) {
      detPatches.push({
        audit_id: auditId, page_id: targetPageId,
        patch_type: 'update_meta_description',
        before_json: null,
        after_json: { meta_description: `Discover ${page.title ?? page.url}. Learn more about our services and how we can help you.` },
        status: 'proposed',
      })
    }
    if (page.title && page.title.length < 30) {
      detPatches.push({
        audit_id: auditId, page_id: targetPageId,
        patch_type: 'update_title',
        before_json: { title: page.title },
        after_json: { title: `${page.title} | Professional Service` },
        status: 'proposed',
      })
    }
    if (!page.canonical_url) {
      detPatches.push({
        audit_id: auditId, page_id: targetPageId,
        patch_type: 'set_canonical',
        before_json: null,
        after_json: { canonical_url: page.url },
        status: 'proposed',
      })
    }

    // AI patches deduplicated against deterministic ones
    const usedTypes = new Set(detPatches.map((p) => p.patch_type))
    const validPatchTypes: SeoPatchType[] = [
      'update_title', 'update_meta_description', 'set_canonical', 'rewrite_content', 'add_alt_text',
    ]
    const aiPatches = result.patches
      .filter((p) => validPatchTypes.includes(p.patch_type as SeoPatchType) && !usedTypes.has(p.patch_type as SeoPatchType))
      .map((p) => ({
        audit_id: auditId,
        page_id: targetPageId,
        patch_type: p.patch_type as SeoPatchType,
        before_json: p.before ? { value: p.before } : null,
        after_json: { value: p.after, reason: p.reason },
        status: 'proposed',
      }))

    const allPatches = [...detPatches, ...aiPatches]
    if (allPatches.length === 0) return NextResponse.json({ patches: [] })

    const { data: savedPatches, error: patchErr } = await supabase
      .from('seo_patches')
      .insert(allPatches)
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
