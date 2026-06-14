# Composite Viewer Primitives Migration Blueprint

## Verdict

We have not migrated every composite viewer to the new structure.

We migrated the core file viewer family:

- PDF viewer;
- PDF thumbnails;
- email viewer;
- split viewer;
- file-system viewer;
- uploadable file viewer.

The remaining composite viewers still expose the old shape:

- `PageMarkdownViewer`;
- `ParseViewer`;
- `PartitionViewer`;
- `ClassifierViewer`.

The leak is `renderDocument`.

`renderDocument` hides hierarchy inside a prop. It makes the viewer own both
domain state and composition. It prevents the caller from reading the layout as
JSX. It is the exact pattern the provider + named-parts design was created to
remove.

The next migration is therefore not a cleanup. It is the proof that the viewer
primitive system is general enough for workflow viewers, not only file viewers.

## Target

Every composite viewer must follow the same grammar:

```tsx
<DomainViewerProvider value={domainData}>
  <ViewerRoot>
    <DomainViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <DomainViewerDocument />
      </ViewerSurface>
      <ViewerSurface>
        <DomainViewerOutput />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</DomainViewerProvider>
```

The exact body can be one pane, two panes, sidebar + surface, or resizable
panels. The important rule is that the structure is visible in JSX.

No domain viewer should accept:

```ts
renderDocument
renderSource
renderViewer
slots
components
```

`renderViewer` remains acceptable only for source-acquisition blocks such as
uploadable examples, where the block is not the document viewer domain. It must
not be used inside the viewer domain layer.

## Current Problem

### PageMarkdownViewer

`PageMarkdownViewer` is currently both:

- the rendered/text markdown output viewer;
- a two-pane document comparison viewer.

That is too much.

Its `renderDocument` prop turns the source document pane into hidden layout:

```tsx
<PageMarkdownViewer
  pages={pages}
  renderDocument={(handlers) => <PdfViewer {...handlers} />}
/>
```

The visual hierarchy is not visible. The caller cannot see that the document
pane and markdown pane are siblings. The component has to branch between
single-pane and two-pane architectures.

### ParseViewer

`ParseViewer` is currently a thin adapter over `PageMarkdownViewer`.

That makes parse inherit the wrong abstraction. Parse is a workflow result:

```txt
source document + parsed markdown output
```

It should compose two named surfaces, not pass one surface as a render prop.

### PartitionViewer

`PartitionViewer` already has a meaningful header:

- segment legend;
- page ribbon;
- current page;
- scroll progress.

But the source document is still injected through `renderDocument`, so the
viewer owns the header while the caller secretly owns the body. This splits the
composition contract in half.

### ClassifierViewer

`ClassifierViewer` has the same issue in smaller form.

It owns classification state and the legend, but the source document enters as
`renderDocument`. Since classification is a whole-document result, it should be
the simplest proof of the new model.

## New Primitive Boundary

The generic primitives stay unchanged:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
```

Do not add generic primitives for parse, partition, classification, markdown,
or workflow comparison.

Domain viewers add named parts around those primitives.

The provider owns domain state.
The named parts project domain state.
The caller owns visible layout.

## Page Markdown Target

`PageMarkdownViewer` should become the easy API only.

The primitive set should be:

```tsx
<PageMarkdownViewerProvider
  pages={pages}
  text={text}
  isProcessing={isProcessing}
  resetKey={resetKey}
>
  <ViewerRoot>
    <ViewerBody>
      <ViewerSurface>
        <PageMarkdownViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PageMarkdownViewerProvider>
```

Exports:

```ts
PageMarkdownViewerProvider
PageMarkdownViewerContent
PageMarkdownViewerEmptyState
PageMarkdownViewerToolbar
usePageMarkdownViewer
usePageMarkdownViewerContent
usePageMarkdownViewerToolbar
```

`PageMarkdownViewerContent` owns:

- rendered/text mode;
- markdown pages;
- markdown virtualization;
- zoom;
- fit width;
- copy/download controls;
- visible markdown page reporting.

It does not own:

- source document rendering;
- resizable panels;
- parse state;
- partition state;
- classification state.

The easy API becomes:

```tsx
export function PageMarkdownViewer(props: PageMarkdownViewerProps) {
  return (
    <PageMarkdownViewerProvider {...props}>
      <ViewerRoot bare className="h-full flex-1 bg-background">
        <ViewerBody>
          <ViewerSurface>
            <PageMarkdownViewerContent />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </PageMarkdownViewerProvider>
  )
}
```

`PageMarkdownViewerProps` must not include `renderDocument`.

## Parse Target

Parse should expose provider + parts:

```tsx
<ParseViewerProvider result={result} isProcessing={isProcessing}>
  <ViewerRoot>
    <ViewerBody>
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel>
          <ViewerSurface>
            <ParseSourceDocument source={source} />
          </ViewerSurface>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel>
          <ViewerSurface>
            <ParseViewerMarkdown />
          </ViewerSurface>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ViewerBody>
  </ViewerRoot>
</ParseViewerProvider>
```

Exports:

```ts
ParseViewerProvider
ParseViewerDocument
ParseViewerMarkdown
ParseViewer
useParseViewer
useParseViewerDocument
useParseViewerMarkdown
```

The preferred shape is a hook-owned source document component:

```tsx
function ParseSourceDocument({ source }: { source: PdfDocumentSource }) {
  const document = useParseViewerDocument()

  return (
    <PdfViewer
      source={source}
      bare
      onVisiblePageChange={document.onCurrentPageChange}
      onScrollProgressChange={document.onScrollProgressChange}
    />
  )
}
```

`ParseViewerDocument` should exist only if we want a renderless state bridge:

```tsx
<ParseViewerDocument>
  {(document) => (
    <PdfViewer
      source={source}
      bare
      onVisiblePageChange={document.onCurrentPageChange}
      onScrollProgressChange={document.onScrollProgressChange}
    />
  )}
</ParseViewerDocument>
```

This is acceptable because the child is visible in JSX and the component does
not hide layout. The render function only exposes synchronization handlers.

Prefer the hook form in docs. Keep `ParseViewerDocument` only if it adds a real
semantic wrapper or accessibility boundary.

The easy API should be output-only:

```tsx
<ParseViewer result={result} />
```

It renders parsed markdown full-width. It does not accept a hidden source
document.

The composed block owns the two-pane layout.

## Partition Target

Partition should expose:

```tsx
<PartitionViewerProvider result={result} isProcessing={isProcessing}>
  <ViewerRoot>
    <PartitionViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <PartitionSourceDocument source={source} />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PartitionViewerProvider>
```

Exports:

```ts
PartitionViewerProvider
PartitionViewerHeader
PartitionViewerDocumentState
PartitionViewerEmptyState
PartitionViewer
usePartitionViewer
usePartitionViewerHeader
usePartitionViewerDocument
```

`PartitionViewerHeader` owns:

- segment legend;
- page ribbon;
- page count;
- jump-to-page intent.

The provider owns:

- current document page;
- scroll progress;
- interaction state;
- computed segment rows;
- computed legend segments;
- empty/processing state.

The document renderer owns:

- actual document source;
- `PdfViewer`, `ImageViewer`, or any other file viewer;
- wiring visible page and scroll progress to `usePartitionViewerDocument`.

Correct composition:

```tsx
function PartitionSourceDocument({ source }: { source: PdfDocumentSource }) {
  const document = usePartitionViewerDocument()

  return (
    <PdfViewer
      source={source}
      bare
      onVisiblePageChange={document.onCurrentPageChange}
      onScrollProgressChange={document.onScrollProgressChange}
    />
  )
}
```

The easy API may render only the header and an empty document surface:

```tsx
<PartitionViewer result={result} />
```

It must not pretend to be a full document viewer unless it has a real source.

## Classifier Target

Classification is the simplest composed workflow:

```tsx
<ClassifierViewerProvider result={result} isProcessing={isProcessing}>
  <ViewerRoot>
    <ClassifierViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <ClassifierSourceDocument source={source} />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</ClassifierViewerProvider>
```

Exports:

```ts
ClassifierViewerProvider
ClassifierViewerHeader
ClassifierViewerEmptyState
ClassifierViewer
useClassifierViewer
useClassifierViewerHeader
```

`ClassifierViewerHeader` owns:

- selected category;
- color swatch;
- reasoning caption.

It does not own document rendering.

The easy API should be honest:

```tsx
<ClassifierViewer result={result} />
```

When no source document is provided by composition, the surface can show a
minimal "No document available" state. It must not accept `renderDocument`.

## Naming Standard

Use separate named exports, not compound dot exports.

Correct:

```ts
ParseViewerProvider
ParseViewerMarkdown
ParseViewerDocument
useParseViewerMarkdown
```

Wrong:

```ts
ParseViewer.Provider
ParseViewer.Markdown
ParseViewer.Document
```

Use the same names for the same concepts:

```txt
Provider      domain state owner
Header        domain header projection
Content       primary output body
Document      source document bridge
EmptyState    domain empty/processing state
```

Do not introduce aliases:

```txt
Pane
Panel
Frame
Chrome
Rail
Area
Renderer
```

unless the domain proves a distinct concept that cannot be named by the common
vocabulary.

## State Standard

Provider state must be narrow and domain-specific.

Good:

```ts
type ParseViewerContextValue = {
  pages: string[]
  text: string
  currentPage: number
  reportDocumentPage: (page: number) => void
  reportMarkdownPage: (page: number) => void
}
```

Bad:

```ts
type ParseViewerContextValue = {
  slots: ParseViewerSlots
  renderDocument?: (handlers: ParseDocumentHandlers) => ReactNode
  leftPane: ReactNode
  rightPane: ReactNode
}
```

Expose narrow hooks:

```ts
useParseViewerMarkdown()
useParseViewerDocument()
```

Do not force consumers of one part to subscribe to unrelated state.

## Documentation Standard

Docs must teach composition first.

Correct order:

1. provider + named parts;
2. composed source document example;
3. easy API.

Wrong order:

1. easy API;
2. render-prop escape hatch;
3. advanced note explaining hidden layout.

Docs must not mention `renderDocument`.

Affected docs:

- `content/docs/viewers/parse-viewer.mdx`;
- `content/docs/components/partition-viewer.mdx`;
- `content/docs/components/classification-viewer.mdx`;
- page-markdown docs, if present.

## Registry Standard

Blocks should demonstrate composition, not hidden props.

Affected blocks:

- `registry/new-york-v4/blocks/parse-viewer-block.tsx`;
- `registry/new-york-v4/blocks/partition-viewer-block.tsx`;
- classify demo/block if one exists.

The parse block should show the two-pane layout explicitly.

The partition block should show the document surface explicitly.

The classifier block should show the document surface explicitly.

## Implementation Order

### 1. Page Markdown

Create `PageMarkdownViewerProvider` and move current internal state into it.

Split current `PageMarkdownViewer` into:

- provider;
- content;
- toolbar, if not already cleanly isolated;
- empty state;
- easy API.

Delete `renderDocument` from `PageMarkdownViewerProps`.

Delete `PageMarkdownDocumentPane` if it becomes only a render-prop wrapper.

### 2. Parse

Create parse provider and hooks.

Make `ParseViewerMarkdown` compose `PageMarkdownViewerContent`.

Move document synchronization out of `PageMarkdownViewer` and into
`ParseViewerProvider`.

Update parse block to explicit two-pane JSX.

### 3. Partition

Create partition provider and hooks.

Move legend/ribbon derived state into provider.

Make `PartitionViewerHeader` a named part.

Replace `renderDocument` with `usePartitionViewerDocument` in examples and
tests.

### 4. Classification

Create classifier provider and hooks.

Make `ClassifierViewerHeader` a named part.

Remove `renderDocument`.

Update docs and demos.

### 5. Architecture Tests

Add hard tests:

```txt
components/viewers/** must not contain "renderDocument"
registry/new-york-v4/blocks/** must not contain "renderDocument"
content/docs/** must not contain "renderDocument" for viewer docs
```

Add positive tests for:

- `PageMarkdownViewerProvider`;
- `ParseViewerProvider`;
- `PartitionViewerProvider`;
- `ClassifierViewerProvider`;
- narrow hooks;
- docs composition-before-easy-api;
- registry blocks using visible JSX hierarchy.

## Non-Goals

Do not preserve compatibility with `renderDocument`.

Do not add deprecated aliases.

Do not support both old and new APIs.

Do not introduce a universal workflow viewer provider.

Do not make `PageMarkdownViewer` know about parse, partition, classification,
or source documents.

Do not make source acquisition part of the viewer domain.

## Acceptance Criteria

The migration is done when this command finds nothing in runtime, registry, and
viewer docs:

```bash
rg -n "renderDocument" components/viewers registry/new-york-v4 content/docs \
  --glob '!retab_react/**'
```

The only acceptable remaining matches are historical design documents and test
assertions that forbid the term.

The composed parse example should read like this:

```tsx
<ParseViewerProvider result={result}>
  <ViewerRoot>
    <ViewerBody>
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel>
          <ViewerSurface>
            <ParseSourceDocument source={source} />
          </ViewerSurface>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel>
          <ViewerSurface>
            <ParseViewerMarkdown />
          </ViewerSurface>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ViewerBody>
  </ViewerRoot>
</ParseViewerProvider>
```

The composed partition example should read like this:

```tsx
<PartitionViewerProvider result={result}>
  <ViewerRoot>
    <PartitionViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <PartitionSourceDocument source={source} />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PartitionViewerProvider>
```

The composed classifier example should read like this:

```tsx
<ClassifierViewerProvider result={result}>
  <ViewerRoot>
    <ClassifierViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <ClassifierSourceDocument source={source} />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</ClassifierViewerProvider>
```

A reader should be able to answer these questions from JSX alone:

- where is the header?
- where is the source document?
- where is the output?
- what owns domain state?
- what owns layout?

If any answer requires opening a render prop implementation, the migration is
not complete.
