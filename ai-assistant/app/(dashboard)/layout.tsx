import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth/server'
import { WorkspaceProvider } from '@/components/auth/WorkspaceProvider'
import { Sidebar } from '@/components/layout/Sidebar'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext()

  // Unauthenticated users go to login
  if (!ctx) redirect('/login')

  return (
    <WorkspaceProvider workspaceId={ctx.workspaceId} userId={ctx.user.id}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 bg-gray-50 overflow-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </WorkspaceProvider>
  )
}
