'use client'
import Konva from 'konva'
import { Maximize2, Minus, Plus } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Layer, Stage } from 'react-konva'
import { CHROME_BAR_RATIO } from '@/lib/chrome'
import { clampExportScale, exportPixels } from '@/lib/export'
import { ensureFontsLoaded, fontById } from '@/lib/fonts'
import { fitToViewport, layout, type SlotPos } from '@/lib/geometry'
import { measureTextBlock, SUB_SIZE_RATIO, type TextBlockMetrics } from '@/lib/measure'
import { inFrameSpace, type Anno } from '@/lib/annotations'
import type { State } from '@/lib/state'
import { Annotations, NO_EXPORT, setCursor } from './annotations'
import { Background } from './background'
import { Frame } from './frame'
import { TextSlotView } from './text-slot'
import { useImage } from './use-image'

const SLOTS: SlotPos[] = ['top', 'bottom', 'left', 'right']
/** Column width for un-rotated side text, as a fraction of canvas width. */
const SIDE_COL = 0.2
const EMPTY: TextBlockMetrics = { headingLines: 0, subLines: 0, height: 0 }

export interface StageApi {
  exportImage(o: { format: 'png' | 'jpg'; quality: number; scale: number }): {
    dataUrl: string
    w: number
    h: number
    scale: number
  } | null
}

interface StageProps {
  state: State
  selected: string | null
  onSelect: (id: string | null) => void
  /** live updates while dragging (no undo step) */
  onAnnoDrag: (id: string, patch: Partial<Anno>) => void
  /** final value when the gesture ends (creates one undo step) */
  onAnnoCommit: (id: string, patch: Partial<Anno>) => void
}

export const CanvasStage = forwardRef<StageApi, StageProps>(function CanvasStage(
  { state, selected, onSelect, onAnnoDrag, onAnnoCommit },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [avail, setAvail] = useState({ w: 0, h: 0 })
  const [fontsReady, setFontsReady] = useState(false)
  const [zoom, setZoom] = useState(1)
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const img = useImage(state.image.src)

  useEffect(() => {
    ensureFontsLoaded().then(() => setFontsReady(true))
  }, [])

  // pan continues outside the canvas, so these live on the window
  useEffect(() => {
    const move = (ev: MouseEvent) => {
      const p = pan.current
      const el = wrapRef.current
      if (!p || !el) return
      ev.preventDefault()
      el.scrollLeft = p.left - (ev.clientX - p.x)
      el.scrollTop = p.top - (ev.clientY - p.y)
    }
    const end = () => {
      if (!pan.current) return
      pan.current = null
      if (wrapRef.current) wrapRef.current.style.cursor = ''
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', end)
    }
  }, [])

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return

    // ResizeObserver only delivers during a rendering step, so it never fires
    // in a tab the browser isn't painting — and if the first measurement lands
    // before layout, a 0 would then stick forever and the stage would stay
    // blank. So: measure now, and keep asking on a timer until the box is real.
    // setTimeout, unlike rAF, still runs in a background tab.
    let timer: ReturnType<typeof setTimeout>
    let tries = 0
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        setAvail({ w: r.width, h: r.height })
        return
      }
      if (tries++ < 40) timer = setTimeout(measure, 25)
    }
    measure()

    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect
      if (r.width > 0 && r.height > 0) setAvail({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => {
      clearTimeout(timer)
      ro.disconnect()
    }
  }, [])

  const { width, height, frame, text } = state
  const minDim = Math.min(width, height)

  // zoom multiplies the fit-to-viewport scale. It is view-only: export resets
  // the stage to 1:1, so zooming can never change the exported bitmap.
  const baseFit = fitToViewport(width, height, Math.max(avail.w - 8, 1), Math.max(avail.h - 8, 1))
  const fit = baseFit * zoom
  const atDefault = zoom === 1

  const uiFont = fontById('inter').family

  // two coordinate spaces: redactions are image-relative and live inside the
  // frame group, everything else is canvas-relative in its own layer
  const frameAnnos = state.annos.filter((a) => inFrameSpace(a.kind))
  const canvasAnnos = state.annos.filter((a) => !inFrameSpace(a.kind))

  const computed = useMemo(() => {
    const pad = frame.padding * minDim
    const innerW = Math.max(width - pad * 2, 1)
    const innerH = Math.max(height - pad * 2, 1)
    const gap = 0.028 * minDim

    const metrics = {} as Record<SlotPos, TextBlockMetrics>
    const sizes = {} as Record<SlotPos, number>
    const reserve: Partial<Record<SlotPos, number>> = {}

    for (const pos of SLOTS) {
      const s = text[pos]
      const size = s.size * minDim
      sizes[pos] = size
      if (!s.on || (!s.heading && !s.sub)) {
        metrics[pos] = EMPTY
        continue
      }
      const side = pos === 'left' || pos === 'right'
      const rotated = s.rotate && side
      const maxWidth = !side ? innerW : rotated ? innerH : SIDE_COL * width
      metrics[pos] = measureTextBlock({
        heading: s.heading,
        sub: s.sub,
        fontFamily: fontById(s.font).family,
        weight: s.weight,
        italic: s.italic,
        size,
        lineHeight: s.lineHeight,
        maxWidth,
      })
      reserve[pos] = side && !rotated ? SIDE_COL * width : metrics[pos].height
    }

    const barRatio = CHROME_BAR_RATIO[frame.chrome]
    const l = layout({
      width,
      height,
      padding: pad,
      aspect: img ? img.naturalWidth / img.naturalHeight : 16 / 9,
      barRatio,
      frameScale: frame.scale,
      reserve,
      gap,
    })
    return { ...l, metrics, sizes, barH: l.frame.w * barRatio }
    // fontsReady is a dependency because measurement is wrong until faces load
  }, [width, height, minDim, frame, text, img, fontsReady])

  useImperativeHandle(ref, () => ({
    exportImage({ format, quality, scale }) {
      const stage = stageRef.current
      if (!stage) return null
      const safe = clampExportScale(width, height, scale)

      // Render 1:1 at the output size for the duration of the export. Deriving
      // a pixelRatio from the fitted stage instead lands 1–2px off, because the
      // on-screen stage size is rounded to whole pixels and the fit factor is
      // not. Restored before the browser paints, so nothing flickers.
      const prev = { w: stage.width(), h: stage.height(), s: stage.scaleX() }
      stage.size({ width, height })
      stage.scale({ x: 1, y: 1 })

      // selection outlines and drag handles must never reach the bitmap
      const chrome = stage.find(`.${NO_EXPORT}`)
      const wasVisible = chrome.map((n) => n.visible())
      chrome.forEach((n) => n.visible(false))

      try {
        const dataUrl = stage.toDataURL({
          mimeType: format === 'jpg' ? 'image/jpeg' : 'image/png',
          quality,
          pixelRatio: safe,
        })
        return { dataUrl, ...exportPixels(width, height, safe), scale: safe }
      } finally {
        chrome.forEach((n, i) => n.visible(wasVisible[i]))
        stage.size({ width: prev.w, height: prev.h })
        stage.scale({ x: prev.s, y: prev.s })
        stage.batchDraw()
      }
    },
  }))

  const stageW = Math.max(Math.round(width * fit), 1)
  const stageH = Math.max(Math.round(height * fit), 1)

  const zoomBy = (f: number) => setZoom((z) => Math.min(Math.max(z * f, 0.2), 6))

  // once the stage is bigger than its viewport, dragging empty canvas pans it
  const canPan = stageW > avail.w - 8 || stageH > avail.h - 8

  const startPan = (clientX: number, clientY: number) => {
    const el = wrapRef.current
    if (!el || !canPan) return
    pan.current = { x: clientX, y: clientY, left: el.scrollLeft, top: el.scrollTop }
    el.style.cursor = 'grabbing'
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={wrapRef}
        className="scroll-thin flex h-full w-full overflow-auto"
        onWheel={(e) => {
          // pinch-zoom on a trackpad arrives as ctrlKey+wheel
          if (!e.ctrlKey && !e.metaKey) return
          e.preventDefault()
          zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12)
        }}
      >
        {avail.w > 0 && (
        <div
          // m-auto centres in both axes AND stays reachable when the stage is
          // larger than the viewport; justify/align-center would clip the
          // top-left and make it impossible to scroll to
          className="m-auto shrink-0 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.55)]"
          style={{
            width: stageW,
            height: stageH,
            // shows through wherever a transparent export is transparent; it is
            // CSS, so it can never leak into the exported bitmap
            backgroundImage:
              state.bg.mode === 'transparent'
                ? 'repeating-conic-gradient(#d8d8d6 0% 25%, #f4f4f2 0% 50%)'
                : undefined,
            backgroundSize: state.bg.mode === 'transparent' ? '24px 24px' : undefined,
          }}
        >
          <Stage
            ref={stageRef}
            width={stageW}
            height={stageH}
            scaleX={fit}
            scaleY={fit}
            // bare canvas: click clears the selection, drag pans when zoomed
            onMouseDown={(e) => {
              if (e.target !== e.target.getStage()) return
              onSelect(null)
              startPan(e.evt.clientX, e.evt.clientY)
            }}
            onTouchStart={(e) => {
              if (e.target === e.target.getStage()) onSelect(null)
            }}
            onMouseEnter={(e) => {
              if (canPan && e.target === e.target.getStage()) setCursor(e, 'grab')
            }}
            onMouseLeave={(e) => setCursor(e, '')}
          >
            <Layer listening={false}>
              <Background bg={state.bg} w={width} h={height} />
            </Layer>
            <Layer>
              <Frame
                box={computed.frame}
                barH={computed.barH}
                frame={frame}
                img={img}
                fontFamily={uiFont}
                minDim={minDim}
                fit={fit}
                redactions={frameAnnos}
                selected={selected}
                onSelect={onSelect}
                onCommit={onAnnoCommit}
              />
            </Layer>
            <Layer listening={false}>
              {SLOTS.map((pos) => (
                <TextSlotView
                  key={pos}
                  pos={pos}
                  box={computed.slots[pos]}
                  slot={text[pos]}
                  size={computed.sizes[pos]}
                  subSize={computed.sizes[pos] * SUB_SIZE_RATIO}
                  metrics={computed.metrics[pos]}
                  fontFamily={fontById(text[pos].font).family}
                />
              ))}
            </Layer>
            <Layer>
              <Annotations
                annos={canvasAnnos}
                w={width}
                h={height}
                minDim={minDim}
                fit={fit}
                fontFamily={uiFont}
                selected={selected}
                onSelect={onSelect}
                onChange={onAnnoDrag}
                onCommit={onAnnoCommit}
              />
            </Layer>
          </Stage>
        </div>
        )}
      </div>

      {avail.w > 0 && (
        <div className="pointer-events-auto absolute right-3 bottom-3 flex items-center gap-0.5 rounded-full bg-ink/90 p-1 text-white backdrop-blur-sm">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomBy(1 / 1.25)}
            className="grid size-7 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Minus size={14} />
          </button>
          <span
            className="font-display min-w-12 text-center text-[12px] font-semibold tabular-nums"
            title="Size on screen relative to the exported image"
          >
            {Math.round(baseFit * zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomBy(1.25)}
            className="grid size-7 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            aria-label="Reset zoom to fit"
            title="Fit to window"
            disabled={atDefault}
            onClick={() => setZoom(1)}
            className="ml-0.5 grid size-7 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      )}
    </div>
  )
})
