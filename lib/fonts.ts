import {
  Inter,
  Inter_Tight,
  Space_Grotesk,
  Bricolage_Grotesque,
  Instrument_Serif,
  Playfair_Display,
  JetBrains_Mono,
} from 'next/font/google'

export const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
export const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  display: 'swap',
})
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap' })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], display: 'swap' })
const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
})
const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], display: 'swap' })

export interface FontDef {
  id: string
  label: string
  /** The hashed family name next/font generated — what Konva must be given. */
  family: string
  className: string
  weights: number[]
}

export const FONTS: FontDef[] = [
  { id: 'inter-tight', label: 'Inter Tight', family: interTight.style.fontFamily, className: interTight.className, weights: [400, 500, 600, 700, 800] },
  { id: 'inter', label: 'Inter', family: inter.style.fontFamily, className: inter.className, weights: [400, 500, 600, 700, 800] },
  { id: 'space-grotesk', label: 'Space Grotesk', family: spaceGrotesk.style.fontFamily, className: spaceGrotesk.className, weights: [400, 500, 600, 700] },
  { id: 'bricolage', label: 'Bricolage Grotesque', family: bricolage.style.fontFamily, className: bricolage.className, weights: [400, 500, 600, 700, 800] },
  { id: 'instrument-serif', label: 'Instrument Serif', family: instrument.style.fontFamily, className: instrument.className, weights: [400] },
  { id: 'playfair', label: 'Playfair Display', family: playfair.style.fontFamily, className: playfair.className, weights: [400, 500, 600, 700, 800] },
  { id: 'jetbrains', label: 'JetBrains Mono', family: jetbrains.style.fontFamily, className: jetbrains.className, weights: [400, 500, 700] },
]

export function fontById(id: string) {
  return FONTS.find((f) => f.id === id) ?? FONTS[0]
}

/**
 * Konva measures text through the browser, so an unloaded face renders as the
 * fallback and exports silently wrong. Forcing every face to load before draw
 * is the only reliable fix; `document.fonts.ready` alone does not cover faces
 * that no DOM node has requested yet.
 */
export async function ensureFontsLoaded() {
  if (typeof document === 'undefined' || !document.fonts) return
  const jobs: Promise<unknown>[] = []
  for (const f of FONTS) {
    for (const w of [400, 700]) {
      jobs.push(document.fonts.load(`${w} 48px ${f.family}`).catch(() => undefined))
      jobs.push(document.fonts.load(`italic ${w} 48px ${f.family}`).catch(() => undefined))
    }
  }
  await Promise.all(jobs)
  await document.fonts.ready
}
