# File System State Machine Architecture

## Kernel

`file-system-kernel.ts` owns durable file-system facts:

- tree entries and child paths;
- current path;
- selection path;
- query;
- view;
- folder load status;
- history.

The kernel is pure. It receives events, returns the next state, and emits
commands. It does not run I/O, touch React, resolve sources, or know about
Pierre.

## Runtime

`file-system-kernel-runtime.ts` is the wire:

- creates the initial kernel state;
- dispatches reducer events synchronously;
- stores the current state;
- exposes React subscription through `useSyncExternalStore`;
- queues reducer commands;
- flushes commands to effect adapters.

It does not own async task mechanics.

## Async Tasks

`file-system-async-task.ts` defines the shared async lifecycle:

- `task`;
- `task.id`;
- `task.key`;
- `input`;
- `waiter`;
- `abort`;
- `succeed`;
- `fail`;
- stale settlement checks.

It has no file-system domain policy. Folder loading, preview source resolution,
and open-source resolution adapt this protocol instead of inventing separate
request machines.

## Folder Task

`file-system-folder-task.ts` adapts async tasks to lazy folder loading.

It maps a folder path to a task key, starts `loadChildren`, dispatches
`folder.loadSucceeded` or `folder.loadFailed`, and resolves `ensureChildren`
from committed kernel children. It does not own public callbacks or Pierre
state.

## Source Tasks

`file-system-selection-source-task.ts` resolves the selected preview source.

`file-system-open-source-task.ts` resolves the explicit open-preview source.

Both use the shared task protocol, so stale source results and aborts follow the
same semantics as folder loading.

## Command Effects

`file-system-kernel-command-effects.ts` executes reducer commands:

- `callback.pathChanged`;
- `callback.queryChanged`;
- `callback.viewChanged`;
- `callback.selectionChanged`;
- `file.open`;
- `folder.ensure`.

It does not mutate kernel state and does not own async bookkeeping.

## List Continuity

`file-system-list-continuity.ts` preserves visual continuity across list input
resets.

Its phases are:

- `stable`;
- `capturing`;
- `applying`;
- `revealing`.

It owns reset identity, expansion snapshots, model revision, and reveal
commands. It has no Pierre import.

## Pierre Boundary

`file-system-pierre-list-tree.tsx` is the private list renderer.

`file-system-pierre-expansion.ts` executes continuity commands against Pierre:

- capture expanded paths;
- apply model paths;
- reveal selection.

Pierre adapts. It does not decide reset policy.
