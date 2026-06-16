# File Viewer Document Chrome Terminal Blueprint

## Verdict

No, `FileViewer` has not reached the platonic ideal yet.

It has reached a strong public shape:

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

The remaining imperfection is precise:

```txt
FileViewerDocument is public anatomy, but it is not yet the exact document
primitive used by the default FileViewer shell.
```

Today, the default shell avoids duplicate renderer chrome by bypassing the
public document part:

```tsx
<InternalFileViewerDocument
  bare
  className="h-full"
  leafControls={false}
  leafDownload={false}
/>
```

while public `FileViewerDocument` still maps to:

```tsx
<InternalFileViewerDocument
  bare={bare}
  className={className}
  leafControls
  leafDownload
/>
```

That split is the last conceptual impurity.

The platonic component has one public grammar, and that grammar is executable.
The docs example, the default implementation, and the user-authored advanced
composition must all mean the same thing.

## Target

The final public distinction should be:

```txt
FileViewer
  the public file viewer root

FileViewerDocument
  the routed document inside a FileViewer shell

FileViewer bare
  the standalone leaf preview
```

No second public root.
No public provider.
No public route.
No public internal document.
No public chrome knobs.

## The Key Semantic Cut

### `FileViewerDocument`

`FileViewerDocument` should mean:

```txt
render the active file inside the FileViewer shell
```

It should:

- render the routed format content;
- fill `FileViewerSurface`;
- register page, zoom, rotate, loading, extra, and download controls upward;
- let `FileViewerControls` render those controls in `FileViewerHeader`;
- suppress renderer-local toolbars;
- suppress renderer-local download buttons;
- suppress duplicate renderer headers;
- keep fallback/error behavior consistent with the file shell.

It should not mean:

```txt
render a standalone file preview with local toolbar chrome
```

That standalone meaning already belongs to:

```tsx
<FileViewer source={source} bare />
```

### `FileViewer bare`

`FileViewer bare` with no children should mean:

```txt
standalone routed file preview
```

It is for:

- email attachment leaves;
- nested previews;
- upload/dropzone preview panes;
- small demos that do not want a file shell header;
- custom outer shells that only need the renderer.

It should keep renderer-local controls when the renderer has them.

### `FileViewer` With Children

`FileViewer` with children should mean:

```txt
provide file context and viewer root, then render authored anatomy
```

The authored anatomy decides where the header, sidebar, surface, and document
go. But if it uses `FileViewerDocument`, that document must have shell chrome
semantics.

## Final Public API

The public exports should stay:

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

And the public types:

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

## Final Internal Vocabulary

Remove:

```ts
leafControls
leafDownload
```

Those names describe position in a tree. The real concept is chrome ownership.

Use:

```ts
type FileViewerDocumentChrome = "shell" | "standalone"
```

Meaning:

```txt
shell
  FileViewerHeader owns controls and downloads.
  The routed renderer renders document pixels only.

standalone
  The routed renderer owns its local controls and downloads.
  There may be no FileViewerHeader.
```

If the route needs an explicit policy object, derive it privately:

```ts
type FileViewerRouteChrome = {
  rendererControls: boolean
  rendererDownload: boolean
  fallbackDownload: boolean
}
```

Suggested mapping:

```ts
function fileViewerRouteChrome(
  chrome: FileViewerDocumentChrome
): FileViewerRouteChrome {
  return chrome === "standalone"
    ? {
        rendererControls: true,
        rendererDownload: true,
        fallbackDownload: true,
      }
    : {
        rendererControls: false,
        rendererDownload: false,
        fallbackDownload: false,
      }
}
```

The exact helper can be smaller. The important thing is the name and the
ownership model.

## Desired Implementation Shape

### `file-viewer-document.tsx`

Target shape:

```tsx
export function FileViewerDocument(props: FileViewerDocumentProps) {
  return <InternalFileViewerDocument {...props} chrome="shell" />
}

export function InternalFileViewerDocument({
  bare = false,
  className,
  chrome,
}: FileViewerDocumentProps & {
  chrome: FileViewerDocumentChrome
}) {
  ...

  return (
    <FileViewerRoute
      bare={bare}
      className={className}
      descriptor={descriptor}
      descriptorSignal={descriptorSignal}
      isolateStyles={isolateStyles}
      resource={resource}
      chrome={chrome}
    />
  )
}
```

`InternalFileViewerDocument` can remain exported from
`file-viewer-document.tsx` for sibling module use. It must not be re-exported
from `file-viewer.tsx`.

### `file-viewer.tsx`

The default non-bare no-children path should use public anatomy:

```tsx
<FileViewerHeader />
<FileViewerBody>
  <FileViewerSurface>
    <FileViewerDocument bare className="h-full" />
  </FileViewerSurface>
</FileViewerBody>
```

The bare no-children path should use the internal standalone path:

```tsx
<InternalFileViewerDocument
  bare
  className={className}
  chrome="standalone"
/>
```

This creates the clean public truth:

```txt
default FileViewer = public anatomy
bare FileViewer = standalone preview
```

### `file-viewer-route.tsx`

Change:

```ts
leafControls: boolean
leafDownload: boolean
```

to:

```ts
chrome: FileViewerDocumentChrome
```

or:

```ts
chrome: FileViewerRouteChrome
```

Then apply the policy to every branch.

Required branch audit:

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

Direct URL and Blob branches must have the same chrome behavior.

No branch should accidentally omit `controls={...}` when its renderer supports
controls.

## Header Controls Contract

The current decision should stay:

```txt
FileViewerControls does not forward registered title/subtitle.
```

`ViewerControls` may still accept `title` and `subtitle` as a lower-level
generic control component.

But renderer registration inside the file viewer should be operational:

```txt
position
zoom
rotate
downloads
loading
extra
```

not identity:

```txt
title
subtitle
```

The sharper follow-up is to split the type:

```ts
type ViewerControlsRegistrationState = {
  position?: ViewerControlPosition | null
  zoom?: ViewerZoomControl | null
  rotate?: ViewerRotateControl | null
  downloads?: ViewerDownloadAction[]
  loading?: boolean
  extra?: React.ReactNode
}

type ViewerControlsProps = ViewerControlsRegistrationState & {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  onDownloadError?: ViewerDownloadErrorHandler
  size?: "default" | "sm"
}
```

This is optional for the chrome cut, but it is the cleaner endpoint.

## Test Plan

### Public API Tests

Keep asserting:

```ts
expect(exports).not.toContain("FileViewerProvider")
expect(exports).not.toContain("InternalFileViewerDocument")
expect(exports).not.toContain("FileViewerRoute")
expect(exports).not.toContain("FileHeader")
```

Keep asserting:

```ts
expect(exports).toEqual(
  expect.arrayContaining([
    "FileViewer",
    "FileViewerHeader",
    "FileViewerTitle",
    "FileViewerMeta",
    "FileViewerControls",
    "FileViewerBody",
    "FileViewerSidebar",
    "FileViewerSidebarTrigger",
    "FileViewerSurface",
    "FileViewerDocument",
    "useFileViewerResource",
  ])
)
```

### Default Shell Tests

Add or strengthen:

```txt
<FileViewer source={pdfSource} />
  renders FileViewerHeader
  renders FileViewerTitle
  renders FileViewerMeta
  renders FileViewerControls
  renders routed PDF document
  shows one page position control
  shows one download control
  does not render a second PDF toolbar inside the surface
```

### Public Composition Tests

Add:

```tsx
<FileViewer source={pdfSource}>
  <FileViewerHeader>
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>
  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument bare className="h-full" />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

Assert it matches the default shell behavior:

```txt
one header
one controls row
registered PDF position visible in the header
no duplicate renderer controls
```

### Standalone Leaf Tests

Add:

```txt
<FileViewer source={pdfSource} bare />
  renders routed PDF document without FileViewerHeader
  keeps renderer-local controls
```

This proves the standalone path did not regress.

### Route Policy Tests

For representative formats:

```txt
PDF URL
PDF Blob
CSV text
CSV Blob
image Blob
unsupported file
```

Assert shell path and standalone path pass the expected control/download
policy.

### Architecture Tests

Require:

```txt
file-viewer.tsx default path contains <FileViewerDocument
file-viewer.tsx bare no-children path contains chrome="standalone"
file-viewer-document.tsx public FileViewerDocument contains chrome="shell"
file-viewer-route.tsx does not contain leafControls
file-viewer-route.tsx does not contain leafDownload
file-viewer.tsx does not re-export InternalFileViewerDocument
file-viewer.tsx does not re-export FileViewerProvider
```

## Registry Plan

After implementation:

```bash
pnpm registry:build:items file-viewer
node scripts/sync-registry-index.mjs
```

Then confirm:

```txt
public/r/file-viewer.json matches registry/new-york-v4/ui/file-viewer.tsx
public/r/file-viewer.json matches registry/new-york-v4/ui/file-viewer-document.tsx
public/r/file-viewer.json matches registry/new-york-v4/ui/file-viewer-route.tsx
```

If any composed blocks are touched, rebuild those exact block items too.

## Visual QA

Do not start a dev server automatically.

When a dev server is already running, inspect:

```txt
default file viewer PDF
PDF thumbnails block
split viewer block
partition viewer block
email selected attachment
dropzone/file intake preview
unknown fallback
long filename header
narrow viewport header wrapping
overlay sidebar trigger behavior
```

The visual question is specific:

```txt
Is there any duplicated toolbar, duplicated download button, or competing
document title inside the surface?
```

If yes, the chrome policy is still wrong.

## Non-Goals

Do not touch file-system.

Do not fold Dropzone into `FileViewer`.

Do not make Email a `FileViewer`.

Do not build a generic `SegmentedViewer`.

Do not expose `FileViewerProvider`.

Do not add public props like:

```txt
documentChrome
controlsMode
hideRendererControls
standalone
```

The public API should stay smaller than the internal machinery.

## Success Criteria

The final state is achieved when:

```txt
FileViewer is the only public root.
FileViewerProvider is internal machinery.
FileViewerDocument means shell document.
FileViewer bare means standalone leaf preview.
The default shell is implemented with public anatomy.
Internal chrome policy is named by ownership, not by leaf position.
No route branch leaks local renderer controls into shell composition.
No public composition duplicates toolbar/download/header chrome.
Docs, demos, tests, and registry payloads all teach the same grammar.
```

That would be close to the platonic ideal:

```txt
simple root
exact anatomy
one public way
private machinery
no duplicate chrome
no provider leakage
no prettier lie in the docs
```

The component would still be real software, not metaphysics. But structurally,
it would finally have the right taste.
