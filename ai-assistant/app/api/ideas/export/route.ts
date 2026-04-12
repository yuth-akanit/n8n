export const dynamic = 'force-dynamic'
import { requireApiAuth } from '@/lib/auth/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { Idea } from '@/types'

/**
 * GET /api/ideas/export
 * Returns all workspace ideas as a UTF-8 CSV file download.
 */
export async function GET() {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  const supabase = createServiceClient()
  const { data: ideas, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const rows = (ideas ?? []) as Idea[]

  const headers = [
    'title', 'brief', 'problem', 'solution', 'audience',
    'channels', 'tags', 'score_impact', 'score_ease', 'score_roi',
    'status', 'created_at',
  ]

  function escapeCell(value: unknown): string {
    if (value === null || value === undefined) return ''
    const str = Array.isArray(value) ? value.join(', ') : String(value)
    // Wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const csvLines = [
    headers.join(','),
    ...rows.map((idea) =>
      [
        idea.title,
        idea.brief,
        idea.problem,
        idea.solution,
        idea.audience,
        idea.channel,
        idea.tags,
        idea.score_impact,
        idea.score_ease,
        idea.score_roi,
        idea.status,
        idea.created_at,
      ].map(escapeCell).join(',')
    ),
  ]

  const csv = '\uFEFF' + csvLines.join('\r\n') // BOM for Thai characters in Excel

  const filename = `ideas_${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
