export type AnnoKind = 'pointer' | 'arrow' | 'badge' | 'box' | 'ellipse' | 'spotlight' | 'redact'

export type RedactMode = 'pixelate' | 'blur' | 'solid'

export const REDACT_MODES: { id: RedactMode; label: string }[] = [
  { id: 'pixelate', label: 'Pixelate' },
  { id: 'blur', label: 'Blur' },
  { id: 'solid', label: 'Solid' },
]

/**
 * All geometry is stored as a fraction of the canvas, exactly like frame
 * padding and text size. That is what lets an annotation survive a switch from
 * 1600x900 to 1080x1920 instead of sliding off the edge.
 */
export interface Anno {
  id: string
  kind: AnnoKind
  /**
   * For `redact` these are fractions of the SCREENSHOT, not the canvas — see
   * FRAME_SPACE. Everything else is canvas-relative.
   */
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
  /** redact only */
  redactMode: RedactMode
  /** redact only: pixel block count, or blur strength */
  intensity: number
}

export const ANNO_KINDS: { id: AnnoKind; label: string }[] = [
  { id: 'pointer', label: 'Pointer' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'badge', label: 'Step' },
  { id: 'box', label: 'Box' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'redact', label: 'Redact' },
]

/** Kinds the Transformer can resize; the rest are moved and sized by slider. */
export const BOXY: AnnoKind[] = ['box', 'ellipse', 'spotlight', 'redact']

/**
 * Kinds that may be rotated.
 *
 * A spotlight is a full-canvas dim with a hole punched in it, and both live in
 * the same group — rotating swung the dim rectangle off the canvas and left the
 * corners undimmed. Redaction inherits the window's rotation instead, so an
 * extra one of its own would break its mapping onto source pixels.
 */
export const ROTATABLE: AnnoKind[] = ['box', 'ellipse']
export const canRotate = (k: AnnoKind) => ROTATABLE.includes(k)

/**
 * Kinds that live inside the window frame rather than on the canvas. They are
 * drawn as children of the frame group, so they inherit its rotation and skew,
 * and their coordinates map straight onto source-image pixels — which is what
 * makes a real pixelate possible instead of a grey box.
 */
export const FRAME_SPACE: AnnoKind[] = ['redact']

export const inFrameSpace = (k: AnnoKind) => FRAME_SPACE.includes(k)

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
    redactMode: 'pixelate',
    intensity: 14,
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
    case 'redact':
      // image-relative: a wide, short strip is what an email or API key looks like
      return { ...base, x: 0.28, y: 0.42, w: 0.34, h: 0.09, redactMode: 'pixelate', intensity: 14 }
    default:
      return base
  }
}

/**
 * Shift an arrow by (dx, dy), keeping BOTH endpoints on canvas.
 *
 * Clamping the endpoints independently would let one end stop at the edge while
 * the other kept going, silently reshaping the arrow mid-drag. Clamping the
 * delta instead moves it rigidly and just stops at the boundary.
 */
export function moveArrow(a: Anno, dx: number, dy: number): Anno {
  const clampDelta = (d: number, p1: number, p2: number) => {
    const lo = -Math.min(p1, p2)
    const hi = 1 - Math.max(p1, p2)
    return Math.min(Math.max(d, lo), hi)
  }
  const cx = clampDelta(dx, a.x, a.x2)
  const cy = clampDelta(dy, a.y, a.y2)
  return { ...a, x: a.x + cx, y: a.y + cy, x2: a.x2 + cx, y2: a.y2 + cy }
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

/** On-screen size of a resize handle, in CSS pixels. */
export const ANCHOR_SCREEN_PX = 8

/**
 * Resize-handle size in canvas units.
 *
 * Handles are a constant size *on screen*, not in canvas units. A redaction is
 * usually a thin strip over one line of text; sizing handles in canvas units
 * made them balloon as the canvas grew and swamp the very thing you are
 * checking is hidden. Constant-on-screen also means zooming in makes the
 * handles occupy proportionally less of the region, so zoom is a real remedy.
 * Capped at half the region so a tiny box is never buried under its own grips.
 */
export function anchorFor(a: Anno, imgW: number, imgH: number, stageScale: number) {
  const shortest = Math.min(a.w * imgW, a.h * imgH)
  const constantOnScreen = ANCHOR_SCREEN_PX / Math.max(stageScale, 0.05)
  return Math.min(constantOnScreen, Math.max(shortest * 0.5, 1))
}

/**
 * Cursor glyph in unit space, tip at (0,0). Drawn as a closed polygon so it
 * scales cleanly and needs no bitmap.
 */
export const POINTER_PATH = [
  0, 0, 0, 1.0, 0.26, 0.74, 0.42, 1.1, 0.6, 1.02, 0.44, 0.67, 0.72, 0.66,
]
