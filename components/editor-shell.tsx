'use client'
import {
  Aperture,
  Frame as FrameIcon,
  Github,
  Image as ImageIcon,
  MousePointer2,
  Palette,
  Redo2,
  RotateCcw,
  Share2,
  Type,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { copyToClipboard, download, filenameFor } from '@/lib/export'
import { FONTS } from '@/lib/fonts'
import { gradientFromColors, paletteFromImage } from '@/lib/colors'
import { clearImage, loadImage, saveImage } from '@/lib/idb'
import { findPreset } from '@/lib/presets'
import { initialHistory, initialState, reducer, type Action, type State } from '@/lib/state'
import type { Anno } from '@/lib/annotations'
import { AnnotatePanel } from './panels/annotate-panel'
import { BackgroundPanel } from './panels/background-panel'
import { ExportPanel } from './panels/export-panel'
import { FramePanel } from './panels/frame-panel'
import { ImagePanel } from './panels/image-panel'
import { TextPanel } from './panels/text-panel'
import type { CanvasStage as CanvasStageType, StageApi } from './stage/canvas-stage'

/**
 * Konva cannot render on the server, so the scene has to load client-side only.
 * A plain promise in an effect rather than next/dynamic: `ssr: false` emits a
 * bail-out-to-CSR Suspense boundary that can get stuck unresolved, and it does
 * not forward refs — and we need the ref to drive exports.
 */
function useCanvasStage() {
  const [Comp, setComp] = useState<typeof CanvasStageType | null>(null)
  useEffect(() => {
    let live = true
    import('./stage/canvas-stage').then((m) => {
      if (live) setComp(m.CanvasStage)
    })
    return () => {
      live = false
    }
  }, [])
  return Comp
}

type Section = 'image' | 'background' | 'frame' | 'text' | 'annotate' | 'export'

const NAV: { id: Section; label: string; icon: typeof ImageIcon }[] = [
  { id: 'image', label: 'Screenshot', icon: ImageIcon },
  { id: 'background', label: 'Background', icon: Palette },
  { id: 'frame', label: 'Window', icon: FrameIcon },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'annotate', label: 'Annotate', icon: MousePointer2 },
  { id: 'export', label: 'Export', icon: Share2 },
]

const STORE_KEY = 'shotkit:v1'

/** Styling persists; image data does not — data URLs blow the 5MB quota. */
function persistable(s: State) {
  return { ...s, image: { src: null, w: 0, h: 0, name: '' }, bg: { ...s.bg, imageSrc: null } }
}

function readFile(file: File): Promise<{ src: string; w: number; h: number; name: string }> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('could not read file'))
    fr.onload = () => {
      const src = String(fr.result)
      const i = new window.Image()
      i.onload = () => resolve({ src, w: i.naturalWidth, h: i.naturalHeight, name: file.name })
      i.onerror = () => reject(new Error('not an image'))
      i.src = src
    }
    fr.readAsDataURL(file)
  })
}

export function EditorShell() {
  const [hist, dispatch] = useReducer(reducer, initialHistory)
  const state = hist.present
  const [section, setSection] = useState<Section>('image')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [restored, setRestored] = useState(false)
  const stage = useRef<StageApi>(null)
  const CanvasStage = useCanvasStage()
  const fileInput = useRef<HTMLInputElement>(null)
  const target = useRef<'screenshot' | 'background'>('screenshot')

  const act = useCallback((a: Action) => dispatch(a), [])
  const annoDrag = useCallback(
    (id: string, patch: Partial<Anno>) => dispatch({ type: 'annoDrag', id, patch }),
    [],
  )
  const annoCommit = useCallback(
    (id: string, patch: Partial<Anno>) => dispatch({ type: 'annoCommit', id, patch }),
    [],
  )

  // --- restore / persist ----------------------------------------------------
  useEffect(() => {
    let live = true
    ;(async () => {
      let next: State = initialState
      try {
        const raw = localStorage.getItem(STORE_KEY)
        if (raw) next = { ...initialState, ...JSON.parse(raw) }
      } catch {
        /* corrupt or unavailable storage is not worth failing over */
      }
      try {
        const [shot, backdrop] = await Promise.all([
          loadImage('screenshot'),
          loadImage('background'),
        ])
        if (shot?.src) next = { ...next, image: shot }
        if (backdrop?.src) next = { ...next, bg: { ...next.bg, imageSrc: backdrop.src } }
      } catch {
        /* private mode, or no IndexedDB */
      }
      // If the backdrop could not be restored, "image" mode would render a
      // blank canvas with no way to tell why. Fall back to the gradient.
      if (next.bg.mode === 'image' && !next.bg.imageSrc) {
        next = { ...next, bg: { ...next.bg, mode: 'gradient' } }
      }
      // one dispatch, so restoring never lands on the undo stack
      if (live) {
        act({ type: 'load', state: next })
        setRestored(true)
      }
    })()
    return () => {
      live = false
    }
  }, [act])

  useEffect(() => {
    if (!restored) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(persistable(state)))
      } catch {
        /* quota */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [state, restored])

  // dropped images go to IndexedDB; gated on `restored` so the empty initial
  // state cannot wipe what was stored before it has been read back
  useEffect(() => {
    if (!restored) return
    const { src, w, h, name } = state.image
    if (!src) clearImage('screenshot').catch(() => {})
    else saveImage('screenshot', { src, w, h, name }).catch(() => {})
  }, [state.image, restored])

  useEffect(() => {
    if (!restored) return
    const src = state.bg.imageSrc
    if (!src) clearImage('background').catch(() => {})
    else saveImage('background', { src, w: 0, h: 0, name: '' }).catch(() => {})
  }, [state.bg.imageSrc, restored])

  // --- image intake --------------------------------------------------------
  const accept = useCallback(
    async (file: File, into: 'screenshot' | 'background' = 'screenshot') => {
      if (!file.type.startsWith('image/')) {
        setError('That file is not an image.')
        return
      }
      try {
        const r = await readFile(file)
        if (into === 'background') act({ type: 'bg', patch: { imageSrc: r.src, mode: 'image' } })
        else act({ type: 'image', ...r })
        setError(null)
      } catch {
        setError('That image could not be read.')
      }
    },
    [act],
  )

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return
      const file = [...(e.clipboardData?.items ?? [])]
        .find((i) => i.kind === 'file' && i.type.startsWith('image/'))
        ?.getAsFile()
      if (file) {
        e.preventDefault()
        accept(file)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [accept])

  // --- shortcuts -----------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        act({ type: e.shiftKey ? 'redo' : 'undo' })
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        doDownload()
      }
      if (e.key === 'Escape' && selected) setSelected(null)
      // Delete only — Backspace is too easy to hit by accident for a
      // destructive action, and Escape already covers "get me out of this"
      if (e.key === 'Delete' && selected) {
        e.preventDefault()
        act({ type: 'annoRemove', id: selected })
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // --- export --------------------------------------------------------------
  const render = () => {
    const format = state.bg.mode === 'transparent' ? 'png' : state.out.format
    return stage.current?.exportImage({ format, quality: state.out.quality, scale: state.out.scale })
  }

  function doDownload() {
    const r = render()
    if (!r) return
    const label = findPreset(state.presetId)?.label ?? 'custom'
    const format = state.bg.mode === 'transparent' ? 'png' : state.out.format
    download(r.dataUrl, filenameFor(label, r.w, r.h, format))
  }

  async function doCopy() {
    const r = render()
    if (!r) return
    try {
      await copyToClipboard(r.dataUrl)
    } catch {
      setError('Clipboard write was blocked — use Download instead.')
    }
  }

  function autoGradient() {
    if (!state.image.src) return
    const i = new window.Image()
    i.onload = () => act({ type: 'bg', patch: gradientFromColors(paletteFromImage(i)) })
    i.src = state.image.src
  }

  const pick = (into: 'screenshot' | 'background') => {
    target.current = into
    fileInput.current?.click()
  }

  return (
    <div className="flex h-dvh gap-2 bg-ink p-2 sm:gap-3 sm:p-3">
      {/* faces must exist in the DOM for the browser to fetch them; Konva draws
          to canvas and would otherwise never trigger a load */}
      <div aria-hidden className="pointer-events-none fixed -left-[9999px] top-0">
        {FONTS.map((f) => (
          <span key={f.id} className={f.className}>
            <b>Aa</b>
            <i>Aa</i>
          </span>
        ))}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) accept(f, target.current)
          e.target.value = ''
        }}
      />

      {/* ---- sidebar ---- */}
      <aside className="hidden w-52 shrink-0 flex-col justify-between md:flex">
        <div>
          <div className="mb-7 flex items-center gap-2 px-4 pt-4">
            {/* deliberately not FrameIcon — that is the Window nav item, and a
                logo that repeats a nav glyph reads as a sixth nav entry */}
            <span className="grid size-7 place-items-center rounded-lg bg-lime">
              <Aperture size={15} className="text-ink" />
            </span>
            <span className="font-display text-[17px] font-bold tracking-tight text-white">
              shotkit
            </span>
          </div>
          <nav className="space-y-1">
            {NAV.map((n) => {
              const on = section === n.id
              return (
                <button
                  key={n.id}
                  type="button"
                  aria-current={on ? 'page' : undefined}
                  onClick={() => setSection(n.id)}
                  className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors ${
                    on ? 'bg-white text-ink' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <n.icon size={16} />
                  {n.label}
                  {n.id === 'image' && !state.image.src && (
                    <span className="ml-auto grid size-5 place-items-center rounded-full bg-lime text-[10px] font-bold text-ink">
                      1
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        <a
          href="https://github.com/unfoldingdimensions/Shot-kit"
          target="_blank"
          rel="noreferrer noopener"
          className="m-1 block rounded-card bg-lime p-4 transition-transform hover:-translate-y-0.5"
        >
          <p className="font-display text-[16px] leading-tight font-bold tracking-tight text-ink">
            Free & open source
          </p>
          <p className="mt-1 text-[11px] leading-snug text-ink/70">
            Nothing uploads. Everything runs in your browser.
          </p>
          <span className="mt-3 flex items-center justify-center gap-2 rounded-full bg-ink px-3 py-2 text-[12px] font-semibold text-white">
            <Github size={13} /> Star on GitHub
          </span>
        </a>
      </aside>

      {/* ---- main ---- */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-shell bg-paper">
        <header className="flex items-center gap-3 px-5 pt-5 pb-4">
          <div className="min-w-0">
            <h1 className="font-display truncate text-[26px] leading-none font-extrabold tracking-tight text-ink sm:text-[32px]">
              Shotkit
            </h1>
            <p className="mt-1.5 text-[12px] text-muted">
              Drop a screenshot, frame it, post it.
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex gap-1 rounded-full bg-white p-1">
              <button
                type="button"
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                disabled={!hist.past.length}
                onClick={() => act({ type: 'undo' })}
                className="rounded-full p-2 text-muted hover:text-ink disabled:opacity-30"
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                disabled={!hist.future.length}
                onClick={() => act({ type: 'redo' })}
                className="rounded-full p-2 text-muted hover:text-ink disabled:opacity-30"
              >
                <Redo2 size={15} />
              </button>
            </div>
            {/* two-step: one stray click should not destroy a composition */}
            <button
              type="button"
              title="Reset every setting to defaults (keeps your screenshot)"
              onClick={() => {
                if (!confirmReset) {
                  setConfirmReset(true)
                  setTimeout(() => setConfirmReset(false), 3000)
                  return
                }
                setConfirmReset(false)
                setSelected(null)
                act({ type: 'reset' })
              }}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-3 text-[12px] font-semibold transition-colors ${
                confirmReset ? 'bg-lime text-ink' : 'bg-white text-muted hover:text-ink'
              }`}
            >
              <RotateCcw size={14} />
              {confirmReset ? 'Confirm reset' : 'Reset all'}
            </button>
            <button
              type="button"
              onClick={doDownload}
              className="rounded-full bg-ink px-5 py-3 text-[13px] font-semibold text-white hover:bg-ink-2"
            >
              Download
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 lg:flex-row">
          {/* canvas */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            // dragleave also fires when the pointer crosses into a child, and
            // the stage covers this whole box — so only clear when the pointer
            // has genuinely left the container
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) accept(f)
            }}
            className={`relative min-h-64 flex-1 overflow-hidden rounded-card border-2 border-dashed transition-colors ${
              dragging ? 'border-lav bg-lav/10' : 'border-transparent'
            }`}
          >
            {/* explicit box: the stage measures its parent, so it cannot be
                content-sized or the measurement is circular */}
            <div className="absolute inset-3">
              {CanvasStage && (
                <CanvasStage
                  ref={stage}
                  state={state}
                  selected={selected}
                  onSelect={setSelected}
                  onAnnoDrag={annoDrag}
                  onAnnoCommit={annoCommit}
                />
              )}
            </div>

            {!state.image.src && !dragging && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center">
                <span className="rounded-full bg-ink/85 px-4 py-2 text-[12px] font-medium text-white">
                  Drop a screenshot, or press Ctrl+V to paste
                </span>
              </div>
            )}
            {dragging && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white">
                  Drop to place
                </span>
              </div>
            )}
            {error && (
              <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-3 rounded-ctl bg-ink px-4 py-2.5 text-[12px] text-white">
                {error}
                <button type="button" onClick={() => setError(null)} className="font-semibold">
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* controls */}
          <div className="scroll-thin w-full shrink-0 space-y-3 overflow-y-auto lg:w-[332px]">
            {/* mobile section switcher */}
            <div className="flex gap-1 overflow-x-auto rounded-card bg-white p-1 md:hidden">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSection(n.id)}
                  className={`shrink-0 rounded-full px-3 py-2 text-[12px] font-medium ${
                    section === n.id ? 'bg-ink text-white' : 'text-muted'
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>

            {section === 'image' && (
              <ImagePanel state={state} dispatch={act} onPick={() => pick('screenshot')} />
            )}
            {section === 'background' && (
              <BackgroundPanel
                state={state}
                dispatch={act}
                onPickBg={() => pick('background')}
                onAutoGradient={autoGradient}
              />
            )}
            {section === 'frame' && <FramePanel state={state} dispatch={act} />}
            {section === 'text' && <TextPanel state={state} dispatch={act} />}
            {section === 'annotate' && (
              <AnnotatePanel
                state={state}
                dispatch={act}
                selected={selected}
                onSelect={setSelected}
              />
            )}
            {section === 'export' && (
              <ExportPanel state={state} dispatch={act} onDownload={doDownload} onCopy={doCopy} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
