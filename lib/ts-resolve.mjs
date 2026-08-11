// Lets `npm run check` import extensionless relative specifiers, the way the
// bundler does, so lib/ stays idiomatic instead of littered with `.ts`.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('.') && !/\.[a-z]+$/i.test(spec)) return next(`${spec}.ts`, ctx)
    return next(spec, ctx)
  },
})
