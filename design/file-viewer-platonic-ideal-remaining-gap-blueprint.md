# File Viewer Platonic Ideal Remaining Gap Blueprint

## Verdict

No, the File Viewer has not reached the platonic ideal yet.

It has reached a strong design:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
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

The public grammar is now mostly right. `FileViewerDocument` is a shell document
part, not a second standalone viewer. `FileViewer bare` is the standalone leaf
preview path. Renderer chrome registration now flows upward into
`FileViewerControls`. Local renderer chrome is hidden in shell mode.

That is the correct architecture.

But perfection asks for more than correctness. It asks for inevitability:

```txt
one concept
one name
one legal shape
no exposed implementation pressure
no unnecessary modes
no stale vocabulary
```

The remaining work is small but important.

## Current Strengths

### Public Anatomy Is Good

The public anatomy now has the right shadcn-style shape:

```txt
FileViewer
FileViewerHeader
FileViewerTitle
FileViewerMeta
FileViewerControls
FileViewerBody
FileViewerSidebar
FileViewerSidebarTrigger
FileViewerSurface
FileViewerDocument
```

These names are coherent. They are file-scoped versions of the generic viewer
parts, and they remove the old `Viewer` / `FileViewer` naming split from the
consumer's mental model.

### Default Composition Is Good

The default implementation now mirrors the public composed anatomy:

```tsx
<FileViewerHeader />
<FileViewerBody>
  <FileViewerSurface>
    <FileViewerDocument />
  </FileViewerSurface>
</FileViewerBody>
```

This is important. The easy API and the composed API now teach the same shape.

### `FileViewerDocument bare` Is Gone Publicly

This was the largest conceptual impurity. It is now fixed.

The public document part answers one question:

```txt
render the current file document in the current file surface
```

It does not ask consumers to know whether the routed renderer should be framed
or bare.

### Chrome Ownership Is Mostly Correct

The right split now exists:

```txt
shell mode
  FileViewerHeader owns visible controls
  renderer registers actions upward
  renderer local controls are hidden
  fallback/error document chrome is hidden

standalone mode
  renderer owns its own visible controls
  fallback/error document chrome is visible
```

That is the correct model.

## Remaining Gap 1: `FileViewer` Still Has Too Many Legal Modes

Today `FileViewer` supports at least three shapes:

```tsx
<FileViewer source={source} />
```

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

```tsx
<FileViewer source={source} bare />
```

These are all useful. The problem is not that the modes exist. The problem is
that the prop surface allows confusing combinations:

```tsx
<FileViewer source={source} bare>
  <FileViewerHeader />
  <FileViewerDocument />
</FileViewer>
```

The docs no longer teach this, but the API still permits it.

### Why This Is Not Platonic

The component still accepts a state that is neither clearly:

```txt
shell composition
```

nor clearly:

```txt
standalone leaf preview
```

That weakens the grammar.

### Target

Make invalid shapes impossible or visibly unsupported.

The ideal type shape is a discriminated public API:

```ts
type FileViewerProps =
  | FileViewerShellProps
  | FileViewerStandaloneProps

type FileViewerShellProps = FileViewerCoreProps &
  ViewerRootOptions & {
    bare?: false
    children?: React.ReactNode
  }

type FileViewerStandaloneProps = FileViewerCoreProps & {
  bare: true
    children?: never
  }
```

That gives consumers one of two legal paths:

```txt
shell
standalone
```

No hybrid.

### Decision

This should be the next cut if we want strict perfection.

It is a breaking API tightening, but the repo explicitly prefers hard cutovers
over compatibility shims.

## Remaining Gap 2: Internal Document Machinery Is Still Visible At Module Level

`InternalFileViewerDocument` is not exported from the public `file-viewer.tsx`
surface, but it is still an exported symbol from the internal module because
`file-viewer.tsx` imports it.

This is acceptable TypeScript module plumbing. It is not conceptually perfect.

### Why This Matters

The current shape has two document components:

```txt
FileViewerDocument
InternalFileViewerDocument
```

The public model says there should be one document part.

### Target

Fold the internal standalone branch into the same module as `FileViewer`, or
make the internal implementation unexported by colocating it with the root.

The ideal file boundary is:

```txt
file-viewer.tsx
  public root
  public anatomy
  private root/document implementation

file-viewer-route.tsx
  private file type router

file-viewer-internal.tsx
  private provider/context
```

This would make the source match the conceptual model:

```txt
one public document part
private implementation hidden behind the root
```

### Caution

Do not create a large monolith just to hide an export. This change is only
worth doing if the resulting file stays readable.

## Remaining Gap 3: Route Chrome Policy Is Correct But Verbose

The route now has the right policy:

```ts
const routeChrome = fileViewerRouteChrome(chrome)
const rendererChrome = fileViewerRendererChrome(routeChrome)
const localChrome = fileViewerLocalChrome(routeChrome)
const fallbackChrome = fileViewerFallbackChrome(routeChrome)
```

This is good because it names three different concepts:

```txt
renderer action registration
local renderer controls
fallback/error document chrome
```

But the route still repeats the same spread props across many branches.

### Why This Is Not Perfect

The router is doing two jobs:

```txt
choose the renderer
inject chrome policy into the renderer
```

That is not wrong. It is just not beautiful.

### Non-Target

Do not create a giant renderer registry map.

That would make the route shorter but less legible. File routing is a matrix,
and the matrix should remain visible.

### Target

Reduce only the mechanical repetition while preserving the visible route
matrix.

Good:

```tsx
function renderPdfRoute(args) {
  return <PdfResourceContent {...args.resourceProps} {...args.rendererChrome} />
}
```

Bad:

```ts
const renderers = {
  pdf: { component: PdfResourceContent, chrome: "renderer" },
  image: { component: ImageResourceContent, chrome: "renderer" },
}
```

The ideal route should still read like:

```txt
if blob PDF -> PDF renderer
if blob DOCX -> DOCX renderer
if direct URL PDF -> PDF renderer
if text Markdown -> Markdown renderer
```

but without low-value prop repetition.

## Remaining Gap 4: `download` Is Better But Still Semantically Loaded

The latest implementation separates the important behavior:

```txt
controls=false
  hide local renderer controls
  hide local error-state download affordance

download=true
  keep the renderer's download action available for registration
```

That is behaviorally right.

But the renderer prop is still named:

```ts
download?: boolean
```

And inside format viewers, that can still mean:

```txt
register a download action
render local toolbar download
render error-state download
```

depending on context.

### Target

Do not rush to rename every renderer prop.

But if the abstraction keeps evolving, the sharper internal vocabulary is:

```ts
type ViewerChromePolicy = {
  controls: boolean
  downloadAction: boolean
}
```

or:

```ts
type ViewerChromePolicy = {
  localControls: boolean
  exposeDownload: boolean
}
```

The public format viewers may keep `download?: boolean` if that remains the
right ergonomic API. The File Viewer route should keep using clearer internal
names.

### Decision

Do not make this change yet unless another ambiguity appears.

The current behavior is correct. The remaining issue is mostly naming pressure.

## Remaining Gap 5: Runtime Copies And Registry Sources Still Create Entropy

Most `components/ui/*` files are re-exports from the registry source, but some
runtime files are still full copies.

That creates a maintenance hazard:

```txt
registry source changes
runtime copy can drift
```

The latest implementation had to sync a runtime copy for PPTX and CSV chrome.
That is evidence of the problem.

### Target

The ideal is one source of truth:

```txt
registry/new-york-v4/ui/*
  source of truth

components/ui/*
  generated re-export only
```

Every runtime `components/ui` viewer file should either:

```ts
export * from "@/registry/new-york-v4/ui/x"
```

or have a documented reason why it is not a re-export.

### Required Audit

Search for full runtime viewer copies:

```bash
rg -l '^"use client"$|import \* as React' components/ui
```

Then classify each file:

```txt
re-export wrapper
intentional runtime source
stale duplicate
```

For File Viewer perfection, stale duplicates should be eliminated.

## Remaining Gap 6: Visual Proof Is Still Missing

The implementation has strong test evidence:

```txt
typecheck
file viewer tests
PDF tests
code viewer tests
sources tests
architecture tests
registry build
```

But perfection for a viewer component also needs visual proof.

### Required Visual Surfaces

When a dev server is already running, verify:

```txt
File Viewer docs page
PDF thumbnails block
sources/evidence viewer blocks
email attachment preview
dropzone preview
unsupported file fallback in shell mode
unsupported file fallback in standalone bare mode
```

### What To Check

For each surface:

```txt
one header row
title/meta left
controls right
no duplicated renderer toolbar in shell mode
no duplicate download affordance
document fills surface
sidebar trigger targets nearest file viewer root
bare preview has no outer shell chrome
error/fallback states do not reintroduce local shell chrome
```

### Decision

Do not call the system perfect until this visual pass is done.

The repo instruction says not to start a dev server. So this remains dependent
on an already running server or a user-started server.

## Remaining Gap 7: The Larger Viewer Family Still Needs The Same Standard

The File Viewer is now much cleaner than the broader system around it.

The platonic standard has to apply to adjacent composed viewers too:

```txt
EmailViewer
PdfViewer thumbnails composition
Sources/OCR viewers
SplitViewer
PartitionViewer
Dropzone previews
File system surfaces
```

If those components still use older private chrome systems, broad context hooks,
or duplicated sidebar semantics, the File Viewer can be good while the system is
not perfect.

### Boundary

This is not a reason to keep changing File Viewer.

It is a reason to evaluate the other viewers against the same rules:

```txt
public anatomy
private provider
narrow hooks
one source of truth
no duplicate chrome
no broad context escape hatch
no stale vocabulary
```

## Proposed Final Cut

If we want to make the File Viewer itself as close as possible to perfect, do
these in order:

1. Type `FileViewerProps` as shell vs standalone so `bare` cannot be combined
   with children.
2. Hide `InternalFileViewerDocument` more completely if it can be done without
   making `file-viewer.tsx` bloated.
3. Lightly compress `FileViewerRoute` with tiny route helpers, not a renderer
   registry.
4. Audit `components/ui` runtime copies and remove stale duplicates.
5. Run the visual proof pass once a dev server is available.

## Definition Of Done

The File Viewer reaches its practical platonic ideal when all of these are true:

```txt
<FileViewer source={source} />
  is the easy shell

<FileViewer source={source}>...</FileViewer>
  is the composed shell

<FileViewer source={source} bare />
  is the only standalone leaf preview

<FileViewer source={source} bare>...</FileViewer>
  is impossible or explicitly rejected

<FileViewerDocument />
  is the only public document part

FileViewerDocument has no bare prop

renderer actions register upward into FileViewerControls

renderer local controls are hidden in shell mode

fallback/error document downloads are hidden in shell mode

unsupported shell files have one header download

unsupported standalone files have one local download

registry source and runtime source cannot drift

visual QA proves the chrome hierarchy in real blocks
```

That is the final standard.

