# Parse Viewer Scaling Blueprint

## Objective

Keep the current Parse Viewer visual quality while making the Markdown pane
scale like the page-based viewers already in the codebase.

The target is not a new generic viewer abstraction. It is the Parse/PageMarkdown
viewer rewritten with the same module grammar used by PDF, Image, and DOCX:

- pure layout math in one module
- scale state in one module
- scroll reporting and imperative targets in one module
- visibility/windowing in one module
- loaded content composition in one component
- chrome and page rendering kept separate

## Reference Viewers

### PDF

PDF is the strongest reference.

Relevant shape:

- `pdf-viewer.tsx`: facade, resource shell, loaded composition.
- `pdf-viewer-layout.ts`: page size, offsets, total height, binary search,
  visible page numbers.
- `pdf-viewer-scroll.ts`: current page, scroll progress, `scrollToPage`,
  `scrollToPageArea`, viewport ref.
- `pdf-viewer-virtualization.ts`: RAF-coalesced visible page window.
- `pdf-viewer-scale.ts`: fit-width and zoom state.
- `pdf-viewer-page.tsx`: expensive page rendering.
- `pdf-viewer-toolbar.tsx` and `pdf-viewer-states.tsx`: chrome.

The Markdown pane should copy this structure closely.

### Image

Image is not fully virtualized. It maps every frame, but each `ImageFrame`
gates expensive canvas work with `IntersectionObserver`.

Relevant ideas to keep:

- frame/content split
- `data-slot` and `data-frame-number` attributes
- viewer handle exposes `getViewportElement`
- visible item marker near 20% of viewport height
- scale/rotation kept out of the frame list composition

For Parse Markdown, page shells should not all mount. Use PDF-style
virtualization, not Image-style lazy content only.

### DOCX

DOCX is visually document-like but currently keeps the rendered document DOM and
detects current page by scanning `[data-page-number]` elements.

Relevant ideas to keep:

- rendered document can remain browser-layout-owned
- page tagging with `data-page-number`
- `ScrollArea` viewport plus RAF-coalesced scroll measurement
- fit-width scale semantics

For Parse Markdown, avoid DOCX's DOM scan for current page once a layout model
can answer page-from-offset directly.

## Current Problem

`PageMarkdownPane` currently renders one `PageMarkdownPageFrame` per page:

```tsx
pages.map((markdown, pageIndex) => (
  <PageMarkdownPageFrame ... />
))
```

Each page frame exists in React and the DOM. Inner Markdown is lazily rendered
with `IntersectionObserver`, but the page shells still scale linearly with page
count.

That is fine for moderate parse outputs. It is not the right architecture for
hundreds or thousands of pages.

## Target File Map

Keep the public APIs:

- `ParseViewer`
- `PageMarkdownViewer`
- `PageMarkdownPane`
- `PageMarkdownPageFrame`

Refactor internals into the same grammar as PDF and DOCX:

```txt
page-markdown-viewer.tsx          high-level split-view composition
page-markdown-pane.tsx            loaded markdown pane composition
page-markdown-types.ts            props, handle, view mode, layout types
page-markdown-layout.ts           pure page offset/height/window math
page-markdown-scale.ts            fit-width, zoom, clamp
page-markdown-scroll.ts           current page, progress, scrollToPage
page-markdown-virtualization.ts   RAF-coalesced visible page numbers/items
page-markdown-page-frame.tsx      one page frame + measurement
page-markdown-content.tsx         rendered/text mode content
page-markdown-components.tsx      react-markdown component map
page-markdown-toolbar.tsx         toolbar
page-markdown-actions.tsx         copy/download actions
page-markdown-empty-state.tsx     empty/loading state
```

This replaces the previous blueprint's generic `use-page-markdown-virtualizer`
name with the repo's existing viewer vocabulary.

## Layout Model

Create `page-markdown-layout.ts`, modeled after `pdf-viewer-layout.ts`.

Core types:

```ts
export const PAGE_MARKDOWN_PAGE_GAP = 16
export const PAGE_MARKDOWN_PAGE_PADDING = 16

export type PageMarkdownMeasuredPageLayout = {
  height: number
  heightDelta: number
  pageNumber: number
}

export type PageMarkdownPageLayout = {
  height: number
  offsetTop: number
  pageNumber: number
  width: number
}

export type PageMarkdownLayoutModel = {
  estimatedHeight: number
  measuredPageByNumber: ReadonlyMap<number, PageMarkdownMeasuredPageLayout>
  measuredPages: readonly PageMarkdownMeasuredPageLayout[]
  pageCount: number
  prefixHeightDeltas: readonly number[]
  totalHeight: number
  width: number
}
```

Core functions:

```ts
export function createPageMarkdownLayout({
  measuredHeightByPageNumber,
  mode,
  pages,
  scale,
  width,
}: {
  measuredHeightByPageNumber: ReadonlyMap<number, number>
  mode: PageMarkdownViewMode
  pages: readonly string[]
  scale: number
  width: number
}): PageMarkdownLayoutModel

export function getPageMarkdownPageLayout(
  layout: PageMarkdownLayoutModel,
  pageNumber: number
): PageMarkdownPageLayout | undefined

export function findPageMarkdownPageByOffset(
  layout: PageMarkdownLayoutModel,
  offset: number
): number

export function getPageMarkdownVisiblePageNumbers({
  layout,
  scrollTop,
  viewportHeight,
  overscanPages,
}: {
  layout: PageMarkdownLayoutModel
  scrollTop: number
  viewportHeight: number
  overscanPages?: number
}): readonly number[]
```

Implementation rules:

- Use binary search for `findPageMarkdownPageByOffset`, like PDF.
- Keep estimated height and measured height deltas separate.
- Use prefix height deltas so offset lookup stays cheap.
- Keep page width in the layout model.
- Keep mode and scale out of scroll code; layout owns their effect on heights.

## Height Estimation

Start with the existing `estimateMarkdownPageHeight(markdown, scale)`, but move
it into `page-markdown-layout.ts`.

Then improve it without changing the architecture:

- code block: line count times code line height
- table: header plus row count times row height
- paragraph: character count divided by approximate characters per line
- headings: fixed block height
- image: fixed placeholder height

Measured heights override estimates through `measuredHeightByPageNumber`.

The measurement cache key must include:

```txt
pageNumber + mode + scale + markdownHash
```

Rendered and text modes cannot share measurements.

## Scale Module

Create `page-markdown-scale.ts`, aligned with `docx-viewer-scale.ts` and
`pdf-viewer-scale.ts`.

Move these existing constants/functions out of `page-markdown-model.ts`:

- `PAGE_MARKDOWN_SCALE_MIN`
- `PAGE_MARKDOWN_SCALE_MAX`
- `PAGE_MARKDOWN_FIT_SCALE_MAX`
- `fitPageScale`
- `zoomPageScale`
- scale clamping

Target hook:

```ts
export function usePageMarkdownScale({
  containerWidth,
  defaultScale,
  onScaleChange,
  pageWidth,
  resetKey,
  scale: controlledScale,
}: {
  containerWidth: number | null
  defaultScale?: number
  onScaleChange?: (scale: number | null) => void
  pageWidth: number
  resetKey?: string
  scale?: number
}) {
  return {
    fitWidth,
    scale,
    setViewerScale,
    zoomIn,
    zoomOut,
  }
}
```

The current public `PageMarkdownViewer` does not need to expose controlled
scale immediately, but the internal hook should use the same semantics:

- `scale` means controlled scale.
- `defaultScale` means initial uncontrolled scale.
- `null` means fit width.

## Scroll Module

Create `page-markdown-scroll.ts`, aligned with `pdf-viewer-scroll.ts`.

Responsibilities:

- own the viewport element ref
- report scroll progress in `[0, 1]`
- compute current page from layout and 20% viewport marker
- RAF-coalesce scroll measurement
- reset scroll on document reset key
- expose `scrollToPage`
- expose `getViewportElement`

Target shape:

```ts
export function usePageMarkdownScroll({
  layout,
  onScrollProgressChange,
  onVisiblePageChange,
  pageCount,
  resetKey,
}: {
  layout: PageMarkdownLayoutModel
  onScrollProgressChange?: (progress: number) => void
  onVisiblePageChange?: (page: number) => void
  pageCount: number
  resetKey?: unknown
}) {
  return {
    currentPage,
    getViewportElement,
    handleScroll,
    measureScroll,
    scrollToPage,
    setViewportElement,
    viewportElement,
  }
}
```

Unlike the current implementation, `scrollToPage` should not call
`scrollIntoView`. It should use layout offsets:

```ts
const page = getPageMarkdownPageLayout(layout, pageNumber)
viewport.scrollTo({
  top: page.offsetTop,
  behavior: "smooth",
  ...options,
})
```

Visible page tracking should not scan DOM nodes. It should use:

```ts
findPageMarkdownPageByOffset(layout, scrollTop + viewportHeight * 0.2)
```

## Virtualization Module

Create `page-markdown-virtualization.ts`, aligned with
`pdf-viewer-virtualization.ts`.

Responsibilities:

- compute visible page numbers from the layout and viewport
- coalesce visible window updates with `requestAnimationFrame`
- reset to top-window when reset key changes
- return visible page numbers

Target shape:

```ts
export function usePageMarkdownPageVirtualization({
  layout,
  resetKey,
  viewportElement,
}: {
  layout: PageMarkdownLayoutModel
  resetKey?: unknown
  viewportElement: HTMLDivElement | null
}) {
  return {
    measureVisiblePages,
    visiblePageNumbers,
  }
}
```

Use page-number arrays rather than generic virtual items, matching PDF. The pane
can derive the full page layout from each page number.

## Page Measurement

Update `PageMarkdownPageFrame` so it no longer owns
`IntersectionObserver`. The virtualizer decides which pages are mounted.

New props:

```ts
type PageMarkdownPageFrameProps = {
  estimatedHeight: number
  markdown: string
  mode: PageMarkdownViewMode
  onSize: (pageNumber: number, height: number) => void
  page: number
  scale: number
}
```

Behavior:

- Render real Markdown immediately.
- Use `ResizeObserver` to report actual height.
- Fall back to one synchronous `offsetHeight` read when `ResizeObserver` is
  unavailable.
- Keep `data-slot="page-markdown-page"`.
- Keep `data-page-number`.
- Keep the current paper-like visual frame.

This is closer to PDF's `PdfPage` reporting size than Image's
`IntersectionObserver` gating.

## Pane Composition

`PageMarkdownPane` should become the loaded document composition, similar to the
document portion of `PdfViewerInner`.

Target render shape:

```tsx
<ScrollArea
  className="min-h-0 flex-1"
  viewportRef={setViewportElement}
  viewportProps={{ onScroll: handleViewportScroll }}
>
  <div
    ref={containerRef}
    className="relative mx-auto"
    style={{
      height: layout.totalHeight,
      minWidth: layout.width,
    }}
  >
    {visiblePageNumbers.map((pageNumber) => {
      const page = getPageMarkdownPageLayout(layout, pageNumber)
      if (!page) return null

      return (
        <div
          key={pageNumber}
          data-slot="page-markdown-page-slot"
          data-page-number={pageNumber}
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: page.offsetTop,
            width: page.width,
            minHeight: page.height,
          }}
        >
          <PageMarkdownPageFrame
            page={pageNumber}
            markdown={pages[pageNumber - 1]}
            mode={mode}
            scale={scale}
            estimatedHeight={page.height}
            onSize={setPageHeight}
          />
        </div>
      )
    })}
  </div>
</ScrollArea>
```

`handleViewportScroll` should mirror PDF:

```ts
const handleViewportScroll = React.useCallback(() => {
  handleScroll()
  measureVisiblePages()
}, [handleScroll, measureVisiblePages])
```

## Scroll Stability

PDF can derive most page positions from fixed page metrics. Markdown pages have
variable browser-laid-out heights, so measurement changes can cause jumps.

Use a scroll anchor when committing measurements:

```ts
type PageMarkdownScrollAnchor = {
  offsetWithinPage: number
  pageNumber: number
}
```

Before storing a changed measured height:

1. Read current `scrollTop`.
2. Find anchor page from the old layout.
3. Store `scrollTop - oldPage.offsetTop`.
4. Commit measurement.
5. After layout recomputes, set:

```ts
viewport.scrollTop = newPage.offsetTop + anchor.offsetWithinPage
```

Only do this for measurement changes above or at the current anchor. Avoid
fighting user scroll by restoring in a layout effect immediately after the
layout update.

## Source Document Sync

Keep the existing `usePagePaneSync` behavior:

- document pane reports visible page
- markdown pane scrolls to page
- markdown pane reports visible page
- document pane scrolls to page

Change only the Markdown pane's implementation of `scrollToPage`:

- current: DOM `scrollIntoView`
- target: layout offset `scrollTo`

The document pane can keep `scrollIntoView` because its child viewer may be PDF,
DOCX, image, or a custom render function. The Markdown pane owns enough layout
math to avoid DOM targeting.

## Rendered/Text Mode

Keep both modes:

- `rendered`: `ReactMarkdown` + `remark-gfm` + `markdownComponents`
- `text`: `<pre>` with wrapped Markdown source

Mode changes should:

- reset or namespace page measurements
- recompute layout
- preserve approximate current page via scroll anchor
- keep page sync state

## DOM Target

Target mounted page slots:

```txt
visible pages + overscan pages
```

Match PDF's default behavior:

- use viewport-height based discovery in `getPageMarkdownVisiblePageNumbers`
- then expand by `overscanPages`, defaulting to `2`

For a viewport showing two pages, this should usually mount around six to eight
page frames, not every page in the document.

## Tests

Add focused tests in the same style as existing PDF/PageMarkdown tests.

Pure layout tests:

1. `createPageMarkdownLayout` computes total height from estimates.
2. Measured page heights update total height and offsets.
3. `findPageMarkdownPageByOffset` binary-searches variable-height pages.
4. `getPageMarkdownVisiblePageNumbers` clips at document edges and overscans.

Scroll tests:

1. Current page uses the 20% viewport marker.
2. Scroll progress is clamped to `[0, 1]`.
3. `scrollToPage` works for unmounted pages using layout offsets.
4. Reset key resets scroll and current page.

Virtualization tests:

1. 1,000 pages mount only the visible page window.
2. Scrolling updates `visiblePageNumbers` with RAF coalescing.
3. Reset key returns the window to the top pages.

Measurement tests:

1. `PageMarkdownPageFrame` reports measured height through `ResizeObserver`.
2. Missing `ResizeObserver` still reports a best-effort height.
3. Measurement above the viewport preserves the scroll anchor.
4. Rendered/text mode measurements are isolated.
5. Zoom preserves approximate page position.

Integration tests:

1. Source-document sync still works.
2. Rendered/text toggle still works.
3. GFM tables, tasks, code, raw HTML safety, safe links, and safe images still
   pass existing tests.

## Migration Plan

1. Add `page-markdown-layout.ts` and pure tests.
2. Add `page-markdown-scroll.ts` and tests.
3. Add `page-markdown-virtualization.ts` and tests.
4. Move scale helpers into `page-markdown-scale.ts`.
5. Update `PageMarkdownPageFrame` to report size and remove
   `IntersectionObserver`.
6. Rewrite `PageMarkdownPane` around the PDF-style relative canvas and absolute
   page slots.
7. Keep `PageMarkdownViewer` and `ParseViewer` public APIs unchanged.
8. Run existing Parse/PageMarkdown tests.
9. Add large-document tests and, if useful, a profile route fixture.

## Expected Result

Parse Viewer keeps its document quality and becomes architecturally consistent
with the existing viewers:

- Like PDF: layout model, scroll module, visible page window, absolute page
  slots.
- Like Image: page/frame rendering is isolated from viewer composition.
- Like DOCX: browser layout still owns rich document content.
- Better than current Parse Viewer: page shells are actually virtualized.
- Better than current file Markdown viewer visually: Markdown renders through
  normal React/GFM components inside a page frame.

The final architecture is format-specific but predictable, which is the same
standard used by the rest of the viewer stack.
