# File System Pierre Privacy Boundary Blueprint

## Purpose

This blueprint adopts the architectural decision:

```txt
Pierre is an implementation detail of the file-system list/tree view.
Pierre is not a first-class file-system concept.
```

The component library should expose a file-system browser, not a Pierre browser.
Pierre is the internal runtime we use for native tree behavior, virtualization,
selection bridging, expansion, and row rendering. Those are valuable
implementation properties. They are not part of the conceptual API of
`FileSystem`.

The current implementation is close, but still halfway:

- `FileSystemExplorer` dispatches to `FileSystemListView`,
  `FileSystemGridView`, and `FileSystemColumnsView`.
- `FileSystemListView` is the only view that actually renders Pierre.
- But `file-system-explorer-controllers.ts` exports
  `FileSystemPierre...` types and builds Pierre-shaped props.

That leak is the remaining boundary error.

The target is strict:

```txt
FileSystem domain modules speak file-system concepts.
List view internals may speak Pierre concepts.
No explorer composition module exports Pierre types.
No grid, columns, header, preview, provider, or viewer module imports Pierre.
```

## Platonic Judgment

The platonic file-system component is not tiny. It has real domain surface:

- browsing;
- selection;
- preview;
- modal open;
- lazy loading;
- source resolution;
- search;
- sort;
- view switching;
- folder navigation;
- Pierre-backed tree rendering.

The ideal is not to hide this surface under generic abstractions. The ideal is
to put every concept at the exact layer where it belongs.

Pierre belongs here:

```txt
FileSystemListView
  -> private Pierre adapter
    -> Pierre input
    -> Pierre model
    -> Pierre selection bridge
    -> Pierre expansion lifecycle
    -> Pierre row decoration
```

Pierre does not belong here:

```txt
FileSystemProvider
FileSystemController
FileSystemExplorerPart
FileSystemGridViewController
FileSystemColumnsViewController
FileSystemStatusState
FileSystemPreview
Viewer primitives
```

The reader should be able to understand the file-system architecture without
knowing Pierre exists. Then, when opening the list view implementation, Pierre
should become visible as the chosen engine for that view.

## Current Problem

The current `file-system-explorer-controllers.ts` has useful view-specific
controllers, but it also exports Pierre-specific types:

```ts
export type FileSystemPierreLoadingController = ...
export type FileSystemPierreNavigationController = ...
export type FileSystemPierreSelectionController = ...
export type FileSystemPierreQueryState = ...
export type FileSystemPierreDecorationState = ...
```

That means the explorer composition layer knows that the list view uses Pierre.

This creates three problems.

### 1. The Adapter Boundary Is Upside Down

The list view chose Pierre. Therefore the list view should adapt file-system
state into Pierre state.

Today, explorer composition adapts file-system state into Pierre-shaped props.
That makes Pierre feel like a peer of the file-system domain instead of a
private engine behind one renderer.

### 2. Names Leak Implementation Detail

`FileSystemExplorerPart` should answer:

```txt
what does the browser need to render each view?
```

It should not answer:

```txt
what exact state does Pierre need?
```

The name `FileSystemPierreLoadingController` is correct inside a Pierre adapter.
It is wrong in a file that claims to assemble generic explorer parts.

### 3. Future Code Can Couple To Pierre Accidentally

Once Pierre types are exported from explorer composition, grid or columns code
can accidentally import them. Architecture then depends on discipline instead of
the type/file boundary.

Platonic code should make the wrong import feel impossible.

## Target Mental Model

The final mental model should be:

```txt
FileSystemProvider
  owns file-system domain state

useFileSystemExplorer
  projects file-system state into view controllers

FileSystemExplorer
  dispatches list/grid/columns/status

FileSystemListView
  receives a file-system list controller
  privately adapts it into Pierre

Pierre adapter modules
  know Pierre and only Pierre integration details
```

The public-internal composition should read:

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
        <FileSystemPreview />
      </ViewerSurface>
    </ViewerBody>
    <FileSystemOpenPreviewDialog />
  </ViewerRoot>
</FileSystemProvider>
```

No Pierre concept appears in that composition.

## Target Boundary

### Explorer Controllers

`file-system-explorer-controllers.ts` should export only file-system browser
concepts:

```ts
export type FileSystemBrowserOpenController = {
  openPreview: (file: FileSystemFileEntry) => void
}

export type FileSystemBrowserSelectionController = {
  selectEntry: (entry: FileSystemEntry | null) => void
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
}

export type FileSystemListViewController = {
  currentPath: string
  folderErrors: ReadonlyMap<string, string>
  index: FileSystemIndex
  loadingFolders: ReadonlySet<string>
  openPreview: (file: FileSystemFileEntry) => void
  search: string
  selectEntry: (entry: FileSystemEntry | null) => void
  selectedPath: string | null
  ensureChildren: (
    path: string,
    options?: { retry?: boolean }
  ) => Promise<FileSystemEntry[]>
  navigateTo: (path: string) => void
}

export type FileSystemGridViewController = {
  currentEntries: FileSystemEntry[]
  loadingFolders: ReadonlySet<string>
  navigateTo: (path: string) => void
  openPreview: (file: FileSystemFileEntry) => void
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
  selectEntry: (entry: FileSystemEntry | null) => void
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
}

export type FileSystemColumnsViewController = {
  currentPath: string
  ensureChildren: FileSystemLoadingController["ensureChildren"]
  index: FileSystemIndex
  navigateTo: (path: string) => void
  openPreview: (file: FileSystemFileEntry) => void
  rawIndex: FileSystemIndex
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
  selectEntry: (entry: FileSystemEntry | null) => void
  selectFirstChildAfterEnsure: FileSystemSelectionController["selectFirstChildAfterEnsure"]
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
}

export type FileSystemStatusState = {
  currentEntries: FileSystemEntry[]
  query: FileSystemQueryState
  selectedEntry: FileSystemEntry | null
}

export type FileSystemExplorerPart = {
  columns: FileSystemColumnsViewController
  grid: FileSystemGridViewController
  list: FileSystemListViewController
  status: FileSystemStatusState
  view: FileSystemView
}
```

This file should not export a type with `Pierre` in its name.

### List View

`FileSystemListView` receives file-system concepts:

```tsx
export function FileSystemListView({
  controller,
}: {
  controller: FileSystemListViewController
}) {
  const input = buildFileSystemPierreInput({
    currentPath: controller.currentPath,
    index: controller.index,
  })

  const pierre = createFileSystemPierreAdapterState(controller)

  const { model } = useFileSystemPierreModel({
    input,
    ...pierre,
  })

  return <FileTree model={model} />
}
```

This is the correct place for Pierre to appear.

### Pierre Adapter State

Add a private adapter file if it improves clarity:

```txt
file-system-pierre-adapter.ts
```

It may export Pierre-specific types because its name honestly declares the
boundary:

```ts
export type FileSystemPierreLoadingController = {
  ensureChildren: FileSystemListViewController["ensureChildren"]
  folderErrors: ReadonlyMap<string, string>
  loadingFolders: ReadonlySet<string>
}

export type FileSystemPierreNavigationController = {
  currentPath: string
  navigateTo: (path: string) => void
}

export type FileSystemPierreSelectionController = {
  selectEntry: (entry: FileSystemEntry | null) => void
  selectedPath: string | null
}

export type FileSystemPierreQueryState = {
  search: string
}

export type FileSystemPierreDecorationState = {
  folderErrors: ReadonlyMap<string, string>
  index: FileSystemIndex
  loadingFolders: ReadonlySet<string>
}
```

Then:

```ts
export function createFileSystemPierreAdapterState(
  controller: FileSystemListViewController
) {
  return {
    decoration: {
      folderErrors: controller.folderErrors,
      index: controller.index,
      loadingFolders: controller.loadingFolders,
    },
    loading: {
      ensureChildren: controller.ensureChildren,
      folderErrors: controller.folderErrors,
      loadingFolders: controller.loadingFolders,
    },
    navigation: {
      currentPath: controller.currentPath,
      navigateTo: controller.navigateTo,
    },
    query: {
      search: controller.search,
    },
    selection: {
      selectEntry: controller.selectEntry,
      selectedPath: controller.selectedPath,
    },
  }
}
```

The important point is not whether this helper lives in a separate file. The
important point is that Pierre adaptation happens below `FileSystemListView`,
not above it.

## File Plan

### Keep

```txt
file-system-provider.tsx
file-system-controller.ts
file-system-parts.tsx
file-system-explorer-controllers.ts
file-system-list-view.tsx
file-system-grid-view.tsx
file-system-columns-view.tsx
file-system-pierre-*.ts
```

### Change

```txt
file-system-explorer-controllers.ts
  remove all FileSystemPierre... exports
  expose only FileSystemListViewController as file-system concepts

file-system-list-view.tsx
  convert FileSystemListViewController into Pierre adapter state
  become the first file in the call graph where Pierre names appear

file-system-pierre-model.ts
  import Pierre adapter types from a Pierre-only file, not explorer controllers

file-system-pierre-decoration.ts
file-system-pierre-decoration-version.ts
file-system-pierre-expansion.ts
file-system-pierre-lazy-retry.ts
file-system-pierre-selection.ts
file-system-pierre-reset.ts
  import Pierre adapter types from the Pierre boundary
```

### Optional Add

```txt
file-system-pierre-adapter.ts
```

Add this only if it reduces noise. Do not add it as architecture theater. If
`file-system-list-view.tsx` can own the small adaptation directly, keep it
there.

## Implementation Phases

### Phase 1: Rename The Boundary In Your Head

Before changing code, enforce this rule:

```txt
file-system-explorer-controllers.ts is not allowed to mention Pierre.
```

This is the entire design.

### Phase 2: Change `FileSystemListViewController`

Replace its Pierre-shaped nested fields with file-system fields:

```ts
type FileSystemListViewController = {
  currentPath: string
  ensureChildren: FileSystemLoadingController["ensureChildren"]
  folderErrors: ReadonlyMap<string, string>
  index: FileSystemIndex
  loadingFolders: ReadonlySet<string>
  navigateTo: FileSystemNavigationController["navigateTo"]
  openPreview: FileSystemBrowserOpenController["openPreview"]
  search: string
  selectEntry: FileSystemSelectionController["selectEntry"]
  selectedPath: string | null
}
```

Do not include:

- `source`;
- `resolveFileSource`;
- `view`;
- `rawIndex`;
- `selectedEntry`;
- `query` as a full object;
- any `Pierre` type.

If list view later needs more, add the exact file-system concept by name.

### Phase 3: Move Pierre Type Definitions Down

Move these types out of `file-system-explorer-controllers.ts`:

```txt
FileSystemPierreLoadingController
FileSystemPierreNavigationController
FileSystemPierreSelectionController
FileSystemPierreQueryState
FileSystemPierreDecorationState
```

Preferred destination:

```txt
file-system-pierre-adapter.ts
```

Acceptable destination:

```txt
file-system-list-view.tsx
```

if only one or two are needed locally.

### Phase 4: Adapt Inside List View

In `FileSystemListView`, build Pierre state from the file-system list
controller:

```ts
const pierre = createFileSystemPierreAdapterState(controller)
```

Then call:

```ts
useFileSystemPierreModel({
  decoration: pierre.decoration,
  decorationVersion,
  input,
  loading: pierre.loading,
  navigation: pierre.navigation,
  query: pierre.query,
  selection: pierre.selection,
})
```

This keeps the Pierre model signature exact while moving the adaptation to the
right layer.

### Phase 5: Update Pierre Imports

Pierre modules may import from:

```txt
file-system-pierre-adapter.ts
file-system-pierre-input.ts
file-system-pierre-reset-identity.ts
file-system-pierre-reset-plan.ts
file-system-pierre-expansion-snapshot.ts
file-system-types.ts
```

Pierre modules must not import from:

```txt
file-system-explorer-controllers.ts
file-system-provider.tsx
file-system-parts.tsx
file-system.tsx
viewer.tsx
```

This is the hard boundary.

### Phase 6: Strengthen Architecture Tests

Add source-shape tests that protect the boundary without freezing incidental
line order:

```ts
expect(explorerControllers).not.toContain("Pierre")
expect(listView).toContain("createFileSystemPierreAdapterState")
expect(pierreModel).not.toContain("file-system-explorer-controllers")
```

Also assert:

```bash
rg "FileSystemPierre" registry/new-york-v4/ui/file-system-explorer-controllers.ts
```

returns no results.

And:

```bash
rg "@pierre|useFileTree|FileSystemPierre" \
  registry/new-york-v4/ui/file-system-provider.tsx \
  registry/new-york-v4/ui/file-system-controller.ts \
  registry/new-york-v4/ui/file-system-parts.tsx \
  registry/new-york-v4/ui/file-system-grid-view.tsx \
  registry/new-york-v4/ui/file-system-columns-view.tsx
```

returns no results.

### Phase 7: Verify Behavior

Run the behavior tests that prove the boundary did not change semantics:

```bash
bunx vitest run tests/file-system.test.tsx
bunx vitest run tests/file-system-pierre-input.test.ts
bunx vitest run tests/file-system-pierre-lifecycle.test.ts
bunx vitest run tests/file-system-pierre-input.test.ts tests/file-system-pierre-lifecycle.test.ts tests/file-system.test.tsx tests/viewer-architecture.test.ts
bunx tsc --noEmit --pretty false
```

The target is no behavior drift.

## Naming Rules

Use `FileSystem...` names above the list view:

- `FileSystemListViewController`;
- `FileSystemGridViewController`;
- `FileSystemColumnsViewController`;
- `FileSystemExplorerPart`;
- `FileSystemStatusState`.

Use `FileSystemPierre...` names only in Pierre files:

- `file-system-pierre-adapter.ts`;
- `file-system-pierre-model.ts`;
- `file-system-pierre-selection.ts`;
- `file-system-pierre-expansion.ts`;
- `file-system-pierre-reset.ts`;
- `file-system-pierre-decoration.ts`.

Use exact field names:

- file-system path: `path`;
- current folder path: `currentPath`;
- selected file-system path: `selectedPath`;
- Pierre path: `pierrePath`;
- visible file-system index: `index`;
- full unfiltered file-system index: `rawIndex`;
- search string: `search`;
- modal open command: `openPreview`.

Avoid vague names:

- `adapterState` if it hides actual fields;
- `treeController` if it mixes Pierre and file-system concepts;
- `manager`;
- `engine`;
- `data`;
- `options` for domain state.

## Non-Goals

Do not touch `Viewer`.

Do not make Pierre public.

Do not add a Pierre provider.

Do not replace Pierre.

Do not hand-roll virtualization.

Do not change `FileSystemProps`.

Do not rename the list view to `PierreListView`.

Do not move source resolution into Pierre.

Do not make grid or columns depend on Pierre helper types.

Do not add compatibility aliases.

## Risks

### Risk 1: The List Controller Becomes Too Large

`FileSystemListViewController` may look broad because list view owns real tree
behavior.

Mitigation: keep only file-system concepts. Broad is acceptable if exact.
Leaking Pierre upward is not acceptable.

### Risk 2: Pierre Adapter Becomes A Dumping Ground

`file-system-pierre-adapter.ts` could become another god file.

Mitigation: it should only contain type projection from
`FileSystemListViewController` to Pierre model props. Policy still belongs in
the focused Pierre modules.

### Risk 3: Architecture Tests Become Brittle

Boundary tests can overfit spelling.

Mitigation: test forbidden imports and forbidden concept leakage, not local
line order.

### Risk 4: Behavior Drift In Expansion Reset

Moving type imports should not change runtime behavior, but Pierre lifecycle is
subtle.

Mitigation: run lifecycle tests before and after. Do not refactor reset policy
in the same pass.

## Acceptance Criteria

The design is accepted when:

```bash
rg "Pierre" registry/new-york-v4/ui/file-system-explorer-controllers.ts
```

returns no results.

And:

```bash
rg "file-system-explorer-controllers" registry/new-york-v4/ui/file-system-pierre-*.ts
```

returns no results.

And the only files allowed to mention Pierre are:

```txt
file-system-list-view.tsx
file-system-pierre-*.ts
tests/file-system-pierre-*.test.ts
tests/viewer-architecture.test.ts
```

And the main composition still reads as file-system plus viewer:

```tsx
<FileSystemProvider {...props}>
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
    <FileSystemOpenPreviewDialog />
  </ViewerRoot>
</FileSystemProvider>
```

## Final Verdict

This is the right next compression.

The provider is not the main problem anymore. The viewer primitive is not the
problem. The remaining imprecision is the list/Pierre boundary.

Pierre should be powerful, present, and well-tested. It should also be private.

The final component should feel like a native file-system browser that happens
to use Pierre internally, not like a file-system/Pierre hybrid architecture.
