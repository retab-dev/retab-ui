# Viewer System Current Platonic Gap Blueprint

## Purpose

This blueprint records the current state of the viewer system against the
platonic ideal:

```txt
Simplicity
Speed
Everything needed
Nothing more
Perfect modularization
High-entropy code
Perfectly consistent variable names
Flaubertian precision
shadcn-grade taste
```

The answer is still:

```txt
good direction
not perfection
```

The core concepts are now right. The remaining distance is not a new abstraction.
It is a small set of naming, boundary, registry, and test-contract cuts that make
the implementation feel inevitable instead of repaired.

## Non-Goals

Do not touch file-system source.

Do not add:

- a new generic viewer shell;
- a second file viewer primitive;
- a generic `SegmentedViewer`;
- a slot object API;
- render props for first-party anatomy;
- compatibility aliases;
- public internal hooks;
- a new provider just to move state sideways.

This pass should subtract ambiguity, not add expressivity.

## Verdict

The system has reached the right architectural center:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

That grammar is the center.

`FileViewer` remains the leaf renderer for one resolved source.

`PdfViewer`, `EmailViewer`, `SplitViewer`, `PartitionViewer`, `EditViewer`,
`ParseViewer`, and `PageMarkdownViewer` should be domain compositions that use
the shared grammar instead of inventing their own chrome.

`SegmentedDocumentProvider` is the right center for document annotations,
segments, anchors, current page, hover, selection, and navigation. It is not a
viewer. It is the state and navigation engine for segmented documents.

The remaining imperfections are concrete:

- edit is mid-cutover;
- PDF still speaks in header-control transport names;
- registry output is stale against the source;
- architecture tests still preserve private implementation names in places;
- a few internal names are clever instead of exact.

## Current Good Shape

The following decisions should stay:

- `ViewerRoot` owns viewer layout and sidebar state.
- `ViewerSidebarTrigger` is available anywhere under `ViewerRoot`.
- `FileViewer` renders a file source and should not own file-system state.
- file-system composes viewer, not the reverse.
- `PdfViewer` has named parts for provider, header, pages, and thumbnails.
- `EditViewer` is moving toward provider plus anatomy plus pure views.
- raw context values are not public entrypoint exports.
- broad public `useXViewer()` hooks are no longer the direction.
- first-party composed viewers use narrow hooks only when external composition
  truly needs them.

That is shadcn-compatible: components are composable, source is readable, and the
easy API remains easy.

## Current Bad Shape

### 1. Edit Is Mid-Cutover

The source currently contains the right new files:

```txt
components/viewers/edit/edit-viewer-store.tsx
components/viewers/edit/edit-viewer-provider.tsx
components/viewers/edit/edit-viewer-anatomy.tsx
```

This is the right split:

```txt
store     -> private context carrier and state types
provider  -> model normalization, segmented document bridge, selection bridge
anatomy   -> context-bound public parts and easy composition
views     -> pure presentational components
entry     -> public exports only
```

But the cutover is incomplete:

```txt
components/viewers/edit/edit-viewer.tsx
  still exports EditViewer, EditViewerHeader, EditViewerDocument, and
  EditViewerFields from edit-viewer-provider.tsx

components/viewers/edit/edit-viewer-provider.tsx
  no longer exports those anatomy components
```

That means the public entrypoint is stale against the implementation.

The platonic fix is not to put anatomy back into the provider. The fix is to
finish the split:

```ts
export {
  EditViewer,
  EditViewerDocument,
  EditViewerFields,
  EditViewerHeader,
} from "./edit-viewer-anatomy"

export {
  EditViewerProvider,
  useEditViewerDocument,
  useEditViewerFields,
} from "./edit-viewer-provider"
```

The public entrypoint should be a boring map.

### 2. Edit Store Is Correct Internally, But Must Stay Non-Public

`edit-viewer-store.tsx` exports:

```ts
EditStoreProvider
useEditStore
EditStore
```

That is acceptable as same-folder implementation plumbing. It is not acceptable
as the public API.

The invariant is:

```txt
edit-viewer.tsx must not export EditStore, EditStoreProvider, or useEditStore
docs must not teach EditStore imports
registry examples must not teach EditStore imports
architecture tests must forbid public entrypoint export of EditStore
```

The source module can exist because shadcn-style code is copied and readable.
But the taught API must remain narrow:

```ts
useEditViewerDocument()
useEditViewerFields()
```

No broad `useEditViewer()` hook. No context value type.

### 3. Edit Anatomy Has One Clever Type

`edit-viewer-anatomy.tsx` currently derives toolbar state fields with:

```ts
ReturnType<typeof useEditStore>["mode"]["mode"]
```

That works, but it is not Flaubertian. It makes the reader execute TypeScript in
their head for a concept that already has a name.

Prefer:

```ts
import type { EditViewerMode, EditViewerStatus } from "./edit-viewer-types"

type EditToolbarState = {
  hasFieldPanel: boolean
  mode: EditViewerMode | null
  modes: readonly EditViewerMode[]
  setMode: (mode: EditViewerMode) => void
  status: Exclude<EditViewerStatus, { state: "idle" }> | null
}
```

The rule:

```txt
types should name domain concepts, not extraction paths
```

### 4. PDF Still Names The Bridge After The Header

PDF currently uses:

```ts
PdfViewerHeaderControls
headerControls
setHeaderControls
PdfHeaderViewState
PdfPagesViewState
```

This works, but the vocabulary is wrong.

The controls are not header-owned. They describe the current PDF document
viewport:

```txt
current page
page count
scale
zoom actions
fit action
rotation action
download action
```

The durable concept is:

```ts
type PdfDocumentViewportControls = {
  currentPage: number
  downloadAction: ViewerResource["originalDownload"]
  onFitWidth: () => void
  onRotate: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  pageCount: number
  scale: number
}
```

The variable names should follow:

```txt
viewportControls
setViewportControls
onViewportControlsChange
```

The public prop on `PdfResourceContent` should not be `setHeaderControls`,
because `PdfResourceContent` is exported as a useful lower-level PDF part.

Use:

```ts
onViewportControlsChange?: (
  controls: PdfDocumentViewportControls | null
) => void
```

That reads like a public escape hatch instead of a private setter.

### 5. PDF Has A Conceptual Type Import Cycle

`pdf-viewer-context.tsx` imports `PdfResourceContent` from
`pdf-viewer-content.tsx`.

`pdf-viewer-content.tsx` imports `PdfViewerHeaderControls` from
`pdf-viewer-context.tsx`.

The import is type-only, so it may compile. It is still the wrong topology.

The shared viewport controls type should live in a neutral place:

```txt
pdf-viewer-types.ts
```

Then both modules can import the same domain type without depending on each
other's implementation file.

Preferred shape:

```txt
pdf-viewer-types.ts
  PdfViewerHandle
  PageOverlayProps
  PdfDocumentViewportControls

pdf-viewer-content.tsx
  produces PdfDocumentViewportControls
  calls onViewportControlsChange

pdf-viewer-context.tsx
  stores viewportControls
  renders PdfViewerHeader from viewportControls
```

No module should import a transport type from the module that consumes it.

### 6. Registry Output Is Stale

The source contains new edit files, but generated registry JSON still embeds the
old provider-heavy implementation.

That means the source and distributed shadcn artifact disagree.

The cutover is not done until:

```txt
registry.json includes edit-viewer-store.tsx
registry.json includes edit-viewer-anatomy.tsx
public/r/edit-viewer-block.json includes the new split
public/r/pdf-viewer.json includes the viewport-control rename
public/r/registry.json is regenerated
```

The verification command is:

```bash
pnpm registry:build
```

The registry is part of the component library. A design is not real until the
registry teaches it.

### 7. Architecture Tests Still Preserve Private Names

`tests/viewer-architecture.test.ts` still contains expectations around old
private details:

```txt
function useEditViewerContext
EditViewerContextValue
PdfViewerHeaderControlSetter
usePdfViewerHeaderControlSetter
```

Some of those are forbidden-name assertions, which is good.

Some assertions require a private helper to keep a particular name, which is bad.

The test should ratchet concepts:

```txt
public entrypoint exports
registry files present
forbidden public names absent
raw context exports absent
easy API still composes ViewerRoot/ViewerBody/ViewerSidebar/ViewerSurface
pure view files do not import provider hooks
docs do not teach private imports
```

It should not require:

```txt
function useEditViewerContext
function usePdfHeaderViewState
function usePdfPagesViewState
```

Private helpers are allowed to change names if the public contract and system
shape remain correct.

## The Final Shape

### Edit

The final source shape should be:

```txt
components/viewers/edit/edit-viewer.tsx
  public exports only

components/viewers/edit/edit-viewer-provider.tsx
  EditViewerProvider
  useEditViewerDocument
  useEditViewerFields
  mode state
  selection bridge
  page overlay bridge
  segmented document bridge

components/viewers/edit/edit-viewer-store.tsx
  EditStoreProvider
  useEditStore
  EditStore
  EditViewerDocumentState
  EditViewerFieldsState
  EditViewerFieldsPartState
  EditViewerModeState
  EditViewerProviderState
  EditViewerSelectionState

components/viewers/edit/edit-viewer-anatomy.tsx
  EditViewer
  EditViewerHeader
  EditViewerDocument
  EditViewerFields
  private EditViewerRoot
  private useEditOutput
  private useEditToolbar

components/viewers/edit/edit-viewer-header.tsx
components/viewers/edit/edit-viewer-document.tsx
components/viewers/edit/edit-viewer-fields.tsx
  pure views only
```

The final public API should be:

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

Forbidden public API:

```ts
EditViewerRoot
EditStore
EditStoreProvider
useEditStore
EditViewerContext
EditViewerContextValue
useEditViewerContext
useEditViewer
useEditViewerFrameState
useEditViewerChromeState
```

### PDF

The final source shape should be:

```txt
pdf-viewer.tsx
  public easy API and public named exports

pdf-viewer-context.tsx
  PdfViewerProvider
  PdfViewerHeader
  PdfViewerPages
  usePdfViewerThumbnails
  private PdfViewerContext
  private view selectors if needed

pdf-viewer-content.tsx
  PdfResourceContent
  PdfViewerContentProps
  viewport and page rendering
  onViewportControlsChange

pdf-viewer-types.ts
  PdfViewerHandle
  PageOverlayProps
  PdfDocumentViewportControls
```

The final public API should be:

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

Forbidden public API:

```ts
PdfViewerContext
PdfViewerContextValue
PdfViewerHeaderControls
PdfViewerHeaderControlSetter
usePdfViewerHeaderState
usePdfViewerPagesState
usePdfViewerHeaderControlSetter
```

## Implementation Order

### Step 1: Finish Edit Entrypoint

Update `components/viewers/edit/edit-viewer.tsx` so anatomy exports come from
`edit-viewer-anatomy.tsx` and provider exports come from
`edit-viewer-provider.tsx`.

Keep the public surface small.

### Step 2: Polish Edit Anatomy Types

Replace `ReturnType<typeof useEditStore>` toolbar type extraction with explicit
domain types.

This is not about runtime. It is about reader speed.

### Step 3: Register Edit Store And Anatomy

Update `registry.json` for the edit viewer block so the registry includes:

```txt
components/viewers/edit/edit-viewer-store.tsx
components/viewers/edit/edit-viewer-anatomy.tsx
```

Then regenerate registry output.

### Step 4: Rename PDF Header Controls To Viewport Controls

Move the shared type to `pdf-viewer-types.ts`:

```ts
PdfDocumentViewportControls
```

Rename:

```txt
PdfViewerHeaderControls -> PdfDocumentViewportControls
headerControls -> viewportControls
setHeaderControls -> setViewportControls
setHeaderControls prop -> onViewportControlsChange
```

Keep `PdfViewerHeader` as the component name. Only the data transport name is
wrong.

### Step 5: Update Architecture Tests

Change the tests from private-helper preservation to public-contract ratchets:

```txt
entrypoint export surface
registry file inclusion
forbidden public names absent
pure views stay pure
anatomy owns ViewerRoot usage
provider owns state bridges
content/provider do not import each other's private transport types
```

Do not assert that a private helper has a specific name.

### Step 6: Rebuild Registry

Run:

```bash
pnpm registry:build
```

Generated `public/r/*` must reflect the source.

### Step 7: Verify

Run:

```bash
pnpm exec tsc --noEmit --pretty false
pnpm exec vitest run tests/viewer-architecture.test.ts --reporter=dot
pnpm exec vitest run tests/pdf-viewer.test.tsx tests/edit-viewer-model.test.ts tests/edit-viewer-render.test.tsx --reporter=dot
pnpm exec vitest run tests/page-markdown-render.test.tsx tests/parse-viewer.test.tsx tests/parse-viewer-adapter.test.tsx --reporter=dot
pnpm exec vitest run tests/sources.test.tsx tests/layout-blocks-document-ai.test.ts --reporter=dot
```

No dev server is needed.

## Completion Audit

The work is complete only when all of these are true:

- `components/viewers/edit/edit-viewer.tsx` is a public map.
- `EditViewer` imports from anatomy, not provider.
- `EditViewerProvider` does not export anatomy components.
- `edit-viewer-store.tsx` is not re-exported by the public entrypoint.
- `EditViewerRoot` is private.
- `useEditStore` is not taught by docs or public entrypoints.
- only `useEditViewerDocument` and `useEditViewerFields` are public edit hooks.
- `PdfViewerHeaderControls` no longer exists.
- `setHeaderControls` no longer exists.
- `headerControls` no longer exists in PDF source or registry output.
- `PdfDocumentViewportControls` lives in a neutral type module.
- `PdfResourceContent` uses `onViewportControlsChange`.
- generated registry JSON matches source.
- architecture tests do not require private helper names.
- docs do not teach private imports.
- TypeScript passes.
- targeted viewer tests pass.

## Perfection Test

The system reaches the local platonic ideal when a reader can explain it in one
minute:

```txt
Viewer primitives define layout.
FileViewer renders one file.
PdfViewer composes PDF provider, header, pages, and thumbnails.
EditViewer composes edit provider, header, document, and fields.
SegmentedDocumentProvider handles document segments and anchors.
Domain viewers adapt their data into these primitives.
Public hooks are narrow and useful.
Private stores are private.
Registry output teaches exactly the same shape as source.
```

If that explanation needs exceptions, aliases, stale generated files, or
private-hook caveats, we are not done.
