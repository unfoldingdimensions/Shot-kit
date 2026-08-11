export type ChromeKind = 'browser' | 'editor' | 'code-file' | 'settings' | 'plain'
export type ChromeOS = 'mac' | 'win'
export type ChromeTheme = 'light' | 'dark'

export const CHROME_KINDS: { id: ChromeKind; label: string }[] = [
  { id: 'browser', label: 'Browser' },
  { id: 'editor', label: 'Code editor' },
  { id: 'code-file', label: 'Code file' },
  { id: 'settings', label: 'Settings' },
  { id: 'plain', label: 'Plain' },
]

/**
 * Chrome height as a fraction of frame WIDTH. Deriving every chrome dimension
 * from the frame's own width is what makes the window look identically
 * proportioned whether the export is 1000px or 4000px wide.
 */
export const CHROME_BAR_RATIO: Record<ChromeKind, number> = {
  browser: 0.038,
  editor: 0.072, // title bar + tab strip
  'code-file': 0.042,
  settings: 0.04,
  plain: 0,
}

export const CHROME_PALETTE = {
  light: { bar: '#f2f2f0', bar2: '#e8e8e5', text: '#5c5c60', line: '#dededa', pill: '#ffffff' },
  dark: { bar: '#1e1e22', bar2: '#17171a', text: '#9a9aa2', line: '#2c2c32', pill: '#26262c' },
} satisfies Record<ChromeTheme, Record<string, string>>

export const MAC_LIGHTS = ['#ff5f57', '#febc2e', '#28c840']
