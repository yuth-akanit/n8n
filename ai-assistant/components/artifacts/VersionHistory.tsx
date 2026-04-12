'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { timeAgo } from '@/lib/utils'

interface ArtifactVersion {
  id: string
  title: string
  artifact_type: string
  format: string
  version: number
  is_latest: boolean
  created_at: string
}

interface Props {
  artifactId: string
  currentVersion: number
}

/**
 * VersionHistory — fetches and displays all versions of an artifact family.
 * Renders as a compact sidebar panel with links to each version.
 */
export function VersionHistory({ artifactId, currentVersion }: Props) {
  const [versions, setVersions] = useState<ArtifactVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/artifacts/${artifactId}/versions`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          if (Array.isArray(data)) setVersions(data)
          else setError(data.error ?? 'Failed to load versions')
        }
      })
      .catch(() => { if (!cancelled) setError('Network error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [artifactId])

  if (loading) {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Version History</h3>
        <p className="text-xs text-gray-400">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Version History</h3>
        <p className="text-xs text-red-500">{error}</p>
      </div>
    )
  }

  if (versions.length <= 1) return null // Nothing useful to show if only one version

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Version History ({versions.length})
      </h3>
      <ul className="space-y-1">
        {versions.map((v) => (
          <li key={v.id}>
            <Link
              href={`/dashboard/builder/${v.id}`}
              className={`flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                v.version === currentVersion
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                v{v.version}
                {v.is_latest && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">latest</span>
                )}
              </span>
              <span className="text-gray-400">{timeAgo(v.created_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
