/**
 * Builder Intent Gate — classifies user input before generating an artifact.
 *
 * If the input is a vague business/marketing goal rather than a concrete
 * technical request, we block direct generation and return 2–4 guided
 * artifact options instead of hallucinating a spec.
 *
 * Intent taxonomy:
 *   business_strategy  — vague goal / growth / marketing / non-specific
 *   technical_spec     — feature design, system/module spec
 *   sql_schema         — database tables, migrations, ERD
 *   api_contract       — REST/RPC endpoints, request/response shape
 *   ui_plan            — screen layout, component structure
 *   code_generation    — actual code, patches, scripts
 */
import { runAiPrompt } from './provider'
import type { BuilderMode } from '@/types'

export type BuilderIntent =
  | 'business_strategy'
  | 'technical_spec'
  | 'sql_schema'
  | 'api_contract'
  | 'ui_plan'
  | 'code_generation'

export interface ClarificationOption {
  label: string
  mode: BuilderMode
  prompt: string
}

export interface IntentClassification {
  intent: BuilderIntent
  needs_gate: boolean
  message: string
  options: ClarificationOption[]
}

const CLASSIFIER_SYSTEM = `You are an intent classifier for a technical artifact builder.

Classify the user's request into one of these intents:
- business_strategy: vague business goal, marketing idea, growth request, or anything that does NOT specify a concrete system/feature/artifact to build (e.g. "ช่วยเพิ่มยอดขาย", "หาลูกค้าใหม่")
- technical_spec: design a feature, module, flow, or system spec
- sql_schema: database tables, columns, migrations, indexes
- api_contract: REST/RPC endpoints, request and response shapes
- ui_plan: screen layout, component structure, UX flow
- code_generation: write actual code, script, patch

Respond ONLY with valid JSON, no preamble, no code fences:
{
  "intent": "<one of the 6 above>",
  "needs_gate": <true if business_strategy, false otherwise>,
  "message": "<if needs_gate: 1 sentence Thai explaining we need to pick an artifact type. If not needs_gate: empty string>",
  "options": [
    // Only include if needs_gate = true.
    // Generate 3-4 concrete technical artifacts derived from the user's business goal.
    // Each option should be specific enough to generate an artifact immediately.
    {
      "label": "<short Thai label e.g. 'สร้าง Feature Spec'>",
      "mode": "<spec|sql|api|ui|code_patch>",
      "prompt": "<a specific, technical rewrite of the user's input suitable for that mode>"
    }
  ]
}`

function extractJson(text: string): string {
  const fenced = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  if (fenced.startsWith('{')) return fenced
  const match = text.match(/\{[\s\S]*\}/)
  return match ? match[0] : text.trim()
}

/**
 * Classify a builder prompt and, if it is a vague business goal,
 * return guided artifact options instead of generating directly.
 */
export async function classifyBuilderIntent(
  prompt: string
): Promise<IntentClassification> {
  // Lightweight call — using a compact user message
  const userMsg = `User input:\n"${prompt.slice(0, 800)}"`

  try {
    const result = await runAiPrompt('builder', userMsg, CLASSIFIER_SYSTEM)
    const parsed = JSON.parse(extractJson(result.content)) as IntentClassification

    // Normalise — guarantee required fields exist
    return {
      intent: parsed.intent ?? 'technical_spec',
      needs_gate: !!parsed.needs_gate,
      message: parsed.message ?? '',
      options: Array.isArray(parsed.options) ? parsed.options : [],
    }
  } catch {
    // On classifier failure, allow generation to proceed (fail open)
    return { intent: 'technical_spec', needs_gate: false, message: '', options: [] }
  }
}
