/**
 * Self-check for the pure logic. `npm run check`.
 *
 * These are the branches that fail SILENTLY in a canvas app — a clamped export
 * that should have stepped down, a layout that quietly pushes the frame to zero
 * width. Everything else fails visibly on screen, so it isn't covered here.
 */
import assert from 'node:assert/strict'
import { clampExportScale, exportPixels, filenameFor, MAX_EXPORT_PIXELS } from './export'
import { fitToViewport, fitFrame, layout, gradientPoints, coverRect } from './geometry'
import { fitToImage, findPreset, presetGroups, PRESETS } from './presets'
import { dominantColors, gradientFromColors, luminance, mix, toHex, fromHex } from './colors'
import { konvaStops, GRADIENTS } from './gradients'
import { reducer, initialState, initialHistory, clampDim, type History } from './state'
import { CHROME_BAR_RATIO } from './chrome'
import {
  ANCHOR_SCREEN_PX,
  ANNO_KINDS,
  BOXY,
  FRAME_SPACE,
  anchorFor,
  clampAnno,
  createAnno,
  inFrameSpace,
  nextBadgeLabel,
  POINTER_PATH,
} from './annotations'
import { averageBlocks, blockDims } from './raster'

const near = (a: number, b: number, eps = 0.01) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`)

// --- export math -----------------------------------------------------------
assert.equal(clampExportScale(1600, 900, 2), 2, '1600x900 @2x is well under the ceiling')
assert.equal(clampExportScale(1600, 900, 3), 3, '1600x900 @3x = 12.9M, still under')
// 1080x1920 @3x = 17.9M — over the iOS ceiling, must step down rather than blank
assert.equal(clampExportScale(1080, 1920, 3), 2)
assert.equal(clampExportScale(4000, 4000, 3), 1, '16M exactly is still allowed at 1x')
// past the ceiling even at 1x, the export must shrink rather than come back blank
assert.equal(clampExportScale(5000, 5000, 3), 0.8)
{
  const s = clampExportScale(1080, 1920, 3)
  assert.ok(1080 * 1920 * s * s <= MAX_EXPORT_PIXELS)
}
assert.deepEqual(exportPixels(1600, 900, 2), { w: 3200, h: 1800 })
assert.equal(filenameFor('Feed 16:9', 1600, 900, 'png'), 'screenshot-feed-16-9-1600x900.png')
assert.equal(filenameFor('Story / Reels', 1080, 1920, 'jpg'), 'screenshot-story-reels-1080x1920.jpg')

// --- viewport fit ----------------------------------------------------------
near(fitToViewport(1600, 900, 800, 900), 0.5)
near(fitToViewport(1080, 1920, 800, 480), 0.25)
assert.equal(fitToViewport(400, 300, 2000, 2000), 1, 'never upscale past 1:1')

// --- frame fit -------------------------------------------------------------
{
  // no chrome, square box, 2:1 image -> width-bound
  const f = fitFrame({ x: 0, y: 0, w: 1000, h: 1000 }, 2, 0, 1)
  near(f.w, 1000)
  near(f.h, 500)
  near(f.x, 0)
  near(f.y, 250, 0.02) // centred vertically
}
{
  // tall box, wide image -> still width-bound; chrome adds height
  const bar = CHROME_BAR_RATIO.browser
  const f = fitFrame({ x: 10, y: 20, w: 800, h: 2000 }, 16 / 9, bar, 1)
  near(f.w, 800)
  near(f.h, 800 * (9 / 16 + bar))
}
{
  // height-bound: 1:1 image into a wide, short box
  const f = fitFrame({ x: 0, y: 0, w: 1000, h: 300 }, 1, 0, 1)
  near(f.h, 300)
  near(f.w, 300)
  near(f.x, 350)
}
{
  const half = fitFrame({ x: 0, y: 0, w: 1000, h: 1000 }, 1, 0, 0.5)
  near(half.w, 500)
  near(half.x, 250, 0.02)
}

// --- layout ----------------------------------------------------------------
{
  const r = layout({
    width: 1600,
    height: 900,
    padding: 100,
    aspect: 16 / 9,
    barRatio: 0,
    frameScale: 1,
    reserve: { top: 120 },
    gap: 24,
  })
  near(r.slots.top.y, 100)
  near(r.slots.top.h, 120)
  near(r.slots.top.w, 1400)
  assert.ok(r.frame.y >= 100 + 120 + 24 - 0.01, 'frame starts below the reserved band')
  assert.ok(r.frame.y + r.frame.h <= 800.01, 'frame stays inside the padded box')
}
{
  // absurd reservations must not drive the frame negative
  const r = layout({
    width: 1000,
    height: 1000,
    padding: 40,
    aspect: 1,
    barRatio: 0.04,
    frameScale: 1,
    reserve: { top: 900, bottom: 900, left: 900, right: 900 },
    gap: 20,
  })
  assert.ok(r.frame.w > 0 && r.frame.h > 0, 'frame survives')
  for (const b of Object.values(r.slots)) assert.ok(b.w >= 0 && b.h >= 0)
}
{
  const r = layout({
    width: 1080,
    height: 1350,
    padding: 60,
    aspect: 1.6,
    barRatio: 0.072,
    frameScale: 1,
    reserve: { left: 90, right: 90 },
    gap: 20,
  })
  near(r.slots.left.w, 90)
  near(r.slots.right.x + r.slots.right.w, 1020)
  assert.ok(r.frame.x >= 60 + 90 + 20 - 0.01)
}
{
  // no text at all -> frame centred in the full padded box
  const r = layout({
    width: 1200,
    height: 1200,
    padding: 100,
    aspect: 1,
    barRatio: 0,
    frameScale: 1,
    reserve: {},
    gap: 24,
  })
  near(r.frame.x, 100)
  near(r.frame.w, 1000)
  for (const b of Object.values(r.slots)) assert.equal(b.h * b.w === 0, true, 'unused slots are empty')
}

// --- gradients -------------------------------------------------------------
{
  const p = gradientPoints(0, 1000, 500)
  near(p.start.x, 0)
  near(p.end.x, 1000)
  near(p.start.y, 250)
  near(p.end.y, 250)
}
{
  const p = gradientPoints(90, 1000, 500)
  near(p.start.y, 0)
  near(p.end.y, 500)
  near(p.start.x, 500)
}
assert.deepEqual(konvaStops(['#000', '#fff']), [0, '#000', 1, '#fff'])
assert.deepEqual(konvaStops(['#a', '#b', '#c']), [0, '#a', 0.5, '#b', 1, '#c'])
assert.equal(konvaStops(['#123456']).length, 4, 'single colour degrades to a flat gradient')
for (const g of GRADIENTS) {
  assert.ok(g.stops.length >= 2, `${g.id} needs 2+ stops`)
  for (const s of g.stops) assert.match(s, /^#[0-9a-f]{6}$/i, `${g.id}: ${s}`)
}

// --- cover fit -------------------------------------------------------------
{
  const box = { x: 0, y: 0, w: 1000, h: 1000 }
  const r = coverRect(box, 2000, 1000) // wide image into a square
  assert.ok(r.w >= box.w - 0.01 && r.h >= box.h - 0.01, 'covers the box')
  near(r.h, 1000)
  near(r.w, 2000)
  near(r.x, -500, 0.02) // overhang split evenly
}

// --- presets ---------------------------------------------------------------
assert.equal(findPreset('ig-story')?.h, 1920)
assert.equal(findPreset('nope'), undefined)
{
  const ids = new Set(PRESETS.map((p) => p.id))
  assert.equal(ids.size, PRESETS.length, 'preset ids are unique')
  const groups = presetGroups()
  assert.equal(
    groups.reduce((n, g) => n + g.items.length, 0),
    PRESETS.length,
    'grouping loses no presets',
  )
  assert.deepEqual(
    groups.map((g) => g.group),
    [...new Set(PRESETS.map((p) => p.group))],
    'groups stay in insertion order and never repeat',
  )
}
{
  const f = fitToImage(1201, 801)
  assert.equal(f.w % 2, 0, 'even width')
  assert.equal(f.h % 2, 0, 'even height')
  assert.ok(f.w > 1201 && f.h > 801, 'leaves a margin')
}

// --- colours ---------------------------------------------------------------
assert.equal(toHex(255, 0, 0), '#ff0000')
assert.deepEqual(fromHex('#fff'), [255, 255, 255])
assert.deepEqual(fromHex('#b3a4f5'), [179, 164, 245])
assert.equal(mix('#000000', '#ffffff', 0.5), '#808080')
assert.ok(luminance('#ffffff') > 0.99 && luminance('#000000') < 0.01)
{
  // 3 blue pixels, 1 red, plus white + grey that must both be ignored
  const px = new Uint8ClampedArray([
    ...[20, 60, 200, 255], ...[20, 60, 200, 255], ...[20, 60, 200, 255],
    ...[200, 40, 40, 255],
    ...[255, 255, 255, 255], ...[128, 128, 128, 255],
  ])
  const [first, second] = dominantColors(px, 2)
  const [r, g, b] = fromHex(first)
  assert.ok(b > r && b > g, `dominant should be the blue, got ${first}`)
  const [r2] = fromHex(second)
  assert.ok(r2 > 150, `second should be the red, got ${second}`)
}
{
  // all-greyscale input has no signature colour; must still return `count` values
  const px = new Uint8ClampedArray([...[128, 128, 128, 255], ...[130, 130, 130, 255]])
  assert.equal(dominantColors(px, 2).length, 2)
}
{
  const light = gradientFromColors(['#3d7fd9', '#d94a4a'])
  assert.equal(light.stops.length, 2)
  assert.ok(luminance(light.stops[0]) > luminance('#3d7fd9'), 'light source is lifted')
  const dark = gradientFromColors(['#101a2b', '#2b1a10'])
  assert.ok(luminance(dark.stops[0]) < luminance('#101a2b'), 'dark source is deepened')
}

// --- state -----------------------------------------------------------------
assert.equal(clampDim(0), 64)
assert.equal(clampDim(99999), 8000)
assert.equal(clampDim(1234.6), 1235)
{
  let h: History = initialHistory
  h = reducer(h, { type: 'preset', id: 'ig-story' })
  assert.equal(h.present.width, 1080)
  assert.equal(h.present.height, 1920)

  h = reducer(h, { type: 'frame', patch: { chrome: 'editor' } })
  assert.equal(h.present.frame.chrome, 'editor')

  h = reducer(h, { type: 'undo' })
  assert.equal(h.present.frame.chrome, 'browser', 'undo reverts the frame change')
  assert.equal(h.present.width, 1080, 'and only that change')

  h = reducer(h, { type: 'redo' })
  assert.equal(h.present.frame.chrome, 'editor')

  // a fresh edit must drop the redo stack
  h = reducer(h, { type: 'undo' })
  h = reducer(h, { type: 'bg', patch: { mode: 'solid' } })
  assert.equal(h.future.length, 0)

  // undo past the beginning is a no-op, not a crash
  let empty: History = initialHistory
  assert.equal(reducer(empty, { type: 'undo' }), empty)
  assert.equal(reducer(empty, { type: 'redo' }), empty)

  // load resets history; the image survives a reset
  const withImg = reducer(empty, { type: 'image', src: 'blob:x', w: 800, h: 600, name: 'a.png' })
  const afterReset = reducer(withImg, { type: 'reset' })
  assert.equal(afterReset.present.image.src, 'blob:x', 'reset keeps the dropped screenshot')
  assert.equal(afterReset.present.frame.chrome, 'browser')

  // history is bounded
  let many: History = initialHistory
  for (let i = 0; i < 200; i++) many = reducer(many, { type: 'frame', patch: { rotation: i * 0.1 } })
  assert.ok(many.past.length <= 60, `history capped, got ${many.past.length}`)

  // unknown preset id leaves state untouched
  const before = h.present
  assert.equal(reducer(h, { type: 'preset', id: 'nope' }).present, before)
}

// --- annotations -----------------------------------------------------------
{
  // every kind must produce on-canvas defaults, or a new annotation appears
  // somewhere the user cannot see and looks like a no-op
  for (const k of ANNO_KINDS) {
    const a = createAnno(k.id, 'x')
    assert.ok(a.x >= 0 && a.x <= 1 && a.y >= 0 && a.y <= 1, `${k.id} starts on canvas`)
    assert.ok(a.size > 0, `${k.id} has a visible size`)
    assert.equal(a.kind, k.id)
    if (BOXY.includes(k.id)) assert.ok(a.w > 0.02 && a.h > 0.02, `${k.id} has a grabbable box`)
  }
  assert.match(createAnno('badge', 'x').color, /^#[0-9a-f]{6}$/i)
  assert.equal(POINTER_PATH.length % 2, 0, 'pointer polygon is x,y pairs')
}
{
  // step numbers fill the first gap, so deleting #2 of 3 cannot duplicate a number
  const mk = (label: string) => ({ ...createAnno('badge', label), label })
  assert.equal(nextBadgeLabel([]), '1')
  assert.equal(nextBadgeLabel([mk('1'), mk('2')]), '3')
  assert.equal(nextBadgeLabel([mk('1'), mk('3')]), '2', 'reuses the gap')
  // non-badge annotations must not consume numbers
  assert.equal(nextBadgeLabel([createAnno('box', 'b')]), '1')
}
{
  // dragging must never lose an annotation off the canvas
  const far = clampAnno({ ...createAnno('badge', 'b'), x: 9, y: -4 })
  assert.equal(far.x, 1)
  assert.equal(far.y, 0)

  const arrow = clampAnno({ ...createAnno('arrow', 'a'), x: -2, y: 0.5, x2: 7, y2: 0.5 })
  assert.equal(arrow.x, 0)
  assert.equal(arrow.x2, 1)
  assert.equal(arrow.y, 0.5, 'in-range coordinates are untouched')

  // a box keeps at least half of itself on canvas, and cannot be resized to nothing
  const box = clampAnno({ ...createAnno('box', 'c'), x: 5, y: 5, w: 0.4, h: 0.4 })
  assert.ok(box.x <= 1 - box.w / 2 + 1e-9 && box.y <= 1 - box.h / 2 + 1e-9)
  assert.equal(clampAnno({ ...createAnno('box', 'd'), w: 0, h: -1 }).w, 0.02)
}
{
  // A whole drag gesture must collapse to exactly ONE undo step that lands back
  // on the pre-drag position. Recording nothing makes undo skip the drag
  // entirely; recording every frame makes undo crawl back a pixel at a time.
  let h: History = initialHistory
  assert.deepEqual(h.present.annos, [])

  h = reducer(h, { type: 'annoAdd', anno: createAnno('arrow', 'a1') })
  const startX = h.present.annos[0].x
  const depth = h.past.length

  h = reducer(h, { type: 'annoDrag', id: 'a1', patch: { x: 0.1 } })
  assert.equal(h.past.length, depth + 1, 'the first frame records the starting point')
  assert.equal(h.gesture, true)
  h = reducer(h, { type: 'annoDrag', id: 'a1', patch: { x: 0.2 } })
  h = reducer(h, { type: 'annoDrag', id: 'a1', patch: { x: 0.3 } })
  assert.equal(h.past.length, depth + 1, 'later frames record nothing')
  assert.equal(h.present.annos[0].x, 0.3, 'but still move the annotation')

  h = reducer(h, { type: 'annoCommit', id: 'a1', patch: { x: 0.4 } })
  assert.equal(h.past.length, depth + 1, 'closing the gesture records nothing extra')
  assert.equal(h.gesture, false)
  assert.equal(h.present.annos[0].x, 0.4)

  h = reducer(h, { type: 'undo' })
  assert.equal(h.present.annos[0].x, startX, 'one undo reverts the entire gesture')
  h = reducer(h, { type: 'redo' })
  assert.equal(h.present.annos[0].x, 0.4, 'redo reapplies the whole gesture')

  // a commit with no preceding drag (transform-end) still records its own step
  const d2 = h.past.length
  h = reducer(h, { type: 'annoCommit', id: 'a1', patch: { w: 0.5 } })
  assert.equal(h.past.length, d2 + 1, 'a bare commit records one step')
  h = reducer(h, { type: 'undo' })
  assert.equal(h.present.annos[0].w, 0.2)
  h = reducer(h, { type: 'redo' })

  // an unrelated edit mid-gesture must still record itself
  let g: History = initialHistory
  g = reducer(g, { type: 'annoAdd', anno: createAnno('box', 'b9') })
  g = reducer(g, { type: 'annoDrag', id: 'b9', patch: { x: 0.7 } })
  const mid = g.past.length
  g = reducer(g, { type: 'frame', patch: { rotation: 5 } })
  assert.equal(g.past.length, mid + 1, 'unrelated edits are never swallowed by a gesture')
  assert.equal(g.gesture, false)

  // patching a missing id is a no-op rather than a crash
  const same = reducer(h, { type: 'annoPatch', id: 'nope', patch: { x: 0.9 } })
  assert.equal(same.present, h.present)
  assert.equal(reducer(h, { type: 'annoRemove', id: 'nope' }).present, h.present)

  h = reducer(h, { type: 'annoAdd', anno: createAnno('badge', 'b1') })
  h = reducer(h, { type: 'annoRemove', id: 'a1' })
  assert.deepEqual(h.present.annos.map((a) => a.id), ['b1'])

  h = reducer(h, { type: 'annoClear' })
  assert.equal(h.present.annos.length, 0)
  assert.equal(reducer(h, { type: 'annoClear' }).present, h.present, 'clearing twice is a no-op')

  // reset drops annotations but keeps the screenshot
  let r: History = initialHistory
  r = reducer(r, { type: 'image', src: 'blob:x', w: 8, h: 6, name: 'n.png' })
  r = reducer(r, { type: 'annoAdd', anno: createAnno('box', 'z') })
  r = reducer(r, { type: 'reset' })
  assert.equal(r.present.annos.length, 0)
  assert.equal(r.present.image.src, 'blob:x')
}

// --- redaction -------------------------------------------------------------
{
  const r = createAnno('redact', 'r1')
  assert.equal(r.redactMode, 'pixelate', 'defaults to the strongest option')
  assert.ok(r.intensity >= 3, 'enough blocks to actually obscure text')
  assert.ok(inFrameSpace('redact'), 'redaction is image-relative, not canvas-relative')
  assert.ok(!inFrameSpace('box') && !inFrameSpace('pointer'))
  assert.ok(BOXY.includes('redact'), 'redaction is resizable')
  // exactly one kind lives in frame space; the stage splits on this
  assert.deepEqual(FRAME_SPACE, ['redact'])
}
{
  // blocks must stay square-ish, so a wide strip gets few rows and many columns
  const wide = blockDims({ x: 0, y: 0, w: 0.5, h: 0.05 }, 1600, 900, 20)
  assert.equal(wide.cols, 20)
  // 0.5*1600 = 800 wide, 0.05*900 = 45 tall -> 20 * 45/800 ≈ 1.1 -> 1 row
  assert.equal(wide.rows, 1)

  const tall = blockDims({ x: 0, y: 0, w: 0.1, h: 0.6 }, 1000, 1000, 10)
  assert.equal(tall.cols, 10)
  assert.equal(tall.rows, 60)

  // degenerate regions must still produce a drawable grid, never 0 rows
  for (const region of [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0.0001, h: 0.5 },
    { x: 0, y: 0, w: 0.5, h: 0.0001 },
  ]) {
    const d = blockDims(region, 1200, 800, 12)
    assert.ok(d.cols >= 1 && d.rows >= 1, `region ${JSON.stringify(region)} -> ${JSON.stringify(d)}`)
  }
  assert.equal(blockDims({ x: 0, y: 0, w: 0.5, h: 0.5 }, 900, 900, 0).cols, 1, 'cols never drops below 1')
}
{
  // row-major block colours, one hex per block
  const px = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 255, 255,
  ])
  assert.deepEqual(averageBlocks(px, 2, 2), ['#ff0000', '#00ff00', '#0000ff', '#ffffff'])
  assert.equal(averageBlocks(px, 2, 2).length, 4)
}
{
  // Handles are a constant size ON SCREEN. Sized in canvas units they ballooned
  // with the canvas and swamped a one-line redaction strip.
  const imgW = 1200
  const imgH = 800
  const strip = { ...createAnno('redact', 'r'), w: 0.34, h: 0.06 }

  // where the region is roomy, the handle is exactly ANCHOR_SCREEN_PX on screen
  // whatever the stage scale
  const roomy = { ...createAnno('redact', 'r'), w: 0.6, h: 0.5 }
  for (const scale of [0.25, 0.5, 1, 2]) {
    near(anchorFor(roomy, imgW, imgH, scale) * scale, ANCHOR_SCREEN_PX)
  }

  // on a thin strip zoomed far out, the half-region cap takes over instead —
  // better a slightly small handle than one that hides the redaction
  const atQuarter = anchorFor(strip, imgW, imgH, 0.25)
  assert.ok(atQuarter * 0.25 < ANCHOR_SCREEN_PX, 'cap binds on a small region')
  near(anchorFor(strip, imgW, imgH, 0.5) * 0.5, ANCHOR_SCREEN_PX)

  // zooming in must make the handle cover proportionally less of the region
  const regionH = strip.h * imgH
  assert.ok(
    anchorFor(strip, imgW, imgH, 2) / regionH < anchorFor(strip, imgW, imgH, 0.25) / regionH,
    'zoom is a real remedy for handles crowding a small region',
  )

  // a tiny region is never buried under its own grips
  const tiny = { ...createAnno('redact', 'r'), w: 0.02, h: 0.02 }
  const shortest = Math.min(tiny.w * imgW, tiny.h * imgH)
  assert.ok(anchorFor(tiny, imgW, imgH, 0.25) <= shortest * 0.5 + 1e-9)

  // and a degenerate scale cannot divide by zero into infinity
  assert.ok(Number.isFinite(anchorFor(strip, imgW, imgH, 0)))
}
{
  // a redaction is clamped in image space and cannot be resized away to nothing
  const tiny = clampAnno({ ...createAnno('redact', 'r'), w: 0, h: 0 })
  assert.ok(tiny.w >= 0.02 && tiny.h >= 0.02)
  const off = clampAnno({ ...createAnno('redact', 'r'), x: 4, y: -3, w: 0.3, h: 0.1 })
  assert.ok(off.x <= 1 - 0.3 / 2 + 1e-9 && off.y >= -0.1 / 2 - 1e-9)
}

// --- section resets --------------------------------------------------------
{
  // each panel's reset must restore only its own slice
  let h: History = initialHistory
  h = reducer(h, { type: 'bg', patch: { mode: 'solid', grain: 0.9 } })
  h = reducer(h, { type: 'frame', patch: { chrome: 'settings', rotation: 9 } })
  h = reducer(h, { type: 'slot', pos: 'bottom', patch: { heading: 'keep me', on: true } })
  h = reducer(h, { type: 'out', patch: { format: 'jpg', scale: 3 } })
  h = reducer(h, { type: 'preset', id: 'ig-story' })
  h = reducer(h, { type: 'annoAdd', anno: createAnno('box', 'b1') })

  const afterBg = reducer(h, { type: 'resetSection', section: 'bg' })
  assert.equal(afterBg.present.bg.mode, initialState.bg.mode)
  assert.equal(afterBg.present.bg.grain, initialState.bg.grain)
  assert.equal(afterBg.present.frame.chrome, 'settings', 'window untouched')
  assert.equal(afterBg.present.text.bottom.heading, 'keep me', 'text untouched')
  assert.equal(afterBg.present.width, 1080, 'size untouched')
  assert.equal(afterBg.present.annos.length, 1, 'annotations untouched')

  const afterFrame = reducer(h, { type: 'resetSection', section: 'frame' })
  assert.equal(afterFrame.present.frame.chrome, initialState.frame.chrome)
  assert.equal(afterFrame.present.frame.rotation, 0)
  assert.equal(afterFrame.present.bg.mode, 'solid', 'background untouched')

  const afterText = reducer(h, { type: 'resetSection', section: 'text' })
  assert.equal(afterText.present.text.bottom.heading, '')
  assert.equal(afterText.present.frame.chrome, 'settings', 'window untouched')
  // must be a copy, or resetting once would let later edits mutate the defaults
  assert.notEqual(afterText.present.text, initialState.text)
  assert.notEqual(afterText.present.text.top, initialState.text.top)

  const afterOut = reducer(h, { type: 'resetSection', section: 'out' })
  assert.equal(afterOut.present.out.format, 'png')
  assert.equal(afterOut.present.out.scale, 2)
  assert.equal(afterOut.present.width, 1080, 'size untouched')

  const afterSize = reducer(h, { type: 'resetSection', section: 'size' })
  assert.equal(afterSize.present.width, 1600)
  assert.equal(afterSize.present.height, 900)
  assert.equal(afterSize.present.presetId, 'x-landscape')
  assert.equal(afterSize.present.out.format, 'jpg', 'export untouched')

  // every section reset is a single undoable step
  assert.equal(afterBg.past.length, h.past.length + 1)
  assert.equal(reducer(afterBg, { type: 'undo' }).present.bg.grain, 0.9)
}
{
  // resetting the defaults object must never leak a shared reference
  let a: History = initialHistory
  a = reducer(a, { type: 'resetSection', section: 'text' })
  a = reducer(a, { type: 'slot', pos: 'top', patch: { heading: 'mutated' } })
  assert.equal(initialState.text.top.heading, 'Ship it looking sharp', 'defaults intact')
}

console.log('ok — all checks passed')
