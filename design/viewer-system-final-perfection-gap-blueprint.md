# Viewer System Final Perfection Gap Blueprint

## Verdict

We have not reached perfection.

The system is good. The remaining gap is small but structural: the public hook
boundary is still inconsistent across composed viewers.

Email now demonstrates the right shape:

```ts
function useEmailViewerContext(): EmailViewerContextValue

export function useEmailViewer(): EmailViewerState
export function useEmailHeader(): EmailHeaderModel
export function useEmailPartsSidebar(): EmailPartsSidebarState
export function useEmailContent(): EmailContentModel
export function useEmailSelection(): EmailSelectionState
```

Page markdown, edit, and parse still expose broad public hooks that read their
provider context directly.

That is the last visible sign that the viewer system still contains two
philosophies.

## The Standard

Every composed viewer should follow one rule:

```txt
provider context is private
viewer state is public
part state is public
implementation wiring is private unless owned by that exact named part
```

This rule is more important than whether a viewer has a sidebar, a document
surface, a toolbar, a markdown pane, fields, MIME parts, or page sync.

The public API should describe what a consumer is allowed to depend on. The
provider context should describe how the component is internally wired.

Those are not the same object.

## Remaining Imperfections

### 1. Page Markdown Exposes Full Context

Current smell:

```ts
export function usePageMarkdownViewer()
```

It returns the full page markdown provider context.

That context includes public state and private pane wiring:

```txt
currentPage
document
fileName
hasPages
isMarkdownScaleReady
isProcessing
markdownPaneRef
mode
pages
processingLabel
resetKey
scale
setMarkdownContainerWidth
setMode
setViewerScale
text
fitWidth
onMarkdownVisiblePageChange
```

Some of those are legitimate public concepts. Some are implementation details.
The hook currently does not distinguish them.

Ideal:

```ts
function usePageMarkdownViewerContext(): PageMarkdownViewerContextValue

export function usePageMarkdownViewer(): PageMarkdownViewerState
export function usePageMarkdownViewerContent(): PageMarkdownViewerContentState
export function usePageMarkdownViewerDocument(): PageMarkdownDocumentState
export function usePageMarkdownViewerToolbar(): PageMarkdownViewerToolbarState
```

The toolbar should read toolbar state, not content state.

### 2. Edit Exposes Full Context

Current smell:

```ts
export function useEditViewer(): EditViewerContextValue
```

This exposes:

```txt
state
mode
fields
selection
document
options
```

That is too much for a public hook. It makes provider partitioning public.

The first-party composed parts also use the broad hook for layout, busy state,
and empty state. That makes those simple questions depend on the full context:

```ts
const edit = useEditViewer()
edit.state.hasOutput
edit.options.fieldPanel
```

Ideal:

```ts
function useEditViewerContext(): EditViewerContextValue

export function useEditViewer(): EditViewerState
export function useEditViewerLayout(): EditViewerLayoutState
export function useEditViewerBusy(): EditViewerBusyState
export function useEditViewerEmpty(): EditViewerEmptyState
export function useEditViewerHeader(): EditViewerHeaderState
export function useEditViewerDocument(): EditViewerDocumentState
export function useEditViewerFields(): EditViewerFieldsPartState
export function useEditViewerSelection(): EditViewerSelectionState
```

The public `useEditViewer()` may remain, but it must become a small aggregate.
It should not return `document`, `options`, `mode`, `selection`, `fieldByKey`,
or `fieldsByPage`.

### 3. Parse Carries The Same Smell In Smaller Form

Current smell:

```ts
export function useParseViewer()
```

The returned context is currently small:

```ts
type ParseViewerContextValue = {
  isProcessing: boolean
  result: ParseResponse | null
}
```

This is less dangerous than edit, but it establishes the wrong convention.

Ideal:

```ts
function useParseViewerContext(): ParseViewerContextValue

export function useParseViewer(): ParseViewerState
export function useParseViewerDocument(): ParseDocumentState
export function useParseViewerMarkdown(): PageMarkdownViewerContentState
```

Suggested public state:

```ts
type ParseViewerState = {
  isProcessing: boolean
  result: ParseResponse | null
  hasOutput: boolean
  pageCount: number
}
```

Parse can remain thin. Thin does not mean broad context should be public.

## Non-Issues

These are not the remaining perfection blockers.

### Viewer Primitives

The primitive direction is sound:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSidebarTrigger
ViewerSurface
```

The sidebar state living in `ViewerRoot` is correct. It gives the system the
same ergonomic power as shadcn sidebar without introducing a second mandatory
provider.

### Email

Email is now the reference implementation for public/private hook separation.
Its MIME model is domain-specific, but the viewer composition is coherent:

```tsx
<EmailViewerProvider>
  <EmailViewerFrame>
    <EmailHeader />
    <ViewerBody>
      <EmailPartsSidebar />
      <ViewerSurface>
        <EmailContent />
      </ViewerSurface>
    </ViewerBody>
  </EmailViewerFrame>
</EmailViewerProvider>
```

Nested message behavior can still be debated, but it is not the current system
blocker.

### Split And Partition

Split and partition converge in the right place: shared segmented document
state and viewport mechanics, not a giant generic visual viewer.

The right center is:

```txt
SegmentedDocumentProvider
SegmentViewportController
SegmentDocumentHandle
```

Domain viewers should remain named compositions.

### FileViewer

The FileViewer direction is sound: it is the file-rendering leaf that can also
compose viewer chrome when used as a full viewer.

The remaining public hook issue does not require folding FileViewer into
Viewer or splitting Viewer again.

## Final Target

The viewer system reaches the next level when every composed viewer has this
shape:

```ts
type XViewerContextValue = {
  // private provider implementation
}

function useXViewerContext(): XViewerContextValue

export type XViewerState = {
  // small public aggregate
}

export function useXViewer(): XViewerState

export function useXViewerHeader(): XViewerHeaderState
export function useXViewerSidebar(): XViewerSidebarState
export function useXViewerContent(): XViewerContentState
export function useXViewerDocument(): XViewerDocumentState
export function useXViewerSelection(): XViewerSelectionState
```

Not every viewer needs every hook. But every exported hook should be named
after the public slice it returns.

## Cutover Plan

### Phase 1: Page Markdown

1. Rename the current full hook to `usePageMarkdownViewerContext`.
2. Keep `PageMarkdownViewerContextValue` private.
3. Add public state types for viewer, content, document, and toolbar.
4. Recreate `usePageMarkdownViewer()` as a narrow public aggregate.
5. Make `PageMarkdownViewerToolbar` use `usePageMarkdownViewerToolbar()`.
6. Keep markdown pane refs and container-width setters inside content state
   only.

### Phase 2: Edit

1. Rename the current full hook to `useEditViewerContext`.
2. Keep `EditViewerContextValue` private.
3. Recreate `useEditViewer()` as a narrow aggregate.
4. Add `useEditViewerLayout()`.
5. Add `useEditViewerBusy()`.
6. Add `useEditViewerEmpty()`.
7. Update `EditViewerRoot`, `EditViewerBusyOverlay`, and
   `EditViewerEmptyState` to use those hooks.
8. Keep `useEditViewerHeader`, `useEditViewerDocument`,
   `useEditViewerFields`, and `useEditViewerSelection` as public part hooks.
9. Remove public export of `EditViewerContextValue`.

### Phase 3: Parse

1. Rename the current full hook to `useParseViewerContext`.
2. Keep `ParseViewerContextValue` private.
3. Recreate `useParseViewer()` as `ParseViewerState`.
4. Keep `useParseViewerDocument()` delegated to page markdown document state.
5. Keep `useParseViewerMarkdown()` delegated to page markdown content state.

### Phase 4: Registry And Docs

1. Rebuild `parse-viewer-block`.
2. Rebuild `edit-viewer-block`.
3. Verify `public/r/parse-viewer-block.json` contains the new parse hook
   boundary.
4. Verify `public/r/edit-viewer-block.json` contains the new edit hook
   boundary.
5. Update docs to teach narrow hooks only.

## Test Contract

Architecture tests should enforce the boundary.

Required negative assertions:

```txt
no export function usePageMarkdownViewer(): PageMarkdownViewerContextValue
no export function useEditViewer(): EditViewerContextValue
no export function useParseViewer(): ParseViewerContextValue
no export type PageMarkdownViewerContextValue
no export type EditViewerContextValue
no export type ParseViewerContextValue
```

Required positive assertions:

```txt
function usePageMarkdownViewerContext()
function useEditViewerContext()
function useParseViewerContext()

export function usePageMarkdownViewer(): PageMarkdownViewerState
export function useEditViewer(): EditViewerState
export function useParseViewer(): ParseViewerState
```

First-party components should also be guarded:

```txt
EditViewerRoot uses useEditViewerLayout
EditViewerBusyOverlay uses useEditViewerBusy
EditViewerEmptyState uses useEditViewerEmpty
PageMarkdownViewerToolbar uses usePageMarkdownViewerToolbar
```

Registry snapshots should be guarded because stale generated JSON can
reintroduce the old API through installation.

## Verification Commands

Run the focused suite:

```sh
pnpm exec vitest run \
  tests/viewer-architecture.test.ts \
  tests/page-markdown-render.test.tsx \
  tests/parse-viewer.test.tsx \
  tests/parse-viewer-behavior.test.tsx \
  tests/parse-viewer-adapter.test.tsx \
  tests/edit-viewer-model.test.ts \
  tests/edit-viewer-render.test.tsx
```

Run typecheck:

```sh
pnpm exec tsc --noEmit --pretty false
```

Run targeted lint for touched viewer files.

## Perfection Criteria

The system is not perfect because it has two public-hook philosophies.

It becomes materially closer to perfect when:

1. Every full context hook is private.
2. Every public hook returns a narrow named state.
3. First-party parts use the narrow hooks they would teach users to use.
4. Context value types are not exported.
5. Registry snapshots match source.
6. Docs show only stable public hooks.
7. Architecture tests make regression difficult.

After that, the remaining discussion is taste and polish, not architecture.

## Final Judgment

The component architecture is no longer fundamentally wrong.

The provider idea is not a dead end. It works when the provider is hidden behind
precise public hooks and named parts.

The problem is not "providers." The problem is letting provider context become
the API.

The last cut is therefore simple:

```txt
private context readers
public named state hooks
no exported implementation context
```

That is the move that makes the system feel designed rather than merely
refactored.

