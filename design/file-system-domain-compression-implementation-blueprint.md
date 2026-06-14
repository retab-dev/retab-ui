# File System Domain Compression Implementation Blueprint

## Purpose

This blueprint targets the non-Pierre part of the remaining `FileSystem` perfection gap.

Pierre is intentionally out of scope. The list view may keep using Pierre internally, but the file-system domain must not leak Pierre concepts into provider state, public part names, or generic browser controllers. Another agent can make Pierre a cleaner implementation detail behind the list renderer.

This blueprint covers:

1. making the browser domain feel inevitable;
2. collapsing duplicated list/grid/columns controller surfaces;
3. making open-preview/source-resolution an explicit state machine;
4. fixing imprecise names, especially `SelectedFile`.

The goal is not a new architecture layer. The goal is compression:

```txt
same capabilities
fewer concepts
stricter names
clearer state ownership
less repeated controller shape
```

## Current Diagnosis

The current implementation is good but not platonic.

`FileSystem` still exposes a real product surface:

- browser;
- path history;
- selection;
- selected preview;
- modal open;
- lazy loading;
- source resolution;
- query;
- sort;
- render metadata;
- render actions;
- list/grid/columns views;
- Pierre-backed list implementation.

Those are real responsibilities. The issue is that the implementation still makes the reader carry too many concepts at once.

The current provider shape is better because it separates domain state from composition state:

```ts
type FileSystemContextValue = FileSystemDomainState & FileSystemCompositionState
```

But `FileSystemDomainState` still reads as separate slices:

```ts
query
view
source
index
loading
selection
navigation
```

That is accurate, but it is not the most inevitable expression of the product.

The platonic expression is:

```txt
browser
preview
openPreview
renderers
title
```

Where:

- `browser` owns browsing, filtering, sorting, view mode, loading, navigation, and selection;
- `preview` owns the selected-entry preview contract;
- `openPreview` owns the modal/open command contract;
- `renderers` owns user-supplied rendering extension points;
- `title` is just display data.

## Non-Goals

Do not touch the generic `Viewer` primitive.

Do not introduce compatibility aliases.

Do not introduce another provider.

Do not make Pierre a first-class public concept in the file-system API.

Do not solve Pierre lifecycle here. The only requirement is that the list implementation can continue to receive the data and commands it needs through one browser-view adapter.

Do not remove capabilities for the sake of making the component look smaller.

## Target Conceptual API

The easy API remains:

```tsx
<FileSystem items={items} />
```

The composed API should read like:

```tsx
<FileSystemProvider items={items}>
  <ViewerRoot data-viewer="file-system" bare defaultSidebarOpen>
    <ViewerHeader>
      <FileSystemHeader />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar>
        <FileSystemBrowser />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemPreview />
      </ViewerSurface>
    </ViewerBody>
    <FileSystemOpenPreview />
  </ViewerRoot>
</FileSystemProvider>
```

Important naming change:

- `FileSystemSelectedFile` becomes `FileSystemPreview`.
- `useFileSystemSelectedFile` becomes `useFileSystemPreview`.
- `FileSystemOpenPreviewDialog` may remain if the exported component is specifically a dialog, but the conceptual part should be `FileSystemOpenPreview`.

If the implementation keeps `FileSystemOpenPreviewDialog`, the provider state should still be named `openPreview`, not `dialog`, not `openFile`, and not `openedFilePreview`.

## Step 1: Make The Browser Domain Inevitable

### Current Problem

`useFileSystemStateSlices` wires the correct graph:

```txt
query, view, source, pathHistory, loadedItems
-> index
-> loading
-> selection
-> navigation
```

This is better than a god-controller, but consumers still see too much of the graph.

The provider exposes:

```ts
query
view
source
index
loading
selection
navigation
```

That makes every part responsible for knowing which slice to read. It also forces `createFileSystemExplorerPart` to manually reassemble the product from many slices.

### Target Shape

Introduce a `FileSystemBrowserState` as the one domain product of the browser.

```ts
export type FileSystemBrowserState = {
  entries: FileSystemEntry[]
  index: FileSystemIndex
  rawIndex: FileSystemIndex
  currentPath: string
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
  query: FileSystemQueryState
  view: FileSystemView
  loadingFolders: ReadonlySet<string>
  folderErrors: ReadonlyMap<string, string>
  canGoBack: boolean
  canGoForward: boolean
  goBack: () => void
  goForward: () => void
  navigateTo: (path: string) => void
  selectEntry: (entry: FileSystemEntry | null) => void
  selectFirstChildAfterEnsure: (path: string) => Promise<FileSystemEntry | null>
  ensureChildren: (
    path: string,
    options?: { retry?: boolean }
  ) => Promise<FileSystemEntry[]>
  setSearch: (search: string) => void
  setSortKey: (key: FileSystemSortKey) => void
  setView: (view: FileSystemView) => void
}
```

The state has one obvious read model:

```txt
entries        visible entries for current path/query
index          visible index for current query
rawIndex       unfiltered index
currentPath    current folder
selectedEntry  semantic selection
query          search/sort
view           list/grid/columns
loading        folder loading/error state
commands       navigation, selection, loading, query, view
```

### Implementation Details

Create a new file:

```txt
registry/new-york-v4/ui/file-system-browser-state.ts
```

Move browser projection there:

```ts
export type FileSystemBrowserState = { ... }

export function createFileSystemBrowserState({
  index,
  loading,
  navigation,
  query,
  selection,
  view,
}: Pick<
  FileSystemStateSlices,
  "index" | "loading" | "navigation" | "query" | "selection" | "view"
>): FileSystemBrowserState {
  return {
    entries: index.currentEntries,
    index: index.index,
    rawIndex: index.rawIndex,
    currentPath: navigation.currentPath,
    selectedEntry: selection.selectedEntry,
    selectedPath: selection.selectedPath,
    query: query.query,
    view: view.view,
    loadingFolders: loading.loadingFolders,
    folderErrors: loading.folderErrors,
    canGoBack: navigation.canGoBack,
    canGoForward: navigation.canGoForward,
    goBack: navigation.goBack,
    goForward: navigation.goForward,
    navigateTo: navigation.navigateTo,
    selectEntry: selection.selectEntry,
    selectFirstChildAfterEnsure: selection.selectFirstChildAfterEnsure,
    ensureChildren: loading.ensureChildren,
    setSearch: query.setSearch,
    setSortKey: query.setSortKey,
    setView: view.setView,
  }
}
```

Then change `FileSystemDomainState` from slice exposure to domain exposure:

```ts
export type FileSystemDomainState = {
  browser: FileSystemBrowserState
  preview: FileSystemPreviewState
}
```

Keep `useFileSystemStateSlices` internal. It may continue to assemble hooks in graph order, but its output should no longer be the public context shape.

Provider value should become:

```ts
const value = React.useMemo<FileSystemContextValue>(
  () => ({
    browser,
    preview,
    openPreview,
    renderers,
    title,
  }),
  [browser, preview, openPreview, renderers, title]
)
```

### Expected Result

Consumers stop reaching into slice names.

The provider reads as product state:

```txt
browser
preview
openPreview
renderers
title
```

The hook graph still exists, but it is an implementation detail.

## Step 2: Collapse Duplicated View Controller Surfaces

### Current Problem

`file-system-explorer-controllers.ts` defines separate controller shapes:

```ts
FileSystemListViewController
FileSystemGridViewController
FileSystemColumnsViewController
FileSystemStatusState
FileSystemExplorerPart
```

This makes each view look like a different product. Some differences are real, but many are just duplicated slices with slightly different names:

- `currentEntries` vs `index.children[currentPath]`;
- `selectedEntry` repeated;
- `selectedPath` repeated;
- `openPreview` repeated;
- `navigateTo` repeated;
- `resolveFileSource` repeated in views that only need thumbnail/preview source;
- loading state split into slightly different shapes.

The duplication is the main remaining non-Pierre design smell.

### Target Shape

Create one browser controller:

```ts
export type FileSystemBrowserController = {
  state: FileSystemBrowserState
  source: FileSystemSourceController
  openPreview: FileSystemOpenPreviewCommand
}
```

Then derive view-specific adapters only at the render boundary:

```ts
export type FileSystemBrowserViewController =
  | { view: "list"; list: FileSystemListAdapter }
  | { view: "grid"; grid: FileSystemGridAdapter }
  | { view: "columns"; columns: FileSystemColumnsAdapter }
```

But keep adapters small. They should not recreate the whole domain.

Preferred shape:

```ts
export type FileSystemBrowserController = {
  browser: FileSystemBrowserState
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
  openPreview: (file: FileSystemFileEntry) => void
}
```

Then each view receives the same controller:

```tsx
<FileSystemListView controller={controller} />
<FileSystemGridView controller={controller} />
<FileSystemColumnsView controller={controller} />
```

If a view needs local derivation, it derives locally:

```ts
const { browser, openPreview, resolveFileSource } = controller
const entries = browser.entries
```

### Implementation Details

Replace `file-system-explorer-controllers.ts` with a smaller file:

```txt
registry/new-york-v4/ui/file-system-browser-controller.ts
```

Target exports:

```ts
export type FileSystemOpenPreviewCommand = (
  file: FileSystemFileEntry
) => void

export type FileSystemBrowserController = {
  browser: FileSystemBrowserState
  openPreview: FileSystemOpenPreviewCommand
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
}

export function createFileSystemBrowserController({
  browser,
  openPreview,
  source,
}: {
  browser: FileSystemBrowserState
  openPreview: FileSystemOpenPreviewCommand
  source: FileSystemSourceController
}): FileSystemBrowserController {
  return {
    browser,
    openPreview,
    resolveFileSource: source.resolveFileSource,
  }
}
```

Update `FileSystemExplorer`:

```tsx
export function useFileSystemBrowser(): FileSystemBrowserController {
  const state = useFileSystem()

  return createFileSystemBrowserController({
    browser: state.browser,
    openPreview: state.openPreview.open,
    source: state.source,
  })
}
```

If `source` is no longer exposed on context after Step 1, make source part of `preview` or the internal provider projection:

```ts
source: state.preview.resolveFileSource
```

Then:

```tsx
export function FileSystemBrowser() {
  const controller = useFileSystemBrowser()
  const { view } = controller.browser

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {view === "list" ? (
          <FileSystemListView controller={controller} />
        ) : view === "grid" ? (
          <FileSystemGridView controller={controller} />
        ) : (
          <FileSystemColumnsView controller={controller} />
        )}
      </div>
      <FileSystemStatusBar browser={controller.browser} />
    </div>
  )
}
```

Update all view files to accept:

```ts
type Props = {
  controller: FileSystemBrowserController
}
```

Do not pass partial view-specific controller objects from the parent unless the child API becomes dramatically clearer. The platonic rule is: one browser product, many renderers.

### View-Specific Notes

List view:

- May derive its Pierre input from `controller.browser.index`.
- May pass `controller.browser` into a local Pierre adapter.
- Must not export Pierre-specific state from generic browser controller.

Grid view:

- Uses `controller.browser.entries`.
- Uses `controller.browser.selectedPath`.
- Uses `controller.browser.selectEntry`.
- Uses `controller.openPreview`.
- Uses `controller.resolveFileSource` only for thumbnails/preview images if needed.

Columns view:

- Uses `controller.browser.rawIndex` and `controller.browser.index`.
- Uses `controller.browser.currentPath`.
- Uses `controller.browser.ensureChildren`.
- Uses `controller.browser.selectFirstChildAfterEnsure`.
- Uses `controller.openPreview`.

Status bar:

- Should take `browser: FileSystemBrowserState`.
- It should derive count and selected label from `browser.entries`, `browser.query`, and `browser.selectedEntry`.

### Expected Result

Delete these generic exported types:

```ts
FileSystemListViewController
FileSystemGridViewController
FileSystemColumnsViewController
FileSystemExplorerPart
```

Keep view-specific private types only if the view itself needs them.

The parent should no longer manually build three separate controller objects.

## Step 3: Make Open Preview An Explicit State Machine

### Current Problem

`openPreview` currently performs async source resolution directly in the provider:

```ts
const openPreview = React.useCallback((file) => {
  const controller_ = new AbortController()

  void state.source
    .resolveFileSource(file, controller_.signal)
    .then(...)
    .catch(...)
}, ...)
```

Problems:

- no explicit pending state;
- no explicit error state;
- no stale request protection;
- no abort on close or new open;
- `onFileOpen` changes behavior from internal modal to external callback inside the same async command;
- variable name `controller_` is weak;
- source resolution and modal state are coupled but not named as a lifecycle.

### Target Shape

Open-preview should be a small state machine.

```ts
export type FileSystemOpenPreviewState =
  | { status: "idle" }
  | { status: "resolving"; file: FileSystemFileEntry }
  | { status: "open"; file: FileSystemFileEntry; source: ViewerSource }
  | { status: "unavailable"; file: FileSystemFileEntry }
  | { status: "failed"; file: FileSystemFileEntry; error: string }
```

Controller:

```ts
export type FileSystemOpenPreviewController = {
  state: FileSystemOpenPreviewState
  open: (file: FileSystemFileEntry) => void
  close: () => void
}
```

Important naming:

- command is `open`, because it already lives under `openPreview`;
- command is not `openPreview.openPreview`;
- close is `close`;
- state is `state`;
- resolved source is non-null only in `"open"`.

Usage:

```ts
state.openPreview.open(file)
state.openPreview.close()
state.openPreview.state
```

### Implementation Details

Create:

```txt
registry/new-york-v4/ui/file-system-open-preview-state.ts
```

Implementation sketch:

```ts
export type FileSystemOpenPreviewState =
  | { status: "idle" }
  | { status: "resolving"; file: FileSystemFileEntry }
  | { status: "open"; file: FileSystemFileEntry; source: ViewerSource }
  | { status: "unavailable"; file: FileSystemFileEntry }
  | { status: "failed"; file: FileSystemFileEntry; error: string }

export type FileSystemOpenPreviewController = {
  close: () => void
  open: (file: FileSystemFileEntry) => void
  state: FileSystemOpenPreviewState
}
```

Hook:

```ts
export function useFileSystemOpenPreviewController({
  onFileOpen,
  resolveFileSource,
}: {
  onFileOpen?: FileSystemProps["onFileOpen"]
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
}): FileSystemOpenPreviewController {
  const [state, setState] = React.useState<FileSystemOpenPreviewState>({
    status: "idle",
  })
  const requestRef = React.useRef<{
    abortController: AbortController
    requestId: number
  } | null>(null)
  const nextRequestId = React.useRef(0)

  const close = React.useCallback(() => {
    requestRef.current?.abortController.abort()
    requestRef.current = null
    setState({ status: "idle" })
  }, [])

  const open = React.useCallback(
    (file: FileSystemFileEntry) => {
      requestRef.current?.abortController.abort()

      const requestId = nextRequestId.current + 1
      nextRequestId.current = requestId
      const abortController = new AbortController()
      requestRef.current = { abortController, requestId }
      setState({ status: "resolving", file })

      void resolveFileSource(file, abortController.signal)
        .then((source) => {
          if (requestRef.current?.requestId !== requestId) return
          if (abortController.signal.aborted) return

          onFileOpen?.(file, source)

          if (!source) {
            setState({ status: "unavailable", file })
            return
          }

          setState({ status: "open", file, source })
        })
        .catch((error: unknown) => {
          if (requestRef.current?.requestId !== requestId) return
          if (abortController.signal.aborted) return

          onFileOpen?.(file, null)
          setState({
            status: "failed",
            file,
            error: error instanceof Error ? error.message : "Unable to open file.",
          })
        })
    },
    [onFileOpen, resolveFileSource]
  )

  React.useEffect(() => close, [close])

  return React.useMemo(
    () => ({ close, open, state }),
    [close, open, state]
  )
}
```

Decision point:

If `onFileOpen` is supplied, should internal modal state still open?

Platonic answer: no mixed behavior.

Preferred contract:

- `onFileOpen` observes the command result;
- `openPreview` state still transitions normally;
- users who want custom external behavior can omit `FileSystemOpenPreview` from composition.

That makes `onFileOpen` an event, not a mode switch.

So the old behavior:

```ts
if (onFileOpen) {
  onFileOpen(file, source)
  return
}
setOpenedPreview(...)
```

should be removed.

`onFileOpen` should never prevent state from opening.

### Dialog Rendering

Update `FileSystemOpenPreviewDialog`:

```ts
const { close, state } = useFileSystemOpenPreview()
const isOpen = state.status !== "idle"
```

Render states:

- `resolving`: modal shell with loading state and file name;
- `open`: render `FileViewer source={state.source}`;
- `unavailable`: render empty/error state saying preview is unavailable;
- `failed`: render error state;
- `idle`: closed.

This removes `openedPreview: { file, source: ViewerSource | null } | null`.

### Tests

Add behavior tests:

- open command enters resolving and then open;
- close aborts pending resolve and does not open stale source;
- opening file B while file A is resolving ignores file A result;
- `onFileOpen` fires but does not suppress built-in preview state;
- failed source resolution shows failed state;
- null source shows unavailable state;
- keyboard open still triggers `openPreview.open`.

Architecture tests should forbid:

```txt
openedPreview
closePreview
openPreview: (file
controller_
onFileOpen ... return
```

But prefer behavior tests over brittle source assertions where possible.

## Step 5: Fix Imprecise Names

### Current Problem

Some names are close but not exact:

- `FileSystemSelectedFile` is conceptually the preview surface.
- `useFileSystemSelectedFile` returns selected-entry preview state, not just a file.
- `FileSystemSelectedFileState` mixes selected entry, source resolution, metadata renderer, and file actions.
- `FileSystemExplorer` is acceptable, but `Browser` is more precise for the domain product.
- `createFileSystemExplorerPart` is vague; it constructs view controllers, not a part.
- `FileSystemOpenPreviewDialog` is precise only if the component is specifically the dialog. The conceptual state should be `openPreview`.

### Target Names

Use this vocabulary consistently:

```txt
FileSystemBrowser      the navigable file/folder browser
FileSystemPreview      the selected-entry preview surface
FileSystemOpenPreview  the modal/open preview lifecycle
FileSystemHeader       the browser header controls
```

Internal state:

```txt
browser
preview
openPreview
renderers
title
```

Commands:

```txt
browser.navigateTo
browser.selectEntry
browser.ensureChildren
browser.setSearch
browser.setSortKey
browser.setView
openPreview.open
openPreview.close
```

Avoid:

```txt
selectedFile
openFile
openedFilePreview
openedPreview
explorerPart
controller_
manager
engine
service
```

### Implementation Details

Rename exports:

```txt
FileSystemExplorer -> FileSystemBrowser
useFileSystemExplorer -> useFileSystemBrowser
FileSystemExplorerState -> FileSystemBrowserController

FileSystemSelectedFile -> FileSystemPreview
useFileSystemSelectedFile -> useFileSystemPreview
FileSystemSelectedFileState -> FileSystemPreviewState
```

File names:

```txt
file-system-parts.tsx
```

can remain if it exports all named parts, but the internal types should use exact product names.

Preferred final `file-system-parts.tsx` exports:

```ts
export function useFileSystemHeader(): FileSystemHeaderState
export function useFileSystemBrowser(): FileSystemBrowserController
export function useFileSystemPreview(): FileSystemPreviewState
export function useFileSystemOpenPreview(): FileSystemOpenPreviewController

export function FileSystemHeader()
export function FileSystemBrowser()
export function FileSystemPreview()
export function FileSystemOpenPreview()
```

If `FileSystemOpenPreviewDialog` remains for explicit dialog semantics, also export:

```ts
export { FileSystemOpenPreviewDialog }
```

But do not make the provider state call it `dialog`.

### Call Site Updates

Easy API:

```tsx
<FileSystemProvider {...providerProps}>
  <div data-slot="file-system">
    <ViewerRoot ...>
      <ViewerHeader>
        <FileSystemHeader />
      </ViewerHeader>
      <ViewerBody>
        <ViewerSidebar>
          <FileSystemBrowser />
        </ViewerSidebar>
        <ViewerSurface>
          <FileSystemPreview />
        </ViewerSurface>
      </ViewerBody>
      <FileSystemOpenPreview />
    </ViewerRoot>
  </div>
</FileSystemProvider>
```

Docs should show the same names.

Tests should use the new names.

Registry JSON must regenerate.

No compatibility aliases.

## Final Target File Map

Keep the file map small and semantic:

```txt
file-system.tsx                         public exports and easy API
file-system-types.ts                    item/query/view public types
file-system-provider.tsx                context boundary
file-system-controller.ts               internal state graph only
file-system-browser-state.ts            browser product projection
file-system-browser-controller.ts       browser renderer controller
file-system-parts.tsx                   named composed parts
file-system-preview.tsx                 selected preview renderer
file-system-open-preview-state.ts       open-preview state machine
file-system-open-preview-dialog.tsx     dialog renderer
file-system-controls.tsx                toolbar/command/status controls
file-system-list-view.tsx               list renderer
file-system-grid-view.tsx               grid renderer
file-system-columns-view.tsx            columns renderer
file-system-source-controller.ts        source cache/resolution
file-system-query-controller.ts         query state
file-system-view-controller.ts          view state
file-system-path-history.ts             path history
file-system-index-state.ts              indexed entries
file-system-loading-controller.ts       lazy folder loading
file-system-selection-controller.ts     selection
file-system-navigation-controller.ts    navigation commands
```

Pierre files remain, but generic file-system names should not reference Pierre except inside `file-system-list-view.tsx` and private Pierre modules.

## Implementation Order

### Phase 1: Browser Product State

1. Add `file-system-browser-state.ts`.
2. Add `FileSystemBrowserState`.
3. Add `createFileSystemBrowserState`.
4. Change provider context to expose `browser`.
5. Update header to read from `state.browser`.
6. Update status bar to read from browser state.
7. Keep old `createFileSystemHeaderController` temporarily only if needed during the same commit, then delete it before finishing.

Done when no component outside `file-system-controller.ts` reads raw `query`, `view`, `index`, `loading`, `selection`, or `navigation` slices from context.

### Phase 2: Browser Controller Collapse

1. Replace `file-system-explorer-controllers.ts` with `file-system-browser-controller.ts`.
2. Create one `FileSystemBrowserController`.
3. Update list/grid/columns to accept the same controller type.
4. Move view-specific derivation into each view file.
5. Update `FileSystemBrowser` to switch on `controller.browser.view`.
6. Delete `FileSystemExplorerPart` and view-specific exported controller types.

Done when the parent no longer builds separate `list`, `grid`, `columns`, and `status` objects.

### Phase 3: Open Preview State Machine

1. Add `file-system-open-preview-state.ts`.
2. Move open-preview lifecycle out of provider.
3. Replace `openedPreview` object with `FileSystemOpenPreviewState`.
4. Rename commands to `openPreview.open` and `openPreview.close`.
5. Update dialog renderer for idle/resolving/open/unavailable/failed.
6. Add stale request and abort tests.
7. Make `onFileOpen` an event, not a mode switch.

Done when provider only calls:

```ts
const openPreview = useFileSystemOpenPreviewController(...)
```

and contains no promise chain for source resolution.

### Phase 4: Exact Naming Cutover

1. Rename exported parts:
   - `FileSystemExplorer` -> `FileSystemBrowser`
   - `FileSystemSelectedFile` -> `FileSystemPreview`
   - hooks and state types accordingly.
2. Update docs.
3. Update tests.
4. Update registry.
5. Run stale-name scans.

Required stale-name scan:

```bash
rg "SelectedFile|useFileSystemSelectedFile|ExplorerPart|FileSystemExplorerState|openedPreview|closePreview|openPreview: \\(file|controller_" registry/new-york-v4 content tests registry.json public/r
```

Expected result: no matches except explicit negative architecture assertions.

## Test Plan

Run:

```bash
bunx vitest run tests/file-system.test.tsx tests/viewer-architecture.test.ts tests/file-system-pierre-input.test.ts tests/file-system-pierre-lifecycle.test.ts
bunx tsc --noEmit --pretty false
bun run registry:build
```

Add or update tests for:

- composed API renders `FileSystemBrowser` and `FileSystemPreview`;
- list selection still previews selected file;
- grid selection still previews selected file;
- columns selection still previews selected file;
- keyboard open uses `openPreview.open`;
- double click uses `openPreview.open`;
- open-preview resolving state;
- open-preview unavailable state;
- open-preview failed state;
- stale source result cannot replace newer open request;
- close aborts pending source resolution;
- `onFileOpen` fires without suppressing built-in state;
- no public context consumer reads raw provider slices.

## Acceptance Criteria

The implementation is accepted only when:

- provider context reads as `browser`, `preview`, `openPreview`, `renderers`, `title`;
- browser state is the only generic file browser read model;
- list/grid/columns share one browser controller;
- open-preview is a typed lifecycle, not loose nullable state;
- `onFileOpen` is an event, not a mode switch;
- `FileSystemSelectedFile` is gone;
- `FileSystemExplorerPart` is gone;
- generic file-system code does not expose Pierre-specific types;
- registry output is regenerated;
- TypeScript and focused tests pass.

## Platonic Judgment After This Work

If this blueprint is implemented cleanly, the component will still be large, but the largeness will be honest.

The desired reading becomes:

```txt
FileSystemProvider creates the file-system product state.
FileSystemBrowser renders and commands the browser.
FileSystemPreview renders the selected entry.
FileSystemOpenPreview owns the modal open lifecycle.
Viewer supplies only layout.
Pierre is only the list implementation detail.
```

That is close to the platonic ideal: not tiny, not decorative, not generic for its own sake, but exact.
