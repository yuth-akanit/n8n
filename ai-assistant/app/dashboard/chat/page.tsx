export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth/server'
import { ChatClient } from './ChatClient'

export default async function ChatPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')

  return <ChatClient workspaceId={ctx.workspaceId} />
}
