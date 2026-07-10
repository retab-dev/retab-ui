# Motion testing: gates, probes, and anomaly hunting

How the FileViewer motion system is tested, how to hunt for new anomalies,
and the probe rules that were each paid for with a wasted investigation
round. Start here before adding a motion test or debugging a motion report.

## The invariant

Every gate measures one thing from different angles: **the content under
the reader's eye must stay put** — through sidebar toggles, re-fits,
resizes, mode flips, and interruptions. Two failure axes:

- **Destination**: where the reading line lands after the motion settles.
- **Flight path**: where it travels in between (`corridor`), and how much
  of that travel is wasted round-tripping (`excursion = corridor − |net|`
  — the literal "back and forth" number).
- **Time**: how it moves through the frames. `pop` is the peak per-frame
  X velocity normalized by the motion plan's ideal peak (cubic ease-out
  peaks at 3·distance/duration): a clean flight scores ~1, a single-frame
  teleport ~3 — the jump `corridorX` cannot see, because a smooth 140px
  recenter and a 140px teleport trace the same corridor. `settleMs` is
  time-to-rest; it catches runaway or oscillating settles. Velocity uses
  measured frame time, so dropped frames don't read as pops.

A motion can be perfectly smooth and still wrong (it glides to the wrong
place), land perfectly and still wrong (it swings 300px on the way), or
do both perfectly and still wrong (it teleports there in one frame).
Gate all three, always.

## Gate inventory (all blocking in CI)

| Gate | What it catches |
| --- | --- |
| `verify:sources-viewer-toggle-matrix` | Reading-line trajectory + temporal (pop, settleMs) on the sources page: formats × viewports × scroll depths × {close, open, rapid, cycle} |
| `verify:benchmark-toggle-matrix` | Same trajectory + temporal scoring over the full format roster at real scroll ranges, plus resize sweeps |
| `verify:mode-state-matrix` | Overlay mode (document must not move at all), breakpoint-crossing resizes, explicit-zoom toggles, reduced-motion snaps |
| `verify:motion-conflict-and-leak` | Wheel-during-flight (binary contract: cleanly ignored or cleanly applied) and resource round trips (DOM/canvas census returns to baseline) |
| `verify:viewer-monkey-fuzz` | Seeded random interleavings incl. mid-flight format switches, under zero-console-error + bounded-resource + bounded-GC'd-heap invariants |
| `verify:robustness-matrix` | 4x CPU-throttled settles, cold-start toggles (before readiness), RTL trajectory |
| `verify:keyboard-focus-matrix` | Keyboard toggles fly the click trajectory, focus survives the toggle, PageDown-mid-flight binary contract |
| `verify:block-pages-toggle-matrix` | The application-block hosts (split, split-consensus, classify-consensus, extract): FileViewer inside product chrome, incl. the segment-page-rail second scroll consumer |
| `verify:sources-viewer-visual-blink` | Screencast pixel probes + reading-anchor destination + terminal deceleration on the sources page |
| `verify:file-viewer-visual-blink` | Screencast pixel gate on the benchmark page (whiteout, ink dip, post-motion churn) |
| `verify:file-viewer-sidebar-motion[:strict]` | The benchmark page's own 21-metric telemetry contracts |
| Motion baseline compare | Drift beyond tolerance vs `e2e/motion-baseline.json` — catches CREEP that static ceilings can't |

## Hunting modes (not in CI)

- `MATRIX_SURVEY=1` — any matrix prints every measurement without failing.
  **Always survey before setting a budget**; budgets come from data, never
  from guesses.
- `MATRIX_SCROLL_STEPS=12` — sweep N evenly spaced scroll depths instead of
  the four structural ones. Depth-specific bugs (the PDF page-boundary
  anchor miss lived at exactly one depth) hide between structural points.
- `MONKEY_SEED=$RANDOM [MONKEY_ACTIONS=160]` — random fuzzing; every run
  prints its seed and action log, so any find replays exactly.
- `MATRIX_DPR=1|3` — re-run the benchmark matrix at a different device
  pixel ratio; raster scaling and half-pixel rounding are dpr-sensitive
  and every default run is dpr2.
- `MATRIX_ZOOM=N` — click "Zoom in" N times before the cells; explicit
  zoom leaves the fit-width resolver for the zoom code path and
  multiplies scrollHeight. The "zoomed-pdf cycle excess" (pop ~2.0) this
  lane first reported was misattributed twice over: the zoom clicks were
  silently no-ops (two "Zoom in" buttons — header + document overlay —
  and the strict-mode violation was swallowed by an isVisible catch), and
  the pop was the kernel's click-anchored clock landing every toggle
  leg's first paint ~16ms deep into the ease after the slide-start
  commit. Only cycles scored it because only their sampling straddles the
  click. Fixed by anchoring the motion clock to the first tick's rAF
  frame time (rule 11, writer side). A genuinely zoomed PDF does not move
  on sidebar toggles at all — fixed scale, no rebase, so its cells
  legitimately read 0.0 everywhere.
- `--project=webkit` / `--project=firefox` — the trajectory matrices are
  engine-portable (18/18 clean on all three engines as of 2026-07-10); the
  scrollable-overflow-includes-transforms bug was engine behavior, so
  sweep engines when touching scroll/compositing code.
- `.github/workflows/nightly-motion-hunt.yml` runs the random-seed monkey,
  the dense scroll sweep, the WebKit and Firefox matrices, and the
  baseline compare every night.

## The probe rulebook

Each rule below was violated once and cost a full investigation round.
They are encoded in `e2e/helpers/reading-line-trace.ts`; keep them true.

1. **Track the element under the reading line, never a virtualization
   wrapper.** Window churn (pages mounting/unmounting) reads as content
   drift. Pick the page/frame/slide containing the marker; re-resolve it
   by identity key (`data-page`/`data-frame`/`data-slide`, plus
   `data-source-line` for text lines and `aria-rowindex` for grid rows)
   across keyed remounts; a detached node's zero-rect at the origin reads
   as a phantom full-viewport excursion. Recycled-pool renderers (text
   lines, csv/xlsx rows) reassign a node while it stays CONNECTED — check
   the identity attribute every sample, not just connectedness.
2. **Probe the line the format actually pins.** Image and the
   fraction-rebase formats pin the viewport top; DOCX and PDF pin the
   reading marker 20% down. At scroll 0 every format pins the top (the
   clamp permits nothing else). Probing any other line reads the inherent
   `(s−1)·d` scale divergence as a bug — this false alarm has been
   produced twice, once against reduced-motion and once against DOCX.
3. **Reproduce at overflowing geometry with non-zero scroll.** At scroll
   0 most rebase bugs multiply out to exactly zero; a document that fits
   its viewport exercises none of the hard paths. The 545px camera
   teleport shipped unseen because every fixture ran in the degenerate
   case.
4. **Validate the instrument before believing its reading.** A control
   run (does the wheel scroll at rest? does the tracker survive a plain
   resize?) precedes any conflict verdict. A −1592px "corruption" once
   evaporated under its control.
5. **A start-aligned pane's X-observable is its left edge; a centered
   document's is its center.** A start-aligned container's center
   displaces with the pane width by construction — not a defect.
6. **"Scrollerless" is a verdict, not an observation.** Both causes of a
   missing scroller turned out to be probe blindness, and each silently
   degenerated every text/csv/xlsx depth cell to scroll=zero for the
   suite's whole life: the grids host a perfectly native overflow-auto
   viewport inside their style-isolation shadow root, NESTED INSIDE the
   tracked window element (invisible to light-DOM queries and to
   `Node.contains`, which does not cross shadow boundaries — pierce
   shadow roots and check composed containment in both directions); and
   the old 5-line text sample simply fit its pane, leaving nothing to
   scroll (rule 3's degenerate case baked into the fixture). A pane that
   truly has no scroller keeps its own initial screen top as the
   reference — and a matrix depth cell that cannot scroll must FAIL, not
   `continue` (the benchmark matrix now does).
7. **Zero samples must throw, never pass.** A tracker that resolves
   nothing scores a perfect run otherwise.
8. **Pixel metrics are noisy; DOM metrics are deterministic.** Calibrate
   pixel budgets against reference-run noise across multiple runs (the
   PDF reference itself varies ±0.4 on ink-oscillation); prefer a
   deterministic DOM encoding of the same defect when one exists (the
   terminal-deceleration gate vs the shimmer scorer).
9. **A fixed-delay snapshot is a phase lottery.** When a probe means to
   read a SETTLED position, read to convergence (consecutive samples
   within a pixel), not after a fixed wait — on a loaded runner the wait
   lands mid-flight and a pptx re-fit once read 605px before settling to
   exactly 0.0. In-flight corridors are different: those are sampled
   every frame by design.
10. **A rAF-indexed flight probe starves with the main thread; sample on
    a time axis.** The motion clock is time, so a synchronous stall at
    motion start (the close toggle rasters the image at its new committed
    scale) collapses the whole flight into one sample gap — a fully eased
    slide once read as "motion never moved the frame" on CI (settleIndex
    2 of 40 samples; ~180ms first gap at 4x throttle). Timestamp every
    sample, score velocity per frame-length rather than raw per-sample
    steps, and treat a flight that collapsed into a starved gap as
    unobservable (retry the toggle) — but a collapse inside a
    frame-length gap is a real teleport and must stay scoreable, since
    a time-based motion cannot finish inside one 16ms frame.
    Repro: `FAR_EDGE_CPU_THROTTLE=4` on the far-edge gate.
11. **Stamp samples with the rAF frame timestamp, never the callback's
    execution time.** Under jank a late callback and its on-time
    successor run 6ms apart while their displacement spans a full 16ms
    frame — execution-time stamping inflated a clean keyboard toggle's
    pop score to 9.95 (a 2.7x phantom velocity). The rAF callback's
    argument is the vsync-aligned time the paint belongs to; velocity
    must divide by that axis. (Click-driven traces hid this: their
    activation jank happens before sampling starts.)
12. **Never calibrate on a mutating tree.** Concurrent sessions editing
    viewer code HMR-remount components mid-trace — one produced a
    phantom pop of 8.27 on a flight that scored 1.0 on a quiet tree —
    and a baseline regenerated against uncommitted WIP breaks the drift
    gate for everyone at HEAD. Before surveying or regenerating: `git
    status` clean on viewer files, or wait. Budgets come from CI
    hardware besides (see the baseline section) — a local survey only
    ever scouts.
13. **Verify the instrument's GEOMETRY before declaring a product bug.**
    Three "serious product bugs" in one week were instrument-adjacent:
    a touch gesture aimed at coordinates captured BEFORE the toggles
    moved the pane ("touch permanently dead"); a zoom lever that was a
    silent no-op (two "Zoom in" buttons — the strict-mode throw was
    swallowed by an `isVisible().catch()` — so the sweep surveyed an
    unzoomed world); and a scroller hidden in a shadow root (rule 6).
    Before filing: re-derive the probe's coordinates/locators/containment
    at the moment of the failing action, make every lever prove it
    engaged (the zoom sweep now throws "lever did not engage"), and
    treat a swallowed error as a finding in itself. Rule 4 checks that
    the instrument reads; this rule checks that it points.

## Changing motion behavior intentionally

Any change to how motion feels moves baseline numbers. The baseline is
**CI-sourced**: it must come from a green CI run's `motion-metrics`
artifact, never from a local run — local-Mac numbers carry a hardware
signature (settleMs ~2x slower on runners, corridors and pops uniformly
smaller) that once drifted 90 metrics at zero code change. After your
motion change merges and its matrices pass:

```
gh run download <green-run-id> --name motion-metrics --dir /tmp/mm
node scripts/compare-motion-baseline.mjs /tmp/mm/motion-metrics.jsonl --update
```

Commit the regenerated baseline referencing the run id. The baseline diff
is the reviewable record of what your change did to every trajectory. (A
local `MOTION_METRICS_PATH` run is still the right tool for SURVEYING a
change before it ships — just never `--update` from it.)

## Adding a format or a page

Give the format an entry in the relevant matrix `FORMATS` list: a `ready`
selector, a `frameSelector` (inside the scroller), a `trackSelector` (the
page/frame/slide element, per rule 1), its pinned `markerRatio` (rule 2),
and its `align`. Survey first; budget from the survey; then gate.
