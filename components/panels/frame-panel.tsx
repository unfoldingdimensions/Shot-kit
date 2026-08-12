'use client'
import { CHROME_KINDS } from '@/lib/chrome'
import type { Action, State } from '@/lib/state'
import { Card, ResetButton, Row, SectionTitle, Segments, Slider, TextField, Toggle } from '../ui'

const pct = (n: number) => `${Math.round(n * 100)}%`

const SHADOWS = [
  { id: 'none', label: 'None', v: { shadowBlur: 0, shadowOffsetY: 0, shadowOpacity: 0 } },
  { id: 'soft', label: 'Soft', v: { shadowBlur: 0.05, shadowOffsetY: 0.02, shadowOpacity: 0.28 } },
  { id: 'deep', label: 'Deep', v: { shadowBlur: 0.11, shadowOffsetY: 0.05, shadowOpacity: 0.4 } },
  { id: 'hard', label: 'Hard', v: { shadowBlur: 0.008, shadowOffsetY: 0.03, shadowOpacity: 0.5 } },
] as const

export function FramePanel({
  state,
  dispatch,
}: {
  state: State
  dispatch: (a: Action) => void
}) {
  const { frame } = state
  const set = (patch: Partial<State['frame']>) => dispatch({ type: 'frame', patch })
  const activeShadow =
    SHADOWS.find(
      (s) =>
        s.v.shadowBlur === frame.shadowBlur &&
        s.v.shadowOffsetY === frame.shadowOffsetY &&
        s.v.shadowOpacity === frame.shadowOpacity,
    )?.id ?? 'custom'

  return (
    <>
      <Card>
        <SectionTitle
          right={
            <ResetButton
              label="Reset window, shape and shadow"
              onClick={() => dispatch({ type: 'resetSection', section: 'frame' })}
            />
          }
        >
          Window
        </SectionTitle>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {CHROME_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={frame.chrome === k.id}
              onClick={() => set({ chrome: k.id })}
              className={`rounded-ctl px-3 py-2.5 text-left text-[12px] font-medium transition-colors ${
                frame.chrome === k.id
                  ? 'bg-ink text-white'
                  : 'bg-paper text-muted hover:text-ink'
              } ${k.id === 'plain' ? 'col-span-2' : ''}`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {frame.chrome !== 'plain' && (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Segments
                value={frame.theme}
                options={[
                  { id: 'light', label: 'Light' },
                  { id: 'dark', label: 'Dark' },
                ]}
                onChange={(theme) => set({ theme })}
              />
              <Segments
                value={frame.os}
                options={[
                  { id: 'mac', label: 'macOS' },
                  { id: 'win', label: 'Win' },
                ]}
                onChange={(os) => set({ os })}
              />
            </div>

            {frame.chrome === 'browser' && (
              <Row label="URL">
                <TextField
                  aria-label="Browser URL"
                  value={frame.url}
                  placeholder="yourapp.com"
                  onChange={(url) => set({ url })}
                />
              </Row>
            )}
            {(frame.chrome === 'editor' || frame.chrome === 'code-file') && (
              <Row label="Filename">
                <TextField
                  aria-label="Filename"
                  value={frame.filename}
                  placeholder="index.tsx"
                  onChange={(filename) => set({ filename })}
                />
              </Row>
            )}
            {frame.chrome === 'settings' && (
              <Row label="Title">
                <TextField
                  aria-label="Window title"
                  value={frame.title}
                  placeholder="Settings"
                  onChange={(title) => set({ title })}
                />
              </Row>
            )}
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>Shape</SectionTitle>
        <Slider
          label="Padding"
          min={0}
          max={0.28}
          step={0.002}
          value={frame.padding}
          format={pct}
          onChange={(padding) => set({ padding })}
        />
        <Slider
          label="Corner radius"
          min={0}
          max={0.06}
          step={0.001}
          value={frame.radius}
          format={(n) => `${Math.round(n * 1000)}`}
          onChange={(radius) => set({ radius })}
        />
        <Slider
          label="Scale"
          min={0.3}
          max={1}
          step={0.01}
          value={frame.scale}
          format={pct}
          onChange={(scale) => set({ scale })}
        />
        <Slider
          label="Rotate"
          min={-15}
          max={15}
          step={0.5}
          value={frame.rotation}
          format={(n) => `${n}°`}
          onChange={(rotation) => set({ rotation })}
        />
        <Slider
          label="Skew"
          min={-12}
          max={12}
          step={0.5}
          value={frame.skewX}
          format={(n) => `${n}°`}
          onChange={(skewX) => set({ skewX })}
        />
        <Toggle
          label="Glass edge"
          checked={frame.glassEdge}
          onChange={(glassEdge) => set({ glassEdge })}
        />
      </Card>

      <Card>
        <SectionTitle>Shadow</SectionTitle>
        <Segments
          className="mb-3"
          value={activeShadow}
          options={[
            ...SHADOWS.map((s) => ({ id: s.id as string, label: s.label as string })),
            ...(activeShadow === 'custom' ? [{ id: 'custom', label: 'Custom' }] : []),
          ]}
          onChange={(id) => {
            const s = SHADOWS.find((x) => x.id === id)
            if (s) set(s.v)
          }}
        />
        <Slider
          label="Blur"
          min={0}
          max={0.2}
          step={0.002}
          value={frame.shadowBlur}
          format={pct}
          onChange={(shadowBlur) => set({ shadowBlur })}
        />
        <Slider
          label="Offset Y"
          min={0}
          max={0.12}
          step={0.002}
          value={frame.shadowOffsetY}
          format={pct}
          onChange={(shadowOffsetY) => set({ shadowOffsetY })}
        />
        <Slider
          label="Opacity"
          min={0}
          max={0.8}
          step={0.01}
          value={frame.shadowOpacity}
          format={pct}
          onChange={(shadowOpacity) => set({ shadowOpacity })}
        />
      </Card>
    </>
  )
}
