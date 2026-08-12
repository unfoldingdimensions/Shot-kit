import type { NextConfig } from 'next'

// konva ships a node-canvas fallback it never needs in the browser build
const config: NextConfig = {
  // `next build` and `next dev` both write to .next, so building while the dev
  // server is running replaces the chunks it is serving and the page loads as
  // unstyled HTML. Set NEXT_DIST_DIR to build somewhere else instead.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  webpack: (c) => {
    c.externals = [...(c.externals ?? []), { canvas: 'commonjs canvas' }]
    return c
  },
}

export default config
