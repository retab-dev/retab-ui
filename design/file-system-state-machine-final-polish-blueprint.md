# File System State Machine Final Design

## Standard

This is the final target for the file-system component.

The component should feel native to Retab, not like Finder, not like Extend
copied line by line, and not like a generic tree demo. It should be a Pierre
native file explorer that uses the document viewer primitive for previewing
files. Pierre is an implementation detail. Viewer is a preview surface. The
file-system domain owns the experience.

The design is platonic when:

- the state model is small enough to hold in one head;
- every module has one reason to exist;
- async work has one grammar;
- visual continuity has one explicit machine;
- Pierre adapts rendering but never decides policy;
- Viewer renders selected content but never owns browsing;
- no compatibility layer preserves obsolete concepts;
- no line remains because it was convenient during migration.

## Core Sentence

```txt
FileSystem browses files, resolves sources, preserves list continuity, and
places the selected source inside Viewer.
```

Everything else is subordinate to that sentence.

## Final Layers

```txt
FileSystem
  public composition and user-facing surface

FileSystemKernel
  pure durable domain facts and reducer commands

FileSystemKernelRuntime
  mechanical dispatch loop and command flushing

FileSystemAsyncTask
  one shared async lifecycle protocol

FileSystemFolderTask
  folder loading adapter over async tasks

FileSystemSelectionSourceTask
  selected-preview source adapter over async tasks

FileSystemOpenSourceTask
  explicit modal-open source adapter over async tasks

FileSystemListContinuity
  pure visual continuity state machine

FileSystemListTree
  public list boundary

FileSystemPierreListTree
  private Pierre renderer adapter
```

Viewer is not above the file system. Viewer is used by the preview pane.

Pierre is not above the file system. Pierre renders the list.

## Non-Negotiables

Do not touch `Viewer`.

Do not make Pierre public.

Do not introduce XState, Redux, Zustand, RxJS, or a generic framework.

Do not add adapters for the old controller architecture.

Do not keep compatibility shims.

Do not use names like `manager`, `service`, `controller`, `operation`, or
`handler` when a precise domain name exists.

Do not let generic primitives know about file-system policy.

Do not let renderer adapters decide state policy.

Do not let the kernel import React, DOM APIs, Pierre, Viewer, promises, or
`AbortController`.

## File Layout

```txt
file-system.tsx
  public component

file-system-provider.tsx
  composes runtime, browser state, preview state, actions, and context

file-system-browser-state.ts
  derived browser facts for the current folder

file-system-browser-controller.ts
  browser actions that dispatch kernel events

file-system-source-controller.ts
  source actions for preview and modal opening

file-system-open-preview-state.ts
  open-preview modal state

file-system-kernel.ts
  pure state, events, reducer, command types

file-system-kernel-selectors.ts
  pure projections from kernel state

file-system-kernel-runtime.ts
  synchronous store, dispatch loop, command queue, subscriptions

file-system-kernel-command-effects.ts
  public callbacks and file-open command execution

file-system-controlled-props.ts
  controlled prop reconciliation into kernel events

file-system-async-task.ts
  reusable async task runtime

file-system-folder-task.ts
  lazy folder loading task

file-system-selection-source-task.ts
  selected-preview source resolution task

file-system-open-source-task.ts
  explicit open-preview source resolution task

file-system-list-continuity.ts
  pure reset, snapshot, apply, and reveal state machine

file-system-list-view.tsx
  public list-view surface that delegates to FileSystemListTree

file-system-list-tree.tsx
  public tree boundary if separated from the view

file-system-pierre-list-tree.tsx
  private Pierre renderer

file-system-pierre-model.ts
  file-system model to Pierre input mapping

file-system-pierre-expansion.ts
  executes continuity commands against Pierre

file-system-pierre-reset.ts
  detects Pierre input identity changes and feeds list continuity
```

Deleted concepts stay deleted:

```txt
file-system-controller
file-system-navigation-controller
file-system-query-controller
file-system-selection-controller
file-system-view-controller
file-system-loading-controller
file-system-index-state
file-system-path-history
file-system-kernel-effects
file-system-folder-load-runtime
file-system-list-memory
file-system-pierre-reset-identity
file-system-pierre-reset-plan
file-system-pierre-expansion-snapshot
use-file-system-children-loader
```

## Dependency Law

Allowed dependencies:

```txt
file-system-provider
  -> file-system-kernel-runtime
  -> file-system-controlled-props
  -> file-system-kernel-command-effects
  -> file-system-folder-task
  -> file-system-selection-source-task
  -> file-system-open-source-task
  -> file-system-kernel
  -> file-system-kernel-selectors

file-system-list-view
  -> file-system-list-tree
  -> file-system-pierre-list-tree
  -> file-system-pierre-model
  -> file-system-pierre-reset
  -> file-system-pierre-expansion
  -> file-system-list-continuity
```

Forbidden dependencies:

```txt
kernel -> React
kernel -> DOM
kernel -> Pierre
kernel -> Viewer
kernel -> AbortController
kernel -> Promise

selectors -> React
selectors -> DOM
selectors -> Pierre
selectors -> Viewer

async-task -> FileSystem domain policy
async-task -> React
async-task -> DOM
async-task -> Pierre
async-task -> Viewer

list-continuity -> React
list-continuity -> DOM
list-continuity -> Pierre
list-continuity -> Viewer

pierre adapter -> source resolution
pierre adapter -> kernel reducer
pierre adapter -> reset policy

viewer preview -> file-system browsing state
```

The dependency law is the design.

## Kernel

The kernel owns durable domain facts:

- normalized file nodes;
- child paths by folder path;
- current path;
- selected path;
- query;
- sort;
- view;
- folder loading status;
- path history;
- preview/open source statuses when they are durable UI facts.

The kernel receives events and returns:

```ts
type FileSystemKernelResult = {
  state: FileSystemKernelState
  commands: FileSystemKernelCommand[]
}
```

Events are facts:

```txt
path.changed
path.backRequested
path.forwardRequested
selection.changed
query.changed
sort.changed
view.changed
folder.loadStarted
folder.loadSucceeded
folder.loadFailed
source.previewStarted
source.previewSucceeded
source.previewFailed
source.openStarted
source.openSucceeded
source.openFailed
```

Commands are side-effect intents:

```txt
callback.pathChanged
callback.selectionChanged
callback.queryChanged
callback.sortChanged
callback.viewChanged
folder.ensure
source.preview.resolve
source.open.resolve
file.open
```

The kernel does not execute commands.

## Runtime

The runtime is the wire.

It owns:

- initial state creation;
- current state storage;
- synchronous event dispatch;
- command queueing;
- command flushing;
- `useSyncExternalStore` subscription;
- `getState`.

It does not own:

- async waiters;
- abort controllers;
- folder request maps;
- source resolution;
- controlled prop diffs;
- public callback bodies;
- Pierre;
- Viewer;
- list continuity.

Ideal runtime shape:

```txt
dispatch(event)
  result = reduce(state, event)
  state = result.state
  enqueue(result.commands)
  notify()
  flush()

flush()
  for command in queue
    commandEffects.run(command)
    folderTask.run(command)
    selectionSourceTask.run(command)
    openSourceTask.run(command)
```

The runtime should be boring.

## Async Task Protocol

All async work in the file-system uses one protocol:

```txt
task
taskId
taskKey
input
result
waiter
abort
succeed
fail
stale
settle
```

The primitive owns:

- task id creation;
- key-based dedupe;
- waiter attachment;
- abort;
- abort all;
- stale settlement checks;
- exact-once settlement.

The primitive does not own:

- paths;
- files;
- nodes;
- kernel events;
- source objects;
- Pierre;
- Viewer;
- React.

Required API:

```ts
type FileSystemAsyncTaskRuntime<TInput, TResult> = {
  start(input: TInput): FileSystemAsyncTaskStart<TInput, TResult>
  join(task: FileSystemAsyncTask<TInput>): Promise<TResult>
  get(key: FileSystemAsyncTaskKey): FileSystemAsyncTask<TInput> | null
  succeed(task: FileSystemAsyncTask<TInput>, result: TResult): boolean
  fail(task: FileSystemAsyncTask<TInput>, error: unknown): boolean
  abort(key: FileSystemAsyncTaskKey, reason: string): void
  abortAll(reason: string): void
}
```

Do not invent parallel nouns:

```txt
request
job
operation
promise registry
pending map
load runtime
```

Domain adapters may use domain names at their boundary:

```txt
folderTask
selectionSourceTask
openSourceTask
```

Inside each adapter, use the protocol nouns.

## Folder Task

`file-system-folder-task.ts` adapts async tasks to folder loading.

It owns:

- path to task key mapping;
- `loadChildren`;
- dispatching folder load lifecycle events;
- resolving `ensureChildren(path)` from committed kernel state.

It does not own:

- generic waiter storage;
- generic abort bookkeeping;
- source resolution;
- public callbacks;
- Pierre;
- Viewer.

Correct sequence:

```txt
ensureChildren(path)
  if committed children are usable
    return committed children

  start task for path
  if task is new
    dispatch folder.loadStarted(taskId, path)
    run loadChildren(path, signal)

load succeeds
  dispatch folder.loadSucceeded(taskId, path, children)
  read committed children from kernel
  succeed task with committed children

load fails
  dispatch folder.loadFailed(taskId, path, error)
  fail task
```

No predicted reducer state. No second reducer. No pre-commit child resolution.

## Source Tasks

`file-system-selection-source-task.ts` resolves the selected preview source.

`file-system-open-source-task.ts` resolves the explicit open-preview source.

They share the async task protocol with folder loading.

The only difference is intent:

```txt
selection source
  selected file changed, preview pane needs a source

open source
  user requested modal/open preview, modal needs a source
```

The lifecycle grammar stays identical:

```txt
start task
dispatch started event
resolve source
dispatch succeeded or failed event
settle task
reject stale task
```

## List Continuity

List continuity is a pure state machine.

It exists for one reason:

```txt
when list input changes, preserve the user's spatial context when preservation
is still truthful
```

State:

```ts
type FileSystemListContinuityState<TRuntimeInput> = {
  phase: "stable" | "capturing" | "applying" | "revealing"
  identity: FileSystemListContinuityIdentity<TRuntimeInput> | null
  transition: FileSystemListContinuityTransition<TRuntimeInput> | null
  pendingRevealPath: string | null
  snapshotsByCurrentPath: Map<string, FileSystemListExpansionSnapshot>
  modelRevision: string
}
```

Events are facts:

```txt
domain.pathChanged
domain.queryChanged
domain.selectionChanged
domain.folderLoadSucceeded
identity.requested
snapshot.captured
model.applied
selection.revealed
```

Commands are adapter instructions:

```txt
snapshot.capture
model.apply
selection.reveal
```

Transition table:

```txt
stable + identity.requested(same)
  -> stable

stable + identity.requested(changed)
  -> capturing + snapshot.capture

capturing + snapshot.captured
  -> applying + model.apply

applying + model.applied(with reveal path)
  -> revealing + selection.reveal

applying + model.applied(without reveal path)
  -> stable

revealing + selection.revealed
  -> stable
```

Snapshot policy belongs here:

- preserve expansion for same current path when truthful;
- discard expansion when semantic query makes normal expansion misleading;
- restore normal expansion when leaving query;
- key snapshots by current path;
- reveal selected path after reset when the selected path is still visible;
- filter expansion paths against the new input;
- never ask Pierre to decide policy.

## Pierre Boundary

Pierre is private.

Pierre code may:

- receive mapped tree input;
- render rows;
- capture currently expanded paths;
- apply requested expansion paths;
- reveal a requested path.

Pierre code may not:

- classify reset transitions;
- decide expansion preservation;
- decide reveal policy;
- resolve file sources;
- dispatch kernel reducer events directly;
- leak Pierre objects into public APIs.

`file-system-pierre-expansion.ts` executes continuity commands:

```txt
snapshot.capture
  collect expanded paths
  dispatch snapshot.captured

model.apply
  apply model input and requested expanded paths
  dispatch model.applied

selection.reveal
  reveal path
  dispatch selection.revealed
```

## Viewer Boundary

Viewer is used inside the file-system preview surface.

The file-system owns:

- selected file;
- selected source resolution;
- modal/open state;
- preview empty state;
- folder empty state;
- source loading/error state.

Viewer owns:

- rendering the resolved source;
- its own viewer-local controls;
- document-specific display behavior.

Viewer must not own:

- file browsing;
- tree selection;
- folder loading;
- Pierre list continuity;
- file-system query or sort.

The correct mental model is:

```tsx
<FileSystem>
  <FileSystemList />
  <FileSystemPreview>
    <Viewer source={selectedSource} />
  </FileSystemPreview>
</FileSystem>
```

Not:

```tsx
<Viewer>
  <FileSystem />
</Viewer>
```

## Controlled Props

`file-system-controlled-props.ts` adapts external React facts to kernel facts.

It owns:

- previous controlled value refs;
- deciding whether a controlled prop changed;
- dispatching explicit controlled events.

It does not own:

- loading;
- callbacks;
- source resolution;
- list continuity;
- Pierre;
- Viewer.

Controlled props are not a second source of truth. They are external facts that
enter the kernel as events.

## Public Component Shape

The public `FileSystem` component should expose a compact API:

```txt
items or root node input
currentPath / defaultCurrentPath
selectedPath / defaultSelectedPath
view / defaultView
query / defaultQuery
sort / defaultSort
loadChildren
resolveFileSource
onPathChange
onSelectionChange
onViewChange
onQueryChange
onSortChange
onOpenFile
```

Avoid exposing:

- Pierre model;
- continuity state;
- async task ids;
- kernel commands;
- internal runtime;
- preview task state names;
- viewer implementation details.

## Naming Law

One concept gets one name everywhere.

Use:

```txt
path
currentPath
selectedPath
childPaths
itemPaths
source
selectionSourceTask
openSourceTask
folderTask
listContinuity
identity
transition
snapshot
expandedPaths
revealPath
taskId
taskKey
```

Avoid:

```txt
filePath when it means any node path
activePath when it means selectedPath
folderPath when it means currentPath
nodeIds when the public model uses paths
requestId when it is a taskId
memory when it is continuity
reset plan when it is a transition
controller when it is an action adapter
```

## Tests As Proof

The implementation is not done until tests prove the architecture.

Required unit tests:

- async task dedupes by key;
- async task joins multiple waiters;
- stale success does not settle the active task;
- stale failure does not settle the active task;
- abort rejects active waiters once;
- abort all settles every active task;
- task cannot settle twice;
- folder task resolves from committed kernel children;
- source tasks reject stale source results;
- list continuity transition table is explicit;
- query transitions discard or restore expansion correctly;
- invalid expansion paths are filtered;
- Pierre adapter executes continuity commands without policy branches.

Required architecture tests:

- no old controller files are referenced;
- no old folder-load runtime is referenced;
- no old list-memory module is referenced;
- no kernel-effects module is referenced;
- no predicted reducer simulation exists;
- no `AbortController` appears in kernel, selectors, runtime, command effects,
  or list continuity;
- no Pierre import appears in kernel, selectors, async task, or list
  continuity;
- registry entry includes the final module graph;
- generated registry output contains no stale file references.

## Verification

Run:

```bash
bun run registry:build
bunx vitest run tests/file-system-async-task.test.ts tests/file-system-kernel.test.ts tests/file-system.test.tsx tests/file-system-pierre-input.test.ts tests/file-system-pierre-lifecycle.test.ts
bunx vitest run tests/viewer-architecture.test.ts
bunx tsc --noEmit --pretty false
```

Run stale scans:

```bash
rg "file-system-kernel-effects|predicted = reduceFileSystemKernel|selectFileSystemKernel\\(\\{ state: predicted \\}\\)|useFileSystemListExpansionMemory|file-system-pierre-(reset-identity|reset-plan|expansion-snapshot)|file-system-folder-load-runtime|file-system-list-memory|FileSystemListMemory|useFileSystemFolderLoadRuntime|FileSystemFolderLoadRuntime|runLoadFolderCommand|requestIdRef|requestRef|waitersByRequestId|requestsByPath" registry/new-york-v4 tests registry.json public/r -n

rg "file-system-(controller|navigation-controller|query-controller|selection-controller|view-controller|loading-controller|index-state|path-history)|use-file-system-children-loader|controller\\.openPreview|controller\\.resolveFileSource" registry/new-york-v4 registry.json public/r tests -n

rg "focusedPath|row\\.expanded|row\\.collapsed|row\\.focused" registry/new-york-v4/ui/file-system-list-continuity.ts registry/new-york-v4/ui/file-system-pierre-list-tree.tsx registry/new-york-v4/ui/file-system-pierre-expansion.ts tests/file-system-pierre-lifecycle.test.ts -n

rg "AbortController" registry/new-york-v4/ui/file-system-kernel-runtime.ts registry/new-york-v4/ui/file-system-kernel-command-effects.ts registry/new-york-v4/ui/file-system-list-continuity.ts registry/new-york-v4/ui/file-system-kernel.ts registry/new-york-v4/ui/file-system-kernel-selectors.ts -n
```

Expected stale-scan result:

```txt
no matches
```

## Stop Condition

Stop when all of this is true:

- kernel is pure;
- runtime is mechanical;
- commands are pure intent;
- async tasks share one grammar;
- folder loading is only a folder adapter;
- source resolution uses the same task protocol;
- list continuity owns reset policy;
- Pierre only adapts rendering;
- Viewer only renders preview content;
- public API is compact;
- old controller and memory names are gone;
- registry build passes;
- TypeScript passes;
- architecture tests pass;
- stale scans are clean.

## Final Form

```txt
kernel decides
runtime dispatches
commands describe
tasks perform
continuity preserves
Pierre renders
Viewer previews
FileSystem contains
```

That is the final design.
