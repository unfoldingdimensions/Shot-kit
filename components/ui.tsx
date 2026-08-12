'use client'
import { RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'

/** White rounded card — the panel unit of the whole sidebar. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card bg-card p-4 ${className}`}>{children}</div>
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="mb-1.5 block text-[11px] font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (n: number) => string
  onChange: (n: number) => void
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</span>
        <span className="font-display text-[13px] font-semibold tabular-nums text-ink">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

/** Pill segmented control — the reference's signature selected-state. */
export function Segments<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T
  options: { id: T; label: ReactNode; title?: string; disabled?: boolean }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`flex gap-1 rounded-ctl bg-paper p-1 ${className}`} role="group">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.title}
          disabled={o.disabled}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 rounded-[10px] px-2 py-1.5 text-[12px] font-medium transition-colors ${
            value === o.id ? 'bg-ink text-white' : 'text-muted hover:text-ink'
          } disabled:pointer-events-none disabled:opacity-35`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TextField({
  value,
  onChange,
  placeholder,
  multiline,
  rows = 2,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  rows?: number
  'aria-label'?: string
}) {
  const cls =
    'w-full rounded-ctl border border-line bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:border-lav focus:bg-white'
  return multiline ? (
    <textarea
      className={`${cls} resize-y`}
      rows={rows}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    />
  ) : (
    <input
      className={cls}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function Select({
  value,
  onChange,
  children,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
  'aria-label'?: string
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none rounded-ctl border border-line bg-paper bg-[length:11px] bg-[right_0.8rem_center] bg-no-repeat px-3 py-2 text-[13px] font-medium text-ink focus:border-lav"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2386868c' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
      }}
    >
      {children}
    </select>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 last:mb-0">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer size-0 opacity-0"
        />
        <span
          aria-hidden
          className={`block h-[22px] w-[38px] rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-lav ${
            checked ? 'bg-ink' : 'bg-line'
          }`}
        >
          <span
            className={`mt-[3px] block size-4 rounded-full transition-transform ${
              checked ? 'translate-x-[19px] bg-lime' : 'translate-x-[3px] bg-white'
            }`}
          />
        </span>
      </span>
    </label>
  )
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 last:mb-0">
      <span className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] text-muted">{value.toUpperCase()}</span>
        <input
          type="color"
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 rounded-[10px]"
        />
      </div>
    </div>
  )
}

/** Section-level "put this panel back how it started". */
export function ResetButton({
  onClick,
  label = 'Reset to defaults',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-full p-1.5 text-muted transition-colors hover:bg-paper hover:text-ink"
    >
      <RotateCcw size={14} />
    </button>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-[15px] font-bold tracking-tight text-ink">{children}</h2>
      {right}
    </div>
  )
}
