# DOCX Viewer Performance Blueprint

## Ideal

The DOCX viewer should preserve the current high-fidelity `docx-preview` output
while making expensive work proportional to what the user actually needs.

The target is a sharper pipeline, not a different renderer:

- bytes and renderer code load in parallel;
- first document paint does not wait on source-link indexing;
- DOM commit avoids forced live layout;
- scrolling uses page geometry instead of querying every page;
- source navigation builds exactly the index it needs, when it needs it;
- large documents stay responsive even when full fidelity render remains
  browser-bound.

## Implementation Status

Phases 1-6 are implemented in this change. Phase 7 remains an investigation
track because progressive DOCX rendering changes the rendering contract and
should only be attempted with larger fixtures and stronger UX acceptance tests.

Post-change profiling against the same local scrollbench route showed:

- DOCX bytes and the `docx-preview` chunk now start together;
- scroll tracking performs zero DOCX page rect reads;
- the 25-page fixture remains at about 120 FPS for small and large jumps, with
  no frames over 16ms in the sampled run.

## Current Shape

Relevant files:

- `registry/new-york-v4/ui/docx-viewer.tsx`
- `registry/new-york-v4/ui/docx-viewer-content.tsx`
- `registry/new-york-v4/ui/docx-viewer-render.ts`
- `registry/new-york-v4/ui/docx-viewer-targets.ts`
- `registry/new-york-v4/ui/docx-viewer-scroll.ts`
- `registry/new-york-v4/ui/docx-viewer-scale.ts`
- `registry/new-york-v4/lib/docx-document-resource.ts`
- `components/file-thumbnail/renderers/docx-thumbnail.tsx`
- `app/(view)/scrollbench/scrollbench-client.tsx`

What is already right:

- DOCX bytes are deduped by `getDocxDocumentResource`.
- `docx-preview` is lazy imported and import failures can retry.
- Render happens in a detached host before commit.
- Pages get `content-visibility: auto`.
- Zoom is CSS-only through `zoom`, so zoom does not rerender the document.
- Scroll callbacks are RAF-coalesced.
- The current 25-page scrollbench fixture scrolls smoothly.

## Measured Baseline

Observed locally on June 18, 2026 against the existing dev server at
`http://localhost:3100/scrollbench?viewer=docx`.

Fixture:

- `public/samples/quarterly-business-review.docx`
- 25 rendered pages
- about 42.5k text characters
- 394 elements inside `.docx-wrapper`
- 542 total page elements

Load probe:

- first rendered pages: about 1.1s wall time in dev
- DOCX fetch: about 4ms once requested
- `docx-preview` lazy chunk: about 9ms once requested
- DOCX fetch started around 659ms
- `docx-preview` chunk started around 975ms

Scrollbench:

- small jumps: about 120 FPS, p95 about 9.3ms, max about 9.4ms
- large jumps: about 120 FPS, p95 about 9.3ms, max about 9.7ms
- no frames over 16ms for either scenario

The immediate problem is therefore not the sample document's scroll FPS. The
problem is first-open latency and scaling behavior for larger DOCX files.

## Problems

### 1. Bytes And Renderer Import Are Serialized

`DocxViewerContent` first suspends on `getDocxDocumentResource`. Only after the
component resumes does `renderDocxPreview` call `loadDocxPreview`.

For a URL source, the network and dynamic import can run at the same time. The
current order leaves avoidable idle time between byte readiness and renderer
readiness.

### 2. Commit Forces Live Layout For Every Page

`commitDocxRender` moves all rendered nodes into the live host, then calls
`getBoundingClientRect()` for each page to compute intrinsic size.

`docx-preview` already emits page sizing styles such as:

```html
<section
  class="docx"
  style="padding: 72pt; width: 612pt; min-height: 792pt"
></section>
```

Those values are enough to derive the normal 816x1056 CSS pixel page size
without forcing live layout for every page.

### 3. Source-Link Indexing Is Eager

After every successful render, `buildDocxRenderIndex` walks the whole rendered
DOM and builds:

- one normalized full-document text string;
- one `{ node, offset }` object per normalized character;
- a full table cell map.

This work is paid even when there is no active highlight and the user never
calls `scrollToTarget`.

### 4. The Text Index Is Too Heavy

The current per-character `positions` array is exact but memory-heavy. Large
reports turn every text character into an object. The target lookup only needs
to resolve a found normalized range back to DOM offsets.

The index should store text-node spans and prefix lengths, then resolve offsets
with a small binary search or local scan. That keeps exact behavior without one
object per character.

### 5. Scroll Measurement Scans Pages

`measureScroll` queries `[data-page-number]` and reads page rects until it finds
the current page. This is acceptable for 25 pages, but it scales linearly with
page count and forces layout reads in the scroll path.

The DOCX viewer already has stable page geometry after commit. Current page and
progress should come from cached offsets and binary search.

### 6. True Progressive Rendering Is Not Yet Available

`docx-preview` exposes `parseAsync`, `renderDocument`, and `renderAsync`, but no
public per-page render primitive. Rendering every page is still fundamentally
one main-thread browser render operation unless we wrap or fork the renderer.

This blueprint keeps progressive rendering as a later phase. The first phases
remove avoidable work around `docx-preview`.

## Target Architecture

### Load Pipeline

Add one resource-level load operation that starts byte read and renderer import
together.

```ts
type DocxRenderInputs = {
  buffer: ArrayBuffer
  docxPreview: typeof import("docx-preview")
}
```

Rules:

- `loadDocxPreview()` starts as soon as the client DOCX content mounts.
- `getDocxDocumentResource()` keeps the existing byte cache semantics.
- errors still map through the existing resource and format error boundaries.
- import retry behavior remains unchanged.

### Commit Pipeline

Move page tagging and intrinsic-size setup as early as possible.

Target flow:

1. `docx-preview` renders into a detached `renderHost`.
2. collect `.docx-wrapper > section.docx` inside `renderHost`;
3. derive each page size from inline styles or fallback defaults;
4. assign `data-page-number`, `content-visibility`, and
   `contain-intrinsic-size` while still detached;
5. commit the finished child nodes into the live host once.

Use `getBoundingClientRect()` only as a fallback for pages whose style cannot be
parsed safely.

### Page Geometry

Introduce a small `DocxPageLayout` model.

```ts
type DocxPageLayout = {
  pages: readonly DocxPageMetric[]
  totalHeight: number
}

type DocxPageMetric = {
  pageNumber: number
  width: number
  height: number
  top: number
  bottom: number
}
```

Rules:

- page width drives fit-to-width;
- page offsets drive current-page detection;
- page offsets drive anchor restoration on zoom;
- scroll measurement uses math, not page DOM queries;
- resize or page size changes rebuild layout once.

### Source Index

Split source navigation into two indexes.

```ts
type DocxCellIndex = Map<string, HTMLElement>

type DocxTextIndex = {
  text: string
  spans: readonly DocxTextSpan[]
}

type DocxTextSpan = {
  start: number
  end: number
  node: Text
  sourceStartOffset: number
}
```

Rules:

- no source index is built during initial render unless `highlight` is present;
- cell-only navigation builds only the cell index;
- text navigation builds the text index lazily;
- repeated targets reuse the index for the current render host;
- clearing or replacing the rendered document clears indexes.

The public `DocxTarget` API stays unchanged.

### Scroll Path

Replace page DOM scanning with layout math.

Rules:

- scroll handler stays passive and RAF-coalesced;
- progress uses `scrollTop / maxScrollTop`;
- current page uses binary search against `DocxPageLayout.pages`;
- zoom anchor stores `{ pageNumber, yPercent }` and restores from layout;
- DOM reads in the hot scroll path are limited to viewport scroll metrics.

## Phases

### Phase 1: Add DOCX Performance Evidence

Create a DOCX-specific profile script or generalize the existing scrollbench
profiling script so it is not CSV-named.

Measure:

- time to viewer shell;
- time to DOCX bytes ready;
- time to `docx-preview` module ready;
- time to detached render complete;
- time to live commit complete;
- time to first ready page;
- DOM node count;
- `getBoundingClientRect()` calls during commit;
- scroll p95 and max frame time;
- layout and style recalculation during scroll.

Acceptance:

- script works against an already-running dev server;
- script does not start, stop, kill, or restart dev servers;
- output is JSON and can be saved under an ignored artifact directory;
- current 25-page fixture baseline is recorded.

### Phase 2: Parallelize Bytes And Renderer Import

Work:

- expose or reuse `loadDocxPreview` from `docx-viewer-render.ts`;
- start import before awaiting the byte resource;
- render only after both promises resolve;
- preserve Suspense fallback behavior;
- preserve retry behavior after transient import failure.

Acceptance:

- existing DOCX tests pass;
- `tests/docx-viewer-import.test.tsx` still proves retry;
- profile shows import starts before or near the DOCX fetch, not hundreds of ms
  later.

### Phase 3: Remove Live Layout From Commit

Work:

- parse page width and height from detached page styles;
- compute pt-to-px with the browser CSS ratio or static 96/72 conversion;
- tag pages and assign intrinsic sizes before commit;
- keep `getBoundingClientRect()` fallback only for unparseable pages.

Acceptance:

- existing page count, zoom, fit-width, and source tests pass;
- a probe shows no per-page `getBoundingClientRect()` calls for normal
  `docx-preview` output;
- fit-width still matches the current 816px sample page width.

### Phase 4: Lazy Source Indexing

Work:

- replace eager `buildDocxRenderIndex(host)` after commit;
- keep a render-scoped lazy index object in a ref;
- build cell index only when resolving cell targets;
- build text index only when resolving text targets;
- update `useDocxHighlight` to request the index only when a highlight exists.

Acceptance:

- opening a DOCX with no highlight does no full text index walk;
- `scrollToTarget` still works after initial render;
- active highlight still appears after render;
- repeated source hover/click does not rebuild the same index.

### Phase 5: Compact Text Index

Work:

- replace per-character `positions` with text-node spans;
- preserve whitespace normalization semantics;
- resolve normalized target offsets back to DOM `Range`;
- keep hidden and non-document filtering behavior intact.

Acceptance:

- `tests/docx-viewer.test.tsx`, `tests/docx-source.test.tsx`, and
  `tests/docx-viewer-edge-cases.test.tsx` pass;
- large text targets resolve to the same DOM range as before;
- memory used by the DOCX text index scales by text nodes, not characters.

### Phase 6: Geometry-Based Current Page

Work:

- create `docx-viewer-layout.ts`;
- compute page offsets from page metrics and wrapper gap;
- use layout for current page, scroll progress, and zoom anchor restoration;
- remove page DOM queries from `measureScroll`.

Acceptance:

- scrollbench stays at or above the current sample baseline;
- large synthetic page counts do not increase current-page work linearly;
- `onVisiblePageChange` preserves current behavior.

### Phase 7: Progressive Render Investigation

This is intentionally last.

Options:

- use `parseAsync` to cache parsed `WordDocument` per resource before render;
- render first page or first section through a small fork of `docx-preview`;
- pre-render trusted documents server-side to HTML plus page metrics;
- keep `docx-preview` as the fallback renderer for arbitrary local files.

Acceptance:

- first visible page can appear before all pages are rendered;
- full fidelity eventually matches current `docx-preview` output;
- failures remain contained by the existing DOCX error boundary;
- no public API change is required.

## Non-Goals

- Do not replace `docx-preview` in the first performance pass.
- Do not trade fidelity for speed by dropping headers, footers, or footnotes by
  default.
- Do not virtualize away the rendered DOM before source navigation semantics are
  redesigned.
- Do not introduce a compatibility adapter or alternate legacy path.
- Do not start or restart dev servers from verification scripts.

## Test Plan

Focused unit and integration tests:

- `pnpm test -- tests/docx-viewer.test.tsx`
- `pnpm test -- tests/docx-viewer-edge-cases.test.tsx`
- `pnpm test -- tests/docx-viewer-import.test.tsx`
- `pnpm test -- tests/docx-viewer-resource.test.ts`
- `pnpm test -- tests/docx-source.test.tsx`
- `pnpm test -- tests/docx-thumbnail.test.tsx`

Performance verification:

- run the DOCX profile script against `/scrollbench?viewer=docx`;
- compare first-ready timing, layout counts, rect reads, DOM nodes, and scroll
  frame stats before and after each phase.

## Definition Of Done

The DOCX viewer is faster when:

- normal first open starts bytes and renderer import together;
- live commit no longer forces layout for every page;
- no-highlight open does not build a source text index;
- scroll measurement does not scan page DOM;
- the 25-page fixture keeps its current scroll smoothness;
- larger DOCX fixtures show lower initial main-thread work and lower memory for
  source indexing;
- existing public props, source linking, download behavior, errors, and zoom
  behavior remain intact.
