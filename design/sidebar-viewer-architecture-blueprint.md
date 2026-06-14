# Sidebar Viewer Architecture Blueprint

## Objective

Tighten the sidebar architecture without replacing the existing viewer system.

The target architecture keeps the current viewer grammar:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

`ViewerSidebar` is body-scoped viewer layout. It may dominate the body, but it
does not dominate the header.

## Decisions

### Keep ViewerSidebar As The Spatial Primitive

`ViewerSidebar` remains the only viewer-local spatial sidebar. It owns
placement, width, collapse, overlay/inline projection, and registration with
`ViewerRoot`.

Do not introduce public `ViewerLeftSidebar`, `ViewerRightSidebar`, or
`ViewerSidebarProvider`.

### Keep Container Measurement

`ViewerRoot` keeps private `ResizeObserver` measurement for `sidebarMode="auto"`.
Viewport media queries are wrong for embedded viewers because the viewer can be
narrower than the viewport.

The accepted contract is:

- unknown width starts in `overlay`;
- zero-width measurements are ignored;
- measured auto mode uses the inline breakpoint;
- hysteresis prevents mode thrash near the breakpoint;
- callers can still force `sidebarMode="inline"` or `sidebarMode="overlay"`.

### Make Hierarchy Semantics Explicit

Generic JSX order remains the source of layout truth, but important viewer
regions should expose stable semantic data attributes:

- `data-viewer-role="primary-document"` for the primary renderer surface;
- `data-viewer-purpose="navigation"` for rails/thumbnails/outlines;
- `data-viewer-purpose="inspector"` for field/OCR/detail panels;
- `data-viewer-purpose="parts"` for MIME/file-part navigation.

Thin helpers may encode common semantics:

```tsx
<ViewerNavigationSidebar />
<ViewerInspectorSidebar />
<ViewerDocumentSurface />
```

These helpers are wrappers over the existing primitives, not a slot API.

### Separate Providerless Sidebar Lists

Domain sidebars that only need grouped rows should not mount a full
`SidebarProvider`. Introduce `SidebarList*` primitives for providerless list
composition.

`SidebarProvider` remains the app/navigation sidebar system. `SidebarList*`
owns row grammar. Domain sidebars own domain state.

## Implementation Plan

1. Add `viewerRole` and `viewerPurpose` props to `ViewerSidebar` and
   `ViewerSurface`.
2. Add `ViewerNavigationSidebar`, `ViewerInspectorSidebar`, and
   `ViewerDocumentSurface`.
3. Project `useViewerSidebar()` and `useOptionalViewerSidebar()` to public
   fields so private registration methods do not leak at runtime.
4. Add providerless `SidebarList*` primitives.
5. Migrate `SegmentSidebar` and `AttachmentSidebar` to `SidebarList*`.
6. Add tests for semantic viewer attributes, providerless list rendering, and
   the absence of embedded sidebar wrappers inside domain sidebars.
7. Leave larger docs route changes for a separate registry migration.

## Follow-Up Migration

The PDF thumbnail naming has been cut over to `PdfViewerThumbnails`; keep it
PDF-owned and do not reintroduce a sidebar-named alias.

The docs route currently named `sidebar.mdx` documents `SegmentSidebar`. A later
docs migration should either rename that route to `segment-sidebar` or replace
the route with a primitive sidebar boundary doc.
