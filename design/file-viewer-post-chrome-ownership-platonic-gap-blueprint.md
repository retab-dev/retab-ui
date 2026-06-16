# File Viewer Post Chrome Ownership Platonic Gap Blueprint

## Verdict

No, `FileViewer` has not reached the platonic ideal yet.

It is now structurally right:

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

And the main conceptual split is now correct:

```txt
FileViewerDocument
  shell document

FileViewer bare
  standalone leaf preview
```

The provider is private. The route is private. The internal document is private.
That is good.

But the implementation is not yet perfect. The last imperfections are small,
precise, and worth fixing because they are exactly the kind of things that make
an API feel inevitable instead of merely good.

## Current Strengths

The public grammar is now close to the desired shadcn-style anatomy:

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

The easy API and composed API now converge:

```tsx
<FileViewer source={source} />
```

is conceptually the same as:

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

Chrome ownership is now almost right:

```txt
shell
  FileViewerHeader owns visible controls
  renderer registers actions upward
  renderer local toolbar is hidden

standalone
  renderer owns its local controls
```

That is the right architecture.

## Remaining Gap 1: `FileViewerDocument bare`

The biggest remaining impurity is this:

```tsx
<FileViewerDocument bare className="h-full" />
```

inside the default shell.

This is not a public API catastrophe, but it is conceptually wrong.

`bare` should belong to:

```tsx
<FileViewer bare />
```

not to:

```tsx
<FileViewerDocument />
```

In the ideal, the canonical default implementation is exactly:

```tsx
<FileViewerHeader />
<FileViewerBody>
  <FileViewerSurface>
    <FileViewerDocument />
  </FileViewerSurface>
</FileViewerBody>
```

No `bare`.
No `className="h-full"`.
No visible layout compensation.

### Why This Matters

`FileViewerDocument bare` leaks renderer-frame concerns into the public document
part. It means the document still carries two ideas:

```txt
what document should render
how much renderer frame should be visible
```

The platonic document part should only answer:

```txt
render the current file document in this surface
```

The surface, shell, and route should decide the rest.

### Target

`FileViewerDocumentProps` should ideally become:

```ts
export type FileViewerDocumentProps = React.ComponentProps<"div">
```

or even:

```ts
export type FileViewerDocumentProps = {
  className?: string
}
```

but not:

```ts
{
  bare?: boolean
}
```

Then the default shell becomes:

```tsx
<FileViewerDocument />
```

and standalone remains:

```tsx
<FileViewer source={source} bare />
```

## Remaining Gap 2: `download` Still Means Too Much

The current fix correctly keeps renderer downloads available in shell mode:

```tsx
<PdfResourceContent controls={false} download />
```

This is behaviorally right because the renderer can register a real download
action upward while hiding its local toolbar.

But the prop name is still overloaded.

Today `download` can mean:

```txt
make download action available
maybe render local download affordance
maybe render error-state download affordance
```

The ideal separates:

```txt
download action availability
local chrome visibility
error/fallback chrome visibility
```

### Target

Renderer props should eventually distinguish:

```ts
type RendererChromePolicy = {
  localControls: boolean
  exposeDownload: boolean
  localErrorDownload: boolean
}
```

or a smaller equivalent if the component API already carries enough signal.

The route policy would then be exact:

```ts
shell:
  localControls: false
  exposeDownload: true
  localErrorDownload: false

standalone:
  localControls: true
  exposeDownload: true
  localErrorDownload: true
```

The important distinction:

```txt
exposeDownload
  registers / makes the action available

localErrorDownload
  draws an in-document fallback or error download affordance
```

This removes the last semantic ambiguity in chrome ownership.

## Remaining Gap 3: `FileViewerRoute` Is Correct But Verbose

`FileViewerRoute` is explicit, fast, and easy to inspect. That is good.

But it repeats the same policy plumbing across every branch:

```tsx
controls={routeChrome.localControls}
download={routeChrome.rendererDownload}
```

This repetition is not yet ugly enough to justify a generic registry, but it is
not Flaubertian either.

The risk is not line count. The risk is drift:

```txt
one branch forgets controls
one branch forgets download
one branch invents its own fallback behavior
```

The architecture test now guards this, but a perfect design would make the
correct thing harder to forget.

### Target

Keep explicit routing, but compress policy injection with small local helpers:

```tsx
const rendererChrome = fileViewerRendererChrome(routeChrome)
const fallbackChrome = fileViewerFallbackChrome(routeChrome)
```

Then route branches read as:

```tsx
<PdfResourceContent
  resource={resource}
  className={className}
  bare={bare}
  {...rendererChrome}
/>
```

and:

```tsx
<UnsupportedCard
  resource={resource}
  className={className}
  bare={bare}
  {...fallbackChrome}
/>
```

Do not create a registry map unless it makes the code simpler. A giant
configuration object would be worse than the current explicit switch.

## Remaining Gap 4: `FileViewerControls` Fallback Download Is Subtle

Current behavior:

```ts
const registeredDownloads = controlsState?.downloads
const downloads =
  registeredDownloads !== undefined
    ? registeredDownloads
    : [resource.originalDownload]
```

This is correct, but subtle:

```txt
undefined
  renderer has not registered anything, so use file default

[]
  renderer explicitly registered no downloads
```

That distinction is good, but the code relies on convention.

### Target

Make the distinction explicit in naming:

```ts
const hasRegisteredDownloads = controlsState?.downloads !== undefined
const downloads = hasRegisteredDownloads
  ? controlsState.downloads
  : [resource.originalDownload]
```

This is not a large architectural change. It is just better code.

## Remaining Gap 5: Public Docs Should Stop Saying `bare` Removes The Spatial Frame With Children

The docs currently explain:

```txt
FileViewer bare removes the spatial frame when children are supplied.
Without children, FileViewer bare renders only the routed file document.
```

That is technically true, but it is not ideal teaching.

The public docs should teach only:

```txt
FileViewer
  shell viewer

FileViewer with named parts
  composed shell viewer

FileViewer bare
  standalone file preview
```

Avoid making `bare + children` feel like a common path. It is an escape hatch,
not a mental model.

### Target Docs

Teach:

```tsx
<FileViewer source={source} />
```

Teach:

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

Teach:

```tsx
<FileViewer source={source} bare />
```

Do not dwell on:

```tsx
<FileViewer source={source} bare>
  ...
</FileViewer>
```

unless an advanced composition section genuinely needs it.

## Remaining Gap 6: Visual QA Is Still Missing

Tests prove the contract.

They do not prove taste.

The final state needs a visual pass for:

```txt
default PDF shell
PDF shell with thumbnail sidebar
HTML file in shell
CSV file in shell
code/text in shell
unsupported shell fallback
standalone bare attachment preview
```

Things to inspect:

```txt
one header
one toolbar
title left
meta left
controls right
no file icon
no duplicate renderer toolbar
download still available
zoom controls still available where supported
standalone still has local controls
unsupported shell has only header download
unsupported standalone has card download
```

This should be done with an already running dev server. Do not start one from
the agent unless the repository instruction changes.

## Final Target API

The ideal final anatomy:

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

The ideal standalone leaf:

```tsx
<FileViewer source={source} bare />
```

The ideal default implementation:

```tsx
export function FileViewer({ children, bare, ...props }: FileViewerProps) {
  if (children != null) return <ComposedFileViewer {...props}>{children}</ComposedFileViewer>
  if (bare) return <StandaloneFilePreview {...props} />
  return (
    <ComposedFileViewer {...props}>
      <FileViewerHeader />
      <FileViewerBody>
        <FileViewerSurface>
          <FileViewerDocument />
        </FileViewerSurface>
      </FileViewerBody>
    </ComposedFileViewer>
  )
}
```

The names above are illustrative. Do not export `ComposedFileViewer` or
`StandaloneFilePreview`.

## Implementation Plan

### 1. Remove `bare` From Public `FileViewerDocument`

Change:

```ts
export type FileViewerDocumentProps = Pick<
  FileViewerCoreProps,
  "bare" | "className"
>
```

to:

```ts
export type FileViewerDocumentProps = {
  className?: string
}
```

or the local convention for div-like class props.

Update:

```tsx
<FileViewerDocument bare className="h-full" />
```

to:

```tsx
<FileViewerDocument />
```

inside the default shell.

### 2. Make Shell Surface Fill The Document

If removing `bare className="h-full"` breaks sizing, fix the owning shell:

```txt
FileViewerSurface
InternalFileViewerDocument
FileViewerRoute
renderer frames
```

Do not put sizing compensation back on the public document part.

### 3. Split Download Semantics If Needed

Audit all renderers:

```txt
PDF
image
PPTX
DOCX
XLSX
CSV
HTML
Markdown
Text
Code
```

For each, prove:

```txt
shell:
  local toolbar hidden
  download action registered upward
  local error/fallback download hidden

standalone:
  local toolbar visible
  local download visible
  local error/fallback download visible
```

If `download` cannot express that cleanly, introduce the smallest internal
policy that can.

### 4. Compress Route Policy Without Hiding The Route

Prefer:

```ts
const rendererChrome = {
  controls: routeChrome.localControls,
  download: routeChrome.rendererDownload,
}
```

over repeating those props manually everywhere.

But keep the route readable. Do not create a generic format registry unless the
result is visibly simpler.

### 5. Tighten Tests

Add or keep tests proving:

```txt
FileViewerDocument has no bare prop
default FileViewer source contains <FileViewerDocument />
standalone still uses chrome="standalone"
public FileViewerDocument still uses chrome="shell"
shell PDF gets controls=false and download/exposeDownload=true
unsupported shell has one download in the header
unsupported standalone has one download in the card
code/text register controls upward with local controls hidden
no route branch omits localControls
no route branch omits renderer download policy where supported
```

### 6. Update Docs

Docs should present three paths:

```txt
easy shell
composed shell
standalone bare preview
```

Do not teach `bare + children` as a normal path.

### 7. Rebuild Registry

Run:

```bash
pnpm registry:build
```

Then verify public payloads:

```txt
public/r/file-viewer.json
public/r/code-viewer.json if code viewer changes
public/r/registry.json
registry.json
```

## Verification

Required:

```bash
pnpm typecheck
pnpm test -- tests/file-viewer.test.tsx
pnpm test -- tests/pdf-viewer.test.tsx
pnpm test -- tests/code-viewer.test.tsx tests/code-viewer-edge-cases.test.tsx
pnpm test -- tests/sources.test.tsx
pnpm test -- tests/viewer-architecture.test.ts -t "FileViewer|public viewer docs|relative internal module|public/r viewer metadata"
```

Visual QA if a dev server is already running:

```txt
File Viewer docs page
PDF thumbnails block
source/evidence viewer blocks that embed FileViewer
email attachment preview
dropzone file preview
```

Do not start the dev server from the agent under current repository rules.

## Definition Of Perfection

The component reaches the platonic ideal when all of this is true:

```txt
FileViewerDocument is prop-light and never needs bare.

The default shell is literally the public grammar shown in the docs.

FileViewer bare is the only standalone preview shortcut.

No public provider, route, or internal document leaks.

Chrome ownership has no overloaded names.

Local toolbar visibility and action registration are separate concepts.

Every route branch gets the same chrome policy automatically or obviously.

The header has title/meta on the left and controls on the right.

No renderer title/subtitle leaks into FileViewerControls.

No duplicate toolbar appears.

Download exists in shell and standalone modes, but appears in only one place.

Docs teach the fewest possible concepts.

Tests and visual QA prove the contract.
```

That is the last cut from "good design" to "inevitable design."
