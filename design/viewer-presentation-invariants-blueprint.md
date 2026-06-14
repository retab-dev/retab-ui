# Viewer Presentation Invariants Blueprint

## Objective

Define the final architecture for viewer presentation state so layout chrome
cannot accidentally change a user's document position.

The concrete bug this addresses:

```txt
Toggling an inline email attachment sidebar widens the PDF surface.
The PDF is in fit-width mode.
The measured width changes from sidebar-open width to full width.
The PDF scale jumps from about 51% to about 102%.
The raw scrollTop is preserved.
The same scrollTop now maps to a different page.
```

The architectural goal:

```txt
Viewer chrome may change available space.
Document presentation may react to available space.
Document location must remain semantic.
```

## Current Smell

The current composition has reasonable local pieces:

- `ViewerRoot` owns sidebar visibility.
- `ViewerSidebar` changes inline layout with a negative margin when collapsed.
- `ViewerSurface` receives the freed width.
- `PdfViewer` defaults to fit-width when no explicit scale is requested.
- `PdfViewer` stores scroll as native viewport pixels.

The smell appears at the boundary between those pieces:

```txt
layout chrome state -> measured width -> scale -> page layout -> scroll meaning
```

This means a chrome action mutates document semantics indirectly. The user did
not ask to zoom, and did not ask to navigate, but both can happen because
`scrollTop` is treated as the durable position.

Raw pixels are not a durable document position. They are an implementation
detail of one layout at one scale.

## Final Judgment

Every scrollable document renderer should have a presentation model with two
separate concerns:

```txt
scale model
position anchor
```

The scale model decides how large pages are.

The position anchor decides what document location remains visible when scale,
rotation, surface size, loaded page metrics, or virtualization windows change.

The final invariant:

```txt
If the rendered layout changes without an explicit navigation command, preserve
the semantic anchor under the reading marker.
```

For paginated formats, the semantic anchor is:

```ts
type PageAnchor = {
  pageNumber: number
  yPercent: number
  xPercent?: number
}
```

For non-paginated virtual text/code formats, the semantic anchor is:

```ts
type LinearAnchor = {
  itemIndex: number
  offsetPx: number
}
```

For grids, the semantic anchor is:

```ts
type GridAnchor = {
  rowIndex: number
  columnIndex: number
  rowOffsetPx?: number
  columnOffsetPx?: number
}
```

Do not preserve raw `scrollTop` as the primary state across layout mutations.

## Presentation State Ownership

Presentation belongs to the renderer, not to `ViewerRoot`.

`ViewerRoot` should continue to own spatial shell state:

```txt
sidebar open
sidebar mode
sidebar side
registered sidebar width
root measurement
```

`PdfViewer` should own PDF presentation state:

```txt
scale mode
resolved scale
rotation
current page
scroll anchor
virtualization window
```

`EmailViewer` should own MIME selection and attachment projection, but should
not know how PDF scroll anchoring works.

The dependency direction stays:

```txt
EmailViewer
  -> ViewerRoot / ViewerSidebar / ViewerSurface
  -> FileViewer
  -> PdfViewer
  -> PDF presentation model
```

No parent compound viewer should reach into leaf renderer DOM to repair scroll.

## Scale Model

Use an explicit scale mode instead of overloading `scale?: number`.

Final shape:

```ts
type ViewerScaleMode = "fit-width" | "fixed"

type ViewerScaleState = {
  mode: ViewerScaleMode
  scale: number | null
}
```

Rules:

- `fit-width` means width changes may change `resolvedScale`.
- `fixed` means width changes do not change `resolvedScale`.
- Manual zoom enters `fixed`.
- Fit-width command enters `fit-width`.
- A renderer may default to `fit-width`, but it must preserve the semantic
  anchor when fit-width recomputes.

This keeps the desirable behavior of responsive fit-width while removing the
bad coupling between fit-width and raw scroll pixels.

## Anchor Model

Each renderer owns a reading marker. For PDF, the existing current-page marker
is already close:

```txt
markerOffset = scrollTop + viewportHeight * 0.2
```

The missing step is to convert that marker from pixels into a durable anchor
before layout changes:

```ts
type PdfReadingAnchor = {
  pageNumber: number
  yPercent: number
  xPercent: number
}
```

Before a scale, rotation, page-metric, or container-width change:

```txt
old layout + viewport scroll -> anchor
```

After the new layout is committed:

```txt
anchor + new layout -> viewport scroll
```

The marker should land at the same viewport marker ratio after restoration.
For PDF, keep the existing 20% vertical reading marker:

```txt
newScrollTop =
  newPageTop + newPageHeight * yPercent - viewportHeight * 0.2
```

Clamp to the new scroll range.

## Resize Policy

Width changes fall into two classes.

### Chrome Resize

Examples:

- sidebar opened;
- sidebar closed;
- splitter dragged;
- right panel mounted;
- surrounding container changed because a parent layout changed.

Policy:

```txt
Recompute fit-width scale if the scale mode is fit-width.
Preserve the semantic anchor.
Do not reset to page 1.
Do not preserve raw scrollTop.
```

### Document Reset

Examples:

- new source;
- new PDF document object;
- selected email part changed from one file to another;
- selected file-system node changed.

Policy:

```txt
Reset presentation to the document default.
Start at page 1 unless an explicit initial target is provided.
Reset uncontrolled manual zoom according to the renderer's default scale mode.
```

The reset key should distinguish document identity from layout identity.
Container width must never be part of the document reset key.

## API Direction

Keep the public API small.

For PDF:

```ts
type PdfViewerProps = {
  scale?: number
  scaleMode?: "fit-width" | "fixed"
  defaultScale?: number
  defaultScaleMode?: "fit-width" | "fixed"
  onScaleChange?: (state: ViewerScaleState) => void
  initialAnchor?: PdfReadingAnchor
  onVisiblePageChange?: (pageNumber: number) => void
}
```

Final simplification target:

```ts
scale?: number
```

should not carry two meanings. A number means fixed scale. Fit-width is a mode.

Avoid adding sidebar-specific props to PDF:

```txt
preserveScrollOnSidebarToggle
ignoreSidebarWidth
sidebarAwareFitWidth
```

Those names encode the symptom, not the invariant.

## Internal Hook Shape

Split PDF presentation into focused hooks.

```ts
usePdfScaleState({
  controlledState,
  defaultState,
  containerWidth,
  pageWidth,
  resetKey,
})

usePdfReadingAnchor({
  layout,
  viewportElement,
  markerRatio,
})

usePdfScrollRestoration({
  layout,
  viewportElement,
  anchor,
  markerRatio,
  layoutVersion,
})
```

The responsibilities must not blur:

- scale hook computes `resolvedScale`;
- anchor hook captures and reports semantic location;
- restoration hook writes scroll after layout changes;
- virtualization reads layout and viewport, but does not define durable
  position.

## Lifecycle

For a PDF width change while in fit-width mode:

```txt
1. ResizeObserver reports new fit-width measurement.
2. Before committing the new layout, capture the current reading anchor from
   the old layout and current viewport.
3. Compute the new resolved scale.
4. Build the new page layout.
5. Restore scroll from the captured anchor in a layout effect.
6. Measure visible page and virtualization window from the restored viewport.
```

For a manual zoom command:

```txt
1. Capture current reading anchor.
2. Set scale mode to fixed with the requested scale.
3. Build new page layout.
4. Restore the captured anchor.
```

For a fit-width command:

```txt
1. Capture current reading anchor.
2. Set scale mode to fit-width.
3. Compute scale from measured width.
4. Build new page layout.
5. Restore the captured anchor.
```

For a document switch:

```txt
1. Replace document reset key.
2. Clear captured anchor unless an explicit initial anchor exists.
3. Reset viewport to document start.
4. Measure current page from the reset viewport.
```

## ViewerRoot Policy

Do not make `ViewerRoot` responsible for renderer scroll preservation.

`ViewerRoot` may expose spatial state through context:

```ts
type ViewerLayoutState = {
  sidebarOpen: boolean
  sidebarMode: "inline" | "overlay"
  surfaceSize: { width: number; height: number } | null
}
```

But renderers should not require sidebar events to preserve position. They only
need to react correctly to their own measured viewport/container size.

The invariant should hold for any resize source, not just sidebar toggles.

## Email Viewer Policy

For email attachments, the sidebar can remain inline if that is the desired
desktop product behavior.

The architecture should not require making the email sidebar overlay-only to
avoid PDF jumps. Overlay-only is a valid product choice, but it is not the
fundamental fix.

The fundamental fix is:

```txt
File-like attachments rendered inside EmailViewer preserve semantic position
across EmailViewer layout changes.
```

This applies to:

- PDF page anchors;
- DOCX page anchors;
- PPTX slide anchors;
- image frame anchors;
- CSV/XLSX grid anchors;
- text/code line anchors.

## Tests

Add tests around invariants, not implementation details.

PDF tests:

- fit-width width increase preserves page and approximate intra-page position;
- fit-width width decrease preserves page and approximate intra-page position;
- manual zoom preserves page and approximate intra-page position;
- fit-width command preserves page and approximate intra-page position;
- document switch resets to page 1;
- rotation preserves anchor using the rotated layout axis;
- virtualization still renders the restored page after scale changes.

Email composition tests:

- selecting a PDF attachment, scrolling to page 3, and toggling the sidebar
  keeps page 3 visible;
- toolbar zoom percentage may change in fit-width mode, but current page does
  not jump because of sidebar collapse;
- selecting a different attachment resets the new renderer according to its
  document reset policy.

Regression assertion:

```txt
Sidebar toggle is layout state. It must not be observable as unintended document
navigation.
```

## Migration Plan

1. Introduce internal PDF anchor capture and restoration without changing public
   props.
2. Convert uncontrolled `scale?: number` semantics internally into explicit
   scale state.
3. Add invariant tests for width-driven fit-width changes.
4. Update PDF toolbar actions to preserve anchor across zoom and fit commands.
5. Apply the same anchor pattern to DOCX, PPTX, image, text/code, CSV, and XLSX
   renderers where layout changes currently reinterpret raw scroll.
6. Only after PDF behavior is stable, consider public API cleanup for
   `scaleMode` and controlled presentation state.

## Non-Goals

Do not solve this by freezing PDF width when the sidebar toggles.

Do not solve this by making all sidebars overlays.

Do not add sidebar-specific hooks inside `PdfViewer`.

Do not make `EmailViewer` own PDF scroll state.

Do not preserve raw scroll pixels across scale changes and call it stable.

Do not add compatibility adapters for old presentation paths. Make one final
path and update call sites.

## Success Criteria

The architecture is correct when these statements are true:

```txt
Closing an inline sidebar may change fit-width zoom.
Closing an inline sidebar does not change the user's reading location.
Manual zoom does not change the user's reading location.
Fit-width does not change the user's reading location.
Document switches reset intentionally.
Parent compound viewers do not know renderer scroll internals.
Renderer presentation state is semantic, not DOM-pixel based.
```

