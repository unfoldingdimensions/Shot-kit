/**
 * One command that proves the tree is good: self-check, types, production build.
 *
 * The build goes to its own directory so it cannot replace the chunks a running
 * dev server is serving. Next rewrites tsconfig.json's `include` to point at
 * whatever distDir it built into, so the original is restored afterwards —
 * otherwise every verify run left the repo dirty.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'

const DIST = '.next-verify'
const TSCONFIG = 'tsconfig.json'

const run = (label, cmd, args, env) => {
  process.stdout.write(`\n▶ ${label}\n`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } })
  if (r.status !== 0) {
    process.stdout.write(`\n✗ ${label} failed\n`)
    process.exit(r.status ?? 1)
  }
}

const before = readFileSync(TSCONFIG, 'utf8')
try {
  run('self-check', 'npm', ['run', '--silent', 'check'])
  run('typecheck', 'npx', ['tsc', '--noEmit'])
  run('build', 'npx', ['next', 'build'], { NEXT_DIST_DIR: DIST })
} finally {
  const after = readFileSync(TSCONFIG, 'utf8')
  if (after !== before) {
    writeFileSync(TSCONFIG, before)
    process.stdout.write(`\n· restored ${TSCONFIG} (the build had rewritten it)\n`)
  }
  rmSync(DIST, { recursive: true, force: true })
}
process.stdout.write('\n✓ all good\n')
