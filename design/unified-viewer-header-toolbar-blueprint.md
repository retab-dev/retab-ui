# Unified Viewer Header Toolbar Blueprint

## Objective

Unify viewer headers and toolbars across PDF, DOCX, PPTX, XLSX, image, text,
code, markdown, and CSV without making the public API more complex.

The goal is maximum consistency with minimum abstraction:

```txt
one spatial header primitive
one shared toolbar grammar
format viewers adapt their own state into that grammar
users can edit installed code when they need bespoke chrome
```

This blueprint supersedes the PDF-only instinct to export
`PdfViewerHeaderTitle` and `PdfViewerHeaderControls` as public anatomy. Title
and controls are real concepts, but they are not PDF-specific concepts. They
belong to viewer chrome.

## Current Problem

The system repeats the same toolbar structure with format-specific names:

```txt
PdfViewerControls
DocxViewerToolbar
PptxToolbar
ImageViewerToolbar
XlsxToolbar
CsvViewerToolbar
TextViewerToolbar
CodeViewerToolbar
MarkdownDocumentToolbar
```

Most of them render the same grammar:

```txt
left metadata
right action cluster
zoom out
zoom percentage
zoom in
fit width or reset zoom
rotate when supported
download
```

The duplication is not just code duplication. It creates API drift:

```txt
PDF says Page
PPTX says Slide
DOCX has ready skeletons
XLSX says sheet name and dimensions
CSV uses smaller custom buttons
image says countLabel
text/code use another frame
download is sometimes button, sometimes control
fit/reset naming varies
```

That drift makes the component library feel like many viewers that happen to
look similar, not one viewer system.

## Design Principle

Do not expose a part just because someone might customize it.

In a shadcn-style library, users own the code after install. The public API does
not need to anticipate every rearrangement. It should ship the common beautiful
composition, and the installed code should be simple enough to edit.

Therefore:

```txt
avoid per-format public header atoms
avoid a slot explosion
avoid provider-specific generic magic
prefer one controlled visual primitive
prefer thin internal adapters
```

## Boundary

The right unification level is chrome, not provider state.

```txt
ViewerHeader owns row placement.
ViewerSidebarTrigger owns sidebar state.
ViewerToolbar owns common toolbar layout and button grammar.
Format viewers own document state and translate it into ViewerToolbar props.
```

Do not create a global `ViewerToolbarProvider`.
Do not make `ViewerToolbar` read PDF/DOCX/PPTX/XLSX contexts.
Do not couple all viewers to a shared document-state model.

The common thing is the visual/action grammar, not the data model.

## Non-Goals

This is not a plan to create a universal document engine.

Do not attempt to unify:

```txt
PDF page virtualization
DOCX HTML pagination
PPTX slide rendering
XLSX sheet state
CSV table parsing
image frame decoding
markdown/text/code layout
```

Do not introduce:

```txt
ViewerDocumentProvider
ViewerPageProvider
ViewerChromeProvider
ViewerToolbarContext
cross-format currentPage state
cross-format zoom reducer
```

Those would make the system look unified while making every viewer less direct.
The win is visual and interaction consistency, not a shared domain model.

## Unification Test

A candidate piece belongs in `ViewerToolbar` only if it passes all checks:

```txt
it appears in at least three viewer families
it can be described without naming a file format
it is visual/action chrome, not document interpretation
it does not require the toolbar to know a provider
it can be omitted without placeholder props
```

Examples that pass:

```txt
title
subtitle
position label
zoom controls
fit/reset button
rotate button
download control
loading/skeleton state
extra trailing content
```

Examples that fail:

```txt
active worksheet tabs
PDF thumbnail sidebar
source bounding boxes
OCR text layer toggles
email attachment MIME tree
spreadsheet formula bar
CSV column menu
```

Failing examples may sit near the toolbar through `extra`, but they should not
become first-class toolbar concepts.

## Final Public Shape

The primitive should be controlled and boring:

```tsx
<ViewerHeader>
  <ViewerSidebarTrigger />
  <ViewerToolbar
    title="nvidia-10k-fy2024.pdf"
    position={{ kind: "page", current: 12, total: 40 }}
    zoom={{
      scale,
      onZoomOut,
      onZoomIn,
      onFit,
      fitLabel: "Fit width",
    }}
    rotate={{ onRotate }}
    downloads={[downloadAction]}
  />
</ViewerHeader>
```

For XLSX:

```tsx
<ViewerToolbar
  title={sheet.name}
  subtitle={`${sheet.rowCount.toLocaleString()} x ${sheet.columnCount}`}
  zoom={{
    scale,
    onZoomOut,
    onZoomIn,
    onFit: onResetZoom,
    fitLabel: "Actual size",
  }}
  downloads={downloadActions}
/>
```

For CSV:

```tsx
<ViewerToolbar
  title={`${rowCount.toLocaleString()} rows`}
  subtitle={`${columnCount} columns`}
  loading={isLoading}
  size="sm"
  zoom={{
    scale: zoom,
    onZoomOut,
    onZoomIn,
    onFit: onResetZoom,
    fitLabel: "Reset zoom",
  }}
  downloads={downloadActions}
/>
```

For simple text/code:

```tsx
<ViewerToolbar
  title={resource.fileName}
  zoom={{ scale, onZoomOut, onZoomIn, onFit: onResetZoom }}
  downloads={[downloadAction]}
/>
```

## Proposed API

```ts
export type ViewerToolbarPosition =
  | {
      kind: "page"
      current: number
      total?: number
    }
  | {
      kind: "slide"
      current: number
      total?: number
    }
  | {
      kind: "frame"
      current: number
      total?: number
    }
  | {
      label: string
    }

export type ViewerToolbarZoom = {
  scale: number | null
  onZoomOut: () => void
  onZoomIn: () => void
  onFit?: () => void
  fitLabel?: string
  isDisabled?: boolean
}

export type ViewerToolbarRotate = {
  onRotate: () => void
  isDisabled?: boolean
}

export type ViewerToolbarProps = React.ComponentProps<"div"> & {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  position?: ViewerToolbarPosition | null
  zoom?: ViewerToolbarZoom | null
  rotate?: ViewerToolbarRotate | null
  downloads?: ViewerDownloadAction[]
  loading?: boolean
  size?: "default" | "sm"
  extra?: React.ReactNode
}
```

This is intentionally a visual component, not a data abstraction.

## Prop Semantics

### `title`

Primary resource or viewport label.

Use it for:

```txt
file name
sheet name
plain label such as "Text"
```

Rules:

```txt
render in the metadata group
truncate with min-width: 0
do not force title to be a string
do not infer title from downloads
do not read a resource context
```

### `subtitle`

Secondary metadata.

Use it for:

```txt
row/column dimensions
mime type
file size
loading detail
```

Rules:

```txt
muted color
truncate or hide before actions wrap
never compete with title
may be hidden below sm breakpoint
```

### `position`

Human-readable location in a multi-unit document.

Canonical formatting:

```txt
{ kind: "page", current: 3, total: 12 } -> "Page 3 of 12"
{ kind: "page", current: 3 } -> "Page 3"
{ kind: "slide", current: 4, total: 20 } -> "Slide 4 of 20"
{ kind: "frame", current: 2, total: 5 } -> "Frame 2 of 5"
{ label: "12 rows" } -> "12 rows"
```

Rules:

```txt
clamp display current to total when total exists
do not mutate the input value
use tabular numerals
hide nothing by default
allow `label` for non-page domains
```

### `zoom`

Visual scale controls.

Canonical controls:

```txt
Zoom out
percentage
Zoom in
Fit width / Reset zoom / Actual size
```

Rules:

```txt
scale null means unknown or fit mode; render skeleton if loading, otherwise "Fit"
percentage rounds with Math.round(scale * 100)
percentage width is fixed
onFit is optional
fitLabel defaults to "Fit width"
isDisabled disables all zoom buttons but keeps percentage visible
```

Do not pass zoom factors to `ViewerToolbar`. Each viewer owns its own zoom
math. The toolbar receives direct commands:

```txt
onZoomOut
onZoomIn
onFit
```

### `rotate`

Optional rotation action.

Rules:

```txt
render one Rotate button
do not expose rotation degrees unless the UI displays them
do not render for DOCX/XLSX/CSV unless rotation exists
isDisabled disables the button only
```

### `downloads`

Download actions.

Rules:

```txt
undefined or [] renders nothing
one action renders the standard download affordance
multiple actions render the standard download menu/control
always use ViewerDownloadControl
```

### `extra`

Escape hatch for toolbar-adjacent controls.

Use it for:

```txt
view mode toggles
sheet-specific selectors
dense table controls
temporary migration affordances
```

Rules:

```txt
extra renders after standard action groups
extra must not be required for common zoom/download behavior
extra must not receive layout responsibility
if extra becomes common across viewers, promote it deliberately
```

## Rendering Contract

The toolbar renders one row:

```txt
metadata group
action group
```

Metadata group:

```txt
loading indicator if loading
title if present
subtitle if present
position if present
```

Action group:

```txt
zoom controls if zoom is present
rotate button if rotate is present
download control if downloads has actions
extra if present
```

Rules:

```txt
title truncates.
subtitle is muted and may hide on narrow widths.
position uses tabular numerals.
zoom percentage has stable width.
icon button size is stable.
separators appear only between present action groups.
loading uses skeletons/pulse without shifting layout.
all controls have aria-label and title.
```

## Layout Contract

Base row:

```txt
display: flex
height: 40px
flex-shrink: 0
align-items: center
gap: 4px
border-bottom
background: card
padding-inline: 8px
```

Metadata group:

```txt
display: flex
align-items: center
gap: 6px
min-width: 0
flex: 1 1 auto
overflow: hidden
```

Action group:

```txt
display: flex
align-items: center
gap: 4px
margin-left: auto
flex-shrink: 0
```

Responsive behavior:

```txt
actions never wrap
title truncates before actions shrink
subtitle hides before title disappears
position remains visible when possible
zoom percentage keeps fixed width
extra may be responsible for its own responsive behavior
```

The toolbar should not use CSS grid unless flex cannot satisfy the layout. The
existing viewer headers are row toolbars, not dense table headers.

## Accessibility Contract

The toolbar itself is not a landmark. It is a `div` inside the viewer header.

Rules:

```txt
buttons use native button semantics
icon-only buttons have aria-label and title
disabled buttons use disabled, not only aria-disabled
loading skeletons are aria-hidden
download control owns its own accessible name
zoom percentage is text, not an input
position text is visible text, not only aria-label
```

Keyboard behavior:

```txt
Tab reaches each enabled control in DOM order
Shift+Tab works naturally
Enter/Space activate buttons natively
disabled controls are skipped
no roving tabindex in the toolbar
```

Screen-reader text should not duplicate visible labels unless the icon-only
button needs it.

## Visual Contract

Use one icon system:

```txt
Minus = zoom out
Plus = zoom in
Maximize = fit width / reset / actual size
RotateCw = rotate
download icon comes from ViewerDownloadControl
```

Use one button style:

```txt
variant: ghost
size: icon-sm
className: size-7
```

Use one text style:

```txt
metadata: text-xs
title: text-xs font-medium or text-sm only when embedded in larger header
secondary metadata: text-xs text-muted-foreground
numbers: tabular-nums
```

The toolbar should not introduce a new visual theme. It should feel identical
across all viewers.

## Naming

Use generic viewer names:

```txt
ViewerHeader
ViewerToolbar
ViewerToolbarSkeleton
ViewerToolbarButton
ViewerToolbarPosition
ViewerToolbarZoom
ViewerToolbarRotate
```

Do not use:

```txt
DocumentViewerToolbar
PdfViewerHeaderTitle
PdfViewerHeaderControls
DocxViewerControls
PptxToolbarButton
```

Reason:

```txt
PDF, DOCX, PPTX, XLSX, CSV, image, text, code, and markdown are all viewers.
The chrome primitive should not imply one file family.
```

## What Stays Format-Specific

Each viewer still owns its state and domain logic.

PDF owns:

```txt
current page
page count
scale
fit width
rotate
download action
```

DOCX owns:

```txt
current page
page count
ready state
scale
fit width
download action
```

PPTX owns:

```txt
current slide
slide count
scale
fit width
rotate
download action
```

Image owns:

```txt
frame count label
scale
fit width
rotate
download action
```

XLSX owns:

```txt
active sheet
row and column counts
scale
reset zoom
download actions
sheet tabs
```

CSV owns:

```txt
row and column counts
loading state
scale
reset zoom
download actions
```

Text/code/markdown own:

```txt
scale
reset or fit width
download action
format-specific view toggles if any
```

## Per-Viewer Mapping

### PDF

Current duplicate:

```txt
PdfViewerControls
PdfViewerToolbar
```

Target mapping:

```ts
const toolbarProps = {
  title: resource.fileName || "PDF",
  position: { kind: "page", current: currentPage, total: pageCount },
  zoom: {
    scale,
    onZoomOut,
    onZoomIn,
    onFit: onFitWidth,
    fitLabel: "Fit width",
  },
  rotate: { onRotate },
  downloads: [downloadAction],
} satisfies ViewerToolbarProps
```

Sidebar composition:

```tsx
<ViewerHeader>
  <ViewerSidebarTrigger />
  <ViewerToolbar {...toolbarProps} />
</ViewerHeader>
```

### DOCX

Current duplicate:

```txt
DocxViewerToolbar
DocxToolbarSkeleton
DocxToolbarButton
```

Target mapping:

```ts
const toolbarProps = {
  title: resource.fileName || "DOCX",
  position: ready
    ? { kind: "page", current: currentPage, total: numPages }
    : null,
  zoom: ready
    ? {
        scale,
        onZoomOut: zoomOut,
        onZoomIn: zoomIn,
        onFit: fitWidth,
      }
    : null,
  downloads: download ? [download] : [],
  loading: !ready,
} satisfies ViewerToolbarProps
```

If preserving skeleton geometry matters, use `ViewerToolbarSkeleton` while the
DOCX page model is not ready.

### PPTX

Current duplicate:

```txt
PptxToolbar
PptxToolbarSkeleton
PptxIconButton
```

Target mapping:

```ts
const toolbarProps = {
  title: resource.fileName || "PPTX",
  position: { kind: "slide", current: currentSlide, total: slideCount },
  zoom: {
    scale: zoomScale,
    onZoomOut: () => setViewerScale(zoomScale / 1.2),
    onZoomIn: () => setViewerScale(zoomScale * 1.2),
    onFit: () => setViewerScale(null),
    isDisabled: scaleControlsDisabled,
  },
  rotate: { onRotate: () => setRotation((value) => (value + 90) % 360) },
  downloads: [downloadAction],
} satisfies ViewerToolbarProps
```

### Image

Current duplicate:

```txt
ImageViewerToolbar
ImageToolbarSkeleton
ToolbarIconButton
```

Target mapping:

```ts
const toolbarProps = {
  title: resource.fileName || "Image",
  position: { label: countLabel },
  zoom: {
    scale,
    onZoomOut,
    onZoomIn,
    onFit: onFitWidth,
    isDisabled: scaleControlsDisabled,
  },
  rotate: { onRotate },
  downloads: [downloadAction],
} satisfies ViewerToolbarProps
```

### XLSX

Current duplicate:

```txt
XlsxToolbar
XlsxToolbarSkeleton
ToolbarIconPlaceholder
```

Target mapping:

```ts
const toolbarProps = {
  title: sheet?.name ?? "-",
  subtitle: sheet
    ? `${sheet.rowCount.toLocaleString()} x ${sheet.columnCount}`
    : null,
  zoom: {
    scale,
    onZoomOut,
    onZoomIn,
    onFit: onResetZoom,
    fitLabel: "Actual size",
  },
  downloads: downloadActions,
  loading: !isReady,
} satisfies ViewerToolbarProps
```

Sheet tabs remain outside the toolbar. They are not toolbar chrome.

### CSV

Current duplicate:

```txt
CsvViewerToolbar
useCsvViewerZoom
custom 24px buttons
```

Target mapping:

```ts
const toolbarProps = {
  title: `${rowCount.toLocaleString()} row${rowCount === 1 ? "" : "s"}`,
  subtitle: `${columnCount} column${columnCount === 1 ? "" : "s"}`,
  loading: isLoading,
  zoom: {
    scale: zoom,
    onZoomOut: () => onZoomChange(clampZoom(zoom / 1.2)),
    onZoomIn: () => onZoomChange(clampZoom(zoom * 1.2)),
    onFit: () => onZoomChange(1),
    fitLabel: "Reset zoom",
  },
  downloads: downloadActions,
} satisfies ViewerToolbarProps
```

CSV should try the default size first. A `size="sm"` branch should exist only if
the default row is visibly too heavy for table use.

### Text, Code, Markdown

Target mapping:

```ts
const toolbarProps = {
  title: resource.fileName || fallbackTitle,
  zoom: {
    scale,
    onZoomOut,
    onZoomIn,
    onFit: onResetZoom,
    fitLabel: "Reset zoom",
  },
  downloads: [downloadAction],
  extra: viewToggle,
} satisfies ViewerToolbarProps
```

Keep code-block-local toolbars separate. They are editor/prose affordances, not
viewer header chrome.

## What Gets Unified

Unify:

```txt
toolbar row classes
button component
button size
icon opacity and spacing
zoom percentage width
separator placement
download control usage
skeleton layout
metadata typography
position label formatting
fit/reset/actual-size button placement
```

Do not force all viewers to share:

```txt
the same state hook
the same provider
the same page model
the same source model
the same loading lifecycle
the same scroll model
```

That would be false unification.

## File Organization

Add:

```txt
registry/new-york-v4/ui/viewer-toolbar.tsx
```

Export it through the registry item that already owns viewer primitives if
appropriate.

Preferred file contents:

```txt
ViewerToolbar
ViewerToolbarSkeleton
formatViewerToolbarPosition
ViewerToolbarButton
ViewerToolbarProps
ViewerToolbarPosition
ViewerToolbarZoom
ViewerToolbarRotate
```

Keep private:

```txt
ToolbarMetadata
ToolbarActions
ToolbarSeparator
ZoomValue
IconButton
SkeletonText
```

Do not put format-specific adapters in `viewer-toolbar.tsx`.

Format-specific adapter code should stay next to each viewer:

```txt
pdf-viewer.tsx
docx-viewer-content.tsx
pptx-viewer.tsx
image-viewer-content.tsx
xlsx-viewer-session.tsx
csv-viewer.tsx
```

This keeps ownership local while unifying chrome.

## Header Composition

The final composed viewer with a sidebar should read:

```tsx
<ViewerRoot bare defaultSidebarOpen>
  <ViewerHeader>
    <ViewerSidebarTrigger />
    <ViewerToolbar {...toolbarProps} />
  </ViewerHeader>
  <ViewerBody>
    <ViewerSidebar>{sidebar}</ViewerSidebar>
    <ViewerSurface>{surface}</ViewerSurface>
  </ViewerBody>
</ViewerRoot>
```

`ViewerHeader` remains the row primitive.
`ViewerToolbar` is just row content.
`ViewerSidebarTrigger` remains independent and can be placed before or after the
toolbar.

No header prop should be needed for the sidebar trigger.

## Easy APIs

The easy viewer APIs stay simple:

```tsx
<PdfViewer source={source} />
<DocxViewer source={source} />
<PptxViewer source={source} />
<XlsxViewer source={source} />
<ImageViewer source={source} />
<CsvViewer source={source} />
<TextViewer source={source} />
<CodeViewer source={source} />
```

Internally they adapt state into `ViewerToolbar`.

The public API should not grow just because the implementation becomes more
unified.

## Adapter Pattern

Each viewer should use a tiny adapter function or inline object construction.

Example:

```ts
const toolbar = {
  title: resource.fileName || "PDF",
  position: { kind: "page", current: currentPage, total: pageCount },
  zoom: {
    scale,
    onZoomOut,
    onZoomIn,
    onFit: onFitWidth,
    fitLabel: "Fit width",
  },
  rotate: { onRotate },
  downloads: [downloadAction],
} satisfies ViewerToolbarProps
```

Do not create a large cross-format `useViewerToolbarState` hook.

If a viewer has enough logic to warrant a helper, keep it local:

```txt
usePdfToolbarProps
usePptxToolbarProps
```

Those helpers should return `ViewerToolbarProps`, not introduce a second toolbar
model.

## Controlled, Not Contextual

`ViewerToolbar` must remain controlled.

Good:

```tsx
<ViewerToolbar zoom={{ scale, onZoomIn, onZoomOut }} />
```

Bad:

```tsx
<ViewerToolbar viewer="pdf" />
<ViewerToolbar source={resource} />
<ViewerToolbar context="auto" />
```

Reason:

```txt
the toolbar is reusable because it knows nothing about the viewer provider
format viewers already have the right state in scope
controlled props are easier to edit after shadcn installation
```

No optional context fallback.
No provider detection.
No implicit resource reading.

## Skeletons

Use one shared skeleton:

```tsx
<ViewerToolbarSkeleton
  position
  zoom
  rotate
  download
  titleWidth="6rem"
  subtitleWidth="4rem"
/>
```

But keep it simple. The skeleton exists to preserve layout, not to perfectly
simulate every format.

The existing per-format skeletons can disappear if the shared skeleton covers
the layout.

Skeleton API should describe visible groups, not file formats:

```ts
type ViewerToolbarSkeletonProps = React.ComponentProps<"div"> & {
  title?: boolean
  subtitle?: boolean
  position?: boolean
  zoom?: boolean
  rotate?: boolean
  download?: boolean
  extra?: React.ReactNode
}
```

Example:

```tsx
<ViewerToolbarSkeleton position zoom rotate download />
```

Rules:

```txt
same height as ViewerToolbar
same button geometry as ViewerToolbar
aria-hidden skeleton blocks
disabled placeholder buttons are not tabbable
no format-specific skeleton component after migration unless the whole viewer
fallback needs custom surface skeletons
```

## Downloads

Always use `ViewerDownloadControl` for one or many actions.

Do not use `ViewerDownloadButton` in one viewer and `ViewerDownloadControl` in
another unless the visual behavior is intentionally different.

Contract:

```txt
0 actions: render nothing
1 action: render one download button
2+ actions: render menu/control
```

The control already owns that distinction.

## Separators

Separators are a toolbar implementation detail.

Canonical grouping:

```txt
metadata | zoom group | rotate | download | extra
```

Rules:

```txt
no separator after metadata
separator between zoom and rotate only if both exist
separator before downloads if there is a prior action group
separator before extra if extra follows standard actions
no leading separator
no trailing separator
```

This prevents every viewer from hand-placing separators differently.

## Size

Default toolbar:

```txt
height: 40px
icon button: icon-sm / 28px visual box
padding x: 8px
```

Small toolbar:

```txt
for dense CSV/table contexts only
height may be smaller
buttons may be 24px
text remains readable
```

If `size="sm"` causes too many branches, do not add it initially. It is better
to make CSV match the default toolbar than to prematurely support two systems.

## Migration Strategy

This should be a hard cleanup, not compatibility layering.

Order:

1. Create `ViewerToolbar` in `registry/new-york-v4/ui/viewer-toolbar.tsx`.
2. Move shared icon button, position label, zoom controls, rotate control, and
   skeleton into that file.
3. Convert PDF to `ViewerToolbar`.
4. Convert PPTX and image next because they are closest to PDF.
5. Convert DOCX next because it needs ready/skeleton behavior.
6. Convert text/code/markdown because they share zoom/download grammar.
7. Convert XLSX and CSV last because their metadata differs most.
8. Remove duplicated per-format toolbar button helpers.
9. Update docs and architecture tests.
10. Regenerate registry artifacts.

No deprecated toolbar components unless they are still internal wrappers during
the same cutover.
No public compatibility shims.
No duplicate button helper families.

## Detailed Cutover Checklist

For each viewer:

```txt
replace local toolbar row with ViewerToolbar
delete local icon button helper
delete local toolbar placeholder helper
replace local toolbar skeleton with ViewerToolbarSkeleton where possible
preserve existing aria-label strings
preserve existing title strings
preserve existing zoom math
preserve existing disabled behavior
preserve existing download actions
add or update focused tests
```

Acceptance criteria for a migrated viewer:

```txt
same visible controls
same keyboard behavior
same disabled behavior
same download behavior
same or better responsive behavior
less local chrome code
no new provider dependency
```

Stop migration if a viewer becomes harder to read. The goal is unification with
less code, not unification at any cost.

## Public Documentation

Docs should show the easy API first:

```tsx
<PdfViewer source={source} />
```

Then the composed API:

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot>
    <ViewerHeader>
      <ViewerSidebarTrigger />
      <ViewerToolbar {...toolbarProps} />
    </ViewerHeader>
    <ViewerBody>...</ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

But do not over-teach `ViewerToolbar` as a framework. It is just the shared
chrome component.

Docs should not imply that every user must understand the toolbar primitive to
use a viewer. The easy API remains the product-facing entry point.

Recommended docs order:

```txt
1. Easy viewer
2. Composed viewer with ViewerRoot/ViewerHeader/ViewerBody
3. Sidebar trigger placement
4. Optional ViewerToolbar customization
```

Avoid docs that list every toolbar prop as if users are expected to design a
toolbar from scratch.

## Test Contract

Unit tests:

```txt
ViewerToolbar renders title, subtitle, and position
ViewerToolbar renders zoom controls with stable percentage text
ViewerToolbar disables zoom controls when requested
ViewerToolbar renders rotate only when rotate prop exists
ViewerToolbar renders download control only when downloads are present
ViewerToolbar omits separators for missing groups
ViewerToolbar skeleton preserves action layout
```

Viewer tests:

```txt
PDF uses ViewerToolbar
PPTX uses ViewerToolbar
DOCX uses ViewerToolbar
Image uses ViewerToolbar
XLSX uses ViewerToolbar
CSV uses ViewerToolbar or has a documented reason not to
```

Architecture tests:

```txt
no DocxToolbarButton
no PptxIconButton
no Image ToolbarIconButton
no duplicated toolbar skeleton helpers after migration
no PdfViewerHeader start prop
no per-format public HeaderTitle/HeaderControls exports
```

E2E tests:

```txt
PDF zoom and sidebar trigger still work
PPTX zoom/rotate/download still work
DOCX zoom/download still work
XLSX sheet title/zoom/download still work
CSV row/column metadata/zoom/download still work
```

Visual regression checks:

```txt
PDF/DOCX/PPTX/image toolbar controls align pixel-consistently
zoom value width does not shift between 75%, 100%, and 125%
download control aligns with rotate and zoom buttons
metadata truncates before action controls overlap
CSV/XLSX metadata does not overflow on narrow widths
```

Performance checks:

```txt
toolbar render does not trigger document rerender loops
toolbar props are memoized only where the existing viewer needs it
no global context update on every scroll just for toolbar state
current page/slide updates do not remount action controls
```

## Risks

### Risk: Over-Generic Props

If `ViewerToolbarProps` becomes a giant union of every viewer-specific concern,
the abstraction failed.

Mitigation:

```txt
only generic chrome concepts belong in ViewerToolbar
format-specific extras go into `extra`
complex domain UI stays outside the toolbar
```

### Risk: Worse Readability

If adapting state into `ViewerToolbar` takes more code than the old toolbar, the
abstraction is not paying rent.

Mitigation:

```txt
keep adapters inline when possible
avoid factories
avoid provider coupling
avoid deeply nested prop objects beyond zoom/rotate/downloads
```

### Risk: CSV/XLSX Do Not Fit

Tables have different metadata density.

Mitigation:

```txt
try to fit them into ViewerToolbar
if the result is worse, keep their metadata as `extra`
if still worse, document CSV/XLSX as intentional exceptions
```

Exceptions are allowed only when they preserve quality. They are not allowed as
a shortcut around shared button grammar.

### Risk: Public API Looks Too Config-Object Heavy

The toolbar prop object can start to feel like a mini framework.

Mitigation:

```txt
keep ViewerToolbar mostly internal at first
document easy APIs first
use direct JSX examples, not long prop tables
prefer editing installed code over adding more props
```

### Risk: Losing Format Personality

Some viewers have genuinely different metadata needs.

Mitigation:

```txt
unify actions and layout first
allow metadata variation through title/subtitle/position/extra
do not force XLSX sheet tabs or CSV table summaries into page metaphors
```

## Decision Records

### Decision: One Toolbar, Not One Header Per Format

Reason:

```txt
header row is spatial viewer chrome
toolbar controls are shared interaction chrome
format-specific public header parts multiply names without multiplying power
```

### Decision: Controlled Props, Not Context

Reason:

```txt
every viewer already owns its state
controlled props keep ViewerToolbar portable
context would couple unrelated viewers
```

### Decision: Keep `ViewerHeader`

Reason:

```txt
it already exists as the row primitive
it composes naturally with ViewerSidebarTrigger
it avoids creating DocumentViewerHeader or PdfViewerHeader as competing row concepts
```

### Decision: Let Users Edit Installed Code

Reason:

```txt
this is shadcn-style source distribution
public API should not grow to cover every customization
simple internals are more valuable than exhaustive slots
```

## Verdict

The platonic header direction is not:

```txt
PdfViewerHeaderTitle
PdfViewerHeaderControls
DocxViewerHeaderTitle
DocxViewerHeaderControls
...
```

The platonic direction is:

```txt
ViewerHeader = row primitive.
ViewerToolbar = shared chrome grammar.
Format viewer = state adapter.
Installed code = customization escape hatch.
```

That gives maximum unification without turning the API into a maze.
