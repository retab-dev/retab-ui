# File System Pierre Boundary Final Perfection Blueprint

## Purpose

This blueprint covers the remaining imperfections after the Pierre privacy
boundary implementation.

The architectural direction is correct:

- Pierre is not part of the public `FileSystem` concept.
- provider, controller, parts, grid, columns, browser state, browser
  controller, docs, and public registry descriptions no longer speak Pierre.
- Pierre-specific lifecycle code lives in `file-system-pierre-*` files.
- `file-system-explorer-controllers.ts` is gone.
- `FileSystemListView` is the first main file-system view where the Pierre
  runtime appears.

That is good. It is not perfect.

The remaining problem is not a large leak. The remaining problem is boundary
exactness:

```txt
FileSystemListView still does too much.
file-system-pierre-adapter.ts still depends on a broad browser-state type.
file-system-light.tsx still imports a Pierre-named private runtime file.
```

This blueprint makes the final boundary pass precise.

## Platonic Target

The perfect model:

```txt
FileSystemBrowserState
  file-system semantic state only

FileSystemListView
  file-system list view only

FileSystemListTree
  private tree runtime wrapper

file-system-pierre-*
  Pierre input, model, selection, expansion, decoration, and tree runtime
```

The reader should be able to open any non-Pierre file-system file and understand
the component without knowing which tree engine powers the list view.

Pierre should be discoverable only when intentionally opening internal runtime
files.

## Current State

### Correct

`FileSystemListView` is now the first boundary where Pierre appears:

```ts
import { FileTree as PierreFileTree } from "@pierre/trees/react"
import { createFileSystemPierreAdapterState } from "./file-system-pierre-adapter"
import { useFileSystemPierreModel } from "./file-system-pierre-model"
```

`file-system-pierre-adapter.ts` owns the projection into:

```ts
FileSystemPierreDecorationState
FileSystemPierreLoadingController
FileSystemPierreNavigationController
FileSystemPierreQueryState
FileSystemPierreSelectionController
```

`file-system-light.tsx` no longer imports `@pierre/trees` directly.

### Not Perfect

`FileSystemListView` currently owns four jobs:

1. file-system view boundary;
2. conversion from browser state into Pierre adapter state;
3. Pierre input construction;
4. Pierre tree rendering and DOM event translation.

That is not a leak upward, but it is still too much for one file if we are
chasing the exact boundary.

`file-system-pierre-adapter.ts` currently imports:

```ts
import type { FileSystemBrowserState } from "./file-system-browser-state"
```

and defines the adapter source with:

```ts
Pick<FileSystemBrowserState, ...>
```

That is convenient, but it means the Pierre adapter is coupled to the broad
browser-state type. The ideal adapter should depend on an explicit structural
source type.

`file-system-light.tsx` imports:

```ts
import { FileSystemLightTree } from "./file-system-pierre-light-tree"
```

That is not user-facing, but the non-Pierre wrapper source still names the
engine. The perfect version imports a neutral private runtime boundary.

## Design Standard

A file may mention Pierre only if its filename contains `pierre`.

Exception:

```txt
file-system-list-tree.tsx
```

is allowed to import the Pierre runtime only if it is explicitly documented as a
private list-tree runtime and no public API exports it.

Better still:

```txt
file-system-pierre-list-tree.tsx
```

contains all Pierre imports, while `file-system-list-view.tsx` imports a neutral
`FileSystemListTree` re-export from a non-runtime file. But do not add a fake
re-export layer just to hide a filename.

The practical standard for this repo:

```txt
non-Pierre file-system files must not import @pierre/trees
non-Pierre file-system files must not mention FileSystemPierre types
non-Pierre public/docs text must not describe Pierre as product behavior
FileSystemListView may import a private tree component, but should not import
@pierre/trees directly
```

## Target Shape

### 1. `FileSystemListView` Becomes File-System-Facing

Target:

```tsx
export function FileSystemListView({
  controller,
}: {
  controller: FileSystemBrowserController
}) {
  const { browser } = controller

  if (!browser.entries.length) {
    return <FileSystemEmptyRows label="This folder is empty" />
  }

  return (
    <FileSystemListTree
      currentPath={browser.currentPath}
      folderErrors={browser.folderErrors}
      index={browser.index}
      loadingFolders={browser.loadingFolders}
      onOpenFile={controller.openPreview}
      search={browser.query.search}
      selectedPath={browser.selectedPath}
      ensureChildren={browser.ensureChildren}
      navigateTo={browser.navigateTo}
      selectEntry={browser.selectEntry}
    />
  )
}
```

`FileSystemListView` should not import:

- `@pierre/trees`;
- `file-system-pierre-input`;
- `file-system-pierre-model`;
- `file-system-pierre-decoration-version`;
- `file-system-pierre-adapter`.

It may import:

- `FileSystemBrowserController`;
- `FileSystemListTree`;
- file-system types if needed.

### 2. Add A Private List Tree Runtime

Add:

```txt
file-system-pierre-list-tree.tsx
```

It owns:

- `FileTree as PierreFileTree`;
- `buildFileSystemPierreInput`;
- `pierrePathToFileSystemEntry`;
- `useFileSystemPierreModel`;
- `useFileSystemPierreDecorationVersion`;
- DOM event translation from Pierre item paths to file-system entries.

Target API:

```ts
export type FileSystemListTreeProps = FileSystemPierreAdapterSource & {
  onOpenFile: (file: FileSystemFileEntry) => void
}
```

This component receives file-system concepts and privately adapts them to
Pierre.

### 3. Make The Adapter Source Structural

Replace:

```ts
export type FileSystemPierreAdapterSource = Pick<FileSystemBrowserState, ...> & {
  search: string
}
```

with:

```ts
export type FileSystemPierreAdapterSource = {
  currentPath: string
  ensureChildren: (
    path: string,
    options?: { retry?: boolean }
  ) => Promise<FileSystemEntry[]>
  folderErrors: ReadonlyMap<string, string>
  index: FileSystemIndex
  loadingFolders: ReadonlySet<string>
  navigateTo: (path: string) => void
  search: string
  selectEntry: (entry: FileSystemEntry | null) => void
  selectedPath: string | null
}
```

Import only:

```ts
FileSystemEntry
FileSystemIndex
```

from `file-system-types`.

The adapter should not import `FileSystemBrowserState`.

### 4. Rename The Light Runtime Boundary

Current:

```ts
import { FileSystemLightTree } from "./file-system-pierre-light-tree"
```

Target options:

```txt
Option A:
file-system-light-tree.tsx
  imports Pierre directly
```

This is acceptable if the file is considered a private runtime file and is not
exported from the public API.

```txt
Option B:
file-system-pierre-light-tree.tsx
  stays as-is
```

This is more honest about internals but keeps a Pierre-named import in
`file-system-light.tsx`.

Preferred:

```txt
file-system-light-tree.tsx
```

because the wrapper is still a file-system component. The private runtime
module should be named by its role, not by the vendor. Its internals may import
Pierre.

### 5. Tighten Architecture Tests

Update tests so they assert:

```ts
expect(fileSystemListView).not.toContain("@pierre/trees")
expect(fileSystemListView).not.toContain("useFileSystemPierreModel")
expect(fileSystemListView).not.toContain("buildFileSystemPierreInput")
expect(fileSystemListView).toContain("FileSystemListTree")
expect(fileSystemPierreListTree).toContain("useFileSystemPierreModel")
```

And:

```ts
expect(fileSystemPierreAdapter).not.toContain("FileSystemBrowserState")
expect(fileSystemPierreAdapter).toContain("FileSystemIndex")
```

For the light wrapper:

```ts
expect(fileSystemLight).not.toContain("pierre")
expect(fileSystemLightTree).toContain("@pierre/trees/react")
```

Keep the existing scans:

```bash
rg "@pierre|useFileTree|FileTree as Pierre|FileSystemPierre" \
  registry/new-york-v4/ui/file-system-provider.tsx \
  registry/new-york-v4/ui/file-system-controller.ts \
  registry/new-york-v4/ui/file-system-parts.tsx \
  registry/new-york-v4/ui/file-system-grid-view.tsx \
  registry/new-york-v4/ui/file-system-columns-view.tsx \
  registry/new-york-v4/ui/file-system-browser-controller.ts \
  registry/new-york-v4/ui/file-system-browser-state.ts \
  registry/new-york-v4/ui/file-system-light.tsx
```

Expected: no results.

## Implementation Plan

### Phase 1: Extract List Runtime

Create `file-system-pierre-list-tree.tsx`.

Move from `file-system-list-view.tsx`:

- Pierre import;
- `createFileSystemPierreAdapterState` usage;
- decoration version;
- input construction;
- `useFileSystemPierreModel`;
- `openPierrePath`;
- `pierrePathFromEvent`;
- `PierreFileTree` rendering.

Leave in `file-system-list-view.tsx`:

- browser controller destructuring;
- empty-state check;
- call to `FileSystemListTree`.

### Phase 2: Structural Adapter Source

Change `file-system-pierre-adapter.ts` to import only:

```ts
FileSystemEntry
FileSystemIndex
```

from `file-system-types`.

Remove the `FileSystemBrowserState` import.

### Phase 3: Light Runtime Naming

Rename:

```txt
file-system-pierre-light-tree.tsx
```

to:

```txt
file-system-light-tree.tsx
```

Update:

- `file-system-light.tsx`;
- `registry.json`;
- generated `public/r` payloads.

### Phase 4: Registry

Update registry file lists:

- add `file-system-pierre-list-tree.tsx` to `file-system`;
- replace `file-system-pierre-light-tree.tsx` with
  `file-system-light-tree.tsx` in `file-system-light`;
- run registry build.

### Phase 5: Verification

Run:

```bash
bun run registry:build
bunx tsc --noEmit --pretty false
bunx vitest run tests/file-system.test.tsx tests/file-system-pierre-input.test.ts tests/file-system-pierre-lifecycle.test.ts
bunx vitest run tests/viewer-architecture.test.ts -t "file-system|Pierre|relative internal|public/r"
```

Run scans:

```bash
rg "@pierre|useFileTree|FileTree as Pierre|FileSystemPierre" \
  registry/new-york-v4/ui/file-system-light.tsx \
  registry/new-york-v4/ui/file-system-provider.tsx \
  registry/new-york-v4/ui/file-system-controller.ts \
  registry/new-york-v4/ui/file-system-parts.tsx \
  registry/new-york-v4/ui/file-system-grid-view.tsx \
  registry/new-york-v4/ui/file-system-columns-view.tsx \
  registry/new-york-v4/ui/file-system-browser-controller.ts \
  registry/new-york-v4/ui/file-system-browser-state.ts
```

Expected: no results.

```bash
rg "file-system-explorer-controllers" \
  registry/new-york-v4/ui registry.json public/r/file-system.json public/r/registry.json
```

Expected: no results.

## Non-Goals

Do not touch `Viewer`.

Do not change `FileSystemProps`.

Do not change list/grid/columns behavior.

Do not change Pierre lifecycle policy.

Do not replace Pierre.

Do not introduce a Pierre provider.

Do not add compatibility aliases.

Do not rename public `FileSystemBrowser`, `FileSystemPreview`, or
`FileSystemOpenPreview`.

## Acceptance Criteria

The final state is accepted when:

- `FileSystemListView` no longer imports Pierre runtime or Pierre model files.
- `file-system-pierre-list-tree.tsx` owns all list-tree Pierre runtime wiring.
- `file-system-pierre-adapter.ts` does not import `FileSystemBrowserState`.
- `file-system-light.tsx` has no `pierre` string.
- registry file lists include all new private runtime files.
- registry payloads are fresh.
- typecheck passes.
- file-system behavior tests pass.
- Pierre lifecycle/input tests pass.
- relevant architecture tests pass.
- boundary scans are clean.

## Verdict

This is the last meaningful Pierre-boundary compression pass.

The current boundary is correct. This pass makes it feel inevitable.
