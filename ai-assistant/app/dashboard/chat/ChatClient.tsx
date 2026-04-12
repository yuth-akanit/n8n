'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
  attachments?: string[]
  streaming?: boolean
}

interface ChatSession {
  id: string
  title: string
  created_at: string
}

export function ChatClient({ workspaceId: _workspaceId }: { workspaceId: string }) {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const loadSessions = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/ai/chat/sessions')
      const data = await res.json() as { sessions: ChatSession[] }
      setSessions(data.sessions ?? [])
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  const handleOpenHistory = () => {
    setShowHistory(true)
    loadSessions()
  }

  const handleLoadSession = async (sid: string) => {
    setLoadingSession(true)
    try {
      const res = await fetch(`/api/ai/chat/sessions/${sid}`)
      const data = await res.json() as { messages: Array<{ role: string; content: string }> }
      const loaded: Message[] = (data.messages ?? []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
      setMessages(loaded)
      setSessionId(sid)
      setShowHistory(false)
      setError('')
    } catch {
      // ignore
    } finally {
      setLoadingSession(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []))
  }

  const addFiles = (files: File[]) => {
    setAttachments(prev => [...prev, ...files])
    setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const files: File[] = []
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      if (e.clipboardData.items[i].type.startsWith('image/')) {
        const blob = e.clipboardData.items[i].getAsFile()
        if (blob) files.push(blob)
      }
    }
    if (files.length > 0) addFiles(files)
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  function resizeImageToBase64(file: File, maxSize = 800): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img')
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
          else { width = Math.round((width * maxSize) / height); height = maxSize }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('No canvas')); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = url
    })
  }

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() && attachments.length === 0) return
    if (streaming) return

    const currentPrompt = prompt
    const curPreviews = [...previews]
    const curFiles = [...attachments]

    setPrompt('')
    setAttachments([])
    setPreviews([])
    setError('')

    setMessages(prev => [...prev, { role: 'user', content: currentPrompt, attachments: curPreviews }])
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])
    setStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const imageBase64 = await Promise.all(
        curFiles.filter(f => f.type.startsWith('image/')).map(f => resizeImageToBase64(f))
      )

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: currentPrompt || 'อธิบายรูปภาพนี้',
          images: imageBase64,
          sessionId,
        }),
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
          const raw = line.slice(6).trim()
          try {
            const ev = JSON.parse(raw) as { text?: string; done?: boolean; sessionId?: string; error?: string }

            if (ev.error) throw new Error(ev.error)

            if (ev.text) {
              setMessages(prev => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last.role === 'assistant') {
                  next[next.length - 1] = { ...last, content: last.content + ev.text }
                }
                return next
              })
            }

            if (ev.done) {
              if (ev.sessionId) setSessionId(ev.sessionId)
              setMessages(prev => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last.role === 'assistant') {
                  next[next.length - 1] = { ...last, streaming: false }
                }
                return next
              })
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      setMessages(prev => {
        const next = [...prev]
        if (next[next.length - 1]?.streaming) next.pop()
        return next
      })
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [prompt, attachments, previews, sessionId, streaming])

  const handleStop = () => { abortRef.current?.abort() }

  const handleNewChat = () => {
    setMessages([])
    setSessionId(null)
    setError('')
  }

  return (
    <div className="flex h-[calc(100vh-140px)] sm:h-[calc(100vh-100px)] relative">

      {/* History Sidebar */}
      {showHistory && (
        <div className="absolute inset-0 z-20 flex">
          <div className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">ประวัติการสนทนา</span>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8 text-slate-400 text-sm">กำลังโหลด...</div>
              ) : sessions.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-slate-400 text-sm">ยังไม่มีประวัติ</div>
              ) : (
                sessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleLoadSession(s.id)}
                    disabled={loadingSession}
                    className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-colors group ${
                      s.id === sessionId
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <p className="text-xs font-medium truncate leading-snug">{s.title || 'สนทนา'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(s.created_at).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </button>
                ))
              )}
            </div>
            <div className="p-3 border-t border-slate-100">
              <button
                onClick={() => { handleNewChat(); setShowHistory(false) }}
                className="w-full btn-primary text-xs py-2"
              >
                + สนทนาใหม่
              </button>
            </div>
          </div>
          {/* Backdrop */}
          <div className="flex-1 bg-black/10" onClick={() => setShowHistory(false)} />
        </div>
      )}

      {/* Main Chat */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenHistory}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="ประวัติการสนทนา"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-slate-700">AI Chat</span>
            {sessionId && (
              <span className="text-xs text-slate-400 hidden sm:inline">· จำบทสนทนาได้แล้ว</span>
            )}
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100"
            >
              สนทนาใหม่
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="font-bold text-lg text-slate-500">พร้อมช่วยคุณทำงานทุกเรื่องครับ</p>
              <p className="text-sm">พิมพ์ หรือ วางรูปภาพที่นี่ได้เลย...</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%] sm:max-w-[70%] space-y-2">
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className={`flex flex-wrap gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.attachments.map((url, idx) => (
                      <div key={idx} className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200">
                        <Image src={url} alt="Attachment" fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none whitespace-pre-wrap'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                }`}>
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <div className="prose prose-sm prose-slate max-w-none
                      prose-headings:font-semibold prose-headings:text-slate-800
                      prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
                      prose-p:my-1.5 prose-p:leading-relaxed
                      prose-ul:my-1.5 prose-ol:my-1.5
                      prose-li:my-0.5
                      prose-table:text-xs prose-th:bg-slate-50 prose-th:px-2 prose-th:py-1
                      prose-td:px-2 prose-td:py-1 prose-td:border prose-td:border-slate-200
                      prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-code:text-xs
                      prose-pre:bg-slate-900 prose-pre:text-slate-100
                      prose-strong:text-slate-900 prose-a:text-blue-600">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                      {msg.streaming && msg.content === '' && (
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      )}
                      {msg.streaming && msg.content !== '' && (
                        <span className="inline-block w-0.5 h-4 bg-slate-400 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-slate-200 sticky bottom-0">
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 max-w-4xl mx-auto">
              {previews.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                  <Image src={url} alt="Preview" fill className="object-cover" />
                  <button
                    onClick={() => removeAttachment(i)}
                    className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-end gap-2">
            <div className="flex-1 relative bg-slate-50 rounded-2xl border border-slate-200 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all">
              <textarea
                rows={1}
                className="w-full bg-transparent border-none focus:ring-0 px-4 py-3 text-sm resize-none"
                placeholder="ถามอะไรก็ได้ หรือวางรูป..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend(e as unknown as React.FormEvent)
                  }
                }}
                onPaste={handlePaste}
                disabled={streaming}
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />

                {streaming ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="bg-red-100 text-red-600 hover:bg-red-200 transition-colors py-1.5 px-4 rounded-xl text-sm font-medium"
                  >
                    หยุด
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn-primary py-1.5 px-4"
                    disabled={!prompt.trim() && attachments.length === 0}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </form>
          {error && <p className="text-xs text-red-600 mt-2 text-center font-bold">{error}</p>}
        </div>
      </div>
    </div>
  )
}
