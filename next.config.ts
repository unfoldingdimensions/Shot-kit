import type { NextConfig } from 'next'

const config: NextConfig = {
  // `next build` and `next dev` both write to .next, so building while the dev
  // server is running replaces the chunks it is serving and the page loads as
  // unstyled HTML. Set NEXT_DIST_DIR to build somewhere else instead.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // Turbopack replaces the old `webpack` externals block — keeping both is a
  // hard error since Next 16 made Turbopack the default.
  //
  // konva's Node entry does `require('canvas')`. We never render Konva on the
  // server (the scene loads through a client-side dynamic import), but the
  // bundler still resolves the module, and `canvas` is an uninstalled native
  // package. Point it at a stub instead.
  turbopack: {
    resolveAlias: {
      canvas: './lib/empty-module.js',
    },
  },
}

export default config
