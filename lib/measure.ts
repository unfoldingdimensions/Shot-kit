let ctx: CanvasRenderingContext2D | null = null

function measureCtx() {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')
  return ctx
}

/** Wrapped line count for `text` at a given font, matching Konva's word wrap. */
export function countLines(text: string, font: string, maxWidth: number): number {
  if (!text) return 0
  const c = measureCtx()
  if (!c || maxWidth <= 0) return text.split('\n').length
  c.font = font
  let lines = 0
  for (const para of text.split('\n')) {
    if (!para) {
      lines += 1
      continue
    }
    let cur = ''
    let n = 1
    for (const word of para.split(/\s+/)) {
      const next = cur ? `${cur} ${word}` : word
      if (c.measureText(next).width > maxWidth && cur) {
        n += 1
        cur = word
      } else {
        cur = next
      }
    }
    lines += n
  }
  return lines
}

export interface TextBlockMetrics {
  headingLines: number
  subLines: number
  height: number
}

/**
 * Height a heading+subtext block will occupy. Called before layout so the frame
 * knows how much room to give up — measuring after layout would be circular.
 */
export function measureTextBlock(opts: {
  heading: string
  sub: string
  fontFamily: string
  weight: number
  italic: boolean
  size: number
  lineHeight: number
  maxWidth: number
}): TextBlockMetrics {
  const { heading, sub, fontFamily, weight, italic, size, lineHeight, maxWidth } = opts
  const subSize = size * 0.44
  const style = italic ? 'italic ' : ''
  const headingLines = countLines(heading, `${style}${weight} ${size}px ${fontFamily}`, maxWidth)
  const subLines = countLines(sub, `${style}400 ${subSize}px ${fontFamily}`, maxWidth)
  const headingH = headingLines * size * lineHeight
  const subH = subLines * subSize * 1.45
  const gap = headingLines && subLines ? size * 0.3 : 0
  return { headingLines, subLines, height: headingH + subH + gap }
}

export const SUB_SIZE_RATIO = 0.44
