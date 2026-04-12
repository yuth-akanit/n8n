'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export function PatchReviewActions({ patchId }: { patchId: string }) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')
  const [confirmReject, setConfirmReject] = useState(false)
  const router = useRouter()

  async function handleAction(action: 'approve' | 'reject') {
    setLoading(action)
    setError('')
    try {
      const res = await fetch(`/api/seo/patches/${patchId}/${action}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `${action} failed`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <ConfirmDialog
        open={confirmReject}
        title="ยืนยันการ Reject"
        message="Patch นี้จะถูก reject และไม่สามารถกู้คืนได้ ต้องการดำเนินการต่อหรือไม่?"
        confirmLabel="Reject"
        danger
        onConfirm={() => { setConfirmReject(false); void handleAction('reject') }}
        onCancel={() => setConfirmReject(false)}
      />

      <div className="flex gap-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={() => handleAction('approve')}
          disabled={loading !== null}
          className="btn-primary"
        >
          {loading === 'approve' ? 'Approving…' : 'Approve Patch'}
        </button>
        <button
          onClick={() => setConfirmReject(true)}
          disabled={loading !== null}
          className="btn-danger"
        >
          {loading === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    </>
  )
}
