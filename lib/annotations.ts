export type AnnoKind = 'pointer' | 'arrow' | 'badge' | 'box' | 'ellipse' | 'spotlight'

/**
 * All geometry is stored as a fraction of the canvas, exactly like frame
 * padding and text size. That is what lets an annotation survive a switch from
 * 1600x900 to 1080x1920 instead of sliding off the edge.
 */
export interface Anno {
  id: string
  kind: AnnoKind
  x: number
  y: number
  w: number
  h: number
  /** arrow head; unused by other kinds */
  x2: number
  y2: number
  rotation: number
  color: string
  /** stroke / glyph size, as a fraction of min(canvasW, canvasH) */
  size: number
  label: string
  filled: boolean
  /** spotlight only: how dark everything outside the hole goes */
  dim: number
}

export const ANNO_KINDS: { id: AnnoKind; label: string }[] = [
  { id: 'pointer', label: 'Pointer' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'badge', label: 'Step' },
  { id: 'box', label: 'Box' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'spotlight', label: 'Spotlight' },
]

/** Kinds the Transformer can resize; the rest are moved and sized by slider. */
export const BOXY: AnnoKind[] = ['box', 'ellipse', 'spotlight']

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Next unused step number, so deleting #2 of 3 does not create a duplicate. */
export function nextBadgeLabel(annos: Anno[]): string {
  const used = new Set(
    annos.filter((a) => a.kind === 'badge').map((a) => Number(a.label)).filter((n) => n > 0),
  )
  let n = 1
  while (used.has(n)) n++
  return String(n)
}

export function createAnno(kind: AnnoKind, id: string, annos: Anno[] = []): Anno {
  const base: Anno = {
    id,
    kind,
    x: 0.4,
    y: 0.4,
    w: 0.2,
    h: 0.16,
    x2: 0.6,
    y2: 0.58,
    rotation: 0,
    color: '#ff2d55',
    size: 0.008,
    label: '',
    filled: false,
    dim: 0.55,
  }
  switch (kind) {
    case 'pointer':
      return { ...base, x: 0.45, y: 0.42, size: 0.055, color: '#ffffff' }
    case 'arrow':
      return { ...base, x: 0.3, y: 0.3, x2: 0.46, y2: 0.46, size: 0.007 }
    case 'badge':
      return { ...base, x: 0.45, y: 0.42, size: 0.032, label: nextBadgeLabel(annos), color: '#ff2d55' }
    case 'box':
      return { ...base, size: 0.005 }
    case 'ellipse':
      return { ...base, size: 0.005 }
    case 'spotlight':
      return { ...base, x: 0.32, y: 0.28, w: 0.36, h: 0.4, dim: 0.55 }
    default:
      return base
  }
}

/** Keep a dragged annotation from vanishing off the canvas. */
export function clampAnno(a: Anno): Anno {
  if (a.kind === 'arrow') {
    return { ...a, x: clamp01(a.x), y: clamp01(a.y), x2: clamp01(a.x2), y2: clamp01(a.y2) }
  }
  if (BOXY.includes(a.kind)) {
    const w = Math.min(Math.max(a.w, 0.02), 1)
    const h = Math.min(Math.max(a.h, 0.02), 1)
    return { ...a, w, h, x: Math.min(Math.max(a.x, -w * 0.5), 1 - w * 0.5), y: Math.min(Math.max(a.y, -h * 0.5), 1 - h * 0.5) }
  }
  return { ...a, x: clamp01(a.x), y: clamp01(a.y) }
}

/**
 * Cursor glyph in unit space, tip at (0,0). Drawn as a closed polygon so it
 * scales cleanly and needs no bitmap.
 */
export const POINTER_PATH = [
  0, 0, 0, 1.0, 0.26, 0.74, 0.42, 1.1, 0.6, 1.02, 0.44, 0.67, 0.72, 0.66,
]
