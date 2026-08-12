'use client'
import { useMemo } from 'react'
import { Group, Image as KImage, Rect } from 'react-konva'
import { coverRect, gradientPoints } from '@/lib/geometry'
import { konvaStops } from '@/lib/gradients'
import { blurBackdrop, noiseTile } from '@/lib/raster'
import type { State } from '@/lib/state'
import { useImage } from './use-image'

export function Background({ bg, w, h }: { bg: State['bg']; w: number; h: number }) {
  const img = useImage(bg.mode === 'image' ? bg.imageSrc : null)
  const blurred = useMemo(
    () => (img ? blurBackdrop(img, bg.imageBlur) : null),
    [img, bg.imageBlur],
  )
  const grain = useMemo(() => (bg.grain > 0 ? noiseTile() : null), [bg.grain])
  const pts = useMemo(() => gradientPoints(bg.angle, w, h), [bg.angle, w, h])
  const stops = useMemo(() => konvaStops(bg.stops), [bg.stops])

  const box = { x: 0, y: 0, w, h }

  return (
    <Group listening={false}>
      {bg.mode === 'gradient' && (
        <Rect
          width={w}
          height={h}
          fillLinearGradientStartPoint={pts.start}
          fillLinearGradientEndPoint={pts.end}
          fillLinearGradientColorStops={stops}
        />
      )}

      {bg.mode === 'solid' && <Rect width={w} height={h} fill={bg.solid} />}

      {bg.mode === 'image' && blurred && img && (
        <Group clipX={0} clipY={0} clipWidth={w} clipHeight={h}>
          {(() => {
            const r = coverRect(box, img.naturalWidth, img.naturalHeight)
            return <KImage image={blurred} x={r.x} y={r.y} width={r.w} height={r.h} />
          })()}
        </Group>
      )}

      {bg.mode === 'image' && bg.imageDim > 0 && (
        <Rect width={w} height={h} fill="#000000" opacity={bg.imageDim} />
      )}

      {/* transparent mode draws nothing — the checkerboard lives in CSS behind
          the stage so it can never end up in the exported PNG */}

      {grain && (
        <Rect
          width={w}
          height={h}
          // konva types this as HTMLImageElement, but it feeds createPattern,
          // which takes any CanvasImageSource — a canvas included
          fillPatternImage={grain as unknown as HTMLImageElement}
          fillPatternRepeat="repeat"
          opacity={bg.grain * 0.5}
          globalCompositeOperation="overlay"
        />
      )}

      {bg.vignette > 0 && (
        <Rect
          width={w}
          height={h}
          fillRadialGradientStartPoint={{ x: w / 2, y: h / 2 }}
          fillRadialGradientEndPoint={{ x: w / 2, y: h / 2 }}
          fillRadialGradientStartRadius={Math.min(w, h) * 0.35}
          fillRadialGradientEndRadius={Math.max(w, h) * 0.75}
          fillRadialGradientColorStops={[0, 'rgba(0,0,0,0)', 1, `rgba(0,0,0,${bg.vignette})`]}
        />
      )}
    </Group>
  )
}
