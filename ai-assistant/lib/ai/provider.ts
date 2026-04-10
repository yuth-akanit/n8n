/**
 * AI provider abstraction.
 * Falls back to deterministic mock responses when no API key is configured.
 */

export type AiProvider = 'anthropic' | 'openai' | 'gemini' | 'together' | 'kie' | 'mock'

export interface AiCallResult {
  content: string
  provider: AiProvider
  model: string
  latency_ms: number
}

function getProvider(): AiProvider {
  const selected = process.env.AI_PROVIDER
  if (selected === 'mock') return 'mock'
  if (selected === 'openai' && process.env.OPENAI_API_KEY) return 'openai'
  if (selected === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini'
  if (selected === 'together' && process.env.TOGETHER_API_KEY) return 'together'
  if (selected === 'kie' && process.env.KIE_API_KEY) return 'kie'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.GEMINI_API_KEY) return 'gemini'
  return 'mock'
}

async function callOpenAiCompatible(
  prompt: string, 
  systemPrompt: string, 
  apiKey: string, 
  baseUrl: string, 
  model: string, 
  providerName: AiProvider
): Promise<AiCallResult> {
  const start = Date.now()
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    })
  })
  
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`${providerName} API error ${response.status}: ${err}`)
  }
  
  const data = await response.json()
  const content = data.choices[0]?.message?.content ?? ''
  return { content, provider: providerName, model, latency_ms: Date.now() - start }
}

async function callAnthropic(prompt: string, systemPrompt: string): Promise<AiCallResult> {
  const start = Date.now()
  const model = 'claude-sonnet-4-6'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${err}`)
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>
  }
  const content = data.content.find((c) => c.type === 'text')?.text ?? ''

  return { content, provider: 'anthropic', model, latency_ms: Date.now() - start }
}

async function callMock(promptKey: string): Promise<AiCallResult> {
  // Return deterministic mock based on prompt key prefix
  await new Promise((r) => setTimeout(r, 200)) // simulate latency

  const mocks: Record<string, string> = {
    ideas: MOCK_IDEAS_RESPONSE,
    project: MOCK_PROJECT_RESPONSE,
    builder: MOCK_BUILDER_RESPONSE,
    seo: MOCK_SEO_RESPONSE,
    chat: 'สวัสดีครับ ผมคือ AI ของคุณ สามารถถามตอบได้ทุกเรื่องเลยครับ (ระบบตอนรันบน Mock Mode)'
  }

  const key = Object.keys(mocks).find((k) => promptKey.startsWith(k)) ?? 'ideas'
  return {
    content: mocks[key] ?? mocks['ideas'],
    provider: 'mock',
    model: 'mock-v1',
    latency_ms: 200,
  }
}

async function callOpenAI(prompt: string, systemPrompt: string, images?: string[]): Promise<AiCallResult> {
  const start = Date.now()
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o'

  const userContent: any[] = [{ type: 'text', text: prompt }]
  if (images && images.length > 0) {
    images.forEach(img => {
      userContent.push({
        type: 'image_url',
        image_url: { url: img }
      })
    })
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${err}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }
  const content = data.choices[0]?.message?.content ?? ''

  return { content, provider: 'openai', model, latency_ms: Date.now() - start }
}

async function callGemini(prompt: string, systemPrompt: string): Promise<AiCallResult> {
  const start = Date.now()
  const model = process.env.GEMINI_MODEL ?? 'gemini-1.5-pro'
  const apiKey = process.env.GEMINI_API_KEY

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const data = await response.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  const content = data.candidates[0]?.content?.parts[0]?.text ?? ''

  return { content, provider: 'gemini', model, latency_ms: Date.now() - start }
}

export async function runAiPrompt(
  promptKey: string,
  userPrompt: string,
  systemPrompt: string,
  images?: string[] // Base64 image strings
): Promise<AiCallResult> {
  const provider = getProvider()
  
  if (provider === 'openai') return callOpenAI(userPrompt, systemPrompt, images)
  if (provider === 'gemini') return callGemini(userPrompt, systemPrompt, images)
  if (provider === 'anthropic') return callAnthropic(userPrompt, systemPrompt, images)

  if (provider === 'together') {
    return callOpenAiCompatible(
      userPrompt, systemPrompt, 
      process.env.TOGETHER_API_KEY!, 
      'https://api.together.xyz/v1', 
      process.env.TOGETHER_MODEL || 'meta-llama/Llama-2-70b-chat-hf', 
      'together'
    )
  }
  
  if (provider === 'kie') {
    return callOpenAiCompatible(
      userPrompt, systemPrompt, 
      process.env.KIE_API_KEY!, 
      process.env.KIE_BASE_URL || 'https://api.kie.ai/v1', 
      process.env.KIE_MODEL || 'llama-3', 
      'kie'
    )
  }
  return callMock(promptKey)
}

// ============================================================
// Mock responses (used when no AI key is set)
// ============================================================

const MOCK_IDEAS_RESPONSE = JSON.stringify({
  ideas: [
    {
      title: 'Automated Customer Follow-Up System',
      brief: 'Build an automated SMS/email follow-up workflow triggered after service visits',
      audience: 'Service team managers',
      problem: 'Manual follow-ups are inconsistent and time-consuming',
      solution: 'n8n workflow that sends follow-up messages 24h after job completion',
      channel: ['email', 'sms'],
      score_impact: 8,
      score_ease: 7,
      score_roi: 9,
    },
    {
      title: 'Service Job Dashboard',
      brief: 'A real-time internal dashboard showing active jobs, technician status, and revenue',
      audience: 'Operations manager',
      problem: 'No single view of daily operations',
      solution: 'Next.js dashboard pulling from existing job management data',
      channel: ['web'],
      score_impact: 9,
      score_ease: 6,
      score_roi: 8,
    },
    {
      title: 'Review Request Automation',
      brief: 'Automatically request Google/Facebook reviews after completed jobs',
      audience: 'Marketing team',
      problem: 'Review collection is ad-hoc and low-volume',
      solution: 'Triggered review request via WhatsApp or SMS after job close',
      channel: ['whatsapp', 'sms'],
      score_impact: 7,
      score_ease: 8,
      score_roi: 9,
    },
  ],
})

const MOCK_PROJECT_RESPONSE = JSON.stringify({
  summary: 'A phased implementation plan broken into discovery, build, and launch milestones.',
  milestones: [
    {
      title: 'Discovery & Planning',
      description: 'Define requirements, data model, and architecture',
      sort_order: 1,
      tasks: [
        { title: 'Stakeholder requirements gathering', task_type: 'research', priority: 'high', estimate_hours: 4, description: 'Interview team leads to capture must-haves' },
        { title: 'Write project spec', task_type: 'planning', priority: 'high', estimate_hours: 3, description: 'Document goals, scope, and out-of-scope items' },
        { title: 'Design database schema', task_type: 'backend', priority: 'high', estimate_hours: 2, description: 'Define tables and relationships in SQL' },
      ],
    },
    {
      title: 'Core Build',
      description: 'Implement the main features',
      sort_order: 2,
      tasks: [
        { title: 'Set up project repo and CI', task_type: 'deploy', priority: 'high', estimate_hours: 2, description: 'GitHub repo, branch strategy, and basic CI pipeline' },
        { title: 'Implement API endpoints', task_type: 'backend', priority: 'high', estimate_hours: 8, description: 'CRUD endpoints for core resources' },
        { title: 'Build UI screens', task_type: 'frontend', priority: 'medium', estimate_hours: 12, description: 'List, detail, and form pages' },
      ],
    },
    {
      title: 'QA & Launch',
      description: 'Test, fix bugs, and deploy',
      sort_order: 3,
      tasks: [
        { title: 'QA testing', task_type: 'qa', priority: 'high', estimate_hours: 4, description: 'Manual testing of all flows' },
        { title: 'Deploy to production', task_type: 'deploy', priority: 'critical', estimate_hours: 2, description: 'Deploy to hosting provider and configure env' },
      ],
    },
  ],
  docs: [
    {
      doc_type: 'brief',
      title: 'Project Brief',
      content_md: '# Project Brief\n\n## Goal\nDeliver a working MVP within 4 weeks.\n\n## Scope\n- Core feature set only\n- Internal users only\n\n## Out of Scope\n- Mobile app\n- Third-party integrations (phase 2)',
    },
    {
      doc_type: 'spec',
      title: 'Technical Specification',
      content_md: '# Technical Spec\n\n## Stack\n- Next.js 14 (App Router)\n- Supabase (Postgres + Auth)\n- Tailwind CSS\n\n## Architecture\n- Server Components for data fetching\n- Route Handlers for mutations\n- RLS-enforced data access',
    },
  ],
})

const MOCK_BUILDER_RESPONSE = `# Generated Output

\`\`\`typescript
// Auto-generated scaffold — review before use

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('your_table')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('your_table')
    .insert(body)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
\`\`\`

> **Note:** Replace \`your_table\` with the actual table name and add proper validation.`

const MOCK_SEO_RESPONSE = `This page has moderate SEO health. The title tag is present but could be more descriptive and include the primary keyword. The meta description is missing, which reduces click-through rates from search results. The H1 is present and matches the page topic. Content depth is adequate at ~800 words but could benefit from more specific examples and internal links to related service pages.

**Priority Actions:**
1. Add a meta description (150-160 characters, include primary keyword)
2. Strengthen the title tag with location + service keyword
3. Add 2-3 internal links to related pages
4. Include a clear call-to-action above the fold`
