'use client'
import Konva from 'konva'
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
import type { State } from '@/lib/state'
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

export const CanvasStage = forwardRef<StageApi, { state: State }>(function CanvasStage(
  { state },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [avail, setAvail] = useState({ w: 0, h: 0 })
  const [fontsReady, setFontsReady] = useState(false)
  const img = useImage(state.image.src)

  useEffect(() => {
    ensureFontsLoaded().then(() => setFontsReady(true))
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
  const fit = fitToViewport(width, height, Math.max(avail.w - 8, 1), Math.max(avail.h - 8, 1))

  const uiFont = fontById('inter').family

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
      try {
        const dataUrl = stage.toDataURL({
          mimeType: format === 'jpg' ? 'image/jpeg' : 'image/png',
          quality,
          pixelRatio: safe,
        })
        return { dataUrl, ...exportPixels(width, height, safe), scale: safe }
      } finally {
        stage.size({ width: prev.w, height: prev.h })
        stage.scale({ x: prev.s, y: prev.s })
        stage.batchDraw()
      }
    },
  }))

  const stageW = Math.max(Math.round(width * fit), 1)
  const stageH = Math.max(Math.round(height * fit), 1)

  return (
    <div ref={wrapRef} className="grid h-full w-full place-items-center overflow-hidden">
      {avail.w > 0 && (
        <div
          className="shadow-[0_24px_70px_-20px_rgba(0,0,0,0.55)]"
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
          <Stage ref={stageRef} width={stageW} height={stageH} scaleX={fit} scaleY={fit}>
            <Layer listening={false}>
              <Background bg={state.bg} w={width} h={height} />
            </Layer>
            <Layer listening={false}>
              <Frame
                box={computed.frame}
                barH={computed.barH}
                frame={frame}
                img={img}
                fontFamily={uiFont}
                minDim={minDim}
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
          </Stage>
        </div>
      )}
    </div>
  )
})
