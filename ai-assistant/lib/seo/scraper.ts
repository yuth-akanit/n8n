/**
 * Server-side HTML fetcher and SEO data extractor.
 * Uses only built-in APIs — no external DOM parser dependency.
 */

export interface ExtractedPage {
  url: string
  status_code: number
  title: string | null
  meta_description: string | null
  canonical_url: string | null
  h1: string | null
  word_count: number
  img_missing_alt: number
  internal_links: number
  raw_html: string
}

/** Naive regex-based extractor — sufficient for MVP without adding cheerio/parse5 */
export async function fetchAndExtractPage(url: string): Promise<ExtractedPage> {
  let html = ''
  let status_code = 0

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' },
      signal: AbortSignal.timeout(15000),
    })
    status_code = res.status
    html = await res.text()
  } catch (err) {
    throw new Error(`Failed to fetch ${url}: ${String(err)}`)
  }

  return {
    url,
    status_code,
    title: extractTag(html, 'title') ?? extractMeta(html, 'og:title'),
    meta_description:
      extractMetaName(html, 'description') ?? extractMeta(html, 'og:description'),
    canonical_url: extractCanonical(html),
    h1: extractFirstH1(html),
    word_count: countWords(html),
    img_missing_alt: countImgMissingAlt(html),
    internal_links: countInternalLinks(html, url),
    raw_html: html.slice(0, 100_000), // cap at 100KB
  }
}

// ── Helpers ──────────────────────────────────────────────────

function extractTag(html: string, tag: string): string | null {
  const m = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
  return m ? decode(m[1].trim()) : null
}

function extractMetaName(html: string, name: string): string | null {
  const m = html.match(
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
  ) ?? html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i')
  )
  return m ? decode(m[1].trim()) : null
}

function extractMeta(html: string, property: string): string | null {
  const m = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  ) ?? html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i')
  )
  return m ? decode(m[1].trim()) : null
}

function extractCanonical(html: string): string | null {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)
  return m ? m[1].trim() : null
}

function extractFirstH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (!m) return null
  // Strip inner tags
  return decode(m[1].replace(/<[^>]+>/g, '').trim())
}

function countWords(html: string): number {
  // Strip tags and count words in body content
  const bodyMatch = html.match(/<body[\s\S]*?>([\s\S]*)<\/body>/i)
  const text = bodyMatch
    ? bodyMatch[1].replace(/<[^>]+>/g, ' ')
    : html.replace(/<[^>]+>/g, ' ')
  const words = text.match(/\b\w+\b/g)
  return words ? words.length : 0
}

function countImgMissingAlt(html: string): number {
  const allImgs = html.match(/<img[^>]+>/gi) ?? []
  return allImgs.filter((tag) => !/alt=["'][^"']+["']/i.test(tag)).length
}

function countInternalLinks(html: string, pageUrl: string): number {
  try {
    const base = new URL(pageUrl).hostname
    const anchors = html.match(/<a[^>]+href=["']([^"']+)["']/gi) ?? []
    return anchors.filter((tag) => {
      const m = tag.match(/href=["']([^"']+)["']/i)
      if (!m) return false
      const href = m[1]
      if (href.startsWith('/') || href.startsWith('#')) return true
      try {
        return new URL(href).hostname === base
      } catch {
        return false
      }
    }).length
  } catch {
    return 0
  }
}

function decode(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
