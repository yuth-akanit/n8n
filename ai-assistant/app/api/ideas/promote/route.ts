import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { slugify } from '@/lib/utils'
import { runProjectPlannerPrompt, runTagPrompt } from '@/lib/ai'
import { resolveNextArtifactVersion } from '@/lib/artifacts'
import { embedArtifact } from '@/lib/ai/rag'
import type { Idea } from '@/types'

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  try {
    const body = await request.json() as { ideaId: string }
    const { ideaId } = body

    if (!ideaId) {
      return NextResponse.json({ error: 'ideaId is required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { workspaceId, user } = ctx

    // Fetch and verify idea
    const { data: idea, error: ideaErr } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', ideaId)
      .eq('workspace_id', workspaceId)
      .single()

    if (ideaErr || !idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
    }

    const i = idea as Idea & { tags?: string[] }

    // Deduplicate slug
    const baseSlug = slugify(i.title)
    let slug = baseSlug
    let attempt = 0
    while (true) {
      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('slug', slug)
        .single()
      if (!existing) break
      slug = `${baseSlug}-${++attempt}`
    }

    // Create the project
    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .insert({
        workspace_id: workspaceId,
        idea_id: ideaId,
        name: i.title,
        slug,
        project_type: 'idea',
        summary: i.brief,
        goal: i.solution ?? i.brief,
        status: 'planning',
        priority: 'medium',
        tags: i.tags ?? [],
        created_by: user.id,
      })
      .select()
      .single()

    if (projectErr) throw projectErr

    // Mark idea as converted
    await supabase
      .from('ideas')
      .update({ status: 'converted', updated_at: new Date().toISOString() })
      .eq('id', ideaId)

    // ── Auto-plan: run AI project planner ──────────────────────────────────
    const goal = [i.title, i.brief, i.solution].filter(Boolean).join('. ')
    const scope = [
      i.problem ? `Problem: ${i.problem}` : '',
      i.audience ? `Audience: ${i.audience}` : '',
      i.channel?.length ? `Channels: ${i.channel.join(', ')}` : '',
    ].filter(Boolean).join('\n')

    const { data: session } = await supabase
      .from('ai_sessions')
      .insert({
        workspace_id: workspaceId,
        project_id: project.id,
        module: 'project',
        title: `Auto-plan: ${i.title.slice(0, 60)}`,
        created_by: user.id,
      })
      .select('id')
      .single()

    const planResult = await runProjectPlannerPrompt(goal, scope)

    // Save AI run record
    const { data: runRecord } = await supabase
      .from('ai_runs')
      .insert({
        session_id: session?.id,
        module: 'project',
        prompt_key: 'project_plan',
        prompt_version: 1,
        provider: planResult.provider,
        model: planResult.model,
        status: 'success',
        input_json: { goal, scope },
        output_json: { milestones: planResult.milestones },
        latency_ms: planResult.latency_ms,
        finished_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    // Save artifact
    const version = await resolveNextArtifactVersion(supabase, { workspaceId, projectId: project.id, artifactType: 'project_plan' })
    const { data: artifact } = await supabase
      .from('artifacts')
      .insert({
        workspace_id: workspaceId,
        project_id: project.id,
        ai_run_id: runRecord?.id ?? null,
        artifact_type: 'project_plan',
        title: `Project Plan: ${i.title.slice(0, 60)}`,
        content: JSON.stringify({ goal, scope, milestones: planResult.milestones, docs: planResult.docs }, null, 2),
        format: 'json',
        version,
        is_latest: true,
        created_by: user.id,
      })
      .select('id')
      .single()

    // Save project docs
    if (planResult.docs?.length) {
      await supabase.from('project_docs').insert(
        planResult.docs.map((d) => ({
          project_id: project.id,
          doc_type: d.doc_type,
          title: d.title,
          content_md: d.content_md,
          created_by: user.id,
        }))
      )
    }

    // Save milestones + tasks into structured tables
    for (const m of planResult.milestones ?? []) {
      const { data: milestone } = await supabase
        .from('milestones')
        .insert({
          project_id: project.id,
          title: m.title,
          description: m.description ?? null,
          sort_order: m.sort_order ?? 0,
          status: 'todo',
        })
        .select('id')
        .single()

      if (milestone && m.tasks?.length) {
        await supabase.from('tasks').insert(
          m.tasks.map((t) => ({
            project_id: project.id,
            milestone_id: milestone.id,
            title: t.title,
            description: t.description ?? null,
            task_type: t.task_type,
            priority: t.priority,
            estimate_hours: t.estimate_hours ?? null,
            status: 'todo',
            created_by: user.id,
          }))
        )
      }
    }

    // Fire-and-forget: embed + auto-tag the project
    void (async () => {
      try {
        if (artifact?.id) {
          await embedArtifact(supabase, artifact.id, `${goal} ${scope}`)
        }
        const tags = await runTagPrompt(`${goal} ${scope}`)
        if (tags.length > 0) {
          await supabase.from('projects').update({ tags }).eq('id', project.id)
        }
      } catch (bgErr) {
        console.warn('[promote] background task error:', bgErr)
      }
    })()

    return NextResponse.json({
      projectId: project.id,
      slug: project.slug,
      milestonesCreated: planResult.milestones?.length ?? 0,
    })
  } catch (err: unknown) {
    console.error('[api/ideas/promote]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
