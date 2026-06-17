# File Viewer Executable Grammar Platonic Blueprint

## Verdict

No, the file viewer has not reached the platonic ideal yet.

It is close. The public naming is now mostly right. The provider leak has been
removed from the public module. The header grammar is better. The file icon is
gone. `FileViewerProvider` is implementation again. The system no longer needs
a conceptual rewrite.

The remaining problem is sharper and more important:

```txt
the documented public grammar is not yet the exact executable grammar
```

The ideal public grammar is still:

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

But the current implementation does not fully make that grammar true.

Today the default `FileViewer` layout avoids duplicate renderer chrome by
calling an internal document path:

```tsx
<InternalFileViewerDocument
  bare
  className="h-full"
  leafControls={false}
  leafDownload={false}
/>
```

while the public `FileViewerDocument` path does this:

```tsx
<InternalFileViewerDocument
  bare={bare}
  className={className}
  leafControls
  leafDownload
/>
```

That means the public anatomy shown in docs is not the same as the default
viewer. A user can write the beautiful public composition and accidentally get
renderer-local controls inside the document while also rendering
`FileViewerControls` in the header.

That is the last big impurity.

The final cut is not another abstraction. It is making the public grammar the
real grammar.

## Current State

### What Is Already Correct

The public module is now close to the right shadcn-style shape:

```txt
registry/new-york-v4/ui/file-viewer.tsx
```

It exports:

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
useFileViewerResource
```

It does not publicly export:

```txt
FileViewerProvider
InternalFileViewerDocument
FileViewerRoute
useFileViewerContext
useOptionalFileViewerResource
```

That part is right.

The public root is:

```tsx
<FileViewer source={source} />
```

not:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot />
</FileViewerProvider>
```

That part should not be reopened.

### The Provider Boundary Is Correct

`FileViewerProvider` can stay exported from:

```txt
registry/new-york-v4/ui/file-viewer-internal.tsx
```

because copied registry source has no true private module boundary. But the
public import path must not re-export it.

The correct contract is:

```txt
FileViewerProvider exists because React context exists.
It is not an authored component.
```

This is shadcn-compliant. shadcn components often use context internally. The
important thing is that the public anatomy is the thing users author.

### The Header Shape Is Correct

The file header now has the right visible order:

```txt
title, meta                                      controls
```

The generic file icon should stay deleted.

`FileViewerTitle` should answer only:

```txt
what file is this?
```

`FileViewerMeta` should answer only:

```txt
what passive facts describe this file?
```

`FileViewerControls` should answer only:

```txt
what can I do to the current rendered document?
```

`FileViewerControls` should never duplicate renderer title or renderer
subtitle. Those were correctly removed from the file-header forwarding path.

### Split And Partition Are In The Right Direction

Split and partition now compose around `FileViewer` instead of competing with
it.

The right shape is visible:

```tsx
<SplitViewerProvider result={result}>
  <FileViewer source={source} bare defaultOpen>
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
        <SplitViewerDocument />
      </FileViewerSurface>
    </FileViewerBody>
  </FileViewer>
</SplitViewerProvider>
```

and:

```tsx
<PartitionViewerProvider result={result}>
  <FileViewer source={source} bare>
    <FileViewerHeader>
      <FileViewerTitle />
      <PartitionViewerHeaderMeta />
      <FileViewerControls />
    </FileViewerHeader>
    <FileViewerBody>
      <FileViewerSurface>
        <PartitionViewerLegend />
        <PartitionViewerRibbon />
        <PartitionViewerDocument />
      </FileViewerSurface>
    </FileViewerBody>
  </FileViewer>
</PartitionViewerProvider>
```

The shared `SegmentedDocumentProvider` is also in the right place. It is a
state and navigation engine, not a monolithic visual viewer.

Keep that.

### Email Is Correctly Not A File Viewer

Email is a MIME document, not a file document. It should keep its own provider,
header, parts sidebar, and recursive message behavior.

But selected renderable leaves should continue to use:

```tsx
<FileViewer source={part.source} bare />
```

Email should not invent another file renderer.

### Dropzone Is Correctly Outside FileViewer

Dropzone/file intake is acquisition workflow, not file rendering.

It should own:

```txt
selected file
accepted/rejected files
drag state
upload trigger props
clear/replace actions
empty upload state
```

and pass a resolved source into:

```tsx
<FileViewer source={viewerSource} bare />
```

Dropzone should not be folded into `FileViewer`.

## The Remaining Platonic Gaps

## Gap 1: `FileViewerDocument` Means The Wrong Thing

This is the key remaining issue.

The public name:

```tsx
<FileViewerDocument />
```

sounds like:

```txt
the routed document area inside FileViewerSurface
```

But current behavior is closer to:

```txt
the routed file renderer as a standalone leaf, with renderer-local chrome
enabled
```

That is the wrong default for a public anatomy part.

In the composed grammar:

```tsx
<FileViewerHeader>
  <FileViewerControls />
</FileViewerHeader>
<FileViewerSurface>
  <FileViewerDocument />
</FileViewerSurface>
```

the document should not draw another PDF toolbar, image toolbar, DOCX toolbar,
CSV toolbar, or local download control.

The header owns the shell controls. The document owns the pixels.

### Correct Meaning

`FileViewerDocument` should mean:

```txt
the routed document rendered inside the FileViewer shell
```

Therefore it should:

- render the active file content;
- fill the surface;
- register page, zoom, rotate, loading, and download controls upward;
- avoid renderer-local chrome;
- avoid renderer-local download buttons;
- avoid a second visible header;
- avoid a second visible frame.

It should not mean:

```txt
standalone file preview with its own toolbar
```

Standalone preview is already expressed by:

```tsx
<FileViewer source={source} bare />
```

That is the one public way to get a leaf preview.

### Final Decision

Make `FileViewerDocument` the framed document path.

The public composition:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>
  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

must be behaviorally equivalent to:

```tsx
<FileViewer source={source} />
```

except for user-supplied layout.

That is the north star.

## Gap 2: The Default Layout Uses An Internal Path The Public Grammar Cannot Use

The default no-children `FileViewer` layout currently calls
`InternalFileViewerDocument` directly.

That is understandable, but it reveals the mismatch.

The default should eventually be written as the public grammar:

```tsx
function FileViewerDefaultLayout() {
  return (
    <>
      <FileViewerHeader />
      <FileViewerBody>
        <FileViewerSurface>
          <FileViewerDocument bare className="h-full" />
        </FileViewerSurface>
      </FileViewerBody>
    </>
  )
}
```

If this cannot be true without duplicate toolbars, then `FileViewerDocument` is
not yet the right primitive.

The implementation can still use private helpers, but the visible conceptual
path must be exactly this:

```txt
default FileViewer = same parts users compose
```

No prettier docs path. No special default-only route.

## Gap 3: `leafControls` And `leafDownload` Are The Wrong Internal Words

These names are mechanically accurate but conceptually noisy:

```txt
leafControls
leafDownload
```

They encode where the document is in the tree, not what behavior is desired.

The real distinction is:

```txt
standalone document chrome
framed shell document chrome
```

The internal policy should be named around chrome, not tree position.

Preferred internal shape:

```ts
type FileViewerDocumentChrome = "framed" | "standalone"
```

Then:

```tsx
<InternalFileViewerDocument chrome="framed" />
<InternalFileViewerDocument chrome="standalone" />
```

or:

```ts
const chrome = createFileViewerDocumentChromePolicy(mode)
```

where the policy produces:

```ts
type FileViewerDocumentChromePolicy = {
  rendererControls: boolean
  rendererDownload: boolean
  fallbackDownload: boolean
}
```

The exact implementation can be smaller than this if the code stays readable.
The important thing is to remove the ambiguous `leaf*` language.

## Gap 4: Route Branches Do Not Enforce One Chrome Policy Everywhere

The route is the private dispatcher:

```txt
registry/new-york-v4/ui/file-viewer-route.tsx
```

It must apply the same chrome policy to every renderable branch.

Today some branches receive `controls={leafControls}` and some do not. That is
too fragile.

Examples that need a route-wide audit:

```tsx
<PdfResourceContent ... download={leafDownload} />
<DocxResourceContent ... download={leafDownload} />
<ImageResourceContent ... download={leafDownload} />
<PptxResourceContent ... download={leafDownload} />
<XlsxResourceContent ... download={leafDownload} />
```

If those renderers support a `controls` prop, the route must pass the chrome
policy consistently in both direct URL and Blob branches.

The final invariant:

```txt
Every route branch receives the same framed-vs-standalone chrome policy.
Direct URL and Blob branches are behaviorally symmetric.
```

No renderer should accidentally show local controls just because the source was
a URL instead of a Blob.

## Gap 5: Download Semantics Need To Be Split From Local Chrome

The current internal booleans blur two different questions:

```txt
Should the renderer draw a local toolbar?
Should the viewer allow downloading this file?
```

Those are not the same.

For a framed `FileViewerDocument`, the ideal is:

```txt
local renderer toolbar: no
download action: yes, through FileViewerControls
fallback body download button: usually no, because the header owns download
```

For standalone bare file preview:

```txt
local renderer toolbar: yes
download action: yes, through the local renderer/fallback chrome
fallback body download button: yes
```

This means the route may need distinct internal concepts:

```ts
rendererControls
headerDownload
bodyDownload
```

Do not expose those as public props. They are internal policy.

The public API should stay simple:

```tsx
<FileViewer source={source} />
<FileViewer source={source} bare />
<FileViewer source={source}>...</FileViewer>
```

No `documentChrome`.
No `controlsMode`.
No `standalone`.
No `renderHeaderControls`.

## Gap 6: Registered Controls Still Carry `title` And `subtitle`

`ViewerControls` can keep `title` and `subtitle` as low-level props. That is
useful for non-file shells and legacy-free generic layout.

But the registration channel used by file renderers should not invite title
and subtitle registration if `FileViewerControls` ignores them.

The current type:

```ts
type ViewerControlsState = {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  position?: ViewerControlPosition | null
  zoom?: ViewerZoomControl | null
  rotate?: ViewerRotateControl | null
  downloads?: ViewerDownloadAction[]
  loading?: boolean
  extra?: React.ReactNode
}
```

allowed renderer title/subtitle to leak into the file header. The rendering
path now ignores them, but the type still says they are part of the registration
contract.

The sharper design is:

```ts
type ViewerControlsRegistrationState = {
  position?: ViewerControlPosition | null
  zoom?: ViewerZoomControl | null
  rotate?: ViewerRotateControl | null
  downloads?: ViewerDownloadAction[]
  loading?: boolean
  extra?: React.ReactNode
}
```

and:

```ts
type ViewerControlsProps = ViewerControlsRegistrationState & {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  onDownloadError?: ViewerDownloadErrorHandler
  size?: "default" | "sm"
}
```

This preserves the low-level component while narrowing the registration
channel.

The name can be shorter if preferred:

```ts
ViewerRegisteredControls
ViewerControlsRegistrationState
RegisteredViewerControls
```

The important invariant:

```txt
renderers register controls, not header copy
```

## Gap 7: The Docs Currently Teach A Composition That Can Duplicate Chrome

The docs show:

```tsx
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
```

This should remain the docs. The code must be fixed to make it true.

Do not change the docs to teach the internal workaround.

Bad:

```tsx
<InternalFileViewerDocument leafControls={false} />
```

Bad:

```tsx
<FileViewerDocument controls={false} />
```

Bad:

```tsx
<FileViewerContent />
```

Good:

```tsx
<FileViewerDocument />
```

The public anatomy should be inevitable.

## Gap 8: Demo Code Uses `FileViewerDocument` As A Headerless Leaf

`components/file-viewer-demo.tsx` currently has a no-header showcase path:

```tsx
<FileViewer key={file.file} {...fileViewerProps}>
  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument bare className="h-full" />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

If `FileViewerDocument` becomes the framed document path, this demo should stop
using it as a standalone leaf.

The cleaner no-header showcase is:

```tsx
<FileViewer key={file.file} {...fileViewerProps} bare />
```

or, if it needs a custom outer shell:

```tsx
<div className="...">
  <FileViewer key={file.file} {...fileViewerProps} bare />
</div>
```

That keeps the public semantics exact:

```txt
FileViewerDocument is for composed FileViewer shell layouts.
FileViewer bare is for standalone leaf previews.
```

## Final Design

## Public API

The final public file viewer API should be:

```ts
export {
  FileViewer,
  FileViewerHeader,
  FileViewerTitle,
  FileViewerMeta,
  FileViewerControls,
  FileViewerBody,
  FileViewerSidebar,
  FileViewerSidebarTrigger,
  FileViewerSurface,
  FileViewerDocument,
  useFileViewerResource,
}
```

No public provider.
No public internal document.
No public route.
No public full context.

## Easy Usage

```tsx
<FileViewer source={source} />
```

This renders:

```tsx
<FileViewerHeader />
<FileViewerBody>
  <FileViewerSurface>
    <FileViewerDocument />
  </FileViewerSurface>
</FileViewerBody>
```

The default implementation should be written in those terms.

## Bare Leaf Usage

```tsx
<FileViewer source={source} bare />
```

This renders only the routed renderer with local renderer chrome. It is the
right thing for:

- email attachment leaves;
- small nested previews;
- upload/intake preview panes;
- custom card demos that do not want file shell chrome.

Do not use `FileViewerDocument` for this.

## Composed Shell Usage

```tsx
<FileViewer source={source} defaultOpen>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>
  <FileViewerBody>
    <FileViewerSidebar aria-label="Pages" />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

This is the advanced but still public grammar.

It should never show duplicate renderer chrome.

## Internal Execution Model

The internal model should be:

```txt
FileViewer
  owns file context
  owns ViewerRoot
  renders user children or default public anatomy

FileViewerDocument
  public framed document part
  routes active file renderer with local chrome suppressed
  keeps header control registration active

InternalFileViewerDocument
  private implementation helper
  accepts explicit chrome policy

FileViewerRoute
  private renderer dispatch
  applies the same chrome policy to every category/source branch
```

Preferred internal naming:

```ts
type FileViewerDocumentChrome = "framed" | "standalone"
```

Then:

```tsx
export function FileViewerDocument(props: FileViewerDocumentProps) {
  return <InternalFileViewerDocument {...props} chrome="framed" />
}

function FileViewerStandaloneDocument(props: FileViewerDocumentProps) {
  return <InternalFileViewerDocument {...props} chrome="standalone" />
}
```

If the helper must be exported across files, keep the honest internal name:

```ts
InternalFileViewerDocument
```

but do not re-export it from `file-viewer.tsx`, docs, blocks, or demos.

## Implementation Plan

### Step 1: Define The Chrome Policy

Replace:

```ts
leafControls: boolean
leafDownload: boolean
```

with an internal policy.

Minimal version:

```ts
type FileViewerDocumentChrome = "framed" | "standalone"
```

Then derive:

```ts
const rendererControls = chrome === "standalone"
const inlineDownload = chrome === "standalone"
const registeredDownload = true
```

If the route needs more precision, use:

```ts
type FileViewerDocumentChromePolicy = {
  rendererControls: boolean
  rendererDownload: boolean
  fallbackDownload: boolean
}
```

Keep it private.

### Step 2: Change `FileViewerDocument`

Make public `FileViewerDocument` use framed chrome:

```tsx
export function FileViewerDocument(props: FileViewerDocumentProps) {
  return <InternalFileViewerDocument {...props} chrome="framed" />
}
```

Then make `FileViewer bare` without children use standalone chrome:

```tsx
<InternalFileViewerDocument
  bare
  className={className}
  chrome="standalone"
/>
```

### Step 3: Rewrite The Default Layout In Public Anatomy

Change the no-children default layout to call:

```tsx
<FileViewerHeader />
<FileViewerBody>
  <FileViewerSurface>
    <FileViewerDocument bare className="h-full" />
  </FileViewerSurface>
</FileViewerBody>
```

If tests fail because of duplicate controls, the route policy is still wrong.

### Step 4: Normalize The Route

Audit every branch in:

```txt
registry/new-york-v4/ui/file-viewer-route.tsx
```

The route must pass the policy consistently for:

- PDF;
- DOCX;
- image;
- PPTX;
- XLSX;
- CSV;
- Markdown;
- HTML;
- text;
- code;
- unsupported fallback.

Direct URL branches and Blob branches must match.

The route should not have one branch that respects framed chrome and another
branch that silently renders local controls.

### Step 5: Narrow The Registration Type

Remove `title` and `subtitle` from the controls registration state.

Keep them on `ViewerControlsProps` only if lower-level direct `ViewerControls`
usage still needs them.

This converts the current behavior from:

```txt
ignored at render time
```

to:

```txt
impossible to register by type
```

That is cleaner.

### Step 6: Update Demo Usage

Update headerless file viewer demos to use:

```tsx
<FileViewer source={source} bare />
```

instead of manually composing:

```tsx
<FileViewer>
  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

That keeps the meaning of `FileViewerDocument` narrow.

### Step 7: Update Tests

Add tests for the exact public grammar.

Required assertions:

```txt
<FileViewer source={pdfSource} />
  renders one file header
  renders one controls row
  does not render a second PDF controls row inside the surface
  still shows page position in FileViewerControls
  still exposes download in FileViewerControls
```

```txt
<FileViewer source={pdfSource}>
  <FileViewerHeader>
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>
  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
  behaves the same as default layout
```

```txt
<FileViewer source={pdfSource} bare />
  keeps local PDF controls
  keeps local download behavior
  does not require a FileViewerHeader
```

```txt
URL source and Blob source have the same chrome behavior
```

```txt
unsupported files inside framed layout do not duplicate download actions
```

### Step 8: Update Architecture Tests

Strengthen:

```txt
tests/viewer-architecture.test.ts
```

The architecture test should reject:

```txt
leafControls
leafDownload
```

unless we intentionally keep those words. Prefer rejecting them.

It should require:

```txt
FileViewer default layout includes <FileViewerDocument
FileViewer public module does not export InternalFileViewerDocument
FileViewer public module does not export FileViewerProvider
FileViewer route applies controls policy to URL and Blob branches
FileViewer docs do not mention InternalFileViewerDocument
```

### Step 9: Rebuild Registry Payloads

After source and docs changes:

```bash
pnpm registry:build:items file-viewer
node scripts/sync-registry-index.mjs
```

If docs or blocks touched related items, rebuild those items too.

### Step 10: Verify Visually

Do not start a dev server. If one is already running, check:

- default File Viewer docs demo;
- PDF thumbnails block;
- split viewer block;
- partition viewer block;
- email viewer attachment selection;
- file intake/dropzone preview;
- narrow viewport header wrapping.

The visual proof should specifically look for duplicate controls.

## Non-Goals

Do not touch the file-system viewer for this cut.

Do not fold Dropzone into `FileViewer`.

Do not invent a generic `SegmentedViewer`.

Do not expose `FileViewerProvider`.

Do not add `FileViewerDocument controls={false}`.

Do not make `FileViewer` know email, split, partition, extraction, OCR, upload,
or file-system state.

Do not replace `ViewerRoot`. It remains the generic spatial primitive under the
file viewer.

## Success Criteria

The system reaches the next plateau when all of this is true:

```txt
FileViewer is the only public file viewer root.
FileViewerProvider is private implementation.
FileViewerDocument is the framed document part.
FileViewer bare is the standalone leaf preview.
The default layout is written in public anatomy.
No public composition duplicates renderer chrome.
Every route branch respects the same chrome policy.
Renderer controls register upward without registering title/subtitle.
Docs, demos, tests, and registry payloads all teach the same grammar.
```

At that point, the file viewer would be very close to the platonic ideal.

Not perfect in the metaphysical sense, because component systems keep meeting
new edge cases. But structurally, it would finally have the thing we want:

```txt
one public root
one public grammar
one document meaning
one internal route
one control bridge
no duplicate chrome
no second way to do the same thing
```

That is the taste target.
