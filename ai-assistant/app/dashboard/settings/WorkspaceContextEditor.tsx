'use client'

import { useState } from 'react'

interface Props {
  initial: { title: string; content_md: string; is_active: boolean }
}

export function WorkspaceContextEditor({ initial }: Props) {
  const [title, setTitle] = useState(initial.title)
  const [content, setContent] = useState(initial.content_md)
  const [isActive, setIsActive] = useState(initial.is_active)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/workspace/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content_md: content, is_active: isActive }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const charCount = content.length
  const MAX_CHARS = 20000

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          placeholder="Document title (e.g. Brand Guide)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none flex-shrink-0">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Active
        </label>
      </div>

      <div className="relative">
        <textarea
          className="w-full h-64 text-sm font-mono border border-gray-200 rounded-lg px-3 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          placeholder={`เขียน brief หรือ brand guide ที่นี่ เช่น:\n\n# บริษัท PAA\nธุรกิจซ่อมแอร์และเครื่องใช้ไฟฟ้า ทีม 5 คน\n\n## Tone of Voice\n- สุภาพ เป็นมิตร ภาษาไทย\n\n## Target Audience\n- ลูกบ้านในย่านกรุงเทพฯ...`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={MAX_CHARS}
        />
        <span className={`absolute bottom-2 right-3 text-xs ${charCount > MAX_CHARS * 0.9 ? 'text-red-400' : 'text-gray-400'}`}>
          {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'กำลังบันทึก…' : 'บันทึก Context'}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">บันทึกแล้ว ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <p className="text-xs text-gray-400">
        Context นี้จะถูก inject อัตโนมัติใน system prompt ของทุก AI module (Idea, Project, Chat, SEO)
      </p>
    </form>
  )
}
