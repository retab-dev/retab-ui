# File Viewer Platonic Ideal Blueprint

## Verdict

We have not reached the platonic ideal yet.

The current direction is correct. The `FileViewer*` family is a real
improvement because it gives the component one public grammar:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
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

That is closer to shadcn taste than the previous mixed vocabulary:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    <FileHeader />
    <ViewerBody>
      <ViewerSidebar />
      <ViewerSurface>
        <FileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileViewerProvider>
```

But the current system still contains visible implementation history:

- deprecated `FileHeader*` aliases;
- provider layering in normal PDF usage;
- a slightly awkward `FileViewerDocument` name;
- two meanings of "content" that had to be split by convention;
- composed viewers that still expose coordination machinery;
- registry/docs/tests still carrying broad viewer-system churn around the file
  viewer cut.

The ideal is not "more complete". The ideal is less surface, sharper
boundaries, and one name per concept.

## The Taste Standard

The component should feel like shadcn:

- visible anatomy instead of prop exhaustivity;
- small named parts instead of modes;
- one component family per public concept;
- low ceremony for the common path;
- escape hatches only where composition naturally requires them;
- internal machinery hidden unless the user is building a lower-level
  primitive.

The file viewer is not a workflow viewer, extraction viewer, split viewer,
email viewer, upload queue, or file-system tree.

It is exactly this:

```txt
a file-scoped viewer root that resolves one file source and lets small visible
parts render the file's chrome, sidebar, surface, and renderer
```

## Final Public Grammar

The canonical grammar should be:

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

The easy API should remain:

```tsx
<FileViewer source={source} />
```

and should be equivalent to:

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

No file icon by default.

Header layout:

```txt
title, meta <------------------------------------------> controls
```

## Public Parts

### `FileViewer`

The root. It owns file identity, file resource context, and the underlying
viewer/sidebar layout context.

It has two modes, determined only by children:

```txt
children absent  -> render default complete file viewer
children present -> render exactly the provided anatomy inside file scope
```

Allowed props:

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

Forbidden props:

```txt
split
partition
ocr
sources
email
filesystem
workflow
attachments
thumbnails
showHeader
showSidebar
header
toolbar
renderHeader
renderControls
```

Those are either domain concepts or prop-driven chrome shortcuts. The shadcn
answer is composition.

### `FileViewerHeader`

The file chrome row. It wraps the lower-level `ViewerHeader`.

It should provide only layout and slot identity. It should not know PDF, CSV,
DOCX, image, split, partition, or extraction state.

Default children should be minimal:

```tsx
<FileViewerTitle />
<FileViewerMeta />
<FileViewerControls />
```

### `FileViewerTitle`

The file title.

Rules:

- title only;
- no file icon;
- no MIME badge;
- no page count;
- no renderer-specific state;
- truncates cleanly;
- reads file identity from the file viewer context unless children override it.

### `FileViewerMeta`

Small file and renderer metadata placed next to the title, on the left side of
the header.

Examples:

```txt
pdf
Page 44 of 96
2.1 MB
text/html
```

It should read a merged metadata stream:

```txt
file descriptor metadata + active renderer metadata
```

The public part stays simple. The renderer registration can remain internal.

### `FileViewerControls`

The visible control cluster.

It should render controls registered by the active renderer:

```txt
zoom out
zoom value
zoom in
fit/fullscreen
rotate
download
renderer-specific actions
```

Rules:

- controls align right;
- no title or metadata;
- no renderer branching in the part;
- no prop exhaustivity for individual controls unless the whole control cluster
  is replaced through composition.

### `FileViewerContent`

The body/layout region under the header.

This name must mean layout, not file rendering.

It wraps the lower-level `ViewerBody`.

### `FileViewerSidebar`

The file-scoped sidebar wrapper.

It wraps the lower-level `ViewerSidebar`.

Examples:

```tsx
<FileViewerSidebar>
  <PdfViewerThumbnails />
</FileViewerSidebar>
```

```tsx
<FileViewerSidebar side="right">
  <EmailAttachmentList />
</FileViewerSidebar>
```

It should not know what is inside. Thumbnails, attachment lists, split rails,
and source panels are children.

### `FileViewerSidebarTrigger`

The file-scoped sidebar trigger.

It wraps the lower-level `ViewerSidebarTrigger`.

The reason to keep this alias is taste: users composing `FileViewer` should not
have to switch vocabulary for the trigger.

### `FileViewerSurface`

The primary document surface region.

It wraps the lower-level `ViewerSurface`.

Rules:

- owns layout containment;
- does not resolve files;
- does not render the routed file document;
- provides the place where overlays, ribbons, legends, or forms can be composed.

### `FileViewerDocument`

The routed renderer for the current file source.

This is currently the most suspicious name. It is accurate, but not fully
inevitable.

It means:

```txt
resolve the file descriptor and render the correct concrete viewer
```

Possible alternatives:

```txt
FileViewerDocument
FileViewerRenderer
FileViewerFile
FileViewerPreview
```

`FileViewerDocument` is the best current option because it mirrors the visual
thing inside the surface, and because `Renderer` sounds implementation-heavy.

The test is whether this feels natural in real examples:

```tsx
<FileViewerSurface>
  <FileViewerDocument />
</FileViewerSurface>
```

If that line still feels slightly mechanical after the rest of the system is
clean, this is the last name to revisit.

## Provider Rules

### Ideal Mental Model

Users should think:

```txt
FileViewer is the provider.
```

They should not normally write:

```tsx
<FileViewerProvider>
  <ViewerRoot>
    ...
  </ViewerRoot>
</FileViewerProvider>
```

That lower-level spelling can exist internally or as an advanced primitive, but
it must not be the recommended path.

### Renderer Providers

Renderer providers are still legitimate when they own renderer-specific state:

```tsx
<FileViewer source={source}>
  <PdfViewerProvider source={source}>
    ...
  </PdfViewerProvider>
</FileViewer>
```

But this is not aesthetically perfect.

The ideal is:

```txt
FileViewer owns file identity.
The active renderer owns renderer state.
The user does not have to manually line up duplicate sources.
```

That suggests a future refinement:

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
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

where `PdfViewerThumbnails` can bind to the active PDF renderer context created
by `FileViewerDocument`.

That is only acceptable if it does not introduce hidden magic, duplicate loads,
or ambiguous renderer state. If that cannot be made obvious, explicit
`PdfViewerProvider` remains the cleaner choice.

## Composed Viewer Rules

### PDF Thumbnails

Ideal:

```tsx
<FileViewer source={source} defaultOpen>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>

  <FileViewerContent>
    <FileViewerSidebar aria-label="PDF pages" width="4.5rem">
      <PdfViewerThumbnails />
    </FileViewerSidebar>
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerContent>
</FileViewer>
```

The thumbnail rail is not a file viewer mode. It is a sidebar child.

### Split Viewer

Ideal:

```tsx
<SplitViewerProvider result={result}>
  <FileViewer source={source} defaultOpen>
    <FileViewerHeader>
      <FileViewerSidebarTrigger />
      <FileViewerTitle />
      <SplitViewerHeaderMeta />
      <FileViewerControls />
    </FileViewerHeader>

    <FileViewerContent>
      <FileViewerSidebar>
        <SplitViewerSidebar />
      </FileViewerSidebar>
      <FileViewerSurface>
        <SplitViewerLegend />
        <FileViewerDocument />
      </FileViewerSurface>
    </FileViewerContent>
  </FileViewer>
</SplitViewerProvider>
```

Split owns split semantics. File viewer owns file anatomy.

### Partition Viewer

Ideal:

```tsx
<PartitionViewerProvider result={result}>
  <FileViewer source={source}>
    <FileViewerHeader>
      <FileViewerTitle />
      <PartitionViewerHeaderMeta />
      <FileViewerControls />
    </FileViewerHeader>

    <FileViewerContent>
      <FileViewerSurface>
        <PartitionViewerLegend />
        <PartitionViewerRibbon />
        <FileViewerDocument />
      </FileViewerSurface>
    </FileViewerContent>
  </FileViewer>
</PartitionViewerProvider>
```

Partition does not need a different file chrome language.

### Sources / OCR

Sources and OCR are not file viewer variants. They are anchored/evidence
systems composed beside or above file viewers.

Ideal:

```tsx
<EvidenceProvider model={model}>
  <ViewerRoot defaultOpen>
    <ViewerHeader>
      <ViewerSidebarTrigger />
      <EvidenceTitle />
    </ViewerHeader>

    <ViewerBody>
      <ViewerSurface>
        <FileViewer source={source} bare>
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
      </ViewerSurface>

      <ViewerSidebar side="right">
        <EvidenceFields />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EvidenceProvider>
```

This is one of the few places where generic `Viewer*` and file-specific
`FileViewer*` legitimately coexist: the outer viewer is not a file viewer, it
is an evidence workspace.

## What Must Be Removed For Perfection

### 1. Deprecated file header aliases

Remove:

```ts
FileHeader
FileHeaderTitle
FileHeaderMeta
FileHeaderControls
```

After all callsites and registry docs have moved, the aliases are historical
sediment. They violate one-name-per-concept.

### 2. Public docs that teach provider-first composition

Docs should lead with:

```tsx
<FileViewer source={source}>...</FileViewer>
```

Provider-first examples should be rare and explicitly marked advanced.

### 3. Duplicate source passing in normal PDF composition

This is not necessarily removable today, but it is a real aesthetic gap:

```tsx
<FileViewer source={source}>
  <PdfViewerProvider source={source}>
    ...
  </PdfViewerProvider>
</FileViewer>
```

The ideal has one source at the callsite.

### 4. Broad internal context exposure

File viewer should expose narrow public hooks only.

Good:

```ts
useFileViewerSource()
useFileViewerDescriptor()
useFileViewerControls()
```

Bad:

```ts
useFileViewerContext()
```

unless it is private to the module.

### 5. Renderer-specific branching in file anatomy

No file anatomy part should contain:

```ts
if (kind === "pdf") ...
if (kind === "csv") ...
if (kind === "docx") ...
```

The routed document chooses the renderer. The renderer registers controls and
metadata. The chrome renders the registered surface.

### 6. Prop-driven chrome exhaustivity

Avoid:

```tsx
<FileViewer
  showHeader
  showMeta
  showDownload
  showZoom
  sidebar="thumbnails"
/>
```

Prefer:

```tsx
<FileViewer>
  <FileViewerHeader>
    <FileViewerTitle />
    <FileViewerControls />
  </FileViewerHeader>
</FileViewer>
```

Shadcn's answer to taste is visible JSX.

## Data And State Boundary

The file viewer state should be small:

```ts
type FileViewerState = {
  source: ViewerSource
  descriptor: ViewerDescriptor
  resource: FileResource
  controls: FileViewerControl[]
  metadata: FileViewerMetadataItem[]
}
```

It should not contain:

```txt
selected split segment
partition row hover
OCR active box
email selected MIME part
file-system selected node
upload progress
workflow run status
```

Those belong to their domain providers.

## Naming Invariants

Use the same words everywhere:

```txt
source      -> input file source
descriptor  -> normalized file identity/type
resource    -> loaded or loadable file resource
metadata    -> small textual facts beside title
controls    -> header actions registered by renderer
content     -> body layout region
surface     -> primary visual region
document    -> routed file rendering
sidebar     -> side region inside file viewer
```

Do not introduce parallel words:

```txt
toolbar     -> controls
body        -> content
preview     -> document, unless specifically discussing thumbnail preview
pane        -> surface/sidebar
chrome      -> internal explanation only, not public component name
```

## Acceptance Tests

The system is close to ideal when all of these are true:

1. The default docs show only the `FileViewer*` family for file viewer anatomy.
2. A PDF thumbnail viewer can be written without any generic `Viewer*` parts.
3. Split and partition use `FileViewer*` for file chrome and only add their
   domain parts.
4. Sources/OCR use `Viewer*` only for the outer evidence workspace and
   `FileViewer*` only for the inner file viewer.
5. No public example uses deprecated `FileHeader*` names.
6. `FileViewerHeader` has no file icon by default.
7. `FileViewerMeta` sits beside the title, not with the right controls.
8. `FileViewerControls` renders active renderer controls without renderer
   branching in the header.
9. The common API has one source prop at the top-level callsite.
10. The public hook surface is narrow; full contexts are private.
11. Registry payloads match docs and source.
12. Tests assert anatomy slots, default composition, custom composition,
    provider errors, renderer controls, and sidebar trigger behavior.

## Implementation Plan

### Phase 1: Alias Removal

- Remove deprecated `FileHeader*` exports.
- Update any remaining registry/docs/tests imports.
- Regenerate registry payloads.
- Add an architecture test that rejects public `FileHeader*` usage.

### Phase 2: Provider Compression Audit

- Inventory every callsite that manually nests `FileViewer` and renderer
  providers.
- Decide whether active renderer context can be created once and consumed by
  thumbnail/sidebar parts.
- If yes, remove duplicate source passing from normal PDF examples.
- If no, document the explicit provider boundary as intentional and keep it
  consistent.

### Phase 3: `FileViewerDocument` Name Proof

- Collect real examples:
  - default file viewer;
  - PDF thumbnails;
  - split viewer;
  - partition viewer;
  - sources/OCR inner file viewer;
  - email attachment viewer.
- Read the JSX out loud.
- If `FileViewerDocument` still feels mechanical, test one alternate name in a
  worktree. Do not churn names without example pressure.

### Phase 4: Narrow Hook Surface

- Make full file viewer context private.
- Export narrow hooks only if real external composition needs them.
- Prefer parts over hooks wherever JSX composition is enough.

### Phase 5: Registry And Documentation Finalization

- Make `file-viewer.mdx` the canonical source of the grammar.
- Ensure `pdf-viewer.mdx`, `split-viewer.mdx`, `partition-viewer.mdx`, and
  `sources-viewer-block` all follow the same vocabulary.
- Remove provider-first examples unless they teach advanced internals.

### Phase 6: Test The Taste

Add tests that protect the API shape:

```txt
default composition renders header/content/surface/document slots
custom composition does not render hidden duplicate chrome
sidebar trigger toggles the file viewer sidebar from the header
metadata is left-grouped with title
controls are right-grouped
no file icon is rendered by default
deprecated names are absent from docs and registry examples
```

## Final Judgment

The current design is good.

The platonic design is stricter:

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

No aliases.
No duplicate vocabulary.
No prop exhaustivity.
No domain concepts inside the file viewer.
No visible machinery in the common path.

Everything needed, nothing more.
