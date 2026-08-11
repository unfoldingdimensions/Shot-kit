<div align="center">

# Shotkit

**Drop a screenshot, wrap it in a clean window and a gradient, add text, export at the exact size Twitter, Instagram or Pinterest wants.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/unfoldingdimensions/Shot-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)

</div>

---

**Everything runs in your browser.** No account, no backend, no upload — your screenshot never
leaves your machine. That isn't a privacy policy bolted on afterwards; there is no server to send
it to.

## Features

**Any output size.** 13 social presets plus custom W×H and "fit to screenshot". The canvas *is* the
output resolution, so what you see is what you get. Every dimension in the composition is stored as
a fraction of the canvas, which means switching from 1600×900 to 1080×1920 re-lays-out the design
instead of stretching or cropping it.

| Group | Presets |
|---|---|
| X / Twitter | Feed 1600×900 · Portrait 1080×1350 |
| Instagram | Square 1080×1080 · Portrait 1080×1350 · Story 1080×1920 |
| Pinterest | Pin 1000×1500 |
| LinkedIn | 1200×627 |
| Facebook | 1200×630 |
| Web | OG card 1200×630 · YouTube thumb 1280×720 |
| Launch | Product Hunt 1270×760 · Dribbble 1600×1200 · App Store 6.7" 1290×2796 |
| Custom | Any W×H · Fit to screenshot |

**Backgrounds.** 24 curated gradients, custom stops and angle, solid colour, an uploaded image with
blur + dim, or fully transparent. Plus grain and vignette overlays — and **Auto**, which samples
your screenshot's own dominant colours and builds a gradient that belongs with it.

**Five window styles**, each with light/dark themes and macOS/Windows control styles:

- **Browser** — traffic lights and an editable URL pill
- **Code editor** — title bar plus a tab strip with your filename
- **Code file** — compact filename bar
- **Settings** — centred window title
- **Plain** — no chrome, just rounded corners and a shadow

**Text on all four sides.** Heading and subtext per side, each with its own font, size, weight,
italic, colour, alignment, letter-spacing and line height. Left and right text can rotate 90°.
Seven self-hosted fonts: Inter Tight, Inter, Space Grotesk, Bricolage Grotesque, Instrument Serif,
Playfair Display, JetBrains Mono.

**Frame controls.** Padding, corner radius, scale, rotation, skew, a glass-edge highlight, and
shadow presets (none / soft / deep / hard) with manual blur, offset and opacity.

**Export.** PNG or JPG with a quality slider, at 1×, 2× or 3×. Download or copy straight to the
clipboard.

**Workflow.** Drag and drop, paste from the clipboard (`Ctrl/Cmd+V`), undo/redo (`Ctrl/Cmd+Z`),
`Ctrl/Cmd+S` to export, and your styling is remembered between visits.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

```bash
npm run check
```

Runs the logic self-check — export-scale clamping, layout geometry, colour extraction, the state
reducer. No test framework; it's a plain Node script full of asserts.

## Deploy

Static output, no environment variables, no server. Click the Deploy button above, or:

```bash
npx vercel
```

## Tech stack

Next.js 15 (App Router, entirely client-side) · React 19 · Tailwind CSS v4 · Konva via react-konva ·
lucide-react.

No component library. The UI deliberately uses native `<input type="range">`, `<select>` and
`<input type="color">` styled directly — fewer dependencies than adopting a component kit and then
overriding its defaults.

## How it works

The editor is a single Konva `Stage` sized to the **output** resolution and visually scaled down to
fit the viewport. Three details in there are load-bearing, and worth knowing before you change them:

- **Export renders the stage at 1:1.** `exportImage` temporarily resets the stage to its output size
  and scale 1, then uses `pixelRatio` as the multiplier. Deriving a pixelRatio from the fitted stage
  instead lands 1–2px off, because the on-screen stage size is rounded to whole pixels and the fit
  factor is not.
- **Fonts are forced to load before drawing.** Konva measures text through the browser, so an
  unloaded face silently renders *and exports* as the fallback. `ensureFontsLoaded()` in
  `lib/fonts.ts` requests every face up front, and the shell keeps a hidden node per family so the
  browser actually fetches them.
- **Export scale is clamped, not trusted.** 1080×1920 at 3× is 18.7 megapixels, past iOS Safari's
  canvas ceiling — which fails by returning a *blank* image rather than throwing.
  `clampExportScale` steps the scale down and the UI says so.

Chrome dimensions all derive from a single ratio of the frame's own width, which is what keeps a
window looking identically proportioned whether the export is 1000px or 4000px wide.

```
app/                 layout + page (the app is one client-side page)
components/
  editor-shell.tsx   sidebar, panels, file intake, shortcuts, export
  ui.tsx             design system: cards, sliders, segmented controls, toggles
  panels/            one panel per sidebar section
  stage/             the Konva scene — background, frame, chrome, text slots
lib/
  geometry.ts        layout maths (pure, covered by npm run check)
  export.ts          scale clamping, filenames, clipboard
  measure.ts         text measurement, so the frame knows what room to give up
  presets.ts         output sizes
  gradients.ts       the gradient library
  colors.ts          dominant-colour extraction for Auto
  fonts.ts           font registry + the loader Konva needs
  raster.ts          background blur and the grain tile
  check.ts           the self-check
```

## Known limits

- **No 3D perspective tilt.** Konva does rotate, scale and skew, but not perspective transforms, so
  the dramatic "card floating in 3D space" look isn't reachable. Rotation and skew cover flat-lay
  and slight-tilt. A WebGL frame layer would be needed for the rest.
- **Text is edited in the sidebar**, not by clicking it on the canvas.
- **Bold and italic apply per text block**, not to a single word mid-sentence.
- **Background blur is a downscale**, not a gaussian, so only heavy blurs look right. Deliberate
  trade: it exports correctly at any scale, which a cached Konva filter does not.
- **Autosave stores styling, not images.** Screenshots would blow the localStorage quota, so you
  re-drop the image after a reload.

## Roadmap

Ranked roughly by payoff:

1. Redaction blur / pixelate region — hide emails, API keys, customer names
2. Batch export every selected preset in one click
3. Annotations: arrows, numbered step badges, highlight boxes, spotlight, pointer/cursor element
4. Named templates so a brand look is one click next time
5. Watermark / logo upload
6. Multi-image layouts — side by side, before/after, cascaded
7. Shareable URL state (compressed into the hash, still no server)
8. Syntax highlighting for the code-file window
9. Double-click to edit text on the canvas
10. WebGL 3D perspective tilt

Not planned: accounts, cloud storage, team libraries, AI features, video capture. Each needs a
backend and turns a tool into a product.

## Contributing

Issues and PRs welcome. Before opening a PR:

```bash
npm run check && npx tsc --noEmit && npm run build
```

Keep new dependencies to a minimum.

**Stop the dev server before running `npm run build`.** Both write to `.next`, so building while
`next dev` is running replaces the chunks the dev server is serving. The symptom is the page loading
as unstyled HTML with a 404 on `_next/static/css/app/layout.css`. Fix:

```bash
rm -rf .next && npm run dev
```

## License

[MIT](LICENSE)
