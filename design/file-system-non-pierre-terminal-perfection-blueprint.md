# File System Non-Pierre Terminal Perfection Blueprint

## Purpose

This blueprint defines the final non-Pierre pass for the file-system component.

The question is not whether the component works. It does. The question is whether the architecture feels inevitable:

```txt
simple
fast
complete
nothing extra
perfectly modular
precisely named
easy to read in one pass
```

The current answer is no.

The system is good, but a few boundaries are still wider than they need to be. This pass should remove that remaining width without touching `Viewer`, without redesigning Pierre, and without adding compatibility layers.

## Current Judgment

The file-system component has the right conceptual direction:

- `Viewer` is the layout primitive.
- `FileSystem` is the domain component.
- `FileViewer` renders resolved file sources.
- Pierre is an implementation detail of the list view.
- preview and open-preview are separate lifecycles.

The remaining imperfection is internal compression:

- header state is wider than the header needs;
- browser state still reads like a mixed bag of state and commands;
- browser views receive preview/source capabilities too casually;
- preview state still borrows selection language;
- provider state is modular, but not yet obvious in one glance.

This blueprint addresses those issues only.

## Non-Goals

Do not touch `registry/new-york-v4/ui/viewer.tsx`.

Do not redesign Pierre.

Do not introduce another provider.

Do not add compatibility aliases.

Do not preserve legacy names.

Do not reintroduce:

- `Explorer`;
- `SelectedFile`;
- `OpenFile`;
- `openedPreview`;
- `controller_`;
- view-specific controller types that duplicate the same browser contract.

Do not shrink real capabilities just to make the files smaller.

## Target Shape

The public composition should remain boring and exact:

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

The internal model should read as:

```txt
FileSystemProvider creates domain state.
FileSystemHeader receives only header state.
FileSystemBrowser receives browser state and file actions.
FileSystemPreview receives a preview entry and source resolver.
FileSystemOpenPreview owns explicit modal-open lifecycle.
Pierre remains private to list rendering.
```

## Issue 1: Header State Is Not Exact

### Problem

The header does not need the full browser product. It only needs:

- title;
- current path;
- navigation availability;
- navigation commands;
- query;
- query command;
- sort command;
- view;
- view command.

If the header can see entries, selection, raw indexes, folder loading, or preview commands, the type is too broad.

### Target Types

Create a dedicated projection:

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

### Implementation Notes

`useFileSystemHeader` should not construct state inline. It should call the projection:

```ts
export function useFileSystemHeader(): FileSystemHeaderState {
  const state = useFileSystem()

  return createFileSystemHeaderState({
    browser: state.browser,
    title: state.title,
  })
}
```

`FileSystemToolbar`, `FileSystemCommandBar`, `FileSystemSortControls`, and `FileSystemStatusBar` should accept only the state they actually use.

### Acceptance Criteria

- `FileSystemHeaderState` is not `FileSystemBrowserState & { title: string }`.
- header controls cannot access browser-only state by type.
- tests assert the header projection excludes entries, selection, raw indexes, loading, and preview commands.

## Issue 2: Browser Controller Mixes Browser And File Actions

### Problem

The browser controller currently carries both:

- browser navigation/selection/query/view state;
- file actions such as opening preview and resolving sources.

This makes every view feel like it receives one general-purpose power object.

That is not platonic. A view should reveal which capabilities it needs.

### Target Types

Split the controller into semantic bundles:

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

### View Usage

List view:

```ts
const { browser, fileActions } = controller
```

Grid and columns views:

```ts
const source = fileActions.resolveFileSource(file)
fileActions.openPreview(file)
```

No view should call:

```ts
controller.openPreview(...)
controller.resolveFileSource(...)
```

### Acceptance Criteria

- `FileSystemBrowserController` has no top-level `openPreview`.
- `FileSystemBrowserController` has no top-level `resolveFileSource`.
- all view files use `controller.fileActions`.
- tests or architecture scans reject top-level preview/source fields on the browser controller.

## Issue 3: Browser State Is Honest But Too Flat

### Problem

The browser product currently represents a real domain:

- path;
- visible entries;
- sorted index;
- raw index;
- query;
- view;
- selection;
- loading state;
- navigation state;
- commands.

That is legitimate surface area. The issue is shape, not existence.

When all of this lives in one flat record, the reader has to classify fields mentally.

### Target Type

Group by ownership:

```ts
export type FileSystemBrowserState = {
  currentPath: string
  entries: FileSystemEntry[]
  index: FileSystemIndex
  rawIndex: FileSystemIndex
  query: FileSystemQueryState
  view: FileSystemView
  loading: FileSystemBrowserLoadingState
  navigation: FileSystemBrowserNavigationState
  selection: FileSystemBrowserSelectionState
  commands: FileSystemBrowserCommands
}
```

Supporting types:

```ts
export type FileSystemBrowserLoadingState = {
  folderErrors: ReadonlyMap<string, string>
  loadingFolders: ReadonlySet<string>
}

export type FileSystemBrowserNavigationState = {
  canGoBack: boolean
  canGoForward: boolean
}

export type FileSystemBrowserSelectionState = {
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
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

### Naming Rule

Use the same noun everywhere:

```txt
selection.selectedEntry
selection.selectedPath
loading.loadingFolders
loading.folderErrors
navigation.canGoBack
navigation.canGoForward
commands.navigateTo
commands.selectEntry
```

Do not create parallel names such as:

```txt
activeEntry
currentEntry
focusedPath
chosenPath
loadState
navState
actions
api
```

The system should have one word for each concept.

### Acceptance Criteria

- `FileSystemBrowserState` is no longer a flat state/command bag.
- call sites remain readable after grouping.
- if grouping makes a view meaningfully noisier, extract a local exact view model instead of flattening the browser again.

## Issue 4: Pierre Is Delegated

Pierre is intentionally out of scope for this pass.

The only requirement here is to keep the boundary stable:

```txt
FileSystemListView owns the list renderer boundary.
Pierre-specific code stays private to that boundary.
No public file-system type should expose Pierre vocabulary.
```

If this pass needs a list model, keep it private:

```txt
file-system-list-model.ts
```

or, if maintainers need explicitness:

```txt
file-system-pierre-list-model.ts
```

Do not solve the Pierre state machine in this blueprint.

## Issue 5: Preview State Uses Selection Language

### Problem

Selection belongs to the browser.

Preview consumes a selected entry, but the preview product itself should not speak browser language. `selectedEntry` in preview state creates a subtle leak.

### Target Type

Rename the preview product:

```ts
export type FileSystemPreviewState = {
  entry: FileSystemEntry | null
  resolveSource: FileSystemSourceController["resolveFileSource"]
}
```

Then the component reads naturally:

```tsx
const { entry, resolveSource } = useFileSystemPreview()

return (
  <FileSystemPreviewPanel
    entry={entry}
    resolveFileSource={resolveSource}
  />
)
```

### Lifecycle Rule

Do not merge preview source resolution with open-preview source resolution.

They are different:

- selected preview follows browser selection;
- open preview follows an explicit modal command and must guard stale opens.

The shared dependency is the source resolver, not the lifecycle.

### Acceptance Criteria

- browser state uses `selection.selectedEntry`.
- preview state uses `entry`.
- preview state uses `resolveSource`.
- rendering adapters may still pass `resolveFileSource` to existing lower-level components if that prop is already named for file rendering.

## Issue 6: Provider State Should Read As Product State

### Problem

The provider has become modular, but it still coordinates many slices:

- manifest normalization;
- path;
- query;
- sort;
- view;
- selection;
- lazy loading;
- source resolution;
- selected preview;
- open-preview modal;
- render extension points.

This is real domain surface. It should not be hidden. But the final provider should read like assembly, not orchestration.

### Target Context Shape

The context should expose only product-level nouns:

```ts
export type FileSystemContextValue = {
  browser: FileSystemBrowserState
  openPreview: FileSystemOpenPreviewState
  preview: FileSystemPreviewState
  renderers: FileSystemRendererState
  title: string
}
```

No raw controller internals should leak through context.

### Provider Assembly Order

The provider should assemble in this order:

```txt
1. normalize manifest input
2. create controlled browser slices
3. create lazy loading controller
4. create source controller
5. create selected-preview projection
6. create open-preview lifecycle
7. create browser product
8. create context value
```

Each step should produce a named product.

Avoid unnamed inline objects where they hide concepts.

### Acceptance Criteria

- provider reads top-to-bottom as assembly;
- context value has no duplicated state;
- no child component reaches for provider internals that are not in the context contract;
- tests assert the context shape is limited to `browser`, `openPreview`, `preview`, `renderers`, and `title`.

## Implementation Plan

1. Add exact `FileSystemHeaderState` and `createFileSystemHeaderState`.
2. Update `useFileSystemHeader` and header controls to consume the exact projection.
3. Split browser controller top-level file capabilities into `fileActions`.
4. Group `FileSystemBrowserState` into `loading`, `navigation`, `selection`, and `commands`.
5. Update list, grid, columns, controls, preview, tests, and docs to use grouped browser state.
6. Rename preview state to `entry` and `resolveSource`.
7. Audit provider context and architecture tests.
8. Rebuild registry.

## Test Plan

Run targeted tests:

```bash
bunx vitest run tests/file-system.test.tsx tests/viewer-architecture.test.ts tests/file-system-pierre-input.test.ts tests/file-system-pierre-lifecycle.test.ts
```

Run type checks:

```bash
bunx tsc --noEmit --pretty false
```

Rebuild registry:

```bash
bun run registry:build
```

Run stale vocabulary scans:

```bash
rg "SelectedFile|useFileSystemSelectedFile|ExplorerPart|FileSystemExplorerState|openedPreview|closePreview|controller\\.(openPreview|resolveFileSource)" registry/new-york-v4 content tests registry.json public/r
```

```bash
rg "FileSystem(OpenPreviewDialog|Explorer|SelectedFile)|useFileSystem(OpenPreviewDialog|Explorer|SelectedFile)|file-system-explorer-controllers|FileSystem(ListViewController|GridViewController|ColumnsViewController|StatusState)" registry/new-york-v4 content tests registry.json public/r
```

Run exactness scans:

```bash
rg "FileSystemHeaderState = FileSystemBrowserState|selectedEntry: FileSystemEntry \\| null" registry/new-york-v4/ui/file-system-*.ts registry/new-york-v4/ui/file-system-*.tsx tests
```

Review every match manually. Some `selectedEntry` matches are correct inside browser selection. They are wrong inside preview state.

## Required Tests

Add or update architecture tests for:

- header state is exact;
- preview state uses `entry`;
- browser controller exposes `fileActions`;
- browser state has `loading`, `navigation`, `selection`, and `commands`;
- context shape remains limited.

Add or update behavior tests for:

- controlled path;
- controlled query;
- controlled view;
- controlled selection;
- opening a file from each browser view;
- selected preview still resolves source;
- modal preview still guards stale source resolution.

## Documentation Updates

Update `content/docs/components/file-system.mdx` so the API is grouped by ownership:

```txt
manifest input
browser state
selection control
query and sorting
source resolution
render extension points
open-preview events
```

The docs should not expose implementation vocabulary:

- no Pierre;
- no internal controller names;
- no provider slice mechanics.

## Done Definition

This pass is complete when the code reads as:

```txt
Header sees header state.
Browser views see browser state and file actions.
Preview sees an entry and a source resolver.
Open preview owns modal lifecycle.
Provider assembles named products.
Viewer remains untouched.
Pierre remains private.
```

The system is not perfect because it has fewer files. It is perfect when every file has exactly one reason to exist, every exported type names one concept, and no component receives a capability it cannot justify.

