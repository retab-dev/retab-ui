# Viewer System Terminal Platonic Last Mile Blueprint

## Standard

This is the standard for the viewer system:

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

The system is close. It has the right center now:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The final step is not another provider, not another viewer abstraction, and not
more genericity. The final step is subtraction: remove accidental public seams
that exist only because first-party anatomy is split across files.

## Verdict

We have reached a good design.

We have not reached the platonic ideal.

The conceptual model is right:

- `ViewerRoot` owns viewer layout and sidebar state.
- `ViewerHeader`, `ViewerBody`, `ViewerSidebar`, and `ViewerSurface` are the
  shared grammar.
- `FileViewer` renders one resolved source.
- `PdfViewer` is a composed PDF experience with optional named parts.
- `SegmentedDocumentProvider` owns semantic document segments and anchors.
- split, partition, sources, OCR, edit, and layout viewers adapt domain data into
  the shared primitives instead of inventing private interaction engines.

The remaining imperfection is public-surface impurity:

```txt
some private first-party selectors are still exported because component anatomy
is split across modules
```

That is acceptable engineering. It is not perfect.

## Non-Goals

Do not touch file-system source. File-system is a separate responsibility.

Do not add:

- a new shell;
- a new generic viewer;
- a new provider layer;
- slot object APIs;
- render-prop APIs;
- compatibility aliases;
- internal barrel files;
- legacy adapter paths;
- alternate names for the same concept.

No compatibility shim is acceptable in this pass. The hard cut is the point.

## Current Good Shape

The following concepts are now correctly absent or contained:

- no `ViewerShell` in shipped viewer source;
- no generic `<SegmentedViewer>`;
- no `renderDocument` viewer API;
- no viewer slot object API;
- no shipped `anchored-evidence`;
- no shipped `anchored-document-viewer`;
- no shipped `pdf-anchor-target`;
- no exported raw `PdfViewerContext`;
- no exported raw `EditViewerContext`;
- no broad public `useXViewer()` hooks for composed viewers.

Keep that direction.

## Current Remaining Gaps

### Gap 1: PDF Has Accidental First-Party Seams

Current state is partially repaired:

```txt
registry/new-york-v4/ui/pdf-viewer-context.tsx
  owns PdfViewerContext privately
  exports PdfViewerProvider
  exports PdfViewerHeader
  exports PdfViewerPages
  exports usePdfViewerThumbnails

registry/new-york-v4/ui/pdf-viewer-content.tsx
  owns resource/page rendering
  stays mostly pure

registry/new-york-v4/ui/pdf-viewer.tsx
  exposes the public easy API and named PDF parts

components/ui/pdf-viewer.tsx
  is now a pure re-export
```

That is the right direction.

The target public surface is:

```ts
PdfViewer
PdfViewerProvider
PdfViewerHeader
PdfViewerPages
PdfResourceContent
PdfHighlight
PdfViewerThumbnails
PdfThumbnailRail
usePdfViewerThumbnails
```

The following must not be exported:

```ts
PdfViewerContext
PdfViewerHeaderState
PdfViewerPagesState
PdfViewerHeaderControlSetter
usePdfViewerHeaderState
usePdfViewerPagesState
usePdfViewerHeaderControlSetter
```

The current repair should be completed by making sure:

- first-party header/pages selectors are private functions only;
- no generated registry JSON exposes the old selector names;
- `registry.json` includes `pdf-viewer-content.tsx` as a real source file;
- tests assert the public PDF export surface instead of fossilizing private
  helper names.

### Gap 2: Edit Still Exports Private Frame/Chrome Selectors

Current edit provider has the correct raw-context boundary:

```ts
const EditViewerContext = React.createContext<EditViewerContextValue | null>(
  null
)
```

But it still exports selectors whose only consumers are first-party edit anatomy:

```ts
useEditViewerFrameState
useEditViewerChromeState
EditViewerChromeState
```

Those names describe implementation plumbing:

- frame state exists because `EditViewerRoot`, busy state, and empty state are
  separated from the provider;
- chrome state exists because `EditViewerHeader` is separated from the provider.

They are not real public concepts.

The legitimate public edit hooks are:

```ts
useEditViewerDocument
useEditViewerFields
```

Those are durable seams because external code can compose:

- the document pane;
- field list;
- selection;
- overlays;
- sidebar layout.

The target public surface is:

```ts
EditViewer
EditViewerProvider
EditViewerHeader
EditViewerDocument
EditViewerFields
EditViewerToolbar
useEditViewerDocument
useEditViewerFields
```

The following must disappear from public exports:

```ts
EditViewerContext
EditViewerContextValue
EditViewerChromeState
useEditViewerFrameState
useEditViewerChromeState
```

### Gap 3: Tests Still Protect Some Implementation Details

Architecture tests should ratchet concepts, not private helper names.

Good assertions:

```ts
expect(content).not.toContain("ViewerShell")
expect(content).not.toContain("anchored-evidence")
expect(content).not.toContain("export const PdfViewerContext")
expect(publicExports).not.toContain("useEditViewerChromeState")
```

Suspicious assertions:

```ts
expect(content).toContain("function useEditViewerContext")
expect(content).toContain("function usePdfViewerPagesState")
expect(content).toContain("ViewerRoot")
```

Private helper names are allowed to change. Public concepts are not.

The tests should prove:

- removed concepts stay removed;
- raw context values stay private;
- public hooks are narrow;
- composed viewers use the shared viewer grammar;
- registry output does not ship deleted artifacts;
- generated JSON is in sync with source.

They should not require a private helper to keep a particular name.

### Gap 4: Source-of-Truth Must Be Unambiguous

Viewer files live across:

```txt
registry/new-york-v4/ui/*
components/ui/*
public/r/*
```

Every file must be exactly one of:

```txt
source file
thin re-export
generated artifact
```

No mixed category is allowed.

Acceptable component wrapper:

```ts
export * from "@/registry/new-york-v4/ui/pdf-viewer"
```

Unacceptable wrapper:

```ts
export * from "@/registry/new-york-v4/ui/pdf-viewer"
export function ExtraCompatibilityName() {}
```

If a file contains implementation, it is source. If it exists only to expose a
registry component locally, the whole file should be one re-export.

## Correct Final Shape

### Viewer Primitive

The viewer primitive is the layout and sidebar primitive.

It should export:

```ts
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
ViewerSidebarTrigger
useViewerSidebar
useOptionalViewerSidebar
```

It should not know about:

- files;
- PDF;
- email;
- edit;
- split;
- partition;
- OCR;
- sources;
- MIME;
- extraction;
- upload.

`ViewerRoot` can own sidebar provider state because sidebar state is part of the
viewer layout primitive. That matches the shadcn sidebar lesson: the root can
provide local state, and trigger/sidebar parts can consume it.

### File Viewer

`FileViewer` renders one source.

It can be complete by default:

```tsx
<FileViewer source={source} />
```

It can also be nested/bare when a domain viewer owns the outer chrome:

```tsx
<FileViewer source={source} bare className="h-full" />
```

It must not become a file-system, upload, email, split, or extraction viewer.

### PDF Viewer

PDF has one provider and named anatomy:

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot>
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

The public optional seam is thumbnails:

```ts
usePdfViewerThumbnails
```

The private seams are header/page controls.

PDF perfection means a user never learns:

```ts
usePdfViewerHeaderState
usePdfViewerPagesState
usePdfViewerHeaderControlSetter
```

### Edit Viewer

Edit has one provider and named public composition points:

```tsx
<EditViewerProvider result={result} sourceDocument={source}>
  <ViewerRoot>
    <EditViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <EditViewerDocument />
      </ViewerSurface>
      <ViewerSidebar side="right">
        <EditViewerFields />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EditViewerProvider>
```

The public seams are:

```ts
useEditViewerDocument
useEditViewerFields
```

The private seams are:

```ts
frame
chrome
busy
empty
```

Those can exist as private helpers or pure props. They cannot be exported.

### Segmented Document

`SegmentedDocumentProvider` is not a viewer. It is a document annotation and
navigation engine.

It should own:

```txt
model
currentPage
scrollProgress
active segment
hovered segment
document handle
scrollToPage
scrollToSegmentStart
scrollToAnchor
```

Its model should preserve the distinction between semantic segments and
page-local anchors:

```ts
type SegmentedDocumentModel = {
  pages?: SegmentedPage[]
  segments: DocumentSegment[]
  anchors?: SegmentAnchor[]
  rows?: SegmentRow[]
}

type DocumentSegment = {
  id: string
  label: string
  color: string
  pages: number[]
  sourceId?: string
}

type SegmentAnchor = {
  id: string
  segmentId: string
  pageNumber: number
  bounds?: SegmentBounds
}
```

This keeps split/partition semantic and sources/OCR page-local.

## Implementation Blueprint

### Step 1: Freeze the Public Export Contract

Add or update architecture tests that inspect public exports for:

- `registry/new-york-v4/ui/pdf-viewer.tsx`;
- `registry/new-york-v4/ui/pdf-viewer-context.tsx`;
- `components/viewers/edit/edit-viewer.tsx`;
- `components/viewers/edit/edit-viewer-provider.tsx`.

The tests should fail if these names are exported:

```txt
PdfViewerContext
PdfViewerHeaderState
PdfViewerPagesState
PdfViewerHeaderControlSetter
usePdfViewerHeaderState
usePdfViewerPagesState
usePdfViewerHeaderControlSetter
EditViewerContext
EditViewerContextValue
EditViewerChromeState
useEditViewerFrameState
useEditViewerChromeState
```

### Step 2: Complete PDF Subtraction

Make `pdf-viewer-context.tsx` the private state owner and public anatomy owner.

Keep private:

```ts
function usePdfViewerContext()
function usePdfViewerHeaderState()
function usePdfViewerPagesState()
```

Export only:

```ts
PdfViewerProvider
PdfViewerHeader
PdfViewerPages
usePdfViewerThumbnails
type PdfDocumentSource
type PdfViewerHeaderControls
type PdfViewerThumbnailsState
```

`PdfViewerHeaderControls` is acceptable because `PdfResourceContent` needs a
typed bridge to report toolbar controls. If that type can be moved to a neutral
PDF types file without creating a worse cycle, do that. Do not create a new
`internal` file only for taste.

Update `registry.json` so `pdf-viewer-content.tsx` is included in the registry
item.

Rebuild generated registry output.

### Step 3: Remove Edit Frame/Chrome Exports

Use the smallest cut that removes the public leak.

Preferred shape:

```txt
edit-viewer-provider.tsx
  private context
  private frame/chrome selectors
  public provider
  public document/fields hooks
  public first-party anatomy that needs private state

edit-viewer.tsx
  easy component and public re-exports

edit-viewer-document.tsx
edit-viewer-fields.tsx
edit-viewer-toolbar.tsx
  focused UI parts
```

Acceptable alternative:

```txt
provider reads private context
separate view files receive pure props
```

Do not export:

```ts
useEditViewerFrameState
useEditViewerChromeState
EditViewerChromeState
```

If `EditViewerHeader` remains in its own file, it must either:

- be a pure view component receiving props; or
- be moved to the module that owns the private context.

It must not import a public private-selector hook.

### Step 4: Clean Architecture Tests

Replace private-helper assertions with public-boundary assertions.

Keep tests for:

- no removed concepts in source or generated registry output;
- no raw context exports except explicit primitive exceptions;
- no broad composed-viewer hooks;
- no old selector exports;
- public APIs still render.

Allow tests to mention forbidden names only as negative assertions.

### Step 5: Rebuild Generated Output

Run:

```bash
pnpm registry:build
```

Expected generated changes:

- `public/r/pdf-viewer.json` includes `pdf-viewer-content.tsx`;
- no generated JSON includes removed anchored/PDF anchor artifacts;
- no generated JSON includes old PDF/Edit first-party selector exports.

Do not manually edit generated `public/r/*` files.

### Step 6: Verify Type and Behavior

Run:

```bash
pnpm exec tsc --noEmit --pretty false
pnpm exec vitest run tests/viewer-architecture.test.ts --reporter=dot
pnpm exec vitest run tests/pdf-viewer.test.tsx tests/edit-viewer-model.test.ts tests/edit-viewer-render.test.tsx --reporter=dot
pnpm exec vitest run tests/page-markdown-render.test.tsx tests/parse-viewer.test.tsx tests/parse-viewer-adapter.test.tsx --reporter=dot
pnpm exec vitest run tests/sources.test.tsx tests/layout-blocks-document-ai.test.ts --reporter=dot
```

Then run:

```bash
rg -n "export const .*Context|export type .*ContextValue|export interface .*ContextValue" \
  components/viewers registry/new-york-v4/ui registry/new-york-v4/blocks components/ui

rg -n "usePdfViewerHeaderState|usePdfViewerPagesState|usePdfViewerHeaderControlSetter|useEditViewerFrameState|useEditViewerChromeState" \
  components registry/new-york-v4 public/r tests

rg -n "ViewerShell|SegmentedViewer|renderDocument|slots\\?:|slots=\\{|anchored-evidence|AnchoredDocumentProvider|anchored-document-viewer|pdf-anchor-target|anchoredItems" \
  components registry/new-york-v4 public/r content/docs tests
```

Allowed raw-context exceptions:

- `registry/new-york-v4/ui/viewer.tsx`, for the viewer/sidebar primitive;
- `registry/new-york-v4/ui/sidebar.tsx`, for the shadcn sidebar primitive;
- file-system files, because file-system is explicitly out of scope.

Forbidden selector names may appear in tests only as negative assertions.

## Acceptance Criteria

The implementation is complete only when all of these are true:

- `components/ui/pdf-viewer.tsx` is a pure re-export.
- `components/ui/pdf-viewer-content.tsx` is a pure re-export.
- `registry/new-york-v4/ui/pdf-viewer.tsx` exports only public PDF concepts.
- `registry/new-york-v4/ui/pdf-viewer-context.tsx` does not export first-party
  header/page selector hooks.
- `components/viewers/edit/edit-viewer-provider.tsx` does not export frame/chrome
  selector hooks.
- `components/viewers/edit/edit-viewer.tsx` does not import private exported
  edit selectors.
- `EditViewerHeader` does not import a public private-selector hook.
- registry output is regenerated.
- targeted TypeScript and Vitest checks pass.
- source search has no removed concepts outside negative tests and explicit
  primitive/file-system exceptions.

## Final Taste Test

The viewer system is platonic when these sentences are true:

```txt
A user learns ViewerRoot to compose chrome.
A user learns ViewerSidebarTrigger to toggle a sidebar.
A user learns FileViewer to render a file.
A user learns PdfViewer parts to compose PDF.
A user learns SegmentedDocumentProvider to synchronize document annotations.
A user never learns raw context.
A user never learns first-party selector hooks.
A maintainer never has to explain why "chrome state" or "header state" is exported.
```

The final design should feel almost disappointingly obvious.

If an exported name exists only because two first-party files needed to talk,
that name is not part of the platonic system.
