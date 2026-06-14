# File System State Machine Platonic Blueprint

## Purpose

This blueprint explores a better state-machine design for the file-system component.

The current implementation is good, but not perfect. The provider has been compressed into coherent slices, and the public composition is right:

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

The remaining weakness is lifecycle inevitability.

The component still coordinates:

- path;
- history;
- query;
- view;
- selection;
- lazy folder loading;
- stale async results;
- source resolution;
- preview state;
- open-preview modal state;
- list expansion;
- list focus;
- list reveal behavior;
- Pierre model reset behavior.

The current slice architecture names these pieces clearly, but it still asks the reader to reconstruct the global machine from multiple hooks.

The platonic version should make the file-system lifecycle explicit without making the code more formal than the behavior demands.

## Judgment

The next better design is not another provider and not more controller splitting.

The next better design is:

```txt
one canonical domain kernel
pure reducer transitions
explicit effect commands
small derived selectors
separate local view memory for non-domain UI state
```

The current provider slices are good modular React code. A reducer-plus-effects machine would be better domain code.

But this proposed model is not automatically perfect.

The danger is state-machine maximalism: replacing coordinated hooks with a formal system that is easier to diagram but heavier to read. The ideal is not "everything is a machine." The ideal is the smallest explicit lifecycle model that makes every real transition obvious.

The better target is therefore:

```txt
kernel plus satellites
```

Where:

```txt
FileSystemKernel
  owns durable file-system truth

PreviewSourceTask
  owns selected-entry source resolution

OpenSourceTask
  owns explicit modal-open source resolution

ListMemory
  owns local list expansion, focus, scroll, and reveal memory
```

The kernel should be a true reducer. The satellites should be only as formal as their lifecycle requires. Do not promote every local UI concern into the domain kernel.

## Platonic Proof Standard

This blueprint should not be considered correct because it is conceptually attractive.

It is correct only if implementation proves four things:

```txt
the hard flows become easier to audit
the total lifecycle surface shrinks
the names become more exact
the component remains fast and direct
```

The kernel design fails if it merely relocates complexity from many hooks into:

- a giant reducer;
- a command runner that hides policy;
- selectors that are controllers under another name;
- source tasks with excessive event vocabularies;
- list memory that recreates Pierre complexity in product files.

The ideal implementation should feel less magical than the current slices, not more abstract.

## Invariants

The kernel design should make core truths explicit. These invariants must be true after every reducer transition, after every effect completion, and after every controlled-prop reconciliation.

### Domain Invariants

- `path` is always a normalized folder path.
- `path` either exists in `tree.entriesByPath` as a folder or is the root path.
- `selectionPath` is either `null` or points to an existing entry.
- `history.back` and `history.forward` contain normalized folder paths only.
- `query.search` is stored in user-facing form; normalized search is selector-only derived state.
- `view` is exactly one of `"list"`, `"grid"`, or `"columns"`.
- `tree.childrenByPath` stores child paths only, never child objects.
- every child path in `tree.childrenByPath` resolves to an entry in `tree.entriesByPath`.

### Async Invariants

- a folder in `loading` state always has a `requestId`.
- folder load success mutates the tree only when `requestId` is current for that path.
- folder load failure mutates folder state only when `requestId` is current for that path.
- stale folder success and stale folder failure are no-ops.
- request-id comparison happens in one domain place, not in every caller.
- aborting an async request is an optimization; stale-result rejection must still be correct without abort.

### Callback Invariants

- controlled-prop reconciliation never emits public callbacks.
- public callbacks are emitted only from command execution.
- one user intent emits at most one matching public callback.
- `onPathChange` is not emitted for `history.back` or `history.forward` unless the user action actually requests a path change.
- `onSelectionChange` is emitted only when effective selection changes.
- `onFileOpen` is emitted only after the current explicit open source resolves successfully.

### Source Invariants

- preview source state never owns selection.
- preview source state cannot outlive the selected entry it represents.
- open source state may outlive selection.
- open source state cannot outlive an explicit close.
- unavailable source and failed source are distinct states.
- stale source success and stale source failure are no-ops for both preview and open tasks.

### List-Memory Invariants

- list memory never owns file-system domain truth.
- expanded paths are presentation memory, not canonical folder state.
- focused path is presentation memory, not selection.
- pending reveal may reference a path that is not loaded yet.
- expanded and focused paths should not be treated as proof that an entry exists.
- list memory may ask the kernel to load or select; it may not mutate the kernel directly.

## Invalid States

The implementation should make these states impossible by type, or reject them immediately in reducer/task transitions.

| Invalid State | Required Design Response |
| --- | --- |
| folder `loading` without `requestId` | impossible by `FileSystemFolderLoadState` union |
| folder load success with stale `requestId` mutates tree | rejected in kernel reducer |
| `selectionPath` points to missing entry after tree replacement | clear selection or reject tree replacement |
| selected folder enters preview source `resolving` | impossible by preview source task transition |
| preview source resolves for an entry that is no longer selected | stale no-op |
| open modal reopens after close from stale source success | stale no-op |
| controlled prop reconciliation emits `onPathChange` | impossible by command rules |
| user navigation changes path without history update | impossible by path transition helper |
| query change preserves an invalid pending reveal target | list memory clears or recomputes pending reveal |
| list memory mutates `selectionPath` without a kernel event | impossible by module boundary |

## Compression Metrics

This redesign should reduce the number of places that own lifecycle policy. Do not use raw line count as the main metric. Use auditability metrics.

Track before and after:

| Metric | Platonic Target |
| --- | --- |
| modules that can mutate domain path | 1 kernel reducer |
| modules that can mutate selection | 1 kernel reducer |
| modules that can mutate query/view | 1 kernel reducer |
| modules that compare folder request ids | 1 kernel reducer |
| modules that compare source request ids | 2 source tasks, preview and open |
| modules that emit controlled callbacks | 1 effect runner |
| modules that know about `AbortController` | effect/task runners only |
| modules that know about Pierre | list rendering/model boundary only |
| modules that store expansion/focus/reveal | 1 list-memory module |
| selectors with async, DOM, or Pierre knowledge | 0 |

The redesign fails if these numbers do not improve materially.

## Hardest Flows To Prove

Do not judge the design from the easy flows.

The proof must target the flows that currently create real lifecycle pressure:

### Lazy Folder Loading

Required proof:

- navigate into a lazy folder;
- expand a lazy folder in list view;
- retry a failed lazy folder;
- receive stale success after a newer request;
- receive stale failure after a newer request;
- preserve valid tree state after all of the above.

The kernel should make stale-result rejection obvious from request id comparison in one place.

### Controlled Props

Required proof:

- controlled `path`;
- controlled `query`;
- controlled `view`;
- controlled `selectedPath`;
- uncontrolled equivalents;
- callback emission exactly once per user intent;
- no callback loop when controlled props reconcile back into state.

The kernel should make parent-child reconciliation explicit, not accidental.

### Selected Preview Source Resolution

Required proof:

- selected folder shows folder state;
- selected file resolves source;
- selection changes while source is resolving;
- stale source success is ignored;
- stale source failure is ignored;
- unavailable source is distinct from failed source.

This should live in `PreviewSourceTask`, not the kernel.

### Explicit Open Source Resolution

Required proof:

- double-click file opens resolving modal;
- close aborts or ignores the pending request;
- stale source success cannot reopen a closed modal;
- unavailable file has its own state;
- failed file has its own state;
- `onFileOpen` fires only after successful current open.

This should live in `OpenSourceTask`, not selection or preview.

### List Reveal After Async Expansion

Required proof:

- selected path is revealed when its ancestors are loaded;
- reveal waits when an ancestor is lazy;
- reveal is cancelled when selection changes;
- expansion is preserved when compatible;
- expansion is reset when query/path makes it invalid;
- Pierre reset behavior is described in product language.

This should live in `ListMemory`, not the domain kernel.

## Non-Goals

Do not touch `Viewer`.

Do not put file-system state into viewer primitives.

Do not make Pierre public.

Do not merge preview and open-preview lifecycles.

Do not build a generic state-machine framework.

Do not introduce XState or another runtime unless the existing lifecycle becomes impossible to express cleanly with a reducer.

Do not preserve compatibility shims if this blueprint is implemented. The repo principle is hard cutover.

## Target Mental Model

The final architecture should read like this:

```txt
FileSystemKernel
  owns browser domain state
  accepts domain events
  returns pure state transitions and effect commands

FileSystemKernelEffects
  runs loadChildren and source-resolution side effects
  dispatches success, failure, unavailable, and aborted events
  rejects stale async results by request id

FileSystemKernelSelectors
  derive header, browser, preview, and list inputs
  contain no state and no effects

PreviewSourceTask
  owns selected-entry inline source lifecycle

OpenSourceTask
  owns explicit modal open lifecycle

FileSystemListMemory
  owns local list UI memory only
  owns reset, expansion snapshot, and reveal policy in product language
  never owns file-system domain state

PierreBoundary
  adapts FileSystemListMemory to Pierre input and Pierre rendering
  owns no product policy
```

The important distinction:

```txt
kernel = durable file-system truth
source tasks = async source lifecycles
selectors = projections
list memory = local presentation policy and presentation memory
effects = async I/O
```

If the implementation starts to feel like four independent frameworks, stop. The goal is clarity, not ceremony.

## Latest Correction: Pierre Is Not The Lifecycle

The previous version of this design still left too much conceptual weight in
Pierre-named files:

```txt
file-system-pierre-reset-identity.ts
file-system-pierre-reset-plan.ts
file-system-pierre-expansion-snapshot.ts
```

Those names are accurate for an implementation detail, but wrong for the
product model. They imply that reset behavior belongs to Pierre. It does not.

The reset behavior is a file-system list behavior:

- preserve compatible expansion when the visible item model changes;
- reset expansion when path or query semantics require it;
- snapshot normal expansion per current path;
- expand all directories during semantic query mode;
- restore the path snapshot when exiting semantic query mode;
- filter expansion against the next visible item paths;
- reveal the selected path after async ancestors become available.

Pierre can be used to render and navigate the tree, but Pierre should not own
the language of the product lifecycle.

The corrected boundary is:

```txt
FileSystemListMemory
  create reset identity
  classify reset transition
  create reset plan
  remember expansion snapshot
  resolve expansion after reset
  filter expanded paths against visible items

FileSystemPierre*
  build Pierre input
  inspect Pierre runtime model when necessary
  execute Pierre expansion/focus APIs
  render Pierre rows
```

That is the important refinement. The platonic model is not "make the Pierre
state machine explicit." It is "name the file-system list lifecycle, then let
Pierre be an adapter."

This matters because it deletes one accidental axis of abstraction. The user
cares about list expansion, search, selection reveal, and lazy loading. They do
not care that Pierre is the library that makes the tree fast.

## Core State

The file-system kernel should store only durable domain truth.

```ts
export type FileSystemKernelState = {
  path: string
  history: FileSystemHistoryState
  query: FileSystemQueryState
  view: FileSystemView
  selectionPath: string | null
  tree: FileSystemTreeState
  folders: FileSystemFolderLoadStateByPath
}
```

The name matters. This is not the whole component. It is the kernel of durable truth. Preview source resolution, explicit open source resolution, and list memory are deliberately outside it.

### History

```ts
export type FileSystemHistoryState = {
  back: string[]
  forward: string[]
}
```

Rules:

- `path.changed` pushes the previous path into `back` and clears `forward`.
- `history.back` moves the current path into `forward`.
- `history.forward` moves the current path into `back`.
- programmatic controlled path replacement should be explicit and should not pretend to be user navigation unless the event says so.

### Tree

```ts
export type FileSystemTreeState = {
  entriesByPath: Map<string, FileSystemEntry>
  childrenByPath: Map<string, string[]>
}
```

Rules:

- files and folders are normalized once;
- folders own child paths, not child objects;
- selectors hydrate entries when rendering;
- lazy folder results merge into this tree by path;
- stale load results never mutate the tree.

### Folder Loading

```ts
export type FileSystemFolderLoadState =
  | { status: "idle" }
  | { status: "loading"; requestId: string; reason: FileSystemFolderLoadReason }
  | { status: "loaded" }
  | { status: "failed"; error: string }

export type FileSystemFolderLoadReason =
  | "navigate"
  | "expand"
  | "retry"
  | "reveal-selection"

export type FileSystemFolderLoadStateByPath = Map<
  string,
  FileSystemFolderLoadState
>
```

Rules:

- every async folder load has a request id;
- success only applies when the request id is still current;
- failure only applies when the request id is still current;
- retry is just a new `folder.loadRequested` event with reason `"retry"`;
- no hook should independently decide stale-result validity.

## Kernel Events

The kernel should use domain events, not setter names.

```ts
export type FileSystemKernelEvent =
  | { type: "path.changed"; path: string; source: FileSystemPathChangeSource }
  | { type: "history.back" }
  | { type: "history.forward" }
  | { type: "query.changed"; query: FileSystemQueryState }
  | { type: "view.changed"; view: FileSystemView }
  | { type: "entry.selected"; path: string | null }
  | { type: "entry.openRequested"; path: string }
  | {
      type: "folder.loadRequested"
      path: string
      reason: FileSystemFolderLoadReason
    }
  | {
      type: "folder.loadSucceeded"
      path: string
      requestId: string
      items: FileSystemItem[]
      nextCursor?: string | null
    }
  | {
      type: "folder.loadFailed"
      path: string
      requestId: string
      error: string
    }
```

```ts
export type FileSystemPathChangeSource =
  | "user"
  | "controlled-prop"
  | "history"
  | "reveal"
```

Rules:

- public callbacks are emitted from event handling, not scattered across hooks;
- user actions dispatch events;
- controlled props reconcile through explicit events;
- event names describe what happened, not which setter was called.

## Kernel Commands

The reducer should be pure. It may return commands for effects.

```ts
export type FileSystemKernelResult = {
  state: FileSystemKernelState
  commands: FileSystemKernelCommand[]
}

export type FileSystemKernelCommand =
  | {
      type: "loadFolder"
      path: string
      requestId: string
      reason: FileSystemFolderLoadReason
    }
  | {
      type: "notifyPathChanged"
      path: string
    }
  | {
      type: "notifyQueryChanged"
      query: FileSystemQueryState
    }
  | {
      type: "notifyViewChanged"
      view: FileSystemView
    }
  | {
      type: "notifySelectionChanged"
      entry: FileSystemEntry | null
    }
  | {
      type: "openFile"
      file: FileSystemFileEntry
    }
```

Rules:

- commands are not state;
- commands are the only way effects happen;
- commands are executed by one effect runner;
- command execution may dispatch more events;
- callbacks such as `onPathChange`, `onViewChange`, and `onSelectionChange` are commands, not reducer side effects.

## Reducer Shape

```ts
export function reduceFileSystemKernel(
  state: FileSystemKernelState,
  event: FileSystemKernelEvent
): FileSystemKernelResult
```

The reducer owns:

- navigation state transitions;
- history transitions;
- query and view transitions;
- selection-path transitions;
- folder load request state;
- stale result rejection;
- tree mutation after valid folder load success.

The reducer does not own:

- `loadChildren`;
- `resolveSource`;
- React state;
- DOM focus;
- Pierre expansion;
- scroll;
- rendered entries;
- header shape;
- preview shape.

## Effect Runner

The effect runner should be the only async boundary for domain I/O.

```ts
export function useFileSystemKernelEffects({
  commands,
  dispatch,
  loadChildren,
  callbacks,
}: {
  commands: FileSystemKernelCommand[]
  dispatch: (event: FileSystemKernelEvent) => void
  loadChildren?: FileSystemProps["loadChildren"]
  callbacks: FileSystemKernelCallbacks
})
```

The effect runner owns:

- calling `loadChildren`;
- aborting obsolete folder loads;
- dispatching `folder.loadSucceeded`;
- dispatching `folder.loadFailed`;
- calling public controlled-state callbacks;
- calling `onFileOpen` only after open-preview succeeds, if that lifecycle keeps ownership there.

It should not derive UI state.

## Selectors

Selectors replace wide controller shaping.

```ts
export function selectCurrentEntries(
  state: FileSystemKernelState
): FileSystemEntry[]

export function selectSelectedEntry(
  state: FileSystemKernelState
): FileSystemEntry | null

export function selectHeaderState(
  state: FileSystemKernelState,
  dispatch: FileSystemDispatch,
  title: string
): FileSystemHeaderState

export function selectBrowserState(
  state: FileSystemKernelState,
  dispatch: FileSystemDispatch
): FileSystemBrowserState

export function selectPreviewInput(
  state: FileSystemKernelState
): FileSystemPreviewInput

export function selectListInput(
  state: FileSystemKernelState
): FileSystemListInput
```

Rules:

- selectors must be pure;
- selectors may return callbacks that dispatch events;
- selectors must not read React refs;
- selectors must not call async functions;
- selectors should be easy to test without rendering.

## Preview Source Task

Inline preview should stay separate from open-preview.

Inline preview follows selection:

```txt
selection changes
  -> abort previous selected-entry source request
  -> resolve source for selected file
  -> render unavailable/loading/error/content state
```

State:

```ts
export type FileSystemPreviewSourceState =
  | { status: "empty" }
  | { status: "folder"; folder: FileSystemFolderEntry }
  | { status: "resolving"; file: FileSystemFileEntry; requestId: string }
  | { status: "ready"; file: FileSystemFileEntry; source: ViewerSource }
  | { status: "unavailable"; file: FileSystemFileEntry }
  | { status: "failed"; file: FileSystemFileEntry; error: string }
```

This task should react to selected-entry changes, not own selection.

It does not need a large event vocabulary. A small task API is enough:

```ts
export type FileSystemPreviewSourceAction =
  | { type: "selectionChanged"; entry: FileSystemEntry | null }
  | { type: "sourceResolved"; requestId: string; source: ViewerSource | null }
  | { type: "sourceFailed"; requestId: string; error: string }
```

The task exists because stale source resolution is temporal. It should not become a general preview controller.

## Open Source Task

Explicit file opening should stay separate because it has different semantics:

- it starts from a user command;
- it opens a modal;
- it must not change just because selection changes;
- it must reject stale source-resolution results;
- it calls `onFileOpen` after a successful open.

State:

```ts
export type FileSystemOpenSourceState =
  | { status: "closed" }
  | { status: "resolving"; file: FileSystemFileEntry; requestId: string }
  | { status: "open"; file: FileSystemFileEntry; source: ViewerSource }
  | { status: "unavailable"; file: FileSystemFileEntry }
  | { status: "failed"; file: FileSystemFileEntry; error: string }
```

This can reuse source-resolution effect helpers, but it should not share state with inline preview.

It should also stay small:

```ts
export type FileSystemOpenSourceAction =
  | { type: "openRequested"; file: FileSystemFileEntry }
  | { type: "closed" }
  | { type: "sourceResolved"; requestId: string; source: ViewerSource | null }
  | { type: "sourceFailed"; requestId: string; error: string }
```

The open source task owns modal source lifecycle, not browser selection.

## List Memory

List behavior that was previously expressed through Pierre lifecycle code should
become local list-view memory.

It should own only presentation memory:

```ts
export type FileSystemListMemoryState = {
  expandedPaths: Set<string>
  focusedPath: string | null
  pendingRevealPath: string | null
  modelRevision: string
}
```

Actions:

```ts
export type FileSystemListMemoryAction =
  | { type: "domain.pathChanged"; path: string }
  | { type: "domain.queryChanged"; search: string }
  | { type: "domain.selectionChanged"; path: string | null }
  | { type: "domain.folderLoadSucceeded"; path: string }
  | { type: "row.expanded"; path: string }
  | { type: "row.collapsed"; path: string }
  | { type: "row.focused"; path: string | null }
```

Rules:

- list expansion is not domain truth;
- focused row is not domain truth;
- pending reveal is not domain truth;
- reset identity should be based on list inputs, not Pierre model identity;
- reset plans should speak in visible item paths, not Pierre runtime objects;
- expansion snapshots should be keyed by file-system current path;
- semantic query expansion should be a list-memory mode, not a Pierre mode;
- lazy retry should become a list-memory command that dispatches `folder.loadRequested` to the domain kernel.

Target simplification:

```txt
current scattered concepts:
  Pierre-named reset identity
  Pierre-named expansion snapshot
  Pierre-named reset plan
  lazy retry
  stale child selection prevention
  scroll selected item after reset

new list-memory concepts:
  preserve compatible expansion
  reveal selected path
  retry failed expanded folder
  ignore reveal when selected path no longer exists
```

This should not become a domain peer. It is local memory attached to the list renderer.

### List Reset Identity

The list reset identity should be generic enough to test without Pierre:

```ts
export type FileSystemListMemoryInput<TRuntimeInput = unknown> = {
  itemPaths: readonly string[]
  runtimeInput: TRuntimeInput
}

export type FileSystemListMemoryResetIdentity<TRuntimeInput = unknown> = {
  currentPath: string
  decorationVersion: string
  hasSemanticQuery: boolean
  input: FileSystemListMemoryInput<TRuntimeInput>
}
```

Rules:

- `itemPaths` are the product-visible list paths;
- `runtimeInput` may contain Pierre input, but list memory treats it as opaque;
- identity diffing compares product dimensions first: path, query mode, decoration, and input identity;
- the file-system list may preserve expansion across decoration changes;
- the file-system list should not preserve normal expansion while entering semantic query mode;
- the file-system list should not let query-mode snapshots overwrite normal snapshots.

This makes the reset lifecycle testable with plain strings.

### List Reset Transition

The transition vocabulary should be exactly the policy vocabulary:

```ts
export type FileSystemListMemoryResetTransition<TRuntimeInput = unknown> =
  | { kind: "same"; identity: FileSystemListMemoryResetIdentity<TRuntimeInput> }
  | {
      kind:
        | "path"
        | "query-enter"
        | "query-update"
        | "query-exit"
        | "decoration"
        | "input"
      previous: FileSystemListMemoryResetIdentity<TRuntimeInput>
      next: FileSystemListMemoryResetIdentity<TRuntimeInput>
    }
```

The ordering is policy:

1. `path`
2. `query-enter`
3. `query-update`
4. `query-exit`
5. `decoration`
6. `input`
7. `same`

That order should be visible in code. If a reader has to infer precedence from
effects, refs, or Pierre behavior, the implementation is not platonic.

### List Reset Plan

The reset plan should be the single handoff between list memory and the runtime
renderer:

```ts
export type FileSystemListMemoryResetPlan<TRuntimeInput = unknown> =
  | { kind: "none" }
  | {
      kind: "reset"
      transition: Exclude<
        FileSystemListMemoryResetTransition<TRuntimeInput>,
        { kind: "same" }
      >
      nextItemPaths: string[]
      initialExpandedPaths: string[]
    }
```

Rules:

- `"none"` means no model reset;
- `"reset"` means the list runtime should rebuild from `transition.next.input.runtimeInput`;
- `initialExpandedPaths` is already product-policy resolved;
- the runtime adapter should not reinterpret query/path preservation rules;
- the runtime adapter may only translate product paths into its own model API.

This is the sharpest boundary between file-system policy and Pierre mechanics.

### List Memory Tests

List memory needs pure tests separate from Pierre tests:

- same identity produces no reset;
- path change resets and restores the next path snapshot;
- query enter expands all directory item paths;
- query update keeps all query directories expanded;
- query exit restores the normal snapshot for the current path;
- decoration change preserves compatible expansion;
- input change filters expansion against next item paths;
- query snapshots do not overwrite normal snapshots;
- missing paths are filtered from restored expansion;
- pending reveal is cleared by path changes and search changes when appropriate.

Pierre lifecycle tests should then prove only the adapter:

- it passes the correct `runtimeInput` into the reset;
- it applies `initialExpandedPaths`;
- it remembers snapshots using visible paths;
- it does not duplicate reset policy.

## Controlled Props

Controlled props should reconcile through kernel events.

```txt
path prop changed
  -> dispatch path.changed with source controlled-prop

query prop changed
  -> dispatch query.changed

view prop changed
  -> dispatch view.changed

selectedPath prop changed
  -> dispatch entry.selected
```

Callbacks should be emitted from commands:

```txt
user navigates
  -> reducer returns notifyPathChanged
  -> effect runner calls onPathChange
  -> controlled parent may update path
  -> prop reconciliation dispatches controlled-prop event
```

This makes controlled and uncontrolled behavior auditable.

## File Layout

Target files:

```txt
file-system-kernel.ts
  state, events, reducer, command creation

file-system-kernel-effects.ts
  command runner and async loadChildren lifecycle

file-system-kernel-selectors.ts
  pure selectors for header, browser, preview, list input

file-system-preview-source-task.ts
  selected-entry source task

file-system-open-source-task.ts
  explicit modal-open source task

file-system-list-memory.ts
  list expansion, focus, reveal, reset identity, reset plan, expansion snapshots

file-system-provider.tsx
  wires kernel, effects, preview, open, renderers, context

file-system-parts.tsx
  consumes projections and renders named parts
```

Files to compress or remove after migration:

```txt
file-system-navigation-controller.ts
file-system-query-controller.ts
file-system-selection-controller.ts
file-system-view-controller.ts
file-system-loading-controller.ts
file-system-index-state.ts
file-system-pierre-reset-identity.ts
file-system-pierre-reset-plan.ts
file-system-pierre-expansion-snapshot.ts
```

Do not remove them mechanically first. Migrate behavior into the kernel, then delete the old slices once tests prove parity.

## Implementation Plan

### Phase 0: Prototype The Hardest Flows First

Before replacing provider slices, build the kernel and satellites behind isolated tests for the hardest flows:

- lazy load success, failure, retry, and stale result rejection;
- controlled path/query/view/selection reconciliation;
- selected preview source stale result rejection;
- explicit open source stale result rejection;
- list reveal after async ancestor loading.

This phase answers the real question:

```txt
does the kernel plus satellites model actually compress lifecycle complexity?
```

If the prototype requires a giant reducer, a large command runner, or selectors full of policy, stop and keep the current slice architecture.

### Phase 1: Prove The Kernel In Tests

Add `file-system-kernel.ts` and unit tests.

Test pure transitions:

- default state creation;
- user path change;
- controlled path reconciliation;
- history back and forward;
- query change;
- view change;
- selection change;
- folder load request;
- valid folder load success;
- stale folder load success ignored;
- valid folder load failure;
- stale folder load failure ignored.

No React in this phase.

The kernel tests should read like a lifecycle spec. If they require elaborate fixture ceremony, the model is not platonic yet.

### Phase 2: Add Selectors

Add selector tests:

- current entries for root and folder;
- sorted entries;
- filtered entries;
- selected entry;
- header state;
- browser state;
- list input.

Selectors should expose the same public part states that the current component exposes.

Selectors must be boring. A selector may filter, sort, hydrate, or package callbacks that dispatch kernel events. A selector may not make async decisions, mutate local memory, or decide stale-result validity.

### Phase 3: Wire Provider Behind Existing Parts

Replace provider slice internals with:

```txt
  useReducer(reduceFileSystemKernel)
  useFileSystemKernelEffects(...)
  selectors
  preview source task
  open source task
```

Do not change public JSX composition.

The provider should become wiring:

```txt
create kernel
run kernel effects
run preview source task
run open source task
derive selectors
provide context
```

If provider code still reads like lifecycle policy, the migration is incomplete.

### Phase 4: Move Pierre Lifecycle Into List Memory

Replace scattered Pierre lifecycle hooks with one `file-system-list-memory.ts`.

The list model hook should become:

```ts
const list = useFileSystemListModel({
  input,
  dispatchDomainEvent,
})
```

`useFileSystemListModel` may still use Pierre internally, but it should read as:

```txt
derive Pierre input
apply list-memory state
render Pierre model
dispatch row/list events
```

The list memory code should not import `@pierre/trees` or
`@pierre/trees/react`. Pierre rendering may stay in the list model/view boundary,
but product-language memory transitions should be testable without Pierre.

The hard cutover should delete Pierre-named policy files:

```txt
delete file-system-pierre-reset-identity.ts
delete file-system-pierre-reset-plan.ts
delete file-system-pierre-expansion-snapshot.ts
```

Their concepts must reappear only as list-memory concepts:

```txt
FileSystemListMemoryResetIdentity
FileSystemListMemoryResetTransition
FileSystemListMemoryResetPlan
FileSystemListMemoryExpansionSnapshot
```

The remaining Pierre files may contain adapter words such as `PierreInput`,
`PierrePath`, `PierreModel`, or `PierreTree`. They should not contain product
policy names such as "query enter means expand all directories" except as calls
to list-memory functions.

### Phase 5: Delete Old Slice Controllers

Remove old slice hooks only after:

- behavior tests pass;
- architecture tests prove they are not imported;
- stale scans prove the old model is gone.

### Phase 6: Delete The Prototype Escape Hatches

After wiring succeeds, remove any duplicate paths added during the experiment:

- temporary compatibility adapters;
- old slice-to-kernel bridges;
- alternate provider code paths;
- test-only public exports;
- old names kept only to ease migration.

This repo does hard cutovers. The final tree should contain one architecture, not the old one plus the new one.

## Acceptance Criteria

The redesign is successful only if all of the following are true:

- there is one canonical `FileSystemKernelState`;
- domain changes happen through `FileSystemKernelEvent`;
- the reducer is pure;
- async work is represented as commands;
- stale folder-load results are rejected by request id in one place;
- controlled props reconcile through explicit events;
- header, browser, preview, and list view consume selectors;
- inline preview and explicit open-preview remain separate source tasks;
- expansion/focus/reveal state lives in local list memory;
- reset identity, reset plans, and expansion snapshots are list-memory concepts, not Pierre concepts;
- `file-system-list-memory.ts` imports React at most, and never imports Pierre;
- Pierre files adapt list-memory plans but do not define list-memory policy;
- no viewer primitive owns file-system state;
- no public API mentions Pierre;
- old slice controllers are deleted or reduced to trivial aliases during the same hard cutover;
- tests cover reducer transitions, selectors, controlled props, async stale-result rejection, preview lifecycle, open lifecycle, and list reveal behavior.

Additional proof criteria:

- `file-system-provider.tsx` reads as wiring, not policy;
- `file-system-kernel.ts` contains domain transitions but no React, DOM, Pierre, or source-resolution code;
- `file-system-kernel-effects.ts` runs commands but does not derive UI state;
- selectors do not inspect promises, abort controllers, DOM nodes, or Pierre models;
- source tasks have tiny action vocabularies and do not own browser selection;
- list memory has no source-resolution or file-open state;
- list memory policy is testable with strings and sets, without rendering;
- Pierre adapter tests prove translation only, not product policy;
- the total number of lifecycle concepts is lower than before, not merely redistributed.

## Test Plan

Run:

```bash
bunx vitest run tests/file-system-kernel.test.ts tests/file-system.test.tsx tests/viewer-architecture.test.ts tests/file-system-pierre-input.test.ts tests/file-system-pierre-lifecycle.test.ts
bunx tsc --noEmit --pretty false
bun run registry:build
```

Architecture scans:

```bash
rg "useFileSystemNavigationController|useFileSystemQueryController|useFileSystemSelectionController|useFileSystemViewController|useFileSystemLoadingController" registry/new-york-v4/ui tests
rg "FileSystemNavigationController|FileSystemQueryController|FileSystemSelectionController|FileSystemViewController|FileSystemLoadingController" registry/new-york-v4/ui tests
rg "file-system-pierre-(reset-identity|reset-plan|expansion-snapshot)|FileSystemPierreReset|FileSystemPierreExpansionSnapshot|createFileSystemPierreReset|classifyFileSystemPierreReset|rememberFileSystemPierreExpansionSnapshot|resolveFileSystemPierreExpansionAfterReset|filterFileSystemPierreExpandedPaths|collectFileSystemPierreDirectoryPaths" registry/new-york-v4/ui tests registry.json public/r
rg "SelectedFile|ExplorerPart|FileSystemExplorerState|openedPreview|controller_" registry/new-york-v4 content tests registry.json public/r
```

Expected result:

- first two scans should return no production imports after the cutover;
- stale vocabulary scan should remain empty.

## Risks

### Risk: The Kernel Becomes A God Object

Mitigation:

- kernel owns only durable domain truth;
- preview source, open source, and list UI memory stay separate;
- selectors own projections;
- effects own async I/O.

### Risk: Event Names Become Ceremony

Mitigation:

- use events only for lifecycle boundaries;
- do not dispatch events for local render-only state;
- keep event names concrete and domain-specific.

### Risk: State-Machine Maximalism

Mitigation:

- do not make every satellite a full reducer if a small task hook is clearer;
- source tasks should have tiny action vocabularies;
- list memory should stay local to the list renderer;
- selectors should not become controllers under another name;
- reject abstractions that only make the diagram cleaner.

### Risk: Controlled Props Become Harder

Mitigation:

- model controlled reconciliation as explicit events;
- emit public callbacks as commands;
- test controlled and uncontrolled flows side by side.

### Risk: Pierre Complexity Just Moves

Mitigation:

- list memory must use product-language transitions;
- Pierre-specific runtime details stay in Pierre files;
- reset identity, reset plan, and expansion snapshots stay in list memory;
- Pierre files may adapt but may not own reset policy;
- list-memory tests should not import Pierre.

### Risk: List Memory Becomes A Second Kernel

Mitigation:

- list memory cannot select, open, load, or resolve files directly;
- list memory can only emit local presentation state or ask for a domain event through the browser controller;
- list memory stores paths as presentation memory, not as proof that entries exist;
- kernel remains the only owner of `path`, `selectionPath`, `query`, `view`, and folder load state.

### Risk: Generic Names Become Vague

Mitigation:

- use `ListMemory` only for presentation lifecycle shared by list renderers;
- use `Kernel` only for durable file-system domain truth;
- use `SourceTask` only for stale async source resolution;
- do not introduce a generic `ResetManager`, `LifecycleController`, or `StateMachine` module.

## Final Standard

The kernel redesign is better only if the component becomes easier to audit.

The ideal reader experience:

```txt
open file-system-kernel.ts
  understand every domain state transition

open file-system-kernel-effects.ts
  understand every async effect and stale-result rule

open file-system-kernel-selectors.ts
  understand every projection consumed by the UI

open file-system-list-memory.ts
  understand every list preservation and reveal rule

open file-system-provider.tsx
  see wiring, not hidden policy
```

If the design does not achieve that, the current slice architecture is better.
