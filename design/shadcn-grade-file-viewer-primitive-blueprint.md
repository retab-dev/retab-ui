# Shadcn-Grade File Viewer Primitive Blueprint

## Verdict

The current viewer primitive is good, but incomplete for the product standard.

`ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSidebar`, and
`ViewerSurface` are the right generic layer. They describe space without
claiming domain semantics. Keep that layer small.

The missing piece is the file-viewer layer above it.

A shadcn-grade file viewer needs a stable, composable file contract:

```txt
source -> resource -> file chrome -> format content
```

The current implementation has the ingredients, but the boundary is not
precise enough. PDF has decomposed named parts. CSV and HTML use
`ResourceDocShell`. `FileViewer` routes between leaf renderers. These pieces
work, but they do not yet form one inevitable API.

The split viewer regression is the proof. Rendering `PdfViewerPages` without
`PdfViewerHeader` was possible because "content-only PDF pages" and "complete
file viewer" are too easy to confuse.

## Product Standard

Shadcn-grade means the component feels like it belongs in a serious component
registry:

- copy-pasteable;
- predictable;
- composable without hidden slots;
- accessible by default;
- visually quiet and exact;
- token-driven, not bespoke per format;
- complete across loading, error, unsupported, empty, and loaded states;
- small public API with named escape hatches;
- no app-specific assumptions;
- no clever framework hidden behind one mega prop.

The file viewer should feel like a primitive users can build products around,
not like a demo wrapper around many unrelated renderers.

## Keep The Generic Viewer Primitive

The primitive set should remain:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

Do not add generic primitives yet:

```txt
ViewerToolbar
ViewerRail
ViewerFooter
ViewerStrip
ViewerOverlay
ViewerPane
```

Those names are tempting, but they would move product semantics into the
generic layer too early.

Local domain parts are fine:

```txt
PdfViewerHeader
PdfViewerPages
PdfViewerThumbnails
SplitViewerPageRail
SplitViewerLegend
EmailViewerPartsList
FileViewerHeader
FileViewerContent
```

The rule is simple:

```txt
Viewer primitives own layout.
Domain parts own meaning.
Leaf renderers own format mechanics.
```

## Current Problem

There are three chrome contracts today.

### PDF Contract

PDF has the best shape:

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot>
    <PdfViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <PdfViewerPages />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

This exposes a complete easy API and named parts for composition.

### ResourceDocShell Contract

CSV and HTML use `ResourceDocShell`.

That gives them a file header, actions, and download behavior, but it is not
the same named-parts contract as PDF. It is a private shell, not a public file
viewer grammar.

### FileViewer Router Contract

`FileViewer` routes sources to concrete renderers.

That is useful, but it does not currently expose a decomposed contract like:

```tsx
<FileViewerProvider source={source}>
  <FileViewerHeader />
  <FileViewerContent />
</FileViewerProvider>
```

So callers can either use the full router or drop into format-specific parts.
There is no canonical middle layer for "normal file chrome around whichever
format this source resolves to."

## Target Contract

The easy API stays:

```tsx
<FileViewer source={source} />
```

The composable API becomes:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    <FileViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <FileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileViewerProvider>
```

This provider is leaf-scoped. It owns one file source, one resolved resource,
one detected category, and one routed content renderer. It must not become a
workflow provider for split, partition, email, file-system browsing, or
extraction review.

The provider is justified only because `FileViewerHeader` and
`FileViewerContent` need shared file/resource state.

## Naming Rule

The names must make chrome boundaries impossible to misunderstand.

Full viewers render complete chrome:

```txt
FileViewer
PdfViewer
ImageViewer
DocxViewer
XlsxViewer
CsvViewer
CodeViewer
TextViewer
```

Named parts render explicit regions:

```txt
FileViewerHeader
FileViewerContent
PdfViewerHeader
PdfViewerPages
PdfViewerThumbnails
CsvViewerGrid
XlsxViewerWorkbook
ImageViewerCanvas
TextViewerContent
```

Content-only parts should not be named `*Viewer` unless they are the complete
thing a user expects. This is the mistake to avoid:

```txt
PdfViewerPages is safe because "Pages" says content-only.
PdfResourceViewer is risky because it sounds complete, but may be used as a
content renderer depending on toolbar props.
```

If a component omits the file header, its name must say so.

## Bare Semantics

`bare` must mean:

```txt
remove the outer card frame so a parent layout can own border/radius/background
```

`bare` must not mean:

```txt
remove required file controls
remove file identity
remove download
remove page/zoom controls
turn a full viewer into content-only pages
```

If a caller wants content-only rendering, use a named content part:

```tsx
<PdfViewerPages bare />
<FileViewerContent />
```

Do not overload `bare` to mean content-only.

## File Header Contract

`FileViewerHeader` should provide the common file surface:

- file name;
- optional file type;
- optional size;
- loading status;
- format-specific controls;
- download action;
- overflow actions;
- accessible labels and tooltips;
- stable height;
- truncation that never overlaps controls.

Format-specific controls are contributed by content renderers through the
provider, not hand-reimplemented by `FileViewerHeader`.

Examples:

- PDF registers page count, current page, zoom, fit width, rotate.
- Image registers zoom, actual size, fit.
- XLSX registers active sheet and zoom.
- CSV may register row count, column count, and search/filter controls later.
- Text/code registers search, wrap, and zoom only if those features exist.

The header renders the same file identity and action grammar across all
formats.

## Content Contract

`FileViewerContent` routes the resolved file category to a content renderer.

It owns:

- lazy loading the concrete renderer;
- suspense fallback;
- unsupported state;
- resource error boundary;
- aborting stale descriptor work;
- passing content-only props to leaf renderers;
- registering header controls from the active renderer.

It must not own:

- app workflow state;
- sidebars;
- file-system navigation;
- split/partition semantics;
- recursive MIME tree state;
- arbitrary caller toolbars.

## Leaf Renderer Contract

Each concrete format should expose two levels.

Complete easy API:

```tsx
<PdfViewer source={source} />
```

Named parts:

```tsx
<PdfViewerProvider source={source}>
  <PdfViewerHeader />
  <PdfViewerPages />
</PdfViewerProvider>
```

For formats that do not need decomposed public parts yet, the internal shape
can still follow the same contract.

Do not keep `ResourceDocShell` as the long-term public shape. It can remain as
an internal transition helper, but the target is one file header grammar, not
one private shell per subset of formats.

## Compound Viewer Rule

Compound viewers compose file viewers; they do not replace file chrome.

Correct:

```tsx
<SplitViewerProvider result={result}>
  <ViewerRoot>
    <ViewerBody>
      <ViewerSidebar>
        <SplitViewerPageRail />
      </ViewerSidebar>
      <ViewerSurface>
        <FileViewerProvider source={source}>
          <FileViewerHeader />
          <SplitViewerLegend />
          <FileViewerContent />
        </FileViewerProvider>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

Incorrect:

```tsx
<SplitViewerHeader />
<PdfViewerPages />
```

The domain viewer may add chrome around the file viewer, but it must not
silently delete the file viewer's own required chrome.

## File System Viewer Rule

`FileSystemViewer` is a compound viewer.

It should compose:

- file-system provider for paths, selection, lazy loading, sorting, query, and
  view mode;
- `ViewerRoot` layout;
- file-system header/navigation;
- list/grid/column/gallery surfaces;
- `FileViewer` or `FileViewerProvider` for the selected file preview.

It should not make `FileViewerProvider` own file-system paths.

The layering is:

```txt
FileSystemProvider
  -> selected file source
  -> FileViewerProvider
  -> FileViewerHeader + FileViewerContent
```

This keeps file browsing and file rendering separate.

## API Sketch

```ts
type FileViewerProps = {
  source: ViewerSource
  as?: FileCategory
  className?: string
  bare?: boolean
  isolateStyles?: boolean
}

type FileViewerProviderProps = FileViewerProps & {
  children: React.ReactNode
}

type FileViewerHeaderProps = {
  className?: string
  actions?: React.ReactNode
}

type FileViewerContentProps = {
  className?: string
}
```

Do not add render props:

```txt
renderHeader
renderToolbar
renderContent
renderActions
components
slots
```

If customization is needed, expose named parts and small props.

## State Shape

The file provider should expose narrow hooks:

```ts
useFileViewerHeader()
useFileViewerContent()
useFileViewerResource()
```

Avoid one large `useFileViewer()` bag unless it stays private.

Header state:

```ts
type FileViewerHeaderState = {
  resource: ViewerResource
  category: FileCategory
  status: "loading" | "ready" | "error" | "unsupported"
  controls: React.ReactNode | null
  meta: React.ReactNode | null
  downloadAction: ViewerDownloadAction
}
```

Content state:

```ts
type FileViewerContentState = {
  descriptor: FileDescriptor
  resource: ViewerResource
  signal: AbortSignal
  registerHeaderControls: (controls: FileViewerHeaderControls | null) => void
}
```

Keep state derived where possible. Do not mirror descriptor fields into
separate state unless async transitions require it.

## Visual Standard

The default frame should be quiet and operational:

- 8px or smaller radius unless the existing design token says otherwise;
- stable 40px header height;
- dense controls;
- icon buttons with labels/tooltips;
- no large decorative empty states;
- muted backgrounds only for document gutters;
- no nested card inside card;
- no layout shift when controls register after content loads.

The header should reserve enough structure that PDF controls appearing after
load do not shove the file name or resize the viewer.

## Accessibility Standard

Required:

- headers expose useful accessible names;
- icon controls have labels and titles;
- unsupported and error states announce the file name and action;
- keyboard focus stays inside interactive controls, not decorative page
  surfaces;
- scrollable content regions have labels when there are multiple scroll areas;
- thumbnails, page rails, and sidebars use navigation/list semantics only when
  they actually behave like navigation/lists.

## Migration Plan

1. Keep `ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSidebar`, and
   `ViewerSurface` unchanged.
2. Introduce leaf-scoped `FileViewerProvider`, `FileViewerHeader`, and
   `FileViewerContent`.
3. Rebuild `FileViewer` as preassembled composition over those parts.
4. Move `ResourceDocShell` behavior into `FileViewerHeader` and
   `FileViewerContent` gradually.
5. Make PDF continue to expose its format-specific named parts.
6. Ensure `FileViewerContent` can either use a complete leaf viewer in
   content-only mode or a leaf content part with registered controls.
7. Update split viewer to compose file header plus split legend plus PDF pages.
8. Update file-system preview to use the full `FileViewer` easy API unless it
   needs to insert domain chrome between file header and content.
9. Update docs to teach easy API first, named parts second.
10. Add architecture tests that distinguish complete viewers from content-only
    parts.

## Tests

Required tests:

- `FileViewer` renders one `ViewerRoot`, one file header, and one content
  surface for supported formats.
- `bare` removes the outer frame but keeps the file header.
- PDF routed through `FileViewer` exposes page indication and zoom controls
  after content registers controls.
- CSV, HTML, markdown, text, image, DOCX, PPTX, and XLSX keep consistent file
  header height and download action.
- Unsupported files render a useful state with download.
- Changing sources aborts stale async work and clears old header controls.
- Split viewer cannot render PDF pages without a PDF/file header in the
  canonical block.
- File-system preview composes `FileViewer` and does not duplicate file
  routing logic.

Architecture tests:

- `FileViewer` easy API contains `FileViewerProvider`, `ViewerRoot`,
  `FileViewerHeader`, `ViewerBody`, `ViewerSurface`, and `FileViewerContent`.
- Content-only components include names like `Content`, `Pages`, `Grid`,
  `Workbook`, or `Canvas`.
- No new generic primitive is added without updating this blueprint.

## Non-Goals

- Do not resurrect `ViewerShell`.
- Do not add a global provider that owns every possible viewer domain.
- Do not add slot-object APIs.
- Do not make file-system browsing part of `FileViewer`.
- Do not reimplement PDF controls in `FileViewerHeader`.
- Do not solve editing, annotations, extraction, or workflow review in the file
  viewer layer.
- Do not edit `retab_react/`.

## Acceptance Criteria

The file viewer layer is shadcn-grade when:

- the easy API is enough for normal use;
- named parts are enough for composition without render props;
- complete viewers always include file chrome;
- content-only parts are obvious from their names;
- all formats share one file header grammar;
- compound viewers can place their own domain chrome around a file viewer
  without deleting file controls;
- the file-system viewer can use the file viewer as a leaf preview;
- docs make the architecture obvious from the first example.
