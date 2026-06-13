# File System Viewer Platonic Review Blueprint

## Purpose

This blueprint converts the latest review of Extend UI's file-system viewer and
Retab's implementation into the final action plan for reaching the platonic
ideal.

The question is not whether the Retab component is good enough to ship. It is.
The question is whether it has reached perfection under this repository's
standard:

- Simplicity.
- Speed.
- Everything that is needed.
- Nothing more.
- Perfect modularization.
- High-entropy code.
- Perfectly consistent variable names.
- Flaubertian precision.

The current answer is:

Retab has surpassed Extend architecturally and has no known critical behavior
gap, but it has not reached the literal platonic ideal yet.

## Reviewed Sources

Extend sources:

- Public docs: `https://www.extend.ai/ui/docs/components/file-system`.
- Public repository: `https://github.com/extend-hq/ui`.
- Local shallow clone: `/tmp/extend-ui-review-current`.
- Main source reviewed:
  `/tmp/extend-ui-review-current/apps/v4/components/ui/file-system.tsx`.
- Demo block reviewed:
  `/tmp/extend-ui-review-current/apps/v4/registry/new-york-v4/blocks/file-system-block.tsx`.
- Docs source reviewed:
  `/tmp/extend-ui-review-current/apps/v4/content/docs/components/file-system.mdx`.

Retab sources:

- `registry/new-york-v4/ui/file-system.tsx`.
- `registry/new-york-v4/ui/file-system-controller.ts`.
- `registry/new-york-v4/ui/use-file-system-children-loader.ts`.
- `registry/new-york-v4/ui/file-system-pierre-list-adapter.ts`.
- `registry/new-york-v4/ui/file-system-list-view.tsx`.
- `registry/new-york-v4/ui/file-system-grid-view.tsx`.
- `registry/new-york-v4/ui/file-system-columns-view.tsx`.
- `registry/new-york-v4/ui/file-system-gallery-view.tsx`.
- `registry/new-york-v4/ui/file-system-preview.tsx`.
- `registry/new-york-v4/blocks/file-system-block.tsx`.
- `registry/new-york-v4/blocks/file-system-demo-state.ts`.
- `tests/file-system.test.tsx`.
- `tests/file-system-index.test.ts`.
- `tests/file-system-pierre-list-adapter.test.ts`.
- `tests/file-system-demo-state.test.ts`.
- `e2e/file-system.spec.ts`.

## Current Verdict

Retab is closer to the platonic ideal than Extend, but not at absolute
perfection.

The remaining gap is not product scope. The component already has the needed
surface:

- Flat object-store manifest input.
- Explicit folders.
- Lazy folder loading.
- Search.
- Sort.
- Grid, list, columns, and gallery views.
- Keyboard navigation.
- Preview and custom open behavior.
- Folder loading and error states.
- URL-state demo proof.
- Registry output.
- Unit and browser coverage.

The remaining gap is precision:

- One list expansion restore effect should be layout-timed.
- One Pierre model rebuild path should be reconsidered for speed.
- One dependency marker should be named more directly.

These are small, but under the platonic standard they matter.

## Extend Lessons

### What Extend Gets Right

Extend's component has the right product intuition:

- Treat file paths as object-store keys.
- Support explicit folders for lazy traversal.
- Keep thumbnails, signed URLs, parsing, and object storage outside the
  component.
- Provide the four expected inspection modes: grid, list, columns, gallery.
- Keep preview mounting controlled so rapid selection movement does not create
  avoidable work.
- Preserve tree expansion when the list model resets.

The strongest Extend lesson is expansion continuity. A file browser that
collapses open folders after an unrelated decoration or data update feels
imprecise.

### Where Extend Falls Short

Extend's implementation is not the target architecture:

- The main file-system source is roughly 5,069 lines.
- The source concentrates indexing, query behavior, lazy loading, preview
  resolution, view rendering, Pierre tree wiring, selection, and demo concerns
  in one component.
- Lazy loading is embedded in root component state instead of a coherent loader
  boundary.
- Pierre path conversion lives with rendering instead of a tested adapter.
- The registry block is tiny because the UI component owns too much.
- The tree reset path includes a type cast through `unknown`, which signals a
  library-bound workaround rather than a clean local boundary.

Retab should keep Extend's behavior lessons, not Extend's shape.

## Retab Strengths

### Architecture

Retab now has the right module boundaries:

- `file-system.tsx` owns public composition.
- `file-system-controller.ts` owns path, history, selection, query, view, and
  source state.
- `use-file-system-children-loader.ts` owns lazy child requests, de-duplication,
  aborts, and folder errors.
- `file-system-pierre-list-adapter.ts` owns file-system path to Pierre path
  conversion.
- `file-system-list-view.tsx` owns Pierre list view wiring.
- Grid, columns, and gallery views own their own layout and shared roving focus.
- `file-system-demo-state.ts` owns demo URL parsing, formatting, and fixture
  generation.

This is the right direction: one owner per behavior.

### Behavior

Retab already improves on Extend in several important ways:

- Lazy loading can be aborted on unmount.
- Lazy loading request state lives in one hook instead of the root component.
- Stale lazy child selection is guarded by request identity and current
  selection validation.
- Pierre path conversion is pure and unit-tested.
- Expansion is preserved across folder decoration changes and query clear.
- URL state is proven by browser tests.
- Large manifest behavior is covered by bounded DOM tests.

### Code Entropy

Retab's current code is meaningfully higher entropy than Extend's:

- The public component is composition instead of a 5,000-line behavior sink.
- The adapter is small enough that every line expresses path conversion.
- The loader is small enough that every line expresses async request policy.
- The demo block delegates parsing and fixture concerns to a pure module.

## Remaining Platonic Gaps

### Gap 1: Expansion Restore Should Be Layout-Timed

Current state:

- `file-system-list-view.tsx` restores open Pierre paths after model creation.
- The restore is behaviorally correct and covered by tests.
- The effect currently runs after render rather than before paint.

Why this matters:

- A list tree can theoretically paint closed and then reopen.
- Tests may not catch a one-frame visual flash.
- Extend deliberately uses layout timing for expansion restoration.

Platonic target:

- The list should never visibly collapse when restoration is possible.
- Restoration should happen before the browser paints the new tree state.

Required change:

- Move expansion restoration from passive effect timing to layout effect timing.
- Keep the state private to `file-system-list-view.tsx`.
- Do not expose expansion state through the controller.
- Do not reintroduce `expandedPaths`, `toggleExpanded`, `FileSystemTreeRow`, or
  `flattenFileSystemRows`.

Acceptance:

- Existing expansion tests still pass.
- No hydration warning is introduced.
- Browser verification shows no visible collapse on decoration change or query
  clear.
- `rg "expandedPaths|toggleExpanded|flattenFileSystemRows|FileSystemTreeRow" registry/new-york-v4/ui tests/file-system*`
  prints nothing.

### Gap 2: Decoration Changes Rebuild The Pierre Model

Current state:

- `file-system-list-view.tsx` recreates the Pierre model when
  `decorationStateKey` changes.
- Expansion restoration makes this safe.
- Rebuilding the tree model for pure row decoration is probably more work than
  the ideal requires.

Why this matters:

- Loading and error decoration changes are common lazy-loading transitions.
- They should not require rebuilding structural tree state unless Pierre has no
  cheaper supported path.
- Speed includes reader speed: a dependency that exists only to refresh captured
  row decoration deserves a precise name and explanation.

Platonic target:

- Structural changes rebuild the model.
- Decoration-only changes update row rendering without recreating structural
  tree state, if Pierre supports it cleanly.
- If Pierre does not support it cleanly, the rebuild remains, but the code names
  the dependency as a deliberate model revision boundary.

Required investigation:

1. Inspect the `@pierre/trees` API used by `PierreFileTreeModel`.
2. Determine whether row decoration callbacks can observe fresh React state
   without model recreation.
3. Determine whether the model has a supported refresh or invalidation method
   that does not reset paths.
4. If a clean supported path exists, use it.
5. If no clean supported path exists, keep the rebuild and rename the dependency
   marker to make the cost explicit.

Preferred implementation if Pierre supports fresh render state:

- Remove `decorationStateKey` from the model creation dependency list.
- Keep decoration data in a ref with a precise name, for example
  `rowDecorationStateRef`.
- Ensure Pierre row render callbacks read from the current ref.
- Trigger React render through normal state updates, not model recreation.

Fallback implementation if Pierre requires model recreation:

- Rename `decorationStateKey` at the list boundary to a more precise local name,
  for example `modelDecorationRevision`.
- Replace `void decorationStateKey` with a short comment explaining that Pierre
  captures decoration callbacks at model construction.
- Keep expansion restoration layout-timed so the rebuild has no visual collapse.

Acceptance:

- Lazy loading state changes do not collapse open folders.
- Folder error state changes do not collapse open folders.
- Large list interaction remains bounded.
- The code makes the structural-vs-decoration distinction obvious.

### Gap 3: Dependency Marker Is Not Flaubertian

Current state:

- `file-system-list-view.tsx` uses `void decorationStateKey` inside model
  creation.
- This is correct as a dependency marker, but imprecise as prose in code.

Why this matters:

- High-entropy code should not make the reader infer intent from a no-op.
- Flaubertian precision means the chosen name should explain why the dependency
  exists.

Platonic target:

- A reader should immediately know whether a value is:
  - structural tree input,
  - row decoration revision,
  - query expansion policy,
  - or current folder scope.

Required change:

- Rename or locally alias the dependency so it carries the exact concept.
- Prefer `rowDecorationRevision` or `modelDecorationRevision`.
- Avoid generic names like `stateKey`, `version`, or `key`.

Acceptance:

- No behavior change.
- TypeScript and ESLint pass.
- The model creation block reads without hidden dependency intent.

## Non-Goals

Do not use this pass to add new product features.

Out of scope:

- Rename.
- Delete.
- Upload.
- Drag and drop.
- Context menus.
- Permissions.
- Multi-select.
- Object-store SDK integration.
- New public props for tree expansion.
- Replacing `@pierre/trees`.
- Reintroducing the removed hand-rolled tree row model.
- Compatibility shims for old internal names.

## Target Architecture

The final architecture should remain:

```txt
file-system.tsx
  public component composition

file-system-controller.ts
  controlled state, navigation, selection, source cache

use-file-system-children-loader.ts
  lazy children requests, aborts, de-dupe, folder errors

file-system-pierre-list-adapter.ts
  pure path conversion between Retab and Pierre

file-system-list-view.tsx
  Pierre model wiring, expansion snapshot, row rendering

file-system-grid-view.tsx
file-system-columns-view.tsx
file-system-gallery-view.tsx
  view-specific layout

use-file-system-roving-focus.ts
  shared keyboard focus registration

file-system-demo-state.ts
  demo URL state and sample manifest generation
```

Boundary rules:

- No view owns async lazy loading policy.
- No pure utility imports React.
- No controller state exists only for one view's internal tree library.
- No demo parsing logic lives in the public component.
- No adapter reaches into React state.
- No registry block owns reusable data behavior.

## Implementation Plan

### Step 1: Make Expansion Restore Layout-Timed

Edit:

- `registry/new-york-v4/ui/file-system-list-view.tsx`.

Actions:

1. Locate the effect that restores open Pierre paths after model creation.
2. Change it to layout timing.
3. Keep cleanup capture behavior intact.
4. Keep query-mode snapshot protection intact.
5. Re-run focused list expansion tests.

Risk:

- If this package is rendered in an SSR environment, direct `useLayoutEffect`
  can warn.

Mitigation:

- If the component is SSR-exposed, use an isomorphic layout effect local helper:

```ts
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect
```

Keep the helper private to this file unless another component needs the same
timing.

### Step 2: Investigate Pierre Decoration Refresh

Edit only if the API supports a clean path:

- `registry/new-york-v4/ui/file-system-list-view.tsx`.

Actions:

1. Inspect installed `@pierre/trees` types and source.
2. Search for supported refresh, invalidate, update, reset, or render callback
   behavior.
3. Prefer supported API over private field access.
4. Do not patch Pierre internals.

Decision:

- If Pierre supports decoration refresh without model recreation, implement it.
- If it does not, keep the model recreation and move to Step 3.

Acceptance:

- No private Pierre internals are used.
- No `as unknown as` workaround is introduced.
- No new public Retab API exists only to serve Pierre.

### Step 3: Rename The Decoration Dependency

Edit:

- `registry/new-york-v4/ui/file-system-list-view.tsx`.

Actions:

1. Replace ambiguous local naming around `decorationStateKey`.
2. Use a name that says what changes: `rowDecorationRevision` or
   `modelDecorationRevision`.
3. If model recreation remains necessary, add one short comment explaining that
   Pierre captures row decoration at model construction.
4. Do not add a broad abstraction.

Acceptance:

- No `void decorationStateKey` remains.
- The model creation block reads as intentional.
- No unrelated formatting churn.

### Step 4: Re-Verify The Whole Component

Commands:

```bash
pnpm exec vitest run tests/file-system-index.test.ts tests/file-system-pierre-list-adapter.test.ts tests/file-system-demo-state.test.ts tests/file-system.test.tsx
pnpm exec playwright test e2e/file-system.spec.ts
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint registry/new-york-v4/ui/file-system.tsx registry/new-york-v4/ui/file-system-controller.ts registry/new-york-v4/ui/use-file-system-children-loader.ts registry/new-york-v4/ui/file-system-list-view.tsx registry/new-york-v4/ui/file-system-pierre-list-adapter.ts registry/new-york-v4/blocks/file-system-block.tsx registry/new-york-v4/blocks/file-system-demo-state.ts tests/file-system.test.tsx tests/file-system-index.test.ts tests/file-system-pierre-list-adapter.test.ts tests/file-system-demo-state.test.ts e2e/file-system.spec.ts
pnpm registry:build
```

Audit commands:

```bash
rg "expandedPaths|toggleExpanded|flattenFileSystemRows|FileSystemTreeRow" registry/new-york-v4/ui tests/file-system*
rg "eslint-disable-next-line react-hooks/exhaustive-deps" registry/new-york-v4/ui/file-system* registry/new-york-v4/ui/use-file-system*
rg "as unknown as" registry/new-york-v4/ui/file-system* registry/new-york-v4/ui/use-file-system*
```

Expected audit result:

- No legacy tree model names.
- No hooks dependency escape.
- No `as unknown as` Pierre workaround.

## Test Plan

Existing tests that must stay green:

- Query filters files and folders.
- File opening works in all relevant views.
- List keyboard navigation works.
- Lazy folder loading shows loading state.
- Lazy folder error shows row decoration.
- Lazy child selection does not overwrite newer selection.
- Lazy child selection does not overwrite navigation away.
- Expansion survives folder decoration changes.
- Expansion restores after clearing search.
- URL state round-trips in the demo.
- Invalid URL state falls back safely.
- Large manifest rendering stays bounded.

New test only if behavior changes:

- If model recreation is removed for decoration changes, add a focused test that
  proves a folder error updates row decoration without rebuilding the model.

Do not add tests that assert private Pierre implementation details unless no
public observable behavior can prove the requirement.

## Naming Standard

Use these names consistently:

- `entry`: any file-system entry.
- `file`: an entry with `type: "file"`.
- `folder`: an entry with `type: "folder"`.
- `path`: a Retab file-system path.
- `folderPath`: a Retab path known to refer to a folder.
- `currentPath`: the folder currently being viewed.
- `selectedPath`: the selected Retab path.
- `query`: user-entered search text.
- `children`: loaded child entries returned by lazy loading.
- `source`: file content or preview source.
- `pierrePath`: a Pierre-relative path.
- `rowDecorationRevision`: a revision that affects row loading/error
  decoration.
- `modelDecorationRevision`: acceptable only if the revision must rebuild the
  Pierre model.

Avoid:

- `item` when `entry` is meant.
- `node` when `entry` or `folder` is meant.
- `key` when `path` is meant.
- `stateKey` when the exact revision type is known.
- `version` without saying what changed.

## Acceptance Definition

The component reaches the reviewed platonic target when all of the following
are true:

- No known P0 or P1 behavior gaps remain.
- List expansion restoration is layout-timed or proven unnecessary.
- Decoration-only updates do not perform avoidable structural work, or the
  unavoidable work is precisely named and documented.
- The controller does not own view-library state.
- The list view does not own async request policy.
- The loader does not own selection policy.
- The adapter is pure.
- Tests cover every behavior users can observe.
- Registry output includes all required files.
- Audit commands show no removed legacy concepts.
- The public API remains no larger than needed.

## Final Call

After this pass, it is fair to say:

Retab's file-system viewer is the platonic implementation for the current
scope: simpler than Extend, faster by boundary design, complete for the needed
file-browser behavior, and free of unnecessary public surface.

Until this pass is complete, the exact answer remains:

Retab is excellent and architecturally ahead of Extend, but not yet literal
perfection.
