# File System Post Compression Perfection Blueprint

## Purpose

This blueprint captures the remaining gap after the domain compression pass.

The system is now good:

- `Viewer` remains the layout primitive.
- `FileSystem` owns the file-system domain.
- `FileViewer` renders resolved sources.
- provider state reads as `browser`, `preview`, `openPreview`, `renderers`, `title`.
- list, grid, and columns share one browser controller.
- open-preview is a typed lifecycle.
- old `Explorer` / `SelectedFile` vocabulary is gone.

It is not perfect.

The remaining work is internal compression. Do not reopen the public grammar unless the implementation proves a name is wrong.

## Current Judgment

No, the system is not perfect yet.

It is structurally good: `Viewer`, `FileSystem`, `FileViewer`, preview, open-preview, browser views, and Pierre now have mostly correct ownership. The remaining imperfection is not the high-level idea. The remaining imperfection is that some internal surfaces still require too much local memory from the reader.

The gap is concentrated in four places:

- state projections are wider than their consumers need;
- controller names do not always reveal whether they are browser state or file actions;
- the browser state product is honest but still reads like a large bag;
- docs and tests do not yet prove the controlled-state API as a coherent product surface.

This blueprint is the final compression pass before calling the file-system component "near platonic." It should not add product behavior. It should make the existing behavior feel inevitable.

## Platonic Target

The final system should read like this:

```txt
FileSystemProvider creates product state.
FileSystemHeader reads only header state.
FileSystemBrowser renders the active browser view.
FileSystemPreview renders selected-entry preview.
FileSystemOpenPreview renders the modal lifecycle.
Viewer supplies layout only.
Pierre is private to the list renderer.
```

The public composition should remain:

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

The final pass should make the internals feel as inevitable as this public shape.

## Non-Goals

Do not touch `Viewer`.

Do not introduce compatibility aliases.

Do not add another provider.

Do not reintroduce `Explorer`, `SelectedFile`, `OpenFile`, or `openedPreview` naming.

Do not make Pierre public.

Do not remove real file-system capabilities merely to shrink the code.

## Issue 1: Header State Is Too Wide

### Current Problem

`FileSystemHeaderState` is currently:

```ts
export type FileSystemHeaderState = FileSystemBrowserState & {
  title: string
}
```

This works, but it is not exact. The header does not need:

- `entries`;
- `index`;
- `rawIndex`;
- `selectedEntry`;
- `selectedPath`;
- `ensureChildren`;
- `folderErrors`;
- `loadingFolders`;
- `navigateTo`;
- `selectEntry`;
- `selectFirstChildAfterEnsure`.

The header only needs navigation, query, sort, view, and title.

### Target

Create an exact header projection:

```ts
export type FileSystemHeaderState = {
  canGoBack: boolean
  canGoForward: boolean
  currentPath: string
  goBack: () => void
  goForward: () => void
  query: FileSystemQueryState
  setSearch: (search: string) => void
  setSortKey: (key: FileSystemSortKey) => void
  setView: (view: FileSystemView) => void
  title: string
  view: FileSystemView
}
```

Add a pure projection:

```ts
export function createFileSystemHeaderState({
  browser,
  title,
}: {
  browser: FileSystemBrowserState
  title: string
}): FileSystemHeaderState
```

`useFileSystemHeader` should become:

```ts
export function useFileSystemHeader(): FileSystemHeaderState {
  const state = useFileSystem()

  return createFileSystemHeaderState({
    browser: state.browser,
    title: state.title,
  })
}
```

### Acceptance Criteria

- `FileSystemHeaderState` is no longer an intersection with `FileSystemBrowserState`.
- `FileSystemToolbar` and `FileSystemCommandBar` accept exact header state.
- Tests assert the header state does not include browser-only concepts.

## Issue 2: Browser Controller Still Carries Preview Capability Everywhere

### Current Problem

`FileSystemBrowserController` currently exposes:

```ts
export type FileSystemBrowserController = {
  browser: FileSystemBrowserState
  openPreview: FileSystemOpenPreviewCommand
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
}
```

This is pragmatic, but too broad. Every browser view receives source resolution and open-preview, even if a particular view only needs browsing commands.

The system should distinguish:

- browser state;
- file opening;
- thumbnail source resolution.

### Target

Split the browser controller into exact capability bundles:

```ts
export type FileSystemBrowserController = {
  browser: FileSystemBrowserState
  fileActions: FileSystemFileActionController
}

export type FileSystemFileActionController = {
  openPreview: (file: FileSystemFileEntry) => void
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
}
```

Then views use:

```ts
controller.browser
controller.fileActions.openPreview
controller.fileActions.resolveFileSource
```

This does not reduce runtime code much. It reduces conceptual leakage.

### Optional Further Compression

If the view APIs become clearer, pass exact capabilities by view:

```ts
type FileSystemListViewProps = {
  browser: FileSystemBrowserState
  openPreview: (file: FileSystemFileEntry) => void
}

type FileSystemGridViewProps = {
  browser: FileSystemBrowserState
  fileActions: FileSystemFileActionController
}

type FileSystemColumnsViewProps = {
  browser: FileSystemBrowserState
  fileActions: FileSystemFileActionController
}
```

Only do this if the call sites become simpler. The goal is exactness, not prop spreading.

### Acceptance Criteria

- `resolveFileSource` is no longer a top-level field of `FileSystemBrowserController`.
- view files make it obvious when they need file actions.
- tests assert list/grid/columns do not receive a shapeless controller with every capability at top level.

## Issue 3: `FileSystemBrowserState` Is Honest But Large

### Current Problem

`FileSystemBrowserState` is the right domain product, but it is still a large record:

```txt
path
entries
indexes
selection
query
view
loading
navigation commands
selection commands
loading commands
query commands
view commands
```

The type is honest, but not effortless.

### Target

Keep one `browser` product, but group it into semantic subrecords:

```ts
export type FileSystemBrowserState = {
  currentPath: string
  entries: FileSystemEntry[]
  index: FileSystemIndex
  rawIndex: FileSystemIndex
  query: FileSystemQueryState
  view: FileSystemView
  selection: FileSystemBrowserSelectionState
  loading: FileSystemBrowserLoadingState
  navigation: FileSystemBrowserNavigationState
  commands: FileSystemBrowserCommands
}
```

Where:

```ts
export type FileSystemBrowserSelectionState = {
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
}

export type FileSystemBrowserLoadingState = {
  folderErrors: ReadonlyMap<string, string>
  loadingFolders: ReadonlySet<string>
}

export type FileSystemBrowserNavigationState = {
  canGoBack: boolean
  canGoForward: boolean
}

export type FileSystemBrowserCommands = {
  ensureChildren: FileSystemLoadingController["ensureChildren"]
  goBack: () => void
  goForward: () => void
  navigateTo: (path: string) => void
  selectEntry: (entry: FileSystemEntry | null) => void
  selectFirstChildAfterEnsure: (
    path: string
  ) => Promise<FileSystemEntry | null>
  setSearch: (search: string) => void
  setSortKey: (key: FileSystemSortKey) => void
  setView: (view: FileSystemView) => void
}
```

This is not adding a new abstraction. It is giving the existing product a readable shape.

### Migration Notes

Old:

```ts
browser.selectedEntry
browser.navigateTo(path)
browser.loadingFolders
browser.setSearch(search)
```

New:

```ts
browser.selection.selectedEntry
browser.commands.navigateTo(path)
browser.loading.loadingFolders
browser.commands.setSearch(search)
```

This is slightly longer, but the ownership becomes exact.

Only make this change if it improves reader comprehension in the actual files. If it makes list/grid/columns noisy, stop at Issue 1 and Issue 2.

### Acceptance Criteria

- `FileSystemBrowserState` no longer reads as a flat bag of state and commands.
- browser call sites remain readable.
- no duplicate path exists for the same state.

## Issue 4: Pierre Is Contained But Not Effortless

### Current Problem

`FileSystemListView` still coordinates:

- Pierre adapter creation;
- decoration version;
- Pierre input;
- Pierre model;
- row open mapping;
- double-click event path extraction;
- keyboard open behavior.

Pierre is private to the list boundary, but the list boundary is still mentally heavy.

### Target

Create one private list adapter hook:

```ts
function useFileSystemListModel({
  browser,
  openPreview,
}: {
  browser: FileSystemBrowserState
  openPreview: (file: FileSystemFileEntry) => void
}) {
  return {
    hasRows,
    model,
    onDoubleClick,
    onKeyDown,
  }
}
```

Then `FileSystemListView` becomes:

```tsx
export function FileSystemListView({ controller }: Props) {
  const list = useFileSystemListModel({
    browser: controller.browser,
    openPreview: controller.fileActions.openPreview,
  })

  if (!list.hasRows) {
    return <FileSystemEmptyRows label="This folder is empty" />
  }

  return (
    <PierreFileTree
      aria-label="Files"
      className="block size-full min-h-0"
      data-slot="file-system-pierre-tree"
      model={list.model}
      onDoubleClick={list.onDoubleClick}
      onKeyDown={list.onKeyDown}
    />
  )
}
```

The hook may live in:

```txt
file-system-list-model.ts
```

or:

```txt
file-system-pierre-list-model.ts
```

Prefer `file-system-list-model.ts` if the list view should not advertise Pierre in its public-looking filename. Prefer `file-system-pierre-list-model.ts` if the team wants the implementation detail visible to maintainers.

### Acceptance Criteria

- `FileSystemListView` reads as render glue.
- Pierre-specific setup lives behind one private hook.
- `FileSystemListView` still imports Pierre only if it renders `PierreFileTree`; all model policy moves out.

## Issue 5: Preview State And Source Resolution Are Still Coupled Loosely

### Current Problem

`FileSystemPreviewState` is:

```ts
export type FileSystemPreviewState = {
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
  selectedEntry: FileSystemEntry | null
}
```

This is accurate but thin. The preview renderer owns the loading/error/source lifecycle locally.

That is acceptable, but it means there are two source-resolution lifecycles:

- selected preview source lifecycle inside `FileSystemPreviewPanel`;
- open-preview source lifecycle inside `useFileSystemOpenPreviewController`.

They are not wrong, but the distinction should be intentional.

### Target

Do not merge the lifecycles. They differ:

- selected preview follows selection and retries inline;
- open-preview follows an explicit user command and must protect against stale modal opens.

But make the naming explicit:

```ts
export type FileSystemPreviewState = {
  entry: FileSystemEntry | null
  resolveSource: FileSystemSourceController["resolveFileSource"]
}
```

Then `FileSystemPreview` reads:

```tsx
const { entry, resolveSource } = useFileSystemPreview()

return (
  <FileSystemPreviewPanel
    entry={entry}
    resolveFileSource={resolveSource}
    ...
  />
)
```

This removes the awkward `selectedEntry` naming from the preview product. Selection is browser language; preview language is `entry`.

### Acceptance Criteria

- `FileSystemPreviewState` uses `entry`, not `selectedEntry`.
- browser selection remains named `selectedEntry`.
- no ambiguity between selection state and preview input.

## Issue 6: Controlled State Surface Needs One Final Audit

### Current Problem

`FileSystemProps` includes:

- `defaultPath`;
- `path`;
- `onPathChange`;
- `defaultView`;
- `view`;
- `onViewChange`;
- `defaultQuery`;
- `query`;
- `onQueryChange`;
- `selectedPath`;
- `defaultSelectedPath`;
- `onSelectionChange`;
- `loadChildren`;
- `resolveSource`;
- `onFileOpen`;
- `renderFileActions`;
- `renderMetadata`.

This is a real API, but it is dense.

### Target

Audit every prop against this rule:

```txt
Is this a durable public concept users must control?
```

Likely keep:

- `items`;
- `title`;
- `className`;
- path controlled/uncontrolled props;
- view controlled/uncontrolled props;
- query controlled/uncontrolled props;
- selection controlled/uncontrolled props;
- `loadChildren`;
- `resolveSource`;
- `onFileOpen`;
- `renderFileActions`;
- `renderMetadata`.

But document why each exists. The final API reference should not merely list props; it should clarify ownership:

```txt
manifest input
browser state
source resolution
extension renderers
open events
```

### Acceptance Criteria

- docs group props by ownership.
- tests cover at least one controlled path, query, view, and selection flow.
- no prop exists only because an implementation detail needs it.

## Implementation Order

1. Add exact `FileSystemHeaderState` projection.
2. Rename preview state fields from `selectedEntry` / `resolveFileSource` to `entry` / `resolveSource`.
3. Split `FileSystemBrowserController` into `browser` plus `fileActions`.
4. Decide whether to group `FileSystemBrowserState` into subrecords.
5. Extract `useFileSystemListModel` to make list view render-only.
6. Update docs API grouping.
7. Update architecture tests and behavior tests.
8. Rebuild registry.

## Test Plan

Run:

```bash
bunx vitest run tests/file-system.test.tsx tests/viewer-architecture.test.ts tests/file-system-pierre-input.test.ts tests/file-system-pierre-lifecycle.test.ts
bunx tsc --noEmit --pretty false
bun run registry:build
```

Stale scans:

```bash
rg "SelectedFile|useFileSystemSelectedFile|ExplorerPart|FileSystemExplorerState|openedPreview|closePreview|openPreview: \\(file|controller_" registry/new-york-v4 content tests registry.json public/r
rg "FileSystem(OpenPreviewDialog|Explorer|SelectedFile)|useFileSystem(OpenPreviewDialog|Explorer|SelectedFile)|file-system-explorer-controllers|FileSystem(ListViewController|GridViewController|ColumnsViewController|StatusState)" registry/new-york-v4 content tests registry.json public/r
```

Additional architecture assertions:

- header state is exact, not `FileSystemBrowserState & { title }`;
- preview state uses `entry`, not `selectedEntry`;
- browser controller exposes `fileActions`, not top-level `resolveFileSource`;
- list view delegates Pierre model setup to one private hook;
- provider context still exposes only `browser`, `preview`, `openPreview`, `renderers`, `title`.

## Final Judgment

After this pass, the system can plausibly be called near-platonic.

The standard is not fewer files. The standard is that every public and private name answers one question:

```txt
What owns this behavior?
```

If the answer is obvious from the name and no adjacent module can do the same job, the component is close to perfect.
