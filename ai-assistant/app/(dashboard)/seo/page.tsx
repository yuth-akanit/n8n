import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth/server'
import { SeoClient } from './SeoClient'

export const dynamic = 'force-dynamic'

export default async function SeoPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <SeoClient workspaceId={ctx.workspaceId} />
}
