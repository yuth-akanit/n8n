'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'

type ImageStyle =
  | 'realistic' | 'illustration' | 'anime' | 'logo' | 'product' | 'ui_mockup'
  | 'watercolor' | 'oil_painting' | 'pixel_art' | 'cinematic' | 'flat_design' | 'sketch'
type ImageSize = 'square' | 'landscape' | 'portrait'

const STYLES: { value: ImageStyle; label: string; desc: string }[] = [
  { value: 'realistic',    label: 'Realistic',     desc: 'ภาพถ่ายสมจริง' },
  { value: 'cinematic',    label: 'Cinematic',     desc: 'ภาพยนตร์, dramatic light' },
  { value: 'illustration', label: 'Illustration',  desc: 'ภาพวาด digital art' },
  { value: 'watercolor',   label: 'Watercolor',    desc: 'สีน้ำ, นุ่มนวล' },
  { value: 'oil_painting', label: 'Oil Painting',  desc: 'สีน้ำมัน, texture หนา' },
  { value: 'sketch',       label: 'Sketch',        desc: 'ดินสอ, ลายเส้น' },
  { value: 'anime',        label: 'Anime',         desc: 'สไตล์อนิเมะ' },
  { value: 'pixel_art',    label: 'Pixel Art',     desc: 'เกม retro 8-bit' },
  { value: 'flat_design',  label: 'Flat Design',   desc: 'ไอคอน, minimal flat' },
  { value: 'logo',         label: 'Logo',          desc: 'โลโก้ minimal' },
  { value: 'product',      label: 'Product',       desc: 'ภาพสินค้า studio' },
  { value: 'ui_mockup',    label: 'UI Mockup',     desc: 'หน้าจอ app/web' },
]

const SIZES: { value: ImageSize; label: string; ratio: string }[] = [
  { value: 'square',    label: 'Square',    ratio: '1:1' },
  { value: 'landscape', label: 'Landscape', ratio: '16:9' },
  { value: 'portrait',  label: 'Portrait',  ratio: '4:3' },
]

const NUM_OPTIONS = [1, 2, 3, 4]

interface GeneratedImage {
  imageUrls: string[]
  artifactIds: string[]
  prompt: string
  style: ImageStyle
  size: ImageSize
  numImages: number
  latency_ms: number
}

interface HistoryItem {
  id: string
  title: string
  content: string // imageUrl
  created_at: string
}

export function ImageClient() {
  const [prompt, setPrompt]       = useState('')
  const [style, setStyle]         = useState<ImageStyle>('realistic')
  const [size, setSize]           = useState<ImageSize>('square')
  const [numImages, setNumImages] = useState(1)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [result, setResult]       = useState<GeneratedImage | null>(null)
  const [selected, setSelected]   = useState(0)
  const [history, setHistory]     = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/artifacts?type=image&limit=40')
      const data = await res.json() as HistoryItem[]
      setHistory(Array.isArray(data) ? data : [])
    } catch {
      // history is best-effort
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => { void loadHistory() }, [loadHistory])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)
    setSelected(0)
    setLoading(true)

    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, size, numImages }),
      })
      const data = await res.json() as GeneratedImage & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setResult(data)
      void loadHistory() // refresh history after new generation
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
        {/* ── Left: controls ──────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          <form onSubmit={handleGenerate} className="space-y-4">

            {/* Style picker */}
            <div className="card p-4">
              <label className="label mb-3">Style</label>
              <div className="grid grid-cols-2 gap-1.5">
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
                    <span className="font-semibold block leading-tight">{s.label}</span>
                    <span className="text-gray-400 text-[10px]">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Size + num images */}
            <div className="card p-4 space-y-4">
              <div>
                <label className="label mb-2">Size</label>
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

              <div>
                <label className="label mb-2">จำนวนรูป</label>
                <div className="grid grid-cols-4 gap-2">
                  {NUM_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNumImages(n)}
                      className={`py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                        numImages === n
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {numImages > 1 && (
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    ใช้เวลานานขึ้นตามจำนวน (~{numImages * 8}–{numImages * 15} วิ)
                  </p>
                )}
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
                ) : `สร้าง${numImages > 1 ? ` ${numImages} รูป` : 'รูป'}`}
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
              <li>• Cinematic → เพิ่ม "golden hour, depth of field"</li>
              <li>• สร้างหลายรูปเพื่อเลือก variation ที่ดีที่สุด</li>
            </ul>
          </div>
        </div>

        {/* ── Right: result ───────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="card p-16 text-center">
              <div className="inline-block w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-500">
                กำลังสร้าง {numImages} รูป อาจใช้เวลา {numImages * 8}–{numImages * 15} วินาที…
              </p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-3">
              {/* Main image */}
              <div className="card overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.imageUrls[selected]}
                  alt={result.prompt}
                  className="w-full object-cover"
                />
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{result.prompt}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {STYLES.find(s => s.value === result.style)?.label} ·{' '}
                        {SIZES.find(s => s.value === result.size)?.label} ·{' '}
                        {result.numImages} รูป · {(result.latency_ms / 1000).toFixed(1)}s
                      </p>
                    </div>
                    <a
                      href={result.imageUrls[selected]}
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

              {/* Thumbnail strip — only shown when numImages > 1 */}
              {result.imageUrls.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {result.imageUrls.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelected(i)}
                      className={`rounded-lg overflow-hidden border-2 transition-colors ${
                        selected === i ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`variation ${i + 1}`} className="w-full aspect-square object-cover" />
                    </button>
                  ))}
                </div>
              )}
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

      {/* ── History gallery ──────────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">ประวัติรูปที่สร้าง</h2>
          {history.length > 0 && (
            <span className="text-xs text-gray-400">{history.length} รูป</span>
          )}
        </div>

        {historyLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
            <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            กำลังโหลด…
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-gray-400 py-4">ยังไม่มีประวัติ — สร้างรูปแรกได้เลย</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setResult({
                    imageUrls: [item.content],
                    artifactIds: [item.id],
                    prompt: item.title,
                    style: 'realistic',
                    size: 'square',
                    numImages: 1,
                    latency_ms: 0,
                  })
                  setSelected(0)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="group relative rounded-lg overflow-hidden aspect-square border border-gray-100 hover:border-blue-400 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.content}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                {/* Hover overlay with prompt */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-end">
                  <p className="text-white text-[10px] leading-tight p-1.5 opacity-0 group-hover:opacity-100 transition-opacity line-clamp-2">
                    {item.title}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
