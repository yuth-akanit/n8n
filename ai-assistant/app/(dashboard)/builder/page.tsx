import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth/server'
import { BuilderClient } from './BuilderClient'

export const dynamic = 'force-dynamic'

export default async function BuilderPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <BuilderClient workspaceId={ctx.workspaceId} />
}
