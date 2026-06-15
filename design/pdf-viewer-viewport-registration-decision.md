# PDF Viewer Viewport Registration Decision

## Status

Accepted for now.

The current PDF coordination stays:

```txt
PdfViewerProvider
  stores resource, current page, viewer handle, viewport controls

PdfViewerPages / PdfResourceContent
  computes document viewport controls from the mounted document viewport

pdf-viewer-viewport.tsx
  carries same-folder viewport-control registration

PdfViewerHeader
  reads the registered controls and renders toolbar state

PdfViewerThumbnails
  reads current page, resource, and document handle
```

## Decision

Keep the registration context.

Do not replace it with a second public or semi-public viewport handle yet.

## Comparison

### Current Registration Context

```txt
PdfDocumentViewportRegistrationProvider
usePdfDocumentViewportRegistration
```

Strengths:

- keeps transport props off `PdfResourceContentProps`;
- keeps `PdfViewerHeader` separate from `PdfViewerPages`;
- supports detached headers and thumbnail sidebars;
- preserves one public imperative handle: `PdfViewerHandle`;
- keeps the mechanism same-folder and undocumented;
- requires no public API expansion.

Weaknesses:

- source-distributed users can see the internal registration file;
- the flow is still slightly indirect;
- provider state is updated by mounted page content.

### Single Viewport Handle Alternative

Possible shape:

```ts
type PdfDocumentViewportHandle = {
  currentPage: number
  pageCount: number
  scale: number
  fitWidth: () => void
  rotate: () => void
  zoomIn: () => void
  zoomOut: () => void
  scrollToPage: PdfViewerHandle["scrollToPage"]
  scrollToPageArea: PdfViewerHandle["scrollToPageArea"]
}
```

Strengths:

- the noun is easier to explain than “registration”;
- header and thumbnails could consume one viewport object.

Weaknesses:

- creates another handle beside `PdfViewerHandle`;
- does not obviously remove provider state;
- risks making document controls feel public;
- still needs lifecycle registration from mounted pages;
- does not clearly reduce code.

## Rule

Change the design only if the replacement removes a concept.

Do not change it merely because “registration context” is not a pretty noun.

## Guardrails

The current design remains acceptable only while:

- users never import `pdf-viewer-viewport`;
- docs and examples never teach `PdfDocumentViewportRegistrationProvider`;
- `PdfResourceContentProps` contains no viewport-control setter;
- `PdfViewerHandle` remains the only public PDF imperative handle;
- detached header, thumbnails, scroll, zoom, rotate, and download behavior stay
  covered by tests.

## Future Revisit Trigger

Revisit this decision only if one of these becomes true:

- a second PDF surface needs the same controls and cannot use the current
  provider;
- registration causes measurable render churn;
- a single handle can replace both registration and existing provider fields;
- the current mechanism leaks into docs or examples.
