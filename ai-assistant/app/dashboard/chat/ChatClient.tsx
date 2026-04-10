'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function ChatClient({ workspaceId }: { workspaceId: string }) {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim()) return

    const newPrompt = prompt
    setPrompt('')
    setError('')
    setMessages(prev => [...prev, { role: 'user', content: newPrompt }])
    setLoading(true)

    // Optional context could be previous messages, but keeping it simple for MVP
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          prompt: newPrompt,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Chat failed')
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <PageHeader
        title="AI Chat"
        description="ถาม-ตอบได้ทุกเรื่องบนโลกและนอกโลก"
      />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p>👋 สวัสดีครับ มีอะไรให้ผมช่วยไหมครับ?</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-xl shadow-sm text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'}`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 p-4 rounded-xl rounded-bl-none shadow-sm">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="ถามอะไรก็ได้..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading || !prompt.trim()}>
            {loading ? 'กำลังพิมพ์...' : 'ส่ง'}
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2 text-center">{error}</p>}
      </div>
    </div>
  )
}
