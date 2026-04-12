export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth/server'
import { ImageClient } from './ImageClient'

export default async function ImagePage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <ImageClient />
}
