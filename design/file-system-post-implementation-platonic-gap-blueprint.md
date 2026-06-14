# File System Post-Implementation Platonic Gap Blueprint

## Purpose

This document audits the current Pierre-native `FileSystem` implementation after the first real implementation pass.

Implementation decision: `file-system-light` remains in the registry. The original proposal to remove or rename it is superseded by the active product decision to keep `file-system-light`.

The implementation is materially better than the previous design:

- `FileSystem` owns the file-system domain.
- Viewer primitives own only spatial layout.
- Pierre owns the native tree runtime.
- `FileSystemExplorer` replaced the narrower `FileSystemTree` name.
- The fake list-table header is gone.
- The React list view no longer constructs `new FileTree(...)` during render.

But it is not the platonic ideal yet.

Platonic ideal here means:

- simple;
- fast;
- complete;
- nothing speculative;
- no duplicate conceptual paths;
- perfect module boundaries;
- precise names;
- no hidden compatibility layer;
- no clever lifecycle workaround leaking into public architecture;
- code that feels inevitable when read.

The current implementation is good. The adapter layer is not yet inevitable.

## Current Shape

The relevant implementation now lives in:

- `registry/new-york-v4/ui/file-system.tsx`
- `registry/new-york-v4/ui/file-system-controls.tsx`
- `registry/new-york-v4/ui/file-system-list-view.tsx`
- `registry/new-york-v4/ui/file-system-pierre-input.ts`
- `registry/new-york-v4/ui/file-system-pierre-model.ts`
- `registry/new-york-v4/ui/file-system-pierre-decoration.ts`
- `registry/new-york-v4/ui/file-system-controller.ts`
- `registry/new-york-v4/ui/file-system-query.ts`

The current public composition is basically right:

```tsx
<FileSystemProvider items={items}>
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
    <FileSystemOpenDialog />
  </ViewerRoot>
</FileSystemProvider>
```

This is the correct ownership direction. The file-system domain composes viewer primitives. Viewer primitives know nothing about files.

## Judgment

We have not reached the platonic ideal.

We have reached a good local optimum:

- the public API is much closer;
- the old `FileSystemViewer*` coupling is gone;
- the list is Pierre-native;
- the obvious broken UI state is fixed;
- the implementation is tested.

The remaining problem is that the adapter between Retab file-system state and Pierre tree state is too busy. It contains real complexity, but the complexity is not yet perfectly named, partitioned, or owned.

The next iteration should not rewrite the viewer primitive. It should refine the file-system domain layer.

## What Is Wrong

### 1. `file-system-pierre-model.ts` Owns Too Many Concepts

Current responsibilities:

- creates the Pierre model with `useFileTree`;
- syncs selection from Retab state into Pierre;
- syncs Pierre selection back into Retab state;
- tracks current input identity;
- stores expansion snapshots by current folder;
- decides how expansion behaves during query mode;
- updates a mutable order ref so Pierre sorting follows Retab order;
- handles lazy folder retry expansion;
- renders row decoration by calling back into file-system state;
- knows about loading folders and folder errors indirectly through decoration revision;
- scrolls selected paths into view after reset.

That is too much for one hook.

The code is defensible, but it is not beautiful. A reader has to simulate the interaction between reset identity, expansion snapshots, search/filter mode, ordering, selection, and lazy retry. That is the opposite of platonic clarity.

#### Fix

Split `file-system-pierre-model.ts` into four focused modules:

```txt
file-system-pierre-model.ts
file-system-pierre-selection.ts
file-system-pierre-expansion.ts
file-system-pierre-order.ts
```

Target ownership:

`file-system-pierre-model.ts`

- calls `useFileTree`;
- wires Pierre options;
- coordinates the small hooks;
- exports `useFileSystemPierreModel`.

`file-system-pierre-selection.ts`

- owns `selectedPathToPierrePath`;
- owns Retab -> Pierre selection sync;
- owns Pierre -> Retab selection callback helpers;
- owns scroll-to-selected behavior.

`file-system-pierre-expansion.ts`

- owns current-folder expansion snapshots;
- owns query expansion behavior;
- owns retry expansion after failed lazy folder loads;
- owns `collectOpenPierrePaths`, `collectDirectoryPierrePaths`, and snapshot policy.

`file-system-pierre-order.ts`

- owns mutable Pierre sort order;
- owns `createPierreInputOrder`;
- owns `comparePierreInputOrder`;
- exports a tiny hook like `usePierreInputOrder(paths)`.

The model hook should read like:

```tsx
const order = useFileSystemPierreOrder(input.paths)
const selection = useFileSystemPierreSelection({ controller, input, model })
const expansion = useFileSystemPierreExpansion({ controller, input, model })

const { model } = useFileTree({
  preparedInput: input.preparedInput,
  sort: order.compare,
  onSelectionChange: selection.handlePierreSelectionChange,
  renderRowDecoration,
})

useResetFileSystemPierreModel({
  input,
  model,
  order,
  expansion,
  selection,
})
```

The exact shape may differ, but the principle should not: one module per lifecycle concern.

### 2. `revision` Is a String Hack

`FileSystemListView` builds `decorationRevision` from:

- `controller.loadingFolders`;
- `controller.folderErrors`.

It passes that into `buildFileSystemPierreInput` as `revision`, even though the Pierre input paths have not changed.

This works because Pierre does not expose a decoration-only invalidation path. But the current design smuggles row metadata invalidation into the input identity. That is not conceptually clean.

The problem is not that the string exists. The problem is that its name and location imply file input changed, when actually row decoration state changed.

#### Fix

Rename the concept and separate it from path input.

Current:

```ts
buildFileSystemPierreInput({
  currentPath,
  index,
  revision: decorationRevision,
})
```

Target:

```ts
const input = useFileSystemPierreInput({
  currentPath: controller.currentPath,
  index: controller.index,
})

const decorationVersion = useFileSystemPierreDecorationVersion({
  folderErrors: controller.folderErrors,
  loadingFolders: controller.loadingFolders,
})
```

Then reset identity becomes explicit:

```ts
type PierreResetIdentity = {
  currentPath: string
  hasQuery: boolean
  input: FileSystemPierreInput
  decorationVersion: string
}
```

Better still, if Pierre exposes a row decoration invalidation API later, only this module changes.

Do not hide decoration invalidation inside `FileSystemPierreInput`.

### 3. The Input Builder Is Doing Path Traversal And Prepared Input Construction Together

`buildFileSystemPierreInput` currently:

- walks the visible file-system index;
- converts Retab paths to Pierre paths;
- builds `pathEntries`;
- builds `paths`;
- creates `preparedInput`.

This is acceptable, but the best version would have a clearer staged pipeline:

```txt
visible FileSystemIndex
  -> FileSystemPierrePaths
  -> FileSystemPierreEntryMap
  -> FileTreePreparedInput
```

The current function is small enough to survive, but it is already hiding two important rules:

- Retab folder paths are trailing-slash paths.
- Pierre paths are current-folder-relative paths.

Those path semantics are important enough to name more strongly.

#### Fix

Refine `file-system-pierre-input.ts` around explicit types:

```ts
type FileSystemPath = string
type PierrePath = string

type FileSystemPierreInput = {
  entriesByPierrePath: Map<PierrePath, FileSystemEntry>
  pierrePaths: PierrePath[]
  preparedInput: FileTreePreparedInput
}
```

Rename:

```ts
toPierrePath -> fileSystemPathToPierrePath
fromPierrePath -> pierrePathToFileSystemEntry
pathEntries -> entriesByPierrePath
paths -> pierrePaths
```

The names are longer, but the code becomes harder to misunderstand.

This is one place where short names are not better. `paths` is too generic because the code has at least three path domains:

- source file-system paths;
- current-folder-relative Pierre paths;
- selected file paths.

### 4. Sort Controls Live In The Filter Bar

The fake list header was wrong. Removing it was correct.

But moving sort buttons into `FileSystemFilterBar` is only a partial improvement. Sort is not a filter.

The current bar combines:

- category filters;
- modified-date filters;
- sort controls;
- clear filters.

This works visually, but semantically it is muddy.

#### Fix

Replace `FileSystemFilterBar` with a more accurate control split:

```tsx
export function FileSystemControls({ controller }: { controller: FileSystemController }) {
  return (
    <div data-slot="file-system-controls">
      <FileSystemFilterControls controller={controller} />
      <FileSystemSortControls controller={controller} />
    </div>
  )
}
```

Or, if a single row is desired:

```tsx
export function FileSystemCommandBar({ controller }: { controller: FileSystemController }) {
  return (
    <div>
      <FileSystemFilterGroup controller={controller} />
      <FileSystemSortGroup controller={controller} />
      <FileSystemClearFiltersButton controller={controller} />
    </div>
  )
}
```

Naming target:

- `FileSystemToolbar`: navigation, title, view mode, search.
- `FileSystemCommandBar`: filters and sort.
- `FileSystemStatusBar`: counts and selection status.

Avoid calling sort a filter.

### 5. The Provider Exposes A Large Controller Object Everywhere

The current context value exposes:

```ts
controller: ReturnType<typeof useFileSystemController>
```

Then every named part pulls from that controller.

This is simple and flexible, but it is not perfectly modular. The controller becomes a god object. Any part can reach any capability.

The narrow hooks hide this somewhat:

- `useFileSystemHeader`
- `useFileSystemExplorer`
- `useFileSystemSelectedFile`
- `useFileSystemOpenDialog`

But each hook still returns a controller blob.

#### Fix

Do not immediately split the controller implementation. First split the hook return surfaces.

Current:

```ts
export function useFileSystemHeader() {
  const { controller, title } = useFileSystem()
  return { controller, title }
}
```

Target:

```ts
export function useFileSystemHeader() {
  const { controller, title } = useFileSystem()
  return {
    canGoBack: controller.canGoBack,
    canGoForward: controller.canGoForward,
    categories: controller.categories,
    currentPath: controller.currentPath,
    query: controller.query,
    title,
    view: controller.view,
    clearFilters: controller.clearFilters,
    goBack: controller.goBack,
    goForward: controller.goForward,
    setModifiedAfter: controller.setModifiedAfter,
    setSearch: controller.setSearch,
    setSortKey: controller.setSortKey,
    setView: controller.setView,
    toggleCategory: controller.toggleCategory,
  }
}
```

This is more verbose, but it documents the contract of the part. The part no longer sees file opening, source resolution, lazy child selection, etc.

Do the same for:

- `useFileSystemExplorer`;
- `useFileSystemSelectedFile`;
- `useFileSystemOpenDialog`.

The controller can remain internally whole for now. The public part contracts should become narrow.

### 6. `FileSystem` Has Too Many Props Forwarded Manually

`FileSystem` repeats every provider prop manually:

```tsx
<FileSystemProvider
  items={items}
  defaultPath={defaultPath}
  defaultQuery={defaultQuery}
  ...
>
```

This is not wrong, but it is low-entropy code. It creates a wide maintenance surface.

#### Fix

Use an explicit rest split:

```tsx
export function FileSystem({ className, ...providerProps }: FileSystemProps) {
  return (
    <FileSystemProvider {...providerProps}>
      ...
    </FileSystemProvider>
  )
}
```

This is acceptable because `FileSystemProviderProps` is already `Omit<FileSystemProps, "className"> & { children }`.

Do not do this everywhere blindly. Here it is correct because the easy API exists only to add default composition around the provider.

### 7. `FileSystemOpenDialog` Is A Second Viewer Mode Hidden Inside The File System

The built-in open dialog is convenient:

- double-click opens file;
- if no `onFileOpen` is provided, the component owns the dialog.

But architecturally it means `FileSystem` contains two viewer surfaces:

- selected file preview in `ViewerSurface`;
- opened file dialog using `FileViewer`.

This is feature-complete, but not conceptually crisp.

The question is: is “open file in modal” part of file-system, or a demo behavior?

If it is part of file-system, it needs to be first-class. If it is demo behavior, it should move out.

#### Fix

Decide one of two paths.

Path A: Modal open is first-class.

Then name it as such:

```tsx
<FileSystemOpenFileDialog />
```

State:

```ts
openedFile -> openedFilePreview
openFile -> openFilePreview
setOpenedFile -> setOpenedFilePreview
```

Path B: Modal open is demo composition.

Then remove dialog state from `FileSystemProvider` and expose:

```ts
onFileOpen?: (file, source) => void
```

The docs show users how to compose their own modal.

For a component library, Path A is probably better because it makes the easy API genuinely useful. But the naming must say what it is.

### 8. The Easy API Chooses A Narrow Sidebar Width That May Not Match The Goal

Current easy API:

```tsx
<ViewerSidebar
  aria-label="Files"
  width="min(22rem, 85vw)"
  className="flex min-w-0 flex-col border-r"
>
```

This is reasonable for a native explorer with preview surface. But it is no longer the earlier split ratio. That means the easy API has made a product decision:

- sidebar is the browser;
- surface is preview;
- browser gets fixed-ish width;
- preview gets the rest.

That is probably right, but it should be explicit.

#### Fix

Document this as the canonical easy API:

- `FileSystem` is a browser-plus-preview layout.
- `FileSystemProvider` parts let users build split-heavy or browser-dominant layouts.
- The easy API is not the only layout.

Tests should enforce:

```ts
expect(sidebarTag).toContain('width="min(22rem, 85vw)"')
```

Only if we are certain. If not certain, remove that architecture test and let visual tests cover it.

### 9. Search Is Still Controller-Filtered, Not Pierre Search

Current search behavior appears to filter the `FileSystemIndex` before Pierre receives paths.

This is defensible because file-system search is not just Pierre label search:

- category filters;
- date filters;
- possible metadata filters;
- lazy folders;
- inferred folders;
- selected-path visibility.

But Pierre has search capabilities, and the current model passes:

```ts
search: false
```

That means the component is Pierre-native for tree rendering, but not Pierre-native for search.

This may be correct. But it needs an explicit contract.

#### Fix

Document and encode this rule:

- Retab controller owns semantic filtering.
- Pierre owns rendering, expansion, virtualization, selection UI.
- Pierre search is disabled because Retab search filters the data source, not just labels.

Rename helpers accordingly:

```ts
hasQuery -> hasSemanticQuery
```

This matters because “query” is not Pierre search. It is file-system semantic filtering.

### 10. `file-system-light` Is Kept Out Of This Pass

There is also:

- `registry/new-york-v4/ui/file-system-light.tsx`

It imports Pierre and viewer primitives directly.

The active product decision is to keep it. That means this pass should not rename it, remove it, or use it as evidence against the main `FileSystem` architecture.

#### Fix

No code change for `file-system-light` in this pass. Keep the main `FileSystem` refactor self-contained.

### 11. Row Decoration Is Too Constrained By CSS Tricks

`file-system-pierre-decoration.ts` uses a row decoration string and CSS:

```css
[data-item-section='decoration'] > span::before {
  content: attr(title);
}
```

This is clever. It makes a two-column metadata layout out of Pierre's single decoration surface.

It works, but it is a smell:

- CSS uses `title` as display content.
- The semantic title attribute becomes layout data.
- The row metadata is constrained by Pierre's decoration API.

#### Fix

Short term:

Rename fields conceptually in code:

```ts
type FileSystemPierreRowMeta = {
  kindLabel: string
  detailLabel: string
}
```

Then adapt to Pierre:

```ts
return {
  title: meta.kindLabel,
  text: meta.detailLabel,
}
```

This makes the hack local and named.

Long term:

If Pierre allows richer row composition, replace this with a proper row metadata slot.

Do not let the CSS trick become the domain model.

### 12. Tests Are Strong But Too Architecture-String Heavy

The tests currently protect the intended architecture by checking source strings:

- function exports;
- absence of `SortHeader`;
- presence of `useFileTree`;
- presence of `preparePresortedFileTreeInput`;
- canonical composition order.

This is useful during churn, but not ideal long term. String tests can become brittle and can validate the spelling of an architecture more than the behavior.

#### Fix

Keep a small number of architecture tests, but shift the stronger proof to behavior:

Behavior tests to keep or add:

- list rows render under the fixed sidebar layout;
- sorting updates visible order without remounting Pierre model;
- expansion survives decoration changes;
- expansion survives search clear;
- lazy folder retry expands after successful retry;
- selected file preview updates without opening modal;
- double-click opens modal only when no `onFileOpen` is provided;
- controlled query state does not drift;
- keyboard enter opens focused row.

Architecture tests should only enforce hard boundaries:

- `FileViewer` does not import file-system;
- `viewer.tsx` does not import file-system;
- `file-system-list-view.tsx` does not instantiate `new FileTree`;
- no `FileSystemViewer*`;
- no `FileSystemTree`.

Everything else should be behavior or type-level proof.

### 13. The Naming Is Better But Not Perfect

Good names:

- `FileSystemProvider`
- `FileSystemHeader`
- `FileSystemExplorer`
- `FileSystemSelectedFile`
- `FileSystemOpenDialog`

Names still to improve:

- `FileSystemOpenDialog`: should likely be `FileSystemOpenFileDialog`.
- `openFile`: ambiguous; it means open preview dialog or invoke `onFileOpen`.
- `openedFile`: ambiguous; it is dialog state, not selected state.
- `pathEntries`: should be `entriesByPierrePath`.
- `paths`: should be `pierrePaths`.
- `hasQuery`: should be `hasSemanticQuery`.
- `revision`: should be `decorationVersion`.

#### Fix

Perform a naming-only pass after the module split.

The naming pass should be mechanical:

```txt
FileSystemOpenDialog -> FileSystemOpenFileDialog
useFileSystemOpenDialog -> useFileSystemOpenFileDialog
openedFile -> openedFilePreview
setOpenedFile -> setOpenedFilePreview
openFile -> openFilePreview
pathEntries -> entriesByPierrePath
paths -> pierrePaths
hasQuery -> hasSemanticQuery
revision -> decorationVersion
```

No behavior changes in this pass.

## Target Architecture

The target file-system architecture should be:

```txt
FileSystem easy API
  owns default layout only
  composes:
    FileSystemProvider
    ViewerRoot
    ViewerHeader
    FileSystemHeader
    ViewerBody
    ViewerSidebar
    FileSystemExplorer
    ViewerSurface
    FileSystemSelectedFile
    FileSystemOpenFileDialog

FileSystemProvider
  owns domain state
  exposes narrow part hooks

FileSystemController
  owns path/query/view/selection/loading/source resolution
  does not know viewer layout
  does not know Pierre

FileSystemExplorer
  switches browser views
  owns explorer status bar
  does not know selected file preview layout

FileSystemListView
  owns Pierre tree element and user row gestures
  does not own Pierre lifecycle details

Pierre adapter modules
  input: path conversion and prepared input
  order: current Retab order comparator
  expansion: expansion snapshots and query expansion
  selection: Pierre/Retab selection sync
  decoration: row metadata and Pierre decoration adapter
  model: useFileTree coordination only
```

## Concrete Implementation Plan

### Step 1: Rename Ambiguous Data In Pierre Input

Edit `file-system-pierre-input.ts`.

Change:

```ts
pathEntries -> entriesByPierrePath
paths -> pierrePaths
revision -> decorationVersion
toPierrePath -> fileSystemPathToPierrePath
fromPierrePath -> pierrePathToFileSystemEntry
```

Update all call sites.

Verification:

```bash
bunx vitest run tests/file-system-pierre-input.test.ts tests/file-system.test.tsx
```

### Step 2: Extract Pierre Order

Create:

```txt
registry/new-york-v4/ui/file-system-pierre-order.ts
```

Move:

- `createPierreInputOrder`;
- `comparePierreInputOrder`;
- mutable order ref management.

Target API:

```ts
export function useFileSystemPierreOrder(pierrePaths: readonly string[]) {
  const orderRef = React.useRef(createPierreInputOrder(pierrePaths))
  const compare = React.useCallback<FileTreeSortComparator>(
    (left, right) => comparePierreInputOrder(orderRef.current, left.path, right.path),
    []
  )
  const reset = React.useCallback((nextPierrePaths: readonly string[]) => {
    orderRef.current = createPierreInputOrder(nextPierrePaths)
  }, [])

  return { compare, reset }
}
```

### Step 3: Extract Pierre Selection

Create:

```txt
registry/new-york-v4/ui/file-system-pierre-selection.ts
```

Move:

- `selectedPathToPierrePath`;
- selection sync effect;
- Pierre selection change handling except lazy retry expansion.

Target API:

```ts
export function useFileSystemPierreSelection({
  controller,
  input,
  model,
}: {
  controller: FileSystemController
  input: FileSystemPierreInput
  model: PierreFileTreeModel
}) {
  return {
    handleSelectionChange,
    scrollSelectedPathIntoView,
    syncSelectedPath,
  }
}
```

### Step 4: Extract Pierre Expansion

Create:

```txt
registry/new-york-v4/ui/file-system-pierre-expansion.ts
```

Move:

- `PierreExpansionSnapshot`;
- `collectOpenPierrePaths`;
- `collectDirectoryPierrePaths`;
- `rememberExpansionBeforeReset`;
- `resolveExpansionAfterReset`;
- lazy retry expansion.

Target API:

```ts
export function useFileSystemPierreExpansion({
  controller,
  hasSemanticQuery,
  input,
  model,
}: Args) {
  return {
    rememberBeforeReset,
    resolveAfterReset,
    expandRetriedFolder,
  }
}
```

### Step 5: Rename And Extract Decoration Version

Create:

```txt
registry/new-york-v4/ui/file-system-pierre-decoration-version.ts
```

Move the version logic out of `FileSystemListView`.

Target API:

```ts
export function useFileSystemPierreDecorationVersion({
  folderErrors,
  loadingFolders,
}: {
  folderErrors: ReadonlyMap<string, string>
  loadingFolders: ReadonlySet<string>
}) {
  return React.useMemo(...)
}
```

Then `FileSystemListView` becomes:

```tsx
const decorationVersion = useFileSystemPierreDecorationVersion(controller)
const input = useFileSystemPierreInput({
  currentPath: controller.currentPath,
  index: controller.index,
  decorationVersion,
})
const { model } = useFileSystemPierreModel({ controller, input })
```

### Step 6: Split Controls

Replace:

```tsx
FileSystemFilterBar
```

With:

```tsx
FileSystemCommandBar
FileSystemFilterControls
FileSystemSortControls
```

Keep the visual row if desired. Fix the semantic boundary.

### Step 7: Narrow Part Hooks

Update:

- `useFileSystemHeader`;
- `useFileSystemExplorer`;
- `useFileSystemSelectedFile`;
- `useFileSystemOpenDialog`.

Do not return `controller` wholesale.

Each hook should return only what the corresponding component needs.

This is a code-quality pass. It will make the public part contracts self-documenting.

### Step 8: Rename Open Dialog Concepts

Perform the naming-only pass:

```txt
FileSystemOpenDialog -> FileSystemOpenFileDialog
useFileSystemOpenDialog -> useFileSystemOpenFileDialog
openedFile -> openedFilePreview
setOpenedFile -> setOpenedFilePreview
openFile -> openFilePreview
```

Update docs, tests, registry output.

### Step 9: Keep `file-system-light`

Keep `file-system-light` as a separate registry item. Do not refactor it as part of this pass.

### Step 10: Rebalance Tests

Keep:

```bash
bunx vitest run tests/file-system.test.tsx tests/file-system-pierre-input.test.ts tests/viewer-architecture.test.ts
bunx tsc --noEmit --pretty false
bun run registry:build
```

Add or keep behavior tests for:

- model is not recreated on sort;
- sort order changes visible rows;
- expansion survives decoration reset;
- search expansion restores correctly;
- lazy retry expansion works;
- modal open path works;
- controlled query remains controlled.

Reduce architecture tests that merely assert composition order unless the order is truly contractual.

## Acceptance Criteria

The final design is acceptable when:

- `file-system-pierre-model.ts` is under roughly 120 lines and reads as orchestration, not policy.
- No module owns more than one lifecycle concern.
- `FileSystemPierreInput` contains no decoration invalidation concept.
- Sort is not rendered by a component named filter.
- Part hooks do not return the full controller object.
- No public API contains `FileSystemViewer*`.
- No public API contains `FileSystemTree`.
- `file-system-light` remains registered and is not refactored as part of this pass.
- `FileSystem` easy API remains small and readable.
- All generated registry payloads match source.
- The focused test suite and typecheck pass.

## Non-Goals

Do not touch `ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSidebar`, or `ViewerSurface`.

Do not make viewer primitives aware of file-system concepts.

Do not rewrite grid, columns, or gallery views unless their APIs block the hook narrowing pass.

Do not introduce compatibility aliases.

Do not preserve old `FileSystemViewer*` or `FileSystemTree` exports.

Do not add slot-object APIs.

## Final Position

The current implementation is a strong proof that the architecture is viable.

The remaining gap is not “provider dead end” or “viewer primitive failure.” The remaining gap is adapter precision.

The platonic version is:

- file-system state is domain state;
- Pierre state is tree runtime state;
- viewer state is layout state;
- each boundary is explicit;
- each adapter has one job;
- names say exactly which world a value belongs to.

That is reachable from the current code without touching the viewer primitive.
