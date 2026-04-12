import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { requireString, requireOneOf, optionalString, optionalUuid } from '@/lib/api/validate'
import { handleRouteError } from '@/lib/api/errors'
import type { TaskType, Priority } from '@/types'

interface Props { params: { id: string } }

const TASK_TYPES = ['research', 'planning', 'backend', 'frontend', 'seo', 'content', 'qa', 'deploy'] as const
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

/** POST /api/projects/[id]/tasks — create a task */
export async function POST(request: Request, { params }: Props) {
  let ctx
  try { ctx = await requireApiAuth() } catch (err) { return err as Response }

  try {
    const body = await request.json() as {
      title?: unknown; description?: unknown; task_type?: unknown;
      priority?: unknown; milestone_id?: unknown; estimate_hours?: unknown
    }

    const title = requireString(body.title, 'title', { max: 300 })
    const description = optionalString(body.description, 'description', { max: 2000 })
    const task_type = requireOneOf<TaskType>(body.task_type, 'task_type', TASK_TYPES)
    const priority = body.priority
      ? requireOneOf<Priority>(body.priority, 'priority', PRIORITIES)
      : 'medium'
    const milestone_id = optionalUuid(body.milestone_id, 'milestone_id')
    const estimate_hours =
      typeof body.estimate_hours === 'number' && body.estimate_hours > 0
        ? body.estimate_hours
        : null

    const supabase = createServiceClient()

    // Verify project belongs to this workspace
    const { data: project } = await supabase
      .from('projects').select('id').eq('id', params.id).eq('workspace_id', ctx.workspaceId).single()
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        project_id: params.id,
        milestone_id,
        title,
        description,
        task_type,
        priority,
        estimate_hours,
        status: 'todo',
        created_by: ctx.user.id,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'api/projects/[id]/tasks POST')
  }
}
