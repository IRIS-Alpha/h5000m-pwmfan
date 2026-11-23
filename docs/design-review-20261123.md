# Web Interface Guidelines review — 2026-11-23

Scope: the two LuCI views and their stylesheet, reviewed against
`.agents/skills/web-design-guidelines/references/command.md` as `AGENTS.md` requires before a UI
task is closed.

- `htdocs/luci-static/resources/view/h5000m-pwmfan.js`
- `htdocs/luci-static/resources/view/h5000m-pwmfan-advanced.js`
- `htdocs/luci-static/resources/view/h5000m-pwmfan-shared.js`
- `htdocs/luci-static/resources/view/h5000m-pwmfan.css`

Method: read the rules, grep each rule across the four files, then measure the live preview
(`http://127.0.0.1:8028/.../dashboard` and `/advanced`, 390 px, light and dark) for the findings
that a grep cannot settle.

## Fixed

| # | File:line | Finding | Rule | Fix and evidence |
| - | --------- | ------- | ---- | ---------------- |
| 1 | `htdocs/luci-static/resources/view/h5000m-pwmfan.js:743` | The chart canvas carried `role="img"` and `aria-label` but no `tabindex`, while `:813` binds a `keydown` handler (Escape clears the read cursor, ←/→ move it). A canvas is not focusable by default, so that handler was unreachable — dead code for every keyboard user. | Keyboard access; interactive elements must be reachable | Added `tabindex: '0'`. Measured: `:focus-visible` draws the 2 px outline, `ArrowRight` moves the cursor (painted pixels 63387 → 63542), `ArrowLeft` moves it back (63488), `Escape` clears it (63386). |
| 2 | `htdocs/luci-static/resources/view/h5000m-pwmfan.css:215` | The five preset buttons (`.pf-page button.pf-mode`) had no hover state; only the pressed mode changed colour, so a pointer gave no feedback before the click. | Provide hover feedback on interactive elements | Added `.pf-page button.pf-mode:hover { border-color: var(--pf-muted); background: var(--pf-subtle); }` (`:216`). Measured on hover: border `rgb(214, 218, 222)` → `rgb(74, 81, 90)`. |
| 3 | `htdocs/luci-static/resources/view/h5000m-pwmfan.css:40` | `touch-action: manipulation` was set on the theme switchers (`.pf-switch`, `:29`) and the stepper buttons (`.pf-step`, `:79`) but not on the rest of the page's controls, so taps on the preset buttons and card summaries waited for the double-tap window. | Set `touch-action: manipulation` | Added it to the shared control rule. Measured: computed `touch-action` is `manipulation` on both a preset button and a card summary. |
| 4 | `htdocs/luci-static/resources/view/h5000m-pwmfan.css:53` | Card headings had no wrapping hint; a two-line heading could leave a single word on the second line. | Balance heading wrapping | Added `text-wrap: balance` to `.pf-card h3, .pf-card > summary`. Measured: computed `text-wrap` is `balance` on both. |

## Checked and no change needed

| File:line | Rule | Evidence |
| --------- | ---- | -------- |
| `.css:29, 70, 96, 115, 119, 121` | No `transition: all` | Every transition lists its properties. |
| `.css:51, 296-298` | Honour reduced motion | `prefers-reduced-motion` turns off the live-dot pulse, the beam, the chip pulse and the transition set. |
| `.css:42` | Visible focus | `:is(input, select, button, summary, canvas):focus-visible` draws a 2 px outline with 2 px offset. |
| `.css:40` | Tap highlight | `-webkit-tap-highlight-color: transparent` on the shared control rule. |
| `.css:76, 112, 238, 257` | Tabular figures for numbers | `font-variant-numeric: tabular-nums` on the duty readout, the odometer bubble, legend values and curve points. |
| `.css:234-236` | Truncate long labels instead of overflowing | `.pf-legend > span` has `min-width: 0`; `.pf-legend-label` has `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`. |
| `h5000m-pwmfan-shared.js:77, 88-89` | Icon-only buttons need a name | Both header switchers get `aria-label` and a matching `title`. |
| `h5000m-pwmfan.js:268, 489, 535, 605` | Announce state changes | The save bar, the warning row and both note slots are `role="status"` / `aria-live="polite"`. |
| `h5000m-pwmfan.js:320, 355` | Selection state | Preset and method buttons carry `aria-pressed`. |
| `h5000m-pwmfan.js:432, 434, 747` | Hide decoration from assistive tech | The odometer bubble, the slider thumb and the six touch points are `aria-hidden`. |
| `h5000m-pwmfan.js:1092-1094` | Do not lose staged input | `pagehide` and `visibilitychange` flush the merged save queue. |
| `h5000m-pwmfan.js:752` | Empty state | `Waiting for samples…` sits inside the plot until the first sample arrives. |
| `h5000m-pwmfan-advanced.js:116-117` | Native controls keep a legible scheme | The advanced page leaves the `<select>` colours to the theme, which is what `/admin/system/system` does. Measured: light `rgb(20, 23, 26)` on `rgb(255, 255, 255)`, dark `rgb(232, 234, 237)` on `rgb(27, 29, 33)`, height 36 px — same as the reference page. An earlier draft of this review called this missing; it is theme-owned, and overriding it would replace the theme's arrow. |

## Known limitation (needs a decision)

Curve editing is pointer-only. The six `.pf-touch-point` handles (`.css:293`, 28 px, `aria-hidden`)
are draggable and commit through the same pending queue as the sliders, but no keyboard path
changes a point value: the canvas key handler only moves the read cursor. A keyboard editor would
need a focusable per-point control (six extra tab stops, or a point list beside the chart) and a
decision on how a point move is announced. It is recorded in `docs/TASKS.md` under
"Awaiting decision" rather than guessed at.

The 28 px handle is also below the 44 px tap-target guidance, but the six handles sit close together
along the curve; enlarging the hit areas would make neighbouring points overlap, so the size is
deliberate.

## Test-harness note

`tests/preview.mjs` takes the dashboard page as `PWMFAN_PREVIEW_URL` and derives the advanced page
from it. Its default used to be the bare preview root, which 404s, so a run without the variable
timed out waiting for `.pf-page`. The default and the README now point at the dashboard page.
