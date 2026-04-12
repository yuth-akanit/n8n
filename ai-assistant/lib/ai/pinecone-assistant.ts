/**
 * Pinecone Assistant integration.
 * Queries the managed RAG assistant for document context before each AI call.
 *
 * Env vars:
 *   PINECONE_API_KEY           — API key
 *   PINECONE_ASSISTANT_HOST    — e.g. https://12341-gwmshnl.svc.aped-4627-b74a.pinecone.io
 *   PINECONE_ASSISTANT_NAME    — assistant name (default: n8n)
 */

interface PineconeAssistantResponse {
  message?: { role: string; content: string }
  citations?: Array<{
    position: number
    references?: Array<{ file?: { name: string }; pages?: number[] }>
  }>
  finish_reason?: string
}

/**
 * Query the Pinecone Assistant and return document context as a string.
 * Returns '' if not configured or on any error (graceful degradation).
 */
export async function queryPineconeAssistant(question: string): Promise<string> {
  const apiKey = process.env.PINECONE_API_KEY
  const host = process.env.PINECONE_ASSISTANT_HOST
  const name = process.env.PINECONE_ASSISTANT_NAME ?? 'n8n'

  if (!apiKey || !host) return ''

  try {
    const res = await fetch(`${host}/assistant/chat/${name}`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: question }],
        stream: false,
      }),
      signal: AbortSignal.timeout(15_000), // 15s timeout
    })

    if (!res.ok) {
      console.warn('[pinecone] Assistant query failed:', res.status)
      return ''
    }

    const data = await res.json() as PineconeAssistantResponse
    const content = data.message?.content?.trim()
    if (!content) return ''

    // Format citations if available
    const citationList = (data.citations ?? [])
      .flatMap((c) => c.references ?? [])
      .map((r) => r.file?.name)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i) // unique
      .slice(0, 3)

    const citationText = citationList.length > 0
      ? `\nแหล่งข้อมูล: ${citationList.join(', ')}`
      : ''

    return `[เอกสารภายในที่เกี่ยวข้อง]\n${content}${citationText}`
  } catch (err) {
    console.warn('[pinecone] Assistant error:', err instanceof Error ? err.message : err)
    return ''
  }
}
