'use client'
import type Konva from 'konva'
import { useEffect, useMemo, useRef } from 'react'
import { Group, Image as KImage, Rect, Transformer } from 'react-konva'
import { anchorFor, type Anno } from '@/lib/annotations'
import { cropBlur, pixelateBlocks } from '@/lib/raster'
import { NO_EXPORT, setCursor } from './annotations'

interface Props {
  items: Anno[]
  img: HTMLImageElement | null
  /** the screenshot's box in frame-local coordinates */
  imgW: number
  imgH: number
  minDim: number
  /** stage scale, so handles can be a constant size on screen */
  fit: number
  selected: string | null
  onSelect: (id: string | null) => void
  onCommit: (id: string, patch: Partial<Anno>) => void
}

function Fill({ a, img, w, h }: { a: Anno; img: HTMLImageElement | null; w: number; h: number }) {
  const region = { x: a.x, y: a.y, w: a.w, h: a.h }

  const blocks = useMemo(
    () =>
      a.redactMode === 'pixelate' && img
        ? pixelateBlocks(img, region, Math.round(a.intensity))
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.redactMode, a.x, a.y, a.w, a.h, a.intensity, img],
  )

  const blurred = useMemo(
    () => (a.redactMode === 'blur' && img ? cropBlur(img, region, a.intensity / 30) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.redactMode, a.x, a.y, a.w, a.h, a.intensity, img],
  )

  if (a.redactMode === 'solid' || !img) {
    return <Rect width={w} height={h} fill={a.redactMode === 'solid' ? a.color : '#3c3c42'} />
  }

  if (a.redactMode === 'blur') {
    return blurred ? <KImage image={blurred} width={w} height={h} /> : null
  }

  if (!blocks) return null
  const bw = w / blocks.cols
  const bh = h / blocks.rows
  return (
    <>
      {blocks.colors.map((c, i) => (
        <Rect
          key={i}
          x={(i % blocks.cols) * bw}
          y={Math.floor(i / blocks.cols) * bh}
          // half-pixel overdraw kills the hairline seams between blocks
          width={bw + 0.5}
          height={bh + 0.5}
          fill={c}
          listening={false}
        />
      ))}
    </>
  )
}

/**
 * Redactions are children of the frame group, so they rotate and skew with the
 * window and their coordinates are already image-relative.
 */
export function Redactions({
  items,
  img,
  imgW,
  imgH,
  minDim,
  fit,
  selected,
  onSelect,
  onCommit,
}: Props) {
  const trRef = useRef<Konva.Transformer>(null)
  const nodes = useRef(new Map<string, Konva.Node>())
  const sel = items.find((a) => a.id === selected) ?? null

  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const node = sel ? nodes.current.get(sel.id) : null
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [sel, items])

  const outline = minDim * 0.003

  return (
    <>
      {items.map((a) => {
        const w = a.w * imgW
        const h = a.h * imgH
        return (
          <Group
            key={a.id}
            ref={(n) => {
              if (n) nodes.current.set(a.id, n)
              else nodes.current.delete(a.id)
            }}
            x={a.x * imgW}
            y={a.y * imgH}
            draggable
            onMouseDown={() => onSelect(a.id)}
            onTouchStart={() => onSelect(a.id)}
            onMouseEnter={(e) => setCursor(e, 'move')}
            onMouseLeave={(e) => setCursor(e, '')}
            onDragStart={(e) => setCursor(e, 'grabbing')}
            onDragEnd={(e) => {
              setCursor(e, 'move')
              onCommit(a.id, { x: e.target.x() / imgW, y: e.target.y() / imgH })
            }}
            onTransformEnd={(e) => {
              const n = e.target
              const sx = n.scaleX()
              const sy = n.scaleY()
              n.scaleX(1)
              n.scaleY(1)
              onCommit(a.id, {
                x: n.x() / imgW,
                y: n.y() / imgH,
                w: (w * sx) / imgW,
                h: (h * sy) / imgH,
              })
            }}
          >
            <Group clipX={0} clipY={0} clipWidth={w} clipHeight={h}>
              <Fill a={a} img={img} w={w} h={h} />
            </Group>
            {/* keeps the whole rect grabbable even where blocks are transparent */}
            <Rect width={w} height={h} fill="rgba(0,0,0,0.002)" />
            {/* no dashed outline here — the Transformer already draws a border,
                and two overlapping outlines just obscure what is being hidden */}
          </Group>
        )
      })}

      {sel && (
        <Transformer
          ref={trRef}
          name={NO_EXPORT}
          rotateEnabled={false}
          keepRatio={false}
          ignoreStroke
          // Anchors scale with the region, not the canvas. A redaction is often
          // a thin strip over one line of text, where fixed-size handles cover
          // most of the very thing you are trying to check is hidden.
          anchorSize={anchorFor(sel, imgW, imgH, fit)}
          anchorStroke="#b3a4f5"
          anchorFill="#ffffff"
          anchorStrokeWidth={1 / Math.max(fit, 0.05)}
          anchorCornerRadius={2}
          // top-centre and bottom-centre sit right on top of the redacted line;
          // corners plus the side handles cover every resize without them
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
            'middle-left',
            'middle-right',
          ]}
          borderStroke="#b3a4f5"
          borderStrokeWidth={1.5 / Math.max(fit, 0.05)}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < minDim * 0.02 || newBox.height < minDim * 0.02 ? oldBox : newBox
          }
        />
      )}
    </>
  )
}
