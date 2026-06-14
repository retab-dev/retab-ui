# Viewer Root Sidebar Final Blueprint

## Objective

Design the final viewer sidebar system for the component library.

The concrete product need is small:

```txt
Any control inside a viewer, especially a header button, should be able to
toggle the viewer sidebar without prop drilling.
```

The architectural need is larger:

```txt
PDF thumbnails, email attachments, file-system trees, split rails, OCR source
lists, extraction source lists, and future viewer sidebars should all use the
same spatial primitive.
```

The final design must preserve the core distinction:

```txt
Viewer = spatial grammar.
FileViewer = file semantics.
Domain viewers = workflows that compose viewer space and file rendering.
```

The sidebar system belongs to `ViewerRoot`, because sidebar visibility is
viewer layout state. It is not PDF state, email state, file-system state, or
file-renderer state.

## Final Judgment

`ViewerRoot` should be the sidebar provider.

Do not add a public `ViewerSidebarProvider`.

The ideal usage is:

```tsx
<ViewerRoot defaultSidebarOpen>
  <ViewerHeader>
    <ViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerControls />
  </ViewerHeader>

  <ViewerBody>
    <ViewerSidebar>
      <PdfViewerThumbnails />
    </ViewerSidebar>

    <ViewerSurface>
      <PdfViewerPages />
    </ViewerSurface>
  </ViewerBody>
</ViewerRoot>
```

The mental model is:

```txt
ViewerRoot owns one viewer layout state machine.
ViewerSidebarTrigger mutates that state machine.
ViewerSidebar renders according to that state machine.
ViewerSurface remains the content region.
Domain components fill the slots.
```

This removes provider soup while keeping the shadcn-quality trigger behavior.

## Sharpened Final Vision

The final component is not a viewer implementation. It is a viewer grammar.

```txt
Viewer primitives define space.
Domain providers define meaning.
File viewers define rendering.
```

That distinction should stay visible in the tree:

```tsx
<DomainProvider>
  <ViewerRoot>
    <ViewerHeader />
    <ViewerBody>
      <ViewerSidebar />
      <ViewerSurface />
    </ViewerBody>
  </ViewerRoot>
</DomainProvider>
```

The provider may wrap `ViewerRoot`, because domain state outlives and feeds the
layout. `ViewerRoot` should not wrap the provider, because the spatial primitive
should not own semantic state.

The one acceptable source of density in this design is composition. Avoid
making the primitive clever. The primitive should have few concepts, each with a
hard boundary:

```txt
root -> lifetime, measurement, sidebar state
header -> chrome row
body -> sidebar/surface flex boundary
sidebar -> placement and visibility
surface -> primary content region
trigger -> nearest-root toggle
```

Everything else belongs to domain components.

## Final Laws

The final design should be judged against these laws.

### One Spatial Root

There is exactly one `ViewerRoot` for one spatial viewer.

If the user sees one framed viewer with one header/body/surface relationship,
there should be one `ViewerRoot`.

Nested `ViewerRoot` is valid only when the user is genuinely looking at a
complete nested viewer, such as a PDF attachment opened inside an email part.
It is not valid as a convenience wrapper around simple file content.

### One Sidebar Path

There is exactly one way to express viewer sidebar visibility:

```tsx
<ViewerRoot defaultSidebarOpen sidebarOpen onSidebarOpenChange>
  ...
</ViewerRoot>
```

No domain viewer should keep a parallel `sidebarOpen` state for ordinary
visibility. If a domain needs to control sidebar visibility, it controls
`ViewerRoot`.

Forbidden final states:

```txt
PdfViewerProvider owns thumbnail visibility.
EmailViewerProvider owns attachment sidebar visibility.
FileSystemViewerProvider owns tree sidebar visibility.
SplitViewerProvider owns segment rail visibility.
```

Those providers may own selection, active item, filtering, ordering, and domain
data. They do not own whether the sidebar column is visible.

### One Trigger

There is exactly one generic trigger:

```tsx
<ViewerSidebarTrigger />
```

The trigger toggles the nearest `ViewerRoot`. It does not know what the sidebar
contains.

### One Sidebar Primitive

There is exactly one spatial sidebar primitive:

```tsx
<ViewerSidebar />
```

PDF thumbnails, email parts, file trees, split segments, OCR sources, and
extraction sources are children of that primitive. They are not alternate
sidebar implementations.

There is also exactly one primary sidebar per `ViewerRoot`.

If a design appears to need two independently toggled sidebars in one root, the
first question should be whether one of them is actually domain content inside
`ViewerSurface`, or whether the user is looking at a nested complete viewer.
Do not answer that pressure by adding `leftOpen`, `rightOpen`,
`ViewerLeftSidebar`, `ViewerRightSidebar`, or multiple named sidebar contexts to
the primitive.

### One Sidebar Side

Sidebar placement belongs to the sidebar relationship, not to each trigger.

The canonical declaration is:

```tsx
<ViewerSidebar side="right" />
```

`ViewerSidebarTrigger` may render a side-aware icon, but the trigger should not
become a second source of truth for layout. If the implementation needs
side-aware trigger visuals, prefer private registration from `ViewerSidebar` to
`ViewerRoot`, or a neutral trigger icon. A public `side` prop on the trigger is
acceptable only as a visual escape hatch; it must never control placement.

### Private Measurement

Container measurement is an implementation detail of `ViewerRoot`.

Do not export `useViewerWidth`, `useElementWidth`, or
`useInlineThumbnailSidebar` as part of the viewer primitive API. Those hooks are
useful implementation details, but exporting them would recreate the Extend
pattern where every viewer wires sidebar responsiveness by hand.

The public API is semantic:

```tsx
<ViewerRoot sidebarMode="auto" sidebarInlineBreakpoint={768}>
```

not mechanical:

```tsx
const [ref, width] = useElementWidth()
const inline = useInlineThumbnailSidebar(width)
```

### No Domain Leakage

`ViewerRoot`, `ViewerSidebar`, and `ViewerSidebarTrigger` must never import,
reference, or branch on:

```txt
pdf
email
mime
file-system
ocr
extraction
split
thumbnail
attachment
```

The primitive vocabulary is spatial. The child content supplies meaning.

## Why `ViewerRoot` Owns Sidebar State

`ViewerRoot` is already the lifetime and geometry boundary for one viewer.

A viewer has:

```txt
root
  header
  body
    optional sidebar
    surface
```

The sidebar open state affects that geometry. It controls how `ViewerBody`
allocates space between `ViewerSidebar` and `ViewerSurface`. That makes the
state spatial, not semantic.

The previous shape was too ceremonious:

```tsx
<ViewerSidebarProvider>
  <ViewerRoot>
    ...
  </ViewerRoot>
</ViewerSidebarProvider>
```

That creates two concepts where one concept is enough. The final shape is:

```tsx
<ViewerRoot defaultSidebarOpen>
  ...
</ViewerRoot>
```

This also resolves the confusion between viewer nesting and file viewer
nesting. There is one spatial root for the composed viewer. File rendering
parts sit inside its surface. A nested `ViewerRoot` is used only when the
content itself is a complete nested viewer with its own header/body/sidebar.

## Source Study: shadcn Sidebar

The shadcn sidebar solves a real composition problem:

```txt
SidebarProvider owns open state.
Sidebar consumes open state.
SidebarTrigger toggles from anywhere under the provider.
useSidebar gives imperative access.
```

This relationship is the part to copy.

The useful design choices are:

- The trigger is tiny and context-driven.
- The trigger can live far from the sidebar.
- Controlled and uncontrolled open state are both supported.
- The hook throws clearly outside the provider.
- The trigger calls user `onClick` first and respects `event.defaultPrevented`.
- The trigger respects disabled/loading state.
- Data attributes expose state for styling and tests.
- CSS variables carry layout dimensions.

The app-shell behavior should not be copied into viewers:

- No cookie persistence.
- No global `cmd+b` / `ctrl+b` shortcut by default.
- No fixed viewport positioning.
- No `h-svh`.
- No mobile Sheet as the default.
- No app navigation vocabulary.
- No assumption that the sidebar belongs to the page shell.

For shadcn, a separate `SidebarProvider` is correct because the sidebar can wrap
an application layout. For viewers, `ViewerRoot` is already the composition
boundary.

## Source Study: Extend Document Viewer Sidebar

The Extend component is not a provider system. It is a controlled layout
utility:

```tsx
<DocumentViewerThumbnailSidebar
  inline={sidebarInline}
  open={sidebarOpen}
>
  ...
</DocumentViewerThumbnailSidebar>
```

Each concrete viewer owns:

```tsx
const [sidebarOpen, setSidebarOpen] = React.useState(false)
const [viewerShellRef, viewerShellWidth] = useElementWidth<HTMLDivElement>()
const sidebarInline = useInlineThumbnailSidebar(viewerShellWidth)
```

The toolbar owns the button:

```tsx
onClick={() => setSidebarOpen((open) => !open)}
```

The sidebar owns the responsive presentation:

```txt
wide container  -> inline sidebar
narrow container -> overlay sidebar
inline closed   -> negative margin
overlay closed  -> translate offscreen
```

Important lessons to keep:

- Measure the viewer container, not the viewport.
- Use `ResizeObserver`.
- Ignore zero-width measurements from hidden or detached containers.
- Switch between inline and overlay based on actual embedded width.
- Do not use a mobile Sheet by default.
- Delay transitions until after the first paint to avoid mount animations.
- Keep the sidebar as an `aside`.
- Preserve the same content for inline and overlay modes.
- Use data attributes for mode and open state.

Important limitation to avoid:

The wiring is duplicated in PDF, DOCX, and DOCX editor viewers. Each viewer
stores `sidebarOpen`, measures its shell, derives inline mode, renders a trigger,
and passes props to the sidebar.

That is fine for a concrete viewer. It is not the right final abstraction for
our component library, where PDF, email, file-system, split, OCR, extraction,
dropzone, and nested attachments need the same sidebar relationship.

The final design should combine the two systems:

```txt
shadcn gives the context-driven trigger relationship.
Extend gives the embedded inline/overlay sidebar behavior.
ViewerRoot is the place where they meet.
```

## Non-Goals

Do not create `ViewerSidebarProvider` as public API.

Do not make `PdfViewerHeader` own thumbnail visibility.

Do not make `PdfViewerThumbnails` own layout state.

Do not make `EmailViewerPartsSidebar` own layout state.

Do not create domain triggers like:

```txt
PdfThumbnailSidebarTrigger
EmailAttachmentSidebarTrigger
FileSystemTreeSidebarTrigger
ExtractionSourcesSidebarTrigger
OcrSourcesSidebarTrigger
```

Do not make `FileViewer` responsible for file-system or email sidebars.

Do not fold `Viewer` and `FileViewer` into one abstraction.

Do not make `ViewerSidebar` reuse the app-shell `Sidebar` desktop layout.

Do not add global persistence.

Do not add global keyboard shortcuts by default.

Do not support multiple independently controlled sidebars in one root in the
first design. One `ViewerRoot` owns one primary sidebar. If a nested document
needs its own sidebar, it gets its own nested `ViewerRoot`.

## Final Vocabulary

Keep these viewer layout primitives:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
ViewerSidebarTrigger
useViewerSidebar
useOptionalViewerSidebar
```

Do not add:

```txt
ViewerSidebarProvider
FileViewerSidebarProvider
PdfSidebarProvider
EmailSidebarProvider
```

Keep domain sidebar content names specific:

```txt
PdfViewerThumbnails
EmailViewerPartsSidebar
FileSystemViewerTree
SplitViewerSegments
ExtractionViewerSources
OcrViewerSources
AnchoredDocumentSidebar
```

The dependency direction is:

```txt
ViewerRoot
  -> ViewerSidebarTrigger
  -> ViewerSidebar

PdfViewerProvider
  -> PdfViewerTitle
  -> PdfViewerControls
  -> PdfViewerPages
  -> PdfViewerThumbnails

EmailViewerProvider
  -> EmailViewerHeaderSummary
  -> EmailViewerPartsSidebar
  -> EmailViewerSelectedPart

FileSystemViewerProvider
  -> FileSystemViewerHeader
  -> FileSystemViewerTree
  -> selected source
  -> FileViewer parts
```

## Component Contracts

### `ViewerRoot`

Purpose:

```txt
Own one viewer layout boundary and one optional primary sidebar state machine.
```

Proposed props:

```ts
type ViewerSidebarMode = "inline" | "overlay"
type ViewerSidebarRequestedMode = "auto" | ViewerSidebarMode
type ViewerSidebarState = "expanded" | "collapsed"

interface ViewerRootProps extends React.ComponentProps<"div"> {
  bare?: boolean
  defaultSidebarOpen?: boolean
  sidebarOpen?: boolean
  onSidebarOpenChange?: (open: boolean) => void
  sidebarMode?: ViewerSidebarRequestedMode
  sidebarInlineBreakpoint?: number
}
```

Defaults:

```txt
defaultSidebarOpen = false
sidebarMode = "auto"
sidebarInlineBreakpoint = 768
```

State rules:

- `sidebarOpen` makes the sidebar controlled.
- `defaultSidebarOpen` initializes uncontrolled state.
- `onSidebarOpenChange` fires for both controlled and uncontrolled usage.
- `setSidebarOpen` accepts either a boolean or updater function.
- `toggleSidebar` is stable.
- The root owns only one primary sidebar state.

Measurement rules:

- `ViewerRoot` measures its own rendered width with `ResizeObserver`.
- Width `0` is ignored.
- Raw width is not exposed publicly.
- The measurement ref is private to `ViewerRoot`.
- No public hook exposes raw viewer width for sidebar layout.
- Context updates only when the derived sidebar mode changes.
- `sidebarMode="inline"` forces inline mode.
- `sidebarMode="overlay"` forces overlay mode.
- `sidebarMode="auto"` derives mode from `sidebarInlineBreakpoint`.

Performance rule:

Do not put raw width in context. If width changes from `1024` to `1018`, nothing
that consumes sidebar context should re-render unless the mode crosses the
inline/overlay breakpoint.

Data attributes:

```txt
data-slot="viewer-root"
data-viewer-sidebar-state="expanded|collapsed"
data-viewer-sidebar-mode="inline|overlay"
data-viewer-sidebar-open="true|false"
```

Reason:

The root is the only object that naturally sees the whole viewer. It can expose
sidebar state without introducing a second public provider.

### `useViewerSidebar`

Purpose:

```txt
Read and mutate sidebar state from the nearest ViewerRoot.
```

Contract:

```ts
interface ViewerSidebarContextValue {
  state: ViewerSidebarState
  open: boolean
  setOpen: (value: boolean | ((open: boolean) => boolean)) => void
  toggleSidebar: () => void
  mode: ViewerSidebarMode
  requestedMode: ViewerSidebarRequestedMode
  sidebarId: string
}

function useViewerSidebar(): ViewerSidebarContextValue
```

Rules:

- Throws outside `ViewerRoot`.
- Error message:

```txt
useViewerSidebar must be used within a ViewerRoot.
```

- Does not create implicit state.
- Does not know domain content.
- Does not expose raw measured width.
- Does not expose a `setMode` escape hatch. The mode is derived from root props
  and measured container size.

### `useOptionalViewerSidebar`

Purpose:

```txt
Let primitives adapt when a ViewerRoot context exists without requiring one.
```

Contract:

```ts
function useOptionalViewerSidebar(): ViewerSidebarContextValue | null
```

Rules:

- Returns `null` outside `ViewerRoot`.
- Used by low-level layout primitives that can render without sidebar state.
- Not used by `ViewerSidebarTrigger`; a trigger outside `ViewerRoot` is a
  programmer error.

### `ViewerSidebarTrigger`

Purpose:

```txt
Render a button that toggles the nearest ViewerRoot sidebar.
```

Proposed props:

```ts
interface ViewerSidebarTriggerProps
  extends React.ComponentProps<typeof Button> {
  side?: "left" | "right"
}
```

Defaults:

```txt
side = "left"
variant = "ghost"
size = "icon"
aria-label = "Toggle sidebar"
```

Behavior:

- Uses the shared `Button` primitive.
- Reads `open`, `toggleSidebar`, and `sidebarId` from `useViewerSidebar`.
- The `side` prop is only a visual/icon hint for the trigger.
- Sidebar placement is controlled by `ViewerSidebar side`, not by the trigger.
- Calls user `onClick` first.
- Does not toggle when `event.defaultPrevented` is true.
- Does not toggle when disabled, loading, or `aria-disabled`.
- Supports the same render/as-child mechanism as `Button`.
- Sets `type="button"` when rendering a native button and no type is supplied.

Accessibility:

```txt
aria-controls={sidebarId}
aria-expanded={open}
aria-label="Toggle sidebar"
```

Data attributes:

```txt
data-slot="viewer-sidebar-trigger"
data-viewer-sidebar-trigger=""
data-side="left|right"
data-state="expanded|collapsed"
```

Reason:

The trigger should be as boring as shadcn's `SidebarTrigger`: a small context
consumer, not a PDF/email/file-system component.

If the design later needs the trigger icon to auto-match the rendered sidebar
side, `ViewerSidebar` may register its side with `ViewerRoot` internally. That
registration should remain private. It should not introduce a public provider or
a second control path.

### `ViewerSidebar`

Purpose:

```txt
Render the sidebar region inside ViewerBody.
```

Proposed props:

```ts
interface ViewerSidebarProps extends React.ComponentProps<"aside"> {
  side?: "left" | "right"
  collapsible?: "offcanvas" | "none"
  width?: string
}
```

Defaults:

```txt
side = "left"
collapsible = "offcanvas" when ViewerRoot context exists
collapsible = "none" when no ViewerRoot context exists
width = "10rem"
```

Rules:

- Renders an `aside`.
- Stays inside the viewer body.
- Does not use fixed viewport positioning.
- Does not use `h-svh`.
- Does not portal.
- Does not use Sheet by default.
- Uses `width` through `--viewer-sidebar-width`.
- Does not force a gray background.
- Uses `bg-background` only as a neutral default, and allows class override.
- Applies side-specific border only through normal classes or side-aware
  defaults.
- Keeps content mounted during transitions.
- Makes closed content non-interactive and non-focusable.

Accessibility:

- Has `id={sidebarId}` from context.
- Uses `aria-hidden={!open}` when collapsible and closed.
- Uses `inert` when collapsible and closed.
- Keeps `aside` semantics when open.

Data attributes:

```txt
data-slot="viewer-sidebar"
data-side="left|right"
data-collapsible="offcanvas|none"
data-state="expanded|collapsed"
data-viewer-sidebar-state="expanded|collapsed"
data-viewer-sidebar-mode="inline|overlay"
data-viewer-sidebar-open="true|false"
```

Layout behavior:

```txt
mode=inline, open:
  relative
  width: var(--viewer-sidebar-width)
  margin: 0
  translate: 0
  shadow: none

mode=inline, closed:
  relative
  width: var(--viewer-sidebar-width)
  margin-left: calc(var(--viewer-sidebar-width) * -1) for left side
  margin-right: calc(var(--viewer-sidebar-width) * -1) for right side
  border-color: transparent

mode=overlay, open:
  absolute
  inset-block: 0
  left: 0 or right: 0
  width: var(--viewer-sidebar-width)
  translate: 0
  z-index above surface
  shadow allowed

mode=overlay, closed:
  absolute
  translate-x: -100% for left side
  translate-x: 100% for right side
  pointer-events: none
  border-color: transparent
```

Transition rule:

- No transition on first paint.
- Enable transitions after two `requestAnimationFrame` ticks.
- Animate only transform/margin/border-color.
- Do not animate layout-heavy properties beyond the inline negative margin.

Reason:

This copies the best part of Extend's component: one sidebar container supports
both inline and overlay behavior based on embedded viewer width.

### `ViewerBody`

Purpose:

```txt
Lay out sidebar and surface as siblings.
```

Required classes:

```txt
relative flex min-h-0 flex-1 overflow-hidden
```

Rules:

- Must be the containing block for overlay sidebars.
- Does not own sidebar state.
- Does not know domain content.
- Does not measure width if `ViewerRoot` already observes its boundary.
- May set data attributes from optional sidebar context for styling:

```txt
data-viewer-sidebar-state
data-viewer-sidebar-mode
data-viewer-sidebar-open
```

### `ViewerSurface`

Purpose:

```txt
Render the primary viewer content region.
```

Rules:

- Uses `min-w-0 flex-1`.
- Does not know whether the sidebar contains thumbnails, attachments, files, or
  OCR/source navigation.
- Should not create a nested `ViewerRoot` unless the content is itself a
  complete nested viewer.

## Responsive Behavior

The final responsive rule is container-based:

```txt
viewer width >= sidebarInlineBreakpoint -> inline
viewer width < sidebarInlineBreakpoint  -> overlay
```

The breakpoint is a viewer layout detail, not a global app media query.

This is crucial for:

- docs blocks;
- side-by-side examples;
- modals;
- split panes;
- nested attachment viewers;
- file-system preview panes;
- narrow dashboard columns;
- resizable panels.

Viewport media queries are insufficient because a viewer can be narrow on a wide
screen.

## Public Usage Patterns

### Standalone PDF With Thumbnails

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot defaultSidebarOpen={false}>
    <ViewerHeader>
      <ViewerSidebarTrigger />
      <PdfViewerTitle />
      <PdfViewerPageControls />
      <PdfViewerZoomControls />
      <PdfViewerActions />
    </ViewerHeader>

    <ViewerBody>
      <ViewerSidebar width="9rem">
        <PdfViewerThumbnails />
      </ViewerSidebar>

      <ViewerSurface>
        <PdfViewerPages />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

### Email With Attachment Sidebar

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot defaultSidebarOpen sidebarMode="auto">
    <ViewerHeader>
      <EmailViewerHeaderSummary />
      <ViewerSidebarTrigger side="right" />
    </ViewerHeader>

    <ViewerBody>
      <ViewerSurface>
        <EmailViewerSelectedPart />
      </ViewerSurface>

      <ViewerSidebar side="right" width="20rem">
        <EmailViewerPartsSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

The email provider owns MIME selection. `ViewerRoot` owns whether the parts
sidebar is visible.

### Email Attachment That Is Itself A PDF Viewer

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot defaultSidebarOpen>
    <ViewerHeader>
      <EmailViewerHeaderSummary />
      <ViewerSidebarTrigger side="right" />
    </ViewerHeader>

    <ViewerBody>
      <ViewerSurface>
        <PdfViewerProvider source={selectedPdfSource}>
          <ViewerRoot defaultSidebarOpen={false} bare>
            <ViewerHeader>
              <ViewerSidebarTrigger />
              <PdfViewerTitle />
              <PdfViewerControls />
            </ViewerHeader>

            <ViewerBody>
              <ViewerSidebar width="9rem">
                <PdfViewerThumbnails />
              </ViewerSidebar>
              <ViewerSurface>
                <PdfViewerPages />
              </ViewerSurface>
            </ViewerBody>
          </ViewerRoot>
        </PdfViewerProvider>
      </ViewerSurface>

      <ViewerSidebar side="right" width="20rem">
        <EmailViewerPartsSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

This nesting is valid because the selected attachment is a complete nested
viewer with its own sidebar state. It is not valid to add a nested `ViewerRoot`
around simple file content just to get file chrome.

### File System Viewer

```tsx
<FileSystemViewerProvider items={items}>
  <ViewerRoot defaultSidebarOpen>
    <FileSystemViewerHeader>
      <ViewerSidebarTrigger />
      <FileSystemViewerPath />
      <FileSystemViewerActions />
    </FileSystemViewerHeader>

    <ViewerBody>
      <ViewerSidebar width="18rem">
        <FileSystemViewerTree />
      </ViewerSidebar>

      <ViewerSurface>
        <FileViewerHeader source={selectedSource} />
        <FileViewerContent source={selectedSource} />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileSystemViewerProvider>
```

The file-system provider owns browse/query/selection. `ViewerRoot` owns whether
the tree is visible. `FileViewerHeader` and `FileViewerContent` render the
selected file and do not create another spatial shell.

This is the decisive ownership direction:

```txt
File system contains file viewing.
File viewing does not contain the file system.
```

`FileSystemViewer` is a composed domain viewer. `FileViewer` is a renderer for a
selected resource. The tree/sidebar/path state must not leak into `FileViewer`.

### Split Viewer

```tsx
<SplitViewerProvider source={source}>
  <ViewerRoot defaultSidebarOpen>
    <ViewerHeader>
      <ViewerSidebarTrigger />
      <SplitViewerTitle />
      <SplitViewerControls />
    </ViewerHeader>

    <ViewerBody>
      <ViewerSidebar width="12rem">
        <SplitViewerSegments />
      </ViewerSidebar>

      <ViewerSurface>
        <SplitViewerPages />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

Split state remains semantic. Sidebar visibility remains spatial.

### OCR And Extraction Viewers

OCR and extraction should share the same shape:

```tsx
<SourceAnchoredViewerProvider sources={sources}>
  <ViewerRoot defaultSidebarOpen>
    <ViewerHeader>
      <ViewerSidebarTrigger />
      <SourceAnchoredViewerTitle />
      <SourceAnchoredViewerControls />
    </ViewerHeader>

    <ViewerBody>
      <ViewerSidebar width="18rem">
        <SourceAnchoredViewerSources />
      </ViewerSidebar>

      <ViewerSurface>
        <SourceAnchoredDocumentSurface />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SourceAnchoredViewerProvider>
```

This reinforces the earlier conclusion that OCR and extraction are variants of
the same source-anchored viewer family.

### Dropzone Viewer

The dropzone does not need a sidebar by default. It can still use the same root:

```tsx
<DropzoneViewerProvider>
  <ViewerRoot>
    <ViewerHeader>
      <DropzoneViewerTitle />
      <DropzoneViewerActions />
    </ViewerHeader>

    <ViewerBody>
      <ViewerSurface>
        <DropzoneFileViewer />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</DropzoneViewerProvider>
```

If the dropzone grows a file queue or upload history sidebar, the same trigger
and sidebar primitives apply.

## Standalone Convenience APIs

Concrete viewers may still expose easy APIs:

```tsx
<PdfViewer source={source} />
<EmailViewer message={message} />
<FileSystemViewer items={items} />
<SplitViewer source={source} />
```

Those APIs should internally compose the primitives.

They should not introduce a second sidebar state path. The easy API and the
advanced API must produce the same tree shape below the surface.

## File Viewer Boundary

`ViewerRoot` and `FileViewer` both exist, but they do not compete.

```txt
ViewerRoot = layout root.
FileViewer = file/resource semantics.
FileViewerContent = renderer/router.
```

Inside a composed viewer, do this:

```tsx
<ViewerSurface>
  <FileViewerHeader source={selectedSource} />
  <FileViewerContent source={selectedSource} />
</ViewerSurface>
```

Avoid this when `FileViewer` creates its own root:

```tsx
<ViewerSurface>
  <FileViewer source={selectedSource} />
</ViewerSurface>
```

The standalone `FileViewer` convenience component may create a `ViewerRoot`.
The composable file parts should not.

The final component library should make this split obvious by naming:

```txt
FileViewer       -> standalone convenience viewer
FileViewerHeader -> composable file chrome
FileViewerContent -> composable file renderer
```

Do not use `FileViewer` inside an existing `ViewerSurface` when the goal is to
render a selected file in a composed viewer. Use the composable parts there.

## Styling Principles

Default viewer sidebar styling should be restrained:

- no forced gray sidebar panel;
- no decorative floating card;
- no nested card inside a card;
- no app-shell fixed layout;
- no oversized chrome;
- no background that conflicts with document surfaces;
- border only when it helps separate regions;
- square thumbnails remain square;
- item text aligns consistently on the left;
- collapsed sidebar content is not focusable.

Recommended defaults:

```txt
ViewerBody:
  relative flex min-h-0 flex-1 overflow-hidden

ViewerSurface:
  min-w-0 flex-1 overflow-auto

ViewerSidebar:
  z-30 shrink-0 overflow-hidden bg-background

ViewerSidebarTrigger:
  size icon button, ghost variant
```

Domain sidebars own their internal item grammar:

```txt
Pdf thumbnails -> page thumbnails.
Email parts -> Body section and Attachments section.
File system -> tree/list.
OCR/extraction -> source list and selected source state.
```

`ViewerSidebar` owns only placement, visibility, and responsive mode.

## Accessibility Requirements

`ViewerSidebarTrigger`:

- must be reachable by keyboard;
- must have a stable accessible name;
- must set `aria-expanded`;
- must set `aria-controls`;
- must not toggle when disabled/loading;
- must keep native button type safe.

`ViewerSidebar`:

- must render as `aside`;
- must receive the controlled id;
- must be `aria-hidden` when collapsed;
- must be `inert` when collapsed;
- must not leave hidden links/buttons in the tab order;
- must preserve readable DOM order.

Nested viewers:

- each `ViewerRoot` has its own generated sidebar id;
- a trigger controls only the nearest root;
- outer email trigger must not toggle inner PDF thumbnails;
- inner PDF trigger must not toggle outer email attachments.

## Performance Requirements

The sidebar system must be fast because viewers contain heavy renderers.

Rules:

- Context value is memoized.
- `toggleSidebar` and `setOpen` are stable callbacks.
- Root measurement ignores width `0`.
- Root measurement stores derived mode, not raw width.
- Resizes that do not cross the breakpoint do not update context.
- Sidebar transitions do not require re-rendering page canvases.
- Hidden sidebar content stays mounted only when preserving state is valuable.
- Heavy domain content can choose not to render while closed.

Allowed pattern for heavy sidebars:

```tsx
const { open } = useViewerSidebar()

<ViewerSidebar>
  {open ? <PdfViewerThumbnails /> : null}
</ViewerSidebar>
```

Allowed pattern for stateful sidebars:

```tsx
<ViewerSidebar>
  <EmailViewerPartsSidebar />
</ViewerSidebar>
```

The domain chooses whether closed content remains mounted. The layout primitive
does not decide that.

## Testing Requirements

### Unit Tests

`ViewerRoot`:

- uncontrolled sidebar state initializes from `defaultSidebarOpen`;
- controlled `sidebarOpen` respects props;
- `onSidebarOpenChange` fires with the next value;
- updater functions receive the current value;
- state data attributes update;
- mode data attributes update;
- zero-width resize measurements are ignored;
- raw resize changes within the same mode do not force context changes.

`ViewerSidebarTrigger`:

- throws outside `ViewerRoot`;
- toggles nearest root;
- calls user `onClick` first;
- does not toggle when default is prevented;
- does not toggle when disabled/loading/aria-disabled;
- sets `aria-expanded`;
- sets `aria-controls`;
- renders `type="button"` for native buttons.

`ViewerSidebar`:

- renders expanded inline classes;
- renders collapsed inline classes;
- renders expanded overlay classes;
- renders collapsed overlay classes;
- applies left and right side behavior;
- applies `aria-hidden` and `inert` when closed;
- defaults to non-collapsible outside context;
- respects custom width.

Nested roots:

- inner trigger toggles inner sidebar only;
- outer trigger toggles outer sidebar only.

### Browser Tests

Verify at wide and narrow viewer widths:

- PDF thumbnails open inline on wide containers.
- PDF thumbnails open as overlay on narrow containers.
- PDF trigger in header toggles thumbnails.
- Email right sidebar toggles attachments.
- File-system left sidebar toggles tree.
- Split sidebar toggles segment rail.
- OCR/extraction sidebar toggles source list.
- Nested email attachment PDF has independent thumbnail toggle.
- No double viewer frames appear.
- No hidden sidebar items remain tabbable.
- No gray sidebar background is forced where the design expects a white panel.
- Page canvases do not blank when the sidebar toggles or when hidden viewers
  remount.

## Migration Plan

This is a hard cutover. No compatibility shim.

1. Add sidebar state to `ViewerRoot`.
2. Add `useViewerSidebar` and `useOptionalViewerSidebar`.
3. Add `ViewerSidebarTrigger`.
4. Extend `ViewerSidebar` with `side`, `collapsible`, `width`, and responsive
   mode behavior.
5. Ensure `ViewerBody` is the relative containing block.
6. Keep container measurement private to `ViewerRoot`.
7. Migrate PDF thumbnails to `ViewerRoot` sidebar state.
8. Migrate email parts sidebar to `ViewerRoot` sidebar state.
9. Migrate file-system tree sidebar to `ViewerRoot` sidebar state.
10. Migrate split segment sidebar to `ViewerRoot` sidebar state.
11. Migrate OCR/extraction source sidebars to the same source-anchored pattern.
12. Remove ad hoc `sidebarOpen` state where it only represents visibility.
13. Remove exported viewer-width/sidebar-inline measurement hooks if any exist.
14. Keep domain state in domain providers.
15. Update docs and blocks to show the same composition everywhere.
16. Delete any public `ViewerSidebarProvider` experiment if it exists.

## Final Invariants

There is one root per spatial viewer.

There is one primary sidebar state per root.

The trigger controls the nearest root.

The trigger does not own sidebar placement.

The sidebar stays inside the viewer body.

The sidebar mode is based on container width, not viewport width.

The root stores derived sidebar mode, not raw measured width.

Raw viewer width is not part of public sidebar context.

Viewer responsiveness is configured by root props, not by exported measurement
hooks.

Domain providers own semantic selection.

Viewer primitives own spatial state.

File viewer parts render files inside a surface.

Standalone convenience viewers compose primitives internally.

Advanced users compose the same primitives directly.

No provider soup.

No app-shell leakage.

No duplicate sidebar APIs.

No domain-specific trigger components.

No hidden focus traps.

No unnecessary abstraction.

## Final Position

The perfect design is not shadcn sidebar copied directly, and it is not Extend
sidebar copied directly.

It is:

```txt
ViewerRoot as the viewer-scoped sidebar provider.
ViewerSidebarTrigger as the portable toggle.
ViewerSidebar as the responsive inline/overlay container.
Domain sidebars as pure content.
FileViewer as file semantics inside ViewerSurface.
```

This is the smallest model that satisfies the real use cases:

- simple standalone viewers;
- composed viewers;
- recursive email attachments;
- file-system browsing;
- PDF thumbnail navigation;
- split document navigation;
- OCR/source extraction navigation;
- dropzone evolution;
- embedded docs examples and narrow containers.

It keeps the expressive power of shadcn composition without carrying app-shell
behavior into document viewers. It keeps the responsive correctness of Extend's
document sidebar without duplicating state wiring in every viewer.
