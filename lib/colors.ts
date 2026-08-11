export function toHex(r: number, g: number, b: number) {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function fromHex(hex: string): [number, number, number] {
  const s = hex.replace('#', '')
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Perceived luminance, 0–1. Used to decide light-on-dark vs dark-on-light. */
export function luminance(hex: string) {
  const [r, g, b] = fromHex(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = fromHex(a)
  const [r2, g2, b2] = fromHex(b)
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

/**
 * Coarse colour histogram over RGBA bytes. Skips transparent, near-white and
 * near-black pixels — a screenshot is mostly chrome and background, and those
 * dominate the count while telling us nothing about its character.
 */
export function dominantColors(pixels: ArrayLike<number>, count = 2): string[] {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3]
    if (a < 200) continue
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max > 244 || max < 26) continue // paper white / near black
    if (max - min < 18) continue // greyscale chrome
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const e = bins.get(key)
    if (e) {
      e.n++
      e.r += r
      e.g += g
      e.b += b
    } else {
      bins.set(key, { n: 1, r, g, b })
    }
  }

  const ranked = [...bins.values()]
    .sort((x, y) => y.n - x.n)
    .map((e) => toHex(e.r / e.n, e.g / e.n, e.b / e.n))

  const out: string[] = []
  for (const hex of ranked) {
    if (out.length >= count) break
    const [r, g, b] = fromHex(hex)
    const far = out.every((o) => {
      const [r2, g2, b2] = fromHex(o)
      return Math.abs(r - r2) + Math.abs(g - g2) + Math.abs(b - b2) > 90
    })
    if (far) out.push(hex)
  }
  while (out.length < count) out.push(out[out.length - 1] ?? '#8a8f9c')
  return out
}

/**
 * Background that belongs with the screenshot: pull its two signature colours,
 * then push them apart in lightness so the frame still reads against them.
 */
export function gradientFromColors(colors: string[]) {
  const [a, b] = colors
  const dark = luminance(a) < 0.45
  return {
    stops: dark
      ? [mix(a, '#000000', 0.45), mix(b, '#000000', 0.2)]
      : [mix(a, '#ffffff', 0.62), mix(b, '#ffffff', 0.28)],
    angle: 135,
  }
}

/** Client-side: sample a loaded image down to 64px and read its palette. */
export function paletteFromImage(img: HTMLImageElement, count = 2): string[] {
  const size = 64
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) return ['#8a8f9c', '#5c6378']
  g.drawImage(img, 0, 0, size, size)
  return dominantColors(g.getImageData(0, 0, size, size).data, count)
}
