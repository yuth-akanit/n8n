import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth/server'
import { NewProjectClient } from './NewProjectClient'

export const dynamic = 'force-dynamic'

export default async function NewProjectPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <NewProjectClient workspaceId={ctx.workspaceId} />
}
