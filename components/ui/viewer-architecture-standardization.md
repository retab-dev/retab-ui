# Viewer Architecture Standardization

The standalone viewer architecture should standardize around the PDF shape. PDF is currently the clearest implementation: a thin public facade, a resource-aware viewer shell, a Suspense/error boundary, and separate modules for layout, scale, scroll, resource loading, page rendering, toolbar, fallback states, and source adapters.

This should not become a generic mega-viewer abstraction. The formats differ too much in rendering engines, target semantics, caching, and virtualization. The right standard is a consistent module grammar: every viewer should have predictable homes for the same responsibilities, while keeping format-specific internals explicit.

This document is a direction, not a claim of perfect certainty. The broad review of `FileViewer`, XLSX, segmented document views, app shell navigation, sidebar/header primitives, and file-specific text/markdown/html previews changes the standard in three important ways:

- Standalone viewers and `FileViewer` adapters are separate architectural layers.
- Viewer-intrinsic chrome, document-attached slots, and workflow shells are separate composition layers.
- CSV and file-level text/markdown/html previews should not be forced into Suspense just to look like page viewers.

## Current State

- PDF is the reference architecture: `pdf-viewer.tsx` composes focused modules for resource loading, page layout, scale, scroll, virtualization, toolbar, fallback, and source overlays.
- PPTX follows the same direction with `core`, `zoom`, `viewport`, `visible-slide`, `toolbar`, `source`, and slide modules, but it does not expose an imperative handle or source adapter yet.
- Image is cleanly split into facade, content, hooks, chrome, frame, and types.
- Text is partially split: resource, chrome, ranges, and layout are separate, but the main viewer still owns virtualization, scale, retry keys, handle wiring, and row rendering.
- CSV is pragmatic but least aligned: dialect resolution, resource creation, streaming state, downloads, inline errors, grid orchestration, and handle wiring live in the top-level viewer. It also does not use the shared Suspense/error boundary shell.
- XLSX follows the facade/resource shell pattern, but its session still owns workbook parsing cache, sheet state, tabs, scale, downloads, active cell, pending scroll, fallback tabs, and grid composition in one file.
- DOCX is the main outlier. It is production-quality but too concentrated: public API, render lifecycle, target resolution, scroll math, zoom state, toolbar, fallback, error mapping, and DOM indexing all live in one large file.
- `FileViewer` is a router and adapter layer, not just another viewer. It resolves a descriptor, lazy-loads heavy standalone viewers, owns file-level fallback/error chrome, and has separate text/markdown/html preview implementations.
- `SiteHeader`, `DocsSidebar`, and the design-system `Sidebar` are app shell/navigation components. They should not drive document-viewer architecture.
- `SegmentLegend`, `SegmentSidebar`, `PageTimeline`, `PdfThumbnailSidebar`, `PdfViewerRail`, and `HeaderAwareScrollbar` are viewer-adjacent chrome. They should influence the slot/chrome contract.

## Architectural Layers

There are two layers that should stay distinct.

Standalone viewers:

```txt
pdf
docx
pptx
image
xlsx
text
csv
```

File viewer adapters:

```txt
file-viewer route
file-viewer chrome
file-viewer text preview
file-viewer markdown preview
file-viewer html preview
file-viewer csv adapter
```

Standalone viewers optimize for reusable format-specific viewing and source linking. `FileViewer` optimizes for "given any source, preview the right thing" with lazy routing, unified file chrome, and file-specific fallbacks. These should share utilities and vocabulary, but not collapse into the same component hierarchy.

## Standard File Map

Each standalone viewer should use this module shape where it applies:

```txt
<format>-viewer.tsx            public facade + ResourceViewer + boundary/Suspense shell
<format>-viewer-types.ts       props, handle, target, overlay props, slot types
<format>-viewer-resource.ts    format cache/load/retain/clear/reset
<format>-viewer-core.ts        pure constants, geometry, normalization, reset/cache keys
<format>-viewer-scale.ts       scale state, fit-width, zoom controls
<format>-viewer-scroll.ts      visible item, scroll progress, imperative scroll target
<format>-viewer-content.tsx    loaded document composition
<format>-viewer-chrome.tsx     frame, toolbar, fallback, skeletons
<format>-source.tsx            source anchor -> viewer target + source-link bridge
```

Not every format needs every file. For example, CSV can keep progressive loading in explicit state, and text may have virtualization instead of page layout. The point is to give each responsibility a predictable home.

Rendering-engine modules stay format-specific:

```txt
pdf-viewer-page.tsx
pptx-viewer-slide.tsx
docx-viewer-render.ts
csv-viewer-grid.tsx
image-viewer-frame.tsx
xlsx-viewer-grid.tsx
```

## Standard Public Names

Every format should export names with the same grammar:

```ts
FormatViewer
FormatResourceViewer
FormatViewerProps
FormatResourceViewerProps
FormatDocumentSource
FormatViewerHandle
FormatTarget
FormatOverlayProps
FormatViewerSlots
```

Not every format needs every type. If a format does not support overlays or source targets, the absence should be deliberate and documented.

## Standard Shared Props

Use the same names for the same concepts:

```ts
source
className
scale
defaultScale
onScaleChange
toolbar
bare
slots
onVisiblePageChange / onVisibleSlideChange / onVisibleFrameChange
onScrollProgressChange
```

`scale`, `defaultScale`, and `onScaleChange` are standard for page-like viewers: PDF, DOCX, PPTX, and image. They should not be blindly imposed on text, CSV, XLSX, or file-level previews, where zoom may mean font size, grid density, or a preview-only transform.

Prefer `slots` over one-off `header` and `aside` props:

```ts
interface ViewerSlots {
  top?: React.ReactNode
  bottom?: React.ReactNode
  left?: React.ReactNode
  right?: React.ReactNode
  overlay?: React.ReactNode
}
```

Page/document viewers should support the full slot shape where layout allows. Formats can support a subset first, but new work should not add `header`, `aside`, `sidebar`, or `footer` props when `slots` expresses the same composition point.

## Chrome, Slots, And Workflow Shells

The sidebar/header review adds an important boundary. Not every panel near a viewer belongs to the viewer.

Viewer-intrinsic chrome belongs inside the format viewer:

```txt
toolbar
zoom controls
fit width control
fallback
skeleton
error surface
header-aware scrollbar
document frame
```

Document-attached slots belong in the viewer `slots` API:

```txt
top       segment legend, page timeline, document-local header strip
bottom    timeline, progress strip, document-local footer strip
left      segment sidebar, thumbnail rail, page list
right     document-local inspector or thumbnail rail
overlay   highlights, source indicators, floating legend, selection affordances
```

Slot content can be stateful and heavy. `PdfThumbnailSidebar` proves that a slot may own its own resource cache, Suspense boundary, error boundary, virtualization, and viewport gating. The viewer should mount slots predictably, but it should not assume they are cheap or stateless.

Slot content owns its own presentation variant. For example, `SegmentLegend` can be `plain`, `bar`, or `floating`; the viewer should not know those semantics. The viewer only owns placement, sizing pressure, and scroll interaction with the document surface.

Rails are a slot policy, not a general app sidebar policy:

- `left` and `right` slots may be wrapped by a viewer rail when collapsible side chrome is part of the document experience.
- `top` and `bottom` slots are document-column strips and should not scroll independently unless the content explicitly needs it.
- `overlay` slots must make pointer behavior explicit so overlays do not block document scrolling, selection, or source-link interaction accidentally.
- App shell sidebars such as `DocsSidebar` and design-system `Sidebar` are not the model for viewer rails.

Workflow shells stay outside individual viewers by default:

```txt
source field lists
JSON forms
extraction review panels
multi-format compare layouts
file-level preview shells
```

These shells compose one or more viewers with task-specific panels. They may pass document-attached chrome through `slots`, but they should not force every viewer to understand extraction, citation review, source field lists, or JSON editing. This keeps the viewer API small and keeps workflow code where the workflow lives.

## Standard Shell

The top-level standalone viewer should be boring:

1. Accept `source`.
2. Create a `ViewerResource` with `createViewerResource(source)`.
3. Pass the resource to `FormatResourceViewer`.

The resource viewer should also be boring when the format has a single loaded document state:

1. Gate client-only renderers with `useIsClient`.
2. Render the format fallback during SSR and Suspense loading, or delegate to explicit loading state for progressive formats.
3. Wrap loaded content in `ViewerErrorBoundary`.
4. Use `resource.keys.resource` or a format-specific reset key.
5. Clear or evict format caches on retry.
6. Mount `FormatViewerContent`.

This pattern is already clear in PDF, image, PPTX, text, DOCX, and XLSX. It should be made consistent and shared where it reduces duplication. CSV should keep progressive state rather than pretending every load is a single Suspense resource.

## FileViewer Standard

`FileViewer` should remain a router/adaptor layer:

1. Resolve `ViewerDescriptor` through `createViewerResource(source, as)`.
2. Build a descriptor reset key.
3. Render a descriptor-aware fallback.
4. Route by category and source kind.
5. Lazy-load heavyweight standalone viewers.
6. Route Markdown and prose through the Text Viewer, code-like text through the
   Code Viewer, and file-level preview adapters for HTML and CSV.
7. Use standalone `ResourceViewer` components for PDF, DOCX, image, PPTX, and XLSX when possible.

The file-specific preview components are not substitutes for standalone viewers:

- `text-viewer.tsx` owns prose text and Markdown documents.
- `code-viewer.tsx` owns preformatted text such as code, JSON, and logs; syntax highlighting is optional.
- `file-viewer-html-viewer.tsx` renders sandboxed HTML in an iframe.
- `file-viewer-csv-viewer.tsx` adapts the standalone CSV grid into file chrome.

The standard for `FileViewer` is not the standalone viewer file map. Its standard is: route cleanly, keep adapters thin, keep file chrome shared, and avoid duplicating standalone viewer internals.

## Source Adapter Standard

Current source adapter naming is inconsistent:

- `pdfAnchorToTarget`
- `imageAnchorToTarget`
- `textAnchorToTarget`
- `csvAnchorToTarget`
- `docxAnchorToTarget`
- `xlsxAnchorToTarget`

Standardize around:

```ts
formatAnchorToTarget(anchor, source?)
useFormatSourceTarget(viewerRef)
sourceToFormatHighlight(activeSource)
renderFormatSourceOverlay(activeSource)
```

Use `sourceToFormatHighlight` for prop-based highlighting, such as text ranges, CSV cells, and DOCX targets.

Use `renderFormatSourceOverlay` for overlay-based highlighting, such as PDF page boxes and image frame boxes.

Target types remain format-specific:

```ts
PdfTarget // page + normalized page area
ImageTarget // frame + normalized frame area
TextTarget // line range
CsvTarget // cell address
XlsxTarget // sheet + cell address
DocxTarget // text match or table cell index
PptxTarget // slide + normalized slide area, if PPTX gets source linking
```

## Scale And Scroll Standard

Page-like scale modules should expose the same conceptual contract:

```ts
resolvedScale
isScaleControlled
setViewerScale(scale | null)
zoomIn()
zoomOut()
fitWidth()
```

Rules:

- `scale` means controlled scale.
- `defaultScale` means initial uncontrolled scale.
- `null` means fit width.
- Scale clamps should be consistent unless a format has a documented reason.
- `NaN` should normalize to `1`.
- Fit-width should account for horizontal page/frame padding consistently.
- Text, CSV, XLSX, and file-level previews can expose zoom controls without adopting this exact controlled-scale API unless there is a real consumer need.

Scroll modules should expose:

```ts
currentItem
viewportElement
setViewportElement or viewportRef
measureScroll()
handleScroll()
scrollToTarget()
getViewportElement()
```

Rules:

- Scroll progress is always clamped to `[0, 1]`.
- The visible item marker should consistently be near 20% of the viewport height unless a format has a reason to differ.
- Scroll work should be frame-coalesced for long documents or expensive DOM reads.
- Grid viewers can expose cell scroll APIs instead of page/frame APIs, but the handle should still include `getViewportElement()`.

## Chrome Standard

Toolbar and fallback chrome should live outside the main viewer.

Each format chrome file should own:

```txt
FormatViewerFrame
FormatViewerToolbar
FormatViewerFallback
FormatToolbarSkeleton
FormatPageOrItemSkeleton
FormatHeaderAwareScrollbar, when the viewer has sticky in-document chrome over a scrollport
```

The visual grammar should be consistent:

- 40px toolbar height.
- Leading count label.
- Trailing zoom controls.
- Fit width control.
- Rotate control when supported.
- Separator before download.
- `ViewerDownloadControl` for one or more actions.
- Disabled icon placeholders in skeleton toolbars.
- Same outer frame classes for `bare` and bordered modes.
- Sticky toolbars and custom scrollbars should be implemented as viewer chrome, not as workflow-shell layout.

CSV is allowed to differ where the grid surface requires it, but the shell and toolbar vocabulary should still be recognizable.

File-level text/markdown/html previews use `ResourceDocShell` instead of standalone viewer chrome. That shell is intentionally file-oriented: filename leading label, optional metadata, preview-specific zoom actions, and original download.

## Format-Specific Notes

### PDF

Use PDF as the reference. It already has the right module boundaries:

- `pdf-viewer.tsx`
- `pdf-viewer-types.ts`
- `pdf-document-resource.ts`
- `pdf-viewer-layout.ts`
- `pdf-viewer-scale.ts`
- `pdf-viewer-scroll.ts`
- `pdf-viewer-virtualization.ts`
- `pdf-viewer-page.tsx`
- `pdf-viewer-toolbar.tsx`
- `pdf-viewer-states.tsx`
- `pdf-source.tsx`

Possible cleanup: move `PdfHighlight` out of `pdf-viewer.tsx` into source/chrome/types territory.

### PPTX

PPTX is close to the target. It should add:

- `PptxViewerHandle`
- `PptxTarget`
- `pptx-source.tsx`, if source-linked PPTX citations are supported
- `PptxViewerSlots`, replacing `header` and `aside`

It should also align `usePptxVisibleSlide` with the frame-coalesced scroll pattern used by PDF where needed.

### Image

Image is clean. It should mostly standardize naming:

- Consider `image-viewer-scroll.ts` for visible frame and imperative target scrolling.
- Consider `image-viewer-scale.ts` for scale and rotation.
- Keep `image-viewer-hooks.ts` only if it remains small and coherent.
- Move test helpers out of the public viewer file if they continue to grow.

### Text

The standalone text viewer should be split further:

```txt
text-viewer-content.tsx
text-viewer-scale.ts
text-viewer-scroll.ts
text-viewer-virtualization.ts
text-viewer-line.tsx
```

The top-level viewer should not own row virtualization and line rendering directly. It should compose a loaded content module the way image and PDF do.

Do not grow a separate file-level text viewer. Text routing should stay binary:

- Standalone `TextViewer`: prose text.
- Standalone `CodeViewer`: code, JSON, logs, and other preformatted text.

### CSV

CSV should keep progressive loading. Do not force it into full Suspense just to match page viewers.

It should still be split:

```txt
csv-viewer.tsx            facade and high-level prop bridge
csv-viewer-content.tsx
csv-viewer-shell.tsx
csv-viewer-error.tsx
csv-viewer-handle.ts
csv-viewer-resource.ts
csv-viewer-state.ts
csv-viewer-grid.tsx
```

The top-level architecture can match the others without changing the loading model: facade, content, chrome, resource state, grid, handle. `ViewerErrorState` inside the grid is acceptable for progressive parsing errors.

### XLSX

XLSX should be added to the standardization plan.

It already has:

- `XlsxViewer`
- `XlsxResourceViewer`
- `ViewerErrorBoundary`
- Suspense around workbook/session load
- `XlsxViewerHandle`
- `xlsx-source.tsx`

It should be split further:

```txt
xlsx-viewer.tsx             facade + resource viewer shell
xlsx-viewer-types.ts        props, handle, cell target, slots
xlsx-viewer-resource.ts     source cache, worker parse, cache reset
xlsx-viewer-core.ts         sheet index normalization, clamp, reset keys
xlsx-viewer-session.tsx     loaded workbook/session composition
xlsx-viewer-scale.ts        grid zoom state
xlsx-viewer-scroll.ts       existing scroll target resolution
xlsx-viewer-chrome.tsx      toolbar, fallback, tabs skeleton/frame
xlsx-source.tsx             source adapter only
```

The active sheet, pending scroll target, sheet tabs, CSV export action, and source reporting logic should not all live in `xlsx-viewer.tsx`.

### DOCX

DOCX should be brought to the standard first.

Proposed split:

```txt
docx-viewer.tsx              facade + resource viewer shell
docx-viewer-types.ts         props, handle, target, slots
docx-document-resource.ts      existing byte promise cache
docx-viewer-core.ts          constants, render options, scale clamps, target keys
docx-viewer-render.ts        lazy import, renderAsync, page tagging, page measurements
docx-viewer-scale.ts         container width, fit width, controlled/default scale
docx-viewer-scroll.ts        current page, progress, scrollToTarget
docx-viewer-targets.ts       text/table DOM range resolution and document index
docx-viewer-highlight.ts     CSS Custom Highlight API integration
docx-viewer-chrome.tsx       toolbar, fallback, skeletons, frame
docx-source.tsx              source adapter only
```

The most meaningful performance improvement would be to build a per-render DOCX target index after `docx-preview` finishes:

- normalized visible text stream
- character-to-DOM-position map
- table index to cell map

Then highlight and imperative scroll can share target resolution instead of walking the DOM independently.

## Refactor Order

1. Extract shared `useIsClient`.
2. Split DOCX into types, chrome, scale, scroll, render, targets, highlight, and shell modules.
3. Add `defaultScale`, `onScaleChange`, and full document-attached `slots` to DOCX.
4. Keep source/extraction panels outside DOCX as workflow shells, passing only document-attached chrome through `slots`.
5. Align DOCX source adapter names with the source adapter standard.
6. Add XLSX to the plan: split resource/session/chrome/types/scale while keeping the current behavior.
7. Split standalone Text into content, scale, scroll, virtualization, and line modules.
8. Split CSV top-level orchestration from grid/resource state while preserving progressive streaming.
9. Keep `FileViewer` as a route/adaptor layer and thin any adapters that duplicate standalone viewer behavior.
10. Add PPTX handle/source adapter if PPTX is expected to support source-linked citations.
11. Normalize toolbar skeletons and icon button helpers, but avoid a generic toolbar abstraction until duplication is clearly harmful.

## Architectural Rule

The standard is not "all viewers share the same implementation." The standard is:

- Same lifecycle shell.
- Same naming grammar.
- Same prop vocabulary.
- Same source adapter pattern.
- Same document-attached slot contract where the format has a document surface.
- Same scale and scroll semantics where the underlying format matches.
- Same separation between viewer chrome, document slots, workflow shells, and app shell navigation.
- Format-specific rendering kept explicit.
- Separate standalone viewer and file-preview adapter layers.

That gives the repo simplicity without false abstraction.

## Confidence

This is the amended design after reviewing `FileViewer`, XLSX, segmented document views, app shell navigation, sidebar/header primitives, and file-specific text/markdown/html previews.

- High confidence: consistent module grammar is the right standard.
- High confidence: DOCX should be split first.
- High confidence: PDF should remain the reference standalone viewer.
- High confidence: XLSX belongs in the standardization plan.
- High confidence: viewer chrome, document-attached slots, workflow shells, and app shell navigation should stay separate.
- Medium-high confidence: `slots` should replace `header` and `aside` for page/document viewers.
- Medium confidence: CSV should adopt more shell vocabulary while keeping progressive state.
- Full confidence: `FileViewer` should remain a router/adaptor layer, not be collapsed into standalone viewer internals.

The design should be validated by refactoring DOCX first. If the proposed boundaries stay small and tests remain focused, the standard is strong. If the split creates noisy glue modules, revise the grammar before applying it to XLSX, Text, or CSV.
