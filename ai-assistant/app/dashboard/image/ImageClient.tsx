'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'

type ImageStyle = 'realistic' | 'illustration' | 'anime' | 'logo' | 'product' | 'ui_mockup'
type ImageSize = 'square' | 'landscape' | 'portrait'

const STYLES: { value: ImageStyle; label: string; desc: string }[] = [
  { value: 'realistic',    label: 'Realistic',      desc: 'ภาพถ่ายสมจริง' },
  { value: 'illustration', label: 'Illustration',   desc: 'ภาพวาด digital art' },
  { value: 'anime',        label: 'Anime',          desc: 'สไตล์อนิเมะ' },
  { value: 'logo',         label: 'Logo',           desc: 'โลโก้ minimal' },
  { value: 'product',      label: 'Product',        desc: 'ภาพสินค้า studio' },
  { value: 'ui_mockup',    label: 'UI Mockup',      desc: 'หน้าจอ app/web' },
]

const SIZES: { value: ImageSize; label: string; ratio: string }[] = [
  { value: 'square',    label: 'Square',    ratio: '1:1' },
  { value: 'landscape', label: 'Landscape', ratio: '16:9' },
  { value: 'portrait',  label: 'Portrait',  ratio: '4:3' },
]

interface GeneratedImage {
  imageUrl: string
  artifactId: string
  prompt: string
  style: ImageStyle
  size: ImageSize
  latency_ms: number
}

export function ImageClient() {
  const [prompt, setPrompt]   = useState('')
  const [style, setStyle]     = useState<ImageStyle>('realistic')
  const [size, setSize]       = useState<ImageSize>('square')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [result, setResult]   = useState<GeneratedImage | null>(null)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, size }),
      })
      const data = await res.json() as GeneratedImage & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Image Studio"
        description="สร้างรูปภาพจาก text prompt — รองรับหลาย style และขนาด"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: controls */}
        <div className="lg:col-span-1 space-y-4">
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Style picker */}
            <div className="card p-4">
              <label className="label mb-3">Style</label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStyle(s.value)}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                      style === s.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-semibold block">{s.label}</span>
                    <span className="text-gray-400 text-[10px]">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Size picker */}
            <div className="card p-4">
              <label className="label mb-3">Size</label>
              <div className="grid grid-cols-3 gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSize(s.value)}
                    className={`p-2 rounded-lg border text-center text-xs font-medium transition-colors ${
                      size === s.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span className="block font-semibold">{s.label}</span>
                    <span className="text-gray-400 text-[10px]">{s.ratio}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div className="card p-4 space-y-3">
              <div>
                <label className="label">Prompt</label>
                <textarea
                  className="input text-sm"
                  rows={4}
                  placeholder="อธิบายรูปที่ต้องการ เช่น 'ช่างแอร์กำลังซ่อมเครื่องบนหลังคา พระอาทิตย์ตก'"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{prompt.length}/1000</p>
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading || !prompt.trim()}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังสร้างรูป…
                  </span>
                ) : 'สร้างรูป'}
              </button>
            </div>
          </form>

          {/* Tips */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">เคล็ดลับ prompt</p>
            <ul className="space-y-1.5 text-xs text-gray-500">
              <li>• ระบุ subject ชัดเจน เช่น "ช่างแอร์, อาคาร, เครื่องมือ"</li>
              <li>• เพิ่ม mood เช่น "สว่าง, สดชื่น, มืออาชีพ"</li>
              <li>• Logo → ใส่ชื่อแบรนด์ + สีหลัก</li>
              <li>• UI Mockup → ระบุ screen หรือ feature ที่ต้องการ</li>
            </ul>
          </div>
        </div>

        {/* Right: result */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="card p-16 text-center">
              <div className="inline-block w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-500">กำลังสร้างรูป อาจใช้เวลา 5–15 วินาที…</p>
            </div>
          )}

          {result && !loading && (
            <div className="card overflow-hidden">
              {/* Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.imageUrl}
                alt={result.prompt}
                className="w-full object-cover"
              />

              {/* Meta + actions */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{result.prompt}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {STYLES.find(s => s.value === result.style)?.label} ·{' '}
                      {SIZES.find(s => s.value === result.size)?.label} ·{' '}
                      {(result.latency_ms / 1000).toFixed(1)}s
                    </p>
                  </div>
                  <a
                    href={result.imageUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 btn-primary text-xs py-1.5 px-3"
                  >
                    ดาวน์โหลด
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPrompt(result.prompt)
                    setStyle(result.style)
                    setSize(result.size)
                    setResult(null)
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                >
                  สร้างใหม่จาก prompt นี้
                </button>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="card p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">รูปที่สร้างจะแสดงที่นี่</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
