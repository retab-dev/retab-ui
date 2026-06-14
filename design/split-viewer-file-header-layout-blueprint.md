# Split Viewer File Header Layout Blueprint

## Verdict

The split viewer migration to viewer primitives is structurally close, but the
chrome boundary is wrong.

The split result chrome currently replaces the file chrome. That is why the
block shows `6 segments` and `22 pages` in the top header instead of the normal
PDF header with filename, page indication, zoom controls, fit, rotate, and
download.

The target is:

```txt
Split domain state wraps the composition.
The visible file document still owns normal file chrome.
Split-specific controls sit around that document, not instead of it.
```

## Current Shape

The active split easy API renders:

```tsx
<SplitViewerProvider result={result}>
  <ViewerRoot>
    <SplitViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <SplitViewerPageRail />
      </ViewerSidebar>
      <ViewerSurface>
        <SplitViewerDocument>{children}</SplitViewerDocument>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

The block child renders:

```tsx
<PdfViewerProvider source={source}>
  <PdfViewerPages bare />
</PdfViewerProvider>
```

That composition has two problems:

- `SplitViewerHeader` becomes the only top header, so split metadata occupies
  the file header slot.
- `PdfViewerPages` has no sibling `PdfViewerHeader`, so the document cannot
  expose page count, zoom controls, fit width, rotate, or download.

The docs also encode this drift by saying `SplitViewerHeader` owns the result
summary and legend. That makes the wrong boundary look intentional.

## Target Shape

The split viewer should be composed as a split result surface containing a
normal file viewer surface.

The target visual hierarchy is:

```txt
viewer root
  body
    split page rail
    document column
      pdf file header
        filename
        page N of M
        zoom controls
        fit / rotate / download
      split legend strip
        segment labels across the full document width
      pdf pages
```

The important detail is that the document column owns the file header. The
segment legend is a secondary row under the file header and spans the document
column width. The left split rail remains split navigation.

This preserves the old behavior:

- left rail describes the page-to-segment map;
- right side is still a normal PDF viewer;
- the split legend is visible across the document panel;
- file controls remain in the same place users expect from every other PDF
  viewer.

## Public API Direction

Keep the existing domain parts, but adjust their responsibility.

`SplitViewerProvider`

- Owns normalized split result state.
- Owns current page and scroll progress coordination.
- Owns imperative page navigation through the document handle.
- Does not own file chrome placement.

`SplitViewerPageRail`

- Remains the vertical segment rail.
- Uses the split provider state.
- Scrolls the document through `controller.navigation.scrollToPage`.

`SplitViewerLegend`

- Remains the segment legend.
- Should be rendered as document-column chrome, below the file header.
- Should not live inside a top-level `ViewerHeader` that replaces file chrome.

`SplitViewerDocument`

- Remains the empty/loading/document frame.
- Should wrap document-column composition.
- Should not hide a second viewer root in a way that makes the layout unclear.

`SplitViewerHeader`

- Either remove it from the easy API, or narrow it to a local legend/result part
  that is not used as the file header.
- Do not use it as the primary header when a file document is visible.

## Block Composition

The split block should explicitly compose the PDF header and pages:

```tsx
function SplitViewerPdfDocument() {
  const controls = useSplitViewerDocumentControls()

  return (
    <PdfViewerProvider source={source}>
      <div className="flex min-h-0 flex-1 flex-col">
        <PdfViewerHeader />
        <SplitViewerLegend />
        <PdfViewerPages
          ref={controls.setViewerHandle}
          bare
          onVisiblePageChange={controls.onCurrentPageChange}
          onScrollProgressChange={controls.onScrollProgressChange}
          className="h-full"
        />
      </div>
    </PdfViewerProvider>
  )
}
```

The surrounding split structure should become:

```tsx
<SplitViewerProvider result={result}>
  <ViewerRoot bare>
    <ViewerBody>
      <ViewerSidebar>
        <SplitViewerPageRail />
      </ViewerSidebar>
      <ViewerSurface>
        <SplitViewerDocument>
          <SplitViewerPdfDocument />
        </SplitViewerDocument>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

This keeps the JSX hierarchy readable and avoids a hidden render prop or slot
object. The file viewer remains decomposed only because the split legend must
sit between the file header and the pages.

## Sidebar And Legend Rule

The split rail and the split legend are different surfaces.

The rail is vertical navigation and may stay narrow.

The legend is document-column chrome and should span the full available width
of the right-side document column. It should not be constrained to the rail
width and should not be visually promoted above the file header.

In screenshot terms:

- the normal PDF header row is restored where the current `6 segments` row is;
- the segment legend sits below that header and spans the right panel;
- the left rail remains beside the PDF body and drives scroll/page selection.

## Partition Viewer Comparison

Partition is closer to the desired primitive migration because its top chrome
is domain output chrome: legend plus waterfall ribbon. It is not trying to
present a normal file header for the source document in the same row.

Split is different because users need the full file viewer controls while
inspecting segments. For split, the file header is not optional chrome; it is
part of the primary document interaction.

Do not force partition and split to share the same top header shape. They are
different domain compositions over the same primitive grammar.

## Implementation Steps

1. Change the split easy API so it no longer renders `SplitViewerHeader` above
   the whole viewer when a document child is expected.
2. Keep `SplitViewerBody` or replace it with explicit body composition that
   renders `ViewerSidebar`, `SplitViewerPageRail`, `ViewerSurface`, and
   `SplitViewerDocument`.
3. Update `SplitViewerPdfDocument` in the registry block to render
   `PdfViewerHeader`, `SplitViewerLegend`, and `PdfViewerPages` under one
   `PdfViewerProvider`.
4. Mirror the same composition in `SplitViewerDemo`.
5. Update `content/docs/components/split-viewer.mdx` so the documented
   composition teaches the restored boundary.
6. Update architecture tests that currently expect `SplitViewerHeader` in the
   easy API.
7. Add a behavioral/render test that asserts the split block composition
   contains a PDF header and a split legend in the document column.

## Tests

Required tests:

- `SplitViewer` still renders one viewer root and a split page rail when output
  exists.
- Clicking a legend segment still calls `scrollToPage` on the PDF handle.
- The split document composition contains `PdfViewerHeader` before
  `PdfViewerPages`.
- The normal PDF controls are reachable through the header once the pages have
  registered header controls.
- The split legend remains visible and uses current page state.

Useful file-level architecture checks:

- `registry/new-york-v4/blocks/split-viewer-block.tsx` should contain
  `PdfViewerProvider`, `PdfViewerHeader`, `SplitViewerLegend`, and
  `PdfViewerPages` in that order.
- `components/viewers/split/split-viewer.tsx` should not require
  `SplitViewerHeader` in the easy API path.

## Non-Goals

- Do not add a new generic viewer primitive.
- Do not add a compatibility adapter or slot API.
- Do not reimplement PDF toolbar controls in split.
- Do not make partition copy the split layout unless a separate partition
  requirement proves it needs normal file chrome in the same way.
- Do not edit `retab_react/`.

## Acceptance Criteria

The split viewer is correct when:

- the top document chrome is visually indistinguishable from the normal PDF
  viewer header;
- page indication and zoom controls are present;
- the split legend spans the right-side document column below the file header;
- the left split rail remains usable for page navigation;
- current page state keeps rail, legend, and PDF pages synchronized;
- docs and tests describe this as the canonical split composition.
