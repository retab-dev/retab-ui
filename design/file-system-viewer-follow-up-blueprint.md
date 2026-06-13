# File System Viewer Follow-Up Blueprint

## Purpose

This blueprint defines the next refinement pass after the file-system viewer implementation. The component shape is correct: a source-first document workspace with multiple views, persistent preview, controlled selection, controlled view, and controlled query state. The next pass should make the primitive exact: strict contracts, one interaction model, bounded rendering, and no speculative features.

## Perfection Standard

The pass is successful only if every change satisfies these constraints:

- Simplicity: one direct path for each behavior. No adapters, compatibility shims, duplicate state owners, or secondary code paths.
- Speed: indexing stays linear, filtering stays predictable, virtualized views keep bounded DOM, and keyboard movement does not trigger unnecessary preview work.
- Everything needed: controlled state, lazy navigation, keyboard parity, URL-state proof, registry output, tests, and failure states are covered.
- Nothing more: no drag-and-drop, mutating file operations, permissions, preview keep-alive, state library, visual redesign, or speculative extension points.
- Perfect modularization: controller owns state and async work; chrome owns controls; views own layout; the roving-focus hook owns focus mechanics; query helpers own normalization and serialization.
- High-entropy code: every exported type, helper, and prop must carry real behavior. Remove names, parameters, branches, and comments that do not change understanding or execution.
- Consistent names: use `entry`, `file`, `folder`, `path`, `selectedPath`, `query`, `view`, and `source` exactly for those concepts everywhere.
- Flaubertian precision: choose the smallest API that fully expresses the behavior; every name should be unsurprising and every boundary should be defendable.

## Current Assessment

The implementation now has the right architectural direction:

- `FileSystem` composes controller, chrome, views, preview, and open-dialog behavior.
- `useFileSystemController` owns indexing, navigation, selection, query, lazy children, and source resolution.
- List, grid, columns, and gallery support keyboard selection and opening.
- Query state can be controlled externally.
- Registry output includes the internal file-system modules.
- Tests cover indexing, filtering, selection persistence, controlled query, custom open handling, and the demo e2e path.

The remaining work is not a redesign. It is a precision pass.

## Module Boundaries

The final module ownership should be:

- `file-system.tsx`: public component composition and default open-dialog behavior.
- `file-system-controller.ts`: index lifecycle, navigation, selection, query updates, lazy children, and source resolution.
- `file-system-chrome.tsx`: toolbar, filters, view switcher, search input, and status bar.
- `file-system-navigation.ts`: pure navigation math for offsets, boundaries, and type-ahead.
- `use-file-system-roving-focus.ts`: DOM focus registration, scroll-before-focus, and roving selection helpers.
- View files: list, grid, columns, and gallery layout plus view-specific key semantics only.
- Query/index utility files: pure data functions only; no React and no DOM.

No module should import from a file that owns a higher-level concern.

## Target Changes

### 1. Make Controlled Query Strict

`defaultQuery` should remain partial because defaults are convenience input. Controlled `query` should become a complete `FileSystemQueryState`.

Current shape:

```ts
defaultQuery?: Partial<FileSystemQueryState>
query?: Partial<FileSystemQueryState>
```

Target shape:

```ts
defaultQuery?: Partial<FileSystemQueryState>
query?: FileSystemQueryState
```

Why:

- Controlled state should have a precise owner.
- Partial controlled state hides bugs where callers forget nested fields.
- URL persistence and saved views need stable complete state.

Implementation:

- Keep `createFileSystemQueryState` for `defaultQuery`.
- Accept controlled `query` as already complete.
- Normalize only `defaultQuery`.
- Keep `onQueryChange` emitting complete `FileSystemQueryState`.
- Update tests to use a full query object in controlled mode.

Acceptance:

- TypeScript rejects a controlled `query` missing `filters` or `sort`.
- `defaultQuery={{ search: "pdf" }}` still works.
- No internal branch treats controlled and uncontrolled query differently after the next query value is computed.

### 2. Extract Roving Focus

Grid, columns, and gallery now implement similar keyboard mechanics separately. Extract a small hook that owns the common selection/focus pattern without taking over view-specific semantics.

Target hook:

```ts
function useFileSystemRovingFocus<Entry extends FileSystemNavigationEntry>({
  entries,
  selectedPath,
  onSelect,
  getScrollIndex,
  scrollToIndex,
}: {
  entries: readonly Entry[]
  selectedPath: string | null
  onSelect: (entry: Entry) => void
  getScrollIndex?: (entry: Entry) => number
  scrollToIndex?: (index: number) => void
}) {
  // returns registerEntryRef, focusEntry, selectByOffset, selectBoundary, selectTypeAhead
}
```

Keep out of the hook:

- Column-specific `ArrowLeft` parent selection.
- Column-specific `ArrowRight` child selection.
- Folder opening semantics.
- File opening semantics.

Required behavior:

- Own a single `Map<string, HTMLElement>` for focusable entries.
- Scroll before focusing when a virtualized view supplies `scrollToIndex`.
- Move by offset.
- Move to first or last entry.
- Select by type-ahead.
- Never open files.
- Never navigate folders.
- Never know about columns, gallery, or grid layout names.

Acceptance:

- Grid, columns, and gallery no longer create their own entry ref maps.
- View files keep only their view-specific key decisions.
- Existing keyboard tests pass without weakening assertions.

### 3. Improve Lazy Column Navigation

Column view should select the first child after lazy folder children load.

Current behavior:

- `ArrowRight` selects the first child if children are already indexed.
- If children are lazy, it triggers `ensureChildren`, but there is no post-load selection.

Target behavior:

- If selected folder has children already, select first child immediately.
- If selected folder is lazy, await `ensureChildren`.
- After load resolves, read fresh children and select the first child.
- If load fails, keep selection on the folder and surface the existing folder error.

Implementation:

Add one controller method:

```ts
selectFirstChildAfterEnsure(path: string): Promise<void>
```

The controller owns index freshness and lazy loading; the view should not coordinate async state timing.

Acceptance:

- `ArrowRight` on a folder with loaded children selects the first child synchronously.
- `ArrowRight` on a lazy folder loads children, then selects the first child.
- Load failure leaves selection on the folder and renders the existing error state.
- Column view contains no polling, timeout, or stale closure workaround.

### 4. Add URL-State Proof

The demo block should prove the intended controlled-state pattern. This is not a new state system; it is an integration proof for the existing public API.

State to round-trip:

- `path`
- `selectedPath`
- `view`
- `query.search`
- `query.filters.categories`
- `query.filters.updatedAfter`
- `query.sort.key`
- `query.sort.direction`

Implementation:

- Use the existing app URL-state convention if one exists.
- If no local convention exists, keep this demo-local and explicit.
- Avoid adding a global state library.
- Keep serialization helpers pure if they are shared; otherwise keep serialization private to the demo block.

Why:

- Proves controlled query and view are useful.
- Makes the demo more realistic for document workspaces.
- Gives downstream users a copyable integration pattern.

Acceptance:

- Refreshing the demo restores path, selection, view, search, filters, and sort.
- Invalid URL values fall back to the canonical defaults without throwing.
- URL serialization uses the same field names as `FileSystemQueryState`.

### 5. Add Render-Pressure Coverage

The large-manifest unit test covers indexing and filtering. It does not prove render pressure stays bounded.

Add browser-level checks for a large folder:

- Render a synthetic folder with thousands of files.
- Assert grid mounts only visible tiles plus overscan.
- Assert columns mounts only visible rows plus overscan.
- Assert scrolling preserves selection and does not mount every item.

Do not assert exact timing. Assert bounded DOM size.

Example expectations:

- 5,000 files in a folder.
- Grid DOM options under a small upper bound, such as 250.
- Column DOM options under a small upper bound, such as 250.

Acceptance:

- The test fails if grid or columns renders every file.
- The test does not depend on wall-clock timing.
- Selection remains stable after scrolling far enough to unmount the selected row or tile.

### 6. Keep Gallery Preview Uncached For Now

Do not add gallery keep-alive.

Reasoning:

- The preview source cache already prevents repeated source resolution.
- Keeping multiple heavy viewers mounted can hurt memory.
- The correct next proof is render-pressure and browser profiling, not speculative caching.

Decision:

- Keep one active gallery preview.
- Revisit only with profiling evidence that preview remount cost is the dominant interaction cost.

Acceptance:

- Gallery has one active preview surface.
- Source resolution remains cached by the controller.
- No hidden mounted viewer pool is introduced.

## Test Plan

Unit/component tests:

- Controlled `query` requires and accepts a complete `FileSystemQueryState`.
- `defaultQuery` still accepts partial query input.
- Roving focus works after extraction in grid, columns, and gallery.
- Column `ArrowRight` waits for lazy children and selects the first loaded child.
- Lazy folder load failure keeps selection on the folder.
- No test relies on implementation-only text when a role, state, or visible result can be asserted.

Pure model tests:

- Existing large-manifest index/filter test remains.
- Add query serialization helpers only if URL state is implemented as reusable code.

E2E tests:

- Demo route preserves view/search/filter/sort in the URL.
- Reload restores view/search/filter/sort.
- Large grid and columns demo mounts bounded DOM.
- Gallery still opens files and keeps selection stable.
- Keyboard assertions use roles and ARIA state, not CSS classes.

Verification commands:

```bash
pnpm exec vitest run tests/file-system-index.test.ts tests/file-system.test.tsx
pnpm exec playwright test e2e/file-system.spec.ts
pnpm exec eslint registry/new-york-v4/ui/file-system*.ts registry/new-york-v4/ui/file-system*.tsx tests/file-system*.ts tests/file-system*.tsx e2e/file-system.spec.ts
pnpm exec tsc --noEmit --pretty false
pnpm registry:build
```

## Non-Goals

- Do not redesign the component visually.
- Do not add a new state library.
- Do not add keep-alive previews without profiling evidence.
- Do not add drag-and-drop, rename, delete, upload, or permissions in this pass.
- Do not change the source model or viewer contracts unless a concrete bug requires it.
- Do not create generic hooks or helpers outside the file-system domain.
- Do not add public props for behavior that only one internal view needs.

## Desired End State

The file-system viewer should be a finished primitive:

- Controlled state is strict.
- Defaults are ergonomic.
- Keyboard behavior is implemented once and applied everywhere.
- Lazy columns behave correctly.
- The demo proves URL persistence.
- Large manifests are protected by bounded render tests.
- The code has no spare concepts.
