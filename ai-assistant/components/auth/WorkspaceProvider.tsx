'use client'

/**
 * WorkspaceProvider — passes server-resolved auth context to client components.
 *
 * The dashboard layout (Server Component) fetches { userId, workspaceId }
 * and injects them here. Client components use useWorkspace() to read them.
 */
import { createContext, useContext } from 'react'

export interface WorkspaceContext {
  workspaceId: string
  userId: string
}

const Ctx = createContext<WorkspaceContext | null>(null)

export function WorkspaceProvider({
  workspaceId,
  userId,
  children,
}: WorkspaceContext & { children: React.ReactNode }) {
  return <Ctx.Provider value={{ workspaceId, userId }}>{children}</Ctx.Provider>
}

export function useWorkspace(): WorkspaceContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return ctx
}
