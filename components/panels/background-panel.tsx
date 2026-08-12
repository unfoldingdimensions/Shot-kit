'use client'
import { Wand2 } from 'lucide-react'
import { GRADIENTS, gradientCss } from '@/lib/gradients'
import type { Action, BgMode, State } from '@/lib/state'
import { Card, ColorField, ResetButton, Row, SectionTitle, Segments, Slider } from '../ui'

const MODES: { id: BgMode; label: string }[] = [
  { id: 'gradient', label: 'Gradient' },
  { id: 'solid', label: 'Solid' },
  { id: 'image', label: 'Image' },
  { id: 'transparent', label: 'None' },
]

const pct = (n: number) => `${Math.round(n * 100)}%`

export function BackgroundPanel({
  state,
  dispatch,
  onPickBg,
  onAutoGradient,
}: {
  state: State
  dispatch: (a: Action) => void
  onPickBg: () => void
  onAutoGradient: () => void
}) {
  const { bg } = state
  const set = (patch: Partial<State['bg']>) => dispatch({ type: 'bg', patch })

  return (
    <>
      <Card>
        <SectionTitle
          right={
            <ResetButton
              label="Reset background"
              onClick={() => dispatch({ type: 'resetSection', section: 'bg' })}
            />
          }
        >
          Background
        </SectionTitle>
        <Segments value={bg.mode} options={MODES} onChange={(mode) => set({ mode })} />
      </Card>

      {bg.mode === 'gradient' && (
        <Card>
          <SectionTitle
            right={
              <button
                type="button"
                onClick={onAutoGradient}
                disabled={!state.image.src}
                title="Build a gradient from the screenshot's own colours"
                className="flex items-center gap-1.5 rounded-full bg-lime px-2.5 py-1.5 text-[11px] font-semibold text-ink disabled:cursor-not-allowed disabled:bg-paper disabled:text-muted"
              >
                <Wand2 size={12} /> Auto
              </button>
            }
          >
            Presets
          </SectionTitle>
          <div className="mb-4 grid grid-cols-6 gap-2">
            {GRADIENTS.map((g) => {
              const active = g.stops.join() === bg.stops.join()
              return (
                <button
                  key={g.id}
                  type="button"
                  title={g.id}
                  aria-label={g.id}
                  aria-pressed={active}
                  onClick={() => set({ stops: g.stops, angle: g.angle })}
                  className={`aspect-square rounded-[10px] ring-offset-2 ${
                    active ? 'ring-2 ring-ink' : 'ring-1 ring-line'
                  }`}
                  style={{ backgroundImage: gradientCss(g) }}
                />
              )
            })}
          </div>
          {bg.stops.map((c, i) => (
            <ColorField
              key={i}
              label={i === 0 ? 'From' : i === bg.stops.length - 1 ? 'To' : `Stop ${i + 1}`}
              value={c}
              onChange={(v) => set({ stops: bg.stops.map((s, j) => (j === i ? v : s)) })}
            />
          ))}
          <Slider
            label="Angle"
            min={0}
            max={359}
            value={bg.angle}
            format={(n) => `${n}°`}
            onChange={(angle) => set({ angle })}
          />
        </Card>
      )}

      {bg.mode === 'solid' && (
        <Card>
          <SectionTitle>Colour</SectionTitle>
          <ColorField label="Fill" value={bg.solid} onChange={(solid) => set({ solid })} />
        </Card>
      )}

      {bg.mode === 'image' && (
        <Card>
          <SectionTitle>Background image</SectionTitle>
          <button
            type="button"
            onClick={onPickBg}
            className="mb-3 w-full rounded-ctl bg-paper px-3 py-2.5 text-[12px] font-medium text-ink hover:bg-line"
          >
            {bg.imageSrc ? 'Replace image' : 'Choose image…'}
          </button>
          <Slider
            label="Blur"
            min={0}
            max={1}
            step={0.01}
            value={bg.imageBlur}
            format={pct}
            onChange={(imageBlur) => set({ imageBlur })}
          />
          <Slider
            label="Dim"
            min={0}
            max={0.85}
            step={0.01}
            value={bg.imageDim}
            format={pct}
            onChange={(imageDim) => set({ imageDim })}
          />
        </Card>
      )}

      {bg.mode !== 'transparent' && (
        <Card>
          <SectionTitle>Texture</SectionTitle>
          <Slider
            label="Grain"
            min={0}
            max={1}
            step={0.01}
            value={bg.grain}
            format={pct}
            onChange={(grain) => set({ grain })}
          />
          <Slider
            label="Vignette"
            min={0}
            max={0.7}
            step={0.01}
            value={bg.vignette}
            format={pct}
            onChange={(vignette) => set({ vignette })}
          />
        </Card>
      )}

      {bg.mode === 'transparent' && (
        <Card>
          <Row label="Note">
            <p className="text-[12px] leading-relaxed text-muted">
              A transparent canvas exports as PNG only — JPG has no alpha channel and would come
              out black.
            </p>
          </Row>
        </Card>
      )}
    </>
  )
}
