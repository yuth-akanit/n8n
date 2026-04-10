/**
 * Shared utility functions.
 */

/** Generate a URL-safe slug from text */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Format a date string into a human-readable format */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Format a date string into relative time */
export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(dateStr)
}

/** Truncate text to a max length */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '…'
}

/** Parse JSON safely — returns null on failure */
export function safeParseJson<T>(str: string): T | null {
  try {
    return JSON.parse(str) as T
  } catch {
    return null
  }
}

/** Clamp a number between min and max */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Get status color classes for Tailwind */
export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    // project/idea
    new: 'bg-slate-100 text-slate-700',
    draft: 'bg-slate-100 text-slate-700',
    refining: 'bg-amber-100 text-amber-800',
    planning: 'bg-sky-100 text-sky-800',
    approved: 'bg-emerald-100 text-emerald-800',
    building: 'bg-violet-100 text-violet-800',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-orange-100 text-orange-800',
    done: 'bg-teal-100 text-teal-800',
    archived: 'bg-slate-100 text-slate-500',
    rejected: 'bg-rose-100 text-rose-700',
    converted: 'bg-fuchsia-100 text-fuchsia-700',
    // tasks
    todo: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-blue-100 text-blue-800',
    blocked: 'bg-red-100 text-red-700',
    review: 'bg-amber-100 text-amber-800',
    // seo
    queued: 'bg-slate-100 text-slate-700',
    running: 'bg-blue-100 text-blue-800',
    completed: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-rose-100 text-rose-700',
    proposed: 'bg-amber-100 text-amber-800',
    applied: 'bg-emerald-100 text-emerald-800',
    // severity
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-rose-100 text-rose-700',
  }
  return map[status] ?? 'bg-slate-100 text-slate-700'
}