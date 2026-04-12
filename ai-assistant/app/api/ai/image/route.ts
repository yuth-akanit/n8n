import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { resolveNextArtifactVersion } from '@/lib/artifacts'

type ImageStyle = 'realistic' | 'illustration' | 'anime' | 'logo' | 'product' | 'ui_mockup'
type ImageSize = 'square' | 'landscape' | 'portrait'

const STYLE_PREFIXES: Record<ImageStyle, string> = {
  realistic:    '',
  illustration: 'digital illustration, vibrant colors, detailed artwork, ',
  anime:        'anime style, manga art, Studio Ghibli inspired, ',
  logo:         'minimal logo design, clean vector, professional brand, white background, ',
  product:      'product photography, studio lighting, white background, high quality, ',
  ui_mockup:    'professional UI/UX mockup, Dribbble style, clean modern interface, ',
}

const SIZE_MAP: Record<ImageSize, string> = {
  square:    'square_hd',
  landscape: 'landscape_16_9',
  portrait:  'portrait_4_3',
}

export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requireApiAuth()
  } catch (err) {
    return err as Response
  }

  if (!process.env.FAL_KEY) {
    return NextResponse.json(
      { error: 'Image generation is not configured (FAL_KEY missing)' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as {
      prompt?: unknown
      style?: unknown
      size?: unknown
    }

    const rawPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (!rawPrompt || rawPrompt.length < 3) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }
    if (rawPrompt.length > 1000) {
      return NextResponse.json({ error: 'prompt too long (max 1000 chars)' }, { status: 400 })
    }

    const style: ImageStyle =
      typeof body.style === 'string' && body.style in STYLE_PREFIXES
        ? (body.style as ImageStyle)
        : 'realistic'

    const size: ImageSize =
      typeof body.size === 'string' && body.size in SIZE_MAP
        ? (body.size as ImageSize)
        : 'square'

    const finalPrompt = `${STYLE_PREFIXES[style]}${rawPrompt}`

    const start = Date.now()

    // ── fal.ai Flux Schnell ──────────────────────────────────────────────────
    const fal = await import('@fal-ai/serverless-client')
    fal.config({ credentials: process.env.FAL_KEY })

    const falResult = (await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt: finalPrompt,
        image_size: SIZE_MAP[size],
        num_inference_steps: 4,
        num_images: 1,
      },
    })) as { images: Array<{ url: string; width: number; height: number }> }

    const imageUrl = falResult.images?.[0]?.url
    if (!imageUrl) {
      return NextResponse.json({ error: 'Image generation returned no result' }, { status: 502 })
    }

    const latency = Date.now() - start

    // ── Persist to artifacts ─────────────────────────────────────────────────
    const supabase = createServiceClient()
    const { workspaceId, user } = ctx

    const version = await resolveNextArtifactVersion(supabase, {
      workspaceId,
      artifactType: 'image',
    })

    const { data: artifact } = await supabase
      .from('artifacts')
      .insert({
        workspace_id: workspaceId,
        artifact_type: 'image',
        title: rawPrompt.slice(0, 80),
        content: imageUrl,
        format: 'url',
        version,
        is_latest: true,
        created_by: user.id,
      })
      .select('id')
      .single()

    console.log(`[api/ai/image] generated in ${latency}ms, style=${style}, size=${size}`)

    return NextResponse.json({
      imageUrl,
      artifactId: artifact?.id,
      prompt: rawPrompt,
      style,
      size,
      latency_ms: latency,
    })
  } catch (err: unknown) {
    console.error('[api/ai/image]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
