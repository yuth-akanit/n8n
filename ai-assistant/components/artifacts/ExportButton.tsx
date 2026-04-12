'use client'

/**
 * ExportButton — downloads artifact content as a file.
 * Supports .md and .txt (text formats) and .json.
 * No server call needed — content is already on the page.
 */

interface Props {
  content: string
  title: string
  format: string // 'md' | 'json' | 'sql' | 'ts' | etc.
}

export function ExportButton({ content, title, format }: Props) {
  function download(ext: string, mime: string, body: string) {
    const blob = new Blob([body], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(title)}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isMd   = format === 'md'
  const isJson = format === 'json'
  const isSql  = format === 'sql'

  // Determine export options based on format
  const options: Array<{ label: string; ext: string; mime: string; body: string }> = []

  if (isMd) {
    options.push({ label: 'Download .md', ext: 'md', mime: 'text/markdown', body: content })
  }
  if (isJson) {
    options.push({ label: 'Download .json', ext: 'json', mime: 'application/json', body: content })
    // Also offer markdown-ish text export
    options.push({ label: 'Download .txt', ext: 'txt', mime: 'text/plain', body: content })
  }
  if (isSql) {
    options.push({ label: 'Download .sql', ext: 'sql', mime: 'text/plain', body: content })
  }
  if (!isMd && !isJson && !isSql) {
    options.push({ label: 'Download .txt', ext: 'txt', mime: 'text/plain', body: content })
  }

  if (options.length === 1) {
    return (
      <button
        onClick={() => download(options[0].ext, options[0].mime, options[0].body)}
        className="btn-secondary"
      >
        ↓ {options[0].label}
      </button>
    )
  }

  return (
    <div className="relative group">
      <button className="btn-secondary">↓ Export ▾</button>
      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px] hidden group-focus-within:block group-hover:block">
        {options.map((o) => (
          <button
            key={o.ext}
            onClick={() => download(o.ext, o.mime, o.body)}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}
