# File System Viewer Final Perfection Blueprint

## Purpose

This blueprint defines the final pass required before the file-system viewer can credibly claim the platonic ideal. The current implementation is strong: it is modular, source-first, controlled, virtualized, URL-state-proven, and better architected than Extend UI's monolithic file-system source. It is not perfect yet.

The final pass is not a feature pass. It is a removal and boundary pass.

## Perfection Standard

Every retained line must earn its place.

- Simplicity: one owner per behavior, one path through the code, no compatibility leftovers.
- Speed: bounded DOM, no avoidable large recomputation in common paths, no preview work on pure keyboard movement.
- Everything needed: state, loading, errors, source preview, keyboard access, URL proof, tests, registry output.
- Nothing more: no dead expansion state, no unused row model, no generic abstractions outside the file-system domain.
- Perfect modularization: controller owns state, adapters adapt, views lay out, pure modules stay pure.
- High-entropy code: no filler comments, stale exports, unused parameters, or repeated mechanics.
- Consistent names: `entry`, `file`, `folder`, `path`, `selectedPath`, `query`, `view`, and `source` mean exactly one thing.
- Flaubertian precision: every exported type, helper, prop, and module name is the precise smallest expression of the behavior.

## Current Verdict

The component has not reached perfection because:

- The controller still exposes obsolete list-tree expansion concepts after the Pierre tree migration.
- The list view contains a mutable adapter state object and an eslint dependency escape.
- Tests reach into the Pierre tree shadow root directly.
- `ensureChildren` rebuilds a full index after every lazy load to recover fresh visible children.
- The demo block proves URL state but carries parsing and synthetic data directly inside the block.

These are solvable without changing the product surface.

## Current-State Inventory

Treat the current implementation as the baseline before this pass:

- `registry/new-york-v4/ui/file-system.tsx` composes controller, chrome, list/grid/columns/gallery views, preview, and built-in file-open dialog.
- `registry/new-york-v4/ui/file-system-controller.ts` owns path history, controlled query/view/path/selection, lazy loading, source cache, and folder errors.
- `registry/new-york-v4/ui/file-system-list-view.tsx` uses `@pierre/trees` and still carries path conversion helpers plus a mutable `FileSystemListState`.
- `registry/new-york-v4/ui/file-system-grid-view.tsx`, `file-system-columns-view.tsx`, and `file-system-gallery-view.tsx` already share `useFileSystemRovingFocus`.
- `registry/new-york-v4/blocks/file-system-block.tsx` owns URL parse/format helpers, fixture items, large fixture items, and route wiring.
- `tests/file-system.test.tsx` currently includes helper code that reaches into the Pierre shadow root.
- `e2e/file-system.spec.ts` proves view switching, URL state round-trip, invalid URL fallback, and bounded DOM for a 5,000-file manifest.

Do not assume clean surrounding worktree state. There may be unrelated dirty files. This pass should touch only file-system implementation, file-system demo/docs/tests, registry metadata, and generated registry JSON.

## Extend Lessons

Source reviewed:

- Public docs: `https://www.extend.ai/ui/docs/components/file-system`.
- Source repository: `https://github.com/extend-hq/ui`.
- Reviewed file-system source in a shallow clone at `/tmp/extend-ui-review/apps/v4/components/ui/file-system.tsx`.

What Extend gets right:

- The product scope is correct for document-heavy object stores: flat manifest in, Finder-style file browser out.
- The public item shape maps cleanly to S3/R2 object-store concepts: object key as file path, common prefix as folder path, optional explicit folders for lazy traversal.
- Four views cover the core inspection modes: icons, list, columns, gallery.
- The docs explain the important operational boundary: thumbnails, signed URLs, and parsing are external concerns.
- The component includes the states users expect: folder navigation, file selection, file open behavior, lazy children, thumbnails, metadata, responsive view switcher, and keyboard navigation.
- The gallery deliberately avoids expensive viewer mounting while arrow-key scrubbing, which is the right performance instinct.

Where Extend falls short of the platonic ideal:

- The main component source is about 5,069 lines, so unrelated concerns live together: indexing, filtering, sorting, icons, preview resolution, dialog rendering, list tree wiring, columns, gallery, and demo-level behavior.
- Internal helper functions are not cleanly separated into source-first modules, which makes each change require more local context than the behavior deserves.
- Lazy loading is embedded in the root component instead of being a coherent loader boundary.
- The list tree path conversion is embedded in the view instead of being a tested adapter.
- The block wrapper is only 11 lines because almost everything lives in the UI component; that is simple at install time but too dense for long-term component quality.

What Retab should keep from Extend:

- Keep the flat object-store manifest contract.
- Keep explicit folder support for lazy traversal.
- Keep the four-view surface.
- Keep external ownership of thumbnails, signing, and custom preview rendering.
- Keep smooth gallery behavior by avoiding full preview work during fast keyboard movement.

What Retab should improve beyond Extend:

- Keep implementation modules small and named by responsibility.
- Put source indexing and query logic in pure modules.
- Put lazy folder loading in one hook.
- Put Pierre tree adaptation in one pure adapter.
- Keep the public component as composition, not as a storage place for every helper.
- Prove URL state, lazy loading, and bounded DOM with tests.

## Evidence Snapshot

Source size before this final pass:

- Extend `components/ui/file-system.tsx`: 5,069 lines.
- Extend `registry/new-york-v4/blocks/file-system-block.tsx`: 11 lines.
- Retab `registry/new-york-v4/ui/file-system.tsx`: 211 lines.
- Retab `registry/new-york-v4/ui/file-system-controller.ts`: 509 lines.
- Retab `registry/new-york-v4/ui/file-system-list-view.tsx`: 303 lines.
- Retab `registry/new-york-v4/blocks/file-system-block.tsx`: 380 lines.

Retab is already better than Extend on modularity, but not perfect:

- `file-system-controller.ts` still contains `expandedPaths`, `folderRequests`, and `folderPromises`.
- `file-system-query.ts` still exports `flattenFileSystemRows`.
- `file-system-list-view.tsx` still contains Pierre path conversion and one `react-hooks/exhaustive-deps` disable.
- `file-system-block.tsx` still owns helper logic that belongs in a pure demo-state module.

The final pass should reduce cognitive load in the hot files:

- `file-system-controller.ts` should lose request-map logic and obsolete expansion state.
- `file-system-list-view.tsx` should lose path math and lint escapes.
- `file-system-block.tsx` should fall below 160 lines.
- Pure behavior should become independently testable without mounting the component.

## Target Architecture

Final module ownership:

- `file-system.tsx`: public component composition and default file-open dialog.
- `file-system-controller.ts`: path, view, query, selection, loaded children, folder errors, source resolution.
- `use-file-system-children-loader.ts`: lazy folder loading and request de-duplication.
- `file-system-pierre-list-adapter.ts`: pure conversion between `FileSystemIndex` and Pierre tree paths.
- `file-system-list-view.tsx`: list layout and Pierre component wiring only.
- `use-file-system-roving-focus.ts`: DOM focus registration and shared roving selection.
- `file-system-query.ts`: pure query/filter/sort functions only.
- `file-system-index.ts`: pure path/index functions only.
- `file-system-demo-state.ts`: URL parse/format helpers and large manifest generation for the demo.

No view should own async loading policy. No pure utility should import React. No registry component should keep dead exports for old internal implementations.

## Required Changes

### 1. Remove Obsolete Expansion State

Delete:

- `expandedPaths` from `useFileSystemController`.
- `toggleExpanded` from `useFileSystemController`.
- `FileSystemTreeRow`.
- `flattenFileSystemRows`.
- The `flattens expanded tree rows` test in `tests/file-system-index.test.ts`.

Reason:

The list view now uses Pierre tree state. Retaining the previous hand-rolled tree expansion model violates nothing-more and high-entropy code.

Exact edits:

- In `file-system-controller.ts`, remove `expandedPaths` state, `toggleExpanded`, and both returned fields.
- In `file-system-types.ts`, remove `FileSystemTreeRow`.
- In `file-system-query.ts`, remove the `FileSystemTreeRow` import and `flattenFileSystemRows`.
- In `tests/file-system-index.test.ts`, delete the flattening test and remove the `flattenFileSystemRows` import.
- In generated registry output, ensure `file-system.json` no longer contains these symbols.

Acceptance:

- `rg "expandedPaths|toggleExpanded|flattenFileSystemRows|FileSystemTreeRow"` returns no file-system implementation references.
- File-system tests still prove list rendering, filtering, and file opening through the Pierre-backed list.
- TypeScript passes without dead exported types.

### 2. Create A Pierre List Adapter Boundary

Move all Pierre path conversion and tree-input preparation out of `file-system-list-view.tsx`.

New module:

```ts
file-system-pierre-list-adapter.ts
```

Exports:

```ts
type FileSystemPierreListInput = {
  paths: string[]
  pathEntries: Map<string, FileSystemEntry>
}

function buildFileSystemPierreListInput(
  index: FileSystemIndex,
  currentPath: string
): FileSystemPierreListInput

function fileSystemPathToPierrePath(path: string, currentPath: string): string
function fileSystemPierrePathToEntry(
  path: string | null,
  pathEntries: ReadonlyMap<string, FileSystemEntry>
): FileSystemEntry | null
```

Keep in `file-system-list-view.tsx`:

- Pierre model creation.
- event handlers.
- visible headers.
- row decoration rendering.

Acceptance:

- `file-system-list-view.tsx` no longer defines path conversion helpers.
- Adapter helpers have unit tests.
- View code reads as wiring, not path math.

Test cases:

- `buildFileSystemPierreListInput returns current-folder-relative Pierre paths`.
- `buildFileSystemPierreListInput omits entries outside currentPath`.
- `fileSystemPathToPierrePath normalizes folder paths with trailing slash`.
- `fileSystemPierrePathToEntry returns null for null or unknown Pierre paths`.

### 3. Remove Mutable Adapter Escape

Replace the current mutable `state` object and eslint dependency escape in `file-system-list-view.tsx`.

Current issue:

- The Pierre model callbacks need current controller data.
- The view uses a mutable object plus `eslint-disable-next-line react-hooks/exhaustive-deps`.

Target:

- Add `useLatestFileSystemListState` or a local `useLatestRef` helper inside the list view module.
- The hook updates the ref in layout effect.
- The model closes over one stable ref.
- No eslint-disable comments remain in file-system modules.

Recommended shape:

```ts
function useLatestFileSystemListState(state: FileSystemListState) {
  const stateRef = React.useRef(state)

  React.useLayoutEffect(() => {
    stateRef.current = state
  }, [state])

  return stateRef
}
```

Then model callbacks read:

```ts
const state = stateRef.current
```

Dependency rule:

- The Pierre model should depend on `paths`, `hasQuery`, and decoration state.
- It should not depend on `controller`, `onOpenFile`, or `pathEntries` identity directly.
- It should still be recreated when row decoration inputs change, because Pierre owns rendered row decoration internally.

Acceptance:

- `rg "eslint-disable-next-line react-hooks/exhaustive-deps" registry/new-york-v4/ui/file-system* registry/new-york-v4/ui/use-file-system*` returns nothing.
- Pierre model is not recreated for every controller object identity change.
- Row decorations still update on loading/error changes.

### 4. Extract Lazy Children Loader

Move lazy folder loading from the controller into:

```ts
use-file-system-children-loader.ts
```

Hook shape:

```ts
function useFileSystemChildrenLoader({
  allItems,
  currentPath,
  loadChildren,
  query,
  rawIndex,
  setLoadedItems,
  visibleIndex,
}: ...): {
  ensureChildren: (path: string, options?: { retry?: boolean }) => Promise<FileSystemEntry[]>
  folderErrors: Map<string, string>
  loadingFolders: Set<string>
}
```

Reason:

The controller is coherent but broad. Loading has its own state, request maps, error handling, abort lifecycle, and derived child computation. Extracting it makes the controller smaller without adding a speculative abstraction.

Implementation details:

- The hook should create and clean up `folderRequests` internally.
- The hook should own `folderPromises` so duplicate requests for the same folder share one promise.
- It should expose only `ensureChildren`, `folderErrors`, and `loadingFolders`.
- It should accept `setLoadedItems` from the controller rather than owning `loadedItems`.
- It should use `buildFileSystemIndex` and `deriveVisibleIndex` internally only to compute the return value for freshly loaded children.
- It should not expose request maps or abort controllers.
- It should return `currentChildren` when:
  - `loadChildren` is absent.
  - The folder is not lazy.
  - Children are already loaded and `retry` is false.
  - The request aborts.
  - Loading fails.

Error behavior:

- Before each load, remove any previous error for that folder.
- On failure, set the human-readable error string using the same fallback message: `Couldn't load this folder.`
- On retry, bypass the "children already loaded" guard only for the target folder.

Abort behavior:

- Abort all in-flight folder requests on unmount.
- Do not set loaded items from an aborted request.

Acceptance:

- `file-system-controller.ts` no longer owns `folderRequests`, `folderPromises`, `loadingFolders`, or `folderErrors` state directly.
- Loading behavior is unchanged.
- Existing lazy-load tests pass.

### 5. Make Lazy Child Selection More Direct

Keep `selectFirstChildAfterEnsure`, but make it use the extracted loader result directly.

Target:

```ts
const children = await ensureChildren(folderPath)
selectEntry(children[0] ?? null)
```

Do not rebuild or inspect extra indexes in the view.

Acceptance:

- `ArrowRight` on a loaded folder selects immediately.
- `ArrowRight` on a lazy folder selects after load.
- Failure keeps selection on the folder.
- No timeouts, polling, or view-owned async coordination.

Test cases:

- Keep `selects the first lazy child from columns keyboard navigation`.
- Add `keeps the lazy folder selected when column child loading fails`.
- Assert the folder error is visible through list or column row decoration.

### 6. Extract Demo State Helpers

Move URL state and large-manifest generation out of `file-system-block.tsx`.

New module:

```ts
file-system-demo-state.ts
```

Exports:

- `DEFAULT_FILE_SYSTEM_DEMO_QUERY`
- `FILE_SYSTEM_DEMO_ITEMS`
- `LARGE_FILE_SYSTEM_DEMO_ITEMS`
- `collectFileSystemDemoFolderPaths`
- `collectFileSystemDemoItemPaths`
- `parseFileSystemDemoState`
- `formatFileSystemDemoState`
- `type FileSystemDemoState`

Keep `file-system-block.tsx` as:

- route/search-param wiring.
- local state mirror.
- `FileSystem` props.

Reason:

The block should prove integration, not hide a second state model and fixture generator.

Recommended module contract:

```ts
export type FileSystemDemoState = {
  path: string
  query: string
  selectedPath: string
  view: FileSystemView
}

export function parseFileSystemDemoState(
  params: URLSearchParams,
  options: {
    fallbackState: FileSystemDemoState
    folderPaths: ReadonlySet<string>
    itemPaths: ReadonlySet<string>
  }
): FileSystemDemoState

export function formatFileSystemDemoState(
  state: FileSystemDemoState,
  fallbackState: FileSystemDemoState
): string
```

Canonical URL rules:

- Omit `path` when it equals the fallback root path.
- Omit `query` when it equals `DEFAULT_FILE_SYSTEM_DEMO_QUERY`.
- Omit `view` when it equals the fallback view.
- Omit `selected` when it equals the fallback selected path.
- Sort emitted params in stable order: `path`, `query`, `selected`, `view`.

Fallback rules:

- Unknown `path` falls back to the fallback path.
- Unknown `selected` falls back to the fallback selected path.
- Unknown `view` falls back to the fallback view.
- Query is accepted as a string but normalized with `.trim()`.
- Selected file can be outside the current folder only when the parsed URL explicitly says so; do not infer hidden selection from query results.

Acceptance:

- `file-system-block.tsx` is under 160 lines.
- URL parse/format helpers are pure and unit-tested.
- Large manifest generation is deterministic and not recreated per render.

### 7. Strengthen Tests Around Public Behavior

Keep existing tests, but reduce private coupling.

Add tests for:

- Pierre adapter path conversion.
- URL parse/format fallback behavior.
- Extracted lazy loader behavior through the component.
- No controlled query partials using `@ts-expect-error`.

Specific test file changes:

- `tests/file-system-index.test.ts`: keep path/index/query tests; remove old tree flattening coverage.
- `tests/file-system.test.tsx`: add component-level lazy load failure coverage and retain open/filter/view assertions.
- `e2e/file-system.spec.ts`: retain URL round-trip and bounded DOM assertions.
- New pure tests may live beside existing tests or in focused files if that keeps each file readable.

Optional cleaner split:

- `tests/file-system-pierre-list-adapter.test.ts`.
- `tests/file-system-demo-state.test.ts`.

Avoid:

- Deep shadow-root assertions except where Pierre exposes no accessible outer DOM alternative.
- CSS-class assertions.
- Timing assertions.

Acceptance:

- Tests prove behavior through roles, ARIA state, URL params, visible text, or pure helper outputs.
- E2E still proves URL round-trip and bounded DOM for 5,000 files.

## Implementation Order

1. Remove obsolete expansion state and flattening exports.
2. Add `file-system-pierre-list-adapter.ts` and move path conversion into it.
3. Add adapter unit tests before changing the list view further.
4. Replace mutable list state with a latest-ref hook and remove the eslint dependency escape.
5. Add `use-file-system-children-loader.ts` and move lazy loading state into it.
6. Update `selectFirstChildAfterEnsure` to use `ensureChildren` results directly.
7. Add `file-system-demo-state.ts` and move demo URL/fixture helpers into it.
8. Update registry metadata and rebuild generated registry output.
9. Run focused tests, e2e, lint, typecheck, and registry build.

Stop after step 3 if the Pierre adapter becomes larger than expected. That would mean the adapter boundary is exposing a real mismatch and should be reviewed before continuing.

## Registry Changes

Add these UI dependencies to the file-system registry item:

- `registry/new-york-v4/ui/file-system-pierre-list-adapter.ts`
- `registry/new-york-v4/ui/use-file-system-children-loader.ts`

Add this block dependency to the file-system block registry item:

- `registry/new-york-v4/blocks/file-system-demo-state.ts`

After `pnpm registry:build`, verify generated output includes the new files in:

- `registry.json`
- `public/r/file-system.json`
- `public/r/file-system-block.json`

## Risks And Guardrails

- Pierre shadow DOM is awkward to test. Prefer pure adapter tests and e2e behavior; keep shadow-root helpers only where Pierre exposes no public role alternative.
- Do not fix unrelated dirty files while doing this pass.
- Do not replace Pierre tree as part of this blueprint.
- Do not change the public `loadChildren` contract.
- Do not remove URL-state e2e coverage.
- Do not add public props to express internal cleanup.

## Verification

Required commands:

```bash
pnpm exec vitest run tests/file-system-index.test.ts tests/file-system.test.tsx
pnpm exec playwright test e2e/file-system.spec.ts
pnpm exec eslint registry/new-york-v4/ui/file-system*.ts registry/new-york-v4/ui/file-system*.tsx registry/new-york-v4/ui/use-file-system*.ts registry/new-york-v4/blocks/file-system-block.tsx tests/file-system*.ts tests/file-system*.tsx e2e/file-system.spec.ts
pnpm exec tsc --noEmit --pretty false
pnpm registry:build
```

Completion audit:

- No dead expansion model remains.
- No eslint disables remain in file-system modules.
- `file-system-list-view.tsx` no longer owns Pierre path conversion.
- `file-system-controller.ts` no longer owns lazy loader request maps.
- File-system block is integration wiring, not helper storage.
- Registry JSON includes every extracted module.
- Browser proof passes on a clean dev server.
- Worktree changes are scoped to file-system code, file-system docs/tests, and generated registry output.

Additional evidence commands:

```bash
rg "expandedPaths|toggleExpanded|flattenFileSystemRows|FileSystemTreeRow" registry/new-york-v4/ui tests/file-system*
rg "eslint-disable-next-line react-hooks/exhaustive-deps" registry/new-york-v4/ui/file-system* registry/new-york-v4/ui/use-file-system*
rg "folderRequests|folderPromises" registry/new-york-v4/ui/file-system-controller.ts
rg "file-system-pierre-list-adapter|use-file-system-children-loader|file-system-demo-state" registry.json public/r/file-system.json public/r/file-system-block.json
wc -l registry/new-york-v4/blocks/file-system-block.tsx
```

Expected results:

- The first command prints nothing.
- The second command prints nothing.
- The third command prints nothing.
- The fourth command finds the new registry files.
- `file-system-block.tsx` is under 160 lines.

## Non-Goals

- No visual redesign.
- No drag-and-drop, rename, delete, upload, permissions, or context menu.
- No gallery keep-alive.
- No new global state library.
- No replacement of Pierre tree unless its API prevents the adapter boundary.
- No compatibility layer for previous internal tree APIs.

## Desired End State

The component can claim the platonic ideal when the remaining code has no obvious deletion candidates, no unclear ownership, no stale state model, no duplicated mechanics, and no test that depends on implementation details without necessity.

At that point the answer to "is this perfect?" should be defensible from code shape, not optimism.
