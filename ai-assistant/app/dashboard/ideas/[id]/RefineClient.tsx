'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

export function RefineClient({ ideaId }: { ideaId: string }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || streaming) return

    const current = prompt
    setPrompt('')
    setError('')
    setMessages(prev => [...prev, { role: 'user', content: current }])
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])
    setStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch(`/api/ai/ideas/${ideaId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: current, sessionId }),
        signal: abort.signal,
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6)) as { text?: string; done?: boolean; sessionId?: string; error?: string }
            if (ev.error) throw new Error(ev.error)
            if (ev.text) {
              setMessages(prev => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + ev.text }
                return next
              })
            }
            if (ev.done) {
              if (ev.sessionId) setSessionId(ev.sessionId)
              setMessages(prev => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last?.role === 'assistant') next[next.length - 1] = { ...last, streaming: false }
                return next
              })
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.name !== 'SyntaxError') throw parseErr
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setMessages(prev => {
        const next = [...prev]
        if (next[next.length - 1]?.streaming) next.pop()
        return next
      })
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [prompt, streaming, sessionId, ideaId])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        ปรับปรุง / สนทนากับ Idea นี้
      </button>
    )
  }

  return (
    <div className="card border border-blue-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-blue-50">
        <span className="text-sm font-semibold text-blue-700">ปรับปรุง Idea</span>
        <div className="flex items-center gap-2">
          {sessionId && <span className="text-xs text-blue-400">· จำบทสนทนา</span>}
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-4 space-y-3 bg-white">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 text-xs py-8">
            ลองถามว่า "ขยาย solution ให้ละเอียดขึ้น" หรือ "เพิ่ม risk analysis"
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-none whitespace-pre-wrap'
                : 'bg-slate-100 text-slate-800 rounded-bl-none'
            }`}>
              {msg.role === 'user' ? msg.content : (
                <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:text-sm prose-headings:font-semibold prose-table:text-xs prose-code:text-xs prose-code:bg-white prose-code:px-1 prose-code:rounded">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              )}
              {msg.streaming && msg.content === '' && (
                <span className="inline-flex gap-1">
                  <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
              {msg.streaming && msg.content !== '' && (
                <span className="inline-block w-0.5 h-3.5 bg-slate-400 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 px-3 py-2 bg-white">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="ถามหรือขอปรับ idea..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={streaming}
          />
          {streaming ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="px-3 py-2 bg-red-100 text-red-600 rounded-xl text-xs font-medium hover:bg-red-200 transition-colors">
              หยุด
            </button>
          ) : (
            <button type="submit" className="btn-primary py-2 px-3" disabled={!prompt.trim()}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          )}
        </form>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    </div>
  )
}
