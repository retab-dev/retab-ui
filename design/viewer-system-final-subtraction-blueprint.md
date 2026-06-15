# Viewer System Final Subtraction Blueprint

## Purpose

This is the current blueprint for the last viewer-system cut after the recent
anchored-provider removal and segmented-document convergence.

The standard is still:

```txt
Simplicity
Speed
Everything needed
Nothing more
Perfect modularization
High-entropy code
Perfectly consistent names
Flaubertian precision
shadcn-grade taste
```

The important point: the system does not need another abstraction. It needs the
last bad concepts removed.

## Current Verdict

The viewer system is good.

The center is correct:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The direction is also correct:

- `ViewerRoot` owns spatial chrome and sidebar state.
- `ViewerSidebarTrigger` targets the nearest `ViewerRoot`.
- `FileViewer` is a file leaf renderer, not the layout center.
- `EmailViewer`, `SplitViewer`, `PartitionViewer`, `EditViewer`, `ParseViewer`,
  `PageMarkdownViewer`, PDF thumbnails, and dropzone now mostly read as named
  compositions.
- Split, partition, sources, OCR/layout blocks, and edit converge on
  segmented-document mechanics instead of a generic mega-viewer.
- The old anchored document interaction engine is gone from shipped viewer code.

But it is not platonic yet.

The remaining work is subtraction:

1. stop exporting raw context objects;
2. remove stale anchored vocabulary;
3. compress one wide private state bag;
4. make the architecture tests ratchet those exact absences.

## Non-Goals

Do not touch file-system.

Do not add:

- `ViewerShell`;
- `SegmentedViewer`;
- slot objects;
- render-prop viewer APIs;
- compatibility shims;
- broad public hooks;
- another provider for the same document interaction mechanics.

Do not solve taste problems by adding indirection.

## 1. Hide Raw Context Objects

### Problem

The broad full-context hooks are gone, but two raw context objects are still
exported:

```ts
export const PdfViewerContext = React.createContext(...)
export const EditViewerContext = React.createContext(...)
```

That is not the same smell as `usePdfViewer()` or `useEditViewer()`, but it is
still a leak. A consumer can import the context and bind directly to aggregate
provider state.

The current tests forbid exported full context value types and broad hooks, but
they do not forbid exported `React.Context` objects. That means the system can
still leak provider internals while passing the architectural ratchet.

### Target

No composed viewer exports a raw React context object.

Allowed public exports:

```ts
PdfViewerProvider
PdfViewerHeader
PdfViewerPages
PdfViewerThumbnails
usePdfViewerThumbnails

EditViewerProvider
EditViewerHeader
EditViewerDocument
EditViewerFields
useEditViewerDocument
useEditViewerFields
```

Forbidden public exports:

```ts
PdfViewerContext
EditViewerContext
XViewerContext
XViewerContextValue
useXViewer()
useXViewerHeader()
useXViewerBusy()
useXViewerEmpty()
```

### PDF Plan

`PdfViewerContext` currently exists so:

- `PdfViewerHeader` can read toolbar/header state;
- `PdfViewerPages` can register the document handle and current page;
- `PdfViewerThumbnails` can read current page, resource, and page navigation.

Keep the provider. Remove the raw context export.

The acceptable shape is:

```ts
const PdfViewerContext = React.createContext<PdfViewerContextValue | null>(null)

export function PdfViewerProvider(...)
export function usePdfViewerThumbnails(): PdfViewerThumbnailsState
```

For cross-file internals, prefer one of these hard-cut options:

1. Move first-party PDF parts that need the context into the same module as the
   private context.
2. Export only narrow selectors required by sibling modules, but do not re-export
   those selectors from `pdf-viewer.tsx`.

Option 1 is purer. Option 2 is acceptable only if registry file splitting makes
option 1 materially worse.

Either way:

```ts
export const PdfViewerContext
```

must disappear.

### Edit Plan

`EditViewerContext` exists so root/header/busy/empty/fields/document parts can
share provider state.

The final shape should make the raw context private:

```ts
const EditViewerContext = React.createContext<EditViewerContextValue | null>(null)
```

Then use one of two shapes:

1. Co-locate first-party parts that need private selectors in the same module as
   the context.
2. Pass narrow state into pure view components and keep context reads in one
   private owner.

The best direction is:

```txt
edit-viewer-provider.tsx
  owns context
  exports provider
  exports narrow public hooks needed by external composition

edit-viewer.tsx
  composes public anatomy
  does not import raw context

edit-viewer-header.tsx
  either becomes pure props UI
  or moves into the provider/context module
```

The public API should not teach that `EditViewerContext` exists.

### Tests

Add a viewer architecture test that scans composed viewer files, excluding the
generic shadcn-style primitives, and fails on:

```txt
export const .*Context
export type .*ContextValue
export interface .*ContextValue
export function use.*Viewer(): .*ContextValue
```

Allowed exceptions must be explicit and small:

- `ViewerSidebarContextValue`, because `useViewerSidebar()` is the shadcn-style
  public sidebar control hook.
- shadcn base primitives such as `sidebar.tsx` and `form.tsx`.
- file-system, because this blueprint does not own that boundary.

## 2. Rename Anchored Evidence

### Problem

The old anchored interaction engine is removed, but the registry still ships:

```txt
anchored-evidence
registry/new-york-v4/ui/anchored-evidence.ts
```

The file is pure data now. That is good. The name is not.

Current imports:

```ts
source-evidence.ts -> anchored-evidence
layout-blocks-model.ts -> anchored-evidence
```

This preserves the wrong concept after the concept has been deleted.

### Target

Rename the module and registry item to document evidence:

```txt
registry/new-york-v4/ui/document-evidence.ts
registry item: document-evidence
public/r/document-evidence.json
```

The type names can stay precise:

```ts
type AnchorResolution =
  | { status: "resolved"; anchor: DocumentAnchor }
  | { status: "missing" }
  | { status: "invalid"; reason: string }

type EvidenceAnchor = {
  id: string
  anchor: AnchorResolution
}

type EvidenceItem<Payload> = EvidenceAnchor & {
  payload: Payload
}
```

The concept is not "anchored-document interaction." It is "evidence optionally
resolved to a document anchor."

### Required Changes

- Rename `anchored-evidence.ts` to `document-evidence.ts`.
- Update imports in source evidence and layout blocks.
- Update `registry.json`.
- Rebuild `public/r`.
- Delete `public/r/anchored-evidence.json`.
- Add architecture tests forbidding `anchored-evidence` outside historical
  blueprint files.

### Naming Rule

Use `anchor` when referring to a location in a document.

Do not use `anchored` to describe provider state, viewer state, evidence models,
or registry item names.

## 3. Compress Page Markdown Context

### Problem

`PageMarkdownViewerContextValue` is private, but it is still wide. It contains:

- document sync;
- header state;
- content state;
- mode;
- scale;
- processing state;
- refs;
- callbacks;
- source text and pages.

This is not a public API leak, but it is not high-entropy code. The reader has to
parse a bag before seeing the shape of the viewer.

### Target

Make the context read like the composition:

```ts
type PageMarkdownViewerContextValue = {
  header: PageMarkdownViewerHeaderState
  content: PageMarkdownViewerContentState
  document: PageMarkdownDocumentState
}
```

Then selectors become trivial:

```ts
function usePageMarkdownViewerHeader() {
  return usePageMarkdownViewerContext().header
}

function usePageMarkdownViewerContent() {
  return usePageMarkdownViewerContext().content
}

export function usePageMarkdownViewerDocument() {
  return usePageMarkdownViewerContext().document
}
```

This is not about adding abstraction. It is about making the state shape match
the rendered anatomy:

```tsx
<PageMarkdownViewerHeader />
<PageMarkdownViewerContent />
```

### Constraints

- Do not introduce a second provider.
- Do not expose `usePageMarkdownViewer()`.
- Do not move page markdown onto segmented-document; it is a two-pane markdown
  sync problem, not a segment problem.
- Keep `ParseViewer` as a thin adapter over page markdown.

## 4. Tighten Architecture Tests

### Problem

The architecture tests are valuable, but several assertions currently encode
incidental implementation strings:

```ts
expect(source).toContain("function usePageMarkdownViewerHeader")
expect(source).toContain("<ParseViewerHeader /> <ViewerBody>")
expect(source).toContain("function useEditViewerContext")
```

Those tests protect useful direction, but they can also fossilize local names.

### Target

The tests should mostly ratchet concepts:

```txt
no exported raw viewer contexts
no broad full-context hooks
no internal-context files
no anchored-document provider
no anchored-evidence registry item
no ViewerShell
no slot/renderDocument viewer APIs
no domain imports into ViewerRoot
no generic SegmentedViewer
```

Keep a few positive assertions where the public contract matters:

```txt
ViewerRoot exports ViewerHeader, ViewerBody, ViewerSidebar, ViewerSurface
ViewerSidebarTrigger exists
FileViewer exports FileViewerProvider, FileViewerHeader, FileViewerContent
SegmentedDocumentProvider exports narrow model and viewport hooks
Split and partition export document controls hooks
PDF thumbnails export PdfViewerThumbnails and PdfThumbnailRail
```

### Rule

Tests should fail when a bad concept returns. They should not require a private
helper to keep the same name forever.

## 5. Public API Shape After The Cut

The final public grammar should look like this.

### Generic Viewer

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

Public control:

```ts
useViewerSidebar()
useOptionalViewerSidebar()
```

This is acceptable because the sidebar trigger/state behavior is the primitive,
like shadcn sidebar.

### File Viewer

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

Public convenience:

```tsx
<FileViewer source={source} />
<FileViewer source={source} bare />
```

No public `useFileViewer()`.

### PDF Thumbnails

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot defaultOpen>
    <PdfViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <PdfViewerThumbnails />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerPages />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

Public hook:

```ts
usePdfViewerThumbnails()
```

No public `PdfViewerContext`.

### Split

```tsx
<SplitViewerProvider result={result}>
  <ViewerRoot defaultOpen>
    <SplitViewerHeader />
    <ViewerBody>
      <SplitViewerSidebar />
      <ViewerSurface>
        <SplitViewerLegend />
        <SplitViewerDocument document={document} />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

Public hook:

```ts
useSplitViewerDocumentControls()
```

No public `useSplitViewer()`.

### Partition

```tsx
<PartitionViewerProvider result={result}>
  <ViewerRoot>
    <PartitionViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <PartitionViewerRibbon />
        <PartitionViewerDocument document={document} />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PartitionViewerProvider>
```

Public hook:

```ts
usePartitionViewerDocumentControls()
```

No public `usePartitionViewer()`.

### Segmented Document

```tsx
<SegmentedDocumentProvider model={model}>
  {children}
</SegmentedDocumentProvider>
```

Public hooks:

```ts
useSegmentedDocumentModel()
useSegmentedDocumentViewport()
useSegmentedItemLink()
useSegmentedSourceFieldLink()
```

This provider is not a viewer. It is the shared document interaction engine.

## 6. Implementation Order

1. Add architecture tests for raw context exports and stale anchored vocabulary.
2. Hide `PdfViewerContext`.
3. Hide `EditViewerContext`.
4. Rename `anchored-evidence` to `document-evidence`.
5. Compress `PageMarkdownViewerContextValue`.
6. Rebuild registry output.
7. Update docs and blueprints that still describe anchored evidence as current
   architecture.

## 7. Verification

Run:

```bash
pnpm exec tsc --noEmit --pretty false
pnpm exec vitest run tests/viewer-architecture.test.ts --reporter=dot
pnpm exec vitest run tests/pdf-viewer.test.tsx tests/edit-viewer-model.test.ts tests/edit-viewer-render.test.tsx --reporter=dot
pnpm exec vitest run tests/page-markdown-render.test.tsx tests/parse-viewer.test.tsx tests/parse-viewer-adapter.test.tsx --reporter=dot
pnpm exec vitest run tests/sources.test.tsx tests/layout-blocks-document-ai.test.ts --reporter=dot
```

Run targeted searches:

```bash
rg -n "export const .*Context|export type .*ContextValue|export interface .*ContextValue" \
  components/viewers registry/new-york-v4/ui registry/new-york-v4/blocks

rg -n "anchored-evidence|AnchoredDocumentProvider|anchored-document-viewer|pdf-anchor-target|anchoredItems" \
  components registry/new-york-v4 public/r content/docs tests

rg -n "ViewerShell|renderDocument|slots\\?:|slots=\\{" \
  components registry/new-york-v4 public/r tests
```

Expected result:

- no exported raw viewer contexts;
- no shipped `anchored-evidence`;
- no anchored document provider;
- no internal-context files;
- no broad full-context hooks;
- no shell/slot/renderDocument viewer API.

## Final Taste Test

The system reaches the next plateau when the answer to these questions is boring:

```txt
Where is the header?      ViewerHeader.
Where is the sidebar?     ViewerSidebar.
Who toggles it?           ViewerSidebarTrigger.
Who renders a file?       FileViewer.
Who renders PDF pages?    PdfViewerPages.
Who renders thumbnails?   PdfViewerThumbnails.
Who owns document links?  SegmentedDocumentProvider.
Who owns domain meaning?  The composed viewer model.
```

If a reader has to learn a raw context object, an internal context file, an
anchored compatibility concept, or a generic shell to understand the system, the
system is not platonic.

