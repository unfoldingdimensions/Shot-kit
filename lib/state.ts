import type { ChromeKind, ChromeOS, ChromeTheme } from './chrome'
import type { SlotPos } from './geometry'
import { GRADIENTS } from './gradients'
import { findPreset } from './presets'

export type BgMode = 'gradient' | 'solid' | 'image' | 'transparent'
export type Align = 'left' | 'center' | 'right'

export interface TextSlot {
  on: boolean
  heading: string
  sub: string
  font: string
  size: number // relative to canvas: fraction of min(w,h)
  weight: number
  italic: boolean
  color: string
  align: Align
  tracking: number
  lineHeight: number
  rotate: boolean // left/right slots only
}

export interface State {
  presetId: string
  width: number
  height: number

  image: { src: string | null; w: number; h: number; name: string }

  bg: {
    mode: BgMode
    stops: string[]
    angle: number
    solid: string
    imageSrc: string | null
    imageBlur: number
    imageDim: number
    grain: number
    vignette: number
  }

  frame: {
    padding: number // fraction of min(w,h)
    radius: number // fraction of frame width
    scale: number
    rotation: number
    skewX: number
    shadowBlur: number
    shadowOffsetY: number
    shadowOpacity: number
    glassEdge: boolean
    chrome: ChromeKind
    os: ChromeOS
    theme: ChromeTheme
    url: string
    filename: string
    title: string
  }

  text: Record<SlotPos, TextSlot>

  out: { format: 'png' | 'jpg'; quality: number; scale: number }
}

function slot(over: Partial<TextSlot> = {}): TextSlot {
  return {
    on: false,
    heading: '',
    sub: '',
    font: 'inter-tight',
    size: 0.062,
    weight: 700,
    italic: false,
    color: '#0d0d0f',
    align: 'center',
    tracking: -0.02,
    lineHeight: 1.12,
    rotate: false,
    ...over,
  }
}

export const initialState: State = {
  presetId: 'x-landscape',
  width: 1600,
  height: 900,
  image: { src: null, w: 0, h: 0, name: '' },
  bg: {
    mode: 'gradient',
    stops: GRADIENTS[0].stops,
    angle: GRADIENTS[0].angle,
    solid: '#ececeb',
    imageSrc: null,
    imageBlur: 0,
    imageDim: 0,
    grain: 0,
    vignette: 0,
  },
  frame: {
    padding: 0.07,
    radius: 0.016,
    scale: 1,
    rotation: 0,
    skewX: 0,
    // matches the "Deep" preset — a faint shadow reads as flat once the image
    // is scaled down into a feed
    shadowBlur: 0.11,
    shadowOffsetY: 0.05,
    shadowOpacity: 0.4,
    glassEdge: true,
    chrome: 'browser',
    os: 'mac',
    theme: 'light',
    url: 'yourapp.com/dashboard',
    filename: 'index.tsx',
    title: 'Settings',
  },
  text: {
    top: slot({ on: true, heading: 'Ship it looking sharp', sub: '' }),
    bottom: slot({ size: 0.042, weight: 500 }),
    left: slot({ size: 0.038, weight: 600, align: 'left', rotate: true }),
    right: slot({ size: 0.038, weight: 600, align: 'right', rotate: true }),
  },
  out: { format: 'png', quality: 0.92, scale: 2 },
}

// --- actions ---------------------------------------------------------------

export type Action =
  | { type: 'patch'; patch: Partial<State> }
  | { type: 'bg'; patch: Partial<State['bg']> }
  | { type: 'frame'; patch: Partial<State['frame']> }
  | { type: 'out'; patch: Partial<State['out']> }
  | { type: 'slot'; pos: SlotPos; patch: Partial<TextSlot> }
  | { type: 'preset'; id: string }
  | { type: 'size'; w: number; h: number }
  | { type: 'image'; src: string; w: number; h: number; name: string }
  | { type: 'reset' }
  | { type: 'load'; state: State }
  | { type: 'undo' }
  | { type: 'redo' }

export interface History {
  present: State
  past: State[]
  future: State[]
}

const LIMIT = 60

/** Actions that shouldn't create an undo step of their own. */
const TRANSIENT = new Set(['undo', 'redo', 'load'])

export function reducer(h: History, a: Action): History {
  if (a.type === 'undo') {
    const prev = h.past[h.past.length - 1]
    if (!prev) return h
    return { present: prev, past: h.past.slice(0, -1), future: [h.present, ...h.future].slice(0, LIMIT) }
  }
  if (a.type === 'redo') {
    const next = h.future[0]
    if (!next) return h
    return { present: next, past: [...h.past, h.present].slice(-LIMIT), future: h.future.slice(1) }
  }
  if (a.type === 'load') return { present: a.state, past: [], future: [] }

  const next = apply(h.present, a)
  if (next === h.present) return h
  if (TRANSIENT.has(a.type)) return { ...h, present: next }
  return { present: next, past: [...h.past, h.present].slice(-LIMIT), future: [] }
}

function apply(s: State, a: Action): State {
  switch (a.type) {
    case 'patch':
      return { ...s, ...a.patch }
    case 'bg':
      return { ...s, bg: { ...s.bg, ...a.patch } }
    case 'frame':
      return { ...s, frame: { ...s.frame, ...a.patch } }
    case 'out':
      return { ...s, out: { ...s.out, ...a.patch } }
    case 'slot':
      return { ...s, text: { ...s.text, [a.pos]: { ...s.text[a.pos], ...a.patch } } }
    case 'preset': {
      const p = findPreset(a.id)
      return p ? { ...s, presetId: p.id, width: p.w, height: p.h } : s
    }
    case 'size':
      return { ...s, presetId: 'custom', width: clampDim(a.w), height: clampDim(a.h) }
    case 'image':
      return { ...s, image: { src: a.src, w: a.w, h: a.h, name: a.name } }
    case 'reset':
      return { ...initialState, image: s.image }
    default:
      return s
  }
}

export function clampDim(n: number) {
  return Math.max(64, Math.min(8000, Math.round(n || 0)))
}
