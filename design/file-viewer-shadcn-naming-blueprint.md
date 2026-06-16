# File Viewer Shadcn Naming Blueprint

## Goal

Unify the file viewer public anatomy under one shadcn-style naming family.

The desired end state is:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>

  <FileViewerContent>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerContent>
</FileViewer>
```

This blueprint is about names and public grammar. It does not replace the lower
level generic `Viewer*` primitives. It defines the file viewer anatomy that
should sit above them.

## Why Naming Matters

The current and near-current grammar mixes two vocabularies:

```tsx
<FileViewer source={source}>
  <FileHeader>
    <FileHeaderTitle />
    <FileHeaderMeta />
    <FileHeaderControls />
  </FileHeader>
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface>
      <FileContent />
    </ViewerSurface>
  </ViewerBody>
</FileViewer>
```

That is technically coherent, but aesthetically noisy.

It exposes implementation layering in the callsite:

```txt
FileViewer layer
FileHeader layer
Viewer layout layer
FileContent layer
```

A component-library user should not have to mentally reconcile those layers for
the default file viewer composition. The public file viewer grammar should feel
like one component family.

## Shadcn Naming Reading

Shadcn uses a strong component-family pattern.

Dialog:

```tsx
<Dialog>
  <DialogTrigger />
  <DialogContent>
    <DialogHeader>
      <DialogTitle />
      <DialogDescription />
    </DialogHeader>
    <DialogFooter />
  </DialogContent>
</Dialog>
```

Tooltip:

```tsx
<Tooltip>
  <TooltipTrigger />
  <TooltipContent />
</Tooltip>
```

Sidebar:

```tsx
<SidebarProvider>
  <Sidebar>
    <SidebarHeader />
    <SidebarContent>
      <SidebarGroup />
    </SidebarContent>
    <SidebarFooter />
    <SidebarRail />
  </Sidebar>
  <SidebarInset />
  <SidebarTrigger />
</SidebarProvider>
```

Field:

```tsx
<Field>
  <FieldLabel />
  <FieldDescription />
  <FieldError />
</Field>
```

The pattern is not:

```txt
Root
GenericHeader
GenericBody
RootSpecificTitle
```

The pattern is:

```txt
RootName
RootNamePart
RootNamePart
RootNamePart
```

This is why the file viewer should expose `FileViewer*` names.

## Current Names

Current public or emerging names:

```txt
FileViewer
FileViewerProvider
FileHeader
FileHeaderTitle
FileHeaderMeta
FileHeaderControls
FileViewerContent
ViewerBody
ViewerSidebar
ViewerSurface
ViewerSidebarTrigger
```

These names reveal the internal implementation:

- `FileHeader` is really the header of `FileViewer`.
- `ViewerBody` is really the content region of `FileViewer`.
- `ViewerSidebar` is really the sidebar region when used in file viewer
  composition.
- `ViewerSurface` is really the file viewer primary viewing surface.
- `FileViewerContent` currently means routed renderer content, but in shadcn
  grammar `Content` usually means the main region/container under the root.

The most important naming conflict is `FileViewerContent`.

If the root is:

```tsx
<FileViewer />
```

then `FileViewerContent` should probably mean the large content/body region,
like `DialogContent` or `SidebarContent`.

The routed document renderer needs a different name.

## Target Names

### `FileViewer`

The file-scoped root and easy API.

Usage:

```tsx
<FileViewer source={source} />
```

and:

```tsx
<FileViewer source={source}>{children}</FileViewer>
```

Responsibilities:

- owns file source;
- owns file descriptor/resource scope;
- renders `ViewerRoot` internally;
- provides sidebar context through the underlying `ViewerRoot`;
- provides file header/content context through the file provider;
- renders default anatomy when `children` is absent.

Not responsible for:

- split semantics;
- partition semantics;
- OCR/extraction schemas;
- email MIME trees;
- file-system trees;
- upload queues;
- workflow runs.

### `FileViewerHeader`

The top chrome row for a file viewer.

Wraps the lower-level `ViewerHeader`.

Replaces:

```txt
FileHeader
```

Usage:

```tsx
<FileViewerHeader>
  <FileViewerTitle />
  <FileViewerMeta />
  <FileViewerControls />
</FileViewerHeader>
```

Default children may be:

```tsx
<>
  <FileViewerTitle />
  <FileViewerMeta />
  <FileViewerControls />
</>
```

Layout rule:

```txt
title, meta <----------------------------> controls
```

No default file icon.

### `FileViewerTitle`

The file identity.

Replaces:

```txt
FileHeaderTitle
```

Why not `FileViewerHeaderTitle`?

Because shadcn uses:

```txt
DialogTitle
CardTitle
AlertTitle
SheetTitle
FieldLabel
```

not:

```txt
DialogHeaderTitle
CardHeaderTitle
AlertHeaderTitle
```

The title belongs to the root family, not to the header subfamily.

### `FileViewerMeta`

Passive file facts.

Replaces:

```txt
FileHeaderMeta
```

Examples:

```txt
pdf
application/pdf
1.2 MB
text/html
```

Why not `FileViewerDescription`?

Because file type, MIME, size, and stable renderer facts are metadata, not
description copy. `Description` in shadcn usually implies readable supporting
text, such as `DialogDescription`, `CardDescription`, or `FieldDescription`.

### `FileViewerControls`

The active renderer controls slot.

Replaces:

```txt
FileHeaderControls
```

Examples:

```txt
Page 44 of 96
zoom out
100%
zoom in
fit
rotate
download
```

This component should place controls. It should not own PDF/image/text state.
Renderer content provides controls through the internal registration system.

### `FileViewerContent`

The main content region under the header.

Wraps the lower-level `ViewerBody`.

This is the biggest naming correction.

In shadcn grammar:

```txt
DialogContent
TooltipContent
SidebarContent
CardContent
SheetContent
```

`Content` usually means a container/region, not the leaf renderer.

So `FileViewerContent` should become:

```tsx
<FileViewerContent>
  <FileViewerSidebar />
  <FileViewerSurface>
    <FileViewerDocument />
  </FileViewerSurface>
</FileViewerContent>
```

It may feel odd because we currently use `ViewerBody`. But shadcn does not
usually expose `DialogBody`; it exposes `DialogContent`.

### `FileViewerSidebar`

The optional sidebar region for file viewer composition.

Wraps the lower-level `ViewerSidebar`.

Replaces file-viewer usage of:

```txt
ViewerSidebar
```

Examples:

```tsx
<FileViewerSidebar>
  <PdfViewerThumbnails />
</FileViewerSidebar>
```

and:

```tsx
<FileViewerSidebar>
  <EmailPartsList />
</FileViewerSidebar>
```

If the domain is not actually file viewer composition, keep using generic
`ViewerSidebar`.

### `FileViewerSurface`

The primary viewing surface.

Wraps the lower-level `ViewerSurface`.

Replaces file-viewer usage of:

```txt
ViewerSurface
```

Usage:

```tsx
<FileViewerSurface>
  <FileViewerDocument />
</FileViewerSurface>
```

`Surface` is better than `Panel` because the current system already uses
surface to mean the main rendered document area. It also avoids collision with
dialog panels, editor panels, and layout panels.

### `FileViewerDocument`

The routed file renderer.

Replaces the current role of:

```txt
FileViewerContent
```

Why `Document`?

Because it is the thing being viewed:

- PDF pages;
- image;
- spreadsheet;
- HTML document;
- Markdown document;
- text/code document;
- unsupported document state.

Alternatives considered:

```txt
FileContent
FileViewerRenderer
FileViewerRoute
FileViewerDocumentContent
FileViewerPreview
```

Rejected:

- `FileContent`: too generic and not root-family consistent.
- `FileViewerRenderer`: implementation-sounding.
- `FileViewerRoute`: routing internals leak into public API.
- `FileViewerDocumentContent`: too long.
- `FileViewerPreview`: product meaning is narrower than the actual renderer.

`FileViewerDocument` is not perfect, but it is the clearest public name for the
routed rendered file inside the surface.

### `FileViewerSidebarTrigger`

The sidebar trigger inside file viewer composition.

Wraps or aliases the lower-level `ViewerSidebarTrigger`.

Usage:

```tsx
<FileViewerHeader>
  <FileViewerSidebarTrigger />
  <FileViewerTitle />
  <FileViewerMeta />
  <FileViewerControls />
</FileViewerHeader>
```

Why not keep `ViewerSidebarTrigger`?

Keeping the generic trigger is correct at the primitive layer. But inside the
file viewer public grammar, `FileViewerSidebarTrigger` makes the family
complete and mirrors shadcn's `SidebarTrigger`.

The alias should not duplicate behavior. It should call the same underlying
viewer sidebar context.

## Final Public Grammar

### Default

```tsx
<FileViewer source={source} />
```

Equivalent to:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>
  <FileViewerContent>
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerContent>
</FileViewer>
```

### With Sidebar

```tsx
<FileViewer source={source} defaultOpen>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>

  <FileViewerContent>
    <FileViewerSidebar>
      <PdfViewerThumbnails />
    </FileViewerSidebar>
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerContent>
</FileViewer>
```

### Domain Composition

```tsx
<SplitViewerProvider split={split}>
  <FileViewer source={source}>
    <FileViewerHeader>
      <FileViewerSidebarTrigger />
      <FileViewerTitle />
      <SplitViewerHeaderMeta />
      <FileViewerControls />
    </FileViewerHeader>

    <FileViewerContent>
      <FileViewerSidebar>
        <SplitViewerLegend />
      </FileViewerSidebar>
      <FileViewerSurface>
        <FileViewerDocument />
        <SplitViewerOverlays />
      </FileViewerSurface>
    </FileViewerContent>
  </FileViewer>
</SplitViewerProvider>
```

This keeps split semantics outside file viewer while giving the visible file
viewer anatomy one naming family.

## Lower-Level Primitive Mapping

The `FileViewer*` names are public file viewer anatomy.

They map to lower-level primitives:

```txt
FileViewer              -> FileViewerProvider + ViewerRoot
FileViewerHeader        -> ViewerHeader
FileViewerContent       -> ViewerBody
FileViewerSidebar       -> ViewerSidebar
FileViewerSurface       -> ViewerSurface
FileViewerSidebarTrigger -> ViewerSidebarTrigger
FileViewerDocument      -> current FileViewerContent route renderer
```

The generic `Viewer*` primitives should remain exported.

Use them when building a non-file viewer:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

Examples:

- email message viewer;
- edit viewer;
- parse viewer;
- non-file workflow layouts;
- custom domain viewers that do not want file source routing.

## Names To Avoid

### Avoid `FileHeader`

`FileHeader` is shorter, but it breaks the root-family grammar.

If the root is `FileViewer`, the part should be `FileViewerHeader`.

### Avoid `FileHeaderTitle`

Too nested and not shadcn-like.

Prefer:

```txt
FileViewerTitle
```

### Avoid `FileContent`

It is too generic and competes with the file object itself.

Also, if `FileViewerContent` becomes the body region, `FileContent` creates
another parallel vocabulary.

Prefer:

```txt
FileViewerDocument
```

for the routed renderer.

### Avoid `FileViewerBody`

This is a reasonable name, but shadcn precedent leans toward `Content` for the
main region:

```txt
DialogContent
SidebarContent
CardContent
SheetContent
TooltipContent
```

`Body` is useful as an internal primitive or in low-level layout, but less
shadcn-grade for the public component family.

### Avoid `FileViewerRenderer`

Too implementation-oriented.

The user is not rendering a route; the user is viewing a document.

### Avoid `FileViewerPreview`

Too narrow. Some renderers are full viewers, not just previews.

## Migration Plan

### Phase 1: Add Aliases

Add new names without deleting old names:

```ts
export const FileViewerHeader = FileHeader
export const FileViewerTitle = FileHeaderTitle
export const FileViewerMeta = FileHeaderMeta
export const FileViewerControls = FileHeaderControls
export const FileViewerDocument = FileViewerContent
```

Add wrappers or aliases:

```ts
export const FileViewerContent = ViewerBody
export const FileViewerSidebar = ViewerSidebar
export const FileViewerSurface = ViewerSurface
export const FileViewerSidebarTrigger = ViewerSidebarTrigger
```

This phase is purely additive.

### Phase 2: Resolve The `FileViewerContent` Conflict

Current `FileViewerContent` means routed renderer.

Target `FileViewerContent` means body region.

This is a breaking semantic rename if done directly.

Recommended path:

1. Add `FileViewerDocument` as an alias for current `FileViewerContent`.
2. Update docs and blocks to use `FileViewerDocument`.
3. Only after the public examples converge, rename or repurpose
   `FileViewerContent` to mean the body region.

During migration, avoid exporting two components with confusing roles.

Interim grammar:

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
  <ViewerBody>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </ViewerBody>
</FileViewer>
```

Final grammar:

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
  <FileViewerContent>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerContent>
</FileViewer>
```

### Phase 3: Update Documentation

Update docs and examples to use the `FileViewer*` family:

- file viewer docs;
- PDF viewer docs;
- PDF thumbnails block;
- split viewer docs;
- partition viewer docs;
- sidebar docs;
- sources viewer block;
- email viewer docs where file leaves are rendered.

The docs should present generic `Viewer*` as lower-level primitives, not as the
main file viewer API.

### Phase 4: Update Blocks

Update composed blocks:

- `pdf-thumbnails-block`;
- `split-viewer-block`;
- `partition-viewer-block`;
- `sources-viewer-block`;
- any dropzone file viewer composition.

The before/after should be mechanical:

```txt
FileHeader              -> FileViewerHeader
FileHeaderTitle         -> FileViewerTitle
FileHeaderMeta          -> FileViewerMeta
FileHeaderControls      -> FileViewerControls
ViewerSidebar           -> FileViewerSidebar
ViewerSurface           -> FileViewerSurface
current FileViewerContent route renderer -> FileViewerDocument
```

Handle `ViewerBody` carefully because of the `FileViewerContent` conflict.

### Phase 5: Deprecate Old Names

Once docs and blocks use the new names:

- keep old aliases for one release window if needed;
- mark old names as legacy in comments/docs;
- remove from primary docs;
- avoid old names in new examples.

Potential legacy aliases:

```txt
FileHeader
FileHeaderTitle
FileHeaderMeta
FileHeaderControls
```

Do not keep both vocabularies equally documented. That would preserve the
confusion.

## Implementation Notes

### Data Slots

Data slots should follow the new public names where possible:

```txt
data-slot="file-viewer"
data-slot="file-viewer-header"
data-slot="file-viewer-title"
data-slot="file-viewer-meta"
data-slot="file-viewer-controls"
data-slot="file-viewer-content"
data-slot="file-viewer-sidebar"
data-slot="file-viewer-surface"
data-slot="file-viewer-document"
```

If the wrappers simply render generic primitives, it is acceptable for generic
primitives to keep their generic data slots internally. But public file wrappers
should expose file-specific slots if styling needs them.

### Props

File aliases should preserve the underlying prop surface.

Examples:

```ts
type FileViewerHeaderProps = FileHeaderProps
type FileViewerSidebarProps = ViewerSidebarProps
type FileViewerSurfaceProps = ViewerSurfaceProps
```

Avoid adding file-specific props to layout wrappers unless there is a clear file
viewer requirement.

### Display Names

Set display names where useful for debugging:

```txt
FileViewerHeader.displayName = "FileViewerHeader"
FileViewerTitle.displayName = "FileViewerTitle"
```

This matters if wrappers use `React.forwardRef`.

## Success Criteria

The naming is successful when this reads naturally without explanation:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>
  <FileViewerContent>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerContent>
</FileViewer>
```

And when the lower-level primitive version is still possible:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The distinction should be obvious:

```txt
FileViewer* = file source + file chrome + file rendering anatomy
Viewer*     = generic layout/sidebar primitives
```

## Failure Criteria

The naming failed if:

- docs mix `FileHeader` and `FileViewerHeader` as equal first-class options;
- `FileViewerContent` continues to mean routed renderer while also sounding like
  a layout region;
- file viewer examples still expose `ViewerBody`, `ViewerSidebar`, and
  `ViewerSurface` as the primary grammar;
- domain props are added to `FileViewer`;
- users cannot tell when to use `Viewer*` versus `FileViewer*`.

## Final Position

The perfect shadcn-style naming is not:

```tsx
<FileViewer>
  <FileHeader />
  <ViewerBody />
  <FileContent />
</FileViewer>
```

It is:

```tsx
<FileViewer>
  <FileViewerHeader />
  <FileViewerContent>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerContent>
</FileViewer>
```

The implementation can and should still use generic `Viewer*` primitives under
the hood. The public file viewer grammar should be a single `FileViewer*`
family.
