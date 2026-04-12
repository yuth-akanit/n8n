/**
 * Text embedding generation — used for RAG (semantic artifact search).
 * Uses OpenAI text-embedding-3-small (1536 dims).
 * Returns null silently if no embedding key is configured.
 */

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (process.env.OPENAI_API_KEY) {
    return embedOpenAI(text)
  }
  // No supported embedding provider available
  return null
}

async function embedOpenAI(text: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // model limit
      }),
    })
    if (!res.ok) {
      console.warn('[embed] OpenAI embedding failed:', res.status)
      return null
    }
    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0]?.embedding ?? null
  } catch (err) {
    console.warn('[embed] OpenAI embedding error:', err)
    return null
  }
}
