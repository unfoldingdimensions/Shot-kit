'use client'
import { Group, Image as KImage, Rect } from 'react-konva'
import { CHROME_PALETTE } from '@/lib/chrome'
import type { Box } from '@/lib/geometry'
import type { State } from '@/lib/state'
import { Chrome } from './chrome'

/** Rounded-rect path with per-corner radii, for the image clip. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  [tl, tr, br, bl]: number[],
) {
  ctx.beginPath()
  ctx.moveTo(tl, 0)
  ctx.lineTo(w - tr, 0)
  ctx.arcTo(w, 0, w, tr, tr)
  ctx.lineTo(w, h - br)
  ctx.arcTo(w, h, w - br, h, br)
  ctx.lineTo(bl, h)
  ctx.arcTo(0, h, 0, h - bl, bl)
  ctx.lineTo(0, tl)
  ctx.arcTo(0, 0, tl, 0, tl)
  ctx.closePath()
}

export function Frame({
  box,
  barH,
  frame,
  img,
  fontFamily,
  minDim,
}: {
  box: Box
  barH: number
  frame: State['frame']
  img: HTMLImageElement | null
  fontFamily: string
  minDim: number
}) {
  if (box.w <= 0 || box.h <= 0) return null

  const r = Math.min(frame.radius * box.w, box.w / 2, box.h / 2)
  const imgY = barH
  const imgH = box.h - barH
  const bottomR = Math.min(r, imgH / 2)
  const clip = barH > 0 ? [0, 0, bottomR, bottomR] : [r, r, r, r]
  const pal = CHROME_PALETTE[frame.theme]

  return (
    <Group
      // origin at the centre so rotation and skew pivot there
      x={box.x + box.w / 2}
      y={box.y + box.h / 2}
      offsetX={box.w / 2}
      offsetY={box.h / 2}
      rotation={frame.rotation}
      skewX={frame.skewX}
      listening={false}
    >
      {/* base plate: carries the shadow and backs any transparent PNG */}
      <Rect
        width={box.w}
        height={box.h}
        cornerRadius={r}
        fill={frame.theme === 'dark' ? pal.bar2 : '#ffffff'}
        shadowColor="#000000"
        shadowBlur={frame.shadowBlur * minDim}
        shadowOffsetY={frame.shadowOffsetY * minDim}
        shadowOpacity={frame.shadowOpacity}
      />

      <Chrome
        kind={frame.chrome}
        os={frame.os}
        theme={frame.theme}
        w={box.w}
        barH={barH}
        radius={r}
        url={frame.url}
        filename={frame.filename}
        title={frame.title}
        fontFamily={fontFamily}
      />

      {img && imgH > 0 && (
        <Group
          y={imgY}
          clipFunc={(ctx) => roundRect(ctx as unknown as CanvasRenderingContext2D, box.w, imgH, clip)}
        >
          <KImage image={img} width={box.w} height={imgH} />
        </Group>
      )}

      {frame.glassEdge && (
        <>
          <Rect
            width={box.w}
            height={box.h}
            cornerRadius={r}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={Math.max(box.w * 0.0012, 0.75)}
          />
          <Rect
            x={-0.75}
            y={-0.75}
            width={box.w + 1.5}
            height={box.h + 1.5}
            cornerRadius={r + 1}
            stroke="rgba(0,0,0,0.10)"
            strokeWidth={Math.max(box.w * 0.0012, 0.75)}
          />
        </>
      )}
    </Group>
  )
}
