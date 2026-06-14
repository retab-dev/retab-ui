# File System Provider State Slices Blueprint

## Purpose

This blueprint targets one remaining non-platonic part of `FileSystem`:

```ts
type FileSystemContextValue = {
  controller: ReturnType<typeof useFileSystemController>
  openFilePreviewState: FileSystemOpenFilePreviewController
  renderers: FileSystemRenderers
  title: string
}
```

The public component grammar is now good:

```tsx
<FileSystemProvider>
  <ViewerRoot>
    <ViewerHeader>
      <FileSystemHeader />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar>
        <FileSystemExplorer />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemSelectedFile />
      </ViewerSurface>
    </ViewerBody>
    <FileSystemOpenFileDialog />
  </ViewerRoot>
</FileSystemProvider>
```

But internally, `FileSystemProvider` still exposes one large controller object.
The named-part hooks are narrow, but they narrow by projection:

```ts
const { controller, title } = useFileSystem()
```

That is acceptable engineering. It is not Flaubertian perfection.

The goal is not more abstraction. The goal is to make each state owner
inevitable, named precisely, and impossible to misuse.

## Current Problem

`useFileSystemController` currently owns all of this:

- item normalization and indexing;
- visible index derivation;
- query state;
- sort mutation;
- view mode;
- path history;
- path navigation;
- current folder and current entries;
- selection state;
- child-selection cancellation;
- lazy folder loading;
- source resolution;
- source caching;
- selected-entry derivation.

Then `FileSystemProvider` stores the whole thing as one context value:

```ts
controller: ReturnType<typeof useFileSystemController>
```

Then named-part hooks slice it manually:

```ts
export function useFileSystemHeader() {
  const { controller, title } = useFileSystem()
  return {
    canGoBack: controller.canGoBack,
    canGoForward: controller.canGoForward,
    currentPath: controller.currentPath,
    goBack: controller.goBack,
    goForward: controller.goForward,
    query: controller.query,
    setSearch: controller.setSearch,
    setSortKey: controller.setSortKey,
    setView: controller.setView,
    title,
    view: controller.view,
  }
}
```

The result is locally safe but conceptually compressed:

- `FileSystemHeader` can only see header fields, but the context still carries
  source resolution and lazy loading.
- `FileSystemSelectedFile` can only see preview fields, but the context still
  carries navigation history and query mutation.
- Pierre adapters receive `FileSystemExplorerController`, which is narrower
  than the full controller but still mixes query, selection, loading, indexes,
  and source resolution.

The public API is shadcn-like. The internal state shape is not yet shadcn-grade.

## Design Standard

The platonic provider must satisfy these rules:

- each state slice owns one coherent responsibility;
- each slice name tells the reader what world it belongs to;
- no slice exposes mutation outside its domain;
- no named part hook can reach unrelated capability;
- no adapter receives a bigger object than it actually needs;
- there is no duplicate source of truth;
- the split reduces reading load instead of adding ceremony.

Fake modularity is worse than the current controller.

Do not split simply because a controller is large. Split only where the state
machine already has natural boundaries.

## Real State Boundaries

The current implementation has six natural slices.

### 1. Index Slice

Owns normalized file-system data.

Responsibilities:

- combine `items` and lazy `loadedItems`;
- build `rawIndex`;
- derive `visibleIndex`;
- expose `currentEntries`;
- expose `currentFolder`;
- keep indexing independent from viewer layout and modal open behavior.

Target type:

```ts
export type FileSystemIndexState = {
  allItems: FileSystemItem[]
  currentEntries: FileSystemEntry[]
  currentFolder: FileSystemFolderEntry | null
  index: FileSystemVisibleIndex
  rawIndex: FileSystemRawIndex
}
```

Potential hook:

```ts
function useFileSystemIndexState({
  currentPath,
  items,
  loadedItems,
  query,
}: {
  currentPath: string
  items: FileSystemItem[]
  loadedItems: FileSystemItem[]
  query: FileSystemQueryState
}): FileSystemIndexState
```

This slice must not know about:

- `selectedPath`;
- path history;
- lazy loading callbacks;
- source resolution;
- `ViewerSource`;
- dialogs.

### 2. Query Slice

Owns search and sort state.

Responsibilities:

- initialize from `defaultQuery`;
- support controlled `query`;
- emit complete `FileSystemQueryState`;
- expose semantic commands: `setSearch`, `setSortKey`;
- expose raw `setQuery` only if another internal slice genuinely needs it.

Target type:

```ts
export type FileSystemQueryController = {
  query: FileSystemQueryState
  setSearch: (search: string) => void
  setSortKey: (key: FileSystemSortKey) => void
}
```

Potential hook:

```ts
function useFileSystemQueryController({
  defaultQuery,
  onQueryChange,
  query,
}: Pick<FileSystemProps, "defaultQuery" | "onQueryChange" | "query">)
```

This slice must not know about:

- folders;
- selection;
- view;
- Pierre;
- source resolution.

### 3. View Slice

Owns browser mode only.

Responsibilities:

- initialize from `defaultView`;
- support controlled `view`;
- emit `onViewChange`;
- expose `setView`.

Target type:

```ts
export type FileSystemViewController = {
  setView: (view: FileSystemView) => void
  view: FileSystemView
}
```

Potential hook:

```ts
function useFileSystemViewController({
  defaultView,
  onViewChange,
  view,
}: Pick<FileSystemProps, "defaultView" | "onViewChange" | "view">)
```

This slice must not know about:

- current entries;
- selection;
- source resolution;
- lazy loading.

### 4. Navigation Slice

Owns path history and folder navigation.

Responsibilities:

- initialize from `defaultPath`;
- support controlled `path`;
- expose `currentPath`;
- expose `canGoBack`, `canGoForward`;
- expose `setCurrentPath`, `goBack`, `goForward`;
- clear search and selection through explicit collaborators, not hidden imports.

Target type:

```ts
export type FileSystemNavigationController = {
  canGoBack: boolean
  canGoForward: boolean
  currentPath: string
  goBack: () => void
  goForward: () => void
  navigateTo: (path: string) => void
}
```

The important design question is `navigateTo`. Today it does more than set a
path:

- normalizes the folder path;
- invalidates pending child selection;
- pushes history;
- clears search;
- clears selection;
- starts lazy loading.

That means the slice cannot be isolated by pretending navigation is pure path
state. It needs a command composer.

Recommended split:

```ts
function useFileSystemPathHistory(...)
function useFileSystemNavigationController({
  ensureChildren,
  pathHistory,
  query,
  selection,
})
```

`useFileSystemPathHistory` owns history mechanics. The navigation controller
owns user intent.

This slice may collaborate with:

- query slice, to clear search on navigation;
- selection slice, to clear stale selection;
- loading slice, to ensure folder children.

This slice must not know about:

- source resolution;
- modal open state;
- renderers.

### 5. Selection Slice

Owns selected path, selected entry, and stale async selection cancellation.

Responsibilities:

- initialize from `defaultSelectedPath`;
- support controlled `selectedPath`;
- derive `selectedEntry` from `rawIndex`;
- expose `selectEntry`;
- suppress duplicate selection emissions;
- clear selection when query hides the selected entry;
- invalidate async child-selection requests;
- select first loaded child after lazy folder expansion only when still valid.

Target type:

```ts
export type FileSystemSelectionController = {
  invalidateChildSelectionRequest: () => void
  selectEntry: (entry: FileSystemEntry | null) => void
  selectFirstChildAfterEnsure: (path: string) => Promise<void>
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
}
```

The selection slice has real coupling to:

- `rawIndex`, to derive `selectedEntry`;
- `visibleIndex`, to clear hidden selected entries during search;
- `currentPath`, to cancel stale child selection;
- `ensureChildren`, to select first child after lazy load.

That coupling is acceptable if it is explicit in the hook signature.

Potential hook:

```ts
function useFileSystemSelectionController({
  currentPath,
  defaultSelectedPath,
  ensureChildren,
  onSelectionChange,
  query,
  rawIndex,
  selectedPath,
  visibleIndex,
}: ...)
```

This slice must not know about:

- view mode;
- source resolution;
- open dialog state;
- renderers.

### 6. Loading Slice

Owns lazy folder loading.

Responsibilities:

- store `loadedItems`;
- call `loadChildren`;
- expose `ensureChildren`;
- expose `folderErrors`;
- expose `loadingFolders`;
- merge loaded children into the index input.

Current loading is split between:

- `loadedItems` state in `useFileSystemController`;
- `useFileSystemChildrenLoader`;
- `allItems` derivation in controller.

Target type:

```ts
export type FileSystemLoadingController = {
  ensureChildren: (path: string) => Promise<FileSystemEntry[]>
  folderErrors: ReadonlyMap<string, Error>
  loadedItems: FileSystemItem[]
  loadingFolders: ReadonlySet<string>
}
```

Potential hook:

```ts
function useFileSystemLoadingController({
  currentPath,
  items,
  loadChildren,
  query,
  rawIndex,
  visibleIndex,
}: ...)
```

This slice may know about:

- index state;
- query state;
- current path.

This slice must not know about:

- selection, except through returned entries;
- view mode;
- source resolution;
- dialog state.

### 7. Source Slice

Owns file source resolution and cache semantics.

Responsibilities:

- use direct `file.source` when present;
- call `resolveSource`;
- cache resolved source by file identity;
- clear cache when `items` identity changes;
- ignore aborted resolutions.

Target type:

```ts
export type FileSystemSourceController = {
  resolveFileSource: (
    file: FileSystemFileEntry,
    signal: AbortSignal
  ) => Promise<ViewerSource | null>
}
```

Potential hook:

```ts
function useFileSystemSourceController({
  items,
  resolveSource,
}: Pick<FileSystemProps, "items" | "resolveSource">)
```

This slice must not know about:

- selection;
- navigation;
- query;
- view;
- loading;
- dialogs.

It is a pure service slice.

## Target Context Shape

The ideal provider context should expose named slices, not a god controller:

```ts
export type FileSystemContextValue = {
  index: FileSystemIndexState
  loading: FileSystemLoadingController
  navigation: FileSystemNavigationController
  openFilePreview: FileSystemOpenFilePreviewController
  query: FileSystemQueryController
  renderers: FileSystemRenderers
  selection: FileSystemSelectionController
  source: FileSystemSourceController
  title: string
  view: FileSystemViewController
}
```

This is only better if each slice is real.

Bad version:

```ts
const controller = useFileSystemController(...)

const value = {
  navigation: controller,
  query: controller,
  selection: controller,
  source: controller,
}
```

That is worse than today. It adds names without reducing coupling.

Good version:

```ts
const query = useFileSystemQueryController(...)
const view = useFileSystemViewController(...)
const pathHistory = useFileSystemPathHistory(...)
const loading = useFileSystemLoadingController(...)
const index = useFileSystemIndexState(...)
const selection = useFileSystemSelectionController(...)
const navigation = useFileSystemNavigationController(...)
const source = useFileSystemSourceController(...)
```

The provider becomes a composition root. That is the correct job for a provider.

## Named Part Hooks In The Target Shape

### Header

`useFileSystemHeader` should use exactly:

- `navigation`;
- `query`;
- `title`;
- `view`.

Target:

```ts
export function useFileSystemHeader(): FileSystemHeaderState {
  const { navigation, query, title, view } = useFileSystem()

  return {
    canGoBack: navigation.canGoBack,
    canGoForward: navigation.canGoForward,
    currentPath: navigation.currentPath,
    goBack: navigation.goBack,
    goForward: navigation.goForward,
    query: query.query,
    setSearch: query.setSearch,
    setSortKey: query.setSortKey,
    setView: view.setView,
    title,
    view: view.view,
  }
}
```

It must not touch:

- `source`;
- `loading`;
- `selection`;
- `openFilePreview`;
- `renderers`.

### Explorer

`useFileSystemExplorer` should use exactly:

- `index`;
- `loading`;
- `navigation`;
- `openFilePreview`;
- `query`;
- `selection`;
- `source`;
- `view`.

Target:

```ts
export function useFileSystemExplorer(): FileSystemExplorerState {
  const {
    index,
    loading,
    navigation,
    openFilePreview,
    query,
    selection,
    source,
    view,
  } = useFileSystem()

  return {
    explorerController: {
      currentEntries: index.currentEntries,
      currentPath: navigation.currentPath,
      ensureChildren: loading.ensureChildren,
      folderErrors: loading.folderErrors,
      index: index.index,
      loadingFolders: loading.loadingFolders,
      navigateTo: navigation.navigateTo,
      query: query.query,
      rawIndex: index.rawIndex,
      resolveFileSource: source.resolveFileSource,
      selectEntry: selection.selectEntry,
      selectFirstChildAfterEnsure: selection.selectFirstChildAfterEnsure,
      selectedEntry: selection.selectedEntry,
      selectedPath: selection.selectedPath,
      view: view.view,
    },
    openFilePreview: openFilePreview.openFilePreview,
  }
}
```

This can still return `explorerController` for existing child view components.
The important change is that it assembles from slices rather than projects from
a god object.

### Selected File

`useFileSystemSelectedFile` should use exactly:

- `selection`;
- `source`;
- `renderers`.

Target:

```ts
export function useFileSystemSelectedFile(): FileSystemSelectedFileState {
  const { renderers, selection, source } = useFileSystem()

  return {
    renderFileActions: renderers.renderFileActions,
    renderMetadata: renderers.renderMetadata,
    resolveFileSource: source.resolveFileSource,
    selectedEntry: selection.selectedEntry,
  }
}
```

It must not touch:

- navigation;
- query;
- loading;
- view;
- open dialog state.

### Open File Dialog

`useFileSystemOpenFileDialog` should use exactly:

- `openFilePreview`.

Target:

```ts
export function useFileSystemOpenFileDialog() {
  return useFileSystem().openFilePreview
}
```

## File Plan

Do not split into too many files immediately. The first clean target is:

```txt
file-system-provider.tsx
file-system-controller.ts
file-system-index-state.ts
file-system-query-controller.ts
file-system-view-controller.ts
file-system-navigation-controller.ts
file-system-selection-controller.ts
file-system-source-controller.ts
use-file-system-children-loader.ts
```

### Keep

Keep these existing files:

- `file-system-provider.tsx`;
- `file-system-controller.ts`;
- `use-file-system-children-loader.ts`;
- `file-system-query.ts`;
- `file-system-index.ts`.

### Add

Add only files that remove real complexity:

- `file-system-query-controller.ts`;
- `file-system-view-controller.ts`;
- `file-system-path-history.ts`;
- `file-system-selection-controller.ts`;
- `file-system-source-controller.ts`;
- maybe `file-system-index-state.ts`.

### Reduce

`file-system-controller.ts` should either:

Path A: disappear.

The provider directly composes slices.

Path B: become a pure composition helper.

```ts
export function useFileSystemState(props) {
  const query = useFileSystemQueryController(...)
  const view = useFileSystemViewController(...)
  const navigation = ...

  return { index, loading, navigation, query, selection, source, view }
}
```

If Path B is chosen, do not call it `controller`. Call it `useFileSystemState`
or `useFileSystemStateSlices`.

Preferred: Path B for readability during migration, then inline into provider
only if the extra hook becomes pointless.

## Implementation Phases

### Phase 1: Extract Pure Service Slices

Start with the slices that have minimal coupling.

1. Extract `useFileSystemSourceController`.
2. Extract `useFileSystemQueryController`.
3. Extract `useFileSystemViewController`.

These should be behavior-preserving.

Acceptance:

- source cache tests still pass;
- controlled query tests still pass;
- controlled view tests still pass;
- `file-system-controller.ts` loses source, query, and view implementation
  details.

### Phase 2: Extract Index State

Move index derivation into `useFileSystemIndexState`.

Inputs:

- `items`;
- `loadedItems`;
- `currentPath`;
- `query`.

Outputs:

- `allItems`;
- `rawIndex`;
- `visibleIndex`;
- `currentEntries`;
- `currentFolder`.

Acceptance:

- inferred folder tests still pass;
- sort tests still pass;
- search tests still pass;
- lazy loading still sees the same `rawIndex` and `visibleIndex`.

### Phase 3: Extract Path History

Move history stack mechanics into `useFileSystemPathHistory`.

It should expose low-level path operations:

```ts
type FileSystemPathHistoryController = {
  canGoBack: boolean
  canGoForward: boolean
  currentPath: string
  goBackPath: () => string
  goForwardPath: () => string
  setCurrentPath: (path: string, options?: { replace?: boolean }) => string
}
```

The low-level hook should not clear search or selection. It returns the next
path. Higher-level navigation commands perform cross-slice side effects.

Acceptance:

- back and forward behavior is unchanged;
- `onPathChange` behavior is unchanged;
- controlled `path` behavior is unchanged.

### Phase 4: Extract Selection

Move selected path, selected entry, duplicate suppression, query-hidden clearing,
and child-selection cancellation into `useFileSystemSelectionController`.

This is the most delicate extraction.

Acceptance:

- duplicate selection emission test still passes;
- query hiding selected entry clears selection;
- lazy child auto-select tests still pass;
- stale async child-selection tests still pass.

### Phase 5: Compose Navigation From Slices

Create `useFileSystemNavigationController`.

Inputs:

- `pathHistory`;
- `query.setSearch`;
- `selection.selectEntry`;
- `selection.invalidateChildSelectionRequest`;
- `loading.ensureChildren`.

Outputs:

- `currentPath`;
- `canGoBack`;
- `canGoForward`;
- `navigateTo`;
- `goBack`;
- `goForward`.

This is where cross-slice intent belongs.

Acceptance:

- navigating folders clears search and selection;
- back/forward clears search and selection;
- child-selection requests are invalidated only when path changes;
- lazy ensure still starts on navigation.

### Phase 6: Replace Context Shape

Change `FileSystemContextValue` from:

```ts
controller: ReturnType<typeof useFileSystemController>
```

to:

```ts
index: FileSystemIndexState
loading: FileSystemLoadingController
navigation: FileSystemNavigationController
openFilePreview: FileSystemOpenFilePreviewController
query: FileSystemQueryController
renderers: FileSystemRenderers
selection: FileSystemSelectionController
source: FileSystemSourceController
title: string
view: FileSystemViewController
```

Then update named-part hooks.

Acceptance:

- no `controller` property in `FileSystemContextValue`;
- `useFileSystemHeader` does not reference source/loading/selection;
- `useFileSystemSelectedFile` does not reference navigation/query/loading/view;
- `useFileSystemOpenFileDialog` does not reference selected state.

### Phase 7: Narrow Pierre Inputs

Pierre adapters currently take `FileSystemExplorerController`.

That is acceptable, but still broad. The platonic target is to pass only the
state each adapter needs:

```ts
useFileSystemPierreModel({
  expansion,
  input,
  selection,
})
```

Do this only after provider slices are stable.

Acceptance:

- `file-system-pierre-expansion.ts` does not receive source resolution;
- `file-system-pierre-selection.ts` does not receive folder errors;
- `file-system-pierre-decoration.ts` receives index/query metadata only.

## Naming Rules

Use `Controller` only for objects with commands.

Good:

```ts
FileSystemQueryController
FileSystemNavigationController
FileSystemSelectionController
FileSystemSourceController
FileSystemViewController
```

Use `State` for derived read-only data.

Good:

```ts
FileSystemIndexState
FileSystemHeaderState
FileSystemSelectedFileState
```

Avoid:

```ts
FileSystemProviderController
FileSystemController
FileSystemExplorerState // if it mostly contains commands
```

Potential naming cleanup:

- `FileSystemExplorerState` -> `FileSystemExplorerPart`;
- `FileSystemSelectedFileState` -> keep, because it is read-oriented;
- `FileSystemPreviewController` -> `FileSystemSelectedFileController`;
- `FileSystemStatusController` -> `FileSystemStatusState`.

Do not rename for taste. Rename only when the old name lies.

## Tests

### Keep Existing Behavioral Tests

The current file-system tests already cover critical behavior:

- explicit viewer primitive tree;
- direct provider-part composition;
- open dialog;
- inferred folders;
- sort by size/date;
- selection preservation across views;
- controlled query;
- grid keyboard selection;
- lazy folder retry;
- Pierre expansion snapshots;
- stale async child-selection cancellation;
- large-list virtualization;
- same-path source cache invalidation.

All must continue passing.

### Add Architecture Tests

Add tests that enforce real slice boundaries:

```ts
it("keeps file-system provider context on named state slices", () => {
  const provider = fileContent(
    "registry/new-york-v4/ui/file-system-provider.tsx"
  )

  expect(provider).not.toContain("controller:")
  expect(provider).toContain("navigation:")
  expect(provider).toContain("selection:")
  expect(provider).toContain("source:")
})
```

Add tests for hook boundaries:

```ts
it("keeps file-system header away from preview and loading state", () => {
  const parts = fileContent("registry/new-york-v4/ui/file-system-parts.tsx")
  const header = extractFunction(parts, "useFileSystemHeader")

  expect(header).not.toContain("source")
  expect(header).not.toContain("loading")
  expect(header).not.toContain("openFilePreview")
})
```

String tests are acceptable here because the boundary is architectural. Keep
them narrow and direct.

### Add Slice Unit Tests

Where possible, test extracted hooks through behavior, not internals:

- query controller emits complete query state;
- view controller respects controlled/uncontrolled mode;
- path history preserves stack semantics;
- source controller clears cache on `items` identity change.

Do not overtest implementation ordering.

## Non-Goals

Do not touch viewer primitives.

Do not change `FileSystem` public composition.

Do not remove `FileSystemOpenFileDialog`.

Do not remove `file-system-light`.

Do not change Pierre rendering behavior.

Do not create compatibility aliases.

Do not introduce external state libraries.

Do not split state into React contexts per slice unless profiling proves context
rerenders are a real problem.

One provider context with named slices is enough.

## Expected End State

The final provider should read like a composition root:

```ts
export function FileSystemProvider(props: FileSystemProviderProps) {
  const query = useFileSystemQueryController(props)
  const view = useFileSystemViewController(props)
  const source = useFileSystemSourceController(props)
  const pathHistory = useFileSystemPathHistory(props)
  const loading = useFileSystemLoadingController(...)
  const index = useFileSystemIndexState(...)
  const selection = useFileSystemSelectionController(...)
  const navigation = useFileSystemNavigationController(...)
  const openFilePreview = useFileSystemOpenFilePreviewController(...)

  const value = React.useMemo(
    () => ({
      index,
      loading,
      navigation,
      openFilePreview,
      query,
      renderers,
      selection,
      source,
      title,
      view,
    }),
    [...]
  )

  return <FileSystemContext.Provider value={value}>{children}</FileSystemContext.Provider>
}
```

The provider should not feel clever. It should feel like the table of contents
for the file-system state machine.

## Final Judgment

This is the right next perfection pass if the goal is truly platonic design.

It will not change the visible component. It will change the reader's ability
to understand the component.

The risk is over-slicing. The solution is to extract only real state machines:

- query;
- view;
- path history;
- navigation intent;
- selection;
- loading;
- index;
- source.

When this is done correctly, `FileSystemProvider` stops being a wrapper around
a god controller and becomes the exact place where the file-system state model
is assembled.
