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
