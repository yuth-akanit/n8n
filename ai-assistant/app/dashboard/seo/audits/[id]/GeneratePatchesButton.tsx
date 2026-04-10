'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function GeneratePatchesButton({ auditId }: { auditId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/seo-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate patches')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <button onClick={handleGenerate} disabled={loading} className="btn-primary">
        {loading ? 'Generating…' : 'Generate Patches'}
      </button>
    </div>
  )
}
