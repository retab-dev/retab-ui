# File System Viewer Rebuild Repair Blueprint

## Purpose

This blueprint repairs the current file-system rebuild without throwing away the
parts that are already correct.

The Pierre migration is the right direction. The problem is that the latest
rebuild expanded the component surface before making that surface complete, and
it regressed one useful list affordance. The next pass should be a precision
pass, not another rewrite.

## Current Verdict

The monolithic `FileSystem` component still works for the main documented flow.
The rebuilt provider and parts API is not yet good enough to be public.

Keep:

- `@pierre/trees` for the list tree.
- `file-system-pierre-list-adapter.ts` as the Pierre boundary.
- `use-file-system-children-loader.ts` as the lazy loading boundary.
- The default `FileSystem` component as the easy installed API.
- The blocks and docs examples that mount the real component.

Fix:

- The exported provider/parts API opens files into hidden state unless the
  private dialog is rendered by the monolithic component.
- The list header exposes only `name` and `kind` sorting even though the query
  model still supports `size` and `updatedAt`.
- Programmatic Pierre selection sync can re-enter `controller.selectEntry` for
  the already selected path after model recreation.

Do not rebuild:

- The file-system index model.
- The lazy loading hook.
- The Pierre adapter.
- The view system.
- The registry block fixture.

## Reviewed Files

- `registry/new-york-v4/ui/file-system.tsx`
- `registry/new-york-v4/ui/file-system-list-view.tsx`
- `registry/new-york-v4/ui/file-system-controller.ts`
- `registry/new-york-v4/ui/file-system-query.ts`
- `registry/new-york-v4/ui/file-system-pierre-list-adapter.ts`
- `registry/new-york-v4/ui/use-file-system-children-loader.ts`
- `tests/file-system.test.tsx`
- `tests/file-system-index.test.ts`
- `tests/viewer-architecture.test.ts`

## Evidence

### 1. The parts API is incomplete

`FileSystemViewerProvider` owns `openedFile` and `openFile`.
`FileSystemViewerTree` calls `openFile`.
Only the private `FileSystemOpenDialog` consumes `openedFile`.

The default `FileSystem` renders the private dialog, so the default component is
fine. A consumer who uses the exported parts cannot render the default open-file
dialog because it is not exported.

This is worse than having no parts API. It looks composable, but one normal user
action silently lands in unobservable provider state.

### 2. List sorting regressed

`FileSystemSortKey` still includes:

```ts
"name" | "kind" | "size" | "updatedAt"
```

`compareEntries` still implements all four keys.

The rebuilt list header renders only:

```tsx
<SortHeader controller={controller} label="Name" sortKey="name" />
<SortHeader controller={controller} label="Type" sortKey="kind" />
```

That removes reachable UI for size and modified-date sorting in the list view.
The data model should not expose behavior the main inspection surface cannot
reach.

### 3. Pierre selection sync can duplicate selection events

`file-system-list-view.tsx` recreates the Pierre model when paths, query state,
or row decorations require it. After recreation, the effect that syncs selected
paths calls:

```ts
model.getItem(path)?.select()
```

Pierre then runs `onSelectionChange`, which calls `controller.selectEntry`.
Today `selectEntry` invokes `onSelectionChange` even when the selected path is
already current. Decoration changes should not emit a fresh user selection
event.

## Target Shape

### Public Component Surface

The public surface should be either complete or private. Since the rebuild has
already exported the parts, make the parts complete.

Target exports:

```ts
FileSystem
FileSystemViewerProvider
FileSystemViewerHeader
FileSystemViewerTree
FileSystemViewerSelectedFile
FileSystemViewerOpenDialog
useFileSystemViewer
useFileSystemViewerHeader
useFileSystemViewerTree
useFileSystemViewerSelectedFile
useFileSystemViewerOpenDialog
```

Rules:

- `FileSystem` remains the batteries-included default.
- `FileSystemViewerOpenDialog` is the default dialog part used by `FileSystem`.
- Consumers who compose provider/header/tree/selected-file can opt into the
  same default open behavior by rendering `FileSystemViewerOpenDialog`.
- Consumers who pass `onFileOpen` own file opening and do not need the dialog.
- No private state should be reachable only through the monolithic component.

### List View

The Pierre list should keep one tree column and a compact sort toolbar above it.

Required sort controls:

- `Name`
- `Type`
- `Size`
- `Modified`

The list rows do not need to become a full table. Pierre owns row indentation,
expansion, and keyboard behavior. The header can be a compact control strip
without pretending the virtualized tree has aligned table cells.

### Selection Semantics

Selection callbacks should represent a meaningful selection change.

Rules:

- Selecting a different entry calls `onSelectionChange`.
- Clearing a non-empty selection calls `onSelectionChange(null)`.
- Selecting the already selected path because Pierre model state was recreated
  does not call `onSelectionChange`.
- Clicking the already selected file does not need to emit another change event.
- Opening a file remains a separate action and should not depend on duplicate
  selection notifications.

## Required Changes

### 1. Export the open dialog part

File:

- `registry/new-york-v4/ui/file-system.tsx`

Rename:

```ts
function FileSystemOpenDialog()
```

to:

```ts
export function FileSystemViewerOpenDialog()
```

Rename:

```ts
function useFileSystemOpenDialog()
```

to:

```ts
export function useFileSystemViewerOpenDialog()
```

Update the default component to render:

```tsx
<FileSystemViewerOpenDialog />
```

Keep the context state private to `file-system.tsx`; only the hook and component
need to be exported.

### 2. Test composed open-file behavior

File:

- `tests/file-system.test.tsx`

Add a test that renders:

```tsx
<FileSystemViewerProvider items={items}>
  <ViewerRoot data-viewer="file-system" bare>
    <FileSystemViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <FileSystemViewerTree />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemViewerSelectedFile />
      </ViewerSurface>
    </ViewerBody>
    <FileSystemViewerOpenDialog />
  </ViewerRoot>
</FileSystemViewerProvider>
```

Then double-click a file and assert the dialog opens with that file title.

Also add the negative guard implicitly: the test must use the exported dialog
part, not the monolithic `FileSystem` component.

### 3. Restore all sort controls

File:

- `registry/new-york-v4/ui/file-system-list-view.tsx`

Replace the two-column header with a compact sort control row. The exact layout
can be simple:

```tsx
<div className="flex h-9 shrink-0 items-center gap-1 border-b bg-muted/30 px-3 text-xs font-medium text-muted-foreground">
  <SortHeader controller={controller} label="Name" sortKey="name" />
  <SortHeader controller={controller} label="Type" sortKey="kind" />
  <SortHeader controller={controller} label="Size" sortKey="size" />
  <SortHeader controller={controller} label="Modified" sortKey="updatedAt" />
</div>
```

The final class names should match the local design system. The important part
is that all four sort keys are visible and keyboard reachable.

### 4. Test size and modified sorting from the list view

File:

- `tests/file-system.test.tsx`

Add focused tests that use `defaultView="list"`:

- Click `Size`, assert files reorder by size.
- Click `Modified`, assert files reorder by `updatedAt`.
- Click the same header again, assert direction toggles.

Keep the assertions on visible names, not internal query state.

### 5. Suppress duplicate same-path selection changes

File:

- `registry/new-york-v4/ui/file-system-controller.ts`

Change `selectEntry` so same-path selection is a no-op before calling
`onSelectionChange`.

Target behavior:

```ts
const nextPath = entry?.path ?? null

if (nextPath === selectionStateRef.current.selectedPath) {
  return
}
```

Then continue with request invalidation, local state update, and callback.

Be careful:

- Use the same selected-path source that lazy child selection guards already
  trust.
- Do not skip clearing if current selection is non-null and `entry` is null.
- Do not break controlled selection. In controlled mode, same-path selection
  should still be a no-op because the parent already owns that state.

### 6. Test decoration-driven model recreation does not re-emit selection

File:

- `tests/file-system.test.tsx`

Add a test around the lazy folder path:

1. Render `FileSystem` in list view with `onSelectionChange`.
2. Select a file or folder.
3. Trigger a folder loading/error decoration that recreates the Pierre model.
4. Assert `onSelectionChange` was not called again for the already selected
   entry.

If Pierre shadow-root interaction makes this too brittle, test at the controller
level by mounting a minimal component that calls `selectEntry` twice with the
same entry. Prefer the UI-level test if it stays readable.

## Registry And Docs

If exported symbols change, rebuild the registry output.

Expected generated files may include:

- `public/r/file-system.json`
- `public/r/file-system-block.json`

Docs do not need new marketing text. If examples are updated, they should show
actual composition, not describe the API in prose.

## Non-Goals

- Do not replace Pierre.
- Do not reintroduce the old hand-rolled tree row model.
- Do not add a second file-open state outside `FileSystemViewerProvider`.
- Do not add compatibility aliases for the private `FileSystemOpenDialog` name.
- Do not split the default `FileSystem` into another wrapper layer.
- Do not move sorting into Pierre internals.
- Do not touch unrelated viewer components.

## Validation

Run the focused checks:

```bash
npx pnpm@10.15.0 exec vitest run tests/file-system.test.tsx tests/file-system-index.test.ts tests/viewer-architecture.test.ts
npx pnpm@10.15.0 exec eslint registry/new-york-v4/ui/file-system.tsx registry/new-york-v4/ui/file-system-list-view.tsx registry/new-york-v4/ui/file-system-controller.ts tests/file-system.test.tsx
npx pnpm@10.15.0 registry:validate
```

Run the registry build after implementation:

```bash
npx pnpm@10.15.0 registry:build
```

Run full typecheck if the surrounding worktree is clean enough:

```bash
npx pnpm@10.15.0 exec tsc --noEmit --pretty false
```

If full typecheck fails on unrelated dirty json-table or pretext files, record
the exact failures and keep this pass scoped to file-system.

## Acceptance Criteria

- `FileSystem` still opens files in its default dialog.
- Composed provider/parts usage can render `FileSystemViewerOpenDialog` and
  open files without custom `onFileOpen`.
- List view exposes `Name`, `Type`, `Size`, and `Modified` sorting.
- Size and modified sorting are covered by tests.
- Pierre model recreation does not emit duplicate same-path selection changes.
- File-system focused tests pass.
- File-system lint passes.
- Registry validation passes.
- Generated registry output includes any new exported dialog part.

## Final State

The file-system viewer should feel like one precise component with two honest
entry points:

- `FileSystem` for the complete installed viewer.
- `FileSystemViewerProvider` plus exported parts for custom composition.

Pierre remains an internal implementation choice for the list tree. The public
API should expose file-system concepts, not Pierre concepts.
