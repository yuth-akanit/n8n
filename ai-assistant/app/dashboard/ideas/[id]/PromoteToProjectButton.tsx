'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  ideaId: string
  workspaceId: string
}

export function PromoteToProjectButton({ ideaId, workspaceId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handlePromote() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ideas/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId, workspaceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Promotion failed')
      router.push(`/dashboard/projects/${data.projectId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to promote')
      setLoading(false)
    }
  }

  return (
    <div>
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <button onClick={handlePromote} disabled={loading} className="btn-primary">
        {loading ? 'Creating project…' : 'Convert to Project →'}
      </button>
    </div>
  )
}
