import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth/server'
import { PlanClient } from './PlanClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export default async function ProjectPlanPage({ params }: Props) {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <PlanClient projectId={params.id} workspaceId={ctx.workspaceId} />
}
