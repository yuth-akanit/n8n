'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SeoPatch } from '@/types'

interface Props {
  patches: SeoPatch[]
}

/**
 * BulkPatchActions — renders the SEO patches list with checkboxes
 * and a sticky bulk-action bar that appears when any are selected.
 */
export function BulkPatchActions({ patches }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')

  const proposed = patches.filter((p) => p.status === 'proposed')
  const allProposedSelected = proposed.length > 0 && proposed.every((p) => selected.has(p.id))

  function toggleAll() {
    if (allProposedSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(proposed.map((p) => p.id)))
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulkAction(action: 'approve' | 'reject') {
    if (selected.size === 0) return
    setLoading(action)
    setError('')
    try {
      const res = await fetch('/api/seo/patches/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Bulk action failed')
      setSelected(new Set())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(null)
    }
  }

  const statusColors: Record<string, string> = {
    proposed: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    applied:  'bg-blue-100 text-blue-800',
    failed:   'bg-gray-100 text-gray-600',
  }

  if (patches.length === 0) {
    return <p className="text-xs text-gray-400">No patches yet.</p>
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <span className="text-xs text-blue-700 flex-1">{selected.size} selected</span>
          <button
            onClick={() => bulkAction('approve')}
            disabled={loading !== null}
            className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading === 'approve' ? 'Approving…' : 'Approve All'}
          </button>
          <button
            onClick={() => bulkAction('reject')}
            disabled={loading !== null}
            className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading === 'reject' ? 'Rejecting…' : 'Reject All'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Select all proposed */}
      {proposed.length > 1 && (
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none px-1">
          <input
            type="checkbox"
            checked={allProposedSelected}
            onChange={toggleAll}
            className="rounded"
          />
          Select all proposed ({proposed.length})
        </label>
      )}

      {/* Patch list */}
      {patches.map((patch) => (
        <div key={patch.id} className="flex items-center gap-2 p-2 rounded border border-gray-100 hover:bg-gray-50">
          {patch.status === 'proposed' && (
            <input
              type="checkbox"
              checked={selected.has(patch.id)}
              onChange={() => toggle(patch.id)}
              className="rounded flex-shrink-0"
            />
          )}
          {patch.status !== 'proposed' && <span className="w-4 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-gray-700">
              {patch.patch_type.replace(/_/g, ' ')}
            </span>
            {patch.after_json && (
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {JSON.stringify(patch.after_json).slice(0, 80)}
              </p>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[patch.status] ?? ''}`}>
            {patch.status}
          </span>
        </div>
      ))}
    </div>
  )
}
