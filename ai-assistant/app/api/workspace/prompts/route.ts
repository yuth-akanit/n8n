import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { handleRouteError } from '@/lib/api/errors'
import {
  MODULE_KEYS,
  getModulePrompt,
  saveModulePrompt,
  listModulePromptVersions,
  type ModulePromptKey,
} from '@/lib/ai/module-prompts'

export const dynamic = 'force-dynamic'

/** GET /api/workspace/prompts — return current active prompt for all modules */
export async function GET() {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  try {
    const supabase = createServiceClient()
    const result: Record<string, { text: string; version: number; source: string; history: unknown[] }> = {}

    await Promise.all(
      MODULE_KEYS.map(async (key) => {
        const [current, history] = await Promise.all([
          getModulePrompt(supabase, ctx.workspaceId, key),
          listModulePromptVersions(supabase, ctx.workspaceId, key),
        ])
        result[key] = { ...current, history }
      })
    )

    return Response.json({ prompts: result })
  } catch (err) {
    return handleRouteError(err, 'api/workspace/prompts GET')
  }
}

/** POST /api/workspace/prompts — save a new version of a module prompt */
export async function POST(request: Request) {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  try {
    const body = await request.json() as {
      module_key?: unknown
      prompt_text?: unknown
      notes?: unknown
    }

    const key = body.module_key
    if (typeof key !== 'string' || !(MODULE_KEYS as string[]).includes(key)) {
      return Response.json({ error: `module_key must be one of: ${MODULE_KEYS.join(', ')}` }, { status: 400 })
    }

    const promptText = body.prompt_text
    if (typeof promptText !== 'string') {
      return Response.json({ error: 'prompt_text must be a string' }, { status: 400 })
    }

    const notes = typeof body.notes === 'string' ? body.notes : undefined

    const supabase = createServiceClient()
    const result = await saveModulePrompt(
      supabase,
      ctx.workspaceId,
      key as ModulePromptKey,
      promptText,
      { notes, userId: ctx.user.id }
    )

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 422 })
    }

    return Response.json({ ok: true, version: result.version })
  } catch (err) {
    return handleRouteError(err, 'api/workspace/prompts POST')
  }
}
