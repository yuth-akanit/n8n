import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/server'
import { resolveNextArtifactVersion } from '@/lib/artifacts'

type ImageStyle =
  | 'realistic' | 'illustration' | 'anime' | 'logo' | 'product' | 'ui_mockup'
  | 'watercolor' | 'oil_painting' | 'pixel_art' | 'cinematic' | 'flat_design' | 'sketch'
type ImageSize = 'square' | 'landscape' | 'portrait'

const STYLE_PREFIXES: Record<ImageStyle, string> = {
  realistic:    '',
  cinematic:    'cinematic photography, dramatic lighting, golden hour, depth of field, 8K, ',
  illustration: 'digital illustration, vibrant colors, detailed artwork, ',
  watercolor:   'watercolor painting, soft washes, delicate brushstrokes, artistic, ',
  oil_painting: 'oil painting, thick impasto texture, rich colors, canvas, classical art style, ',
  sketch:       'pencil sketch, hand-drawn, fine linework, graphite on paper, ',
  anime:        'anime style, manga art, Studio Ghibli inspired, ',
  pixel_art:    '8-bit pixel art, retro game style, pixelated, low-res aesthetic, ',
  flat_design:  'flat design, minimal vector illustration, clean shapes, bold colors, ',
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
      numImages?: unknown
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

    const numImages = Math.min(4, Math.max(1,
      typeof body.numImages === 'number' ? Math.floor(body.numImages) : 1
    ))

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
        num_images: numImages,
      },
    })) as { images: Array<{ url: string }> }

    const imageUrls = (falResult.images ?? []).map(img => img.url).filter(Boolean)
    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'Image generation returned no result' }, { status: 502 })
    }

    const latency = Date.now() - start

    // ── Persist each image as an artifact ───────────────────────────────────
    const supabase = createServiceClient()
    const { workspaceId, user } = ctx

    const artifactIds: string[] = []
    for (const url of imageUrls) {
      const version = await resolveNextArtifactVersion(supabase, { workspaceId, artifactType: 'image' })
      const { data: artifact, error: artifactErr } = await supabase
        .from('artifacts')
        .insert({
          workspace_id: workspaceId,
          artifact_type: 'image',
          title: rawPrompt.slice(0, 80),
          content: url,
          format: 'url',
          version,
          is_latest: true,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (artifactErr) console.error('[api/ai/image] artifact save failed:', artifactErr.message)
      if (artifact?.id) artifactIds.push(artifact.id)
    }

    console.log(`[api/ai/image] ${numImages} image(s) in ${latency}ms, style=${style}, size=${size}`)

    return NextResponse.json({
      imageUrls,
      artifactIds,
      prompt: rawPrompt,
      style,
      size,
      numImages,
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
