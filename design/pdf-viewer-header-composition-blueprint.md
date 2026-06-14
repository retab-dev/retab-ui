# PDF Viewer Header Composition Blueprint

## Objective

Decide the platonic shape of the PDF viewer header.

The question is whether this is good enough:

```tsx
<PdfViewerHeader start={<ViewerSidebarTrigger />} />
```

The answer is:

```txt
Good.
Not perfect.
The final shape should expose the real header anatomy.
```

This blueprint focuses only on PDF header composition. It does not cover the
PDF thumbnail rail, email, file-system, split viewer, OCR, or extraction
viewer.

## Current Shape

The composed PDF thumbnail block currently reads:

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot bare defaultSidebarOpen>
    <PdfViewerHeader start={<ViewerSidebarTrigger />} />
    <ViewerBody>
      <ViewerSidebar aria-label="PDF pages" width="9rem">
        <PdfViewerThumbnails />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerPages bare />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

`PdfViewerHeader` renders:

```txt
ViewerHeader
  start slot
  file name
  PDF controls or page fallback
```

This is compact. It is also understandable.

But it makes `PdfViewerHeader` do two jobs:

```txt
preassembled PDF header
layout slot for external viewer controls
```

That is the flaw.

## Ownership

The sidebar trigger is not PDF state.

```txt
ViewerSidebarTrigger belongs to ViewerRoot.
PdfViewerHeaderTitle belongs to PdfViewerProvider.
PdfViewerHeaderControls belongs to PdfViewerProvider and PdfViewerPages.
ViewerHeader belongs to the spatial viewer primitive.
```

Therefore this is slightly wrong:

```tsx
<PdfViewerHeader start={<ViewerSidebarTrigger />} />
```

The trigger is being passed through a PDF component even though it is a viewer
spatial control. The prop is small, but the ownership is not exact.

## The Core Judgment

There are two possible header levels:

```txt
ViewerHeader = primitive layout row.
PdfViewerHeader = PDF-styled convenience row.
```

Both can exist, but they must not compete for the same responsibility.

The current `start` prop makes `PdfViewerHeader` a half-composed component:

```txt
some structure is hidden
some structure is injected
some behavior is controlled by props
some behavior is read from context
```

That is not Flaubertian. It is a usable compromise, not the final grammar.

## Final Shape

The composed API should expose the real anatomy:

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot bare defaultSidebarOpen>
    <ViewerHeader className="flex min-h-10 items-center gap-3 px-2 py-1">
      <ViewerSidebarTrigger />
      <PdfViewerHeaderTitle />
      <PdfViewerHeaderControls />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar aria-label="PDF pages" width="9rem">
        <PdfViewerThumbnails />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerPages bare />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

This is the ideal because every component says what it owns:

```txt
ViewerHeader owns the row.
ViewerSidebarTrigger owns sidebar toggling.
PdfViewerHeaderTitle owns the PDF label.
PdfViewerHeaderControls owns PDF page, zoom, rotate, fit, and download controls.
PdfViewerThumbnails owns page thumbnail navigation.
PdfViewerPages owns rendered PDF pages.
```

Nothing is smuggled through a generic slot.

## Public Exports

The PDF viewer should export these named parts:

```ts
export {
  PdfViewerHeaderTitle,
  PdfViewerHeaderControls,
  PdfViewerHeaderPageIndicator,
}
```

`PdfViewerHeader` may remain only if it is clearly a convenience component:

```ts
export function PdfViewerHeader(props: PdfViewerHeaderProps)
```

But it should not be the conceptual center.

## Component Contracts

### `PdfViewerHeaderTitle`

Reads PDF resource state from `PdfViewerProvider`.

```tsx
<PdfViewerHeaderTitle />
```

Contract:

```txt
reads resource.fileName
falls back to "PDF"
renders one truncating text node
does not render toolbar controls
does not know about sidebars
does not accept semantic overrides
```

Suggested shape:

```ts
type PdfViewerHeaderTitleProps = {
  className?: string
}
```

### `PdfViewerHeaderControls`

Reads header controls from `PdfViewerProvider`.

```tsx
<PdfViewerHeaderControls />
```

Contract:

```txt
renders PDF controls when PdfViewerPages has registered them
renders a page indicator fallback before controls exist
renders nothing when controls are disabled
does not render file name
does not render sidebar trigger
```

Suggested shape:

```ts
type PdfViewerHeaderControlsProps = {
  className?: string
  fallback?: React.ReactNode
}
```

The fallback prop is acceptable only if it is a visual fallback. It must not
accept alternate PDF state.

### `PdfViewerHeaderPageIndicator`

Small fallback component for early loading or no-toolbar states.

```tsx
<PdfViewerHeaderPageIndicator />
```

Contract:

```txt
reads currentPage from PdfViewerProvider
renders "Page N" when currentPage exists
renders null when currentPage is unknown
does not know pageCount unless the full controls have registered it
```

Suggested shape:

```ts
type PdfViewerHeaderPageIndicatorProps = {
  className?: string
}
```

## What Happens To `PdfViewerHeader`

There are two acceptable paths.

### Path A: Remove It From Composed Docs

The composed docs use the primitive row directly:

```tsx
<ViewerHeader className="flex min-h-10 items-center gap-3 px-2 py-1">
  <ViewerSidebarTrigger />
  <PdfViewerHeaderTitle />
  <PdfViewerHeaderControls />
</ViewerHeader>
```

`PdfViewerHeader` stays internal to the easy `PdfViewer` component or disappears.

This is the cleanest conceptual model.

### Path B: Keep It As A Styled Row Only

If the library wants a PDF-specific row wrapper, make it a true layout wrapper:

```tsx
<PdfViewerHeader>
  <ViewerSidebarTrigger />
  <PdfViewerHeaderTitle />
  <PdfViewerHeaderControls />
</PdfViewerHeader>
```

Then `PdfViewerHeader` owns only style:

```txt
data-slot
height
gap
padding
border/background inherited from ViewerHeader
```

It does not render title by default.
It does not render controls by default.
It does not accept `start`.
It does not accept `toolbar`.

Suggested shape:

```ts
type PdfViewerHeaderProps = React.ComponentProps<typeof ViewerHeader>
```

This is also coherent.

## Preferred Decision

Prefer Path A.

Use the existing primitive:

```tsx
<ViewerHeader>...</ViewerHeader>
```

Reason:

```txt
ViewerHeader already exists.
It already means layout row.
Adding a PDF row wrapper creates another row concept.
The PDF-specific pieces are title and controls, not the row itself.
```

The only reason to choose Path B is if the PDF header has a distinctive,
repeated style that should be imported as one component. Today it does not. It
is just a viewer header row with PDF children.

## Easy API

The easy `PdfViewer` component should still be preassembled:

```tsx
<PdfViewer source={source} />
```

Internally it should compose the same parts:

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot bare={bare} className={cn("h-full", className)}>
    <ViewerHeader className="flex min-h-10 items-center gap-3 px-2 py-1">
      <PdfViewerHeaderTitle />
      {toolbar ? <PdfViewerHeaderControls /> : null}
    </ViewerHeader>
    <ViewerBody>
      <ViewerSurface>
        <PdfViewerPages {...pagesProps} bare className="h-full" ref={ref} />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

The easy API does not need a sidebar trigger because it does not render a
sidebar by default.

## Why This Is More Shadcn-Compliant

shadcn-style APIs expose anatomy:

```txt
Root
Trigger
Content
Header
Title
Description
Footer
Action
```

They do not usually hide a major child behind a vague prop when that child is a
real component with its own ownership.

The final PDF header should follow that rule:

```txt
ViewerHeader is the row.
ViewerSidebarTrigger is the trigger.
PdfViewerHeaderTitle is the title.
PdfViewerHeaderControls is the action cluster.
```

The JSX becomes documentation.

## What Not To Do

Do not add more slots:

```tsx
<PdfViewerHeader
  start={...}
  end={...}
  title={...}
  controls={...}
  beforeControls={...}
/>
```

This is worse than both alternatives. It creates an object API for something
that JSX already expresses better.

Do not make the sidebar trigger a PDF prop:

```tsx
<PdfViewerHeader sidebarTrigger />
```

The trigger belongs to `ViewerRoot`, not PDF.

Do not make `PdfViewerHeaderControls` accept explicit PDF state unless there is
a separate controlled primitive. The provider-bound component should read from
context only.

## Implementation Steps

1. Add `PdfViewerHeaderTitle`.
2. Add provider-bound `PdfViewerHeaderControls`.
3. Add `PdfViewerHeaderPageIndicator` if the fallback remains necessary.
4. Change `PdfViewer` internals to compose `ViewerHeader`,
   `PdfViewerHeaderTitle`, and `PdfViewerHeaderControls`.
5. Change the PDF thumbnail block to compose `ViewerHeader`,
   `ViewerSidebarTrigger`, `PdfViewerHeaderTitle`, and
   `PdfViewerHeaderControls`.
6. Update docs to show the anatomy-first composition.
7. Remove `start` from `PdfViewerHeader`, or remove `PdfViewerHeader` from the
   composed public story entirely.
8. Add architecture tests that prevent `PdfViewerHeader` from accepting
   `start`, `leading`, `sidebarTrigger`, or semantic control props.
9. Keep the easy `PdfViewer` API intact.
10. Regenerate registry artifacts.

No compatibility shim.
No deprecated prop.
No parallel header grammar.

## Test Contract

Required unit tests:

```txt
PdfViewerHeaderTitle renders resource.fileName
PdfViewerHeaderTitle falls back to "PDF"
PdfViewerHeaderControls renders registered controls
PdfViewerHeaderControls renders page fallback before controls register
PdfViewerHeaderControls renders nothing when disabled by composition
PdfViewer easy API composes the header parts
thumbnail block composes ViewerSidebarTrigger as a ViewerRoot child, not a PDF prop
```

Required architecture tests:

```txt
PdfViewerHeaderTitle is exported
PdfViewerHeaderControls is exported
PdfViewerHeader does not accept start
PdfViewerHeader does not accept leading
PdfViewerHeader does not accept sidebarTrigger
PDF thumbnail block uses <ViewerHeader>
PDF thumbnail block uses <ViewerSidebarTrigger>
PDF thumbnail block uses <PdfViewerHeaderTitle>
PDF thumbnail block uses <PdfViewerHeaderControls>
```

Required e2e tests:

```txt
header renders file name
header controls zoom in/out
header controls download action exists
sidebar trigger toggles from inside ViewerHeader
keyboard activation still works
```

## Final Verdict

`PdfViewerHeader start={<ViewerSidebarTrigger />}` is good API ergonomics, but
not perfect API anatomy.

The perfect shape is:

```tsx
<ViewerHeader>
  <ViewerSidebarTrigger />
  <PdfViewerHeaderTitle />
  <PdfViewerHeaderControls />
</ViewerHeader>
```

That version is simpler because ownership is visible.
It is faster to understand because every child maps to one thing on screen.
It has everything needed and nothing more.
It preserves the easy `PdfViewer` API without letting the easy API dictate the
composed API.
