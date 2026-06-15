# Viewer System Public Hook Invariant Blueprint

## Verdict

The viewer system is directionally correct, but it is not clean yet.

The remaining issue is not `ViewerRoot`, sidebar state, segmented document
state, or providers as a pattern. The remaining issue is that provider context
privacy is enforced only in some viewers.

The current system has two different API philosophies:

```txt
clean viewers:
  private full context
  public narrow state hooks
  named parts read named hooks

unfinished viewers:
  public full context
  public narrow hooks layered on top of the public full context
  named parts sometimes read the full context directly
```

That inconsistency is the last structural smell.

## Final Rule

Every composed viewer must obey the same rule:

```txt
Provider context is private.
Public hooks expose named public state.
Named parts consume named public hooks.
Implementation wiring never escapes through a public hook.
```

The private context hook may return everything the provider needs:

```ts
function useXViewerContext(): XViewerContextValue
```

The public hooks must return stable public concepts:

```ts
export function useXViewer(): XViewerState
export function useXViewerHeader(): XViewerHeaderState
export function useXViewerSidebar(): XViewerSidebarState
export function useXViewerDocument(): XViewerDocumentState
export function useXViewerControls(): XViewerControlsState
```

The public aggregate hook may exist, but only as a small deliberate state
object. It must not return the provider value.

## Current Reference Implementations

These viewers now express the intended pattern.

### Email

Email is the clearest reference:

```ts
function useEmailViewerContext(): EmailViewerContextValue

export function useEmailViewer(): EmailViewerState
export function useEmailHeader(): EmailHeaderModel
export function useEmailPartsSidebar(): EmailPartsSidebarState
export function useEmailContent(): EmailContentModel
export function useEmailSelection(): EmailSelectionState
```

The MIME model remains private to the provider. Consumers get email concepts:
header, parts sidebar, content, and selection.

### Page Markdown

Page markdown now has the correct public/private split:

```ts
function usePageMarkdownViewerContext(): PageMarkdownViewerContextValue

export function usePageMarkdownViewer(): PageMarkdownViewerState
export function usePageMarkdownViewerContent(): PageMarkdownViewerContentState
export function usePageMarkdownViewerDocument(): PageMarkdownViewerDocumentState
export function usePageMarkdownViewerToolbar(): PageMarkdownViewerToolbarState
```

The remaining question is whether `usePageMarkdownViewerContent` is still too
wide, because it exposes pane wiring:

```txt
markdownPaneRef
setMarkdownContainerWidth
setViewerScale
onMarkdownVisiblePageChange
```

That is acceptable only if this hook is considered the owned part API for
`PageMarkdownViewerContent`. If it is meant for third-party consumers, it
should split into:

```ts
function usePageMarkdownViewerContentContext(): PageMarkdownViewerContentContext

export function usePageMarkdownViewerContent(): PageMarkdownViewerContentState
export function usePageMarkdownViewerSync(): PageMarkdownViewerSyncState
```

### Edit

Edit now has a private full context and named public hooks:

```ts
function useEditViewerContext(): EditViewerContextValue

export function useEditViewer(): EditViewerState
export function useEditViewerLayout(): EditViewerLayoutState
export function useEditViewerBusy(): EditViewerBusyState
export function useEditViewerEmpty(): EditViewerEmptyStatusState
export function useEditViewerHeader(): EditViewerHeaderState
export function useEditViewerDocument(): EditViewerDocumentState
export function useEditViewerFields(): EditViewerFieldsPartState
export function useEditViewerSelection(): EditViewerSelectionState
```

The remaining question is whether `useEditViewer()` should expose `result` and
`fields`. A stricter final API would make `useEditViewer()` status-only and
force field consumers through `useEditViewerFields()`.

### Parse

Parse is thin and now follows the same boundary:

```ts
function useParseViewerContext(): ParseViewerContextValue

export function useParseViewer(): ParseViewerState
export function useParseViewerDocument(): ParseDocumentState
export function useParseViewerMarkdown(): PageMarkdownViewerContentState
```

Thin viewers should still obey the rule. Thinness is not a reason to expose
provider context.

## Remaining Violations

### 1. Split Viewer

Current shape:

```ts
type SplitViewerContextValue = {
  model: SplitViewerModel
  viewport: SegmentViewportController
}

export function useSplitViewer() {
  return context
}
```

Problem:

`useSplitViewer()` exposes the full provider state. The named hooks exist, but
they are layered on top of the public full-context hook:

```ts
export function useSplitViewerHeader(): SplitViewerHeaderState {
  return useSplitViewer().model
}

export function useSplitViewerDocumentControls(): SplitDocumentHandlers {
  return useSplitViewer().viewport.documentHandlers
}
```

Ideal shape:

```ts
function useSplitViewerContext(): SplitViewerContextValue

export function useSplitViewer(): SplitViewerState
export function useSplitViewerHeader(): SplitViewerHeaderState
export function useSplitViewerPageRail(): SplitViewerPageRailState
export function useSplitViewerLegend(): SplitViewerLegendState
export function useSplitViewerDocument(): SplitViewerDocumentState
export function useSplitViewerDocumentControls(): SplitDocumentHandlers
```

Suggested `SplitViewerState`:

```ts
type SplitViewerState = {
  hasOutput: boolean
  isProcessing: boolean
  pageCount: number
  segmentCount: number
}
```

`viewport` should never be returned by the aggregate public hook. It can appear
only in hooks whose whole purpose is viewport interaction, such as page rail,
legend, or document controls.

### 2. Partition Viewer

Current shape:

```ts
type PartitionViewerContextValue = {
  isProcessing: boolean
  model: PartitionViewerModel
  viewport: SegmentViewportController
}

export function usePartitionViewer() {
  return context
}
```

Problem:

Partition has good model separation now, but the hook boundary still exposes
everything. This is especially risky because partition has multiple projections:

```txt
viewportSegments
legendSegments
ribbonRows
```

Those projections should remain named. A public full context lets consumers
depend on the whole model and bypass the intended vocabulary.

Ideal shape:

```ts
function usePartitionViewerContext(): PartitionViewerContextValue

export function usePartitionViewer(): PartitionViewerState
export function usePartitionViewerHeader(): PartitionViewerHeaderState
export function usePartitionViewerRibbon(): PartitionViewerRibbonState
export function usePartitionViewerDocument(): PartitionViewerDocumentState
export function usePartitionViewerDocumentControls(): PartitionDocumentControls
export function usePartitionViewerModel(): PartitionViewerModel
```

`usePartitionViewerModel()` is the important decision point.

Option A, strict:

```txt
Remove usePartitionViewerModel.
Expose only header, ribbon, document, controls, and status hooks.
```

Option B, pragmatic:

```txt
Keep usePartitionViewerModel as an explicit domain-model hook.
Do not expose viewport or isProcessing through it.
```

If kept, `usePartitionViewerModel()` should be treated as a domain model export,
not as a provider escape hatch.

Suggested `PartitionViewerState`:

```ts
type PartitionViewerState = {
  hasOutput: boolean
  isProcessing: boolean
  pageCount: number
  legendSegmentCount: number
  ribbonRowCount: number
}
```

### 3. Classifier Viewer

Current shape:

```ts
type ClassifierViewerContextValue = {
  category: string | null
  emptyDescription: string
  emptyTitle: string
  isProcessing: boolean
  reasoning: string | null
  result: ClassifyResult | null
}

export function useClassifierViewer() {
  return context
}
```

Problem:

The viewer is small, but the same problem exists. Empty state, document state,
header state, and raw result state are collapsed into one public object.

Ideal shape:

```ts
function useClassifierViewerContext(): ClassifierViewerContextValue

export function useClassifierViewer(): ClassifierViewerState
export function useClassifierViewerHeader(): ClassifierViewerHeaderState
export function useClassifierViewerEmpty(): ClassifierViewerEmptyState
export function useClassifierViewerDocument(): ClassifierViewerDocumentState
```

Suggested state shapes:

```ts
type ClassifierViewerState = {
  category: string | null
  hasOutput: boolean
  isProcessing: boolean
}

type ClassifierViewerHeaderState = {
  category: string | null
  reasoning: string | null
}

type ClassifierViewerEmptyState = {
  emptyDescription: string
  emptyTitle: string
  isProcessing: boolean
}

type ClassifierViewerDocumentState = {
  hasOutput: boolean
}
```

First-party parts should stop calling `useClassifierViewer()` directly.

### 4. File Intake Viewer

Current shape:

```ts
type FileIntakeViewerContextValue = {
  actions: FileIntakeViewerActions
  model: FileIntakeViewerModel
}

export function useFileIntakeViewer() {
  return context
}
```

Problem:

The narrow hooks already exist:

```ts
useFileIntakeViewerDropTarget()
useFileIntakeViewerHeader()
useFileIntakeViewerSidebar()
useFileIntakeViewerSurface()
```

But they read through a public full-context hook. Consumers can still bypass the
intended part states and depend directly on `actions` and `model`.

Ideal shape:

```ts
function useFileIntakeViewerContext(): FileIntakeViewerContextValue

export function useFileIntakeViewer(): FileIntakeViewerState
export function useFileIntakeViewerDropTarget(): FileIntakeViewerDropTargetState
export function useFileIntakeViewerHeader(): FileIntakeViewerHeaderState
export function useFileIntakeViewerSidebar(): FileIntakeViewerSidebarState
export function useFileIntakeViewerSurface(): FileIntakeViewerSurfaceState
```

Suggested aggregate:

```ts
type FileIntakeViewerState = {
  canClear: boolean
  hasFile: boolean
  isDragging: boolean
  rejection: FileIntakeViewerRejection | null
  selectedFileSummary: FileIntakeSummary | null
}
```

The aggregate should not expose `viewerSource`, raw `File`, or dropzone prop
getters. Those belong to the specific part hooks.

### 5. PDF Viewer

Current shape:

```ts
type PdfViewerContextValue = {
  currentPage: number | null
  headerControls: PdfViewerHeaderControls | null
  resource: ViewerResource
  setCurrentPage: (page: number | null) => void
  setHeaderControls: (controls: PdfViewerHeaderControls | null) => void
  setViewerHandle: (handle: PdfViewerHandle | null) => void
  viewerHandle: PdfViewerHandle | null
}

export function usePdfViewer() {
  return context
}
```

Decision required:

```txt
Is PdfViewer a primitive or a composed viewer?
```

If PDF is a primitive, then public low-level hooks may be acceptable, but the
exception must be explicit and named.

If PDF is a composed viewer, it should follow the same rule:

```ts
function usePdfViewerContext(): PdfViewerContextValue

export function usePdfViewer(): PdfViewerState
export function usePdfViewerHeader(): PdfViewerHeaderState
export function usePdfViewerPages(): PdfViewerPagesState
export function usePdfViewerThumbnails(): PdfViewerThumbnailsState
export function useOptionalPdfViewerHeaderControls(): PdfViewerHeaderControlSetter | null
```

Suggested aggregate:

```ts
type PdfViewerState = {
  currentPage: number | null
  pageCount: number | null
  resource: ViewerResource
}
```

The public aggregate should not expose:

```txt
setCurrentPage
setHeaderControls
setViewerHandle
viewerHandle
```

Those are wiring.

## What Should Not Change

### Do Not Touch File System

The file system viewer is outside this cleanup. It has its own ownership and
should not be used as a forcing function for this pass.

### Do Not Invent A Giant Viewer

The fix is not a generic `<ComposedViewer>` or `<SegmentedViewer>`.

The fix is smaller:

```txt
same hook boundary
same provider privacy
same named-part discipline
different domain viewers stay different
```

Split, partition, classifier, file intake, page markdown, edit, parse, and
email should remain named viewers.

### Do Not Remove Provider Context

Provider context is not the problem. Public provider context is the problem.

The private provider context is allowed to be rich. It is allowed to contain
refs, handlers, model projections, viewport controllers, and private wiring.
That is exactly what makes the public API small.

## Implementation Plan

### Step 1. Convert Split

1. Rename public `useSplitViewer` implementation to
   `useSplitViewerContext`.
2. Keep `SplitViewerContextValue` private.
3. Add `SplitViewerState`.
4. Reintroduce `useSplitViewer(): SplitViewerState`.
5. Change all existing split part hooks to call `useSplitViewerContext`.
6. Ensure first-party components do not call the aggregate hook for part state.
7. Update tests to reject `export function useSplitViewer()` returning context.

### Step 2. Convert Partition

1. Rename public `usePartitionViewer` implementation to
   `usePartitionViewerContext`.
2. Keep `PartitionViewerContextValue` private.
3. Add `PartitionViewerState`.
4. Reintroduce `usePartitionViewer(): PartitionViewerState`.
5. Change header, ribbon, document, and controls hooks to use private context.
6. Decide whether `usePartitionViewerModel()` is kept as an explicit domain
   model hook.
7. If kept, prove it returns only `model`, not `{ model, viewport }`.
8. Update tests to reject public full-context access.

### Step 3. Convert Classifier

1. Rename public `useClassifierViewer` implementation to
   `useClassifierViewerContext`.
2. Keep `ClassifierViewerContextValue` private.
3. Add `ClassifierViewerState`.
4. Add `useClassifierViewerEmpty`.
5. Add `useClassifierViewerDocument`.
6. Update `ClassifierViewerEmptyState` and `ClassifierViewerDocument` to use
   narrow hooks.
7. Update tests.

### Step 4. Convert File Intake

1. Rename public `useFileIntakeViewer` implementation to
   `useFileIntakeViewerContext`.
2. Keep `FileIntakeViewerContextValue` private.
3. Add `FileIntakeViewerState`.
4. Reintroduce `useFileIntakeViewer(): FileIntakeViewerState`.
5. Change drop target, header, sidebar, and surface hooks to use private
   context.
6. Ensure registry snapshots are rebuilt.
7. Update tests.

### Step 5. Decide PDF

Pick one of two final positions.

Preferred position:

```txt
PDF viewer follows the same public/private hook boundary.
```

Reason:

PDF is used as a leaf viewer, but its context still contains private wiring.
The public API should not expose handle registration or header control setters
through `usePdfViewer`.

Implementation:

1. Rename current `usePdfViewer` implementation to `usePdfViewerContext`.
2. Keep `useOptionalPdfViewerContext` private, or rename it to make its private
   status clear if it is file-local.
3. Reintroduce `usePdfViewer(): PdfViewerState`.
4. Change existing PDF part hooks to read the private context.
5. Keep `useOptionalPdfViewerHeaderControls` as a narrow special-purpose hook.

Allowed exception:

```txt
PDF is explicitly documented as a low-level primitive context.
```

If this exception is chosen, the architecture tests must allowlist PDF by name.
The allowlist should be small and visible.

### Step 6. Strengthen Architecture Tests

The test suite should enforce the invariant globally, not only by checking
specific viewers one at a time.

Add a test that scans composed viewer files for these smells:

```txt
export type XViewerContextValue
export interface XViewerContextValue
export function useXViewer(): XViewerContextValue
export function useXViewer() { return context }
export function useXViewer() { return React.useContext(XViewerContext) }
```

The test should allow private context hooks:

```ts
function useXViewerContext(): XViewerContextValue
```

The test should require public aggregate hooks, when present, to return an
explicit public state type:

```ts
export function useXViewer(): XViewerState
```

Recommended allowlist:

```ts
const primitiveContextHookAllowlist = [
  "registry/new-york-v4/ui/viewer.tsx",
]
```

If PDF is intentionally a primitive, add:

```ts
"registry/new-york-v4/ui/pdf-viewer-context.tsx"
```

But the better end state is no PDF exception.

### Step 7. Runtime Tests

For each converted viewer, add one small runtime test proving the public
aggregate hook does not expose provider internals.

Examples:

```ts
expect(Object.keys(useSplitViewerResult)).toEqual([
  "hasOutput",
  "isProcessing",
  "pageCount",
  "segmentCount",
])
```

```ts
expect(useFileIntakeViewerResult).not.toHaveProperty("actions")
expect(useFileIntakeViewerResult).not.toHaveProperty("viewerSource")
```

Runtime tests should cover shape, not implementation.

### Step 8. Registry Snapshots

Any registry-backed viewer changed in this pass must rebuild its item snapshot.

Known likely snapshots:

```txt
public/r/split-viewer-block.json
public/r/partition-viewer-block.json
public/r/dropzone-uploader-viewer-block.json
public/r/pdf-thumbnails-block.json
```

Exact item names should be confirmed with the registry scripts before editing.

## Naming Rules

Use exactly these meanings:

```txt
ContextValue
  private provider implementation object

State
  public aggregate state object

HeaderState
  public state for header part

SidebarState
  public state for sidebar part

DocumentState
  public state for document/surface part

Controls / Handlers
  public callbacks intentionally passed into a child renderer

Model
  stable domain projection, not provider wiring
```

Do not use `Controller` for public viewer APIs. Controller reads as
implementation authority, not consumer-facing state.

Do not use `Context` in exported public type names unless the exported value is
actually a context object.

## Success Criteria

The system is clean when all of these are true:

1. No composed viewer exports its full provider context value.
2. No composed viewer exports `XViewerContextValue`.
3. Every composed viewer may have exactly one private full-context hook.
4. Every public `useXViewer()` returns `XViewerState`, not
   `XViewerContextValue`.
5. Every first-party named part reads a named hook, not the aggregate hook,
   unless it truly renders aggregate viewer state.
6. Split and partition expose viewport interaction only through named viewport
   part hooks.
7. File intake exposes dropzone getters only through the parts that need them.
8. PDF either follows the rule or is explicitly allowlisted as a primitive.
9. Architecture tests enforce the rule globally.
10. Runtime tests prove the key public hook object shapes.
11. Registry snapshots match the source.
12. No file-system viewer code is touched.

## Final Shape

The final viewer system should feel like this:

```txt
ViewerRoot owns viewer chrome and sidebar mechanics.
Domain providers own domain state.
Private contexts may be rich.
Public hooks are small.
Named parts read named hooks.
Domain viewers compose primitives.
No viewer exposes its internal provider wiring as public API.
```

That is the shadcn-grade version.

Not provider-free.
Not abstraction-heavy.
Just exact.
