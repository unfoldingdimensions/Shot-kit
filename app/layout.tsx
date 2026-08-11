import type { Metadata } from 'next'
import { inter, interTight } from '@/lib/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Shotkit — frame screenshots for social',
  description:
    'Drop a screenshot, wrap it in a clean window and a gradient, add text, export at the exact size Twitter, Instagram or Pinterest wants. Runs entirely in your browser.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable}`}>
      <body>{children}</body>
    </html>
  )
}
