# File Viewer Last-Mile Platonic Cut Blueprint

## Verdict

No, the file viewer has not fully reached the platonic ideal.

It is close. The public grammar is finally pointed at the right target:

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

The remaining problem is not the main idea. The remaining problem is that the
system still contains a few places where the implementation admits two mental
models:

1. authored public file viewer composition;
2. private provider/root machinery;
3. leaf preview document chrome;
4. shell document chrome.

The final cut must make those boundaries exact.

## What Is Already Right

### `FileViewer` Is The Public Root

The user-facing root should be:

```tsx
<FileViewer source={source} />
```

or:

```tsx
<FileViewer source={source}>...</FileViewer>
```

There should be no public decision between:

```tsx
<FileViewer />
```

and:

```tsx
<FileViewerProvider>
  <ViewerRoot />
</FileViewerProvider>
```

The provider can exist because React context needs scope. It should not be an
authored component.

### The Anatomy Names Are Correct

These names should remain the public vocabulary:

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

They are direct and shadcn-like. They describe visible parts, not internal
strategies.

Do not bring back:

```txt
FileHeader
FileHeaderTitle
FileHeaderMeta
FileHeaderControls
FileViewerContent
ViewerShell
slots
```

`FileViewerBody` is better than `FileViewerContent` because it owns the layout
row that contains sidebars and surfaces. `FileViewerDocument` is the rendered
file, not the whole body.

### Header Identity Is Correct

The header should read:

```txt
title, meta                                    controls
```

The generic file icon should stay removed. It adds noise without information.

`FileViewerControls` should not duplicate renderer-provided `title` or
`subtitle`. The file title belongs to `FileViewerTitle`; passive file facts
belong to `FileViewerMeta`; operational state belongs to `FileViewerControls`.

### The Route Split Is Directionally Correct

The current file boundary is mostly right:

```txt
file-viewer.tsx
  public anatomy and default composition

file-viewer-internal.tsx
  private provider, descriptor, resource, control registration bridge

file-viewer-document.tsx
  document lifecycle, suspense, fallback, error boundary

file-viewer-route.tsx
  category dispatch and renderer adaptation
```

That split is good. It keeps `file-viewer.tsx` from becoming the place where
every renderer leaks into the public anatomy.

## The Remaining Impurities

## Gap 1: `sources-viewer-block` Still Uses The Private Grammar

Current shape:

```tsx
<ViewerRoot bare defaultOpen>
  <FileViewerProvider source={source}>
    <SourceLinkedFileHeader />
    <FileViewerBody>
      <FileViewerSurface />
      <ViewerSidebar />
    </FileViewerBody>
  </FileViewerProvider>
</ViewerRoot>
```

That is exactly the grammar the system is trying to eliminate.

It forces a reader to understand that file viewer composition is secretly:

```txt
ViewerRoot + FileViewerProvider + FileViewerBody
```

instead of:

```txt
FileViewer + FileViewerBody
```

### Target Shape

```tsx
<FileViewer source={source} bare defaultOpen className="h-full bg-background">
  <FileViewerHeader>
    <FileViewerSidebarTrigger className="-ml-1" />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>

  <FileViewerBody>
    <FileViewerSurface className="relative">
      {children}
      <SourceIndicator />
    </FileViewerSurface>

    <FileViewerSidebar
      aria-label="Source-linked fields"
      side="right"
      width="420px"
      className="flex flex-shrink-0 flex-col border-l"
    >
      <SourcesForm />
    </FileViewerSidebar>
  </FileViewerBody>
</FileViewer>
```

The block may still use format-specific providers inside the file surface:

```tsx
<PdfViewerProvider />
<ImageViewerProvider />
<TextViewerProvider />
<CsvViewerProvider />
<DocxViewerProvider />
<XlsxViewerProvider />
```

That is renderer state, not file viewer chrome.

The block may still use:

```ts
useFileViewerResource()
```

inside small resource adapters when the active file resource must be passed to
format-specific providers.

It must not use:

```txt
FileViewerProvider
ViewerRoot
ViewerSidebar
ViewerSidebarTrigger
file-viewer-internal
```

for the file viewer shell.

## Gap 2: The Architecture Tests Currently Preserve The Wrong Exception

The architecture test already says that ordinary source demo blocks should stay
on the public `FileViewer` shell. But it carves out `sources-viewer-block` and
asserts the private shape:

```txt
ViewerRoot
FileViewerProvider
ViewerSidebar
not <FileViewer>
not <FileViewerSidebar>
```

That exception is no longer philosophically correct.

### Target Test Rule

All file-backed source blocks should satisfy the same shell invariant:

```txt
renders <FileViewer>
renders <FileViewerBody>
renders <FileViewerSurface>
renders <FileViewerSidebar> when it has a file-scoped sidebar
does not import file-viewer-internal
does not render FileViewerProvider
does not render ViewerRoot as the file shell
```

The only allowed exception is not a file viewer exception. It is a renderer
exception:

```txt
format-specific resource adapters may call useFileViewerResource()
```

That exception should be named explicitly in tests so it does not reopen the
provider path.

## Gap 3: `FileViewerDocument` Still Means Two Different Things

This is the sharpest remaining API ambiguity.

The default shell currently uses a private internal document path:

```tsx
<InternalFileViewerDocument
  bare
  leafControls={false}
  leafDownload={false}
/>
```

But the public composition docs teach:

```tsx
<FileViewerSurface>
  <FileViewerDocument />
</FileViewerSurface>
```

The public `FileViewerDocument` currently renders the internal route with:

```txt
leafControls = true
leafDownload = true
```

That means the public document slot behaves like a leaf preview, while the
default shell uses a hidden chrome-free variant. This is conceptually backwards.

In a composed file shell, the header owns controls and downloads. The document
slot should render the document, not another toolbar.

### Correct Semantics

`FileViewerDocument` should mean:

```txt
the routed file document for use inside FileViewerSurface
```

Therefore it should be chrome-free:

```txt
leafControls = false
leafDownload = false
```

The leaf preview mode should remain available through the easy API:

```tsx
<FileViewer source={source} bare />
```

That easy leaf mode may use private implementation machinery. It should not
teach a second authored component.

### Final Internal Shape

The internal implementation can look like this:

```txt
file-viewer-document.tsx
  FileViewerDocument
    public shell document
    no leaf controls
    no leaf download

file-viewer-document-internal.tsx
  FileViewerDocumentContent
    private route/suspense/error implementation
    accepts leaf chrome booleans

file-viewer.tsx
  FileViewer source + children
    uses public shell anatomy

  FileViewer source without children
    uses default shell

  FileViewer source bare without children
    uses private leaf document mode
```

The exact file split can be adjusted, but the public meaning cannot:

```txt
FileViewerDocument is shell-safe.
Leaf preview is FileViewer's no-children mode.
```

## Gap 4: `InternalFileViewerDocument` Is Visible In A Shipped Registry File

The public entrypoint does not export `InternalFileViewerDocument`, which is
good.

But because this is a shadcn-style registry, installed users receive the source
files. A symbol named `InternalFileViewerDocument` exported from a shipped file
is still visible enough to invite misuse.

### Target

Do not export a symbol named:

```txt
InternalFileViewerDocument
```

from any file that is part of the installed component payload.

If an internal route component must be imported across files, give it a precise
implementation name and keep it out of the public entrypoint:

```txt
FileViewerDocumentContent
FileViewerRoutedDocument
```

Better still, keep the public component as the only exported document component
from `file-viewer-document.tsx` and move shared private implementation to a
private internal file.

The goal is not fake privacy. The goal is to avoid teaching the reader an
internal component as a valid concept.

## Gap 5: The Public Docs Need To Match The Real Semantics

The docs should continue to teach:

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

But that example is only correct if `FileViewerDocument` is shell-safe.

The docs should not mention:

```txt
FileViewerProvider
file-viewer-internal
InternalFileViewerDocument
leafControls
leafDownload
ViewerRoot as the file shell
```

They may explain one distinction:

```txt
Use <FileViewer source={source} /> for the default complete viewer.
Use named FileViewer parts when you need sidebars or domain chrome.
Use <FileViewer source={source} bare /> without children for a nested leaf preview.
```

That is enough.

## Gap 6: `ViewerControlsState` Still Carries Title/Subitle For Lower-Level Users

`ViewerControls` can keep `title` and `subtitle` because it is a lower-level
primitive. Some non-file viewer may need a compact toolbar with title-like
metadata.

`FileViewerControls` must continue to discard those fields.

The invariant:

```txt
renderer controls may register position, zoom, rotate, downloads, loading, extra
renderer controls may not redefine file identity in FileViewerHeader
```

This should stay enforced by tests.

## Gap 7: The Public Hook Surface Must Stay Narrow

Keep:

```ts
useFileViewerResource()
```

Do not add:

```ts
useFileViewer()
useFileViewerContext()
useFileViewerControls()
useFileViewerHeader()
useOptionalFileViewerResource()
```

as public exports.

`useFileViewerResource()` is acceptable because resource adapters sometimes
need the active file payload. It is not a general state escape hatch.

## Final API Contract

### Easy Complete Viewer

```tsx
<FileViewer source={source} />
```

Expands to:

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

### Composed Viewer

```tsx
<FileViewer source={source} defaultOpen>
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

### Nested Leaf Preview

```tsx
<FileViewer source={source} bare />
```

This is the only public leaf-preview shortcut. It should render one coherent
preview, not ask the user to compose internal document chrome.

### Renderer-Specific Composition

```tsx
<FileViewer source={pdfSource} defaultOpen>
  <PdfViewerProvider>
    <FileViewerHeader>
      <FileViewerSidebarTrigger />
      <FileViewerTitle />
      <FileViewerMeta />
      <FileViewerControls />
    </FileViewerHeader>
    <FileViewerBody>
      <FileViewerSidebar>
        <PdfViewerThumbnails />
      </FileViewerSidebar>
      <FileViewerSurface>
        <PdfViewerPages bare />
      </FileViewerSurface>
    </FileViewerBody>
  </PdfViewerProvider>
</FileViewer>
```

This is valid because PDF state is renderer state. `FileViewer` still owns file
identity, header, sidebar placement, and surface anatomy.

## Implementation Plan

### Step 1: Fix The Source Viewer Block

Change `registry/new-york-v4/blocks/sources-viewer-block.tsx` so it imports
all shell parts from:

```ts
@/components/ui/file-viewer
```

and no longer imports:

```ts
@/components/ui/file-viewer-internal
@/components/ui/viewer
```

except where `Viewer*` is genuinely not the file shell. In this block, it
should not be needed for the shell.

Type the source from:

```ts
React.ComponentProps<typeof FileViewer>["source"]
```

not:

```ts
React.ComponentProps<typeof FileViewerProvider>["source"]
```

### Step 2: Fix The Architecture Tests

Remove the `sources-viewer-block` private-shell exception.

Assert:

```txt
<FileViewer
<FileViewerHeader
<FileViewerSidebarTrigger
<FileViewerTitle
<FileViewerMeta
<FileViewerControls
<FileViewerBody
<FileViewerSurface
<FileViewerSidebar
```

Assert absence:

```txt
FileViewerProvider
file-viewer-internal
ViewerRoot as shell
ViewerSidebar as file sidebar
```

Allow only:

```txt
useFileViewerResource
```

inside resource adapter helpers.

### Step 3: Make `FileViewerDocument` Shell-Safe

Change the public `FileViewerDocument` so it renders the routed document with:

```txt
leafControls = false
leafDownload = false
```

Then update the default shell to use the public `FileViewerDocument` instead of
the exported internal variant.

Keep leaf preview behavior behind:

```tsx
<FileViewer source={source} bare />
```

with private implementation only.

### Step 4: Remove Or Rename The Exported Internal Document Symbol

Do not export:

```ts
InternalFileViewerDocument
```

from `file-viewer-document.tsx`.

If cross-file internal reuse is unavoidable, move it to a private internal file
with a precise implementation name and do not re-export it from
`file-viewer.tsx`.

### Step 5: Update Docs

Update:

```txt
content/docs/viewers/file-viewer.mdx
content/docs/components/sidebar.mdx
content/docs/viewers/pdf-viewer.mdx
```

so the examples match the final semantics.

The docs should teach one root and one anatomy. They should not explain the
provider.

### Step 6: Rebuild Registry Payloads

After the source changes:

```bash
pnpm registry:build:items file-viewer sources-viewer-block pdf-viewer pdf-thumbnails-block
node scripts/sync-registry-index.mjs
```

Add any format-specific viewer items if the registry builder reports changed
relative internal dependencies.

### Step 7: Verify The Contract

Run:

```bash
pnpm test -- tests/file-viewer.test.tsx tests/pdf-viewer.test.tsx
pnpm test -- tests/viewer-architecture.test.ts -t "FileViewer|source demo blocks|public viewer docs|relative internal module|public/r viewer metadata"
pnpm typecheck
```

If a dev server is already running, visually check:

```txt
/view/viewers/file-viewer
/view/viewers/pdf-viewer
/view/blocks/pdf-thumbnails
/view/blocks/sources
/view/blocks/split
/view/blocks/partition
```

Do not start a dev server just for this verification unless explicitly asked.

## Acceptance Criteria

The cut is complete when all of these are true:

```txt
FileViewerProvider is not imported by blocks or docs.
file-viewer-internal is not imported by blocks or docs.
sources-viewer-block uses <FileViewer>, not <ViewerRoot> + <FileViewerProvider>.
FileViewerDocument is safe inside FileViewerSurface and does not render leaf chrome.
The default FileViewer shell uses the public FileViewerDocument.
Nested leaf preview remains available through <FileViewer source={source} bare />.
No public export exposes InternalFileViewerDocument.
FileViewerControls still ignores registered title/subtitle.
The registry payloads match source.
Architecture tests enforce the public grammar instead of preserving exceptions.
```

## The Final Taste Judgment

After these cuts, the component has a real claim to the platonic shape:

```txt
one root
one anatomy
one document slot
one narrow resource hook
private provider machinery
renderer-specific providers only for renderer-specific state
no duplicate chrome
no public internal names
```

That is the shadcn-grade version. Not because it hides complexity, but because
it puts each complexity at the only level where it belongs.
