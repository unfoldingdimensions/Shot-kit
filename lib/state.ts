import { clampAnno, type Anno } from './annotations'
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

  annos: Anno[]

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
  annos: [],
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
  | { type: 'annoAdd'; anno: Anno }
  | { type: 'annoPatch'; id: string; patch: Partial<Anno> }
  /** mid-gesture frame: only the first one records history */
  | { type: 'annoDrag'; id: string; patch: Partial<Anno> }
  /** end of a gesture: closes it without recording a second step */
  | { type: 'annoCommit'; id: string; patch: Partial<Anno> }
  | { type: 'annoRemove'; id: string }
  | { type: 'annoClear' }
  /** restore one panel's settings to defaults, leaving the rest alone */
  | { type: 'resetSection'; section: 'bg' | 'frame' | 'text' | 'out' | 'size' }
  /** everything back to defaults; keeps the screenshot itself */
  | { type: 'reset' }
  | { type: 'load'; state: State }
  | { type: 'undo' }
  | { type: 'redo' }

export interface History {
  present: State
  past: State[]
  future: State[]
  /**
   * A drag/transform is mid-flight and its pre-gesture state is already on the
   * undo stack. Without this, a gesture either records nothing (so undo jumps
   * past it) or records every frame (so undo crawls back a pixel at a time).
   */
  gesture: boolean
}

export const initialHistory: History = {
  present: initialState,
  past: [],
  future: [],
  gesture: false,
}

const LIMIT = 60

export function reducer(h: History, a: Action): History {
  if (a.type === 'undo') {
    const prev = h.past[h.past.length - 1]
    if (!prev) return h
    return {
      present: prev,
      past: h.past.slice(0, -1),
      future: [h.present, ...h.future].slice(0, LIMIT),
      gesture: false,
    }
  }
  if (a.type === 'redo') {
    const next = h.future[0]
    if (!next) return h
    return {
      present: next,
      past: [...h.past, h.present].slice(-LIMIT),
      future: h.future.slice(1),
      gesture: false,
    }
  }
  if (a.type === 'load') return { present: a.state, past: [], future: [], gesture: false }

  const next = apply(h.present, a)
  if (next === h.present) return h

  const record = (gesture: boolean): History => ({
    present: next,
    past: [...h.past, h.present].slice(-LIMIT),
    future: [],
    gesture,
  })

  // first frame of a gesture records the starting point; the rest just move
  if (a.type === 'annoDrag') return h.gesture ? { ...h, present: next } : record(true)
  // the gesture already recorded its start, so closing it must not record again
  if (a.type === 'annoCommit') return h.gesture ? { ...h, present: next, gesture: false } : record(false)
  return record(false)
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
      if (!p) return s
      // returning a fresh object for an unchanged value would record a useless
      // undo step — re-picking the preset you are already on
      if (s.presetId === p.id && s.width === p.w && s.height === p.h) return s
      return { ...s, presetId: p.id, width: p.w, height: p.h }
    }
    case 'size': {
      const w = clampDim(a.w)
      const h = clampDim(a.h)
      if (s.presetId === 'custom' && s.width === w && s.height === h) return s
      return { ...s, presetId: 'custom', width: w, height: h }
    }
    case 'image':
      return { ...s, image: { src: a.src, w: a.w, h: a.h, name: a.name } }
    case 'annoAdd':
      return { ...s, annos: [...s.annos, clampAnno(a.anno)] }
    case 'annoPatch':
    case 'annoDrag':
    case 'annoCommit': {
      let hit = false
      const annos = s.annos.map((x) => {
        if (x.id !== a.id) return x
        hit = true
        return clampAnno({ ...x, ...a.patch })
      })
      return hit ? { ...s, annos } : s
    }
    case 'annoRemove': {
      const annos = s.annos.filter((x) => x.id !== a.id)
      return annos.length === s.annos.length ? s : { ...s, annos }
    }
    case 'annoClear':
      return s.annos.length ? { ...s, annos: [] } : s
    case 'resetSection':
      switch (a.section) {
        case 'bg':
          return { ...s, bg: { ...initialState.bg } }
        case 'frame':
          return { ...s, frame: { ...initialState.frame } }
        case 'text':
          return { ...s, text: structuredClone(initialState.text) }
        case 'out':
          return { ...s, out: { ...initialState.out } }
        case 'size':
          return {
            ...s,
            presetId: initialState.presetId,
            width: initialState.width,
            height: initialState.height,
          }
      }
    // falls through to `reset` only if a new section is added without a case
    // eslint-disable-next-line no-fallthrough
    case 'reset':
      return { ...initialState, image: s.image }
    default:
      return s
  }
}

export function clampDim(n: number) {
  return Math.max(64, Math.min(8000, Math.round(n || 0)))
}
