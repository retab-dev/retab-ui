# File Viewer Chrome Ownership Final Blueprint

## Verdict

No, the file viewer has not reached the platonic ideal yet.

The public anatomy is close:

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

The remaining problem is subtler than naming. It is chrome ownership.

`FileViewerDocument` must mean "render the file document inside the file
viewer shell." It must not mean "render a standalone file preview with its own
toolbar." Standalone preview already has a perfect public expression:

```tsx
<FileViewer source={source} bare />
```

The final system should have one public grammar:

```txt
FileViewer
  FileViewerHeader
    FileViewerSidebarTrigger
    FileViewerTitle
    FileViewerMeta
    FileViewerControls
  FileViewerBody
    FileViewerSidebar
    FileViewerSurface
      FileViewerDocument
```

Everything else is internal machinery.

## The Core Mistake To Avoid

Do not collapse these two concepts:

```txt
local toolbar visibility
action availability
```

In shell mode, the renderer's local toolbar should be hidden, but the renderer
must still register real actions upward:

```txt
PDF local toolbar hidden
PDF page / zoom / rotate / download actions registered to FileViewerHeader
```

If the route maps shell mode to `download={false}`, the header can lose the
renderer's real download action. That produces a clean-looking component that is
not functionally complete.

The precise contract is:

```txt
controls prop
  controls whether the renderer draws its own local toolbar

download prop
  controls whether the renderer exposes a download action

registration
  is independent from local toolbar visibility
```

That gives the right shell behavior:

```tsx
<PdfResourceContent controls={false} download />
```

and the right standalone behavior:

```tsx
<PdfResourceContent controls download />
```

## Public API

Keep the public API small and anatomical:

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

Keep the public types aligned:

```txt
FileCategory
FileViewerProps
FileViewerHeaderProps
FileViewerTitleProps
FileViewerMetaProps
FileViewerControlsProps
FileViewerBodyProps
FileViewerSidebarProps
FileViewerSidebarTriggerProps
FileViewerSurfaceProps
FileViewerDocumentProps
```

Do not export:

```txt
FileViewerProvider
FileViewerRoute
InternalFileViewerDocument
FileViewerDocumentRenderer
useFileViewerContext
useOptionalFileViewerResource
useFileViewerHeader
FileViewerContent
FileHeader
PdfViewerHeader
```

The provider can exist internally. It should not become an advertised second way
to build the same thing.

## Public Semantics

### `FileViewer`

`FileViewer` is both the easy API and the composition root.

With no children and no `bare`, it renders the canonical shell:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    <FileViewerHeader />
    <FileViewerBody>
      <FileViewerSurface>
        <FileViewerDocument bare className="h-full" />
      </FileViewerSurface>
    </FileViewerBody>
  </ViewerRoot>
</FileViewerProvider>
```

With children, it provides the same context and lets the user author the same
anatomy manually:

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

With `bare` and no children, it renders a standalone document preview:

```tsx
<FileViewerProvider source={source}>
  <InternalFileViewerDocument chrome="standalone" bare />
</FileViewerProvider>
```

### `FileViewerDocument`

`FileViewerDocument` is public anatomy. It is the routed document inside the
shell.

It should always use shell chrome semantics:

```tsx
<InternalFileViewerDocument chrome="shell" />
```

It should:

- render the active format renderer;
- fill the `FileViewerSurface`;
- hide renderer-local toolbars;
- hide duplicate renderer headers;
- register page, slide, frame, zoom, rotate, loading, extra, and download
  controls upward;
- let `FileViewerControls` be the only visible toolbar inside the shell;
- keep fallback and error states visually inside the shell.

It should not:

- expose route props;
- expose provider props;
- expose internal document props;
- decide title or metadata;
- render its own header.

### `FileViewer bare`

`FileViewer bare` is the only public standalone leaf preview.

It should:

- render the routed file content without `ViewerRoot`;
- preserve renderer-local controls;
- preserve renderer-local download affordances;
- work inside email attachments, dropzone previews, and small nested previews.

It should not:

- require manual `FileViewerDocument`;
- require a public provider;
- require a second public route.

## Internal Vocabulary

Remove tree-position vocabulary:

```txt
leafControls
leafDownload
showLeafControls
showLeafDownload
```

Use ownership vocabulary:

```ts
type FileViewerDocumentChrome = "shell" | "standalone"
```

Then derive a private route policy:

```ts
type FileViewerRouteChrome = {
  localControls: boolean
  rendererDownload: boolean
  fallbackDownload: boolean
}
```

The policy should be:

```ts
function fileViewerRouteChrome(
  chrome: FileViewerDocumentChrome
): FileViewerRouteChrome {
  return chrome === "standalone"
    ? {
        localControls: true,
        rendererDownload: true,
        fallbackDownload: true,
      }
    : {
        localControls: false,
        rendererDownload: true,
        fallbackDownload: false,
      }
}
```

The important part is `rendererDownload: true` in shell mode.

Shell mode does not mean "no download." It means "no local download button."
The download action belongs in `FileViewerHeader` through
`FileViewerControls`.

## Renderer Contract

Every routed renderer must follow the same contract:

```txt
controls=false
  do not render local ViewerControls

download=true
  expose the download action if the renderer supports one

registration available
  register controls upward even when local controls are hidden
```

That means this is correct:

```tsx
useViewerControlsRegistration({
  position,
  zoom,
  rotate,
  downloads: download ? [downloadAction] : [],
})

return controls ? <ViewerControls ... /> : null
```

This is wrong:

```tsx
if (!controls) return null

useViewerControlsRegistration(...)
```

because shell mode would lose its toolbar state.

### Renderer Matrix

The route must apply the same chrome policy to every branch:

```txt
text/csv
text/markdown
text/html
text/plain
text/code

blob/pdf
blob/image
blob/pptx
blob/csv
blob/html
blob/docx
blob/xlsx
blob/markdown
blob/text

url/pdf
url/docx
url/image
url/pptx
url/xlsx
url/csv
url/markdown
url/html
url/text

unsupported fallback
```

For renderers with a `download` prop:

```tsx
controls={routeChrome.localControls}
download={routeChrome.rendererDownload}
```

For renderers without a `download` prop:

```tsx
controls={routeChrome.localControls}
```

For unsupported fallback:

```tsx
showDownload={routeChrome.fallbackDownload}
```

Unsupported shell fallback should not draw an in-document download button. The
shell header can use `resource.originalDownload` as its fallback download action.

## `FileViewerControls` Contract

`FileViewerControls` should be dumb and exact:

```txt
registered controls exist
  render registered position / zoom / rotate / extra / downloads

registered downloads are undefined
  use the file resource default download

registered downloads are []
  render no download
```

It should not forward registered title or subtitle. Title and metadata belong to:

```txt
FileViewerTitle
FileViewerMeta
```

This prevents the renderer from smuggling a second header into the file shell.

## Header Layout

The canonical header is:

```txt
left:
  sidebar trigger, title, meta

right:
  controls
```

The title should not show a file icon by default.

The meta should sit with the title on the left:

```txt
nvidia-10k-fy2024.pdf  pdf  Page 44 of 96          - 100% + rotate download
```

`FileViewerControls` may wrap on narrow screens, but the conceptual ownership
does not change.

## Implementation Steps

### 1. Make `FileViewerDocument` Shell-Only

`FileViewerDocument` should be:

```tsx
export function FileViewerDocument({
  bare = false,
  className,
}: FileViewerDocumentProps) {
  return (
    <InternalFileViewerDocument
      bare={bare}
      className={className}
      chrome="shell"
    />
  )
}
```

### 2. Make Default `FileViewer` Use Public Anatomy

The no-children, non-bare path should render:

```tsx
<>
  <FileViewerHeader />
  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument bare className="h-full" />
    </FileViewerSurface>
  </FileViewerBody>
</>
```

The default implementation and the docs example should be the same grammar.

### 3. Keep Standalone Preview Internal

The no-children, bare path should render:

```tsx
<InternalFileViewerDocument
  bare
  className={className}
  chrome="standalone"
/>
```

No public provider. No public route. No manual document composition for the
standalone case.

### 4. Fix Route Chrome Policy

Rename internal policy fields away from leaf language.

Use:

```txt
localControls
rendererDownload
fallbackDownload
```

Do not use:

```txt
rendererControls
rendererDownload=false in shell mode
leafControls
leafDownload
```

`rendererControls` is slightly ambiguous because registration is also a kind of
renderer control. `localControls` says the precise thing.

### 5. Audit Every Renderer

For each renderer, prove:

```txt
controls=false hides only local toolbar
download=true still registers download upward
download=false suppresses download action
```

Required renderers:

```txt
PdfResourceContent
ImageResourceContent
PptxResourceContent
DocxResourceContent
XlsxResourceContent
CsvFileContent
HtmlFileContent
PretextMarkdownViewer
ChenglouTextViewer
CodeViewer
```

If a renderer cannot register controls independently from local chrome, fix that
renderer instead of making `FileViewerRoute` special-case it.

### 6. Remove Manual Headerless Composition From Demos

Any demo that wants no shell header should use:

```tsx
<FileViewer source={source} bare />
```

not:

```tsx
<FileViewer source={source}>
  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument bare />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

That manual form now means "shell document with custom omitted header," which is
a rare advanced composition. It should not be the demo path for simple preview.

### 7. Keep Docs Crisp

The docs should teach only two primary forms:

```tsx
<FileViewer source={source} />
```

and:

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

For standalone preview:

```tsx
<FileViewer source={source} bare />
```

Do not document `FileViewerProvider`, `FileViewerRoute`, or internal document
parts.

## Required Tests

### Public API Tests

Assert public exports include:

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

Assert public exports do not include:

```txt
FileViewerProvider
FileViewerRoute
InternalFileViewerDocument
FileViewerDocumentRenderer
useFileViewerContext
useOptionalFileViewerResource
```

### Behavior Tests

Default shell:

```tsx
render(<FileViewer source={pdfSource} />)
```

Must prove:

```txt
one FileViewerHeader
one FileViewerControls row
one routed PDF document
no local PDF toolbar
download action visible in the header
```

Public composition:

```tsx
render(
  <FileViewer source={pdfSource}>
    <FileViewerHeader />
    <FileViewerBody>
      <FileViewerSurface>
        <FileViewerDocument />
      </FileViewerSurface>
    </FileViewerBody>
  </FileViewer>
)
```

Must behave like the default shell.

Standalone:

```tsx
render(<FileViewer source={pdfSource} bare />)
```

Must prove:

```txt
no FileViewerHeader
local renderer controls visible
download action visible locally
```

Unsupported fallback:

```txt
shell unsupported file
  download appears in header only

standalone unsupported file
  download appears in fallback card
```

### Route Matrix Tests

Representative branches must prove policy propagation:

```txt
url/pdf
blob/pdf
text/csv
blob/csv
blob/image
url/html
unsupported fallback
```

For shell routes:

```txt
controls/localControls false
download true when renderer supports download
fallbackDownload false
```

For standalone routes:

```txt
controls/localControls true
download true when renderer supports download
fallbackDownload true
```

### Architecture Tests

Assert:

```txt
file-viewer.tsx default path contains <FileViewerDocument bare className="h-full" />
file-viewer.tsx bare path contains chrome="standalone"
file-viewer-document.tsx public document contains chrome="shell"
file-viewer-route.tsx contains no leafControls / leafDownload
file-viewer-route.tsx contains localControls / rendererDownload / fallbackDownload
public registry payload exports no internal route/provider/document
docs do not mention internal provider/route APIs
```

## Verification Commands

Run:

```bash
pnpm typecheck
pnpm test -- tests/file-viewer.test.tsx
pnpm test -- tests/pdf-viewer.test.tsx
pnpm test -- tests/viewer-architecture.test.ts -t "FileViewer|public viewer docs|relative internal module|public/r viewer metadata"
```

If source/evidence blocks import `FileViewerDocument`, also run:

```bash
pnpm test -- tests/sources.test.tsx
```

After registry rebuild, verify:

```bash
pnpm test -- tests/viewer-architecture.test.ts -t "public/r viewer metadata"
```

## Registry Work

After implementation, rebuild:

```txt
file-viewer registry item
public/r/file-viewer.json
public/r/registry.json if touched by the registry generator
registry.json if touched by the registry generator
```

The embedded public registry payload must match the source public API. It must
not contain stale internal exports or stale leaf vocabulary.

## Non-Goals

Do not touch file-system viewer code.

Do not create a second public provider API.

Do not preserve compatibility shims.

Do not reintroduce `FileHeader`, `ViewerBody`, or `ViewerSurface` as the public
file viewer names. The public file viewer grammar should be fully named:

```txt
FileViewerHeader
FileViewerBody
FileViewerSidebar
FileViewerSurface
FileViewerDocument
```

Do not build a generic "document viewer" abstraction above this. The current
component is a file viewer. Its power comes from a small, exact public anatomy,
not from a broader naming layer.

## Definition Of Done

The system is done when all of these are true:

```txt
The default FileViewer shell is literally built from public FileViewer anatomy.

FileViewerDocument always means shell document.

FileViewer bare always means standalone preview.

No public provider, route, or internal document is exported.

No internal code uses leaf vocabulary.

Every renderer separates local toolbar visibility from action registration.

The shell has exactly one visible toolbar.

Standalone preview keeps renderer-local controls.

Download remains available in both shell and standalone modes.

Tests prove the route matrix.

Docs teach one grammar and one standalone shortcut.

Registry payloads are rebuilt and architecture tests protect the contract.
```

That is the platonic cut: one public grammar, one private routing engine, one
clear ownership rule.
