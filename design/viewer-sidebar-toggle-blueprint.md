# Viewer Sidebar Toggle Blueprint

## Objective

Design the viewer-scoped equivalent of the shadcn sidebar toggle pattern.

The missing behavior is simple:

```txt
the viewer header must be able to toggle a sidebar rendered inside the viewer body
```

The hard part is preserving the viewer architecture:

```txt
Viewer primitives compose space.
Domain providers compose document state.
Domain sidebars compose navigation content.
Leaf renderers display one source.
```

The sidebar trigger must not pull app-shell assumptions into embedded viewers.
It must not turn PDF, email, split, extraction, OCR, or file-system viewers into
special cases. It should be one small spatial-state primitive that lets a header
and a body coordinate.

## Current Problem

The PDF thumbnail block now has the correct structural hierarchy:

```tsx
<PdfViewerProvider source={PDF_SOURCE}>
  <ViewerRoot bare className="h-full">
    <PdfViewerHeader />
    <ViewerBody>
      <ViewerSidebar className="w-36 border-r">
        <PdfViewerThumbnails />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerPages bare className="h-full" />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

This is spatially correct:

```txt
header
body
  sidebar
  surface
```

But it has no state relationship between `PdfViewerHeader` and
`ViewerSidebar`. The header cannot express "show thumbnails" or "hide
thumbnails" without either prop drilling or coupling the PDF header to the
thumbnail sidebar.

That is exactly the problem shadcn solves with:

```tsx
<SidebarProvider>
  <Sidebar />
  <main>
    <SidebarTrigger />
    {children}
  </main>
</SidebarProvider>
```

The important idea is not the visual sidebar component. The important idea is
the provider and trigger relationship:

```txt
SidebarProvider owns open state.
Sidebar consumes open state.
SidebarTrigger calls toggleSidebar from context.
The trigger can live away from the sidebar.
```

## Judgment

We should copy the relationship, not the app-shell implementation.

The existing shadcn-style `Sidebar` in this repository is app-shell capable. Its
desktop layout uses fixed viewport positioning and `h-svh`. That is correct for
application navigation. It is wrong for embedded document viewers, where the
sidebar must stay inside `ViewerBody`.

The ideal viewer design is:

```tsx
<ViewerSidebarProvider defaultOpen>
  <ViewerRoot>
    <PdfViewerHeader>
      <ViewerSidebarTrigger />
      ...
    </PdfViewerHeader>
    <ViewerBody>
      <ViewerSidebar side="left" collapsible="offcanvas">
        <PdfViewerThumbnails />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerPages />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</ViewerSidebarProvider>
```

The provider is viewer-scoped. The trigger can live in any viewer header. The
sidebar remains a spatial primitive. PDF thumbnails remain PDF content.

## Non-Goals

Do not make `PdfViewerHeader` own thumbnail visibility.

Do not make `PdfViewerThumbnails` expose layout state.

Do not make `ViewerRoot` own sidebar state implicitly.

Do not reuse the app-shell `Sidebar` desktop layout for embedded viewer
sidebars.

Do not add a `showSidebar` prop to every composed viewer as the primary
abstraction.

Do not create `PdfThumbnailSidebarTrigger`, `EmailAttachmentSidebarTrigger`,
`SplitSegmentSidebarTrigger`, or similar domain triggers.

Do not preserve two parallel ways to collapse viewer sidebars. There should be
one final path.

## Final Vocabulary

Add these viewer primitives:

```txt
ViewerSidebarProvider
useViewerSidebar
useOptionalViewerSidebar
ViewerSidebarTrigger
```

Extend these existing primitives:

```txt
ViewerRoot
ViewerBody
ViewerSidebar
ViewerSurface
```

Do not rename the domain sidebars:

```txt
PdfViewerThumbnails
AttachmentSidebar
SegmentSidebar
FileSystemViewerTree
AnchoredDocumentSidebar
```

The final dependency direction is:

```txt
ViewerSidebarProvider
  -> ViewerSidebarTrigger
  -> ViewerSidebar

PdfViewerProvider
  -> PdfViewerHeader
  -> PdfViewerPages
  -> PdfViewerThumbnails

EmailViewerProvider
  -> EmailViewerHeader
  -> EmailViewerPartsSidebar
  -> EmailViewerSelectedPart
```

Domain providers should not own viewer sidebar open state unless the domain has
a semantic reason to control it. "The thumbnail rail is visible" is layout state,
not PDF state.

## Component Contract

### `ViewerSidebarProvider`

Purpose:

```txt
Own sidebar visibility for one ViewerRoot composition.
```

Proposed API:

```ts
type ViewerSidebarState = "expanded" | "collapsed"

interface ViewerSidebarContextValue {
  state: ViewerSidebarState
  open: boolean
  setOpen: (value: boolean | ((open: boolean) => boolean)) => void
  toggleSidebar: () => void
}

interface ViewerSidebarProviderProps
  extends React.ComponentProps<"div"> {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}
```

Rules:

- `defaultOpen` defaults to `true`.
- Controlled and uncontrolled modes are both supported.
- No cookie persistence.
- No local storage persistence.
- No global keyboard shortcut by default.
- No mobile sheet state in the first version.
- No domain terms in the API.
- The provider renders a normal `div`, not a special visual shell.
- It sets data attributes for styling and tests:

```txt
data-slot="viewer-sidebar-provider"
data-viewer-sidebar-state="expanded|collapsed"
```

Reason:

The provider must be boring. It only answers the question "is the viewer sidebar
open?" Anything beyond that will leak app-shell behavior into document
viewers.

### `useViewerSidebar`

Purpose:

```txt
Read and mutate viewer sidebar state.
```

Contract:

```ts
function useViewerSidebar(): ViewerSidebarContextValue
```

Rules:

- Throws a clear error when called outside `ViewerSidebarProvider`.
- Mirrors shadcn's `useSidebar` ergonomics.
- Does not infer a default provider.

The error should be:

```txt
useViewerSidebar must be used within a ViewerSidebarProvider.
```

### `useOptionalViewerSidebar`

Purpose:

```txt
Let low-level primitives adapt when a provider exists without requiring one.
```

Contract:

```ts
function useOptionalViewerSidebar(): ViewerSidebarContextValue | null
```

Rules:

- Returns `null` outside a provider.
- Used by `ViewerSidebar` if collapsing is provider-driven.
- Not used by `ViewerSidebarTrigger`, because a trigger without a provider is a
  programmer error.

### `ViewerSidebarTrigger`

Purpose:

```txt
Render a header button that toggles the viewer sidebar.
```

Proposed API:

```ts
interface ViewerSidebarTriggerProps
  extends React.ComponentProps<typeof Button> {
  side?: "left" | "right"
}
```

Rules:

- Uses the shared `Button` primitive.
- Defaults to `variant="ghost"` and `size="icon"`.
- Uses a lucide panel icon.
- Has a stable accessible name:

```txt
Toggle sidebar
```

- Calls the user's `onClick` first.
- Does not toggle if the user prevents default.
- Supports disabled and loading behavior exactly like the existing sidebar
  trigger.
- Sets:

```txt
data-slot="viewer-sidebar-trigger"
data-viewer-sidebar-trigger=""
data-side="left|right"
aria-pressed={open}
```

Reason:

This should feel like shadcn's `SidebarTrigger`: tiny, composable, and
context-driven. It should not know whether the sidebar contains thumbnails,
attachments, segments, pages, files, OCR fields, or source boxes.

### `ViewerSidebar`

Purpose:

```txt
Reserve and render one sidebar region inside ViewerBody.
```

Current API:

```ts
function ViewerSidebar(props: React.ComponentProps<"aside">)
```

Target API:

```ts
interface ViewerSidebarProps extends React.ComponentProps<"aside"> {
  side?: "left" | "right"
  collapsible?: "offcanvas" | "none"
}
```

Rules:

- `side` defaults to `left`.
- `collapsible` defaults to `none` when no provider exists.
- `collapsible` defaults to `offcanvas` when a provider exists.
- The sidebar remains inside normal document flow.
- On desktop, collapsed `offcanvas` means the sidebar's width becomes `0`.
- On mobile, first implementation can use the same width collapse behavior.
- No fixed viewport positioning.
- No `Sheet` in the first version.
- No icon rail in the first version.
- No `h-svh`.
- Uses `overflow-hidden` while collapsed.
- Sets:

```txt
data-slot="viewer-sidebar"
data-side="left|right"
data-collapsible="offcanvas|none"
data-state="expanded|collapsed"
```

Base classes:

```txt
min-h-0 flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-linear
```

Expanded width:

```txt
w-(--viewer-sidebar-width)
```

Collapsed width:

```txt
w-0
```

Reason:

Viewer sidebars are embedded layout columns. Their collapse should affect only
the viewer body, not the page, viewport, route shell, or application sidebar.

### `ViewerBody`

Purpose:

```txt
Lay out sidebar and surface as siblings.
```

No required API change.

It may receive data attributes from descendants but should not own state.

### `ViewerHeader`

Purpose:

```txt
Render the top bar above ViewerBody.
```

No required API change.

Domain headers can choose to include `ViewerSidebarTrigger` directly:

```tsx
<ViewerHeader>
  <ViewerSidebarTrigger side="left" />
  <div className="min-w-0 truncate">nvidia-10k-fy2024.pdf</div>
  <PdfViewerControls />
</ViewerHeader>
```

Or domain headers can expose a `leading` slot:

```tsx
<PdfViewerHeader leading={<ViewerSidebarTrigger side="left" />} />
```

The stricter final design is direct composition. A `leading` slot is acceptable
only when the header is still an easy API component that owns internal layout.

## Relationship To Existing Sidebar Primitives

The app/sidebar system remains useful:

```txt
SidebarProvider
Sidebar
SidebarHeader
SidebarContent
SidebarGroup
SidebarMenu
SidebarMenuButton
SidebarTrigger
```

But it serves two different jobs today:

```txt
app shell sidebar
embedded sidebar row grammar
```

For viewer sidebar toggling, the provider should not be `SidebarProvider`.

Why:

- app shell sidebars can persist state;
- app shell sidebars can have global keyboard shortcuts;
- app shell sidebars can use viewport-fixed positioning;
- app shell sidebars can switch to a mobile sheet;
- embedded viewer sidebars must be contained by `ViewerBody`;
- embedded viewer sidebars often exist inside blocks, docs examples, dialogs,
  tabs, or split panes.

The viewer system should reuse sidebar row grammar where appropriate:

```tsx
<ViewerSidebar>
  <EmbeddedSidebarProvider>
    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu />
      </SidebarGroup>
    </SidebarContent>
  </EmbeddedSidebarProvider>
</ViewerSidebar>
```

But this is about content styling, not layout state.

## Ideal PDF Thumbnail Composition

The PDF thumbnail block should become:

```tsx
export function PdfThumbnailsBlock() {
  return (
    <div className="h-full min-h-[680px] bg-background">
      <PdfViewerProvider source={PDF_SOURCE}>
        <ViewerSidebarProvider defaultOpen>
          <ViewerRoot bare className="h-full">
            <PdfViewerHeader
              leading={<ViewerSidebarTrigger side="left" />}
            />
            <ViewerBody>
              <ViewerSidebar
                side="left"
                collapsible="offcanvas"
                className="border-r"
                style={
                  {
                    "--viewer-sidebar-width": "9rem",
                  } as React.CSSProperties
                }
              >
                <PdfViewerThumbnails />
              </ViewerSidebar>
              <ViewerSurface>
                <PdfViewerPages bare className="h-full" />
              </ViewerSurface>
            </ViewerBody>
          </ViewerRoot>
        </ViewerSidebarProvider>
      </PdfViewerProvider>
    </div>
  )
}
```

Better long-term composition:

```tsx
<PdfViewerProvider source={PDF_SOURCE}>
  <ViewerSidebarProvider defaultOpen>
    <ViewerRoot bare className="h-full">
      <ViewerHeader className="flex min-h-10 items-center gap-2 px-2 py-1">
        <ViewerSidebarTrigger side="left" />
        <PdfViewerTitle />
        <PdfViewerControls />
      </ViewerHeader>
      <ViewerBody>
        <ViewerSidebar side="left" collapsible="offcanvas" className="w-36 border-r">
          <PdfViewerThumbnails />
        </ViewerSidebar>
        <ViewerSurface>
          <PdfViewerPages bare className="h-full" />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </ViewerSidebarProvider>
</PdfViewerProvider>
```

The second version is more perfect because `PdfViewerHeader` is not a magic
slot component. It is just composed from title and controls.

## Ideal Email Composition

Email has two relevant sidebars:

```txt
message body / attachment navigation
selected attachment's own internal document sidebar
```

The outer email sidebar should be controlled by the outer viewer sidebar
provider:

```tsx
<EmailViewerProvider message={message}>
  <ViewerSidebarProvider defaultOpen>
    <ViewerRoot>
      <ViewerHeader className="flex items-center gap-2">
        <ViewerSidebarTrigger side="right" />
        <EmailViewerHeaderSummary />
      </ViewerHeader>
      <ViewerBody>
        <ViewerSurface>
          <EmailViewerSelectedPart />
        </ViewerSurface>
        <ViewerSidebar side="right" collapsible="offcanvas" className="border-l">
          <EmailViewerPartsSidebar />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  </ViewerSidebarProvider>
</EmailViewerProvider>
```

If the selected part is a PDF attachment with thumbnails, that attachment can
have its own nested viewer sidebar provider:

```tsx
<ViewerSurface>
  <PdfViewerProvider source={selectedPdfSource}>
    <ViewerSidebarProvider defaultOpen={false}>
      <ViewerRoot bare className="h-full">
        <ViewerHeader>
          <ViewerSidebarTrigger side="left" />
          <PdfViewerTitle />
          <PdfViewerControls />
        </ViewerHeader>
        <ViewerBody>
          <ViewerSidebar side="left" collapsible="offcanvas">
            <PdfViewerThumbnails />
          </ViewerSidebar>
          <ViewerSurface>
            <PdfViewerPages bare />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </ViewerSidebarProvider>
  </PdfViewerProvider>
</ViewerSurface>
```

This is recursive, but not confusing:

```txt
outer provider controls email parts sidebar
inner provider controls selected PDF thumbnail sidebar
```

Each trigger reads the closest provider.

## Ideal Split Viewer Composition

Split has segment navigation and document rendering.

```tsx
<SplitViewerProvider result={result}>
  <ViewerSidebarProvider defaultOpen>
    <ViewerRoot>
      <ViewerHeader>
        <ViewerSidebarTrigger side="left" />
        <SplitViewerLegend />
        <PdfViewerControls />
      </ViewerHeader>
      <ViewerBody>
        <ViewerSidebar side="left" collapsible="offcanvas" className="border-r">
          <SplitViewerSidebar />
        </ViewerSidebar>
        <ViewerSurface>
          <SplitViewerDocument />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </ViewerSidebarProvider>
</SplitViewerProvider>
```

`SplitViewerProvider` owns selected segment, preview segment, current page, and
scroll commands. `ViewerSidebarProvider` owns only whether the segment sidebar
is visible.

## Ideal Extraction And OCR Composition

Extraction and OCR should share the same anchored-document shape:

```tsx
<AnchoredDocumentProvider items={items}>
  <ViewerSidebarProvider defaultOpen>
    <ViewerRoot>
      <ViewerHeader>
        <ViewerSidebarTrigger side="right" />
        <AnchoredDocumentTitle />
        <AnchoredDocumentControls />
      </ViewerHeader>
      <ViewerBody>
        <ViewerSurface>
          <AnchoredDocumentSurface />
        </ViewerSurface>
        <ViewerSidebar side="right" collapsible="offcanvas" className="border-l">
          <AnchoredDocumentSidebar />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  </ViewerSidebarProvider>
</AnchoredDocumentProvider>
```

Again:

```txt
anchored provider owns semantic item to document target state
viewer sidebar provider owns sidebar visibility
```

This prevents OCR/extraction sidebar behavior from polluting the viewer
primitive.

## Controlled State

A composed viewer may expose controlled sidebar state only when it is part of
the public easy API:

```ts
interface PdfThumbnailsViewerProps {
  sidebarOpen?: boolean
  defaultSidebarOpen?: boolean
  onSidebarOpenChange?: (open: boolean) => void
}
```

The implementation should pass those props to `ViewerSidebarProvider`:

```tsx
<ViewerSidebarProvider
  open={sidebarOpen}
  defaultOpen={defaultSidebarOpen}
  onOpenChange={onSidebarOpenChange}
>
  ...
</ViewerSidebarProvider>
```

Do not duplicate state in the composed viewer.

## Naming Rules

Use `open` for the boolean state.

Use `state` for the derived string:

```txt
expanded
collapsed
```

Use `toggleSidebar` for the action.

Use `setOpen` for the setter.

Use `side` for visual side:

```txt
left
right
```

Use `collapsible` for behavior:

```txt
offcanvas
none
```

Do not introduce synonyms:

```txt
visible
shown
hidden
expandedSidebar
isSidebarVisible
isPanelOpen
drawerOpen
railOpen
```

The only exception is public prose. Code should use the exact vocabulary.

## Data Attributes

Provider:

```txt
data-slot="viewer-sidebar-provider"
data-viewer-sidebar-state="expanded|collapsed"
```

Trigger:

```txt
data-slot="viewer-sidebar-trigger"
data-viewer-sidebar-trigger=""
data-side="left|right"
aria-pressed="true|false"
```

Sidebar:

```txt
data-slot="viewer-sidebar"
data-side="left|right"
data-collapsible="offcanvas|none"
data-state="expanded|collapsed"
```

Body remains:

```txt
data-slot="viewer-body"
```

Surface remains:

```txt
data-slot="viewer-surface"
```

These attributes make tests and styling stable without exposing more props.

## Accessibility

The trigger must be a real button.

The trigger accessible name is:

```txt
Toggle sidebar
```

Use `aria-pressed={open}` because the control toggles a persistent viewer
region.

The sidebar should have an optional accessible label:

```ts
interface ViewerSidebarProps {
  "aria-label"?: string
}
```

Callers should label domain sidebars:

```tsx
<ViewerSidebar aria-label="Page thumbnails">
  <PdfViewerThumbnails />
</ViewerSidebar>
```

```tsx
<ViewerSidebar aria-label="Email parts">
  <EmailViewerPartsSidebar />
</ViewerSidebar>
```

When collapsed with width `0`, the sidebar should not be focusable through its
children. The simplest first version is:

```txt
inert when collapsed
aria-hidden when collapsed
```

Implementation detail:

```tsx
inert={state === "collapsed" ? "" : undefined}
aria-hidden={state === "collapsed" ? true : undefined}
```

If React typing for `inert` is awkward, use a small typed helper instead of
dropping the behavior.

## Visual Rules

The trigger should sit at the left edge when it controls a left sidebar:

```txt
[trigger] [file title] [page] [controls]
```

The trigger should sit near the right actions when it controls a right sidebar:

```txt
[email summary] [controls] [trigger]
```

But this is header composition, not primitive logic.

The primitive should not auto-position itself.

Collapsed sidebars should animate width only. Do not animate transform in the
first version because the sidebar is in flow and width directly communicates the
layout change.

The thumbnail rail should not reserve blank gutter when collapsed.

The document surface should immediately take the freed width.

## Implementation Plan

### Step 1. Add viewer sidebar context

File:

```txt
registry/new-york-v4/ui/viewer.tsx
```

Add:

```txt
ViewerSidebarContext
ViewerSidebarProvider
useViewerSidebar
useOptionalViewerSidebar
```

Keep it in `viewer.tsx` at first because this is a primitive-level concern and
the file is still small.

If `viewer.tsx` becomes too large after implementation, split only the context
into:

```txt
registry/new-york-v4/ui/viewer-sidebar-context.tsx
```

Do not split preemptively.

### Step 2. Add `ViewerSidebarTrigger`

File:

```txt
registry/new-york-v4/ui/viewer.tsx
```

Imports:

```ts
import { PanelLeft, PanelRight } from "lucide-react"
import { Button } from "@/components/ui/button"
```

Use `PanelLeft` for `side="left"` and `PanelRight` for `side="right"`.

Preserve the existing trigger behavior from the app sidebar:

```txt
call onClick
respect event.defaultPrevented
respect disabled/loading/aria-disabled
type="button"
variant="ghost"
size="icon"
```

### Step 3. Extend `ViewerSidebar`

File:

```txt
registry/new-york-v4/ui/viewer.tsx
```

Read optional provider:

```ts
const sidebar = useOptionalViewerSidebar()
```

Derive:

```ts
const state = sidebar?.state ?? "expanded"
const effectiveCollapsible = collapsible ?? (sidebar ? "offcanvas" : "none")
```

For `collapsible="none"`, render current behavior.

For `collapsible="offcanvas"`, use provider state to set collapsed width,
attributes, `inert`, and `aria-hidden`.

### Step 4. Update PDF thumbnail block

File:

```txt
registry/new-york-v4/blocks/pdf-thumbnails-block.tsx
```

Wrap the viewer in `ViewerSidebarProvider`.

Add `ViewerSidebarTrigger` to the header.

If `PdfViewerHeader` cannot accept children or leading content cleanly, do not
add a one-off prop as the final design. Instead, compose the header explicitly:

```tsx
<ViewerHeader>
  <ViewerSidebarTrigger />
  <PdfViewerTitle />
  <PdfViewerControls />
</ViewerHeader>
```

If `PdfViewerTitle` and `PdfViewerControls` are not exported separately, that is
the next API gap to fix.

### Step 5. Update composed viewer examples

Update every composed viewer that has a sidebar:

```txt
pdf thumbnails
email viewer
split viewer
file-system viewer
dropzone file viewer if it has a queue/sidebar
extraction viewer
OCR viewer
```

Each should use the same pattern:

```tsx
<ViewerSidebarProvider>
  <ViewerRoot>
    <ViewerHeader>
      <ViewerSidebarTrigger />
      ...
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar>
        ...
      </ViewerSidebar>
      <ViewerSurface>
        ...
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</ViewerSidebarProvider>
```

Do not implement per-domain sidebar state unless there is a domain-specific
semantic reason.

### Step 6. Registry build

Run:

```txt
bun run registry:build
```

Confirm `components/ui/viewer.tsx` still re-exports the registry source.

## Required Tests

### Primitive tests

Add to `tests/viewer.test.tsx` or a new focused file:

```txt
ViewerSidebarTrigger toggles ViewerSidebar from expanded to collapsed.
ViewerSidebarTrigger toggles back to expanded.
ViewerSidebar starts expanded by default.
ViewerSidebarProvider supports defaultOpen=false.
ViewerSidebarProvider supports controlled open/onOpenChange.
ViewerSidebarTrigger respects preventDefault.
ViewerSidebarTrigger respects disabled.
ViewerSidebarTrigger has accessible name "Toggle sidebar".
ViewerSidebar receives data-state="collapsed" when closed.
ViewerSidebar has aria-hidden when collapsed.
ViewerSidebar is inert when collapsed.
useViewerSidebar throws outside provider.
useOptionalViewerSidebar returns null outside provider.
```

### Architecture tests

Add to `tests/viewer-architecture.test.ts`:

```txt
ViewerSidebarProvider exports from viewer primitive module.
ViewerSidebarTrigger exports from viewer primitive module.
Pdf thumbnail block uses ViewerSidebarProvider.
Pdf thumbnail block does not import app SidebarProvider.
Pdf thumbnail block does not import app SidebarTrigger.
ViewerSidebarTrigger does not import PDF, email, split, extraction, OCR, file-system, or thumbnail modules.
ViewerSidebarProvider does not import domain modules.
```

### Composed viewer tests

For every composed viewer with a sidebar:

```txt
clicking the header trigger collapses only that viewer sidebar.
clicking the header trigger does not unmount the document renderer.
clicking the header trigger lets the surface expand.
nested viewer sidebar providers control the nearest sidebar only.
```

The nested provider test matters for email attachments:

```txt
outer trigger toggles email parts sidebar
inner trigger toggles selected PDF thumbnail sidebar
outer trigger does not affect inner PDF thumbnails
inner trigger does not affect outer email parts
```

### Visual verification

Use the browser against:

```txt
/view/blocks/pdf-thumbnails
/email-viewer
/view/blocks/split
/view/blocks/file-system
/view/blocks/extract
/view/blocks/extraction-viewer
/view/blocks/ocr
```

Check:

```txt
header trigger is visible
trigger aligns with the controlled sidebar side
sidebar collapses without leaving a blank gutter
surface expands
surface content remains rendered
no nested ViewerRoot appears because of this change
no console errors
```

## Failure Modes

### Failure Mode 1. The provider becomes a domain provider

Symptom:

```ts
interface ViewerSidebarProviderProps {
  thumbnails?: boolean
  attachments?: boolean
  segments?: boolean
}
```

Fix:

Delete the props. Domain content belongs inside `ViewerSidebar`, not on the
provider.

### Failure Mode 2. The trigger becomes a PDF trigger

Symptom:

```tsx
<PdfThumbnailTrigger />
```

Fix:

Use `ViewerSidebarTrigger`. If the icon needs to communicate thumbnails, that
can be a caller choice through children or `render`, but the primitive name
stays generic.

### Failure Mode 3. The sidebar uses app-shell positioning

Symptom:

```txt
fixed inset-y-0 h-svh
```

Fix:

Remove it from viewer sidebars. Embedded sidebars must remain in `ViewerBody`.

### Failure Mode 4. Width collapse leaves a ghost gap

Symptom:

```txt
sidebar content disappears but ViewerSurface does not expand
```

Fix:

Collapse the actual layout column width, not only the inner content opacity or
transform.

### Failure Mode 5. Collapsed content remains focusable

Symptom:

```txt
tab key enters hidden thumbnail buttons
```

Fix:

Apply `inert` and `aria-hidden` to collapsed sidebar content.

### Failure Mode 6. Nested providers toggle the wrong sidebar

Symptom:

```txt
email header trigger collapses selected PDF thumbnail rail
```

Fix:

Check provider placement. Each trigger reads the nearest
`ViewerSidebarProvider`, so provider boundaries must wrap exactly one
`ViewerRoot` composition.

## Final Shape

The perfect mental model:

```txt
ViewerRoot is the box.
ViewerHeader is the top row.
ViewerBody is the horizontal layout.
ViewerSidebar is one collapsible column.
ViewerSurface is the remaining content.
ViewerSidebarProvider is the local state for that column.
ViewerSidebarTrigger is a button that toggles that local state.
```

Nothing in that list says PDF, email, extraction, OCR, files, MIME, thumbnails,
segments, or upload. That is the sign the primitive is right.

The domain viewer then becomes obvious:

```txt
PDF viewer puts thumbnails in ViewerSidebar.
Email viewer puts parts in ViewerSidebar.
Split viewer puts segments in ViewerSidebar.
File-system viewer puts the tree in ViewerSidebar.
Extraction viewer puts fields or sources in ViewerSidebar.
OCR viewer puts OCR items in ViewerSidebar.
```

The header trigger is always the same primitive.

## Acceptance Criteria

This blueprint is implemented when:

- `ViewerSidebarProvider`, `useViewerSidebar`, `useOptionalViewerSidebar`, and
  `ViewerSidebarTrigger` exist in the viewer primitive module;
- `ViewerSidebar` can collapse inside `ViewerBody` without app-shell
  positioning;
- the PDF thumbnail block has a working header sidebar trigger;
- the email viewer can have an outer parts trigger and an inner attachment PDF
  thumbnail trigger without state collision;
- split, extraction, OCR, file-system, and dropzone compositions can use the
  same primitive;
- no domain module imports into `viewer.tsx`;
- no viewer sidebar behavior requires `SidebarProvider` or `SidebarTrigger`;
- tests cover primitive behavior, nested providers, and at least one composed
  viewer;
- browser verification confirms no blank gutter, no missing document content,
  and no console errors.

## Implementation Priority

1. Implement the primitive in `viewer.tsx`.
2. Convert the PDF thumbnail block because it exposes the missing trigger today.
3. Add primitive and PDF block tests.
4. Convert email because it proves nested provider recursion.
5. Convert split because it proves segment sidebars.
6. Convert extraction and OCR together because they should share the anchored
   viewer shape.
7. Convert file-system and dropzone if their sidebar/queue layouts need the
   same trigger.
8. Run registry build, typecheck, focused tests, full tests, and browser
   verification.

## Final Judgment

This is the right direction if the primitive stays small.

The shadcn pattern teaches one essential thing: distant components should
coordinate through a tiny provider when they are parts of one local composition.

For app navigation, that provider is `SidebarProvider`.

For document viewers, it should be `ViewerSidebarProvider`.

That gives us the expressivity we lost when we separated header and sidebar,
without making headers know about sidebars by prop drilling and without making
domain viewers own layout state that is not domain state.
