# File Viewer Composition Root Blueprint

## Goal

Converge the file viewer toward this public grammar:

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

The goal is not to make `FileViewer` a workflow shell. The goal is to make it
the file-scoped composition root: one source, one resource, one file header,
one routed content surface.

## Non-Negotiables

- `ViewerRoot` remains the generic layout/sidebar primitive.
- `FileViewer` owns only file scope and file rendering.
- `FileViewer` must not learn split, partition, OCR, sources, email, edit, or
  file-system semantics.
- `FileHeader` remains named anatomy, not a prop-driven header.
- `FileHeaderControls` is the canonical visible place for renderer controls.
- Renderer providers keep renderer state local.
- One file source should produce one canonical file resource inside one file
  viewer scope.

## Current Shape

The current composed API is:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    <FileHeader>
      <FileHeaderTitle />
      <FileHeaderMeta />
      <FileHeaderControls />
    </FileHeader>
    <ViewerBody>
      <ViewerSurface>
        <FileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileViewerProvider>
```

This is coherent, but not ideal:

- `FileViewerProvider` feels like implementation ceremony.
- `FileViewerContent` is verbose once the root is already `FileViewer`.
- PDF currently duplicates resource creation through `FileViewerProvider` and
  `PdfViewerProvider`.
- Controls registration works, but still feels like internal machinery.

## Target Shape

### Easy API

```tsx
<FileViewer source={source} />
```

renders the default composition:

```tsx
<FileViewer source={source}>
  <FileHeader>
    <FileHeaderTitle />
    <FileHeaderMeta />
    <FileHeaderControls />
  </FileHeader>
  <ViewerBody>
    <ViewerSurface>
      <FileContent />
    </ViewerSurface>
  </ViewerBody>
</FileViewer>
```

### Composed API

```tsx
<FileViewer source={source} defaultOpen>
  <FileHeader>
    <ViewerSidebarTrigger />
    <FileHeaderTitle />
    <FileHeaderMeta />
    <FileHeaderControls />
  </FileHeader>
  <ViewerBody>
    <ViewerSidebar>
      <PdfViewerThumbnails />
    </ViewerSidebar>
    <ViewerSurface>
      <FileContent />
    </ViewerSurface>
  </ViewerBody>
</FileViewer>
```

### Domain Composition

```tsx
<SplitViewerProvider split={split}>
  <FileViewer source={source}>
    <FileHeader>
      <ViewerSidebarTrigger />
      <FileHeaderTitle />
      <SplitViewerHeaderMeta />
      <FileHeaderControls />
    </FileHeader>
    <ViewerBody>
      <ViewerSidebar>
        <SplitViewerLegend />
      </ViewerSidebar>
      <ViewerSurface>
        <FileContent />
        <SplitViewerOverlays />
      </ViewerSurface>
    </ViewerBody>
  </FileViewer>
</SplitViewerProvider>
```

This is the test: domain viewers compose file viewer anatomy; they do not become
file viewer modes.

## Public API

### `FileViewer`

`FileViewer` becomes both:

- the easy complete viewer when `children` is absent;
- the file-scoped composition root when `children` is present.

Proposed props:

```ts
type FileViewerProps = {
  source: ViewerSource
  as?: FileCategory
  isolateStyles?: boolean
  children?: React.ReactNode
} & Pick<
  ViewerRootProps,
  | "bare"
  | "className"
  | "defaultOpen"
  | "open"
  | "onOpenChange"
  | "mode"
  | "inlineBreakpoint"
  | "sidebarSide"
  | "sidebarCollapsible"
>
```

Rule:

```txt
children absent  -> render default FileHeader + ViewerBody + FileContent
children present -> render exactly children inside the file-scoped root
```

No hidden extra header. No hidden sidebar. No workflow props.

### `FileContent`

Add `FileContent` as the preferred content part.

```ts
export const FileContent = FileViewerContent
```

Long-term, docs should prefer:

```tsx
<FileContent />
```

Inside the root, `FileContent` reads better than `FileViewerContent`.

Keep `FileViewerContent` as a compatibility alias until the registry examples
and docs converge.

### `FileViewerProvider`

Keep it internally and publicly for advanced explicit composition:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot />
</FileViewerProvider>
```

But the recommended docs should lead with:

```tsx
<FileViewer source={source}>...</FileViewer>
```

The provider is a lower-level escape hatch, not the main grammar.

### `FileHeader`

Keep:

```tsx
<FileHeader>
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

Default layout:

```txt
title, meta <----------------------------> controls
```

`FileHeaderTitle` should not include a default file icon.

`FileHeaderTitle` should not consume the whole row.

`FileHeaderControls` should own the right-side push.

## Resource Ownership

### Current Issue

PDF currently has this shape:

```txt
FileViewerProvider(source) -> createViewerResource(source)
PdfViewerProvider(source)  -> createViewerResource(source)
```

That is not clean.

### Target

One source creates one canonical resource in file scope.

Renderer providers consume the file resource when nested.

```txt
FileViewer(source) -> resource
Pdf renderer       -> uses resource
Pdf provider       -> owns PDF state only
```

### Implementation Rule

`FileViewerProvider` should expose a private hook for renderer integrations:

```ts
function useFileViewerResource(): ViewerResource
```

Do not expose the full file viewer context publicly.

Renderer providers can support both:

```tsx
<PdfViewerProvider source={source}>
```

for standalone usage, and:

```tsx
<PdfViewerProvider resource={resource}>
```

or implicit file resource consumption for nested usage.

The exact API can be chosen during implementation, but the invariant is fixed:

```txt
nested file rendering should not derive the same resource twice.
```

## Controls

### Current

Renderers can either:

- render local controls;
- register controls upward into `FileHeaderControls`.

### Target

In file viewer composition:

```tsx
<FileHeaderControls />
<FileContent />
```

`FileContent` should not render local toolbar chrome.

Standalone renderer APIs may still render local controls:

```tsx
<PdfViewer source={source} />
<PdfViewerPages toolbar />
```

### Rule

Controls registration remains internal machinery for renderer authors.

Product users should think only:

```txt
FileHeaderControls displays the active renderer controls.
```

## Metadata

`FileHeaderMeta` should remain stable file metadata:

- category;
- MIME type;
- file size when available;
- other passive file facts.

Dynamic renderer position should remain in controls:

```txt
left:  nvidia-10k-fy2024.pdf, pdf
right: Page 44 of 96  -  100%  +  fit rotate download
```

Do not add `FileHeaderStatus` until there is strong evidence that dynamic
status belongs on the left. Avoid adding anatomy prematurely.

## Migration Plan

### Phase 1: Add `FileContent`

- Export `FileContent` as an alias of `FileViewerContent`.
- Update docs to use `FileContent` in composed examples.
- Keep all runtime behavior unchanged.

### Phase 2: Let `FileViewer` Accept Children

Implement:

```tsx
<FileViewer source={source}>{children}</FileViewer>
```

as:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot {...viewerRootProps}>{children}</ViewerRoot>
</FileViewerProvider>
```

When `children` is absent, render the existing default viewer anatomy.

### Phase 3: Update Blocks And Docs

Update file-backed composed examples:

- PDF thumbnails block;
- split viewer block;
- partition viewer block;
- sources viewer block;
- file viewer docs;
- PDF viewer docs;
- sidebar docs.

Preferred examples should use:

```tsx
<FileViewer source={source}>
  <FileHeader />
  <ViewerBody />
</FileViewer>
```

not:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot />
</FileViewerProvider>
```

### Phase 4: Canonicalize Resource Flow

Start with PDF.

- Make `PdfViewerProvider` accept a `resource` or consume the nested file
  resource.
- Ensure routed `FileContent` does not create duplicate PDF resource state.
- Keep standalone `PdfViewer source={source}` working.

### Phase 5: Hide Control Machinery

- Keep `ViewerControlsRegistrationProvider` internal to file scope.
- Keep `useViewerControlsRegistration` available only for renderer parts.
- Do not document it as normal product composition API.
- Make examples show only `FileHeaderControls`.

## Success Criteria

The design is successful when these are true:

- plain files use `<FileViewer source={source} />`;
- composed file layouts use `<FileViewer source={source}>...</FileViewer>`;
- file content inside composition uses `<FileContent />`;
- no PDF-specific file header exists;
- no default file icon appears in `FileHeaderTitle`;
- title and meta sit on the left, controls on the right;
- PDF thumbnails compose through `ViewerSidebar`;
- split and partition compose file viewer anatomy without file viewer modes;
- nested PDF rendering does not derive the same resource twice;
- product users do not need to know about controls registration.

## Failure Criteria

The design has failed if `FileViewer` grows props like:

```txt
split
partition
emailParts
ocrAnchors
sourceBboxes
thumbnailSidebar
showLegend
showRibbon
```

The design has also failed if composition requires:

- duplicate file headers;
- manual toolbar suppression in normal examples;
- repeated source-to-resource conversion in nested renderers;
- public hooks that expose the whole file viewer context;
- a second private chrome system per renderer.

## Final Shape

The ideal public mental model:

```txt
FileViewer
  file source, file resource, file frame

FileHeader
  file chrome

FileHeaderTitle
  identity

FileHeaderMeta
  passive facts

FileHeaderControls
  active renderer controls

ViewerBody
  layout body

ViewerSidebar
  optional navigation or secondary content

ViewerSurface
  primary viewing surface

FileContent
  routed renderer content
```

This gives the library the right shadcn-style shape:

```txt
small named parts
one obvious root
composition over configuration
no workflow bloat
```
