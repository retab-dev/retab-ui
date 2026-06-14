# File System Pierre Lifecycle Platonic Blueprint

## Purpose

This blueprint targets the hardest remaining part of `FileSystem`: the Pierre list lifecycle.

The current code is modular, but the state machine is still implicit. The platonic version should make the lifecycle feel inevitable:

- Pierre owns row virtualization, tree expansion, focused path, selected Pierre path, and row rendering.
- File-system owns semantic paths, query, lazy loading, selected file/folder, source resolution, and navigation.
- The adapter owns translation and synchronization between those worlds.

The current split is directionally correct:

```txt
file-system-pierre-input.ts
file-system-pierre-model.ts
file-system-pierre-reset.ts
file-system-pierre-reset-identity.ts
file-system-pierre-order.ts
file-system-pierre-selection.ts
file-system-pierre-expansion.ts
file-system-pierre-expansion-snapshot.ts
file-system-pierre-lazy-retry.ts
file-system-pierre-decoration.ts
file-system-pierre-decoration-version.ts
```

But the lifecycle is still mentally expensive because the reset, expansion, query, retry, and selection rules are distributed across hooks. A reader can inspect each file, but they cannot see the whole state machine at once.

## Current Judgment

Not platonic.

The code is not bad. The complexity is mostly real. The problem is that the lifecycle is encoded as cooperating hooks instead of as an explicit adapter protocol.

Current hidden lifecycle:

1. Build Pierre input from current file-system path and index.
2. Create or update Pierre model.
3. Compare reset identity.
4. Before reset, remember expansion snapshot for the previous identity.
5. Reset order and Pierre paths.
6. Resolve initial expansion for the next identity.
7. Restore selected row visibility.
8. Sync file-system selection into Pierre.
9. React to Pierre selection changes.
10. If selection is a failed lazy folder, retry loading and expand after success.
11. If search is semantic, force directory expansion.
12. Prevent query-mode expansion from overwriting normal expansion.

That is a state machine. It should look like one.

## Platonic Target

The Pierre adapter should read as:

```txt
prepare input
derive lifecycle identity
classify lifecycle transition
capture previous runtime state
derive next model state
apply Pierre reset
sync selection
handle user event
handle async lazy completion
```

The ideal API is not more public API. It is a smaller internal protocol with exact names.

Target mental model:

```ts
type FileSystemPierreLifecycleTransition =
  | { kind: "same" }
  | { kind: "path"; previous: Identity; next: Identity }
  | { kind: "input"; previous: Identity; next: Identity }
  | { kind: "query-enter"; previous: Identity; next: Identity }
  | { kind: "query-update"; previous: Identity; next: Identity }
  | { kind: "query-exit"; previous: Identity; next: Identity }
  | { kind: "decoration"; previous: Identity; next: Identity }
```

Then every lifecycle rule hangs from the transition kind, not from scattered boolean comparisons.

## Core Problem

`FileSystemPierreResetIdentity` is accurate but too mechanical:

```ts
type FileSystemPierreResetIdentity = {
  currentPath: string
  decorationVersion: string
  hasSemanticQuery: boolean
  input: FileSystemPierreInput
}
```

It says what changed. It does not say what the change means.

The lifecycle needs semantic transition names because behavior differs by cause:

- path change: new browser location; restore expansion for that path if known;
- input change: same location, different visible entries; keep compatible expansion;
- query enter: open directories to reveal matches, but preserve normal expansion;
- query update: keep query-open behavior without overwriting normal expansion;
- query exit: restore normal expansion snapshot;
- decoration change: reset row decoration without changing semantic expansion;
- lazy retry success: expand only the retried folder, and only if still present.

Without this vocabulary, the code stays correct by convention rather than by shape.

## Required Invariants

These invariants should become explicit tests and, where useful, named helpers.

### Input Invariants

- Pierre paths are adapter paths, not file-system paths.
- File-system paths never leak into Pierre model calls.
- `entriesByPierrePath` is the only lookup from Pierre row to file-system entry.
- `pierrePaths` is the only ordered path list passed to Pierre.
- Empty directories remain represented when Pierre needs a visible folder row.

### Reset Invariants

- No reset occurs when lifecycle identity is unchanged.
- Every reset has one classified cause.
- Previous expansion is captured before Pierre paths are reset.
- Next expansion is computed before `model.resetPaths`.
- Order resets with the same `pierrePaths` as `model.resetPaths`.
- Selection scroll happens after `model.resetPaths`.

### Expansion Invariants

- Normal expansion and query expansion are separate states.
- Query expansion must not overwrite normal expansion.
- Entering query opens matching directory paths.
- Updating query keeps query expansion policy.
- Exiting query restores the last normal expansion snapshot for the current path.
- Expansion snapshots are scoped by `currentPath`.
- Removed paths are filtered before restoration.

### Selection Invariants

- Pierre selection changes are translated through `entriesByPierrePath`.
- File-system selection sync never selects a stale Pierre path.
- Same-path model resets must not re-emit selection.
- After reset, selected path is scrolled into view if it still exists.
- Lazy async completion must not select a child if the user selected something else before completion.
- Lazy async completion must not select a child if navigation changed before completion.

### Lazy Retry Invariants

- Retry expansion only runs for folders.
- Retry expansion only runs when the folder currently has an error.
- Successful retry expands the same folder Pierre path.
- Failed retry keeps the folder selected and visible.
- Retry success must do nothing if the folder no longer exists in the current Pierre model.

### Decoration Invariants

- Decoration changes may reset Pierre row rendering.
- Decoration changes must not change semantic selection.
- Decoration changes must not erase normal expansion.
- Pierre row decoration transport details stay inside `file-system-pierre-decoration.ts`.

## Proposed File Shape

The current files mostly stay. The missing piece is a lifecycle classifier and a lifecycle plan.

Target files:

```txt
file-system-pierre-lifecycle.ts
file-system-pierre-identity.ts
file-system-pierre-reset.ts
file-system-pierre-expansion-policy.ts
file-system-pierre-expansion-store.ts
file-system-pierre-lazy-retry.ts
file-system-pierre-selection.ts
file-system-pierre-model.ts
```

This is a conceptual target. Do not rename files unless the result is clearer than the current split.

### `file-system-pierre-identity.ts`

Owns identity and transition classification.

Target types:

```ts
export type FileSystemPierreLifecycleIdentity = {
  currentPath: string
  decorationVersion: string
  hasSemanticQuery: boolean
  input: FileSystemPierreInput
}

export type FileSystemPierreLifecycleTransition =
  | { kind: "same"; identity: FileSystemPierreLifecycleIdentity }
  | {
      kind:
        | "path"
        | "input"
        | "query-enter"
        | "query-update"
        | "query-exit"
        | "decoration"
      previous: FileSystemPierreLifecycleIdentity
      next: FileSystemPierreLifecycleIdentity
    }
```

Target helpers:

```ts
createFileSystemPierreLifecycleIdentity(args)
classifyFileSystemPierreLifecycleTransition(previous, next)
```

Classification order should be explicit:

1. Same identity -> `same`.
2. `currentPath` changed -> `path`.
3. `hasSemanticQuery` false to true -> `query-enter`.
4. `hasSemanticQuery` true to true and input changed -> `query-update`.
5. `hasSemanticQuery` true to false -> `query-exit`.
6. `decorationVersion` changed -> `decoration`.
7. `input` changed -> `input`.

This order is a design decision. It prevents ambiguous transitions from being handled differently in different hooks.

### `file-system-pierre-expansion-store.ts`

Owns remembered expansion state.

Target model:

```ts
type FileSystemPierreExpansionMode = "normal" | "query"

type FileSystemPierreExpansionSnapshot = {
  mode: FileSystemPierreExpansionMode
  expandedPierrePaths: Set<PierrePath>
}

type FileSystemPierreExpansionStore = {
  remember(args): void
  restore(args): PierrePath[]
}
```

Rules:

- only normal snapshots can overwrite normal snapshots;
- query snapshots never overwrite normal snapshots;
- snapshots are keyed by `currentPath`;
- restore filters paths against the next input.

The current `source: "normal" | "query"` idea is correct. Rename to `mode` only if it makes the policy clearer.

### `file-system-pierre-expansion-policy.ts`

Owns expansion derivation from lifecycle transition.

Target:

```ts
function resolveFileSystemPierreInitialExpansion({
  transition,
  expansionStore,
}: {
  transition: FileSystemPierreLifecycleTransition
  expansionStore: FileSystemPierreExpansionStore
}): PierrePath[]
```

Policy table:

| Transition     | Initial expansion                            |
| -------------- | -------------------------------------------- |
| `same`         | no reset                                     |
| `path`         | restore snapshot for next path               |
| `input`        | restore compatible snapshot for current path |
| `query-enter`  | all directory paths in next input            |
| `query-update` | all directory paths in next input            |
| `query-exit`   | restore normal snapshot for current path     |
| `decoration`   | restore compatible snapshot for current path |

This table is the heart of the platonic design. The code should look like the table.

### `file-system-pierre-lifecycle.ts`

Owns reset orchestration.

Target:

```ts
function applyFileSystemPierreLifecycleTransition({
  transition,
  model,
  order,
  expansionStore,
  selection,
}: Args): void
```

The function should read in this order:

1. return on `same`;
2. capture previous expansion;
3. compute next expansion;
4. reset order;
5. reset Pierre paths;
6. restore selected row visibility.

No React in this file if possible. React hooks should wrap it from `file-system-pierre-reset.ts`.

### `file-system-pierre-model.ts`

Remains the React composition entry point:

```txt
useFileSystemPierreOrder
useFileSystemPierreExpansionStore
useFileSystemPierreSelection
useFileTree
useResetFileSystemPierreModel
useSyncFileSystemPierreSelection
useBindFileSystemPierreExpansionModel
```

It should not own policy. It should wire policy.

Acceptance: `file-system-pierre-model.ts` should read like a composition root, not a lifecycle implementation.

## Event Model

The lifecycle should be documented as events.

### Event: Input Prepared

Trigger:

- `currentPath` changes;
- `index` changes;
- query changes;
- lazy children load;
- sort-relevant inputs change.

Effect:

- build `FileSystemPierreInput`;
- derive lifecycle identity.

### Event: Lifecycle Identity Changed

Trigger:

- identity differs from previous applied identity.

Effect:

- classify transition;
- apply reset plan.

### Event: Pierre Selection Changed

Trigger:

- user selects a row inside Pierre.

Effect:

- map Pierre path to file-system entry;
- call `controller.selectEntry`;
- if selected entry is failed lazy folder, start retry expansion flow.

### Event: File-System Selection Changed

Trigger:

- external controlled `selectedPath`;
- grid/columns selection;
- file-system controller selection update.

Effect:

- sync Pierre selected path if it exists;
- do not emit duplicate selection;
- scroll selected path into view after reset.

### Event: Lazy Retry Resolved

Trigger:

- `ensureChildren(path, { retry: true })` resolves.

Effect:

- if folder still exists in current model, expand it;
- otherwise no-op.

## What Not To Do

Do not solve this by adding more providers.

Do not move Pierre state into `FileSystemProvider`.

Do not make viewer primitives aware of Pierre or file-system lifecycle.

Do not make `FileViewer` know anything about Pierre.

Do not add compatibility aliases.

Do not add generic state-machine libraries. The lifecycle is small enough to encode directly.

Do not optimize before preserving the invariants with tests.

## Implementation Plan

### Phase 1: Name The Transition

Add a transition classifier next to reset identity.

First implementation can keep existing files:

```txt
file-system-pierre-reset-identity.ts
```

Add:

```ts
type FileSystemPierreResetTransition
classifyFileSystemPierreResetTransition(previous, next)
```

Acceptance:

- each transition kind has direct unit tests;
- no caller manually compares identity fields except the classifier.

### Phase 2: Replace Boolean Policy With Transition Policy

Update expansion restoration to accept a transition instead of `hasSemanticQuery` booleans.

Target:

```ts
resolveFileSystemPierreExpansionAfterTransition({
  transition,
  snapshotsByCurrentPath,
})
```

Acceptance:

- query enter/update/exit are tested separately;
- decoration reset is tested separately;
- path reset is tested separately.

### Phase 3: Make Reset A Plan

Make reset orchestration produce a small plan before applying it.

Target:

```ts
type FileSystemPierreResetPlan = {
  kind: "reset" | "none"
  initialExpandedPaths: PierrePath[]
  nextPierrePaths: PierrePath[]
}
```

Then `useResetFileSystemPierreModel` becomes:

```ts
const transition = classify(...)
const plan = createFileSystemPierreResetPlan(...)
applyFileSystemPierreResetPlan(...)
```

Acceptance:

- plan creation has no React;
- plan application is the only place that calls `model.resetPaths`;
- plan tests do not need a Pierre model.

### Phase 4: Make Lazy Retry A Guarded Command

Current `useFileSystemPierreLazyRetryExpansion` is close. Tighten vocabulary.

Target command:

```ts
type FileSystemPierreLazyRetryCommand = {
  entryPath: string
  pierrePath: PierrePath
}
```

Selection handler should produce the command only when the selection is a failed lazy folder. The retry hook should execute a command, not inspect selection shape itself.

Acceptance:

- command creation is pure and tested;
- execution no-ops if folder is not still present;
- execution expands after successful retry.

### Phase 5: Write The Lifecycle Matrix Tests

Required tests:

- unchanged identity does not reset;
- path transition captures old expansion and restores new path snapshot;
- input transition filters removed expanded paths;
- query-enter opens directory paths and preserves normal snapshot;
- query-update does not overwrite normal snapshot;
- query-exit restores normal snapshot;
- decoration transition does not erase normal expansion;
- same-path selection is not re-emitted after reset;
- selected path scrolls after reset;
- failed lazy folder retry expands after success;
- failed lazy folder retry no-ops after navigation;
- failed lazy folder retry no-ops after folder disappears.

These tests should be mostly pure unit tests over policy functions, plus a few integration tests through `FileSystem`.

## Acceptance Criteria

The Pierre lifecycle is platonic enough when:

- every reset has a named transition kind;
- expansion policy is a table, not scattered conditionals;
- query expansion cannot overwrite normal expansion by construction;
- lazy retry is a guarded command, not a side effect hidden inside selection handling;
- reset plan creation is pure and tested without React;
- Pierre model mutation is limited to one small application function;
- `file-system-pierre-model.ts` is a composition root only;
- the lifecycle matrix is covered by tests;
- no file-system semantic state leaks into viewer primitives;
- no Pierre model object leaks into `FileSystemProvider`.

## Final Shape

The ideal final reading should be:

```ts
const identity = createFileSystemPierreLifecycleIdentity(...)
const transition = classifyFileSystemPierreLifecycleTransition(
  appliedIdentity,
  identity
)
const plan = createFileSystemPierreResetPlan({
  transition,
  expansionStore,
})

applyFileSystemPierreResetPlan({
  plan,
  model,
  order,
})
```

That is the Flaubertian version: exact nouns, exact verbs, no hidden policy.

The current implementation is close enough to evolve into this without a rewrite. The right next move is not more abstraction. It is naming the state machine that already exists.
