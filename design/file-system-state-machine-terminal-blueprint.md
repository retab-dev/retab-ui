# File System State Machine Terminal Blueprint

## Purpose

This blueprint targets the remaining non-platonic parts of the file-system state
machine after the kernel cutover:

1. `file-system-kernel-effects.ts` still contains too much orchestration.
2. `file-system-list-memory.ts` is correct, but not yet inevitable.

The goal is not to add capability. The goal is to make the lifecycle read like
the lifecycle.

The current system is strong:

- `FileSystemKernelState` owns durable domain truth.
- `FileSystemKernelEvent` owns domain transitions.
- stale folder results are rejected by request id in the reducer.
- preview source and open source are separate tasks.
- reset identity, reset plans, and expansion snapshots are expressed in
  list-memory language instead of Pierre language.
- Pierre is private to the list runtime boundary.

Still, the final design should compress two kinds of mental load:

```txt
kernel effects:
  too many orchestration jobs in one hook

list memory:
  correct policy, but split across reducer state plus expansion-memory helpers
```

This blueprint defines the final state-machine shape.

## Judgment

We have not reached perfection.

The architecture is now correct. The remaining problem is inevitability.

When reading `file-system-kernel-effects.ts`, the reader still has to simulate:

- a React reducer store;
- a `stateRef`;
- a command queue;
- controlled prop reconciliation effects;
- auto-loading for the current path;
- an `ensureChildren` imperative API;
- pending ensure promises;
- path-to-request bookkeeping;
- abort controllers;
- predicted children after success;
- command flushing order.

When reading `file-system-list-memory.ts`, the reader still has to understand
two layers:

- `FileSystemListMemoryState` reducer state;
- `useFileSystemListExpansionMemory` ref-backed expansion snapshot state.

Both are defensible. Neither is perfect.

The terminal design should make this true:

```txt
FileSystemKernelRuntime
  owns one synchronous kernel dispatch loop

FileSystemFolderLoadRuntime
  owns folder request I/O and ensure waiters

FileSystemListMemory
  owns one list-memory state machine, including snapshots, reveal, focus,
  expansion, and reset plans
```

No more hidden second machines inside helper refs.

## Non-Goals

Do not touch `Viewer`.

Do not redesign the public `FileSystem` JSX composition.

Do not make Pierre public.

Do not add XState or another generic state-machine framework.

Do not add compatibility shims.

Do not preserve old controller names.

Do not widen public API to expose internal state machines.

Do not make the file-system component smaller by deleting real behavior.

## Target File Layout

Final target:

```txt
file-system-kernel.ts
  pure domain state, events, reducer, command types

file-system-kernel-runtime.ts
  synchronous dispatch loop, command queue, state ref, React subscription

file-system-kernel-command-effects.ts
  public callback commands and open-file command execution

file-system-folder-load-runtime.ts
  loadChildren requests, AbortController, ensure waiters

file-system-controlled-props.ts
  controlled prop reconciliation into kernel events

file-system-kernel-selectors.ts
  pure projections only

file-system-preview-source-task.ts
  selected-file source lifecycle

file-system-open-source-task.ts
  explicit modal-open source lifecycle

file-system-list-memory.ts
  one list-memory reducer covering reset identity, snapshots, focus,
  expansion, reveal, and reset commands

file-system-pierre-expansion.ts
  Pierre adapter that collects open paths and applies list-memory commands

file-system-pierre-reset.ts
  Pierre adapter that translates list-memory reset commands into model.resetPaths
```

Allowed dependency direction:

```txt
provider
  -> kernel-runtime
  -> controlled-props
  -> kernel-command-effects
  -> folder-load-runtime
  -> kernel
  -> selectors

list-tree
  -> list-memory
  -> pierre adapter
```

Forbidden dependency direction:

```txt
kernel -> React
kernel -> Pierre
kernel -> DOM
selectors -> AbortController
selectors -> Pierre
list-memory -> Pierre
list-memory -> FileViewer
folder-load-runtime -> DOM
folder-load-runtime -> public JSX parts
```

## State Machine 1: Kernel Runtime

### Current Problem

`file-system-kernel-effects.ts` currently does all of this:

```txt
create initial kernel state
hold reducer store
hold latest state ref
build dispatch
build getState
build ensureChildren
reconcile controlled props
ensure current path children
flush reducer commands
run public callbacks
run open-file command
run folder load command
abort folder requests
resolve pending ensure promises
predict children after success by reducing a success event manually
```

The file is named like an effect runner, but it is really:

```txt
runtime store + prop reconciler + command runner + folder load broker
```

That is the wrong compression.

### Terminal Model

Split the runtime into three explicit machines:

```txt
FileSystemKernelRuntime
  synchronous kernel dispatch, state ref, command queue

FileSystemKernelCommandEffects
  execute callback/open-file commands

FileSystemFolderLoadRuntime
  execute load-folder commands and ensureChildren waiters
```

The runtime should expose:

```ts
export type FileSystemKernelRuntime = {
  dispatch: FileSystemDispatch
  ensureChildren: FileSystemEnsureChildren
  getState: () => FileSystemKernelState
  state: FileSystemKernelState
}
```

The public shape can stay the same. The internals should become exact.

## Synchronous Kernel Dispatch

### Current Problem

The current hook uses `React.useReducer` and then mirrors state into `stateRef`.
That is good enough for React rendering, but it creates the need to predict the
post-success children in `runLoadFolderCommand`:

```ts
const predicted = reduceFileSystemKernel(getState(), successEvent).state
const entries = selectFileSystemKernel({ state: predicted }).index.children.get(
  command.path
) ?? []

dispatch(successEvent)
resolvePendingEnsure({ entries, ... })
```

That prediction is correct, but it is not beautiful.

The effect runner should not need to simulate the reducer to know what a
completed `ensureChildren` should resolve.

### Target

Create a tiny synchronous kernel store:

```ts
type FileSystemKernelRuntimeStore = {
  getState: () => FileSystemKernelState
  dispatch: (event: FileSystemKernelEvent) => FileSystemKernelResult
  subscribe: (listener: () => void) => () => void
  consumeCommands: () => FileSystemKernelCommand[]
}
```

Implementation principle:

```ts
function dispatch(event) {
  const result = reduceFileSystemKernel(stateRef.current, event)

  if (result.state !== stateRef.current) {
    stateRef.current = result.state
    emit()
  }

  commandQueue.push(...result.commands)
  scheduleCommandFlush()

  return result
}
```

React reads it through either:

```ts
useSyncExternalStore(store.subscribe, store.getState, store.getState)
```

or a minimal `useState` tick if the existing app constraints make
`useSyncExternalStore` unnecessary.

The important property:

```txt
dispatch(event) synchronously updates getState()
```

Then folder load completion becomes:

```ts
runtime.dispatch(successEvent)
const entries = selectFolderChildren(runtime.getState(), path)
folderLoadRuntime.resolve(requestId, entries)
```

No prediction.

### Invariants

- `dispatch` is the only way to mutate kernel state.
- `dispatch` returns the reducer result synchronously.
- `getState()` returns the current state immediately after `dispatch`.
- command execution never mutates state directly.
- command execution may dispatch follow-up events.
- public callbacks are still commands, not reducer side effects.

### Rejected Alternatives

Do not keep predicting children by manually reducing success events in the
effect runner.

Do not add a second reducer for effect state inside React.

Do not make `ensureChildren` wait for React render before resolving.

Do not move folder child selection into the folder load runtime.

## Command Queue

### Current Problem

Commands are stored inside React reducer state:

```ts
type FileSystemKernelStore = {
  commands: FileSystemKernelCommand[]
  state: FileSystemKernelState
}
```

That works, but it makes commands look like durable state. They are not durable
state. They are an effect queue.

### Target

Command queue lives beside the synchronous kernel store:

```ts
type FileSystemCommandQueue = {
  push: (commands: FileSystemKernelCommand[]) => void
  consume: () => FileSystemKernelCommand[]
}
```

Rules:

- commands are appended during synchronous dispatch;
- commands are consumed exactly once;
- command flushing is scheduled after dispatch;
- if command execution dispatches more events, those commands are queued for the
  next flush pass;
- command queue is never serialized into public context;
- command queue never appears in selectors.

### Command Effect Ownership

Move callback/open-file commands to `file-system-kernel-command-effects.ts`:

```ts
export function useFileSystemKernelCommandEffects({
  consumeCommands,
  folderLoads,
  callbacks,
}: {
  consumeCommands: () => FileSystemKernelCommand[]
  folderLoads: FileSystemFolderLoadRuntime
  callbacks: FileSystemKernelCallbacks
}) {
  // flush loop
}
```

Callback commands:

```txt
notifyPathChanged -> onPathChange
notifyQueryChanged -> onQueryChange
notifyViewChanged -> onViewChange
notifySelectionChanged -> onSelectionChange
openFile -> openPreview.open
loadFolder -> folderLoads.load(command)
```

`file-system-kernel-runtime.ts` owns queue mechanics.

`file-system-kernel-command-effects.ts` owns command side effects.

`file-system-folder-load-runtime.ts` owns folder I/O.

## Controlled Prop Reconciliation

### Current Problem

Controlled prop reconciliation is embedded in the same file as request I/O.

That makes `file-system-kernel-effects.ts` look broader than it is.

### Target

Move controlled prop reconciliation to:

```txt
file-system-controlled-props.ts
```

API:

```ts
export function useFileSystemControlledProps({
  dispatch,
  path,
  query,
  selectedPath,
  view,
}: {
  dispatch: FileSystemDispatch
  path?: string
  query?: FileSystemQueryState
  selectedPath?: string | null
  view?: FileSystemView
}) {
  // effects that dispatch controlled-prop events
}
```

Rules:

- controlled prop reconciliation dispatches events;
- controlled prop reconciliation never calls public callbacks directly;
- controlled prop reconciliation never reads folder load runtime state;
- controlled prop reconciliation never runs source resolution;
- controlled prop reconciliation never knows about Pierre.

This file is intentionally small. It exists to make the kernel runtime read as
runtime, not prop plumbing.

## Folder Load Runtime

### Current Problem

Folder loading currently mixes three concepts:

```txt
request execution
ensureChildren promise waiters
path-to-request dedupe
```

The maps are all in `file-system-kernel-effects.ts`:

```ts
abortControllersRef
pendingEnsuresRef
pendingPathRequestsRef
requestSequenceRef
```

The implementation is correct, but the shape is not obvious.

### Terminal Model

Create:

```txt
file-system-folder-load-runtime.ts
```

It should own the folder request machine:

```ts
export type FileSystemFolderLoadRuntime = {
  ensureChildren: FileSystemEnsureChildren
  runLoadFolderCommand: (
    command: Extract<FileSystemKernelCommand, { type: "loadFolder" }>
  ) => void
  abortAll: () => void
}
```

Internal state:

```ts
type FolderLoadRuntimeState = {
  requestsByPath: Map<string, FolderLoadRequest>
  waitersByRequestId: Map<string, FolderLoadWaiter[]>
  nextRequestNumber: number
}

type FolderLoadRequest = {
  abortController: AbortController
  path: string
  requestId: string
}

type FolderLoadWaiter = {
  resolve: (entries: FileSystemEntry[]) => void
}
```

The important compression:

```txt
requestsByPath owns in-flight request identity
waitersByRequestId owns promises waiting for that request
kernel owns whether a request is current
```

Do not split request identity between two maps with unclear responsibilities.
Use names that say exactly what they own.

### ensureChildren Protocol

`ensureChildren(path, options)` should be a runtime command, not a second source
of domain truth.

Algorithm:

```txt
normalize folder path
read current kernel state
if no loadChildren, resolve visible children
if folder does not have children, resolve visible children
if raw children already loaded and not retry, resolve visible children
if matching in-flight request exists and not retry, attach waiter
otherwise create request id
register waiter
dispatch folder.loadRequested
return waiter promise
```

This is almost what exists today. The improvement is containment and naming.

### runLoadFolderCommand Protocol

Algorithm:

```txt
receive loadFolder command
abort previous request for path
create AbortController
store request in requestsByPath
call loadChildren pages until cursor ends or abort
if aborted:
  resolve waiters with current visible children
  stop
dispatch folder.loadSucceeded
read current visible children from kernel runtime
resolve waiters
on failure:
  if not aborted, dispatch folder.loadFailed
  resolve waiters with current visible children
finally:
  clear request only if still current request for path
```

The terminal version differs from today in one key way:

```txt
dispatch success first, then read current state
```

No predicted reducer call.

### Why The Kernel Still Owns Stale Rejection

The folder load runtime should not decide whether a result is stale.

It may abort older requests. It may avoid resolving the wrong request. But the
authoritative stale-result check stays here:

```txt
reduceFolderLoadSucceeded
reduceFolderLoadFailed
```

The runtime may optimize. The kernel proves correctness.

### Folder Load Runtime Invariants

- one in-flight request per folder path;
- many ensure waiters may attach to one request;
- retry creates a new request;
- creating a new request aborts the previous request for the same path;
- aborting does not imply correctness;
- stale reducer rejection is still required;
- waiters resolve exactly once;
- waiters resolve with visible children, not raw children;
- if a request is aborted, waiters resolve with current visible children;
- if a request fails, waiters resolve with current visible children;
- if a request succeeds, waiters resolve after the kernel has accepted or
  ignored the success event.

### Folder Load Runtime Tests

Add focused tests for this module, ideally without rendering:

- `ensureChildren` returns current children when no `loadChildren`;
- `ensureChildren` returns current children when folder already loaded;
- duplicate ensure attaches to one in-flight request;
- retry creates a new request and aborts old request;
- successful load dispatches `folder.loadSucceeded`;
- failed load dispatches `folder.loadFailed`;
- aborted load does not dispatch failure;
- waiters resolve exactly once;
- waiters resolve from post-dispatch state;
- stale success still resolves waiters with current children, not stale items.

These tests should make `file-system.test.tsx` less responsible for proving
request internals.

## State Machine 2: List Memory

### Current Problem

`file-system-list-memory.ts` has two overlapping structures:

```txt
FileSystemListMemoryState reducer:
  expandedPaths
  focusedPath
  pendingRevealPath
  modelRevision

useFileSystemListExpansionMemory:
  snapshotsByCurrentPathRef
  createResetPlan
  rememberBeforeReset
  resolveAfterReset
```

This is good, but not final.

The conceptual state machine is one thing:

```txt
visible list memory across path, query, selection, decoration, input,
runtime reset, and row interaction
```

The file should make that one thing explicit.

### Terminal Model

Replace the reducer-plus-helper split with one list memory state machine:

```ts
export type FileSystemListMemoryState<TRuntimeInput = unknown> = {
  currentIdentity: FileSystemListMemoryResetIdentity<TRuntimeInput>
  expandedPaths: Set<string>
  focusedPath: string | null
  pendingRevealPath: string | null
  revision: FileSystemListMemoryRevision
  snapshotsByCurrentPath: Map<string, FileSystemListMemoryExpansionSnapshot>
}
```

The hook receives current identity inputs:

```ts
export function useFileSystemListMemory<TRuntimeInput>({
  currentPath,
  decorationVersion,
  hasSemanticQuery,
  input,
  selectedPath,
}: FileSystemListMemoryProps<TRuntimeInput>): FileSystemListMemoryRuntime<TRuntimeInput>
```

Return:

```ts
export type FileSystemListMemoryRuntime<TRuntimeInput = unknown> = {
  commands: FileSystemListMemoryCommand<TRuntimeInput>[]
  dispatch: (event: FileSystemListMemoryEvent<TRuntimeInput>) => void
  state: FileSystemListMemoryState<TRuntimeInput>
}
```

This makes reset policy and local row memory one machine.

## List Memory Events

Use events, not helper method names:

```ts
export type FileSystemListMemoryEvent<TRuntimeInput = unknown> =
  | {
      type: "domain.changed"
      identity: FileSystemListMemoryResetIdentity<TRuntimeInput>
    }
  | { type: "domain.selectionChanged"; path: string | null }
  | { type: "domain.folderLoadSucceeded"; path: string }
  | { type: "runtime.beforeReset"; expandedItemPaths: Iterable<string> }
  | { type: "runtime.resetApplied" }
  | { type: "row.expanded"; path: string }
  | { type: "row.collapsed"; path: string }
  | { type: "row.focused"; path: string | null }
```

There are two categories:

```txt
domain events:
  path/query/input/selection/folder load changed

runtime events:
  Pierre or another tree runtime is about to reset / has reset
```

Pierre can dispatch runtime events. It cannot decide product policy.

## List Memory Commands

The list memory reducer should return commands:

```ts
export type FileSystemListMemoryCommand<TRuntimeInput = unknown> =
  | {
      type: "runtime.resetRequested"
      initialExpandedPaths: string[]
      nextItemPaths: string[]
      runtimeInput: TRuntimeInput
    }
  | { type: "runtime.revealRequested"; path: string }
```

Optional future command:

```ts
  | { type: "domain.loadFolderRequested"; path: string; reason: "reveal-selection" }
```

Only add the domain load command if reveal truly needs list memory to request
ancestor loads. Do not add it speculatively.

### Why Commands Matter

Today `createResetPlan` is called imperatively by Pierre reset code. That means
the reader must inspect both files to understand the reset lifecycle.

In the terminal shape:

```txt
domain.changed event
  -> reducer classifies transition
  -> reducer stores snapshot policy
  -> reducer returns runtime.resetRequested command

Pierre adapter
  -> executes runtime.resetRequested
  -> dispatches runtime.resetApplied
```

The policy lives in one reducer.

The adapter executes.

## List Memory Transition Table

The transition table is the heart of the design.

| Event | Condition | State Change | Command |
| --- | --- | --- | --- |
| `domain.changed` | identity unchanged | none | none |
| `domain.changed` | path changed | set `currentIdentity`; clear focus; clear pending reveal; restore snapshot for next path | `runtime.resetRequested` |
| `domain.changed` | query enters semantic mode | set `currentIdentity`; clear pending reveal; keep normal snapshot untouched | `runtime.resetRequested` with all directory paths expanded |
| `domain.changed` | query updates while semantic | set `currentIdentity` | `runtime.resetRequested` with all directory paths expanded |
| `domain.changed` | query exits semantic mode | set `currentIdentity`; restore normal snapshot for current path | `runtime.resetRequested` |
| `domain.changed` | decoration changed | set `currentIdentity`; preserve compatible current expansion | `runtime.resetRequested` |
| `domain.changed` | input changed | set `currentIdentity`; filter current expansion by next item paths | `runtime.resetRequested` |
| `runtime.beforeReset` | current mode is normal | write normal snapshot for current path | none |
| `runtime.beforeReset` | current mode is query and normal snapshot exists | do not overwrite normal snapshot | none |
| `runtime.beforeReset` | current mode is query and no normal snapshot exists | may write query snapshot | none |
| `runtime.resetApplied` | pending reveal exists and path is visible | keep or emit reveal command | `runtime.revealRequested` |
| `domain.selectionChanged` | path changed | set pending reveal | maybe `runtime.revealRequested` |
| `domain.folderLoadSucceeded` | loaded path is ancestor of pending reveal | bump revision or reveal | `runtime.revealRequested` |
| `row.expanded` | row expands | add to `expandedPaths` | none |
| `row.collapsed` | row collapses | remove from `expandedPaths` | none |
| `row.focused` | focus changes | set `focusedPath` | none |

The code should read like this table.

## List Memory State Shape

### Revision

Replace stringly `modelRevision` with a typed revision:

```ts
export type FileSystemListMemoryRevision =
  | { type: "initial"; nonce: number }
  | { type: "path"; path: string; nonce: number }
  | { type: "query"; search: string; nonce: number }
  | { type: "reveal"; path: string; nonce: number }
```

If the revision exists only to force a tree runtime to reconsider state, name it
as such:

```ts
runtimeRevision
```

Avoid opaque strings like:

```txt
path:reports/
query:abc
reveal:reports/report.pdf
```

They are convenient, but they hide state shape in string construction.

### Snapshots

Snapshots should be durable list memory state:

```ts
snapshotsByCurrentPath: Map<string, FileSystemListMemoryExpansionSnapshot>
```

Not a separate ref in a helper hook.

Snapshot rules:

- normal mode snapshot is authoritative;
- query mode cannot overwrite a normal snapshot for the same current path;
- snapshots are keyed by file-system current path;
- snapshots store visible item paths, not runtime objects;
- snapshots are filtered against next item paths before being used;
- missing paths are discarded;
- root path snapshot key is `""`, not `"/"`.

### Expanded Paths

There are two concepts today:

```txt
expandedPaths in reducer state
expandedItemPaths captured from runtime model
```

The terminal design must choose deliberately.

Preferred model:

```txt
expandedPaths = local memory of explicit row interactions
expandedItemPaths from runtime = authoritative snapshot at reset boundary
```

If `expandedPaths` is not read by the runtime, either:

1. wire it into reset policy; or
2. delete it.

Do not keep ornamental state.

### Focused Path

If `focusedPath` is only written and not used, either:

1. use it to restore focus after reset; or
2. delete it.

The terminal version should not store focus unless it can prove why.

### Pending Reveal

`pendingRevealPath` is real. It should stay.

Rules:

- selection change sets pending reveal;
- path change clears pending reveal;
- entering semantic query clears pending reveal;
- folder load success checks whether loaded path is an ancestor of pending
  reveal;
- reset applied should request reveal if the selected path is present;
- stale selected paths are ignored by checking against current visible item
  paths.

## List Memory Adapter Boundary

Pierre should provide only runtime facts:

```ts
type FileSystemTreeRuntimeAdapter<TRuntimeInput> = {
  collectExpandedItemPaths: () => string[]
  reset: (command: Extract<FileSystemListMemoryCommand<TRuntimeInput>, {
    type: "runtime.resetRequested"
  }>) => void
  reveal: (path: string) => void
}
```

Pierre code may:

- collect expanded paths from the Pierre model;
- call `model.resetPaths`;
- call `model.scrollToPath`;
- read focused path if needed for focus restoration;
- translate a Pierre path to a file-system entry on user action.

Pierre code may not:

- classify list transitions;
- decide query enter/update/exit behavior;
- own snapshots;
- decide whether query snapshots overwrite normal snapshots;
- decide path snapshot keys;
- decide stale selected path policy.

## Implementation Plan

### Phase 1: Extract Kernel Command Effects

Create:

```txt
file-system-kernel-command-effects.ts
```

Move command flushing out of `file-system-kernel-effects.ts`.

Keep behavior unchanged.

Acceptance:

- `file-system-kernel-effects.ts` no longer contains public callback switch;
- command effect tests or architecture assertions prove callback commands stay
  out of the reducer;
- focused file-system tests still pass.

### Phase 2: Extract Controlled Prop Reconciliation

Create:

```txt
file-system-controlled-props.ts
```

Move the four controlled prop effects:

```txt
path -> path.changed / controlled-prop
query -> query.changed / controlled-prop
view -> view.changed / controlled-prop
selectedPath -> entry.selected / controlled-prop
```

Acceptance:

- kernel runtime no longer mentions controlled prop names except in hook
  arguments;
- controlled tests still pass;
- controlled reconciliation still emits no public callbacks.

### Phase 3: Extract Folder Load Runtime Without Behavior Change

Create:

```txt
file-system-folder-load-runtime.ts
```

Move:

- `abortControllersRef`;
- `pendingEnsuresRef`;
- `pendingPathRequestsRef`;
- `requestSequenceRef`;
- `ensureChildren`;
- `runLoadFolderCommand`;
- waiter resolution helpers.

Acceptance:

- kernel runtime imports `useFileSystemFolderLoadRuntime`;
- folder load runtime owns `AbortController`;
- no selector imports `AbortController`;
- stale folder tests still pass;
- lazy retry tests still pass.

### Phase 4: Replace Predicted Children

Introduce synchronous kernel dispatch.

Options:

1. `useSyncExternalStore` kernel store.
2. Minimal ref-backed store plus `useState` render tick.

Preferred shape:

```ts
const kernelStore = useFileSystemKernelStore(initialState)
const state = useSyncExternalStore(
  kernelStore.subscribe,
  kernelStore.getState,
  kernelStore.getState
)
```

Then folder load success does:

```ts
runtime.dispatch(successEvent)
resolveWaiters(selectVisibleChildren(runtime.getState(), path))
```

Acceptance:

- no `predicted` variable in folder load runtime;
- no manual success-event reduction in effects;
- waiters resolve from current state after dispatch;
- stale load rejection still lives in the kernel reducer.

### Phase 5: Collapse List Memory Into One Reducer

Refactor `file-system-list-memory.ts` so snapshots live in
`FileSystemListMemoryState`.

The list memory reducer should return:

```ts
type FileSystemListMemoryResult<TRuntimeInput> = {
  commands: FileSystemListMemoryCommand<TRuntimeInput>[]
  state: FileSystemListMemoryState<TRuntimeInput>
}
```

Delete separate `useFileSystemListExpansionMemory`.

Acceptance:

- there is one list-memory hook;
- snapshots are part of list-memory state;
- reset plans are commands;
- Pierre adapter executes commands only;
- list-memory tests do not import Pierre.

### Phase 6: Delete Ornamental List State

Audit:

```txt
expandedPaths
focusedPath
runtimeRevision/modelRevision
pendingRevealPath
```

For each field:

- prove it changes behavior; or
- delete it.

Acceptance:

- no list-memory field is write-only;
- no revision string encodes state that should be typed;
- tests fail if a supposedly meaningful field is removed.

### Phase 7: Strengthen Architecture Tests

Add assertions:

```txt
file-system-kernel-runtime.ts:
  contains synchronous dispatch
  does not contain AbortController
  does not contain loadChildren paging loop

file-system-folder-load-runtime.ts:
  contains AbortController
  contains waitersByRequestId
  does not contain onPathChange/onQueryChange/onSelectionChange/onViewChange

file-system-controlled-props.ts:
  contains source: "controlled-prop"
  does not contain loadChildren
  does not contain AbortController

file-system-list-memory.ts:
  contains FileSystemListMemoryCommand
  contains snapshotsByCurrentPath in state
  does not contain @pierre/trees

file-system-pierre-expansion.ts:
  does not contain reset transition classification
  does not contain snapshotsByCurrentPath
```

## Test Plan

Run focused tests:

```bash
bunx vitest run tests/file-system-kernel.test.ts tests/file-system.test.tsx tests/file-system-pierre-input.test.ts tests/file-system-pierre-lifecycle.test.ts
bunx vitest run tests/viewer-architecture.test.ts -t "file-system"
```

Run full type and registry gates:

```bash
bunx tsc --noEmit --pretty false
bun run registry:build
```

Run stale scans:

```bash
rg "file-system-(controller|navigation-controller|query-controller|selection-controller|view-controller|loading-controller|index-state|path-history)|use-file-system-children-loader" registry/new-york-v4 registry.json public/r tests -n
rg "file-system-pierre-(reset-identity|reset-plan|expansion-snapshot)|FileSystemPierreReset|FileSystemPierreExpansionSnapshot|createFileSystemPierreReset|classifyFileSystemPierreReset|rememberFileSystemPierreExpansionSnapshot|resolveFileSystemPierreExpansionAfterReset|filterFileSystemPierreExpandedPaths|collectFileSystemPierreDirectoryPaths" registry/new-york-v4 tests registry.json public/r -n
rg "predicted = reduceFileSystemKernel|selectFileSystemKernel\\(\\{ state: predicted \\}\\)" registry/new-york-v4/ui -n
```

Expected:

- first two scans return no matches;
- predicted-state scan returns no matches after Phase 4.

## Acceptance Criteria

This blueprint is implemented only when all are true:

- `file-system-kernel-effects.ts` no longer exists, or is reduced to a tiny
  re-export/wiring file with no request orchestration;
- kernel dispatch is synchronous from the runtime perspective;
- folder load runtime resolves waiters from committed current state, not a
  predicted reducer result;
- folder load runtime is the only folder-loading module that knows about
  `AbortController`;
- preview and open source tasks may still use aborts for source-resolution
  lifecycles;
- controlled prop reconciliation lives in its own small hook;
- public callback command execution lives in its own small hook;
- `ensureChildren` is implemented by the folder load runtime;
- folder request waiters have clear names and resolve exactly once;
- list-memory snapshots live in list-memory state, not a side ref helper;
- list reset plans are emitted as list-memory commands;
- Pierre files execute list-memory commands but do not own list-memory policy;
- list-memory fields are either behaviorally used or deleted;
- focused file-system behavior tests pass;
- file-system architecture tests pass;
- registry build passes;
- TypeScript passes;
- stale scans are empty.

## Completion Standard

Do not call the system perfect because the tests pass.

Call it close to perfect only when a reader can answer these questions without
opening more than one file per concern:

1. Where is durable file-system truth stored?
2. Where is controlled prop reconciliation performed?
3. Where are public callbacks emitted?
4. Where does folder I/O happen?
5. Where are ensure waiters stored and resolved?
6. Where is stale folder result rejection proved?
7. Where is preview source staleness proved?
8. Where is open source staleness proved?
9. Where is list reset transition policy defined?
10. Where are list expansion snapshots stored?
11. Where does Pierre translate runtime commands?
12. Which state fields are presentation memory and which are domain truth?

The final answer should be immediate:

```txt
kernel.ts
controlled-props.ts
kernel-command-effects.ts
folder-load-runtime.ts
folder-load-runtime.ts
kernel.ts
preview-source-task.ts
open-source-task.ts
list-memory.ts
list-memory.ts
pierre adapter files
kernel vs list-memory names
```

That is the state-machine platonic target.
