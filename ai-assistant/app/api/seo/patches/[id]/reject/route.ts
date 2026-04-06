import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/seo/patches/[id]/reject
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('seo_patches')
    .update({ status: 'rejected' })
    .eq('id', params.id)
    .eq('status', 'proposed')
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Patch not found or not in proposed status' }, { status: 404 })
  }

  return NextResponse.json(data)
}
