# File System Viewer Remaining Platonic Gap Blueprint

## Purpose

This blueprint defines the final precision pass after the file-system viewer
was modularized around a controller, Pierre adapter, lazy children loader, demo
state module, and focused tests.

The component is now substantially better than Extend UI's implementation:
Extend still concentrates file-system behavior in a roughly 5,069-line
`components/ui/file-system.tsx`, while Retab now separates public composition,
controller state, lazy loading, Pierre adaptation, views, demo state, and tests.

That is not enough for the platonic ideal. The remaining work is smaller and
stricter: preserve list tree expansion without reintroducing obsolete tree
state, guard async lazy child selection against stale results, and reduce test
coupling to Pierre internals where possible.

## Perfection Standard

This pass is successful only if the component becomes more exact by deletion,
boundary clarification, or provable behavior. Do not add broad feature surface.

- Simplicity: each behavior has one owner and one path through the code.
- Speed: no unnecessary Pierre model resets, no full-list remounts for row
  decoration changes, no async selection from stale user intent.
- Everything needed: expansion continuity, lazy failure behavior, keyboard
  behavior, URL proof, registry output, and verification.
- Nothing more: no public props for internal list state, no compatibility
  shims, no replacement of Pierre, no speculative tree abstraction.
- Perfect modularization: list view owns Pierre wiring; a tiny helper may own
  Pierre expansion capture/restore; controller owns selection intent; loader
  owns requests.
- High-entropy code: no ceremonial hooks or names that hide a one-line fact.
- Consistent variable names: `path`, `folderPath`, `selectedPath`,
  `currentPath`, `entry`, `folder`, and `children` must retain one meaning.
- Flaubertian perfection: every state boundary must be named precisely enough
  that a reader can predict where the behavior lives.

## Current Verdict

The component has not reached the platonic ideal yet.

It is strong and shippable, but these gaps remain:

- List expansion is lost when the Pierre model is recreated.
- Lazy column navigation can select a child after the user's selection has
  moved elsewhere.
- File-system unit tests still reach into Pierre's shadow DOM for behavior
  that should be proven through public roles or pure adapter functions where
  possible.

## Evidence

Current Retab evidence:

- `registry/new-york-v4/ui/file-system-list-view.tsx` creates a new
  `PierreFileTreeModel` when `decorationStateKey`, `paths`, or `hasQuery`
  changes.
- The model receives `initialExpansion: hasQuery ? "open" : "closed"` and no
  restored expansion paths.
- `registry/new-york-v4/ui/file-system-controller.ts` implements
  `selectFirstChildAfterEnsure(path)` by awaiting `ensureChildren(folderPath)`
  and then selecting `children[0]` without checking whether the user's selected
  folder is still that folder.
- `tests/file-system.test.tsx` uses `fileTreeShadowRoot()` to query Pierre
  rows and error text.

Extend comparison:

- Extend preserves expanded folders across list reset/unmount using
  `collectExpandedDirectories`, `expandDirectories`, `treeExpansionRef`, and
  `model.resetPaths`.
- Retab should not copy Extend's monolithic shape, but it should keep the
  behavioral lesson: expansion continuity matters.

## Non-Goals

- No drag-and-drop, rename, delete, upload, permissions, context menu, or
  object-store SDK integration.
- No public API for list expansion state.
- No replacement of `@pierre/trees`.
- No return to the removed `expandedPaths`, `toggleExpanded`, or
  `flattenFileSystemRows` model.
- No broad visual redesign.
- No global state library.

## Required Changes

### 1. Preserve Pierre List Expansion Across Model Rebuilds

Problem:

The list view recreates the Pierre model for legitimate reasons:

- `paths` changes when folder contents, query, sort, or current path changes.
- `hasQuery` changes initial expansion behavior.
- `decorationStateKey` changes when lazy loading/error row decorations change.

When that happens, Pierre loses user-expanded folders. This is especially
visible when a lazy folder changes from loading to error or loaded, because row
decoration changes should not collapse unrelated open directories.

Target behavior:

- User-expanded folders remain expanded across row decoration changes.
- User-expanded folders remain expanded across sort changes when the paths are
  still present.
- When query/filter state becomes active, matching paths may open as they do
  today.
- When query/filter state clears, the pre-query expansion state is restored.
- Expansion is scoped by `currentPath`; navigating to a different folder should
  not leak expansion from another folder.

Implementation shape:

Add a local helper in `file-system-list-view.tsx` unless it grows beyond one
screen. Only extract to `file-system-pierre-expansion.ts` if the helper becomes
large enough to obscure the list view.

Recommended internal state:

```ts
type FileSystemPierreExpansionSnapshot = {
  expandedPaths: string[]
  wasQueryActive: boolean
}
```

Recommended refs:

```ts
const expansionByCurrentPathRef = React.useRef(
  new Map<string, FileSystemPierreExpansionSnapshot>()
)
const previousPathsRef = React.useRef<string[]>(paths)
const previousHasQueryRef = React.useRef(hasQuery)
```

Recommended helper behavior:

```ts
function collectExpandedPierrePaths(
  model: PierreFileTreeModel,
  paths: readonly string[]
): string[] {
  // inspect folder paths only
  // preserve the exact Pierre path strings used by the current model
}

function restoreExpandedPierrePaths(
  model: PierreFileTreeModel,
  expandedPaths: readonly string[]
) {
  // toggle closed folders open
  // no-op when item is missing or already open
}
```

Important constraints:

- Store Pierre-relative paths, not file-system absolute paths.
- Keep this state private to the list view.
- Do not expose it through `FileSystemController`.
- Do not use the old `FileSystemTreeRow` model.
- Do not add `expandedPaths` or `toggleExpanded` anywhere.

Preferred flow:

1. Before cleaning up a model, capture expanded folder paths for the current
   `currentPath`.
2. After the new model mounts, restore captured paths for that same
   `currentPath`.
3. If `hasQuery` is true, open all folder paths that lead to visible matches.
4. When `hasQuery` transitions from true to false, restore the snapshot that
   existed before query mode.
5. Ignore paths that no longer exist after a query/sort/load change.

Acceptance:

- Expanding `reports/`, triggering a lazy loading error elsewhere, and returning
  to the list does not collapse `reports/`.
- Sorting the list does not collapse expanded folders whose paths still exist.
- Starting a search opens ancestors of matches.
- Clearing the search restores the pre-search expansion state.
- `rg "expandedPaths|toggleExpanded|flattenFileSystemRows|FileSystemTreeRow" registry/new-york-v4/ui tests/file-system*` still prints nothing.

Tests:

- Add a component test: `preserves list expansion across folder decoration changes`.
- Add a component test: `restores list expansion after clearing search`.
- Keep any Pierre shadow-root helper only where expansion state cannot be
  observed through accessible outer DOM.

### 2. Guard Lazy Child Selection Against Stale User Intent

Problem:

`selectFirstChildAfterEnsure(path)` awaits async lazy loading and then selects
the first returned child. If the user selects another entry, navigates to
another folder, or changes path before the promise resolves, the old async
result can overwrite the newer intent.

Target behavior:

- `ArrowRight` on a loaded folder still selects the first child immediately.
- `ArrowRight` on a lazy folder selects the first child after load only if the
  selected entry is still that same folder.
- If the user changes selection before the load resolves, do not select the
  stale child.
- If the user navigates away before the load resolves, do not select the stale
  child.
- Load failure keeps selection on the folder and surfaces the folder error.

Implementation shape:

Prefer controller-owned intent validation because the controller owns selection,
current path, and lazy loading.

Recommended state:

```ts
const childSelectionRequestRef = React.useRef(0)
```

Recommended flow:

```ts
const selectFirstChildAfterEnsure = React.useCallback(async (path: string) => {
  const folderPath = normalizeFolderPath(path)
  const requestId = childSelectionRequestRef.current + 1
  childSelectionRequestRef.current = requestId

  const children = await ensureChildren(folderPath)

  if (childSelectionRequestRef.current !== requestId) return
  if (currentPath !== folderPath && selectedPath !== folderPath) return
  if (selectedPath !== folderPath) return

  selectEntry(children[0] ?? null)
}, [currentPath, ensureChildren, selectEntry, selectedPath])
```

That exact condition may need adjustment for the current column behavior. The
principle is fixed: only the still-current folder selection may consume the
async result.

Additional invalidation:

- Increment the request ref when `selectEntry` receives an entry whose path is
  different from the requested folder.
- Increment the request ref when `navigateTo`, `goBack`, or `goForward` changes
  path.

Acceptance:

- A slow lazy load cannot select a child after the user selects another file.
- A slow lazy load cannot select a child after the user navigates away.
- Existing lazy success test still passes.
- Existing lazy failure test still passes.
- No view owns timeout, polling, or request IDs.

Tests:

- Add `does not select a lazy child after selection changes before load resolves`.
- Add `does not select a lazy child after navigation changes before load resolves`.
- Use a manually resolved promise to avoid timing assertions.

### 3. Reduce Pierre Shadow-DOM Test Coupling

Problem:

`tests/file-system.test.tsx` depends on `fileTreeShadowRoot()` for list rows and
row decoration assertions. Some of this is unavoidable because Pierre renders
inside a shadow root, but not all behavior should require piercing it.

Target:

- Pure adapter behavior should live in pure tests.
- URL/demo behavior should live in pure tests and e2e.
- Component tests should prefer accessible roles/text in the light DOM when a
  view other than list can prove the behavior.
- Shadow-root helpers should remain only for behavior that is intrinsically
  Pierre-list-specific.

Allowed shadow-root uses:

- Verifying list-specific row existence when Pierre exposes no light-DOM role.
- Verifying list row decoration text for lazy folder errors.
- Verifying list expansion state if no public role is available.

Disallowed shadow-root drift:

- Using shadow-root queries for behavior already covered by grid/columns/gallery
  roles.
- CSS-class assertions.
- Timing assertions.

Acceptance:

- `tests/file-system-pierre-list-adapter.test.ts` remains the primary proof for
  path conversion.
- `tests/file-system-demo-state.test.ts` remains the primary proof for URL
  parse/format.
- `tests/file-system.test.tsx` has fewer generic list assertions that could be
  proven through public roles.
- Remaining shadow-root helper usage is explicitly list-specific.

### 4. Tighten Generated Registry Scope

Problem:

`pnpm registry:build` emits generated JSON for every dirty registry source. In
a dirty worktree, that can make file-system verification noisy.

Target:

- Registry metadata includes:
  - `registry/new-york-v4/ui/file-system-pierre-list-adapter.ts`
  - `registry/new-york-v4/ui/use-file-system-children-loader.ts`
  - any new list expansion helper if extracted
  - `registry/new-york-v4/blocks/file-system-demo-state.ts`
- Generated output includes those files in:
  - `registry.json`
  - `public/r/file-system.json`
  - `public/r/file-system-block.json`
  - `public/r/registry.json`

Guardrail:

- Do not revert unrelated generated JSON changes.
- Do report when registry build changed non-file-system output because other
  registry sources were already dirty.

## Implementation Order

1. Add stale async selection tests first.
2. Add the request-id or intent-token guard in `file-system-controller.ts`.
3. Run focused file-system tests.
4. Add list expansion preservation tests.
5. Implement private Pierre expansion capture/restore.
6. Reassess shadow-root helper usage and remove any nonessential cases.
7. Update registry metadata only if a new helper file is extracted.
8. Run registry build.
9. Run full verification.

## Verification

Required commands:

```bash
pnpm exec vitest run tests/file-system-index.test.ts tests/file-system-pierre-list-adapter.test.ts tests/file-system-demo-state.test.ts tests/file-system.test.tsx
pnpm exec playwright test e2e/file-system.spec.ts
pnpm exec eslint registry/new-york-v4/ui/file-system*.ts registry/new-york-v4/ui/file-system*.tsx registry/new-york-v4/ui/use-file-system*.ts registry/new-york-v4/blocks/file-system-block.tsx registry/new-york-v4/blocks/file-system-demo-state.ts tests/file-system*.ts tests/file-system*.tsx e2e/file-system.spec.ts
pnpm exec tsc --noEmit --pretty false
pnpm registry:build
```

Audit commands:

```bash
rg "expandedPaths|toggleExpanded|flattenFileSystemRows|FileSystemTreeRow" registry/new-york-v4/ui tests/file-system*
rg "eslint-disable-next-line react-hooks/exhaustive-deps" registry/new-york-v4/ui/file-system* registry/new-york-v4/ui/use-file-system*
rg "folderRequests|folderPromises" registry/new-york-v4/ui/file-system-controller.ts
rg "file-system-pierre-list-adapter|use-file-system-children-loader|file-system-demo-state" registry.json public/r/file-system.json public/r/file-system-block.json public/r/registry.json
wc -l registry/new-york-v4/blocks/file-system-block.tsx
```

Expected results:

- First command prints nothing.
- Second command prints nothing.
- Third command prints nothing.
- Fourth command finds all required registry files.
- `file-system-block.tsx` remains under 160 lines.
- Full `tsc` passes.

## Desired End State

After this pass, the component can credibly answer "yes" to the platonic ideal
question:

- The implementation is simpler than Extend without losing necessary behavior.
- List expansion continuity exists without reviving obsolete expansion state.
- Lazy async selection cannot overwrite newer user intent.
- Tests prove behavior at the most stable boundary available.
- Registry output is complete.
- No obvious deletion candidate or hidden state owner remains.

