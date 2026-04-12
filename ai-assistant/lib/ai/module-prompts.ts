/**
 * Module-specific system prompt system.
 *
 * Fallback chain (per request):
 *   1. DB: active row for (workspace_id, module_key)
 *   2. Hardcoded module default (code-level, not editable from UI)
 *
 * Every save inserts a NEW row with version+1. The previous active row is
 * deactivated in the same transaction. This makes rollback and history trivial.
 *
 * In-memory cache (TTL 60s) to avoid a DB round-trip per request.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export type ModulePromptKey =
  | 'idea_module_prompt'
  | 'builder_module_prompt'
  | 'seo_module_prompt'
  | 'chat_module_prompt'

export const MODULE_KEYS: ModulePromptKey[] = [
  'idea_module_prompt',
  'builder_module_prompt',
  'seo_module_prompt',
  'chat_module_prompt',
]

export const MODULE_LABELS: Record<ModulePromptKey, string> = {
  idea_module_prompt: 'Idea Lab',
  builder_module_prompt: 'Builder Studio',
  seo_module_prompt: 'SEO Doctor',
  chat_module_prompt: 'AI Chat',
}

// ─── Hardcoded defaults — fallback only, NOT editable from UI ─────────────────
export const DEFAULT_MODULE_PROMPTS: Record<ModulePromptKey, string> = {
  idea_module_prompt: `# Idea Module Prompt

หน้าที่ของคุณคือช่วยคิดไอเดียธุรกิจ โปรเจกต์ แคมเปญ หรือ automation ที่เหมาะกับ PAA Air Service และธุรกิจบริการใกล้เคียง

หลักการ:
- เน้นไอเดียที่ทำได้จริงในบริบท SME service business
- เน้น ROI และโอกาสใช้งานจริง
- ให้ความสำคัญกับการเพิ่มยอดขาย ลดงาน manual และเพิ่ม conversion
- หลีกเลี่ยงไอเดียที่สวยแต่ทำจริงยาก
- ถ้าไอเดียไม่คุ้ม หรือเร็วเกินไป ให้พูดตรง ๆ

วิธีตอบ:
- เสนอเป็นข้อสั้น กระชับ
- ระบุว่าอะไรคือ quick win / mid-term / long-term เมื่อเหมาะสม
- บอกข้อดี ข้อเสีย ความเสี่ยง และความคุ้มค่า
- ให้ลำดับความสำคัญชัดเจน
- ถ้าเป็นไปได้ ให้เสนอ MVP ก่อน version ใหญ่`,

  builder_module_prompt: `# Builder Module Prompt

หน้าที่ของคุณคือช่วยออกแบบและสร้าง solution ทางเทคนิคที่พร้อมใช้งานจริงสำหรับระบบของ PAA Air Service

หลักการ:
- เน้น production-ready output
- ใช้ stack หลักของระบบก่อน: n8n, Supabase, Google Sheets, Apps Script, Docker, Next.js
- ให้ความสำคัญกับ simplicity, maintainability, observability, และ data integrity
- หลีกเลี่ยงการ redesign ระบบหลักโดยไม่จำเป็น
- ไม่เดา schema หรือ contract ถ้ายังไม่มีข้อมูลยืนยัน

เมื่อเขียนคำตอบ:
- ถ้าเป็น workflow ให้แยก input -> process -> output
- ถ้าเป็น SQL ให้คำนึงถึง constraints, indexes, validation, RPC contracts, and edge cases
- ถ้าเป็น code ให้มี error handling และ comments ที่พอเหมาะ
- ถ้าเป็น API / JSON contract ให้ตอบในรูปแบบที่เอาไปใช้ต่อได้
- ถ้ามี assumption ให้ระบุชัดเจน
- ถ้ามี risk ต่อ production ให้เตือนก่อน`,

  seo_module_prompt: `# SEO Module Prompt

หน้าที่ของคุณคือช่วยวิเคราะห์ SEO และเสนอแนวทางแก้ไขที่เหมาะกับธุรกิจบริการท้องถิ่นของไทย โดยเฉพาะ PAA Air Service

หลักการ:
- เน้น local SEO, search intent, conversion, trust, clarity
- เน้นคำแนะนำที่ส่งผลต่อการปิดงาน ไม่ใช่แค่เพิ่ม traffic
- หลีกเลี่ยง generic SEO advice ที่ใช้ได้กับทุกเว็บ
- หลีกเลี่ยง spammy tactics หรือ content fluff

เมื่อเขียนคำตอบ:
- จัดลำดับตาม impact ก่อน
- แยก quick fixes กับ structural fixes
- ถ้าเขียน title / meta / content ให้กระชับ ชัด และเหมาะกับลูกค้าไทย
- ถ้าเสนอ SEO patch ให้ระบุเหตุผลและ expected impact
- ถ้าข้อมูลหน้าเว็บไม่พอ ให้บอกข้อจำกัดให้ชัด`,

  chat_module_prompt: `# Chat Module Prompt

หน้าที่ของคุณคือเป็นผู้ช่วยหลักของ PAA Air Service สำหรับการคิดงาน วางแผนธุรกิจ วิเคราะห์ปัญหา สรุปข้อมูล และช่วยตัดสินใจ

หลักการ:
- ตอบให้ practical และนำไปใช้ต่อได้จริง
- ใช้บริบทธุรกิจของ PAA Air Service เป็นฐาน
- ถ้าคำถามเกี่ยวกับธุรกิจ ระบบ งานช่าง การตลาด หรือ automation ให้ตอบแบบเน้น execution
- ถ้าข้อมูลไม่พอ ให้ระบุ assumption แทนการเดา
- ถ้าแนวคิดใดเสี่ยง เกินจริง หรือไม่คุ้ม ให้พูดตรง ๆ

เมื่อเขียนคำตอบ:
- เริ่มจาก TL;DR
- แตกขั้นตอนแบบชัดเจน
- ให้ตัวอย่างเมื่อจำเป็น
- จบด้วย next steps ที่ทำต่อได้

สิ่งที่ต้องหลีกเลี่ยง:
- ตอบกว้างเกินไป
- ตอบสวยแต่ไม่มี action
- เดา fact ที่ไม่มีหลักฐาน`,
}

// ─── In-memory cache (60s TTL) ───────────────────────────────────────────────
interface CacheEntry {
  text: string
  version: number
  source: 'db' | 'hardcoded'
  expiresAt: number
}

const _cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000

function cacheKey(workspaceId: string, key: ModulePromptKey) {
  return `${workspaceId}::${key}`
}

export function invalidatePromptCache(workspaceId: string, key: ModulePromptKey) {
  _cache.delete(cacheKey(workspaceId, key))
}

// ─── Validation ──────────────────────────────────────────────────────────────
export interface PromptValidationResult {
  ok: boolean
  error?: string
}

export function validatePromptText(text: string): PromptValidationResult {
  const t = text.trim()
  if (!t) return { ok: false, error: 'Prompt text must not be empty' }
  if (t.length < 20) return { ok: false, error: 'Prompt text is too short (min 20 chars)' }
  if (t.length > 20_000) return { ok: false, error: 'Prompt text too long (max 20,000 chars)' }
  return { ok: true }
}

export function hashPrompt(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex').slice(0, 16)
}

// ─── DB access ───────────────────────────────────────────────────────────────

export interface WorkspacePromptRow {
  id: string
  module_key: ModulePromptKey
  prompt_text: string
  version: number
  is_active: boolean
  is_default: boolean
  status: string
  prompt_hash: string | null
  notes: string | null
  created_at: string
}

/**
 * Get the active prompt for a module.
 * Returns { text, version, source } — source is 'db' or 'hardcoded'.
 */
export async function getModulePrompt(
  supabase: SupabaseClient,
  workspaceId: string,
  key: ModulePromptKey
): Promise<{ text: string; version: number; source: 'db' | 'hardcoded' }> {
  const ck = cacheKey(workspaceId, key)
  const cached = _cache.get(ck)
  if (cached && cached.expiresAt > Date.now()) {
    return { text: cached.text, version: cached.version, source: cached.source }
  }

  const { data } = await supabase
    .from('workspace_prompts')
    .select('prompt_text, version')
    .eq('workspace_id', workspaceId)
    .eq('module_key', key)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const source = data ? 'db' : 'hardcoded'
  const text = data?.prompt_text?.trim() || DEFAULT_MODULE_PROMPTS[key]
  const version = data?.version ?? 0

  _cache.set(ck, { text, version, source, expiresAt: Date.now() + CACHE_TTL_MS })
  return { text, version, source }
}

/**
 * Save a new version of a module prompt.
 * Deactivates all previous active rows for this (workspace, module) pair,
 * then inserts a new row with version+1.
 */
export async function saveModulePrompt(
  supabase: SupabaseClient,
  workspaceId: string,
  key: ModulePromptKey,
  promptText: string,
  opts?: { notes?: string; userId?: string }
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const validation = validatePromptText(promptText)
  if (!validation.ok) return { ok: false, error: validation.error! }

  const normalised = promptText.trim().replace(/\r\n/g, '\n')
  const hash = hashPrompt(normalised)

  // Get current max version
  const { data: current } = await supabase
    .from('workspace_prompts')
    .select('version')
    .eq('workspace_id', workspaceId)
    .eq('module_key', key)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (current?.version ?? 0) + 1

  // Deactivate existing active rows
  await supabase
    .from('workspace_prompts')
    .update({ is_active: false })
    .eq('workspace_id', workspaceId)
    .eq('module_key', key)
    .eq('is_active', true)

  // Insert new version
  const { error: insertErr } = await supabase
    .from('workspace_prompts')
    .insert({
      workspace_id: workspaceId,
      module_key: key,
      prompt_text: normalised,
      is_active: true,
      is_default: false,
      status: 'active',
      version: nextVersion,
      prompt_hash: hash,
      notes: opts?.notes ?? null,
      created_by: opts?.userId ?? null,
    })

  if (insertErr) return { ok: false, error: insertErr.message }

  // Invalidate cache
  invalidatePromptCache(workspaceId, key)

  return { ok: true, version: nextVersion }
}

/**
 * List all versions for a module (for history/rollback UI).
 */
export async function listModulePromptVersions(
  supabase: SupabaseClient,
  workspaceId: string,
  key: ModulePromptKey
): Promise<WorkspacePromptRow[]> {
  const { data } = await supabase
    .from('workspace_prompts')
    .select('id, module_key, prompt_text, version, is_active, is_default, status, prompt_hash, notes, created_at')
    .eq('workspace_id', workspaceId)
    .eq('module_key', key)
    .order('version', { ascending: false })
    .limit(20)
  return (data ?? []) as WorkspacePromptRow[]
}

/**
 * Compose the final system prompt from parts.
 * Order: workspaceContext → modulePrompt → (optional runtime context)
 */
export function composeSystemPrompt(
  parts: (string | null | undefined)[]
): string {
  return parts.filter(Boolean).join('\n\n---\n\n')
}
