export interface SizePreset {
  id: string
  group: string
  label: string
  w: number
  h: number
}

export const PRESETS: SizePreset[] = [
  { id: 'x-landscape', group: 'X / Twitter', label: 'Feed 16:9', w: 1600, h: 900 },
  { id: 'x-portrait', group: 'X / Twitter', label: 'Portrait 4:5', w: 1080, h: 1350 },
  { id: 'ig-square', group: 'Instagram', label: 'Square', w: 1080, h: 1080 },
  { id: 'ig-portrait', group: 'Instagram', label: 'Portrait 4:5', w: 1080, h: 1350 },
  { id: 'ig-story', group: 'Instagram', label: 'Story / Reels', w: 1080, h: 1920 },
  { id: 'pinterest', group: 'Pinterest', label: 'Pin 2:3', w: 1000, h: 1500 },
  { id: 'linkedin', group: 'LinkedIn', label: 'Post', w: 1200, h: 627 },
  { id: 'facebook', group: 'Facebook', label: 'Link post', w: 1200, h: 630 },
  { id: 'og', group: 'Web', label: 'OG / meta card', w: 1200, h: 630 },
  { id: 'yt', group: 'Web', label: 'YouTube thumb', w: 1280, h: 720 },
  { id: 'ph', group: 'Launch', label: 'Product Hunt', w: 1270, h: 760 },
  { id: 'dribbble', group: 'Launch', label: 'Dribbble shot', w: 1600, h: 1200 },
  { id: 'appstore', group: 'Launch', label: 'App Store 6.7"', w: 1290, h: 2796 },
]

/** Groups in insertion order, for a sectioned picker. */
export function presetGroups(): { group: string; items: SizePreset[] }[] {
  const out: { group: string; items: SizePreset[] }[] = []
  for (const p of PRESETS) {
    const last = out[out.length - 1]
    if (last && last.group === p.group) last.items.push(p)
    else out.push({ group: p.group, items: [p] })
  }
  return out
}

export function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id)
}

/**
 * "Fit to screenshot": canvas that hugs the image with a proportional margin.
 * Rounded to even numbers because odd export dimensions upset some encoders.
 */
export function fitToImage(iw: number, ih: number, marginPct = 0.14) {
  const m = Math.round(Math.min(iw, ih) * marginPct)
  const even = (n: number) => n + (n % 2)
  return { w: even(iw + m * 2), h: even(ih + m * 2) }
}
