'use client'
import { ImageUp, Trash2 } from 'lucide-react'
import { PRESETS, fitToImage, presetGroups } from '@/lib/presets'
import type { Action, State } from '@/lib/state'
import { Card, ResetButton, Row, SectionTitle, Select, TextField } from '../ui'

export function ImagePanel({
  state,
  dispatch,
  onPick,
}: {
  state: State
  dispatch: (a: Action) => void
  onPick: () => void
}) {
  const { image, width, height } = state
  const custom = !PRESETS.some((p) => p.id === state.presetId)

  return (
    <>
      <Card>
        <SectionTitle>Screenshot</SectionTitle>
        {image.src ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-ctl border border-line bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt="" className="block max-h-28 w-full object-contain" />
            </div>
            <div className="flex items-center justify-between text-[12px] text-muted">
              <span className="truncate">{image.name || 'pasted image'}</span>
              <span className="tabular-nums">
                {image.w}×{image.h}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onPick}
                className="flex-1 rounded-ctl bg-paper px-3 py-2 text-[12px] font-medium text-ink hover:bg-line"
              >
                Replace
              </button>
              <button
                type="button"
                aria-label="Remove screenshot"
                onClick={() => dispatch({ type: 'image', src: '', w: 0, h: 0, name: '' })}
                className="rounded-ctl bg-paper px-3 py-2 text-muted hover:text-ink"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPick}
            className="flex w-full flex-col items-center gap-2 rounded-ctl border border-dashed border-line bg-paper px-4 py-7 text-muted hover:border-lav hover:text-ink"
          >
            <ImageUp size={20} />
            <span className="text-[13px] font-medium">Drop, paste or browse</span>
            <span className="text-[11px]">PNG · JPG · WebP</span>
          </button>
        )}
      </Card>

      <Card>
        <SectionTitle
          right={
            <ResetButton
              label="Reset output size"
              onClick={() => dispatch({ type: 'resetSection', section: 'size' })}
            />
          }
        >
          Output size
        </SectionTitle>

        <div className="mb-3 flex items-baseline gap-1.5">
          <span className="font-display text-[34px] leading-none font-extrabold tracking-tight text-ink tabular-nums">
            {width}
          </span>
          <span className="text-[15px] text-muted">×</span>
          <span className="font-display text-[34px] leading-none font-extrabold tracking-tight text-ink tabular-nums">
            {height}
          </span>
          <span className="ml-1 text-[11px] font-medium text-muted">px</span>
        </div>

        <Row label="Preset">
          <Select
            aria-label="Output size preset"
            value={custom ? 'custom' : state.presetId}
            onChange={(id) => {
              if (id === 'custom') dispatch({ type: 'size', w: width, h: height })
              else if (id === 'fit') {
                const f = fitToImage(image.w || 1600, image.h || 900)
                dispatch({ type: 'size', w: f.w, h: f.h })
              } else dispatch({ type: 'preset', id })
            }}
          >
            {presetGroups().map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — {p.w}×{p.h}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label="Custom">
              <option value="fit" disabled={!image.src}>
                Fit to screenshot
              </option>
              <option value="custom">Custom size…</option>
            </optgroup>
          </Select>
        </Row>

        <div className="grid grid-cols-2 gap-2">
          <Row label="Width">
            <TextField
              aria-label="Canvas width"
              value={String(width)}
              onChange={(v) => dispatch({ type: 'size', w: Number(v) || width, h: height })}
            />
          </Row>
          <Row label="Height">
            <TextField
              aria-label="Canvas height"
              value={String(height)}
              onChange={(v) => dispatch({ type: 'size', w: width, h: Number(v) || height })}
            />
          </Row>
        </div>
      </Card>
    </>
  )
}
