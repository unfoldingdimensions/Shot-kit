'use client'
import { Check, Clipboard, Download } from 'lucide-react'
import { useState } from 'react'
import { clampExportScale, exportPixels } from '@/lib/export'
import type { Action, State } from '@/lib/state'
import { Card, SectionTitle, Segments, Slider } from '../ui'

export function ExportPanel({
  state,
  dispatch,
  onDownload,
  onCopy,
}: {
  state: State
  dispatch: (a: Action) => void
  onDownload: () => void
  onCopy: () => Promise<void>
}) {
  const { out, width, height } = state
  const [copied, setCopied] = useState(false)
  const transparent = state.bg.mode === 'transparent'
  const format = transparent ? 'png' : out.format

  const safe = clampExportScale(width, height, out.scale)
  const px = exportPixels(width, height, safe)
  const clamped = safe !== out.scale

  return (
    <>
      <Card>
        <SectionTitle>Export</SectionTitle>

        <div className="mb-4">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[34px] leading-none font-extrabold tracking-tight text-ink tabular-nums">
              {px.w}
            </span>
            <span className="text-[15px] text-muted">×</span>
            <span className="font-display text-[34px] leading-none font-extrabold tracking-tight text-ink tabular-nums">
              {px.h}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {format.toUpperCase()} · {safe}× · {(px.w * px.h / 1e6).toFixed(1)}MP
          </p>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <Segments
            value={format}
            options={[
              { id: 'png', label: 'PNG' },
              { id: 'jpg', label: 'JPG', title: transparent ? 'Needs an opaque background' : undefined },
            ]}
            onChange={(f) => !transparent && dispatch({ type: 'out', patch: { format: f } })}
          />
          <Segments
            value={String(out.scale)}
            options={[
              { id: '1', label: '1×' },
              { id: '2', label: '2×' },
              { id: '3', label: '3×' },
            ]}
            onChange={(s) => dispatch({ type: 'out', patch: { scale: Number(s) } })}
          />
        </div>

        {clamped && (
          <p className="mb-3 rounded-ctl bg-lime/25 px-3 py-2 text-[11px] leading-relaxed text-ink">
            {out.scale}× would exceed the browser canvas limit and export blank, so this is capped
            at {safe}×.
          </p>
        )}

        {format === 'jpg' && (
          <Slider
            label="Quality"
            min={0.5}
            max={1}
            step={0.01}
            value={out.quality}
            format={(n) => `${Math.round(n * 100)}%`}
            onChange={(quality) => dispatch({ type: 'out', patch: { quality } })}
          />
        )}

        {transparent && (
          <p className="mb-3 text-[11px] leading-relaxed text-muted">
            Transparent canvas — PNG only.
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDownload}
            className="flex flex-1 items-center justify-center gap-2 rounded-ctl bg-lime px-3 py-3 text-[13px] font-semibold text-ink hover:brightness-95"
          >
            <Download size={15} /> Download
          </button>
          <button
            type="button"
            aria-label="Copy to clipboard"
            title="Copy to clipboard"
            onClick={async () => {
              await onCopy()
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            }}
            className="rounded-ctl bg-paper px-3.5 text-muted hover:text-ink"
          >
            {copied ? <Check size={16} className="text-ink" /> : <Clipboard size={16} />}
          </button>
        </div>
      </Card>

      <Card>
        <p className="text-[11px] leading-relaxed text-muted">
          Everything runs in your browser. Your screenshot is never uploaded anywhere.
        </p>
      </Card>
    </>
  )
}
