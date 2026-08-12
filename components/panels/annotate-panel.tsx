'use client'
import {
  MousePointer2,
  MoveUpRight,
  Square,
  Circle as CircleIcon,
  Sun,
  Hash,
  EyeOff,
  Trash2,
} from 'lucide-react'
import {
  ANNO_KINDS,
  BOXY,
  REDACT_MODES,
  createAnno,
  type Anno,
  type AnnoKind,
} from '@/lib/annotations'
import type { Action, State } from '@/lib/state'
import { Card, ColorField, Row, SectionTitle, Segments, Slider, TextField, Toggle } from '../ui'

const ICONS: Record<AnnoKind, typeof MousePointer2> = {
  pointer: MousePointer2,
  arrow: MoveUpRight,
  badge: Hash,
  box: Square,
  ellipse: CircleIcon,
  spotlight: Sun,
  redact: EyeOff,
}

const pct = (n: number) => `${Math.round(n * 100)}%`

export function AnnotatePanel({
  state,
  dispatch,
  selected,
  onSelect,
}: {
  state: State
  dispatch: (a: Action) => void
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const { annos } = state
  const sel = annos.find((a) => a.id === selected) ?? null
  const set = (patch: Partial<Anno>) => {
    if (sel) dispatch({ type: 'annoPatch', id: sel.id, patch })
  }

  const add = (kind: AnnoKind) => {
    const id = `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    dispatch({ type: 'annoAdd', anno: createAnno(kind, id, annos) })
    onSelect(id)
  }

  return (
    <>
      <Card>
        <SectionTitle
          right={
            annos.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'annoClear' })
                  onSelect(null)
                }}
                className="rounded-full px-2.5 py-1.5 text-[11px] font-medium text-muted hover:bg-paper hover:text-ink"
              >
                Clear all
              </button>
            ) : undefined
          }
        >
          Add
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {ANNO_KINDS.map((k) => {
            const Icon = ICONS[k.id]
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => add(k.id)}
                className="flex flex-col items-center gap-1.5 rounded-ctl bg-paper px-2 py-3 text-[11px] font-medium text-muted transition-colors hover:bg-line hover:text-ink"
              >
                <Icon size={16} />
                {k.label}
              </button>
            )
          })}
        </div>
      </Card>

      {annos.length > 0 && (
        <Card>
          <SectionTitle>On canvas · {annos.length}</SectionTitle>
          <div className="space-y-1.5">
            {annos.map((a, i) => {
              const Icon = ICONS[a.kind]
              const active = a.id === selected
              const name = ANNO_KINDS.find((k) => k.id === a.kind)?.label ?? a.kind
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-2 rounded-ctl px-3 py-2 ${
                    active ? 'bg-ink text-white' : 'bg-paper text-muted'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(active ? null : a.id)}
                    className="flex flex-1 items-center gap-2 text-left text-[12px] font-medium"
                  >
                    <Icon size={14} />
                    {name}
                    {a.kind === 'badge' && a.label ? ` ${a.label}` : ''}
                    <span className={active ? 'text-white/45' : 'text-muted/60'}>#{i + 1}</span>
                  </button>
                  <span
                    aria-hidden
                    className="size-3 rounded-full ring-1 ring-black/10"
                    style={{ background: a.color }}
                  />
                  <button
                    type="button"
                    aria-label={`Delete ${name}`}
                    onClick={() => {
                      dispatch({ type: 'annoRemove', id: a.id })
                      if (active) onSelect(null)
                    }}
                    className={active ? 'text-white/60 hover:text-white' : 'text-muted hover:text-ink'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {sel ? (
        <Card>
          <SectionTitle>
            {ANNO_KINDS.find((k) => k.id === sel.kind)?.label} settings
          </SectionTitle>

          {sel.kind === 'badge' && (
            <Row label="Label">
              <TextField
                aria-label="Step label"
                value={sel.label}
                onChange={(label) => set({ label })}
              />
            </Row>
          )}

          {sel.kind === 'redact' && (
            <>
              <Segments
                className="mb-3"
                value={sel.redactMode}
                options={REDACT_MODES.map((m) => ({ id: m.id, label: m.label }))}
                onChange={(redactMode) => set({ redactMode })}
              />
              {sel.redactMode !== 'solid' && (
                <Slider
                  label={sel.redactMode === 'pixelate' ? 'Blocks' : 'Strength'}
                  min={sel.redactMode === 'pixelate' ? 3 : 3}
                  max={sel.redactMode === 'pixelate' ? 40 : 30}
                  step={1}
                  value={sel.intensity}
                  format={(n) => (sel.redactMode === 'pixelate' ? `${Math.round(n)}` : `${Math.round((n / 30) * 100)}%`)}
                  onChange={(intensity) => set({ intensity })}
                />
              )}
              {!state.image.src && (
                <p className="mb-3 rounded-ctl bg-lime/25 px-3 py-2 text-[11px] leading-relaxed text-ink">
                  Drop a screenshot first — pixelate and blur sample the image itself.
                </p>
              )}
            </>
          )}

          {sel.kind !== 'spotlight' && (sel.kind !== 'redact' || sel.redactMode === 'solid') && (
            <ColorField label="Colour" value={sel.color} onChange={(color) => set({ color })} />
          )}

          {sel.kind === 'spotlight' ? (
            <Slider
              label="Dim outside"
              min={0.1}
              max={0.92}
              step={0.01}
              value={sel.dim}
              format={pct}
              onChange={(dim) => set({ dim })}
            />
          ) : sel.kind === 'redact' ? null : (
            <Slider
              label={sel.kind === 'pointer' || sel.kind === 'badge' ? 'Size' : 'Thickness'}
              min={sel.kind === 'pointer' || sel.kind === 'badge' ? 0.015 : 0.002}
              max={sel.kind === 'pointer' || sel.kind === 'badge' ? 0.12 : 0.02}
              step={0.001}
              value={sel.size}
              format={(n) => `${Math.round(n * Math.min(state.width, state.height))}px`}
              onChange={(size) => set({ size })}
            />
          )}

          {(sel.kind === 'box' || sel.kind === 'ellipse') && (
            <Toggle label="Filled" checked={sel.filled} onChange={(filled) => set({ filled })} />
          )}

          {BOXY.includes(sel.kind) && sel.kind !== 'redact' && (
            <Slider
              label="Rotate"
              min={-180}
              max={180}
              step={1}
              value={sel.rotation}
              format={(n) => `${n}°`}
              onChange={(rotation) => set({ rotation })}
            />
          )}

          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            {sel.kind === 'redact'
              ? 'Sits on the screenshot itself, so it moves and rotates with the window. Pixelate samples the real pixels and redraws them as blocks — it cannot be undone from the exported image.'
              : sel.kind === 'arrow'
                ? 'Drag the arrow to move it, or drag either end point to re-aim it.'
                : BOXY.includes(sel.kind)
                  ? 'Drag on the canvas to move, or use the handles to resize and rotate.'
                  : 'Drag it straight onto the canvas where you want it.'}
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-[12px] leading-relaxed text-muted">
            {annos.length
              ? 'Select an annotation on the canvas or in the list above to edit it.'
              : 'Add a pointer, arrow, step number, box, ellipse or spotlight. They sit above the screenshot and move with the canvas when you change size.'}
          </p>
        </Card>
      )}
    </>
  )
}
