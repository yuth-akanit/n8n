/**
 * AI provider abstraction.
 * Falls back to deterministic mock responses when no API key is configured.
 */

export type AiProvider = 'anthropic' | 'mock'

export interface AiCallResult {
  content: string
  provider: AiProvider
  model: string
  latency_ms: number
}

function getProvider(): AiProvider {
  if (process.env.ANTHROPIC_API_KEY && process.env.AI_PROVIDER !== 'mock') {
    return 'anthropic'
  }
  return 'mock'
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
  }

  const key = Object.keys(mocks).find((k) => promptKey.startsWith(k)) ?? 'ideas'
  return {
    content: mocks[key] ?? mocks['ideas'],
    provider: 'mock',
    model: 'mock-v1',
    latency_ms: 200,
  }
}

export async function runAiPrompt(
  promptKey: string,
  userPrompt: string,
  systemPrompt: string
): Promise<AiCallResult> {
  const provider = getProvider()
  if (provider === 'anthropic') {
    return callAnthropic(userPrompt, systemPrompt)
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
