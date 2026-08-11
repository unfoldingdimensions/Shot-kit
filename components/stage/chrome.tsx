'use client'
import { Circle, Group, Line, Rect, Text } from 'react-konva'
import { CHROME_PALETTE, MAC_LIGHTS, type ChromeKind, type ChromeOS, type ChromeTheme } from '@/lib/chrome'

interface Props {
  kind: ChromeKind
  os: ChromeOS
  theme: ChromeTheme
  w: number
  barH: number
  radius: number
  url: string
  filename: string
  title: string
  fontFamily: string
}

/** macOS traffic lights, left-aligned. */
function MacLights({ barH, y }: { barH: number; y: number }) {
  const r = barH * 0.135
  return (
    <>
      {MAC_LIGHTS.map((c, i) => (
        <Circle key={c} x={barH * 0.6 + i * r * 3.2} y={y} radius={r} fill={c} />
      ))}
    </>
  )
}

/** Windows 11 minimise / maximise / close, right-aligned. */
function WinControls({ w, barH, y, color }: { w: number; barH: number; y: number; color: string }) {
  const s = barH * 0.2
  const step = barH * 1.15
  const x1 = w - step * 2.5
  const x2 = w - step * 1.5
  const x3 = w - step * 0.5
  const sw = Math.max(barH * 0.045, 0.6)
  return (
    <>
      <Line points={[x1 - s, y, x1 + s, y]} stroke={color} strokeWidth={sw} />
      <Rect x={x2 - s} y={y - s} width={s * 2} height={s * 2} stroke={color} strokeWidth={sw} />
      <Line points={[x3 - s, y - s, x3 + s, y + s]} stroke={color} strokeWidth={sw} />
      <Line points={[x3 + s, y - s, x3 - s, y + s]} stroke={color} strokeWidth={sw} />
    </>
  )
}

/**
 * Every dimension derives from `barH`, which derives from frame width — that is
 * what keeps the window identically proportioned at 1000px or 4000px wide.
 */
export function Chrome(p: Props) {
  const { kind, os, theme, w, barH, radius, fontFamily } = p
  if (kind === 'plain' || barH <= 0) return null
  const c = CHROME_PALETTE[theme]
  const topR = Math.min(radius, barH)
  const mid = barH / 2

  if (kind === 'editor') {
    const titleH = barH * 0.52
    const tabH = barH - titleH
    const tabW = Math.max(w * 0.16, barH * 3)
    const tabR = tabH * 0.28
    return (
      <Group listening={false}>
        <Rect width={w} height={titleH} fill={c.bar} cornerRadius={[topR, topR, 0, 0]} />
        <Rect y={titleH} width={w} height={tabH} fill={c.bar2} />
        {os === 'mac' ? (
          <MacLights barH={titleH} y={titleH / 2} />
        ) : (
          <WinControls w={w} barH={titleH} y={titleH / 2} color={c.text} />
        )}
        {/* active tab sits proud of the strip */}
        <Rect
          x={barH * 0.3}
          y={titleH}
          width={tabW}
          height={tabH}
          fill={c.bar}
          cornerRadius={[tabR, tabR, 0, 0]}
        />
        <Circle x={barH * 0.3 + tabH * 0.5} y={titleH + tabH / 2} radius={tabH * 0.11} fill="#4fa3f7" />
        <Text
          x={barH * 0.3 + tabH * 0.85}
          y={titleH + tabH / 2 - tabH * 0.19}
          width={tabW - tabH}
          text={p.filename}
          fontSize={tabH * 0.38}
          fontFamily={fontFamily}
          fill={c.text}
          ellipsis
          wrap="none"
        />
        <Line points={[0, barH, w, barH]} stroke={c.line} strokeWidth={Math.max(w * 0.0008, 0.5)} />
      </Group>
    )
  }

  if (kind === 'code-file') {
    return (
      <Group listening={false}>
        <Rect width={w} height={barH} fill={c.bar} cornerRadius={[topR, topR, 0, 0]} />
        <Rect
          x={barH * 0.45}
          y={mid - barH * 0.19}
          width={barH * 0.38}
          height={barH * 0.38}
          cornerRadius={barH * 0.1}
          fill="#4fa3f7"
        />
        <Text
          x={barH * 1.05}
          y={mid - barH * 0.16}
          width={w * 0.6}
          text={p.filename}
          fontSize={barH * 0.32}
          fontFamily={fontFamily}
          fontStyle="500"
          fill={c.text}
          ellipsis
          wrap="none"
        />
        {[0, 1, 2].map((i) => (
          <Circle
            key={i}
            x={w - barH * (1.15 - i * 0.32)}
            y={mid}
            radius={barH * 0.075}
            fill={c.text}
            opacity={0.55}
          />
        ))}
        <Line points={[0, barH, w, barH]} stroke={c.line} strokeWidth={Math.max(w * 0.0008, 0.5)} />
      </Group>
    )
  }

  if (kind === 'settings') {
    return (
      <Group listening={false}>
        <Rect width={w} height={barH} fill={c.bar} cornerRadius={[topR, topR, 0, 0]} />
        {os === 'mac' ? (
          <MacLights barH={barH} y={mid} />
        ) : (
          <WinControls w={w} barH={barH} y={mid} color={c.text} />
        )}
        <Text
          x={0}
          y={mid - barH * 0.18}
          width={w}
          align="center"
          text={p.title}
          fontSize={barH * 0.34}
          fontFamily={fontFamily}
          fontStyle="600"
          fill={c.text}
          ellipsis
          wrap="none"
        />
        <Line points={[0, barH, w, barH]} stroke={c.line} strokeWidth={Math.max(w * 0.0008, 0.5)} />
      </Group>
    )
  }

  // browser
  const pillW = Math.max(w * 0.4, barH * 6)
  const pillH = barH * 0.54
  return (
    <Group listening={false}>
      <Rect width={w} height={barH} fill={c.bar} cornerRadius={[topR, topR, 0, 0]} />
      {os === 'mac' ? (
        <MacLights barH={barH} y={mid} />
      ) : (
        <WinControls w={w} barH={barH} y={mid} color={c.text} />
      )}
      <Rect
        x={(w - pillW) / 2}
        y={mid - pillH / 2}
        width={pillW}
        height={pillH}
        cornerRadius={pillH / 2}
        fill={c.pill}
        stroke={c.line}
        strokeWidth={Math.max(w * 0.0008, 0.5)}
      />
      <Text
        x={(w - pillW) / 2}
        y={mid - barH * 0.15}
        width={pillW}
        align="center"
        text={p.url}
        fontSize={barH * 0.3}
        fontFamily={fontFamily}
        fill={c.text}
        ellipsis
        wrap="none"
      />
      <Line points={[0, barH, w, barH]} stroke={c.line} strokeWidth={Math.max(w * 0.0008, 0.5)} />
    </Group>
  )
}
