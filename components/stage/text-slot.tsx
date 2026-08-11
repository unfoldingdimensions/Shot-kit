'use client'
import { Group, Text } from 'react-konva'
import type { Box, SlotPos } from '@/lib/geometry'
import type { TextBlockMetrics } from '@/lib/measure'
import type { TextSlot } from '@/lib/state'

export function TextSlotView({
  pos,
  box,
  slot,
  size,
  subSize,
  metrics,
  fontFamily,
}: {
  pos: SlotPos
  box: Box
  slot: TextSlot
  size: number
  subSize: number
  metrics: TextBlockMetrics
  fontFamily: string
}) {
  if (!slot.on || box.w <= 0 || box.h <= 0) return null
  if (!slot.heading && !slot.sub) return null

  const rotated = slot.rotate && (pos === 'left' || pos === 'right')
  const style = `${slot.italic ? 'italic ' : ''}${slot.weight}`
  const headingH = metrics.headingLines * size * slot.lineHeight
  const gap = metrics.headingLines && metrics.subLines ? size * 0.3 : 0

  // the band is sized to the block, but centre anyway in case it got clamped
  const runLength = rotated ? box.h : box.w
  const across = rotated ? box.w : box.h
  const offset = Math.max(0, (across - metrics.height) / 2)

  const body = (
    <>
      {slot.heading && (
        <Text
          y={offset}
          width={runLength}
          align={slot.align}
          text={slot.heading}
          fontSize={size}
          fontFamily={fontFamily}
          fontStyle={style}
          fill={slot.color}
          lineHeight={slot.lineHeight}
          letterSpacing={slot.tracking * size}
          wrap="word"
        />
      )}
      {slot.sub && (
        <Text
          y={offset + headingH + gap}
          width={runLength}
          align={slot.align}
          text={slot.sub}
          fontSize={subSize}
          fontFamily={fontFamily}
          fontStyle={slot.italic ? 'italic 400' : '400'}
          fill={slot.color}
          opacity={0.72}
          lineHeight={1.45}
          letterSpacing={slot.tracking * subSize * 0.5}
          wrap="word"
        />
      )}
    </>
  )

  if (!rotated) {
    return (
      <Group x={box.x} y={box.y} listening={false}>
        {body}
      </Group>
    )
  }

  // -90 runs bottom-to-top down the left edge, +90 top-to-bottom down the right
  return pos === 'left' ? (
    <Group x={box.x} y={box.y + box.h} rotation={-90} listening={false}>
      {body}
    </Group>
  ) : (
    <Group x={box.x + box.w} y={box.y} rotation={90} listening={false}>
      {body}
    </Group>
  )
}
