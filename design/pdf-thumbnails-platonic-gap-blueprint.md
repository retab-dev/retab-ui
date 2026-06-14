# PDF Thumbnails Platonic Gap Blueprint

## Objective

Decide whether the PDF thumbnail viewer is merely good or actually perfect.

The answer is:

```txt
Good.
Close.
Not perfect.
```

This blueprint names the remaining imperfections without expanding the system
unnecessarily. It focuses only on the PDF thumbnail composed viewer and its
relationship to the viewer primitives.

It does not cover email.
It does not cover file-system.

## Current Shape

The canonical block is structurally strong:

```tsx
<PdfViewerProvider source={PDF_SOURCE}>
  <ViewerRoot bare defaultSidebarOpen className="h-full">
    <PdfViewerHeader start={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar aria-label="PDF pages" width="9rem" className="border-r">
        <PdfViewerThumbnails />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerPages bare className="h-full" />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

This gets the major boundary right:

```txt
ViewerRoot owns spatial sidebar state.
ViewerSidebar owns the rail.
ViewerSurface owns the document surface.
PdfViewerProvider owns PDF document state.
PdfViewerThumbnails owns thumbnail navigation.
PdfViewerPages owns page rendering and scroll.
PdfViewerHeader owns PDF toolbar presentation.
```

This is the best part of the current composed viewer. Do not lose it.

## What Is Already Correct

### Spatial Grammar

The block uses the viewer primitive grammar directly:

```txt
Header
Body
  Sidebar
  Surface
```

There is no PDF-specific sidebar provider. There is no local `aside` hidden
inside the thumbnail component. There is no duplicated split-view primitive.

### Thumbnail Responsibility

`PdfViewerThumbnails` does not try to own the whole PDF viewer. It consumes:

```txt
resource
current page
page selection command
```

and renders:

```txt
virtualized thumbnail navigation
current-page highlight
click-to-jump behavior
```

That is the right responsibility.

### Contextual Composition

Inside `PdfViewerProvider`, the simple API is excellent:

```tsx
<PdfViewerThumbnails />
```

The component reads the shared PDF resource, current page, and select-page
command from context. That is exactly what a shadcn-grade composed component
should do: easy case first, explicit composition still visible.

### Layout Ownership

The thumbnail rail owns thumbnail layout. The viewer sidebar owns rail
placement. Those should never merge.

```txt
ViewerSidebar width = spatial shell width.
PdfViewerThumbnails width = thumbnail image width.
```

That distinction is correct.

### Existing Behavior

The current e2e coverage proves the primary story:

```txt
document scroll updates the current thumbnail
thumbnail click jumps the document
sidebar trigger collapses and expands the rail
```

That is enough to call the component good.

## Why It Is Not Perfect

### Issue 1: Two Modes In One Component

`PdfViewerThumbnails` can work in two ways:

```tsx
<PdfViewerProvider source={source}>
  <PdfViewerThumbnails />
</PdfViewerProvider>
```

or:

```tsx
<PdfViewerThumbnails
  resource={resource}
  currentPage={currentPage}
  onSelectPage={scrollToPage}
/>
```

This is useful, but not perfectly minimal. The component is both:

```txt
context-bound PDF viewer part
standalone thumbnail rail controller
```

That duality creates extra API surface:

```ts
resource?: ViewerResource
currentPage?: number | null
onSelectPage?: (page: number) => void
```

The props are coherent, but the ideal API should make the two modes explicit
instead of implicit fallback logic.

### Platonic Direction

Prefer two named exports:

```tsx
<PdfViewerThumbnails />
<PdfThumbnailRail resource={resource} currentPage={page} onSelectPage={jump} />
```

Where:

```txt
PdfViewerThumbnails = context adapter
PdfThumbnailRail = explicit controlled primitive
```

The current internal implementation already mostly behaves this way. The
remaining issue is naming and public boundary clarity.

## Issue 2: Header Start Slot Must Stay Small

The block injects the sidebar trigger through:

```tsx
<PdfViewerHeader start={<ViewerSidebarTrigger />} />
```

This works. It is also flexible.

`start` is the right compact slot name if `PdfViewerHeader` stays an easy
high-level header. The risk is slot drift: once `start` exists, it is tempting to
add `end`, `title`, `beforeControls`, `afterControls`, and other named escape
hatches until the header becomes a half-primitive.

### Why This Is Not Platonic

The ideal API should make the common composition read inevitable:

```tsx
<PdfViewerHeader sidebarTrigger />
```

or:

```tsx
<PdfViewerHeader>
  <ViewerSidebarTrigger />
  <PdfViewerHeaderTitle />
  <PdfViewerControls />
</PdfViewerHeader>
```

The first is easier. The second is more shadcn-like.

The current `leading` prop is pragmatic but vague.

### Platonic Direction

Use component composition if the header needs flexibility:

```tsx
<PdfViewerHeader>
  <ViewerSidebarTrigger />
  <PdfViewerHeaderTitle />
  <PdfViewerControls />
</PdfViewerHeader>
```

Or keep the current prop if the library intentionally wants a compact easy API,
but rename it with a precise concept:

```tsx
<PdfViewerHeader start={<ViewerSidebarTrigger />} />
```

`start` is a layout slot. `leading` is editorial language and should not return.

The best answer depends on whether `PdfViewerHeader` is meant to be a
slot-driven primitive or an easy high-level header. It should not sit halfway.

## Issue 3: Provider State And Thumbnail Props Overlap

The provider exposes:

```txt
resource
currentPage
onSelectPage
```

The thumbnail component also accepts:

```txt
resource
currentPage
onSelectPage
```

The fallback logic is convenient:

```ts
const resource = props.resource ?? thumbnails?.resource
const currentPage = props.currentPage ?? thumbnails?.currentPage
const onSelectPage = props.onSelectPage ?? thumbnails?.onSelectPage
```

But this means a user can partially override context:

```tsx
<PdfViewerThumbnails currentPage={999} />
```

Now the rail can highlight a page different from the viewer's visible page.
That might be useful for controlled experiments, but it is not the default
mental model.

### Platonic Direction

Make the context adapter strict:

```tsx
function PdfViewerThumbnails(props: PdfViewerThumbnailsProps) {
  const thumbnails = usePdfViewerThumbnails()
  return <PdfThumbnailRail {...thumbnails} {...props} />
}
```

But only allow visual props at this level:

```ts
type PdfViewerThumbnailsProps = {
  thumbnailWidth?: number
  className?: string
}
```

The explicit controlled rail owns the full controlled API:

```ts
type PdfThumbnailRailProps = {
  resource: ViewerResource
  currentPage?: number | null
  onSelectPage?: (page: number) => void
  thumbnailWidth?: number
  className?: string
}
```

This removes partial context override from the easy path while preserving the
advanced path.

## Issue 4: The Sidebar Width And Thumbnail Width Are Easy To Confuse

The block contains:

```tsx
<ViewerSidebar width="9rem">
  <PdfViewerThumbnails />
</ViewerSidebar>
```

The thumbnail component has:

```ts
thumbnailWidth?: number
```

These are different widths:

```txt
ViewerSidebar width = rail container width.
PdfViewerThumbnails thumbnailWidth = thumbnail image width.
```

The distinction is correct but not obvious enough.

### Platonic Direction

Rename thumbnail `width` to:

```ts
thumbnailWidth?: number
```

Then the composition reads without ambiguity:

```tsx
<ViewerSidebar width="9rem">
  <PdfViewerThumbnails thumbnailWidth={120} />
</ViewerSidebar>
```

This is a tiny API naming issue, but tiny naming issues matter at the
perfection bar.

## Issue 5: E2E Coverage Proves The Main Story, Not The Whole Contract

Current e2e coverage proves:

```txt
PDF renders
thumbnail rail renders
document scroll updates current thumbnail
thumbnail click jumps page
sidebar trigger toggles rail
```

Missing proof:

```txt
keyboard activation in thumbnail rail
ArrowUp / ArrowDown / Home / End behavior
trigger Space and Enter behavior
collapsed rail is inert and not tabbable
overlay mode on narrow viewports
Escape closes overlay sidebar
outside click closes overlay sidebar
thumbnail fallback/error state is visible and scoped
large document does not mount all thumbnails
current thumbnail remains visible after repeated scrolls
```

The implementation may already satisfy much of this. The point is that the
component is not perfect until the contract is locked.

## Issue 6: Naming Is Slightly Inconsistent

Current names:

```txt
PdfViewerThumbnails
PdfThumbnailRail
PdfThumbnailItem
PdfThumbnailCanvas
useThumbnailRailFollow
```

The names are understandable, but not perfectly aligned. The primary exported
component says `ViewerThumbnails`, while internal modules say `ThumbnailRail`.

### Platonic Direction

Use a clear two-layer vocabulary:

```txt
PdfViewerThumbnails = context adapter for PdfViewerProvider
PdfThumbnailRail = controlled thumbnail navigation primitive
PdfThumbnailItem = one page button
PdfThumbnailCanvas = one page preview
```

Then make that division explicit in docs and tests. If `PdfThumbnailRail` is not
public, it should still be the internal conceptual center.

## Final Ideal

The perfect PDF thumbnail system has exactly two public use modes.

### Easy Contextual Mode

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot bare defaultSidebarOpen>
    <PdfViewerHeader start={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar aria-label="PDF pages" width="9rem">
        <PdfViewerThumbnails thumbnailWidth={120} />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerPages bare />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

`PdfViewerThumbnails` only accepts visual rail props:

```ts
type PdfViewerThumbnailsProps = {
  thumbnailWidth?: number
  className?: string
}
```

It cannot override `resource`, `currentPage`, or `onSelectPage`.

This keeps `PdfViewerHeader` as an easy high-level header. The `start` slot is
the single intentional escape hatch for spatial controls such as
`ViewerSidebarTrigger`. If the header later becomes a lower-level primitive, it
should become fully compositional in one hard move; it should not accumulate
more named decoration slots.

### Explicit Controlled Mode

```tsx
<PdfThumbnailRail
  resource={resource}
  currentPage={currentPage}
  onSelectPage={scrollToPage}
  thumbnailWidth={120}
/>
```

This is the escape hatch for non-provider compositions, tests, and custom
document viewers.

## Data Contract

The controlled rail receives a tiny semantic contract:

```ts
type PdfThumbnailRailProps = {
  resource: ViewerResource
  currentPage?: number | null
  onSelectPage?: (page: number) => void
  thumbnailWidth?: number
  className?: string
}
```

Rules:

```txt
resource is required.
currentPage is 1-based.
currentPage outside [1, pageCount] means no current thumbnail.
onSelectPage is the only semantic output.
thumbnailWidth controls preview image width, not rail width.
className styles the rail root only.
```

## Accessibility Contract

The thumbnail rail is navigation:

```txt
nav[aria-label="PDF pages"]
  ol
    li
      button[aria-label="Page N"][aria-current="page" when current]
```

Rules:

```txt
Use aria-current="page".
Do not use aria-selected.
Do not use listbox/option.
Every page button is reachable by keyboard when mounted.
Virtualization must not create broken tab order.
ArrowUp and ArrowDown activate previous/next mounted page.
Home and End activate first/last page.
Enter and Space use native button activation.
```

## Performance Contract

The rail must remain fast for large PDFs.

Rules:

```txt
Do not render all thumbnails.
Do not request all page metrics eagerly.
Do not mount canvases to discover page dimensions.
Do not create unbounded PDF.js getPage fan-out.
Do not auto-scroll the rail while the user is interacting with it.
Do not force document scroll from highlight changes.
```

The only acceptable work is:

```txt
visible rows
overscan rows
current page
bounded in-flight page metrics
mounted thumbnail canvases only
```

## Test Contract

### Unit Tests

Required:

```txt
layout uses deterministic fallback metrics
layout applies sparse exact metric deltas
visible window does not materialize all pages
metric requests are deduped and bounded
currentPage outside bounds does not mark a thumbnail current
onSelectPage receives a 1-based page number
context adapter passes provider state to controlled rail
context adapter rejects missing provider
context adapter does not accept semantic overrides
thumbnailWidth does not affect sidebar width
```

### E2E Tests

Required:

```txt
scroll document -> current thumbnail follows
click thumbnail -> document scrolls
keyboard activate thumbnail -> document scrolls
ArrowUp/ArrowDown/Home/End work
sidebar trigger toggles with click
sidebar trigger toggles with keyboard
collapsed sidebar is aria-hidden/inert
tab order does not enter collapsed sidebar
narrow viewport uses overlay mode
Escape closes overlay sidebar
outside click closes overlay sidebar
large sample does not mount all thumbnail canvases
```

## Migration

This should be a hard cleanup, not a compatibility layer.

Steps:

1. Introduce `PdfThumbnailRail` as the controlled primitive.
2. Make `PdfViewerThumbnails` a strict context adapter.
3. Rename thumbnail `width` to `thumbnailWidth`.
4. Decide whether `PdfViewerHeader` is slot-composed or easy-prop composed.
5. Update the PDF thumbnails block to the final composition.
6. Expand unit and e2e tests to cover keyboard, overlay, inertness, and large
   document behavior.
7. Regenerate registry artifacts.

No deprecated props.
No compatibility shims.
No alternate path.

## Verdict

The current PDF thumbnail viewer is one of the healthiest composed viewers in
the system.

It is not perfect because:

```txt
the context adapter and controlled rail are fused,
thumbnail width is ambiguously named,
the header trigger slot is too generic,
semantic context overrides are possible,
the tests do not yet prove the whole contract.
```

The final version should feel smaller, not larger:

```txt
PdfViewerThumbnails = provider adapter.
PdfThumbnailRail = controlled rail.
ViewerSidebar = spatial shell.
PdfViewerPages = document surface.
```

That is the platonic shape.
