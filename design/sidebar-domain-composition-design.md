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
  -> SegmentSidebar
  -> AttachmentSidebar
  -> PdfThumbnailSidebar
```

These are siblings, not aliases for one another.

`Sidebar` is the primitive family. It owns container structure, groups, labels,
menu rows, active state styling, disabled state styling, focus behavior, and
sidebar tokens.

Domain sidebars own domain models. They may compose `Sidebar` primitives, but
they should not push domain-specific props or behavior into `Sidebar`.

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

`PdfThumbnailSidebar` owns:

- PDF document loading for thumbnails;
- page-size measurement;
- virtualized thumbnail rows;
- active-page following;
- page keyboard shortcuts.

### 3. Reuse Structure Only Where It Fits

Domain sidebars should use `Sidebar` primitives structurally when their UI is a
normal grouped row list.

That means:

- `SegmentSidebar` should use `SidebarContent`, `SidebarGroup`, `SidebarMenu`,
  and `SidebarMenuButton`;
- `AttachmentSidebar` should use `SidebarHeader`, `SidebarContent`,
  `SidebarGroup`, `SidebarMenu`, and `SidebarMenuButton`;
- `PdfThumbnailSidebar` should not force its virtualized rail into
  `SidebarMenuButton`.

`PdfThumbnailSidebar` should still align visually with the sidebar system by
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

### Embedded Sidebar Layer

The current `SidebarProvider` carries app-shell assumptions: persistence,
viewport-level behavior, mobile sheet behavior, and global shortcut semantics.
Embedded viewer sidebars need the menu primitives but not necessarily the app
shell.

Add a documented embedded pattern, preferably as a small wrapper:

```tsx
<EmbeddedSidebarProvider width="18rem">
  <Sidebar side="right" collapsible="none">
    ...
  </Sidebar>
</EmbeddedSidebarProvider>
```

`EmbeddedSidebarProvider` should provide the same context that menu primitives
need, but with embedded defaults:

- no cookie persistence;
- no global keyboard shortcut;
- no fixed viewport positioning;
- no app-wide mobile sheet by default;
- width scoped to the containing viewer;
- collapse, if added later, scoped to the containing viewer.

If adding a new exported wrapper feels too heavy, document the current local
`SidebarProvider` pattern for embedded sidebars and make the defaults explicit.

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
  providerClassName?: string
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
- use `SidebarMenuButton` for row active/focus behavior;
- expose segment callbacks, not generic sidebar callbacks;
- do not make `Sidebar` understand page ownership or confidence.

#### `PdfThumbnailSidebar`

`PdfThumbnailSidebar` should remain domain-specific and should not become a
`SidebarMenu` list.

Rules:

- preserve virtualized absolute-positioned rows;
- preserve active-page follow behavior;
- preserve page keyboard shortcuts;
- use sidebar visual tokens for alignment;
- avoid sharing row primitives that fight the rail's geometry.

## Compound Viewer Composition

Compound viewers orchestrate multiple sources and sidebars. They should not
reimplement generic file rendering or generic attachment rows.

For email:

```tsx
<EmailViewer>
  <FileViewer source={selectedSource} />
  <AttachmentSidebar
    items={nonInlineAttachments}
    selectedId={selectedAttachmentId}
    onSelect={selectAttachment}
  >
    <EmailBodySidebarGroup />
  </AttachmentSidebar>
</EmailViewer>
```

`EmailViewer` owns:

- message metadata;
- HTML body versus text fallback;
- CID rewriting for inline attachments;
- inline versus regular attachment classification;
- selected body/attachment state.

`EmailViewer` does not own:

- attachment row layout;
- thumbnail rendering;
- file preview routing;
- HTML iframe isolation.

This makes email a composition test rather than a one-off viewer.

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

## Viewer Shell Implication

The sidebar work also exposes a broader viewer-shell gap.

`FileViewer` is a strong single-source router, but compound viewers need a
format-neutral shell around the selected source. The long-term viewer stack
should be:

```txt
ViewerSource / ViewerResource
  -> concrete renderers
  -> FileViewer router
  -> ViewerShell
  -> compound domain viewers
```

`ViewerShell` should eventually own:

- outer border, background, radius, and overflow;
- header slot;
- toolbar slot;
- left and right rail slots;
- top and bottom document-column slots;
- overlay slot;
- loading and error placement conventions.

Until that exists, compound viewers can locally compose `FileViewer` and domain
sidebars, but new viewer-specific shells should be treated as temporary.

## Migration Plan

### Phase 1: Establish Domain Sidebar Hierarchy

- Keep `Sidebar` primitive-only.
- Implement `AttachmentSidebar`.
- Make `EmailViewer` consume `AttachmentSidebar`.
- Make `SegmentSidebar` consume sidebar primitives internally.
- Align `PdfThumbnailSidebar` visually with sidebar tokens without changing its
  virtualization model.

### Phase 2: Clarify Embedded Sidebar Usage

- Add `EmbeddedSidebarProvider`, or document the embedded provider pattern.
- Remove hidden app-shell assumptions from embedded viewer sidebars.
- Ensure embedded sidebars work in cards, modals, split panes, and registry
  demos.

### Phase 3: Fix Thumbnail Semantics

- Add a decorative/sidebar presentation mode to `FileThumbnail`.
- Ensure thumbnail internals do not leak into attachment row accessible names.
- Add regression tests for CSV/XLSX thumbnails inside attachment rows.

### Phase 4: Introduce `ViewerShell`

- Extract shared viewer chrome conventions into `ViewerShell`.
- Let compound viewers provide side rails without knowing the selected file
  format.
- Keep `FileViewer` as a router, not a domain orchestrator.

## Implementation Status

The implemented system now includes:

- `EmbeddedSidebarProvider` for container-scoped domain sidebars.
- `AttachmentSidebar` as a reusable file attachment navigator.
- `SegmentSidebar` composed from embedded sidebar primitives.
- `PdfThumbnailSidebar` visually aligned through sidebar tokens while keeping
  its virtualized page rail.
- `FileThumbnail presentation="decorative"` for thumbnail-in-row semantics.
- `ViewerShell` as the shared compound viewer frame.
- `FileViewer slots` routed to slot-native viewers and wrapped in
  `ViewerShell` for non-slot-native routes.
- `EmailViewer` composed from `ViewerShell`, `FileViewer`, and
  `AttachmentSidebar`.

## Non-Goals

- Do not fold `SegmentSidebar` into `Sidebar`.
- Do not fold `AttachmentSidebar` into `Sidebar`.
- Do not make `Sidebar` aware of PDFs, files, emails, schemas, or segments.
- Do not force `PdfThumbnailSidebar` into menu row primitives.
- Do not create compatibility adapters for older sidebar APIs.
- Do not add domain variants to `Sidebar` when a domain component is the right
  owner.

## Decision

Adopt a strict primitive/domain split.

`Sidebar` remains the visual and interaction primitive. `SegmentSidebar`,
`AttachmentSidebar`, and `PdfThumbnailSidebar` remain domain sidebars with their
own models. They share primitive structure only where it improves clarity and
behavior. They share visual tokens everywhere they need to feel like part of the
same system.
