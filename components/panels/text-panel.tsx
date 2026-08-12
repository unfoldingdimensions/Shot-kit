'use client'
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from 'lucide-react'
import { useState } from 'react'
import { FONTS } from '@/lib/fonts'
import type { SlotPos } from '@/lib/geometry'
import type { Action, State, TextSlot } from '@/lib/state'
import {
  Card,
  ColorField,
  ResetButton,
  Row,
  SectionTitle,
  Segments,
  Select,
  Slider,
  TextField,
  Toggle,
} from '../ui'

const POSITIONS: { id: SlotPos; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
]

const ICON = 'flex items-center justify-center gap-1'

export function TextPanel({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const [pos, setPos] = useState<SlotPos>('top')
  const slot = state.text[pos]
  const set = (patch: Partial<TextSlot>) => dispatch({ type: 'slot', pos, patch })
  const font = FONTS.find((f) => f.id === slot.font) ?? FONTS[0]
  const bold = slot.weight >= 700

  return (
    <>
      <Card>
        <SectionTitle
          right={
            <ResetButton
              label="Reset all four text slots"
              onClick={() => dispatch({ type: 'resetSection', section: 'text' })}
            />
          }
        >
          Text
        </SectionTitle>
        <div className="grid grid-cols-4 gap-1 rounded-ctl bg-paper p-1">
          {POSITIONS.map((p) => {
            const s = state.text[p.id]
            const filled = s.on && (s.heading || s.sub)
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={pos === p.id}
                onClick={() => setPos(p.id)}
                className={`relative rounded-[10px] px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  pos === p.id ? 'bg-ink text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {p.label}
                {filled && (
                  <span
                    aria-hidden
                    className="absolute top-1 right-1 size-1.5 rounded-full bg-lime"
                  />
                )}
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <Toggle label={`Show ${pos} text`} checked={slot.on} onChange={(on) => set({ on })} />

        <Row label="Heading">
          <TextField
            aria-label="Heading text"
            multiline
            rows={2}
            value={slot.heading}
            placeholder="Ship it looking sharp"
            onChange={(heading) => set({ heading, on: true })}
          />
        </Row>
        <Row label="Sub text">
          <TextField
            aria-label="Sub text"
            multiline
            rows={2}
            value={slot.sub}
            placeholder="Optional supporting line"
            onChange={(sub) => set({ sub, on: true })}
          />
        </Row>
      </Card>

      <Card>
        <SectionTitle>Type</SectionTitle>
        <Row label="Font">
          <Select
            aria-label="Font"
            value={slot.font}
            onChange={(f) => {
              // Instrument Serif only ships 400. Leaving a stale 800 in state
              // made the slider clamp while the canvas still faux-bolded it.
              const next = FONTS.find((x) => x.id === f) ?? FONTS[0]
              const lo = next.weights[0]
              const hi = next.weights[next.weights.length - 1]
              set({ font: f, weight: Math.min(Math.max(slot.weight, lo), hi) })
            }}
          >
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </Row>
        <p
          className={`mb-3 truncate rounded-ctl bg-paper px-3 py-2.5 text-[19px] leading-tight ${font.className}`}
          style={{ fontWeight: slot.weight, fontStyle: slot.italic ? 'italic' : 'normal' }}
        >
          {slot.heading || 'Ship it looking sharp'}
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="flex gap-1 rounded-ctl bg-paper p-1">
            <button
              type="button"
              aria-pressed={bold}
              aria-label="Bold"
              disabled={font.weights.length === 1}
              onClick={() => set({ weight: bold ? 500 : 700 })}
              className={`flex-1 rounded-[10px] py-1.5 ${ICON} ${
                bold ? 'bg-ink text-white' : 'text-muted hover:text-ink'
              } disabled:opacity-40`}
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              aria-pressed={slot.italic}
              aria-label="Italic"
              onClick={() => set({ italic: !slot.italic })}
              className={`flex-1 rounded-[10px] py-1.5 ${ICON} ${
                slot.italic ? 'bg-ink text-white' : 'text-muted hover:text-ink'
              }`}
            >
              <Italic size={14} />
            </button>
          </div>
          <Segments
            value={slot.align}
            options={[
              { id: 'left', label: <AlignLeft size={14} className="mx-auto" />, title: 'Left' },
              { id: 'center', label: <AlignCenter size={14} className="mx-auto" />, title: 'Centre' },
              { id: 'right', label: <AlignRight size={14} className="mx-auto" />, title: 'Right' },
            ]}
            onChange={(align) => set({ align })}
          />
        </div>

        <Slider
          label="Size"
          min={0.015}
          max={0.14}
          step={0.001}
          value={slot.size}
          format={(n) => `${Math.round(n * Math.min(state.width, state.height))}px`}
          onChange={(size) => set({ size })}
        />
        <Slider
          label="Weight"
          min={font.weights[0]}
          max={font.weights[font.weights.length - 1]}
          step={100}
          value={Math.min(Math.max(slot.weight, font.weights[0]), font.weights.at(-1)!)}
          onChange={(weight) => set({ weight })}
        />
        <Slider
          label="Tracking"
          min={-0.06}
          max={0.16}
          step={0.002}
          value={slot.tracking}
          // percent of font size — the bare number read as pixels next to
          // "49px" and "1.12" on the neighbouring sliders
          format={(n) => `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%`}
          onChange={(tracking) => set({ tracking })}
        />
        <Slider
          label="Line height"
          min={0.9}
          max={1.8}
          step={0.02}
          value={slot.lineHeight}
          format={(n) => n.toFixed(2)}
          onChange={(lineHeight) => set({ lineHeight })}
        />
        <ColorField label="Colour" value={slot.color} onChange={(color) => set({ color })} />
        {(pos === 'left' || pos === 'right') && (
          <Toggle
            label="Rotate 90°"
            checked={slot.rotate}
            onChange={(rotate) => set({ rotate })}
          />
        )}
      </Card>
    </>
  )
}
