import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { runBuilderPrompt } from '@/lib/ai'
import type { BuilderMode } from '@/types'
import { getModulePrompt } from '@/lib/ai/module-prompts'
import { classifyBuilderIntent } from '@/lib/ai/intent-classifier'

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as { projectId?: string; mode: BuilderMode; prompt: string }
    const { projectId, mode, prompt } = body

    if (!mode || !prompt) {
      return NextResponse.json({ error: 'mode and prompt are required' }, { status: 400 })
    }

    // ── Intent Gate ──────────────────────────────────────────────────────────
    // Classify the prompt before generating. If it's a vague business/marketing
    // goal, return guided artifact options instead of generating immediately.
    const classification = await classifyBuilderIntent(prompt)
    if (classification.needs_gate) {
      return NextResponse.json({
        type: 'clarification',
        intent: classification.intent,
        message: classification.message,
        options: classification.options,
      })
    }
    // ─────────────────────────────────────────────────────────────────────────

    const supabase = createServiceClient()
    const { workspaceId, user } = ctx
    const start = Date.now()

    // If projectId supplied, verify ownership
    if (projectId) {
      const { data: proj } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .eq('workspace_id', workspaceId)
        .single()
      if (!proj) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
    }

    const { data: session, error: sessionErr } = await supabase
      .from('ai_sessions')
      .insert({
        workspace_id: workspaceId,
        project_id: projectId ?? null,
        module: 'builder',
        title: `${mode}: ${prompt.slice(0, 60)}`,
        created_by: user.id,
      })
      .select()
      .single()

    if (sessionErr) throw sessionErr

    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'user',
      content: prompt,
      metadata: { mode },
    })

    const modulePromptData = await getModulePrompt(supabase, ctx.workspaceId, 'builder_module_prompt')
    let result = await runBuilderPrompt(mode, prompt, modulePromptData.text)

    // Auto-generate UI mockup via Fal.ai if generating a UI Plan
    if (mode === 'ui' && process.env.FAL_KEY) {
      try {
        const fal = await import('@fal-ai/serverless-client')
        fal.config({ credentials: process.env.FAL_KEY })
        const falResult = (await fal.subscribe('fal-ai/flux/schnell', {
          input: {
            prompt: `Professional UI mockup design for: ${prompt}. Dribbble style, high quality UI/UX, clean interface.`,
            image_size: 'landscape_16_9'
          }
        })) as { images: Array<{ url: string }> }

        if (falResult.images?.[0]?.url) {
          result.content = `![UI Mockup](${falResult.images[0].url})\n\n---\n\n${result.content}`
        }
      } catch (falErr) {
        console.warn('[Builder] fal.ai image generation failed:', falErr)
      }
    }

    const latency = Date.now() - start

    const { data: runRecord } = await supabase
      .from('ai_runs')
      .insert({
        session_id: session.id,
        module: 'builder',
        prompt_key: 'builder_module_prompt',
        prompt_version: modulePromptData.version,
        prompt_source: modulePromptData.source,
        provider: result.provider,
        model: result.model,
        status: 'success',
        input_json: { mode, prompt },
        output_json: { content: result.content },
        latency_ms: latency,
        finished_at: new Date().toISOString(),
      })
      .select()
      .single()

    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'assistant',
      content: result.content,
      metadata: { latency_ms: latency },
    })

    const artifactTypeMap: Record<string, string> = {
      spec: 'markdown', sql: 'sql', api: 'markdown', ui: 'markdown', code_patch: 'code',
    }
    const formatMap: Record<string, string> = {
      spec: 'md', sql: 'sql', api: 'md', ui: 'md', code_patch: 'ts',
    }

    const title = `${result.title}: ${prompt.slice(0, 50)}`
    const { data: artifact } = await supabase
      .from('artifacts')
      .insert({
        workspace_id: workspaceId,
        project_id: projectId ?? null,
        ai_run_id: runRecord?.id ?? null,
        artifact_type: artifactTypeMap[mode] ?? 'markdown',
        title,
        content: result.content,
        format: formatMap[mode] ?? 'md',
        created_by: user.id,
      })
      .select()
      .single()

    return NextResponse.json({
      type: 'artifact',
      sessionId: session.id,
      artifactId: artifact?.id,
      content: result.content,
      title,
    })
  } catch (err: unknown) {
    console.error('[api/ai/builder]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
