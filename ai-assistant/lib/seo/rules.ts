/**
 * Deterministic SEO rule engine.
 * Runs before optional AI summary.
 */

export interface SeoPageData {
  url: string
  title: string | null
  meta_description: string | null
  canonical_url: string | null
  h1: string | null
  word_count: number | null
  status_code: number | null
  img_missing_alt?: number // count of images without alt
  internal_links?: number  // count of internal links
}

export interface SeoIssueInput {
  issue_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  recommendation: string
}

export function runSeoRules(page: SeoPageData): SeoIssueInput[] {
  const issues: SeoIssueInput[] = []

  // 1. Missing title
  if (!page.title || page.title.trim() === '') {
    issues.push({
      issue_type: 'missing_title',
      severity: 'critical',
      message: 'Page title tag is missing',
      recommendation: 'Add a descriptive title tag (50-60 characters) with the primary keyword',
    })
  } else if (page.title.length < 30) {
    // 2. Weak/too short title
    issues.push({
      issue_type: 'weak_title',
      severity: 'high',
      message: `Title is too short (${page.title.length} chars): "${page.title}"`,
      recommendation: 'Expand the title to 50-60 characters and include the primary keyword and location',
    })
  } else if (page.title.length > 60) {
    issues.push({
      issue_type: 'title_too_long',
      severity: 'medium',
      message: `Title is too long (${page.title.length} chars) and may be truncated in search results`,
      recommendation: 'Shorten the title to 50-60 characters',
    })
  }

  // 3. Missing meta description
  if (!page.meta_description || page.meta_description.trim() === '') {
    issues.push({
      issue_type: 'missing_meta_description',
      severity: 'high',
      message: 'Meta description is missing',
      recommendation: 'Add a meta description (150-160 characters) that summarises the page and includes the primary keyword',
    })
  } else if (page.meta_description.length < 70) {
    // 4. Weak/too short meta description
    issues.push({
      issue_type: 'weak_meta_description',
      severity: 'medium',
      message: `Meta description is too short (${page.meta_description.length} chars)`,
      recommendation: 'Expand the meta description to 150-160 characters with a clear call-to-action',
    })
  } else if (page.meta_description.length > 160) {
    issues.push({
      issue_type: 'meta_description_too_long',
      severity: 'low',
      message: `Meta description is too long (${page.meta_description.length} chars) and will be truncated`,
      recommendation: 'Shorten the meta description to under 160 characters',
    })
  }

  // 5. Missing H1
  if (!page.h1 || page.h1.trim() === '') {
    issues.push({
      issue_type: 'missing_h1',
      severity: 'high',
      message: 'No H1 heading found on the page',
      recommendation: 'Add a single H1 heading that contains the primary keyword',
    })
  }

  // 6. Missing canonical
  if (!page.canonical_url || page.canonical_url.trim() === '') {
    issues.push({
      issue_type: 'missing_canonical',
      severity: 'medium',
      message: 'No canonical URL tag found',
      recommendation: 'Add a <link rel="canonical" href="..."> tag to prevent duplicate content issues',
    })
  }

  // 7. Thin content
  const wordCount = page.word_count ?? 0
  if (wordCount > 0 && wordCount < 300) {
    issues.push({
      issue_type: 'thin_content',
      severity: 'high',
      message: `Page has thin content (${wordCount} words)`,
      recommendation: 'Expand content to at least 600 words covering the topic in depth',
    })
  } else if (wordCount >= 300 && wordCount < 600) {
    issues.push({
      issue_type: 'low_word_count',
      severity: 'medium',
      message: `Page content is relatively short (${wordCount} words)`,
      recommendation: 'Consider expanding to 600+ words with relevant supporting information',
    })
  }

  // 8. Images missing alt text
  if (page.img_missing_alt && page.img_missing_alt > 0) {
    issues.push({
      issue_type: 'missing_alt_text',
      severity: 'medium',
      message: `${page.img_missing_alt} image(s) are missing alt text`,
      recommendation: 'Add descriptive alt text to all images, including the primary keyword where relevant',
    })
  }

  // 9. Internal link gap heuristic
  if (page.internal_links !== undefined && page.internal_links < 2) {
    issues.push({
      issue_type: 'low_internal_links',
      severity: 'low',
      message: `Page has very few internal links (${page.internal_links})`,
      recommendation: 'Add 3-5 internal links to related pages to improve crawlability and user navigation',
    })
  }

  return issues
}

/**
 * Compute an overall SEO score (0-100) based on detected issues.
 */
export function computeSeoScore(issues: SeoIssueInput[]): number {
  const penalties: Record<string, number> = {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3,
  }

  const totalPenalty = issues.reduce(
    (acc, issue) => acc + (penalties[issue.severity] ?? 5),
    0
  )

  return Math.max(0, 100 - totalPenalty)
}
