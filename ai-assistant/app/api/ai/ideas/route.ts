import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { runIdeaPrompt, runTagPrompt } from '@/lib/ai'
import { requireString, optionalString } from '@/lib/api/validate'
import { handleRouteError } from '@/lib/api/errors'
import { resolveNextArtifactVersion } from '@/lib/artifacts'
import { embedArtifact } from '@/lib/ai/rag'
import { getWorkspaceContext } from '@/lib/ai/workspace-context'

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as { prompt?: unknown; constraints?: unknown }

    const prompt = requireString(body.prompt, 'prompt', { max: 2000 })
    const constraints = optionalString(body.constraints, 'constraints', { max: 1000 })

    const supabase = createServiceClient()
    const { workspaceId, user } = ctx
    const start = Date.now()

    const { data: session, error: sessionErr } = await supabase
      .from('ai_sessions')
      .insert({
        workspace_id: workspaceId,
        module: 'idea',
        title: prompt.slice(0, 80),
        created_by: user.id,
      })
      .select()
      .single()

    if (sessionErr) throw sessionErr

    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'user',
      content: prompt,
      metadata: { constraints },
    })

    const wsContext = await getWorkspaceContext(supabase, workspaceId)
    const result = await runIdeaPrompt(prompt, constraints, wsContext)
    const latency = Date.now() - start

    const { data: runRecord } = await supabase
      .from('ai_runs')
      .insert({
        session_id: session.id,
        module: 'idea',
        prompt_key: 'ideas_generate',
        prompt_version: 1,
        provider: result.provider,
        model: result.model,
        status: 'success',
        input_json: { prompt, constraints },
        output_json: { ideas: result.ideas },
        latency_ms: latency,
        finished_at: new Date().toISOString(),
      })
      .select()
      .single()

    await supabase.from('ai_messages').insert({
      session_id: session.id,
      role: 'assistant',
      content: JSON.stringify({ ideas: result.ideas }),
      metadata: { latency_ms: latency },
    })

    const version = await resolveNextArtifactVersion(supabase, {
      workspaceId,
      artifactType: 'idea_doc',
    })

    const { data: artifact } = await supabase
      .from('artifacts')
      .insert({
        workspace_id: workspaceId,
        ai_run_id: runRecord?.id ?? null,
        artifact_type: 'idea_doc',
        title: `Ideas: ${prompt.slice(0, 60)}`,
        content: JSON.stringify({ prompt, constraints, ideas: result.ideas }, null, 2),
        format: 'json',
        version,
        is_latest: true,
        created_by: user.id,
      })
      .select()
      .single()

    // Fire-and-forget: embed artifact + auto-tag ideas (don't block response)
    void (async () => {
      try {
        if (artifact?.id) {
          await embedArtifact(supabase, artifact.id, `${prompt} ${result.ideas.map(i => i.title + ' ' + i.brief).join(' ')}`)
        }
        // Tag each idea row
        for (const idea of result.ideas) {
          const tags = await runTagPrompt(`${idea.title} ${idea.brief} ${idea.problem} ${idea.solution}`)
          if (tags.length > 0) {
            await supabase.from('ideas').update({ tags }).eq('title', idea.title).eq('workspace_id', workspaceId)
          }
        }
      } catch (bgErr) {
        console.warn('[ideas] background task error:', bgErr)
      }
    })()

    return NextResponse.json({
      sessionId: session.id,
      artifactId: artifact?.id,
      ideas: result.ideas,
    })
  } catch (err) {
    return handleRouteError(err, 'api/ai/ideas')
  }
}
