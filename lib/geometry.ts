export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export type SlotPos = 'top' | 'bottom' | 'left' | 'right'

const nn = (n: number) => (n > 0 ? n : 0)

/** Scale that makes an output-sized canvas fit the visible workspace. */
export function fitToViewport(w: number, h: number, availW: number, availH: number) {
  if (w <= 0 || h <= 0) return 1
  return Math.min(availW / w, availH / h, 1)
}

/**
 * Frame = chrome bar + image, so total height is width*(1/aspect + barRatio).
 * Fit that whole block into `box` and centre it.
 */
export function fitFrame(box: Box, aspect: number, barRatio: number, scale: number): Box {
  const ratio = 1 / Math.max(aspect, 0.01) + barRatio
  const w = Math.min(box.w, box.h / ratio) * scale
  const h = w * ratio
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w: nn(w), h: nn(h) }
}

/**
 * Reserve a band per enabled text slot, then fit the frame into what is left.
 * Top/bottom span the full inner width; left/right occupy the middle band —
 * the arrangement that reads best for a headline above and a caption below.
 */
export function layout(opts: {
  width: number
  height: number
  padding: number
  aspect: number
  barRatio: number
  frameScale: number
  reserve: Partial<Record<SlotPos, number>>
  gap: number
}): { frame: Box; slots: Record<SlotPos, Box> } {
  const { width, height, padding, aspect, barRatio, frameScale, gap } = opts
  const inner: Box = {
    x: padding,
    y: padding,
    w: nn(width - padding * 2),
    h: nn(height - padding * 2),
  }

  const band = (pos: SlotPos) => {
    const v = opts.reserve[pos] ?? 0
    return v > 0 ? v + gap : 0
  }
  let [rt, rb, rl, rr] = [band('top'), band('bottom'), band('left'), band('right')]

  // never let text bands eat the frame entirely
  const vMax = inner.h * 0.7
  if (rt + rb > vMax && rt + rb > 0) {
    const k = vMax / (rt + rb)
    rt *= k
    rb *= k
  }
  const hMax = inner.w * 0.5
  if (rl + rr > hMax && rl + rr > 0) {
    const k = hMax / (rl + rr)
    rl *= k
    rr *= k
  }

  const midY = inner.y + rt
  const midH = nn(inner.h - rt - rb)

  const frameBox: Box = { x: inner.x + rl, y: midY, w: nn(inner.w - rl - rr), h: midH }

  return {
    frame: fitFrame(frameBox, aspect, barRatio, frameScale),
    slots: {
      top: { x: inner.x, y: inner.y, w: inner.w, h: nn(rt - gap) },
      bottom: { x: inner.x, y: inner.y + inner.h - rb + gap, w: inner.w, h: nn(rb - gap) },
      left: { x: inner.x, y: midY, w: nn(rl - gap), h: midH },
      right: { x: inner.x + inner.w - rr + gap, y: midY, w: nn(rr - gap), h: midH },
    },
  }
}

/** Gradient endpoints for an angle in degrees (0 = left→right, 90 = top→bottom). */
export function gradientPoints(angle: number, w: number, h: number) {
  const rad = (angle * Math.PI) / 180
  const cx = w / 2
  const cy = h / 2
  // project onto the box so the gradient always spans the full diagonal extent
  const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))
  const dx = (Math.cos(rad) * len) / 2
  const dy = (Math.sin(rad) * len) / 2
  return { start: { x: cx - dx, y: cy - dy }, end: { x: cx + dx, y: cy + dy } }
}

/** Cover-fit (like CSS background-size: cover) for a bitmap in a box. */
export function coverRect(box: Box, iw: number, ih: number): Box {
  if (iw <= 0 || ih <= 0) return box
  const s = Math.max(box.w / iw, box.h / ih)
  const w = iw * s
  const h = ih * s
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }
}
