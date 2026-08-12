/** Longest edge we render a blurred backdrop at. Blur has no fine detail to keep. */
const MAX_BLUR_EDGE = 1600

/** How far past the blur radius the gaussian's tail still contributes. */
const EDGE_SIGMAS = 3

export interface BlurPlan {
  w: number
  h: number
  radius: number
  /** draw the source this much larger than the canvas, then crop */
  overscan: number
}

export function blurPlan(iw: number, ih: number, amount: number): BlurPlan {
  const fit = Math.min(1, MAX_BLUR_EDGE / Math.max(iw, ih, 1))
  const w = Math.max(8, Math.round(iw * fit))
  const h = Math.max(8, Math.round(ih * fit))
  const short = Math.min(w, h)
  const radius = Math.max(0, Math.min(amount, 1)) * 0.09 * short
  // A gaussian samples transparent pixels past the edge, which fades the border
  // and reads as a dark vignette once composited (measured: alpha 236 instead
  // of 255 in the corners). CSS blur(r) takes r as the standard deviation, so
  // the falloff runs to about 3σ — the overscan margin has to match that, not
  // the radius itself.
  return { w, h, radius, overscan: 1 + (2 * EDGE_SIGMAS * radius) / short }
}

function paint(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (g) {
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    g.drawImage(src, 0, 0, w, h)
  }
  return c
}

let canvasFilter: boolean | null = null
function supportsCanvasFilter() {
  if (canvasFilter !== null) return canvasFilter
  const g = document.createElement('canvas').getContext('2d')
  if (!g) return (canvasFilter = false)
  g.filter = 'blur(2px)'
  return (canvasFilter = g.filter === 'blur(2px)')
}

/**
 * Blurred backdrop for the background image.
 *
 * This used to shrink the source in one step and let the upscale do the
 * blurring. Past about half strength that meant reducing an image to a few
 * hundred pixels total — a 640x400 source became 16x10 — and magnifying it
 * ~100x, which shows as bilinear quilting and throws away all colour fidelity.
 * A real gaussian has neither problem and stays correct at any export scale,
 * because the result is still just a bitmap.
 */
export function blurBackdrop(img: HTMLImageElement, amount: number): CanvasImageSource {
  if (amount <= 0.001) return img
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (!iw || !ih) return img

  const p = blurPlan(iw, ih, amount)

  if (supportsCanvasFilter()) {
    const c = document.createElement('canvas')
    c.width = p.w
    c.height = p.h
    const g = c.getContext('2d')
    if (!g) return img
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    const dw = p.w * p.overscan
    const dh = p.h * p.overscan
    g.filter = `blur(${p.radius}px)`
    g.drawImage(img, (p.w - dw) / 2, (p.h - dh) / 2, dw, dh)
    g.filter = 'none'
    return c
  }

  // Older Safari has no Canvas2D filter. Fall back to downscaling, but halve
  // step by step: one extreme reduction aliases badly, which is what produced
  // the artefacts in the first place.
  const factor = 1 + amount * 39
  const tw = Math.max(2, Math.round(iw / factor))
  let w = iw
  let src: CanvasImageSource = img
  while (w > tw * 2) {
    w = Math.max(tw, Math.round(w / 2))
    src = paint(src, w, Math.max(2, Math.round((ih * w) / iw)))
  }
  return paint(src, tw, Math.max(2, Math.round((ih * tw) / iw)))
}

export interface Region {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Average colour per block, as hex. Kept separate from any canvas so the
 * mapping is testable: `cols*rows` colours in row-major order.
 */
export function averageBlocks(
  pixels: ArrayLike<number>,
  cols: number,
  rows: number,
): string[] {
  const out: string[] = []
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  for (let i = 0; i < cols * rows; i++) {
    const p = i * 4
    out.push(`#${hex(pixels[p])}${hex(pixels[p + 1])}${hex(pixels[p + 2])}`)
  }
  return out
}

/** Block count for a region, preserving its aspect so blocks stay square-ish. */
export function blockDims(region: Region, iw: number, ih: number, cols: number) {
  const sw = Math.max(region.w * iw, 1)
  const sh = Math.max(region.h * ih, 1)
  const c = Math.max(1, Math.round(cols))
  const r = Math.max(1, Math.round((c * sh) / sw))
  return { cols: c, rows: r }
}

/**
 * Pixelate by sampling block averages and drawing them as solid rectangles.
 * Rects are vector, so the redaction stays exact at 1x or 3x — a pre-rendered
 * pixelated bitmap would get resampled smooth at higher export scales, which
 * would partially undo the redaction.
 */
export function pixelateBlocks(
  img: HTMLImageElement,
  region: Region,
  cols: number,
): { cols: number; rows: number; colors: string[] } | null {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (!iw || !ih) return null
  const dims = blockDims(region, iw, ih, cols)
  const sx = region.x * iw
  const sy = region.y * ih
  const sw = Math.max(region.w * iw, 1)
  const sh = Math.max(region.h * ih, 1)
  const c = document.createElement('canvas')
  c.width = dims.cols
  c.height = dims.rows
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return null
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, sx, sy, sw, sh, 0, 0, dims.cols, dims.rows)
  const d = g.getImageData(0, 0, dims.cols, dims.rows).data
  return { ...dims, colors: averageBlocks(d, dims.cols, dims.rows) }
}

/** Crop a region and shrink it hard; drawn back at full size it reads as blur. */
export function cropBlur(
  img: HTMLImageElement,
  region: Region,
  amount: number,
): CanvasImageSource | null {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (!iw || !ih) return null
  const sw = Math.max(region.w * iw, 1)
  const sh = Math.max(region.h * ih, 1)
  const f = 1 + Math.max(amount, 0) * 24
  const w = Math.max(2, Math.round(sw / f))
  const h = Math.max(2, Math.round(sh / f))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) return null
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, region.x * iw, region.y * ih, sw, sh, 0, 0, w, h)
  return c
}

let noise: HTMLCanvasElement | null = null

/** Monochrome noise tile for the grain overlay. Built once, reused. */
export function noiseTile(size = 128): HTMLCanvasElement | null {
  if (noise) return noise
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) return null
  const data = g.createImageData(size, size)
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 120 + Math.random() * 135
    data.data[i] = v
    data.data[i + 1] = v
    data.data[i + 2] = v
    data.data[i + 3] = 255
  }
  g.putImageData(data, 0, 0)
  noise = c
  return noise
}
