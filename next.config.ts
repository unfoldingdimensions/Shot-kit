import type { NextConfig } from 'next'

// konva ships a node-canvas fallback it never needs in the browser build
const config: NextConfig = {
  webpack: (c) => {
    c.externals = [...(c.externals ?? []), { canvas: 'commonjs canvas' }]
    return c
  },
}

export default config
