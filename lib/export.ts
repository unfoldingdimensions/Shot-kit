/**
 * Canvas area ceiling. Chrome tolerates ~2^30 area but iOS Safari caps around
 * 16.7M pixels and, crucially, fails by returning a BLANK image rather than
 * throwing. So we clamp instead of trusting the caller.
 */
export const MAX_EXPORT_PIXELS = 16_000_000

/** Largest whole-ish scale that keeps w*h*scale^2 under the ceiling. */
export function clampExportScale(w: number, h: number, desired: number): number {
  if (w <= 0 || h <= 0) return 1
  const max = Math.sqrt(MAX_EXPORT_PIXELS / (w * h))
  if (desired <= max) return desired
  // step down through the offered scales before falling back to a fraction
  for (const s of [3, 2, 1]) if (s <= max && s <= desired) return s
  return Math.max(0.1, Math.floor(max * 100) / 100)
}

export function exportPixels(w: number, h: number, scale: number) {
  return { w: Math.round(w * scale), h: Math.round(h * scale) }
}

export function download(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export async function copyToClipboard(dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob()
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
}

export function filenameFor(presetLabel: string, w: number, h: number, format: string) {
  const slug = presetLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `screenshot-${slug}-${w}x${h}.${format === 'jpg' ? 'jpg' : 'png'}`
}
