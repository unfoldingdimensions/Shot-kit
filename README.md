<div align="center">

# Shotkit

**Drop a screenshot, wrap it in a clean window and a gradient, add text, export at the exact size Twitter, Instagram or Pinterest wants.**

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

**Annotations.** Six kinds, all draggable on the canvas:

- **Pointer** — a cursor glyph for "click here"
- **Arrow** — drag the body to move it, or either end point to re-aim it
- **Step** — auto-numbered badges that fill the first free number, so deleting #2 of 3 never
  produces a duplicate
- **Box** and **Ellipse** — outline or filled highlight
- **Spotlight** — dims the whole canvas except one region
- **Redact** — pixelate, blur or solid-fill a region to hide emails, API keys and customer names

Box, ellipse, spotlight and redact get resize handles; box and ellipse also rotate. Select with a
click, `Escape` to deselect, `Delete` to remove. Selection outlines and handles are hidden at export time, so they can
never end up in the bitmap. Annotation positions are stored as fractions of the canvas, so they
stay put when you switch output size.

**Export.** PNG or JPG with a quality slider, at 1×, 2× or 3×. Download or copy straight to the
clipboard.

**Zoom and pan.** Zoom with the controls bottom-right or `Ctrl`/`⌘` + scroll; once the canvas is
bigger than its viewport, drag any empty part of it to pan. Zoom is a view setting only — export
always renders at 1:1, so the exported pixels never change. "Fit to window" resets it.

**Moving annotations.** Drag the annotation itself. No modifier key: click and drag an arrow, badge,
box or redaction to move it, drag a handle to resize, or drag either end of an arrow to re-aim it.
The cursor changes to indicate what is grabbable.

**Resets.** Every panel has its own reset that restores just that section, plus a two-step
**Reset all** in the header for everything at once (your screenshot is kept). Annotations have
their own *Clear all*.

**Workflow.** Drag and drop, paste from the clipboard (`Ctrl/Cmd+V`), undo/redo (`Ctrl/Cmd+Z`),
`Ctrl/Cmd+S` to export. Your styling, annotations **and screenshot** are all remembered between
visits — styling in localStorage, the image in IndexedDB, because a screenshot is megabytes and
would blow localStorage's ~5MB quota. A whole drag or resize collapses into exactly one undo step.

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

### Desktop & Standalone Usage

- **Windows Batch Launcher**: Double-click `shotkit.bat` to launch Shotkit in a standalone, dedicated window (Edge App Mode).
- **Run in Desktop App Window**: `npm run app`
- **Run Electron in Dev**: `npm run electron:dev`
- **Build Standalone `.exe`**: `npm run electron:build` (generates portable `.exe` and NSIS installer in `dist-electron/`).


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

**Redaction is drawn as vector blocks, not a pixelated bitmap.** It lives inside the frame group,
so it inherits the window's rotation and its coordinates map straight onto source-image pixels.
Each block is a solid `Rect` filled with that block's average colour, which means the redaction
stays exactly as coarse at 3x as at 1x — pre-rendering a pixelated bitmap and letting the export
resample it would smooth the blocks back into gradients and partially undo the redaction. Measured:
a region containing sharp monospace text drops from a detail score of 42 to 1, and holds 33 distinct
colours at 3x versus 35 at 1x despite nine times the pixels.

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


## Contributing

Issues and PRs welcome. Before opening a PR:

```bash
npm run verify
```

That runs the self-check, `tsc --noEmit`, and a production build — and is safe to run with the dev
server up. It builds into its own directory, because `next build` and `next dev` both write to
`.next`, and building over a running dev server leaves the page serving unstyled HTML with a 404 on
`_next/static/css/app/layout.css`. It also restores `tsconfig.json`, which Next rewrites to point at
whichever `distDir` it built into.

If you do clobber a dev server, `rm -rf .next && npm run dev` puts it back.

There is no ESLint. Types plus the self-check are the gate; keep new dependencies to a minimum.

## License

[MIT](LICENSE)
