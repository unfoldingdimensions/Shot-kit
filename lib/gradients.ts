export interface GradientPreset {
  id: string
  stops: string[]
  angle: number
}

/** Desaturated / editorial rather than neon — screenshots have to stay readable on top. */
export const GRADIENTS: GradientPreset[] = [
  { id: 'slate', stops: ['#e8eaf0', '#c3c9d8'], angle: 135 },
  { id: 'paper', stops: ['#faf7f2', '#e6ded1'], angle: 120 },
  { id: 'dusk', stops: ['#2b2d42', '#5c6378'], angle: 135 },
  { id: 'ink', stops: ['#0f1115', '#2a2f3a'], angle: 145 },
  { id: 'lime', stops: ['#e6f5a3', '#b9d94e'], angle: 135 },
  { id: 'lavender', stops: ['#e3ddfb', '#b3a4f5'], angle: 130 },
  { id: 'peach', stops: ['#ffe3d3', '#f7b79b'], angle: 125 },
  { id: 'rose', stops: ['#fbe0e6', '#e3a3b5'], angle: 135 },
  { id: 'sky', stops: ['#dcecfb', '#9dc4ec'], angle: 140 },
  { id: 'teal', stops: ['#d6efea', '#7fbfb4'], angle: 130 },
  { id: 'sand', stops: ['#f4ead9', '#d9bd93'], angle: 120 },
  { id: 'moss', stops: ['#e2ecd9', '#a3bd8f'], angle: 135 },
  { id: 'plum', stops: ['#2d1f3d', '#6b4a7d'], angle: 140 },
  { id: 'ocean', stops: ['#0b2540', '#2d6a8f'], angle: 150 },
  { id: 'ember', stops: ['#3d1f1f', '#8f4a3a'], angle: 140 },
  { id: 'forest', stops: ['#16281f', '#3f6b4f'], angle: 145 },
  { id: 'mint-lav', stops: ['#d9f2e6', '#c9d4f7', '#e0d4f7'], angle: 135 },
  { id: 'sunrise', stops: ['#fde8c8', '#f7b7a3', '#d99ab8'], angle: 120 },
  { id: 'citrus', stops: ['#f7f3c4', '#cdeb4e', '#8fbf5a'], angle: 130 },
  { id: 'candy', stops: ['#e8dcfb', '#f7c9d9', '#fbe3c9'], angle: 125 },
  { id: 'steel', stops: ['#1a1d21', '#3d4550', '#5c6570'], angle: 145 },
  { id: 'aurora', stops: ['#12293d', '#2d6a8f', '#7fbfb4'], angle: 150 },
  { id: 'grape', stops: ['#1f1b3d', '#4a3d8f', '#b3a4f5'], angle: 140 },
  { id: 'clay', stops: ['#f0e6e0', '#d4b8a8', '#a88a7a'], angle: 130 },
]

/** CSS gradient string for swatch previews — the canvas builds its own. */
export function gradientCss(g: { stops: string[]; angle: number }) {
  return `linear-gradient(${g.angle + 90}deg, ${g.stops.join(', ')})`
}

/** Konva colorStops: [offset, color, offset, color, ...] */
export function konvaStops(stops: string[]): (number | string)[] {
  if (stops.length < 2) return [0, stops[0] ?? '#000', 1, stops[0] ?? '#000']
  return stops.flatMap((c, i) => [i / (stops.length - 1), c])
}
