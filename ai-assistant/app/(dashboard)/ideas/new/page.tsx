import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth/server'
import { NewIdeaClient } from './NewIdeaClient'

export const dynamic = 'force-dynamic'

export default async function NewIdeaPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <NewIdeaClient workspaceId={ctx.workspaceId} />
}
