'use client'

import { useState, useEffect } from 'react'
import { MODULE_LABELS, DEFAULT_MODULE_PROMPTS, type ModulePromptKey } from '@/lib/ai/module-prompts'

interface PromptInfo {
  text: string
  version: number
  source: 'db' | 'hardcoded'
  history: Array<{
    id: string
    version: number
    is_active: boolean
    prompt_hash: string | null
    notes: string | null
    created_at: string
  }>
}

type PromptsMap = Record<ModulePromptKey, PromptInfo>

const KEYS: ModulePromptKey[] = [
  'chat_module_prompt',
  'idea_module_prompt',
  'builder_module_prompt',
  'seo_module_prompt',
]

export function ModulePromptsEditor() {
  const [prompts, setPrompts] = useState<PromptsMap | null>(null)
  const [activeKey, setActiveKey] = useState<ModulePromptKey>('chat_module_prompt')
  const [draft, setDraft] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/workspace/prompts')
      .then(r => r.json())
      .then((data: { prompts: PromptsMap }) => {
        setPrompts(data.prompts)
        setDraft(data.prompts[activeKey]?.text ?? '')
      })
      .catch(() => setDraft(DEFAULT_MODULE_PROMPTS[activeKey]))
      .finally(() => setLoading(false))
  }, [activeKey])

  function handleTabChange(key: ModulePromptKey) {
    setActiveKey(key)
    setStatus('idle')
    setDraft(prompts?.[key]?.text ?? DEFAULT_MODULE_PROMPTS[key])
    setNotes('')
  }

  function handleReset() {
    setDraft(DEFAULT_MODULE_PROMPTS[activeKey])
    setStatus('idle')
  }

  async function handleSave() {
    if (!draft.trim()) return
    setSaving(true)
    setStatus('idle')
    setErrorMsg('')
    try {
      const res = await fetch('/api/workspace/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_key: activeKey, prompt_text: draft, notes }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; version?: number }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Save failed')

      // Update local state with new version
      setPrompts(prev => prev ? {
        ...prev,
        [activeKey]: { ...prev[activeKey], text: draft.trim(), version: data.version ?? 1, source: 'db' },
      } : prev)
      setNotes('')
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error')
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const current = prompts?.[activeKey]
  const charCount = draft.length
  const isDirty = draft !== (current?.text ?? DEFAULT_MODULE_PROMPTS[activeKey])

  if (loading) {
    return <div className="card p-6 text-sm text-slate-400">กำลังโหลด prompts...</div>
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">Module System Prompts</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          กำหนดพฤติกรรมของ AI แยกตามโมดูล — ทุก save จะสร้าง version ใหม่ (rollback ได้)
        </p>
      </div>

      {/* Module tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50 overflow-x-auto">
        {KEYS.map(key => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeKey === key
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {MODULE_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {/* Meta info */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {current?.source === 'db' ? (
            <>
              <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                v{current.version} — DB override
              </span>
              {current.history?.[0]?.created_at && (
                <span>
                  บันทึกล่าสุด: {new Date(current.history[0].created_at).toLocaleDateString('th-TH', {
                    day: 'numeric', month: 'short', year: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              )}
            </>
          ) : (
            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
              ใช้ค่า default (hardcoded)
            </span>
          )}
          <span className={`ml-auto ${charCount > 18000 ? 'text-red-500' : ''}`}>
            {charCount.toLocaleString()} / 20,000 chars
          </span>
        </div>

        {/* Textarea */}
        <textarea
          className="input font-mono text-xs leading-relaxed"
          rows={16}
          value={draft}
          onChange={e => { setDraft(e.target.value); setStatus('idle') }}
          placeholder="เขียน system prompt สำหรับโมดูลนี้..."
        />

        {/* Notes */}
        <input
          className="input text-sm"
          placeholder="Change notes (optional) — เช่น 'เพิ่ม instruction เรื่องราคา'"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !isDirty || charCount > 20000}
            className="btn-primary text-sm py-2 px-5 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก (version ใหม่)'}
          </button>
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-100"
          >
            Reset to default
          </button>
          {status === 'saved' && (
            <span className="text-xs text-green-600 font-medium">บันทึกแล้ว ✓ (v{current?.version})</span>
          )}
          {status === 'error' && (
            <span className="text-xs text-red-600">{errorMsg}</span>
          )}
        </div>

        {/* Version history */}
        {current?.history && current.history.length > 1 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Version history</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {current.history.slice(0, 8).map(h => (
                <div key={h.id} className="flex items-center gap-2 text-xs text-slate-500 py-1 border-b border-slate-50">
                  <span className={`font-mono ${h.is_active ? 'text-blue-600 font-semibold' : ''}`}>
                    v{h.version}
                  </span>
                  {h.is_active && <span className="text-blue-500 text-xs">● active</span>}
                  <span>{new Date(h.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {h.notes && <span className="text-slate-400 italic truncate max-w-[200px]">{h.notes}</span>}
                  {h.prompt_hash && <span className="font-mono text-slate-300 ml-auto">{h.prompt_hash}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
