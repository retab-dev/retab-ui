# Sidebar Domain Composition Design

## Purpose

This document defines how the codebase should compose the generic `Sidebar`
primitive with domain-specific viewer sidebars such as segment navigation,
attachment navigation, and PDF page thumbnails.

The design goal is to keep the primitive exact: `Sidebar` should provide a
consistent visual and interaction grammar without becoming aware of files,
segments, pages, confidence scores, thumbnails, or document scroll state.

## Core Insight

The right hierarchy is:

```txt
Sidebar primitives
  -> SidebarList primitives
  -> SegmentSidebar
  -> AttachmentSidebar
  -> PdfViewerThumbnails
```

These are siblings, not aliases for one another.

`Sidebar` is the primitive family. It owns container structure, groups, labels,
menu rows, active state styling, disabled state styling, focus behavior, and
sidebar tokens.

Domain sidebars own domain models. They may compose `SidebarList` primitives
for grouped rows, but they should not push domain-specific props or behavior
into `Sidebar`.

## Design Principles

### 1. Primitive Owns Grammar, Not Meaning

`Sidebar` should own:

- side, width, border, background, and foreground tokens;
- header/content/group/menu structure;
- active, disabled, hover, focus, and keyboard-visible row states;
- shared data slots for styling and tests;
- app-shell behavior only when explicitly used as an app shell.

`Sidebar` should not own:

- `ViewerSource`;
- attachment labels or file sizes;
- segment labels, page ranges, or confidence values;
- PDF page numbers or thumbnail virtualization;
- viewer selection state;
- document navigation commands.

This keeps the primitive small and prevents `Sidebar` from accumulating
domain-specific variants such as `mode="segments"` or `variant="attachments"`.

### 2. Domain Sidebars Own Their Model

Each domain sidebar should expose the smallest API that fully describes its own
model.

`SegmentSidebar` owns:

- normalized segment rows;
- page ranges;
- confidence display;
- current-page and preview highlighting;
- segment hover, focus, and activation commands.

`AttachmentSidebar` owns:

- attachment rows;
- file names, descriptions, sizes, and disabled state;
- thumbnails through `FileThumbnail`;
- selected attachment id;
- empty attachment state;
- optional caller-provided domain groups before the attachment list.

`PdfViewerThumbnails` owns:

- PDF document loading for thumbnails;
- page-size measurement;
- virtualized thumbnail rows;
- active-page following;
- page keyboard shortcuts.

### 3. Reuse Structure Only Where It Fits

Domain sidebars should use providerless `SidebarList` primitives structurally
when their UI is a normal grouped row list.

That means:

- `SegmentSidebar` should use `SidebarListContent`, `SidebarListGroup`,
  `SidebarListMenu`, and `SidebarListButton`;
- `AttachmentSidebar` should use `SidebarListHeader`, `SidebarListContent`,
  `SidebarListGroup`, `SidebarListMenu`, and `SidebarListButton`;
- `PdfViewerThumbnails` should not force its virtualized rail into
  `SidebarListButton`.

`PdfViewerThumbnails` should still align visually with the sidebar system by
using sidebar tokens for background, border, foreground, and inactive rings.
Its behavior remains PDF-specific.

## Proposed Component Architecture

### Primitive Layer

The primitive layer remains generic:

```txt
SidebarProvider
Sidebar
SidebarHeader
SidebarContent
SidebarGroup
SidebarGroupLabel
SidebarGroupContent
SidebarMenu
SidebarMenuItem
SidebarMenuButton
SidebarMenuBadge
SidebarSeparator
```

The primitive API should stay free of domain terms. If an option cannot be
explained without mentioning files, pages, segments, PDFs, emails, runs, or
schemas, it does not belong on `Sidebar`.

### Sidebar List Layer

`SidebarProvider` can carry app-shell assumptions: persistence, viewport-level
behavior, mobile sheet behavior, and global shortcut semantics. Domain viewer
sidebars need grouped row grammar, but not the app shell.

The implemented providerless pattern is:

```tsx
<SidebarListRoot width="18rem">
  <SidebarListContent>
    <SidebarListGroup>...</SidebarListGroup>
  </SidebarListContent>
</SidebarListRoot>
```

`SidebarList` primitives provide the row and group grammar directly:

- no cookie persistence;
- no global keyboard shortcut;
- no app-wide mobile sheet ownership;
- width scoped to the containing viewer;
- no `SidebarProvider` dependency.

When a domain sidebar is mounted inside `ViewerSidebar`, the ownership boundary
is deliberate: `ViewerSidebar` owns viewer placement, width, collapse, and the
rail's accessible label; the domain sidebar owns its row model and row
interactions. `SegmentSidebar` inside `ViewerSidebar` is therefore a nested
composition, not two independent sidebars competing for layout.

### Domain Sidebar Layer

#### `AttachmentSidebar`

`AttachmentSidebar` should be the reusable file-attachment navigator for
compound viewers.

Proposed contract:

```ts
interface AttachmentSidebarItem {
  id: string
  source: ViewerSource
  label?: string
  description?: string
  size?: number | null
  isDisabled?: boolean
}

interface AttachmentSidebarProps {
  items: readonly AttachmentSidebarItem[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  header?: React.ReactNode
  emptyLabel?: React.ReactNode
  children?: React.ReactNode
  side?: "left" | "right"
  width?: string
  className?: string
}
```

Rules:

- `items` are file-like attachments, not email attachments.
- `source` is the only required file-rendering input.
- labels and descriptions override resource-derived metadata.
- `children` render before the attachment group for domain-specific rows such
  as "Message body".
- selection is controlled by the caller.
- row rendering is owned by `AttachmentSidebar`.
- preview rendering is not owned by `AttachmentSidebar`.

#### `SegmentSidebar`

`SegmentSidebar` should remain a domain component for document-analysis segment
navigation.

It should structurally reuse sidebar primitives because it is a grouped row list.

Rules:

- keep segment interaction state outside `Sidebar`;
- keep page range and confidence formatting inside `SegmentSidebar`;
- use `SidebarListButton` for row active/focus behavior;
- expose segment callbacks, not generic sidebar callbacks;
- do not make `Sidebar` understand page ownership or confidence.

#### `PdfViewerThumbnails`

`PdfViewerThumbnails` should remain domain-specific and should not become a
`SidebarMenu` list.

Rules:

- preserve virtualized absolute-positioned rows;
- preserve active-page follow behavior;
- preserve page keyboard shortcuts;
- use sidebar visual tokens for alignment;
- avoid sharing row primitives that fight the rail's geometry.

## Compound Viewer Composition

Compound viewers orchestrate multiple sources and sidebars. They should keep
viewer placement on `ViewerSidebar` and keep domain row meaning in the viewer or
domain sidebar that owns the model.

For email, MIME parts are currently email-owned rail content:

```tsx
<ViewerSidebar aria-label="Email parts">
  <EmailViewerPartsList />
</ViewerSidebar>
<ViewerSurface>
  <FileViewer source={selectedSource} />
</ViewerSurface>
```

`EmailViewer` owns:

- message metadata;
- HTML body versus text fallback;
- CID rewriting for inline attachments;
- inline versus regular attachment classification;
- selected body/attachment state.

`EmailViewer` does not own:

- thumbnail rendering;
- file preview routing;
- HTML iframe isolation.

This makes email a composition test rather than a one-off viewer. If a second
viewer needs the same file-attachment row contract, `AttachmentSidebar` is the
reusable sibling to reach for; it is not a hidden dependency of `EmailViewer`.

## Accessibility Requirements

Attachment rows must expose concise accessible names.

The intended row name is:

```txt
{file name} {size or type}
```

Rich thumbnails inside the row should not pollute the button name with table
cells, spreadsheet content, page text, or image fallback text.

Implemented API:

```tsx
<FileThumbnail source={source} presentation="decorative" />
```

`AttachmentSidebar` uses this mode for row thumbnails, so the row remains
accessible as an attachment command instead of a flattened dump of thumbnail
internals.

## Viewer Surface Implication

The sidebar work also exposes a broader viewer-composition boundary.

`ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSidebar`, and
`ViewerSurface` are the shared spatial primitives. Leaf viewers such as
`PdfViewer` stay complete renderers, and compound viewers choose one of two
explicit shapes:

- compose PDF internals with `PdfViewerProvider`, `PdfViewerHeader`,
  `PdfViewerThumbnails`, and `PdfViewerPages` when they need to own PDF chrome;
- render a complete `PdfViewer bare` inside `ViewerSurface` when the PDF
  is just the document pane controlled through a ref and callbacks.

The second shape appears in demos and workflow viewers by design. The
surrounding `ViewerRoot` owns workflow chrome and sidebars; the nested
`PdfViewer bare` owns PDF loading, rendering, toolbar behavior, error handling,
and its imperative handle without adding another visible viewer frame.

## Migration Plan

### Phase 1: Establish Domain Sidebar Hierarchy

- Keep `Sidebar` primitive-only.
- Implement `AttachmentSidebar`.
- Keep email MIME parts on `ViewerSidebar` unless a shared attachment navigator
  is needed by multiple viewers.
- Make `SegmentSidebar` consume sidebar primitives internally.
- Align `PdfViewerThumbnails` visually with sidebar tokens without changing its
  virtualization model.

### Phase 2: Clarify Providerless Sidebar Lists

- Keep `SidebarListRoot` as the container-scoped root for domain sidebars that
  reuse grouped row primitives.
- Keep app-shell assumptions out of viewer domain sidebars.
- Ensure providerless sidebars work in cards, modals, split panes, and registry
  demos.

### Phase 3: Fix Thumbnail Semantics

- Add a decorative/sidebar presentation mode to `FileThumbnail`.
- Ensure thumbnail internals do not leak into attachment row accessible names.
- Add regression tests for CSV/XLSX thumbnails inside attachment rows.

### Phase 4: Keep Viewer Primitives Explicit

- Keep shared viewer chrome on `ViewerRoot`, `ViewerHeader`, `ViewerBody`,
  `ViewerSidebar`, and `ViewerSurface`.
- Let compound viewers provide side rails through `ViewerSidebar` and document
  panes through `ViewerSurface`.
- Keep `FileViewer` as a router, not a domain orchestrator.

## Implementation Status

The implemented system now includes:

- `SidebarList` primitives for providerless domain sidebars.
- `AttachmentSidebar` as a reusable file attachment navigator.
- `SegmentSidebar` composed from providerless sidebar list primitives.
- `PdfViewerThumbnails` visually aligned through sidebar tokens while keeping
  its virtualized page rail.
- `FileThumbnail presentation="decorative"` for thumbnail-in-row semantics.
- `ViewerRoot`, `ViewerBody`, `ViewerSidebar`, and `ViewerSurface` as the
  shared compound viewer frame.
- `EmailViewer` composed from viewer primitives, `FileViewer`, and email-owned
  part navigation.
- Workflow demos that render a complete `PdfViewer bare` inside
  `ViewerSurface` when the PDF is the document pane rather than the workflow
  shell.

## Non-Goals

- Do not fold `SegmentSidebar` into `Sidebar`.
- Do not fold `AttachmentSidebar` into `Sidebar`.
- Do not make `Sidebar` aware of PDFs, files, emails, schemas, or segments.
- Do not force `PdfViewerThumbnails` into menu row primitives.
- Do not introduce slot-object viewer shells for sidebar composition.
- Do not create compatibility adapters for older sidebar APIs.
- Do not add domain variants to `Sidebar` when a domain component is the right
  owner.

## Decision

Adopt a strict primitive/domain split.

`Sidebar` remains the visual and interaction primitive. `SegmentSidebar`,
`AttachmentSidebar`, and `PdfViewerThumbnails` remain domain sidebars with their
own models. They share primitive structure only where it improves clarity and
behavior. They share visual tokens everywhere they need to feel like part of the
same system.
