# PDF Viewer Final Blueprint

This is the last-mile blueprint for taking `PdfViewer` from a well-factored
component to the closest practical version of the Platonic ideal:

- everything needed
- nothing extra
- exact module boundaries
- consistent names
- testable invariants
- no accidental public surface

The current implementation is strong. The remaining work is deliberately small.
Do not add features in this pass.

## Implementation Status

Implemented in this pass:

- shared PDF viewer types live in `pdf-viewer-types.ts`
- learned page-size state lives in `pdf-viewer-page-sizes.ts`
- implementation modules no longer import from `pdf-viewer.tsx`
- the public shell no longer re-exports the internal test reset helper
- resource, scale, page-size, and scroll invariants have focused tests
- registry output includes every extracted PDF viewer module

Remaining verification debt: real browser canvas verification still needs a
working Browser or Playwright runtime.

## Current State

The viewer already has the right module split:

```txt
registry/new-york-v4/ui/pdf-viewer.tsx
registry/new-york-v4/ui/pdf-viewer-resource.ts
registry/new-york-v4/ui/pdf-viewer-scale.ts
registry/new-york-v4/ui/pdf-viewer-scroll.ts
registry/new-york-v4/ui/pdf-viewer-virtualization.ts
registry/new-york-v4/ui/pdf-viewer-page.tsx
registry/new-york-v4/ui/pdf-viewer-toolbar.tsx
registry/new-york-v4/ui/pdf-viewer-rail.tsx
registry/new-york-v4/ui/pdf-viewer-states.tsx
```

It already handles:

- lazy client-only pdfjs loading
- bundled worker setup
- stable Suspense resources
- ownership-aware document cache
- same-src retry after failed loads
- page cache keyed by document identity
- page canvas virtualization
- lazy mixed-page-size correction
- controlled and uncontrolled zoom
- clamped fit-width scale
- rotation
- per-page overlays
- scroll telemetry
- imperative normalized-area scrolling
- toolbarless fallback parity
- retryable error state
- multi-file registry output
- direct component tests

The remaining imperfections are not architectural failures. They are the last
bits of public API noise, type coupling, and verification debt.

## Non-Negotiable Invariants

Keep these unchanged:

- `PdfViewer` remains a PDF rendering primitive, not a document workflow
  component.
- Source-linked consumers must not know PDF layout math.
- Every page keeps a mounted slot.
- Offscreen pages do not keep live canvases.
- Cache pruning cannot destroy a retained document.
- Failed document loads are retryable for the same `src`.
- Fit width, manual zoom, and controlled zoom share one scale policy.
- Fallback and loaded states honor the same shell props.
- Registry consumers receive every module required by the component.

## Final Target Shape

Add two small modules:

```txt
registry/new-york-v4/ui/pdf-viewer-types.ts
registry/new-york-v4/ui/pdf-viewer-page-sizes.ts
```

Final responsibility map:

- `pdf-viewer.tsx`: public shell, slot composition, resource reads, imperative
  handle wiring.
- `pdf-viewer-types.ts`: shared public/internal types only.
- `pdf-viewer-resource.ts`: pdfjs import, worker setup, document/page caches,
  retain/release, internal test reset.
- `pdf-viewer-scale.ts`: scale constants, clamping, fit-width math,
  controlled/uncontrolled scale hook.
- `pdf-viewer-scroll.ts`: viewport state, current-page measurement, scroll
  progress, `scrollToPageArea`.
- `pdf-viewer-virtualization.ts`: visible page set and slot observation.
- `pdf-viewer-page-sizes.ts`: learned page-size map.
- `pdf-viewer-page.tsx`: one page, one canvas, one overlay layer.
- `pdf-viewer-toolbar.tsx`: toolbar chrome.
- `pdf-viewer-rail.tsx`: measured rail collapse.
- `pdf-viewer-states.tsx`: fallback skeletons and error boundary.

No file should need to import from `pdf-viewer.tsx` except consumers.

## Step 1: Extract Shared Types

Create `pdf-viewer-types.ts`:

```ts
import type * as React from "react"

export interface PageOverlayProps {
  pageNumber: number
  width: number
  height: number
  scale: number
  rotation: number
}

export type PdfPageArea = {
  top: number
  left?: number
  width?: number
  height?: number
}

export interface PdfViewerHandle {
  scrollToPageArea: (
    pageNumber: number,
    area: PdfPageArea,
    options?: ScrollToOptions
  ) => void
  getViewportElement: () => HTMLDivElement | null
}

export interface PdfViewerSlots {
  top?: React.ReactNode
  bottom?: React.ReactNode
  left?: React.ReactNode
  right?: React.ReactNode
  overlay?: React.ReactNode
}

export type PdfPageSize = {
  width: number
  height: number
}
```

Then:

- `pdf-viewer.tsx` imports and re-exports public types from
  `pdf-viewer-types.ts`.
- `pdf-viewer-page.tsx` imports `PageOverlayProps` and `PdfPageSize` from
  `pdf-viewer-types.ts`.
- `pdf-viewer-scroll.ts` imports `PdfPageArea` from `pdf-viewer-types.ts`.
- remove type back edges from implementation modules to `pdf-viewer.tsx`.

Success condition: `rg 'from "./pdf-viewer"' registry/new-york-v4/ui/pdf-viewer-*`
returns no implementation-module imports.

## Step 2: Extract Page-Size State

Create `pdf-viewer-page-sizes.ts`:

```ts
import * as React from "react"

import type { PdfPageSize } from "./pdf-viewer-types"

export function usePdfPageSizes(resetKey: unknown) {
  const [pageSizeByNumber, setPageSizeByNumber] = React.useState<
    ReadonlyMap<number, PdfPageSize>
  >(() => new Map())

  React.useEffect(() => setPageSizeByNumber(new Map()), [resetKey])

  const setPageSize = React.useCallback(
    (pageNumber: number, size: PdfPageSize) => {
      setPageSizeByNumber((previousPageSizeByNumber) => {
        const current = previousPageSizeByNumber.get(pageNumber)
        if (current?.width === size.width && current.height === size.height) {
          return previousPageSizeByNumber
        }
        const nextPageSizeByNumber = new Map(previousPageSizeByNumber)
        nextPageSizeByNumber.set(pageNumber, size)
        return nextPageSizeByNumber
      })
    },
    []
  )

  return { pageSizeByNumber, setPageSize }
}
```

`pdf-viewer.tsx` should no longer own map-update mechanics. It should only ask:

```ts
const { pageSizeByNumber, setPageSize } = usePdfPageSizes(document)
```

Success condition: the shell reads page sizes but does not implement the map
mutation algorithm.

## Step 3: Remove Accidental Public Test Surface

Current pragmatic state:

```ts
export { __resetPdfDocumentCacheForTests } from "./pdf-viewer-resource"
```

Ideal state:

- production consumers import only viewer APIs from `pdf-viewer.tsx`.
- tests import cache-reset utilities directly from `pdf-viewer-resource.ts`.
- `pdf-viewer.tsx` does not export `__resetPdfDocumentCacheForTests`.

Required updates:

- update `tests/pdf-viewer.test.tsx` to import
  `__resetPdfDocumentCacheForTests` from
  `@/registry/new-york-v4/ui/pdf-viewer-resource`.
- keep `getDocumentResource` and `getPageResource` re-exported from
  `pdf-viewer.tsx`; thumbnail consumers rely on that public convenience.
- do not expose any new test-only props.

Success condition:

```txt
rg "__resetPdfDocumentCacheForTests" registry/new-york-v4/ui/pdf-viewer.tsx
```

returns nothing.

## Step 4: Decide Alias Policy

There are two acceptable end states. Pick one deliberately.

### Option A: Compatibility Release

Keep aliases:

- `header`
- `aside`
- `asideToggle`
- `defaultAsideOpen`

But make them obviously secondary:

- docs label them "compatibility aliases".
- implementation resolves them once at the shell boundary.
- internal names remain `topSlot`, `leftRailSlot`, `showRailToggle`,
  `railsOpen`.
- no new code should use the aliases.

This is the right choice if registry consumers may already depend on them.

### Option B: Breaking Ideal

Remove aliases:

- `header`
- `aside`
- `asideToggle`
- `defaultAsideOpen`

Keep only:

- `slots.top`
- `slots.left`
- `railToggle`
- `defaultRailsOpen`

This is the purest API. Only do it if the registry version can break.

Default recommendation: choose Option A now, document Option B as the next
breaking cleanup. Compatibility is not Platonic, but silent breakage is worse.

## Step 5: Tighten Tests

Add focused tests, not broad snapshot tests.

### Type Boundary Test

No runtime test needed. Add a source search check manually during review:

```txt
rg 'from "./pdf-viewer"' registry/new-york-v4/ui/pdf-viewer-*
```

Implementation modules should import from `pdf-viewer-types.ts`, not the shell.

### Page-Size Hook Test

Add `tests/pdf-viewer-page-sizes.test.ts`:

- starts with an empty map
- records a new page size
- returns the same map when size is unchanged
- resets when `resetKey` changes

### Cache Tests

Extend direct resource tests:

- same `src` deduplicates document loads
- retained documents are not evicted when the cache exceeds max size
- unretained fulfilled documents are destroyed on eviction
- rejected entries are removed and retried
- reset helper destroys fulfilled documents

### Scroll Tests

Extend scroll tests:

- invalid page does nothing
- negative `area.top` clamps to page top
- `area.top > 100` clamps to page bottom
- progress is `0` when content is not scrollable
- current page selection uses the 20% marker

Keep jsdom component tests for integration behavior:

- toolbarless fallback and loaded state
- controlled scale requests
- fit-width clamp label
- missing `IntersectionObserver` renders all pages
- imperative scroll target

## Step 6: Browser Verification

Run real browser checks after the code cleanup.

Verify samples:

- one-page PDF
- long PDF
- mixed-size PDF
- rotated PDF
- source-linked overlay
- toolbarless embedded viewer
- left rail
- right rail
- top and bottom slots
- floating overlay
- thumbnail sidebar composition

Checks:

- no console errors
- canvases render nonblank pixels
- zoom in, zoom out, fit width, rotate, download work
- controlled scale does not drift
- overlays stay aligned after zoom and rotation
- current-page callback tracks scroll
- `scrollToPageArea` lands with headroom
- narrow viewport toolbar does not overlap

Use the Browser plugin or Playwright. Do not declare the component finished
without this pass.

## Step 7: Registry And Docs

Update `registry.json`, `public/r/registry.json`, and `public/r/pdf-viewer.json`
to include:

- `pdf-viewer-types.ts`
- `pdf-viewer-page-sizes.ts`

Docs must state:

- `railToggle` and `defaultRailsOpen` are preferred.
- `asideToggle` and `defaultAsideOpen` are compatibility aliases.
- `header` and `aside` are compatibility aliases for `slots.top` and
  `slots.left`.
- `scale` is controlled when supplied.
- `null` from `onScaleChange` means fit width.

## Non-Goals

Do not add:

- text selection
- search
- annotation editing
- thumbnail state inside `PdfViewer`
- extraction/edit-specific props
- another virtualization library
- another PDF engine
- visible keyboard shortcut copy
- new aliases

Do not rewrite working modules for taste alone. Only change code that removes
coupling, removes public noise, or proves an invariant.

## Definition Of Done

This final pass is done when:

- no implementation module imports from `pdf-viewer.tsx`.
- shared types live in `pdf-viewer-types.ts`.
- page-size map mechanics live in `pdf-viewer-page-sizes.ts`.
- `__resetPdfDocumentCacheForTests` is no longer re-exported by the public shell.
- alias policy is explicit in docs and implementation.
- tests cover page-size state, scale clamping, retry, invalid scroll, and
  observer fallback.
- registry output includes every new module.
- focused tests pass.
- formatting passes.
- filtered typecheck shows no PDF viewer diagnostics.
- real browser verification passes on representative PDFs.
