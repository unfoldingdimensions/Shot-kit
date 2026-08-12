'use client'
import type Konva from 'konva'
import { useEffect, useRef } from 'react'
import { Arrow, Circle, Ellipse, Group, Line, Rect, Shape, Text, Transformer } from 'react-konva'
import {
  ANCHOR_SCREEN_PX,
  BOXY,
  POINTER_PATH,
  canRotate,
  moveArrow,
  type Anno,
} from '@/lib/annotations'

/**
 * Selection outlines and drag handles carry this name so `exportImage` can hide
 * them synchronously right before toDataURL. Doing it through React state would
 * race the draw and could bake a purple handle into someone's export.
 */
export const NO_EXPORT = 'no-export'

/**
 * Konva draws to a canvas, so the browser has no idea a shape under the pointer
 * is draggable. The container's CSS cursor has to be driven by hand.
 */
export function setCursor(e: { target: Konva.Node }, cursor: string) {
  const el = e.target.getStage()?.container()
  if (el) el.style.cursor = cursor
}

interface Props {
  annos: Anno[]
  w: number
  h: number
  minDim: number
  /** stage scale, so handles stay a constant size on screen */
  fit: number
  fontFamily: string
  selected: string | null
  onSelect: (id: string | null) => void
  onChange: (id: string, patch: Partial<Anno>) => void
  onCommit: (id: string, patch: Partial<Anno>) => void
}

/** Spotlight: dim the whole canvas, then punch a hole with an even-odd fill. */
function SpotlightShape({ a, w, h }: { a: Anno; w: number; h: number }) {
  const rw = a.w * w
  const rh = a.h * h
  const ox = -a.x * w
  const oy = -a.y * h
  return (
    <Shape
      listening={false}
      sceneFunc={(ctx, shape) => {
        ctx.beginPath()
        ctx.rect(ox, oy, w, h)
        ctx.rect(0, 0, rw, rh)
        ctx.closePath()
        ctx.fillStyle = `rgba(0,0,0,${a.dim})`
        // even-odd is what turns the inner rect into a hole
        ;(ctx as unknown as CanvasRenderingContext2D).fill('evenodd')
        ctx.fillStrokeShape(shape)
      }}
    />
  )
}

function Glyph({
  a,
  w,
  h,
  minDim,
  fontFamily,
}: {
  a: Anno
  w: number
  h: number
  minDim: number
  fontFamily: string
}) {
  const s = a.size * minDim

  if (a.kind === 'pointer') {
    return (
      <Line
        points={POINTER_PATH.map((n) => n * s)}
        closed
        fill={a.color}
        stroke="rgba(0,0,0,0.72)"
        strokeWidth={Math.max(s * 0.055, 1)}
        lineJoin="round"
        shadowColor="#000"
        shadowBlur={s * 0.35}
        shadowOpacity={0.35}
        shadowOffsetY={s * 0.06}
      />
    )
  }

  if (a.kind === 'badge') {
    return (
      <>
        <Circle
          radius={s}
          fill={a.color}
          shadowColor="#000"
          shadowBlur={s * 0.7}
          shadowOpacity={0.3}
          shadowOffsetY={s * 0.12}
        />
        <Text
          x={-s}
          y={-s * 0.52}
          width={s * 2}
          align="center"
          text={a.label || '1'}
          fontSize={s * 1.05}
          fontFamily={fontFamily}
          fontStyle="700"
          fill="#ffffff"
        />
      </>
    )
  }

  const bw = a.w * w
  const bh = a.h * h
  const sw = Math.max(a.size * minDim, 1)

  if (a.kind === 'ellipse') {
    return (
      <Ellipse
        x={bw / 2}
        y={bh / 2}
        radiusX={bw / 2}
        radiusY={bh / 2}
        stroke={a.color}
        strokeWidth={sw}
        fill={a.filled ? a.color : undefined}
        opacity={a.filled ? 0.3 : 1}
      />
    )
  }

  return (
    <Rect
      width={bw}
      height={bh}
      cornerRadius={sw * 1.6}
      stroke={a.color}
      strokeWidth={sw}
      fill={a.filled ? a.color : undefined}
      opacity={a.filled ? 0.3 : 1}
    />
  )
}

export function Annotations({
  annos,
  w,
  h,
  minDim,
  fit,
  fontFamily,
  selected,
  onSelect,
  onChange,
  onCommit,
}: Props) {
  const trRef = useRef<Konva.Transformer>(null)
  const nodes = useRef(new Map<string, Konva.Node>())

  const sel = annos.find((a) => a.id === selected) ?? null
  const boxySelected = !!sel && BOXY.includes(sel.kind)

  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const node = sel && boxySelected ? nodes.current.get(sel.id) : null
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [sel, boxySelected, annos])

  const dash = [minDim * 0.012, minDim * 0.009]
  const outline = minDim * 0.003

  return (
    <>
      {annos.map((a) => {
        const isSel = a.id === selected

        if (a.kind === 'arrow') {
          const sw = Math.max(a.size * minDim, 1)
          return (
            // The whole arrow drags as one. Its geometry is two absolute
            // endpoints rather than an origin plus size, so the group's own
            // offset is converted into a shift of both endpoints and then reset
            // to zero — otherwise the offset would compound on the next drag.
            <Group
              key={a.id}
              draggable
              onDragStart={(e) => setCursor(e, 'grabbing')}
              onDragEnd={(e) => {
                const g = e.target
                const dx = g.x() / w
                const dy = g.y() / h
                g.position({ x: 0, y: 0 })
                setCursor(e, 'move')
                const moved = moveArrow(a, dx, dy)
                onCommit(a.id, { x: moved.x, y: moved.y, x2: moved.x2, y2: moved.y2 })
              }}
            >
              <Arrow
                points={[a.x * w, a.y * h, a.x2 * w, a.y2 * h]}
                stroke={a.color}
                fill={a.color}
                strokeWidth={sw}
                pointerLength={sw * 3.4}
                pointerWidth={sw * 3}
                lineCap="round"
                lineJoin="round"
                hitStrokeWidth={Math.max(sw * 6, 18)}
                onMouseDown={() => onSelect(a.id)}
                onTouchStart={() => onSelect(a.id)}
                onMouseEnter={(e) => setCursor(e, 'move')}
                onMouseLeave={(e) => setCursor(e, '')}
                shadowColor="#000"
                shadowBlur={sw * 2.2}
                shadowOpacity={0.28}
              />
              {isSel &&
                (
                  [
                    ['tail', a.x, a.y],
                    ['head', a.x2, a.y2],
                  ] as const
                ).map(([which, hx, hy]) => (
                  <Circle
                    key={which}
                    name={NO_EXPORT}
                    x={hx * w}
                    y={hy * h}
                    radius={minDim * 0.014}
                    fill="#ffffff"
                    stroke="#b3a4f5"
                    strokeWidth={outline}
                    draggable
                    onMouseEnter={(e) => setCursor(e, 'grab')}
                    onMouseLeave={(e) => setCursor(e, '')}
                    onDragStart={(e) => setCursor(e, 'grabbing')}
                    onDragMove={(e) =>
                      onChange(
                        a.id,
                        which === 'tail'
                          ? { x: e.target.x() / w, y: e.target.y() / h }
                          : { x2: e.target.x() / w, y2: e.target.y() / h },
                      )
                    }
                    onDragEnd={(e) =>
                      onCommit(
                        a.id,
                        which === 'tail'
                          ? { x: e.target.x() / w, y: e.target.y() / h }
                          : { x2: e.target.x() / w, y2: e.target.y() / h },
                      )
                    }
                  />
                ))}
            </Group>
          )
        }

        const boxy = BOXY.includes(a.kind)
        const bw = a.w * w
        const bh = a.h * h

        return (
          <Group
            key={a.id}
            ref={(n) => {
              if (n) nodes.current.set(a.id, n)
              else nodes.current.delete(a.id)
            }}
            x={a.x * w}
            y={a.y * h}
            rotation={a.rotation}
            draggable
            onMouseDown={() => onSelect(a.id)}
            onTouchStart={() => onSelect(a.id)}
            onMouseEnter={(e) => setCursor(e, 'move')}
            onMouseLeave={(e) => setCursor(e, '')}
            onDragStart={(e) => setCursor(e, 'grabbing')}
            onDragEnd={(e) => {
              setCursor(e, 'move')
              onCommit(a.id, { x: e.target.x() / w, y: e.target.y() / h })
            }}
            onTransformEnd={(e) => {
              const n = e.target
              const sx = n.scaleX()
              const sy = n.scaleY()
              n.scaleX(1)
              n.scaleY(1)
              onCommit(a.id, {
                x: n.x() / w,
                y: n.y() / h,
                w: (bw * sx) / w,
                h: (bh * sy) / h,
                rotation: n.rotation(),
              })
            }}
          >
            {a.kind === 'spotlight' ? (
              <SpotlightShape a={a} w={w} h={h} />
            ) : (
              <Glyph a={a} w={w} h={h} minDim={minDim} fontFamily={fontFamily} />
            )}

            {/* near-invisible hit area, so hairline outlines and the spotlight
                hole are still grabbable */}
            {boxy && <Rect width={bw} height={bh} fill="rgba(0,0,0,0.002)" />}

            {isSel && boxy && (
              <Rect
                name={NO_EXPORT}
                width={bw}
                height={bh}
                stroke="#b3a4f5"
                strokeWidth={outline}
                dash={dash}
                listening={false}
              />
            )}
            {isSel && !boxy && (
              <Circle
                name={NO_EXPORT}
                radius={a.size * minDim * (a.kind === 'badge' ? 1.55 : 1.15)}
                x={a.kind === 'pointer' ? a.size * minDim * 0.36 : 0}
                y={a.kind === 'pointer' ? a.size * minDim * 0.55 : 0}
                stroke="#b3a4f5"
                strokeWidth={outline}
                dash={dash}
                listening={false}
              />
            )}
          </Group>
        )
      })}

      {boxySelected && (
        <Transformer
          ref={trRef}
          name={NO_EXPORT}
          rotateEnabled={!!sel && canRotate(sel.kind)}
          keepRatio={false}
          ignoreStroke
          anchorSize={ANCHOR_SCREEN_PX / Math.max(fit, 0.05)}
          anchorStroke="#b3a4f5"
          anchorFill="#ffffff"
          anchorStrokeWidth={1 / Math.max(fit, 0.05)}
          anchorCornerRadius={2}
          borderStroke="#b3a4f5"
          borderStrokeWidth={1.5 / Math.max(fit, 0.05)}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < minDim * 0.03 || newBox.height < minDim * 0.03 ? oldBox : newBox
          }
        />
      )}
    </>
  )
}
