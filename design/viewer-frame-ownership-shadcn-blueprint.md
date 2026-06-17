# Viewer Frame Ownership Shadcn Blueprint

## Verdict

The double-border issue is a symptom of a real design problem:

```txt
two layers believe they own the visible outer frame
```

The problem is not the border itself. The problem is that `ViewerRoot`,
`FileViewer`, renderer chrome, composed viewers, and docs block previews do not
share one precise rule for who owns the card-like surface.

The final rule should be:

```txt
state root and layout anatomy are unframed
visible frame is explicit
one viewer tree has at most one frame owner
```

This is the shadcn-grade direction.

## The Exact Decision

`ViewerRoot` should become the equivalent of shadcn's state/anatomy root:

```txt
scope
context
sidebar state
layout coordination
```

It should not be the card.

`FileViewer` should become the file-aware composition root:

```txt
file source normalization
file resource context
file controls registration
default file viewer anatomy
```

It should not be the card either.

`ViewerFrame` should be the only primitive whose job is:

```txt
draw the outer visible viewer card
```

That is the whole design. It is intentionally small.

The target is not to make every block manually erase borders. The target is to
make the first-party grammar impossible to misuse:

```tsx
<ViewerFrame>
  <FileViewer source={source} />
</ViewerFrame>
```

or:

```tsx
<BlockPreviewFrame>
  <FileViewer source={source} />
</BlockPreviewFrame>
```

but never:

```tsx
<BlockPreviewFrame>
  <ViewerFrame>
    <FileViewer source={source} />
  </ViewerFrame>
</BlockPreviewFrame>
```

The frame must be an explicit choice by exactly one owner.

## Why This Is A Design Smell

The double border is not merely bad CSS. It reveals an unnamed ownership
problem:

```txt
the docs block thinks it owns the preview surface
the viewer root thinks it owns the preview surface
the file viewer sometimes thinks it owns the preview surface
the nested renderer sometimes thinks it owns the preview surface
```

When several layers believe they own the same visual boundary, consumers start
writing defensive classes:

```tsx
className="rounded-none border-0"
```

That is the smell. It means the component model is making the caller repair an
internal ambiguity.

The right fix is not another prop:

```txt
framed={false}
variant="embedded"
inBlockPreview
unstyled
```

Those names preserve the ambiguity. The right fix is a named part:

```txt
ViewerFrame
```

There is then no hidden frame to disable.

## Current Evidence

The docs block preview creates a visible frame:

```tsx
<div className="relative box-content hidden overflow-hidden rounded-xl border bg-muted/30 md:block">
  <div className="relative z-10 h-full min-w-0 overflow-hidden rounded-xl bg-background">
    <BlockPreviewSurface />
  </div>
</div>
```

That lives in:

```txt
components/viewer-blocks.tsx
```

`ViewerRoot` also creates a visible frame unless `bare` is passed:

```tsx
className={cn(
  "relative flex min-h-0 flex-col overflow-hidden",
  bare ? "h-full" : "rounded-xl border bg-muted/30",
  className
)}
```

That lives in:

```txt
registry/new-york-v4/ui/viewer.tsx
```

So these blocks naturally produce:

```tsx
<BlockPreviewFrame>
  <ViewerRoot>
    ...
  </ViewerRoot>
</BlockPreviewFrame>
```

Visually, that is:

```txt
rounded border
  rounded border
    header / body / sidebar / surface
```

The recent local fix for sources:

```tsx
className="h-full rounded-none border-0 bg-background"
```

is acceptable as an emergency visual correction, but it is not a satisfying
system rule. It makes the consumer remember how to neutralize hidden chrome.

## Shadcn Reading

### Dialog

Shadcn `Dialog` separates state root from visible popup:

```tsx
<Dialog>
  <DialogTrigger />
  <DialogContent>
    <DialogHeader />
    <DialogTitle />
    <DialogDescription />
  </DialogContent>
</Dialog>
```

`Dialog` is scope and state. `DialogContent` is the framed visible surface.
There is no second card frame hidden inside `DialogHeader` or `DialogTitle`.

Reference:

```txt
https://ui.shadcn.com/docs/components/dialog
```

### Tabs

Shadcn `Tabs` is also disciplined:

```tsx
<Tabs>
  <TabsList>
    <TabsTrigger />
  </TabsList>
  <TabsContent />
</Tabs>
```

`TabsList` owns the tab-list styling. `TabsContent` is not automatically a card.
The caller decides whether the content is inside a card, a panel, a page, or a
plain surface.

Reference:

```txt
https://ui.shadcn.com/docs/components/tabs
```

### Field

Shadcn `Field` is even more precise:

```tsx
<FieldSet>
  <FieldLegend />
  <FieldDescription />
  <FieldGroup>
    <Field>
      <FieldLabel />
      <Input />
      <FieldDescription />
      <FieldError />
    </Field>
  </FieldGroup>
</FieldSet>
```

The component family provides semantic structure and spacing. It does not make
every field a decorative card.

Reference:

```txt
https://ui.shadcn.com/docs/components/field
```

### Sidebar

Shadcn `Sidebar` is the closest match to this viewer system.

It separates:

```txt
SidebarProvider  state
Sidebar          side panel surface
SidebarInset     main content surface
SidebarTrigger   remote control
```

The provider owns state. The visible parts own visible surfaces. The trigger can
live elsewhere because it reads provider state.

Reference:

```txt
https://ui.shadcn.com/docs/components/sidebar
```

The lesson for us is not "copy Sidebar exactly." The lesson is:

```txt
make state boundaries and surface boundaries different named things
```

## Shadcn Pattern, Reduced

The best shadcn components keep one hard boundary per concept:

| Component | State root | Visible surface | Remote/control part | Lesson |
| --- | --- | --- | --- | --- |
| `Dialog` | `Dialog` | `DialogContent` | `DialogTrigger` | The root does not draw the modal. |
| `Tabs` | `Tabs` | caller-owned content surface | `TabsTrigger` | Tabs do not force a card around content. |
| `Field` | `FieldSet` / `Field` | form controls and spacing | n/a | Anatomy is semantic, not decorative. |
| `Sidebar` | `SidebarProvider` | `Sidebar` / `SidebarInset` | `SidebarTrigger` | State can be global while surfaces stay explicit. |

The viewer equivalent should be:

| Viewer concept | Component | Responsibility |
| --- | --- | --- |
| viewer scope | `ViewerRoot` | sidebar state, measurement, layout context |
| visible card | `ViewerFrame` | outer radius, border, background, clipping |
| file scope | `FileViewer` | file source, resource, controls, default anatomy |
| top row | `FileViewerHeader` | title, meta, controls placement |
| main area | `FileViewerBody` | sidebar + surface layout |
| side panel | `FileViewerSidebar` | thumbnail/tree/parts/legend side content |
| document pane | `FileViewerSurface` | document viewport region |
| routed renderer | `FileViewerDocument` | PDF/image/text/CSV/etc. content |

This is shadcn-compliant because the names describe anatomy and ownership. They
do not encode application modes.

## Border Taxonomy

Not every border is a frame. The system needs precise language:

```txt
frame border
  The outer rounded card boundary. Owned only by ViewerFrame or by a host
  surface such as BlockPreview.

separator border
  A straight internal divider between header/body, sidebar/surface, tabs/body,
  or form panels. Owned by anatomy parts.

document border
  A page outline, image edge, spreadsheet grid, PDF canvas edge, or preview
  thumbnail border. Owned by the document renderer.
```

The double-border bug is about frame borders only.

This distinction matters because the final UI can still have:

```txt
header bottom border
sidebar right border
PDF page outline
thumbnail outline
field/input border
```

Those are not violations. The violation is:

```txt
rounded outer viewer frame inside another rounded outer viewer frame
```

That is why removing `ViewerRoot` frame ownership is cleaner than sprinkling
`border-0` through the system.

## The Design Error

The current viewer system has overloaded `ViewerRoot`.

It currently means all of this:

```txt
create sidebar state
create root context
define flex column layout
clip overflow
draw the card background
draw the border
apply rounded corners
choose embedded versus standalone appearance
```

That is too much.

`ViewerRoot` should mean:

```txt
viewer scope and spatial anatomy
```

It should not mean:

```txt
draw a card
```

Likewise, `FileViewer` should mean:

```txt
file source scope + file viewer anatomy + routed file document
```

It should not secretly mean:

```txt
draw an outer frame unless the caller remembers bare
```

## Final Mental Model

The component system should have three layers:

```txt
1. State roots
   own state and context

2. Anatomy parts
   own layout slots

3. Frame parts
   own visible card chrome
```

For shared viewer primitives:

```txt
ViewerRoot       state + layout scope
ViewerHeader     top row
ViewerBody       main flex region
ViewerSidebar    collapsible side region
ViewerSurface    document/content region
ViewerFrame      optional visible card frame
```

For file viewer:

```txt
FileViewer                file state + viewer root
FileViewerHeader          file header row
FileViewerTitle           file title
FileViewerMeta            file metadata
FileViewerControls        registered controls
FileViewerBody            file body region
FileViewerSidebar         file sidebar
FileViewerSidebarTrigger  file sidebar trigger
FileViewerSurface         file document surface
FileViewerDocument        routed file document
```

The important part:

```txt
FileViewer is not the frame.
ViewerRoot is not the frame.
ViewerFrame is the frame.
```

## Two Legal Shapes

There should be only two legal first-party shapes.

### Hosted Shape

Used inside docs block previews, app panels, dialogs, sheets, tabs, or any
parent that already supplies the outer surface.

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
  <FileViewerBody>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

No frame appears here.

### Standalone Shape

Used when the viewer is itself the visible object on the page.

```tsx
<ViewerFrame className="h-[680px]">
  <FileViewer source={source}>
    <FileViewerHeader />
    <FileViewerBody>
      <FileViewerSidebar />
      <FileViewerSurface>
        <FileViewerDocument />
      </FileViewerSurface>
    </FileViewerBody>
  </FileViewer>
</ViewerFrame>
```

The only difference is the explicit `ViewerFrame`.

This keeps the API small because there is no third mode.

## Target API

### Embedded Composition

This should be the default serious composition:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>

  <FileViewerBody>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

It should render no outer border and no outer radius by itself.

### Standalone Framed Viewer

When a visible card frame is wanted:

```tsx
<ViewerFrame>
  <FileViewer source={source}>
    <FileViewerHeader />
    <FileViewerBody>
      <FileViewerSurface>
        <FileViewerDocument />
      </FileViewerSurface>
    </FileViewerBody>
  </FileViewer>
</ViewerFrame>
```

The shorthand can still exist:

```tsx
<ViewerFrame>
  <FileViewer source={source} />
</ViewerFrame>
```

The shorthand is only omitted children. It is not a different architecture.

### Full Domain Viewer

Split should read like:

```tsx
<SplitViewerProvider result={result}>
  <FileViewer source={source} defaultOpen>
    <FileViewerHeader>
      <FileViewerSidebarTrigger />
      <FileViewerTitle />
      <SplitViewerHeaderMeta />
      <FileViewerControls />
    </FileViewerHeader>

    <FileViewerBody>
      <SplitViewerSidebar />
      <FileViewerSurface>
        <SplitViewerLegend />
        <SplitViewerDocument>
          <PdfViewerPages />
        </SplitViewerDocument>
      </FileViewerSurface>
    </FileViewerBody>
  </FileViewer>
</SplitViewerProvider>
```

In the docs block page, the block preview frame already supplies the visible
outside frame. Therefore this should not be wrapped in `ViewerFrame`.

In a raw app page, the author can add:

```tsx
<ViewerFrame>
  <SplitViewerBlock />
</ViewerFrame>
```

or make the page itself provide the frame.

### Nested Document Pane

Parse/OCR/Edit should not place a second framed file viewer inside the left
document pane.

The pane should be:

```tsx
<ViewerSurface>
  <FileViewer source={source}>
    <FileViewerBody>
      <FileViewerSurface>
        <PdfViewerPages />
      </FileViewerSurface>
    </FileViewerBody>
  </FileViewer>
</ViewerSurface>
```

Because `FileViewer` is unframed, this is safe. It creates file source context
and document routing without creating a nested card.

## What Happens To `bare`

`bare` should stop being the primary composition mechanism.

Today it means too many things depending on where it appears:

```txt
remove outer frame
hide local toolbar
render embedded document
skip full shell
standalone leaf preview
```

That is not precise enough.

The final system should prefer named boundaries:

```txt
ViewerFrame     draws outer card
FileViewer      creates file viewer state and anatomy
FileViewerDocument renders routed document inside a surface
PdfViewerPages  renders PDF pages
```

If a `bare` prop remains at all, it should mean exactly one thing:

```txt
do not draw this component's own optional frame
```

But the better target is to make `bare` unnecessary for first-party composed
viewer blocks.

## What Happens To Block Previews

Block previews are presentation infrastructure. They are not viewer
architecture.

The docs block preview can keep a frame:

```txt
rounded border around the registry example
```

But then registry viewer blocks must be authored as unframed viewer layouts.

The rule:

```txt
If BlockPreview is framed, the block root is unframed.
If the block intentionally demonstrates ViewerFrame, BlockPreview is frameless.
Never both.
```

This is the only rule that scales across:

```txt
sources
parse
partition
split
ocr
edit
pdf-thumbnails
file-system
dropzone
email
```

## Concrete Route Diagnosis

### Sources

The issue was:

```txt
BlockPreview frame + FileViewer frame
```

The local class override removed the symptom.

The final fix is:

```txt
FileViewer no longer draws the frame
```

Then the override can disappear.

### Split

Current shape:

```txt
BlockPreview frame + top-level FileViewer frame
```

Final shape:

```txt
BlockPreview frame + unframed FileViewer anatomy
```

### Partition

Same as split.

The top-level `FileViewer` is conceptually right, but it should not draw a
second outside frame.

### PDF Thumbnails

Same as split.

The `FileViewer` anatomy is correct:

```txt
header + thumbnail sidebar + PDF surface
```

The frame should come from docs preview or explicit `ViewerFrame`, not the root.

### Parse

Current shape:

```txt
outer bare ViewerRoot
left pane contains non-bare FileViewer
```

Final shape:

```txt
outer ViewerRoot
left pane contains unframed FileViewer or file document renderer
```

The parse viewer owns the split layout. The PDF pane should not look like a
standalone app embedded inside it.

### OCR

Current shape:

```txt
outer OCR ViewerRoot
document surface contains non-bare FileViewer
```

Final shape:

```txt
outer OCR ViewerRoot owns the shell
inner FileViewer supplies resource/document behavior only
```

### Edit

Current shape:

```txt
outer EditViewer root
document pane contains non-bare FileViewer for PDF preview
```

Final shape:

```txt
EditViewer owns the shell
FileViewer inside the document pane is unframed
```

## Naming Decision

The frame should be called:

```txt
ViewerFrame
```

Not:

```txt
FileViewerFrame
```

Reason:

```txt
border/radius/background are not file-specific
```

Split, partition, parse, OCR, edit, email, and file system can all be framed.
The frame belongs to the viewer visual system, not to file routing.

`FileViewerFrame` would reintroduce the wrong idea that file viewing owns the
outer card. It does not.

## Proposed `ViewerFrame`

Minimal implementation contract:

```tsx
export function ViewerFrame({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="viewer-frame"
      className={cn(
        "relative min-h-0 overflow-hidden rounded-xl border bg-background",
        className
      )}
      {...props}
    />
  )
}
```

No state.

No provider.

No sidebar logic.

No knowledge of files.

No knowledge of PDF.

Just the visible frame.

## Migration Plan

### Phase 1: Add `ViewerFrame`

Add `ViewerFrame` to the shared viewer primitive family.

It should be intentionally boring:

```txt
rounded border background overflow clipping
```

No props beyond native div props and className.

### Phase 2: Make `ViewerRoot` Unframed

Change `ViewerRoot` from:

```txt
bare ? h-full : rounded-xl border bg-muted/30
```

to:

```txt
relative flex min-h-0 flex-col overflow-hidden
```

If a height default is needed, keep layout height separate from frame styling.

### Phase 3: Remove First-Party `bare` Usage For Frame Removal

Update first-party composed viewers so they no longer pass `bare` merely to
avoid nested borders.

`bare` should not be how serious examples express composition.

### Phase 4: Update FileViewer Defaults

`FileViewer` with children:

```txt
creates file state
creates viewer root
renders children
draws no frame
```

`FileViewer` without children:

```txt
creates the default file viewer anatomy
draws no frame
```

A framed standalone example becomes:

```tsx
<ViewerFrame className="h-[680px]">
  <FileViewer source={source} />
</ViewerFrame>
```

### Phase 5: Update Registry Blocks

Normalize these blocks:

```txt
sources-viewer-block
parse-viewer-block
partition-viewer-block
split-viewer-block
ocr-block
edit-viewer-block
pdf-thumbnails-block
```

The target:

```txt
no rounded-none border-0 patches
no nested framed FileViewer
no root-level double frame
```

### Phase 6: Update Docs Preview Logic

Keep the existing docs preview frame for normal block pages.

Add or use a frameless preview mode only when the example intentionally
demonstrates `ViewerFrame` itself.

The docs should teach:

```txt
BlockPreview can frame the demo
ViewerFrame can frame userland viewers
never both
```

### Phase 7: Update Tests

Add architecture tests for:

```txt
ViewerRoot does not contain rounded-xl border bg-muted/30
ViewerFrame is the only shared primitive with rounded outer frame classes
first-party viewer blocks do not patch root frame with rounded-none border-0
parse/ocr/edit do not nest framed file viewers in document panes
public examples use ViewerFrame when demonstrating a standalone card
registry output matches source
```

Add visual tests for:

```txt
/blocks/sources-viewer
/blocks/parse
/blocks/partition
/blocks/split
/blocks/ocr
/blocks/edit
/blocks/pdf-thumbnails
```

The assertion should not be pixel-perfect aesthetics. It should prove:

```txt
one visible outside frame
no inner rounded border directly under the docs preview frame
headers and sidebars still have intentional separators
```

## Anti-Goals

Do not solve this by adding:

```txt
framed={false}
unstyled
embedded
surfaceMode
context="docs"
variant="in-block-preview"
```

Those are all symptoms of hidden frame ownership.

Do not keep adding:

```tsx
className="rounded-none border-0"
```

That is a consumer-side neutralizer, not an API.

Do not make `FileViewer` inspect ancestors to decide whether it should draw a
frame.

Do not make block previews know about each viewer type.

## Acceptance Criteria

The design is clean when these are true:

- `ViewerRoot` never draws the outer card frame.
- `ViewerFrame` is the only shared primitive that draws the outer card frame.
- `FileViewer` is a source-aware viewer root, not a frame.
- `FileViewerDocument` is routed document content, not a standalone preview
  card.
- first-party composed viewer blocks do not use `rounded-none border-0` to fight
  inherited chrome.
- parse, OCR, and edit can embed file/PDF document panes without nested frames.
- split, partition, and PDF thumbnails can be used inside docs preview without
  double borders.
- a standalone app can still create a polished file viewer with one explicit
  wrapper.
- docs teach one grammar.
- tests prevent regressions.

## Final Position

The platonic viewer system is not:

```txt
every root draws a nice card unless disabled
```

It is:

```txt
roots create state and anatomy
parts create semantic layout
one explicit frame creates the visible card
```

That is simpler, faster to understand, easier to compose, and much closer to
the shadcn philosophy.
