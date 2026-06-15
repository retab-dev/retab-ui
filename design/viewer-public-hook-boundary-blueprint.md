# Viewer Public Hook Boundary Blueprint

## Problem

The viewer system has mostly moved toward shadcn-style named parts:

```tsx
<ViewerProvider>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerProvider>
```

The remaining leak is not visual composition. It is hook shape.

A few composed viewers still export hooks that return their full provider
context. That makes the context object an accidental public API. It also lets
external consumers depend on implementation details that should remain private
to the provider.

The pattern was already corrected for email:

```ts
function useEmailViewerContext(): EmailViewerContextValue
export function useEmailViewer(): EmailViewerState
export function useEmailHeader(): EmailHeaderModel
export function useEmailPartsSidebar(): EmailPartsSidebarState
export function useEmailContent(): EmailContentModel
export function useEmailSelection(): EmailSelectionState
```

The same standard should apply to page markdown, edit, and parse.

## Files Audited

Primary files:

- `components/viewers/page-markdown/page-markdown-viewer.tsx`
- `components/viewers/edit/edit-viewer-provider.tsx`
- `components/viewers/edit/edit-viewer.tsx`
- `components/viewers/edit/edit-viewer-header.tsx`
- `components/viewers/edit/edit-viewer-document.tsx`
- `components/viewers/edit/edit-viewer-fields.tsx`
- `components/viewers/parse/parse-viewer.tsx`
- `registry/new-york-v4/ui/email-viewer.tsx`

Generated registry snapshots that must be kept in sync:

- `public/r/parse-viewer-block.json`
- `public/r/edit-viewer-block.json`
- any rebuilt registry item that embeds the audited source files

Tests and documentation touched by the API contract:

- `tests/viewer-architecture.test.ts`
- `tests/page-markdown-render.test.tsx`
- `tests/parse-viewer.test.tsx`
- `tests/parse-viewer-behavior.test.tsx`
- `tests/parse-viewer-adapter.test.tsx`
- `content/docs/viewers/parse-viewer.mdx`

## Severity

### P2: Page Markdown And Edit

Page markdown and edit are P2 because they expose full-context hooks from
composed viewers that have enough internal state to become sticky public
contracts.

Page markdown exposes:

```ts
export function usePageMarkdownViewer()
```

It returns the full `PageMarkdownViewerContextValue`, including:

- `document`
- `markdownPaneRef`
- `setMarkdownContainerWidth`
- `setViewerScale`
- `onMarkdownVisiblePageChange`
- derived rendering state
- content state
- toolbar state

Edit exposes:

```ts
export function useEditViewer(): EditViewerContextValue
```

It returns the full `EditViewerContextValue`, including:

- normalized result state
- mode state
- field projection state
- selection state
- document rendering state
- resolved options

These are large enough that accidental consumers can couple to provider layout,
state partitioning, and implementation details.

### P3: Parse

Parse exposes:

```ts
export function useParseViewer()
```

Its current context is small:

```ts
type ParseViewerContextValue = {
  isProcessing: boolean
  result: ParseResponse | null
}
```

That makes it less risky. Still, the exported hook name establishes the same
broad-context convention. If parse grows status, errors, selected page,
markdown projection, source document sync, or toolbar state, the API will
already be pointed in the wrong direction.

## Design Principle

Every composed viewer should have exactly one private context reader and public
hooks that expose named slices.

```txt
private:
  useXViewerContext()

public:
  useXViewer()
  useXViewerHeader()
  useXViewerSidebar()
  useXViewerContent()
  useXViewerDocument()
  useXViewerSelection()
```

The private context hook is allowed to return the full implementation state.
The public hooks are not.

The public aggregate hook may exist only when it returns a deliberately narrow
state object:

```ts
export function useXViewer(): XViewerState
```

It must not return:

```ts
XViewerContextValue
```

The provider context is an implementation detail. The part hooks are the
component API.

## Why This Matters

Full-context public hooks create five concrete problems.

### 1. The Context Shape Becomes API

Once consumers can destructure the context, every key name becomes public:

```ts
const { state, mode, fields, document, options } = useEditViewer()
```

That prevents future provider cleanup. Renaming `fields` to `fieldList`,
splitting `state`, or moving `options.fieldPanel` into a layout hook becomes a
breaking API change.

### 2. Private Refs Leak

Page markdown currently exposes:

```ts
markdownPaneRef
setMarkdownContainerWidth
setViewerScale
onMarkdownVisiblePageChange
```

Those are wiring details for the markdown pane, toolbar, and sync bridge. They
are not stable concepts in the page markdown viewer API.

### 3. Public Hooks Lose Intent

This:

```ts
useEditViewerFields()
```

says what the consumer needs.

This:

```ts
useEditViewer()
```

does not. It forces readers to inspect destructuring to understand whether the
consumer is rendering header chrome, fields, empty state, busy state, or
document overlays.

### 4. Tests Cannot Protect Boundaries

Architecture tests can reliably forbid:

```ts
export function useEditViewer(): EditViewerContextValue
```

They cannot reliably infer whether arbitrary external destructuring is clean
once the full context is intentionally public.

### 5. It Diverges From The Email Fix

Email now has the right pattern:

```ts
function useEmailViewerContext()
export function useEmailViewer(): EmailViewerState
export function useEmailHeader()
export function useEmailPartsSidebar()
export function useEmailContent()
export function useEmailSelection()
```

Keeping page markdown, edit, and parse on the old pattern makes the system feel
accidental rather than designed.

## Target Contract

### Page Markdown

Private:

```ts
function usePageMarkdownViewerContext(): PageMarkdownViewerContextValue
```

Public:

```ts
export type PageMarkdownViewerState = {
  currentPage: number
  fileName: string
  hasPages: boolean
  isProcessing: boolean
  mode: PageMarkdownViewMode
  pageCount: number
  scale: number
  text: string
}

export function usePageMarkdownViewer(): PageMarkdownViewerState

export function usePageMarkdownViewerContent(): PageMarkdownViewerContentState

export function usePageMarkdownViewerDocument(): PageMarkdownDocumentState

export function usePageMarkdownViewerToolbar(): PageMarkdownViewerToolbarState
```

`PageMarkdownViewerContentState` may include pane wiring because
`PageMarkdownViewerContent` is the named part that owns the markdown pane.
That state should still be narrower than full context and named for content,
not for the entire viewer.

Recommended content state:

```ts
export type PageMarkdownViewerContentState = {
  currentPage: number
  fileName: string
  fitWidth: () => void
  hasPages: boolean
  isMarkdownScaleReady: boolean
  isProcessing: boolean
  markdownPaneRef: React.RefObject<PageMarkdownPaneHandle | null>
  mode: PageMarkdownViewMode
  onMarkdownVisiblePageChange: (pageNumber: number) => void
  pages: string[]
  processingLabel: string
  resetKey?: string
  scale: number
  setMarkdownContainerWidth: (width: number | null) => void
  setMode: (mode: PageMarkdownViewMode) => void
  setViewerScale: (scale: number | null) => void
  text: string
}
```

Recommended toolbar state:

```ts
export type PageMarkdownViewerToolbarState = {
  currentPage: number
  fileName: string
  fitWidth: () => void
  mode: PageMarkdownViewMode
  pageCount: number
  scale: number
  setMode: (mode: PageMarkdownViewMode) => void
  setViewerScale: (scale: number | null) => void
  text: string
}
```

Important correction: `PageMarkdownViewerToolbar` currently calls
`usePageMarkdownViewerContent()`. It should call
`usePageMarkdownViewerToolbar()`. The toolbar should not receive content-pane
refs or container-width setters.

### Edit

Private:

```ts
function useEditViewerContext(): EditViewerContextValue
```

Public:

```ts
export type EditViewerState = {
  status: EditViewerStatus
  result: EditViewerResult
  fields: readonly EditViewerField[]
  filledCount: number
  hasOutput: boolean
}

export type EditViewerLayoutState = {
  hasOutput: boolean
  hasFieldPanel: boolean
}

export type EditViewerBusyState = {
  status: Extract<EditViewerStatus, { state: "detecting" | "filling" }> | null
}

export type EditViewerEmptyState = {
  hasOutput: boolean
}

export function useEditViewer(): EditViewerState
export function useEditViewerLayout(): EditViewerLayoutState
export function useEditViewerBusy(): EditViewerBusyState
export function useEditViewerEmpty(): EditViewerEmptyState
export function useEditViewerHeader(): EditViewerHeaderState
export function useEditViewerDocument(): EditViewerDocumentState
export function useEditViewerFields(): EditViewerFieldsPartState
export function useEditViewerSelection(): EditViewerSelectionState
```

The public `useEditViewer()` can remain, but only as a narrow aggregate. It
must not expose:

- `fieldByKey`
- `fieldsByPage`
- `options`
- `document`
- `mode`
- `selection`

Those are either private implementation details or already exposed through
specific hooks.

`EditViewerRoot` should stop using the full hook:

```ts
const layout = useEditViewerLayout()
```

`EditViewerBusyOverlay` should stop using the full hook:

```ts
const busy = useEditViewerBusy()
```

`EditViewerEmptyState` should stop using the full hook:

```ts
const empty = useEditViewerEmpty()
```

Internal public parts should read narrow hooks. Only other hooks inside
`edit-viewer-provider.tsx` should call `useEditViewerContext()`.

### Parse

Private:

```ts
function useParseViewerContext(): ParseViewerContextValue
```

Public:

```ts
export type ParseViewerState = {
  isProcessing: boolean
  result: ParseResponse | null
  hasOutput: boolean
  pageCount: number
}

export function useParseViewer(): ParseViewerState
export function useParseViewerDocument(): ParseDocumentState
export function useParseViewerMarkdown(): PageMarkdownViewerContentState
```

`hasOutput` and `pageCount` are acceptable because they are derived from the
parse result and useful for custom chrome. They also prevent consumers from
needing to inspect `result?.output?.pages` for common UI decisions.

`useParseViewerMarkdown()` should keep delegating to page markdown content
state. Parse does not need to duplicate markdown pane wiring.

## Export Rules

### Allowed

```ts
export function usePageMarkdownViewer(): PageMarkdownViewerState
export function usePageMarkdownViewerContent(): PageMarkdownViewerContentState
export function usePageMarkdownViewerDocument(): PageMarkdownDocumentState
export function usePageMarkdownViewerToolbar(): PageMarkdownViewerToolbarState

export function useEditViewer(): EditViewerState
export function useEditViewerLayout(): EditViewerLayoutState
export function useEditViewerBusy(): EditViewerBusyState
export function useEditViewerEmpty(): EditViewerEmptyState
export function useEditViewerHeader(): EditViewerHeaderState
export function useEditViewerDocument(): EditViewerDocumentState
export function useEditViewerFields(): EditViewerFieldsPartState
export function useEditViewerSelection(): EditViewerSelectionState

export function useParseViewer(): ParseViewerState
export function useParseViewerDocument(): ParseDocumentState
export function useParseViewerMarkdown(): PageMarkdownViewerContentState
```

### Forbidden

```ts
export function usePageMarkdownViewer(): PageMarkdownViewerContextValue
export function useEditViewer(): EditViewerContextValue
export function useParseViewer(): ParseViewerContextValue
export type PageMarkdownViewerContextValue = ...
export type EditViewerContextValue = ...
export type ParseViewerContextValue = ...
```

The context value types should stay file-private unless there is a specific
test-only need. Public state types should be named after the hook that returns
them.

## Implementation Plan

### Step 1: Page Markdown

1. Rename the existing `usePageMarkdownViewer` implementation to
   `usePageMarkdownViewerContext`.
2. Keep `PageMarkdownViewerContextValue` file-private.
3. Add `PageMarkdownViewerState`,
   `PageMarkdownViewerContentState`, and
   `PageMarkdownViewerToolbarState`.
4. Reintroduce `usePageMarkdownViewer()` as a narrow public aggregate.
5. Update `usePageMarkdownViewerContent`,
   `usePageMarkdownViewerDocument`, and
   `usePageMarkdownViewerToolbar` to call the private context hook.
6. Update `PageMarkdownViewerToolbar` to call
   `usePageMarkdownViewerToolbar()` instead of
   `usePageMarkdownViewerContent()`.

### Step 2: Edit

1. Rename the existing `useEditViewer` implementation to
   `useEditViewerContext`.
2. Keep `EditViewerContextValue` file-private.
3. Decide whether `EditViewerState` should continue containing `result`.
   If public consumers need raw result for custom chrome, keep it. Otherwise,
   prefer a smaller aggregate.
4. Remove `fieldByKey` and `fieldsByPage` from public `EditViewerState`.
   They are lookup/index structures for provider internals.
5. Add `EditViewerLayoutState`, `EditViewerBusyState`, and
   `EditViewerEmptyState`.
6. Reintroduce `useEditViewer()` as a narrow aggregate.
7. Add `useEditViewerLayout`, `useEditViewerBusy`, and
   `useEditViewerEmpty`.
8. Update `EditViewerRoot`, `EditViewerBusyOverlay`, and
   `EditViewerEmptyState` to use the new narrow hooks.
9. Update existing narrow hooks to call `useEditViewerContext()`.
10. Remove `EditViewerContextValue` from public exports in
    `components/viewers/edit/edit-viewer.tsx`.

### Step 3: Parse

1. Rename the existing `useParseViewer` implementation to
   `useParseViewerContext`.
2. Keep `ParseViewerContextValue` file-private.
3. Add `ParseViewerState`.
4. Reintroduce `useParseViewer()` as a narrow derived public state.
5. Keep `useParseViewerDocument()` delegated to page markdown document state.
6. Keep `useParseViewerMarkdown()` delegated to page markdown content state.

### Step 4: Registry

Rebuild every registry item that embeds the modified files.

At minimum:

```txt
parse-viewer-block
edit-viewer-block
```

Then verify:

```txt
public/r/parse-viewer-block.json
public/r/edit-viewer-block.json
registry.json
```

contain the same hook boundaries as source.

## Architecture Tests

Add or update tests in `tests/viewer-architecture.test.ts`.

### Page Markdown Guard

The test should prove:

```txt
page-markdown-viewer.tsx contains:
  function usePageMarkdownViewerContext()
  export function usePageMarkdownViewer(): PageMarkdownViewerState
  export function usePageMarkdownViewerContent(): PageMarkdownViewerContentState
  export function usePageMarkdownViewerDocument(): PageMarkdownDocumentState
  export function usePageMarkdownViewerToolbar(): PageMarkdownViewerToolbarState

page-markdown-viewer.tsx does not contain:
  export function usePageMarkdownViewer() {
    const context = React.useContext(PageMarkdownViewerContext)
  }
  export type PageMarkdownViewerContextValue
  export function usePageMarkdownViewer(): PageMarkdownViewerContextValue
```

It should also prove:

```txt
PageMarkdownViewerToolbar calls usePageMarkdownViewerToolbar
PageMarkdownViewerToolbar does not call usePageMarkdownViewerContent
```

### Edit Guard

The test should prove:

```txt
edit-viewer-provider.tsx contains:
  function useEditViewerContext()
  export function useEditViewer(): EditViewerState
  export function useEditViewerLayout(): EditViewerLayoutState
  export function useEditViewerBusy(): EditViewerBusyState
  export function useEditViewerEmpty(): EditViewerEmptyState

edit-viewer-provider.tsx does not contain:
  export function useEditViewer(): EditViewerContextValue
  export type EditViewerContextValue
```

It should also prove:

```txt
edit-viewer.tsx does not import useEditViewer
EditViewerRoot uses useEditViewerLayout
EditViewerBusyOverlay uses useEditViewerBusy
EditViewerEmptyState uses useEditViewerEmpty
```

### Parse Guard

The test should prove:

```txt
parse-viewer.tsx contains:
  function useParseViewerContext()
  export function useParseViewer(): ParseViewerState
  export function useParseViewerDocument
  export function useParseViewerMarkdown

parse-viewer.tsx does not contain:
  export function useParseViewer() {
    const context = React.useContext(ParseViewerContext)
  }
  export function useParseViewer(): ParseViewerContextValue
  export type ParseViewerContextValue
```

### Registry Guard

The test should prove generated registry snapshots do not preserve the old
full-context exports:

```txt
public/r/parse-viewer-block.json does not contain
  export function useParseViewer() {
    const context = React.useContext(ParseViewerContext)

public/r/edit-viewer-block.json does not contain
  export function useEditViewer(): EditViewerContextValue
```

## Runtime Tests

Existing runtime tests should continue to cover behavior:

```txt
tests/page-markdown-render.test.tsx
tests/parse-viewer.test.tsx
tests/parse-viewer-behavior.test.tsx
tests/parse-viewer-adapter.test.tsx
```

Add focused hook-shape tests only if architecture tests are not enough.

Useful cases:

1. `usePageMarkdownViewer()` returns public state and does not expose
   `markdownPaneRef`.
2. `useEditViewer()` returns public state and does not expose `document`,
   `options`, `mode`, or `selection`.
3. `useParseViewer()` returns `isProcessing`, `result`, `hasOutput`, and
   `pageCount`.

These tests can be plain runtime tests with a small probe component mounted
inside each provider.

## Public Documentation

Docs should teach narrow hooks, not context hooks.

Parse docs should continue showing:

```ts
useParseViewerDocument()
```

If parse docs mention `useParseViewer()`, they should describe it as a small
state hook, not as provider internals.

Edit docs should show:

```ts
useEditViewerHeader()
useEditViewerFields()
useEditViewerDocument()
useEditViewerSelection()
```

Avoid examples that destructure full provider state:

```ts
const edit = useEditViewer()
edit.document
edit.options
edit.selection
```

Page markdown docs should show:

```ts
usePageMarkdownViewerDocument()
usePageMarkdownViewerToolbar()
usePageMarkdownViewerContent()
```

Only use `usePageMarkdownViewer()` for small aggregate display state.

## Naming Standard

Use the same naming everywhere:

```txt
ContextValue -> private provider implementation shape
State        -> public aggregate hook return value
HeaderState  -> public header part hook return value
ContentState -> public content part hook return value
DocumentState -> public document bridge state
SelectionState -> public selection state
LayoutState  -> public layout decision state
BusyState    -> public busy overlay state
EmptyState   -> public empty state decision state
```

Do not use:

```txt
Controller
Manager
Model
Data
Info
PropsState
```

unless the surrounding component already has that precise domain term.

## Success Criteria

The cleanup is done when all of these are true:

1. No composed viewer exports a hook that returns its provider context value.
2. Every exported `useXViewer()` hook returns a named public `XViewerState`.
3. Every provider has at most one full context reader, and it is private.
4. Named parts call narrow hooks.
5. Internal helper hooks call the private context hook.
6. Registry snapshots match source.
7. Architecture tests reject the old full-context export pattern.
8. Runtime tests still pass for page markdown, parse, and edit.
9. Documentation examples use narrow hooks.

## Failure Signals

The design is still not clean if any of these remain:

```ts
export function useEditViewer(): EditViewerContextValue
export function useParseViewer(): ParseViewerContextValue
export function usePageMarkdownViewer(): PageMarkdownViewerContextValue
export type EditViewerContextValue
export type ParseViewerContextValue
export type PageMarkdownViewerContextValue
```

The design is also not clean if first-party components use broad aggregate hooks
when a narrow hook exists:

```ts
const edit = useEditViewer()
edit.options.fieldPanel
edit.state.hasOutput
edit.document
```

Those should be:

```ts
const layout = useEditViewerLayout()
const document = useEditViewerDocument()
```

## Final Position

Yes, the flagged hooks are real remaining imperfections.

The correct fix is not to delete all aggregate hooks. The correct fix is to make
the context hook private and make every public hook intentionally narrow.

Email is now the reference pattern. Page markdown, edit, and parse should match
it.

The sharp rule is:

```txt
Provider context is private.
Viewer state is public.
Part state is public.
Implementation wiring is private unless owned by that exact named part.
```

