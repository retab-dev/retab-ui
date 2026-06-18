# Markdown Viewer Performance Blueprint

## Purpose

Make the greenfield Markdown Viewer faster without changing its product model.

The viewer is already architecturally pointed in the right direction:

- one continuous rendered Markdown surface
- internal virtual chunks
- bounded mounted DOM
- hostile-block fallbacks for oversized code, tables, and raw HTML
- progressive code highlighting
- lazy image/media loading
- source-line and fragment navigation

The remaining performance problem is not that too much DOM is mounted. It is
that too much full-document and React-driven work still happens on first open,
measurement correction, and scroll.

This blueprint covers the current `/view/markdown-viewer` route and the
registry `MarkdownViewer`, not the older paged `PageMarkdownViewer` except where
it offers a useful projection pattern.

## Current State

Primary files:

| Responsibility                                     | File                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| Public viewer wrapper                              | `registry/new-york-v4/ui/markdown-viewer.tsx`                    |
| Viewer orchestration, virtual canvas, measurements | `registry/new-york-v4/ui/markdown-greenfield-content.tsx`        |
| Unified/remark/rehype parse pipeline               | `registry/new-york-v4/ui/markdown-unified-pipeline.ts`           |
| Document model, chunking, source metadata          | `registry/new-york-v4/ui/markdown-greenfield-document.ts`        |
| Estimated and measured chunk layout                | `registry/new-york-v4/ui/markdown-greenfield-layout.ts`          |
| Visible-window and anchor math                     | `registry/new-york-v4/ui/markdown-greenfield-virtualizer.ts`     |
| HAST-to-React renderer                             | `registry/new-york-v4/ui/markdown-greenfield-renderer.tsx`       |
| Async code highlighting                            | `registry/new-york-v4/ui/markdown-greenfield-code-highlight.tsx` |
| Async Mermaid rendering                            | `registry/new-york-v4/ui/markdown-greenfield-diagram.tsx`        |

Existing guarantees:

- `MarkdownViewer` routes through `MarkdownGreenfieldContent`.
- Long documents mount a bounded chunk window.
- Hostile blocks render as virtualized source previews.
- Shiki renders fallback tokens first, then upgrades asynchronously.
- Mermaid imports lazily and keeps failures contained.
- Focused performance tests currently pass:
  `tests/markdown-greenfield-performance.test.tsx`,
  `tests/markdown-greenfield-virtualizer.test.ts`,
  `tests/markdown-text-viewer-contract.test.tsx`.

## Performance Diagnosis

### 1. Initial Open Still Does Full Synchronous Document Work

`MarkdownGreenfieldContent` calls `createMarkdownGreenfieldDocument(text)` during
render. That call runs the full unified pipeline, normalizes headings, tables,
source metadata, chunks, fragment targets, hostile flags, freezes the HAST tree,
and computes word count before the first meaningful paint.

The render window is virtualized. The document build is not.

### 2. The Unified Pipeline Is Rebuilt Per Document

`createMarkdownUnifiedDocument` constructs both processor chains and the sanitize
schema for each document. The plugins are static. The schema is static. Only the
input text changes.

### 3. Measurement Updates Recompute Whole-Document Layout

Each chunk measurement writes to React state. Each measurement state change
causes layout to scan every chunk, read measured heights, rebuild frame arrays,
and serialize every chunk measurement into the layout cache key.

This is correct but too coarse. A single chunk height change should not force
more work than a prefix-height correction and visible-window recalculation.

### 4. Scrolling Updates React State Per Scroll Event

The scroll handler writes `scrollTop` into React state on every native scroll
event. That makes visible-window selection correct, but it puts React in the hot
path. Other viewers in this repo are moving toward passive scroll listeners,
RAF scheduling, math-driven projection, and small DOM caches.

### 5. Native Find Index Is Full-Document DOM

The hidden native find bridge renders one hidden entry per chunk and computes
searchable text from the HAST tree during render. This preserves browser find
for virtualized content, but it should not compete with first paint.

### 6. Mounted Rich Chunks Rebuild HAST-to-JSX Work

Each mounted non-hostile chunk clones HAST and runs `toJsxRuntime`. Zoom changes
only CSS scale, but the current component can still remount or rerender enough
that rich chunk conversion becomes visible in profiles.

### 7. Shiki And Mermaid Caches Are Too Broad Or Too Local

Shiki uses one global subscriber set, so resolving one code block notifies every
mounted subscriber. Mermaid stores results per component instance, so the same
diagram source can rerender after unmount/remount.

## Target Architecture

Keep the same user-facing viewer. Change the ownership of expensive work:

| Work                        | Current Owner           | Target Owner                                      |
| --------------------------- | ----------------------- | ------------------------------------------------- |
| Full parse/model build      | React render            | Worker or external async model store              |
| Initial skeleton geometry   | Full parsed HAST        | Fast line/chunk skeleton                          |
| Scroll position             | React state             | DOM ref + RAF projector                           |
| Visible chunk projection    | React render on scroll  | Small projected window store                      |
| Measured height propagation | Per-measure React state | RAF-batched measurement store                     |
| Rich chunk JSX              | Per mount render        | Chunk render cache keyed by document/chunk/search |
| Browser find bridge         | Immediate full DOM      | Idle-built hidden index                           |
| Shiki notify                | Global fan-out          | Cache-key subscribers                             |
| Mermaid result              | Per instance            | Module-level source cache                         |

## Phase 1: Add A Real Timing Harness

Do this first. Without budgets, performance work will regress.

Create `scripts/verify-markdown-viewer-performance.mjs` or extend
`scripts/verify-markdown-viewer.mjs` with opt-in timing mode.

Measure:

- time from navigation start to viewer shell mounted
- time to first rendered chunk
- time to first idle after initial measurements settle
- number of React commits during a deterministic long scroll
- max mounted chunks
- max mounted code lines inside hostile blocks
- long tasks during initial open and scroll
- time from code block mount to Shiki upgrade
- time from Mermaid block mount to ready/error state

Fixtures:

- prose-heavy long report
- code-heavy report with many small code fences
- diagram-heavy report
- table-heavy report below hostile threshold
- hostile code/table/raw HTML report
- media-heavy report with explicit dimensions

Budgets should start observational. Commit the measured baseline first, then
tighten only after the later phases land.

Acceptance:

- CI can run the timing harness locally with an existing dev server.
- The harness does not start, kill, or restart dev servers.
- The harness outputs machine-readable JSON in an ignored artifact directory.
- Existing correctness verifier remains separate and unchanged by default.

## Phase 2: Hoist Static Pipeline State

Make the parse pipeline cheaper before changing its execution model.

Work:

- Hoist the mdast processor into a lazy module singleton.
- Hoist the hast processor into a lazy module singleton.
- Hoist `createMarkdownUnifiedSanitizeSchema()` into a frozen singleton.
- Keep plugin order identical.
- Keep all tests that assert plugin coverage and markdown architecture.

Rules:

- Do not share mutable per-document state through processors.
- `VFile` remains per document.
- Any processor singleton must be treated as immutable after construction.

Acceptance:

- `createMarkdownUnifiedDocument` no longer allocates plugin chains per call.
- Markdown rendering output is byte-for-byte equivalent in focused tests.
- The performance harness shows lower parse/model time for repeated documents.

## Phase 3: Move Document Build Out Of React Render

Stop blocking React render on the full model.

Target:

- Introduce a small external document model store.
- `MarkdownGreenfieldContent` subscribes with `useSyncExternalStore`.
- The initial render shows the normal viewer shell plus a lightweight loading
  surface sized from a fast text scan.
- The full document model is computed asynchronously.

Preferred implementation:

- Use a Web Worker for `createMarkdownGreenfieldDocument`.
- Keep a main-thread fallback only for environments without Worker support.
- The fallback still runs after first paint, not during render.

Worker payload:

- input text
- bounds identity
- document cache key

Worker result:

- serializable document model needed for layout/render
- source map metadata
- chunks and HAST
- headings and fragment targets
- word count

Important constraint:

The current HAST tree is frozen and contains rich object graphs. If structured
clone cost is too high, split the model:

- main thread builds a fast chunk skeleton immediately
- worker builds rich HAST per chunk or in batches
- visible chunks request rich HAST first

Acceptance:

- Opening a large Markdown file paints viewer chrome before full parse finishes.
- A slow parse cannot block toolbar paint or skeleton paint.
- Retry and source changes cancel stale worker results.
- URL/blob/inline text sources keep existing error behavior.

## Phase 4: Split Fast Skeleton From Rich HAST

Full Markdown semantics are not needed to reserve scroll geometry.

Add a fast pre-parse pass that scans raw text into coarse chunks:

- source start/end line
- source start/end offset
- estimated kind when obvious: heading, code fence, table, image, paragraph
- hostile candidates from raw source length, code line count, table row/cell
  estimate, and raw HTML depth estimate
- estimated height

Then hydrate rich HAST only for chunks that are visible, near-visible, searched,
or targeted by a fragment/source-line jump.

Rules:

- The fast skeleton is allowed to be approximate.
- The rich model is the authority once ready.
- Scroll anchors must survive skeleton-to-rich replacement.
- Fragment navigation waits for the rich target map when needed.

Acceptance:

- Large prose documents can scroll against skeleton geometry before full rich
  model completion.
- Visible chunks upgrade in place.
- Hostile chunks can render bounded source previews without waiting for HAST.
- No visible page or chunk boundary appears during upgrade.

## Phase 5: Remove React From The Scroll Hot Path

Replace `setScrollTop` per scroll event with a passive scroll listener plus one
RAF scheduler.

Target model:

- `viewportRef.current.scrollTop` is the live source of truth.
- Scroll event only stores the latest top in a ref and schedules projection.
- Projection computes visible chunk frames from layout math.
- React state updates only when the visible frame set actually changes.
- If practical, use an imperative projected slot cache similar to
  `PageMarkdownPane`, but keep semantic chunk rendering in React roots.

Minimum acceptable implementation:

- rAF-throttle `setScrollTop`.
- Avoid more than one React update per animation frame.
- Avoid updates when visible frame IDs are unchanged.

Stronger implementation:

- `MarkdownGreenfieldContent` owns a canvas and projected chunk slots.
- Each slot hosts a React root for one chunk.
- Scroll projection appends/removes/repositions slots imperatively.
- Chunk roots render only when chunk render key changes.

Acceptance:

- Deterministic long scroll produces bounded React commits.
- Fast wheel/trackpad scroll does not enqueue unbounded state updates.
- Source-line scrolling and fragment navigation still work for unmounted chunks.
- Selection, copy, image loading, code copy, table copy, and heading anchors
  remain correct.

## Phase 6: Batch Measurements And Simplify Layout Invalidations

Make measurements a frame-level input, not one React state update per observer
callback.

Work:

- Collect `ResizeObserver` height changes in a mutable pending map.
- Flush them once per animation frame.
- Ignore sub-pixel and below-threshold deltas before invalidating layout.
- Store measurements by chunk id under a document/width/font-scale policy key.
- Replace the layout cache key that serializes every chunk with a compact
  revision id or per-chunk measured revision.

Layout model target:

- estimated height per chunk cached once per width/font scale
- measured height map
- prefix height deltas for measured chunks
- binary search over frame starts/bottoms
- no all-chunk string serialization on every measurement

Acceptance:

- A page of visible chunks settling causes one layout update, not N.
- Async image/Mermaid/Shiki height changes above the viewport preserve the
  reader's visual anchor.
- Layout correctness tests cover shrink and grow corrections.
- Existing hostile-block tests still pass.

## Phase 7: Defer Native Find Index

Keep browser find support, but move it after first paint.

Work:

- Precompute each chunk's native find text during document build.
- Render `NativeFindIndex` after initial visible chunks render.
- Prefer `requestIdleCallback`; fall back to delayed `setTimeout`.
- For very large documents, build the hidden index in batches.
- Keep `beforematch` handling and source-line scroll behavior.

Acceptance:

- First rendered chunk is not delayed by hidden find DOM.
- Browser find still reaches offscreen virtualized content.
- Direct hash navigation and footnote backrefs still work.

## Phase 8: Cache Rich Chunk Rendering

Avoid repeated HAST-to-JSX conversion for stable chunks.

Work:

- Add a `chunkRenderKey`: document id, chunk id, search query, active match,
  renderer policy version.
- Memoize the cloned HAST and JSX result per key with an LRU.
- Do not include `fontScale` in the key; zoom is CSS on the wrapper.
- Do include search state when highlights are active.
- Keep rich child components stateful only where needed.

Risk:

Caching React nodes with interactive children can preserve stale callbacks if
the callback is captured inside the cached tree. Prefer caching normalized HAST
or the `toJsxRuntime` result only when callbacks are stable and source-derived.

Acceptance:

- Zoom does not rebuild chunk HAST/JSX.
- Scrolling away and back to the same chunk reuses render work.
- Heading anchors, copy buttons, tabs, tables, code blocks, images, and diagrams
  keep correct behavior.

## Phase 9: Scope Shiki And Mermaid Caches

Shiki:

- Replace the global subscriber set with subscriber sets by cache key.
- Notify only components subscribed to the resolved code block.
- Optionally prewarm Shiki for visible code blocks after initial paint.
- Keep fallback tokenization synchronous and cheap.

Mermaid:

- Add module-level cache keyed by sanitized source plus config version.
- Deduplicate concurrent renders for identical sources.
- Reuse successful SVG and known failures across unmount/remount.
- Keep per-instance ids safe by rewriting generated ids when injecting cached
  SVG if necessary.

Acceptance:

- Resolving one code block does not rerender unrelated mounted code blocks.
- Reentering a diagram chunk does not rerun Mermaid for identical source.
- Diagram SVG remains sanitized and id-safe.

## Phase 10: Bring PageMarkdown Into Alignment Or Delete Its Duplication

The paged viewer still uses `react-markdown` per visible page. If it remains
part of the product, it should not keep a separate markdown rendering stack.

Decision needed:

- If `PageMarkdownViewer` is only parse-result UI, keep it but reuse the
  greenfield pipeline/render policy.
- If it is obsolete, plan its removal and migrate parse viewer call sites.

Acceptance:

- There is one Markdown policy and renderer stack.
- No user-visible markdown surface silently diverges on GFM, HTML, math, code,
  images, links, or hostile blocks.

## Verification Plan

Run after each phase:

```bash
pnpm exec vitest run tests/markdown-greenfield-performance.test.tsx tests/markdown-greenfield-virtualizer.test.ts tests/markdown-text-viewer-contract.test.tsx
```

Run before merging:

```bash
pnpm exec vitest run tests/markdown-architecture.test.ts tests/markdown-greenfield*.test.ts tests/markdown-viewer.test.tsx tests/file-viewer.test.tsx
```

Browser verification requires an already-running dev server:

```bash
pnpm run verify:markdown-viewer
```

Do not start or restart a dev server from the verification script. The repository
instruction is explicit: ask the user to start it if needed.

## Done State

The work is complete when:

- initial open paints shell and first chunk before full rich document work
  completes on large inputs
- scroll does not produce a React update per scroll event
- measurements settle in batched updates
- mounted DOM remains bounded
- native find still reaches offscreen chunks
- code and diagram async upgrades do not fan out unnecessary rerenders
- all current markdown correctness, architecture, and performance-boundary tests
  pass
- the timing harness has committed budgets for the main fixtures
