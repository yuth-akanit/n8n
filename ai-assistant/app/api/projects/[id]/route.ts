import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/projects/[id]
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      milestones(*),
      tasks(*),
      project_docs(*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
