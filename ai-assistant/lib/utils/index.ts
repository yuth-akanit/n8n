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
    new: 'bg-gray-100 text-gray-700',
    draft: 'bg-gray-100 text-gray-700',
    refining: 'bg-yellow-100 text-yellow-800',
    planning: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    building: 'bg-indigo-100 text-indigo-800',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    done: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-500',
    rejected: 'bg-red-100 text-red-700',
    converted: 'bg-purple-100 text-purple-700',
    // tasks
    todo: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-800',
    blocked: 'bg-red-100 text-red-700',
    review: 'bg-yellow-100 text-yellow-800',
    // seo
    queued: 'bg-gray-100 text-gray-700',
    running: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-700',
    proposed: 'bg-yellow-100 text-yellow-800',
    applied: 'bg-green-100 text-green-800',
    // severity
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}

/** Default workspace ID used for MVP single-workspace mode */
export const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'
