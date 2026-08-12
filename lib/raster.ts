/**
 * Background blur by downscale-then-upscale rather than Konva.Filters.Blur.
 *
 * The filter route needs node.cache(), and a node cached at screen scale
 * exports soft at 2–3x pixelRatio. A downscaled bitmap is just a bitmap: the
 * browser resamples it at whatever resolution we export, so it stays correct.
 * ponytail: only heavy blurs look right this way — fine, background blur always
 * is. Swap in a real gaussian if small radii are ever needed.
 */
export function downscaleBlur(img: HTMLImageElement, amount: number): CanvasImageSource {
  if (amount <= 0.001) return img
  const f = 1 + amount * 39
  const w = Math.max(2, Math.round(img.naturalWidth / f))
  const h = Math.max(2, Math.round(img.naturalHeight / f))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) return img
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, 0, 0, w, h)
  return c
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
