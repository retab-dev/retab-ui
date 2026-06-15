# Viewer System Design Index

## Purpose

This index marks which viewer-system design documents are current authority and
which ones are historical notes.

Source, tests, registry output, and current public docs remain the final
authority.

## Current Authority

Read these first:

- [viewer-system-absolute-platonic-blueprint.md](./viewer-system-absolute-platonic-blueprint.md)
- [viewer-system-platonic-ideal-verdict-blueprint.md](./viewer-system-platonic-ideal-verdict-blueprint.md)
- [viewer-system-platonic-ideal-remaining-cut-blueprint.md](./viewer-system-platonic-ideal-remaining-cut-blueprint.md)
- [pdf-viewer-viewport-registration-decision.md](./pdf-viewer-viewport-registration-decision.md)
- [viewer-system-post-viewport-registration-platonic-gap-blueprint.md](./viewer-system-post-viewport-registration-platonic-gap-blueprint.md)
- [segmented-document-convergence-blueprint.md](./segmented-document-convergence-blueprint.md)
- [viewer-root-sidebar-final-blueprint.md](./viewer-root-sidebar-final-blueprint.md)

## Active Implementation Contracts

The implementation is guarded by:

```txt
tests/viewer-architecture.test.ts
tests/pdf-viewer.test.tsx
tests/edit-viewer-render.test.tsx
tests/edit-viewer-model.test.ts
tests/sources.test.tsx
tests/layout-blocks-document-ai.test.ts
```

When a design document conflicts with these tests and current source, the tests
and source win.

## Superseded Historical Notes

These files may mention removed or renamed APIs such as:

```txt
useEditViewerDocument
useEditViewerFields
PdfViewerHeaderControls
setHeaderControls
setViewportControls
ViewerShell
AnchoredDocumentProvider
```

Treat those mentions as historical unless the current authority documents and
tests still require them.

Known superseded viewer-system notes include:

- `viewer-system-current-platonic-gap-blueprint.md`
- `viewer-system-final-internal-perfection-blueprint.md`
- `viewer-system-terminal-platonic-last-mile-blueprint.md`
- `viewer-system-post-internal-perfection-platonic-gap-blueprint.md`
- `viewer-system-final-platonic-gaps-review-blueprint.md`
- `viewer-system-final-subtraction-blueprint.md`
- `viewer-system-platonic-ratchet-blueprint.md`
- `viewer-system-platonic-reading-blueprint.md`
- `pdf-viewer-header-composition-blueprint.md`
- `edit-viewer-composition-blueprint.md`
- `edit-viewer-final-platonic-proof-blueprint.md`

Do not implement from those files without checking the current authority list.

## File-System Boundary

File-system blueprints are intentionally not classified here.

The file-system implementation is outside this viewer-system pass.

Do not edit file-system code as part of viewer-system cleanup.

## Current Public Grammar

The viewer-system grammar is:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

Domain viewers compose that grammar with named parts:

```tsx
<PdfViewerProvider source={source}>
  <PdfViewerHeader />
  <PdfViewerPages />
  <PdfViewerThumbnails />
</PdfViewerProvider>
```

```tsx
<EditViewerProvider result={result}>
  <EditViewerHeader />
  <EditViewerDocument />
  <EditViewerFields />
</EditViewerProvider>
```

```tsx
<SegmentedDocumentProvider model={model}>
  <SegmentLegend />
  <SegmentPageRail />
  <PageRibbon />
</SegmentedDocumentProvider>
```

Any new viewer-system document should either update this index or explicitly
state that it is historical.
