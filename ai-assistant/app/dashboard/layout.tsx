import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth/server'
import { WorkspaceProvider } from '@/components/auth/WorkspaceProvider'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext()

  // Unauthenticated users go to login
  if (!ctx) redirect('/login')

  return (
    <WorkspaceProvider workspaceId={ctx.workspaceId} userId={ctx.user.id}>
      <DashboardShell>
        {children}
      </DashboardShell>
    </WorkspaceProvider>
  )
}
