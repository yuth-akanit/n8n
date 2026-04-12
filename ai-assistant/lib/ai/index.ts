/**
 * AI module entry point — public functions used by API routes.
 */
import { runAiPrompt, streamAiChat, type AiCallResult, type ChatMessage } from './provider'
import { SYSTEM_PROMPTS, USER_PROMPTS } from './prompts'
import type { BuilderMode, GeneratedIdea, GeneratedMilestone, GeneratedDoc } from '@/types'

export type { ChatMessage }

/** Strip markdown code fences that some models add around JSON output */
function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
}

export interface IdeaRunResult extends AiCallResult {
  ideas: GeneratedIdea[]
}

export async function runIdeaPrompt(
  prompt: string,
  constraints?: string
): Promise<IdeaRunResult> {
  const result = await runAiPrompt(
    'ideas',
    USER_PROMPTS.ideas(prompt, constraints),
    SYSTEM_PROMPTS.ideas
  )

  let ideas: GeneratedIdea[] = []
  try {
    const parsed = JSON.parse(stripCodeFences(result.content)) as { ideas: GeneratedIdea[] }
    ideas = parsed.ideas ?? []
  } catch {
    // If AI didn't return valid JSON, wrap in a single idea
    ideas = [{
      title: 'Generated Idea',
      brief: result.content.slice(0, 200),
      audience: 'Internal team',
      problem: 'See brief',
      solution: 'See brief',
      channel: [],
      score_impact: 5,
      score_ease: 5,
      score_roi: 5,
    }]
  }

  return { ...result, ideas }
}

export interface ProjectPlanResult extends AiCallResult {
  summary: string
  milestones: GeneratedMilestone[]
  docs: GeneratedDoc[]
}

export async function runProjectPlannerPrompt(
  goal: string,
  scope?: string
): Promise<ProjectPlanResult> {
  const result = await runAiPrompt(
    'project',
    USER_PROMPTS.project(goal, scope),
    SYSTEM_PROMPTS.project
  )

  let summary = ''
  let milestones: GeneratedMilestone[] = []
  let docs: GeneratedDoc[] = []

  try {
    const parsed = JSON.parse(stripCodeFences(result.content)) as {
      summary?: string
      milestones?: GeneratedMilestone[]
      docs?: GeneratedDoc[]
    }
    summary = parsed.summary ?? ''
    milestones = parsed.milestones ?? []
    docs = parsed.docs ?? []
  } catch {
    summary = result.content.slice(0, 500)
  }

  return { ...result, summary, milestones, docs }
}

export interface BuilderResult extends AiCallResult {
  title: string
}

export async function runBuilderPrompt(
  mode: BuilderMode,
  prompt: string
): Promise<BuilderResult> {
  const result = await runAiPrompt(
    'builder',
    USER_PROMPTS.builder(mode, prompt),
    SYSTEM_PROMPTS.builder
  )

  const titles: Record<BuilderMode, string> = {
    spec: 'Technical Specification',
    sql: 'SQL Schema',
    api: 'API Contract',
    ui: 'UI Plan',
    code_patch: 'Code Patch',
  }

  return { ...result, title: titles[mode] }
}

export interface SeoSummaryResult extends AiCallResult {
  summary: string
}

export async function runSeoSummaryPrompt(
  pageData: Record<string, unknown>,
  issues: Array<{ issue_type: string; message: string }>,
  competitorContext?: string
): Promise<SeoSummaryResult> {
  const result = await runAiPrompt(
    'seo',
    USER_PROMPTS.seo(pageData, issues, competitorContext),
    SYSTEM_PROMPTS.seo
  )
  return { ...result, summary: result.content }
}

export interface SeoPatchSuggestResult extends AiCallResult {
  patches: Array<{
    patch_type: string
    before: string
    after: string
    reason: string
  }>
}

export async function runSeoPatchPrompt(
  pageData: Record<string, unknown>,
  issues: Array<{ issue_type: string; message: string }>
): Promise<SeoPatchSuggestResult> {
  const result = await runAiPrompt(
    'seo_patch',
    USER_PROMPTS.seoPatch(pageData, issues),
    SYSTEM_PROMPTS.seo
  )

  let patches: SeoPatchSuggestResult['patches'] = []
  try {
    const parsed = JSON.parse(stripCodeFences(result.content)) as { patches: typeof patches }
    patches = parsed.patches ?? []
  } catch {
    patches = []
  }

  return { ...result, patches }
}

export interface ChatResult extends AiCallResult {}

export async function runChatPrompt(
  prompt: string,
  context?: string,
  images?: string[]
): Promise<ChatResult> {
  const result = await runAiPrompt(
    'chat',
    USER_PROMPTS.chat(prompt, context),
    SYSTEM_PROMPTS.chat,
    images
  )
  return result
}

const TAG_CANDIDATES = [
  'marketing', 'automation', 'ai', 'analytics', 'content', 'customer',
  'review', 'social', 'email', 'seo', 'internal', 'data', 'mobile',
  'web', 'reporting', 'ux', 'operations', 'sales', 'crm', 'workflow',
]

/**
 * Auto-classify text into 3–5 tags.
 * Runs fast — uses the smallest available model.
 * Returns [] on any failure so callers can proceed without blocking.
 */
export async function runTagPrompt(text: string): Promise<string[]> {
  try {
    const result = await runAiPrompt(
      'ideas',
      `Choose 3-5 tags from this list: ${TAG_CANDIDATES.join(', ')}\n\nContent:\n${text.slice(0, 400)}\n\nReturn raw JSON only: {"tags":["tag1","tag2"]}`,
      'You are a content classifier. Return raw JSON only, no explanation, no code fences.'
    )
    const parsed = JSON.parse(stripCodeFences(result.content)) as { tags?: string[] }
    return (parsed.tags ?? []).filter((t) => TAG_CANDIDATES.includes(t)).slice(0, 5)
  } catch {
    return []
  }
}

/** Stream a multi-turn chat, yielding text tokens as they arrive */
export async function* streamChat(
  messages: ChatMessage[],
  context?: string,
  images?: string[]
): AsyncGenerator<string> {
  const systemPrompt = context
    ? `${SYSTEM_PROMPTS.chat}\n\nContext:\n${context}`
    : SYSTEM_PROMPTS.chat
  yield* streamAiChat(messages, systemPrompt, images)
}
