# File System Final Platonic Compression Blueprint

## Purpose

This blueprint covers the remaining reasons `FileSystem` is not yet platonic after the provider split and Pierre lifecycle refactor.

The implementation is now good:

- `FileSystem` is a composed viewer layout.
- `FileSystemProvider` exposes named state slices, not one god controller.
- named parts project narrow state for header, explorer, selected preview, and open-file dialog.
- Pierre lifecycle has reset identity, transition classification, reset plans, expansion policy, and lazy folder commands.
- focused tests cover file-system behavior, Pierre input, Pierre lifecycle, and architecture boundaries.

Still not platonic:

- the component has a large real domain surface;
- the provider slice graph is correct but not yet obvious at a glance;
- the Pierre lifecycle is explicit but still mentally heavy.

This blueprint is not a call for another architecture revolution. It is a compression pass: make the existing design feel inevitable.

## 2026-06-14 Judgment

The current implementation is better than the old implementation. It is also still carrying the true size of the domain.

That matters because the platonic version is not the smallest possible file-system demo. It is the smallest exact expression of a Pierre-native file explorer that uses the document viewer primitive. The component cannot pretend to be tiny, because the real product surface is large:

- browser;
- selection;
- selected preview;
- modal open;
- lazy loading;
- source resolution;
- query;
- sort;
- Pierre adapter.

Those responsibilities are not accidental. Removing them would make the component less complete. The remaining design problem is therefore not elimination. It is compression.

The target is:

```txt
same capabilities
fewer concepts
stricter names
more obvious ownership
less lifecycle ceremony
```

The honest verdict:

- The file-system component still has a lot of real domain surface. It is modular now, but intrinsically large.
- The provider state slices are better, but still not perfectly inevitable. The provider no longer has a god-controller shape, but it still coordinates many domains.
- The Pierre lifecycle is now explicit, but still complex. Naming the state machine made it understandable; it did not make the lifecycle effortless.

This is a good design. It is not yet the platonic ideal.

## Platonic North Star

The component should feel like this:

```tsx
<FileSystemProvider items={items}>
  <FileSystemBrowser />
  <FileSystemPreview />
  <FileSystemOpenPreview />
</FileSystemProvider>
```

That is not necessarily the final public API. It is the conceptual model every internal file should serve.

`FileSystemProvider` should not feel like a coordinator that knows everything. It should feel like the boundary that creates exactly three domain products:

```txt
browser state
  path, query, sort, view, index, loading, selection

preview state
  selected file, resolved source, renderers

open-preview state
  explicit open command, modal preview source, close command
```

Pierre should not feel like a second file-system implementation. It should feel like one adapter:

```txt
FileSystem semantic model -> Pierre input -> Pierre runtime events -> FileSystem semantic commands
```

Viewer primitives should remain below all of this:

```txt
viewer = layout grammar
file-system = domain grammar
file-viewer = document renderer
Pierre = native list runtime
```

No layer should smuggle another layer's job.

## Compression Standard

A change moves the component toward the platonic ideal only if it satisfies at least one of these tests:

- It removes a concept while keeping the same behavior.
- It makes ownership visible from the name alone.
- It turns an implicit lifecycle rule into a typed transition or pure helper.
- It makes a hook read as wiring instead of policy.
- It removes a duplicate path for the same state.
- It proves a workflow with a behavior test instead of a source-shape assertion.

A change is not platonic if it only:

- moves code into more files;
- adds another provider;
- wraps already-clear state in a generic abstraction;
- hides domain surface behind names like `manager`, `engine`, or `service`;
- keeps compatibility aliases;
- makes call sites longer for theoretical purity.

The right compression is not less code at any cost. It is less mental state.

## Current Shape

Canonical composition:

```tsx
<FileSystemProvider items={items}>
  <ViewerRoot>
    <ViewerHeader>
      <FileSystemHeader />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar>
        <FileSystemExplorer />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemSelectedFile />
      </ViewerSurface>
    </ViewerBody>
    <FileSystemOpenFileDialog />
  </ViewerRoot>
</FileSystemProvider>
```

Provider context shape:

```ts
type FileSystemContextValue = {
  index: FileSystemIndexState
  loading: FileSystemLoadingController
  navigation: FileSystemNavigationController
  openFilePreview: FileSystemOpenFilePreviewController
  query: FileSystemQueryController
  renderers: FileSystemRenderers
  selection: FileSystemSelectionController
  source: FileSystemSourceController
  title: string
  view: FileSystemViewController
}
```

State slice assembly:

```txt
query
view
source
pathHistory
loadedItems
index
loading
selection
navigation
```

Pierre lifecycle shape:

```txt
input
order
selection
expansion
reset identity
reset transition
reset plan
lazy folder command
model binding
```

This is much better than the previous state. It is still not the final form.

## Issue 1: The Domain Surface Is Real But Too Wide To Understand In One Pass

`FileSystem` owns all of these behaviors:

- browsing;
- folder navigation;
- inferred folder chains;
- search;
- sort;
- view mode;
- list/grid/columns presentation;
- lazy folder loading;
- lazy folder error state;
- selection;
- selected-file preview;
- open-file modal fallback;
- source resolution;
- custom file actions;
- custom metadata;
- Pierre tree virtualization.

None of these is obviously fake. The problem is not that the component has nonsense responsibilities. The problem is that the component still presents them as one broad domain.

### Platonic Target

Make the domain surface read as four explicit products:

```txt
FileSystemBrowser
  navigation, query, sort, view, lazy loading, selection

FileSystemPreview
  selected file preview, source resolution, render hooks

FileSystemOpenPreview
  double-click / keyboard-open modal fallback

FileSystemPierreList
  native list runtime adapter
```

This does not necessarily mean four public components. It means every internal type and file should belong to one of these products.

### Fix

Add a domain map at the top of the file-system docs and architecture blueprint:

| Product                 | Owns                                                       | Does Not Own                          |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------- |
| `FileSystemBrowser`     | folders, query, sort, view, lazy loading, selection        | document rendering                    |
| `FileSystemPreview`     | selected file preview, source resolution                   | folder navigation                     |
| `FileSystemOpenPreview` | modal fallback after open command                          | selected preview state                |
| `FileSystemPierreList`  | Pierre path conversion, virtualization, reset, row actions | file-system provider state            |
| `FileViewer`            | rendering one source                                       | file browsing, file-system navigation |
| viewer primitives       | spatial layout                                             | file-system state, Pierre lifecycle   |

Acceptance:

- every exported hook maps to one product;
- every internal module maps to one product;
- docs teach the four products before listing props;
- no module needs a paragraph to explain why it exists.

## Issue 2: The Provider Slice Graph Is Correct But Not Inevitable

The provider no longer exposes a god controller. Good.

But the slice assembly still requires careful reading:

```ts
const query = useFileSystemQueryController(...)
const view = useFileSystemViewController(...)
const source = useFileSystemSourceController(...)
const pathHistory = useFileSystemPathHistory(...)
const loadedItems = useFileSystemLoadedItems()
const index = useFileSystemIndexState(...)
const loading = useFileSystemLoadingController(...)
const selection = useFileSystemSelectionController(...)
const navigation = useFileSystemNavigationController(...)
```

This is accurate, but a reader has to infer the dependency graph.

### Platonic Target

The slice graph should be explicit and ordered by dependency:

```txt
inputs
  props
  controlled defaults

independent slices
  query
  view
  source
  pathHistory
  loadedItems

derived slices
  index depends on pathHistory, loadedItems, query
  loading depends on pathHistory, index, loadedItems, query
  selection depends on pathHistory, loading, query, index
  navigation depends on pathHistory, loading, query, selection

composition slices
  openFilePreview depends on source and onFileOpen
  renderers depend on render props
```

### Fix

Introduce an internal `file-system-state-graph.ts` module or a local constant that names the graph without adding runtime machinery.

Option A: documentation-only graph.

```ts
// State graph:
// query, view, source, pathHistory, loadedItems
// -> index
// -> loading
// -> selection
// -> navigation
```

Option B: typed assembly helper.

```ts
export function useFileSystemDomainState(props): FileSystemDomainState {
  const independent = useFileSystemIndependentState(props)
  const derived = useFileSystemDerivedState({ props, independent })
  return { ...independent, ...derived }
}
```

Recommendation: start with Option A. Only introduce Option B if it removes real code from `file-system-controller.ts`.

Acceptance:

- `useFileSystemStateSlices` has an explicit dependency order comment or graph;
- no slice reaches backward into a later slice;
- every slice type name matches its context key;
- `FileSystemContextValue` order matches dependency order;
- no slice is named `controller` unless it really exposes commands.

## Issue 3: Provider Context Still Mixes Domain State With Composition Extras

The provider context contains both domain state and composition extras:

```ts
index
loading
navigation
query
selection
source
view
openFilePreview
renderers
title
```

The first seven are domain state. The last three are composition/chrome concerns.

This is not wrong, but it is not perfectly crisp.

### Platonic Target

Separate context shape conceptually:

```ts
type FileSystemContextValue = {
  domain: FileSystemDomainState
  composition: FileSystemCompositionState
}

type FileSystemDomainState = {
  index: FileSystemIndexState
  loading: FileSystemLoadingController
  navigation: FileSystemNavigationController
  query: FileSystemQueryController
  selection: FileSystemSelectionController
  source: FileSystemSourceController
  view: FileSystemViewController
}

type FileSystemCompositionState = {
  openFilePreview: FileSystemOpenFilePreviewController
  renderers: FileSystemRenderers
  title: string
}
```

But do not implement this if it makes every named-part hook noisier:

```ts
const { domain, composition } = useFileSystem()
```

is not automatically better than:

```ts
const { navigation, query, title, view } = useFileSystem()
```

### Fix

Make the distinction visible without adding unnecessary property nesting.

Suggested compromise:

```ts
export type FileSystemDomainState = {
  index: FileSystemIndexState
  loading: FileSystemLoadingController
  navigation: FileSystemNavigationController
  query: FileSystemQueryController
  selection: FileSystemSelectionController
  source: FileSystemSourceController
  view: FileSystemViewController
}

export type FileSystemCompositionState = {
  openFilePreview: FileSystemOpenFilePreviewController
  renderers: FileSystemRenderers
  title: string
}

export type FileSystemContextValue = FileSystemDomainState &
  FileSystemCompositionState
```

Acceptance:

- readers can identify domain vs composition concerns from type names;
- hooks can still destructure directly;
- no nested object is added unless it reduces actual confusion.

## Issue 4: Named-Part Hooks Still Rebuild Controllers By Projection

`useFileSystemExplorer` currently constructs an explorer controller from slices:

```ts
explorerController: {
  currentEntries: index.currentEntries,
  currentPath: navigation.currentPath,
  ensureChildren: loading.ensureChildren,
  folderErrors: loading.folderErrors,
  index: index.index,
  loadingFolders: loading.loadingFolders,
  navigateTo: navigation.navigateTo,
  query: query.query,
  rawIndex: index.rawIndex,
  resolveFileSource: source.resolveFileSource,
  selectEntry: selection.selectEntry,
  selectFirstChildAfterEnsure: selection.selectFirstChildAfterEnsure,
  selectedEntry: selection.selectedEntry,
  selectedPath: selection.selectedPath,
  view: view.view,
}
```

This is explicit, but verbose.

### Platonic Target

Projection should have a named owner.

```ts
function createFileSystemExplorerController(state: FileSystemDomainState) {
  return {
    ...
  } satisfies FileSystemExplorerController
}
```

Then the hook reads:

```ts
export function useFileSystemExplorer() {
  const state = useFileSystem()
  return {
    explorerController: createFileSystemExplorerController(state),
    openFilePreview: state.openFilePreview.openFilePreview,
  }
}
```

### Fix

Move projection helpers into `file-system-controller.ts` or `file-system-parts.tsx`:

```ts
createFileSystemHeaderController
createFileSystemExplorerController
createFileSystemSelectedFileController
createFileSystemStatusController
```

Do not add these if they become abstraction theatre. They are justified only if they remove repeated slice destructuring and make hook ownership clearer.

Acceptance:

- hook bodies read in under ten lines;
- projection helpers are pure;
- tests do not need to change except architecture boundaries;
- every projection helper returns a named public state type.

## Issue 5: The Open-File Modal Is Useful But Still Product-Questionable

`FileSystemOpenFileDialog` is first-class fallback behavior.

The current behavior is coherent:

- click selects;
- selected file renders in `FileSystemSelectedFile`;
- double click / keyboard open uses modal fallback unless `onFileOpen` is supplied.

The philosophical issue remains: is modal open part of the file-system component, or just a demo shell behavior?

### Platonic Target

The answer should be explicit in naming.

If it stays first-class, use names that say it is a command result:

```ts
FileSystemOpenPreviewController
FileSystemOpenPreviewDialog
useFileSystemOpenPreviewDialog
```

If it is demo-only, remove modal state from provider and move it to a block:

```tsx
<FileSystemProvider>
  <ViewerRoot>...</ViewerRoot>
  <FileSystemOpenPreviewDialog />
</FileSystemProvider>
```

Current recommendation: keep it first-class. The easy API should be complete without app routing.

### Fix

Rename for precision only if the team agrees:

- `FileSystemOpenFileDialog` -> `FileSystemOpenPreviewDialog`;
- `useFileSystemOpenFileDialog` -> `useFileSystemOpenPreviewDialog`;
- `FileSystemOpenFilePreviewController` -> `FileSystemOpenPreviewController`.

Do not create compatibility aliases. If renamed, do a hard cutover.

Acceptance:

- names distinguish selected preview from opened preview;
- docs state when modal fallback opens;
- `onFileOpen` remains the escape hatch for app routing.

## Issue 6: Pierre Lifecycle Is Explicit But Still Not Effortless

The lifecycle is now named:

```txt
reset identity
reset transition
reset plan
expansion snapshot
lazy folder command
```

That is good. But the reader still needs to understand several cooperating pieces:

- input preparation;
- order reset;
- model reset;
- query expansion;
- normal expansion preservation;
- decoration invalidation;
- selection sync;
- lazy load;
- retry-and-expand.

### Platonic Target

`file-system-pierre-model.ts` should read as a declarative adapter:

```ts
const input = ...
const lifecycle = useFileSystemPierreLifecycle(...)
const selection = useFileSystemPierreSelection(...)

const { model } = useFileTree({
  preparedInput: input.preparedInput,
  sort: lifecycle.order.compare,
  onSelectionChange: selection.onPierreSelectionChange,
  renderRowDecoration: lifecycle.renderRowDecoration,
})

lifecycle.syncModel(model)
selection.syncModel(model)
```

The current code is close but not quite there.

### Fix

Introduce one top-level hook only if it compresses real coupling:

```ts
function useFileSystemPierreLifecycle({
  controller,
  decorationVersion,
  input,
}: Args) {
  const order = useFileSystemPierreOrder(input.pierrePaths)
  const expansion = useFileSystemPierreExpansion({ controller })
  return {
    order,
    expansion,
    hasSemanticQuery,
    resetModel,
    runLazyFolderCommand,
  }
}
```

But avoid simply moving lines from `file-system-pierre-model.ts` into another file. The lifecycle hook must own a coherent lifecycle contract.

Acceptance:

- `file-system-pierre-model.ts` has no reset policy;
- `file-system-pierre-model.ts` has no lazy retry policy;
- model hook wires Pierre options and lifecycle hooks only;
- reset plan remains pure and independently tested.

## Issue 7: Query Is Still A Boolean In The Lifecycle

The transition classifier still uses:

```ts
hasSemanticQuery: boolean
```

That is accurate today. It may not be precise enough if search later gains multiple modes.

### Platonic Target

Use a mode:

```ts
type FileSystemPierreQueryMode = "none" | "semantic"
```

Then transitions become:

```ts
"query-enter"
"query-update"
"query-exit"
```

based on mode changes.

### Fix

Do not rename immediately unless there is a second query mode. But document the boundary:

- Pierre search is disabled;
- file-system semantic query owns filtering;
- Pierre query-mode expansion exists only to reveal matched descendants.

Acceptance:

- no code suggests Pierre owns search;
- query expansion remains a file-system policy.

## Issue 8: Tests Are Good, But Still Not The Full Proof

Current good coverage:

- Pierre input;
- Pierre lifecycle transitions;
- file-system behavior;
- registry architecture;
- large-list virtualization;
- source cache invalidation.

Remaining proof gaps:

- accessibility matrix across all views;
- focus return from modal close;
- screen-reader announcement for lazy loading and errors;
- behavior tests replacing some source-string architecture tests;
- performance structure for search/sort/gallery if gallery returns.

### Fix

Add an accessibility and workflow test matrix:

```txt
list keyboard select
list keyboard open
grid keyboard select
grid keyboard open
columns keyboard select
columns lazy child loading
dialog open and close
dialog focus return
loading folder announcement
failed folder announcement
retry failed folder
```

Acceptance:

- every user workflow has at least one behavior test;
- source-string tests remain only for hard architectural boundaries.

## Implementation Plan

### Phase 1: Name Domain Groups

Add types only:

```ts
FileSystemDomainState
FileSystemCompositionState
```

Make `FileSystemContextValue = FileSystemDomainState & FileSystemCompositionState`.

No runtime behavior change.

### Phase 2: Document The Provider Graph

Add a short state graph above `useFileSystemStateSlices`.

The comment should name dependency order, not explain obvious code.

### Phase 3: Extract Projection Helpers

Add pure helpers:

```ts
createFileSystemHeaderController
createFileSystemExplorerController
createFileSystemSelectedFileController
```

Use them from named-part hooks only if hook bodies become clearer.

### Phase 4: Decide Open Preview Naming

Choose one:

- keep `OpenFileDialog` names;
- hard-rename to `OpenPreviewDialog`.

Do not alias.

### Phase 5: Compress Pierre Model Wiring

Consider `useFileSystemPierreLifecycle` only if it removes coupling from `file-system-pierre-model.ts`.

Reject the change if it becomes a bag of values.

### Phase 6: Add Accessibility Matrix

Add workflow tests before changing more architecture.

The next improvement should increase proof, not merely move code.

## Non-Goals

Do not add another provider.

Do not make viewer primitives aware of file-system state.

Do not make `FileViewer` aware of browsing.

Do not hide real domain surface behind vague abstractions like `manager`, `service`, or `engine`.

Do not create compatibility wrappers.

Do not split files only to reduce line count.

Do not replace explicit slice names with generic state bags.

## Final Verdict

The component is now good. It is not platonic.

The remaining gap is not that the architecture is wrong. The remaining gap is that the architecture still requires too much reading before it becomes obvious.

The next perfecting pass should make three things instantly visible:

1. what product surface each module belongs to;
2. how provider slices depend on one another;
3. which Pierre lifecycle phase owns each mutation.

If those three become obvious, the component will be much closer to Flaubertian precision.
