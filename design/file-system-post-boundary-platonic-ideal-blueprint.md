# File System Post-Boundary Platonic Ideal Blueprint

## Purpose

This blueprint answers the post-implementation question:

> Have we reached the platonic ideal of `FileSystem`?

No.

We have reached a good design. We have not reached perfection.

The latest implementation removed the most dangerous compression point:

- `FileSystemExplorerController` is gone.
- `useFileSystemExplorer()` returns `FileSystemExplorerPart` directly.
- list, grid, columns, and status each receive view-specific inputs.
- Pierre receives Pierre-specific adapter inputs.
- grid and columns do not import Pierre modules.
- Pierre modules do not import `file-system-controller`.
- the registry payloads are aligned with source.

That is a real architectural improvement. It is not the final form.

The remaining gaps are subtler. They are no longer about a large public
controller. They are about inevitability:

- `createFileSystemExplorerPart` is now the remaining wiring table;
- `useFileSystemPierreModel` still contains imperative repair work around a
  persistent Pierre model;
- `FileSystemProvider` has narrow public hooks but still broadcasts one broad
  context value;
- names are consistent but not perfectly exact;
- the component still exposes a very large domain surface.

This blueprint describes what would make the component feel complete,
necessary, fast, and exact.

## Definition Of Platonic Ideal

For this component, "platonic ideal" means:

- simple: every concept is necessary and easy to locate;
- fast: renders, source resolution, Pierre resets, and registry consumption do
  the least work needed;
- complete: all file-browser workflows are present and tested;
- nothing more: no compatibility shims, duplicate state paths, fake generic
  abstractions, or speculative extension points;
- perfect modularization: each file owns one coherent behavior;
- high-entropy code: every line either models state, performs a domain action,
  renders UI, or proves an invariant;
- consistent names: the same concept has the same name everywhere;
- Flaubertian precision: every boundary has the exact word and exact shape.

The platonic target is not fewer files by itself.

The platonic target is less mental state.

## Current Verdict

Current state:

```txt
good architecture
good test coverage
good ownership direction
not yet inevitable
```

The component is past the dangerous design. It is no longer hiding a god object
behind a polite name. It is also not yet the simplest exact expression of the
domain.

The correct next pass is not another revolution. It is a precision pass.

## Current Conceptual Shape

The easy API is right:

```tsx
<FileSystemProvider items={items}>
  <ViewerRoot data-viewer="file-system">
    <ViewerHeader>
      <FileSystemHeader />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar aria-label="Files">
        <FileSystemExplorer />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemSelectedFile />
      </ViewerSurface>
    </ViewerBody>
    <FileSystemOpenPreviewDialog />
  </ViewerRoot>
</FileSystemProvider>
```

Ownership direction is right:

```txt
Viewer primitives
  own spatial layout only

FileSystem
  owns file-system domain state and browser semantics

Pierre
  owns native tree runtime and virtualization

FileViewer
  owns document rendering
```

The current internal shape is:

```txt
FileSystemProvider
  creates domain slices and composition state

useFileSystemExplorer
  projects provider state into FileSystemExplorerPart

FileSystemExplorer
  dispatches list/grid/columns/status

FileSystemListView
  adapts file-system index to Pierre

useFileSystemPierreModel
  creates Pierre model and synchronizes lifecycle
```

This is good. The remaining work is to make each line above feel unavoidable.

## Non-Negotiable Boundaries

These boundaries should not change.

### Viewer Remains Untouched

Do not add file-system semantics to viewer primitives.

Wrong:

```tsx
<ViewerSidebar viewerPurpose="files" />
```

Right:

```tsx
<ViewerSidebar aria-label="Files">
  <FileSystemExplorer />
</ViewerSidebar>
```

Viewer is layout grammar. File-system is domain grammar.

### Pierre Remains Internal

Do not expose Pierre types from the public `FileSystem` API.

Pierre paths are adapter paths. File-system paths are semantic paths. They
should not be confused.

### FileViewer Remains A Renderer

`FileSystem` may contain `FileViewer`; `FileViewer` must not contain
`FileSystem`.

File-system chooses a source. File-viewer renders that source.

### Provider Remains Domain-Owned

The file-system provider is not a viewer provider. It is the domain state
boundary for a file explorer.

## Gap 1: `createFileSystemExplorerPart` Is The New Wiring Table

### Current Shape

`createFileSystemExplorerPart` builds:

```ts
type FileSystemExplorerPart = {
  columns: FileSystemColumnsViewController
  grid: FileSystemGridViewController
  list: FileSystemListViewController
  status: FileSystemStatusState
  view: FileSystemView
}
```

This is much better than the old `FileSystemExplorerController`.

The problem is subtler: this function is now the place where every slice can
see every other slice. It is not a god object, but it is still a broad adapter
factory.

### Why This Is Not Platonic

The function repeats similar concepts with slightly different shapes:

```ts
openPreview: openPreview.openPreview
selectedPath: selection.selectedPath
selectedEntry: selection.selectedEntry
navigateTo: navigation.navigateTo
resolveFileSource: source.resolveFileSource
```

That is not wrong. It is a wiring table.

The platonic ideal would make the projection feel like a set of obvious
products, not a manually assembled bundle.

### Target

Split the projection by product:

```txt
createFileSystemListViewController
createFileSystemGridViewController
createFileSystemColumnsViewController
createFileSystemStatusState
createFileSystemExplorerPart
```

`createFileSystemExplorerPart` becomes a one-screen composition:

```ts
export function createFileSystemExplorerPart(
  state: FileSystemExplorerPartInput
): FileSystemExplorerPart {
  return {
    columns: createFileSystemColumnsViewController(state),
    grid: createFileSystemGridViewController(state),
    list: createFileSystemListViewController(state),
    status: createFileSystemStatusState(state),
    view: state.view.view,
  }
}
```

Each child factory should expose its own exact input type:

```ts
type FileSystemListViewControllerInput = {
  index: FileSystemIndexState
  loading: FileSystemLoadingController
  navigation: FileSystemNavigationController
  openPreview: FileSystemOpenPreviewController
  query: FileSystemQueryController
  selection: FileSystemSelectionController
}
```

Grid should not receive `query`. Columns should not receive `query`. Status
should not receive `source`. The factory input type should make that impossible.

### Acceptance

- `createFileSystemExplorerPart` contains no inline object larger than one
  level deep.
- each view controller has a dedicated factory;
- each factory has a dedicated input type;
- grid factory cannot access Pierre decoration state;
- list factory cannot access `resolveFileSource`;
- status factory cannot access loading commands;
- tests assert the broad factory does not inline every controller body.

### Risk

This can become ceremony.

Do not split if the result is just more files with less meaning. The split is
worth it only if each factory becomes the exact boundary for one view.

## Gap 2: Pierre Adapter Still Uses Imperative Repair Code

### Current Shape

`useFileSystemPierreModel` must keep latest state refs:

```ts
const decorationRef = React.useRef(decoration)
const loadingRef = React.useRef(loading)
```

It also repaints decoration:

```ts
useRepaintFileSystemPierreDecoration({ decorationVersion, model })
```

This exists because Pierre owns a persistent model and registered callbacks.
React props change, but Pierre callbacks are long-lived.

The code is correct. It is not beautiful.

### Why This Is Not Platonic

Imperative repair code makes the reader ask:

- why does decoration need a ref?
- why does loading need a ref?
- when does Pierre re-render decorations?
- does `model.render({})` reset anything else?
- is this a workaround or the intended adapter protocol?

The platonic version should make this protocol explicit.

### Target

Introduce a small "runtime bridge" concept:

```ts
type FileSystemPierreRuntimeBridge = {
  getDecoration: () => FileSystemPierreDecorationState
  getLoading: () => FileSystemPierreLoadingController
  repaintDecoration: () => void
}
```

Or, more concretely:

```ts
function useFileSystemPierreRuntimeState({
  decoration,
  loading,
  model,
}: {
  decoration: FileSystemPierreDecorationState
  loading: FileSystemPierreLoadingController
  model: PierreFileTreeModel
}) {
  const getDecoration = useLatestValue(decoration)
  const getLoading = useLatestValue(loading)

  useFileSystemPierreDecorationRepaint({
    decorationVersion,
    model,
  })

  return { getDecoration, getLoading }
}
```

The key is not the exact helper name. The key is that persistent-runtime
synchronization becomes a named adapter responsibility, not incidental refs in
the model hook.

### Better Target If Pierre Supports It

If Pierre exposes a decoration invalidation API, use it:

```ts
model.invalidateRowDecorations()
```

instead of:

```ts
model.render({})
```

If Pierre does not expose that API, wrap the current `model.render({})` in a
function whose name states the intent:

```ts
repaintFileSystemPierreDecorations(model)
```

The current code says how. The ideal code says why.

### Acceptance

- no raw `model.render({})` call inside `useFileSystemPierreModel`;
- decoration repaint is named as decoration repaint;
- latest refs live in one runtime-state helper;
- `useFileSystemPierreModel` reads as wiring:
  - input;
  - order;
  - runtime state;
  - expansion;
  - selection;
  - reset;
  - Pierre model options.

### Tests

Behavior tests must cover:

- lazy folder enters `Loading`;
- failed lazy folder shows error text;
- retry clears error and expands loaded folder;
- decoration changes do not reset semantic selection;
- decoration changes do not collapse normal expansion;
- same-path model reset does not re-emit selection.

## Gap 3: Provider Context Is Narrow In API, Broad In Render Invalidation

### Current Shape

`FileSystemProvider` exposes one context value:

```ts
type FileSystemContextValue = FileSystemDomainState &
  FileSystemCompositionState
```

The public hooks are narrow:

```ts
useFileSystemHeader()
useFileSystemExplorer()
useFileSystemSelectedFile()
useFileSystemOpenPreviewDialog()
```

But they all read the same context object.

### Why This Is Not Platonic

This is a React performance and conceptual precision gap.

When one slice changes, every context consumer can re-render:

- query changes can wake preview;
- preview source changes can wake explorer;
- loading changes can wake header;
- renderer prop changes can wake explorer.

Memoization reduces damage. It does not make the shape exact.

The platonic ideal is that a part subscribes only to the state it uses.

### Target Option A: Split Contexts By Product

Use separate contexts:

```txt
FileSystemBrowserContext
FileSystemPreviewContext
FileSystemOpenPreviewContext
FileSystemRenderersContext
```

Then:

```ts
useFileSystemExplorer()
  reads browser context only

useFileSystemSelectedFile()
  reads preview/renderers context only

useFileSystemOpenPreviewDialog()
  reads open-preview context only
```

### Target Option B: External Store With Selectors

Use `useSyncExternalStore` selectors:

```ts
const explorer = useFileSystemSelector(selectFileSystemExplorerPart)
```

This is more powerful and often faster. It is also more machinery.

Do not introduce an external store unless profiling proves context invalidation
is visible.

### Target Option C: Keep Current Context, Prove It Is Fast Enough

The most pragmatic option may be to keep one context and add render-count tests
or profiling.

That is not platonic in theory. It may be platonic in practice if the current
cost is negligible and the extra store would add more complexity than it saves.

### Decision Rule

Split contexts only if one of these is true:

- file-system explorer re-renders during preview source resolution;
- selected preview re-renders during Pierre decoration-only updates;
- large-file-system interactions show measurable wasted work;
- the split makes ownership clearer without adding subscription ceremony.

### Acceptance

Either:

- context is split so each part subscribes to its product state only;

or:

- a performance note and test evidence prove the current context is cheap
  enough.

The platonic design should choose deliberately. It should not accidentally keep
the broad context just because it works.

## Gap 4: Naming Is Good, But Not Perfect

### Current Strength

These names are now good:

- `FileSystemExplorerPart`;
- `FileSystemListViewController`;
- `FileSystemGridViewController`;
- `FileSystemColumnsViewController`;
- `FileSystemStatusState`;
- `FileSystemPierreDecorationState`;
- `FileSystemPierreQueryState`;
- `selectedPath`;
- `currentPath`;
- `pierrePath`;
- `rawIndex`;
- `index`.

They make the old broad controller harder to reintroduce.

### Remaining Problem

`Controller` is doing too much work.

Some controller types are command-bearing view inputs:

```ts
FileSystemGridViewController
FileSystemColumnsViewController
```

Some are adapter slices:

```ts
FileSystemPierreLoadingController
FileSystemPierreNavigationController
FileSystemPierreSelectionController
```

Some include read state and commands:

```ts
FileSystemListViewController
```

That is acceptable. It is not perfect.

### Target Naming Rule

Use:

- `Controller` only when the object exposes commands;
- `State` only when the object is read-only;
- `Input` for a factory's dependency shape;
- `Part` for a named component hook result;
- `Adapter` only for translation between two systems;
- never use `Manager`, `Engine`, `Data`, or `Model` unless it is the exact
  domain word.

### Possible Renames

Consider:

```ts
FileSystemPierreLoadingController
```

This is probably correct because it includes `ensureChildren`.

Consider:

```ts
FileSystemPierreQueryState
```

This is correct because it is read-only.

Consider:

```ts
FileSystemListViewController
```

This may be too broad. Better:

```ts
FileSystemListViewInput
```

But only if the object is treated as a render input. If it contains commands
used by the list view, `Controller` is still defensible.

The design should not rename for aesthetics. Rename only when the name lies.

### Acceptance

- every exported type suffix follows the naming rule;
- no file-system type uses `Data`;
- no broad type uses `ExplorerController`;
- no type named `Controller` is read-only;
- no type named `State` contains command functions.

## Gap 5: The Domain Surface Is Still Very Large

### Current Surface

`FileSystem` owns:

- file browsing;
- path navigation;
- history;
- view mode;
- search;
- sort;
- inferred folders;
- lazy loading;
- lazy errors;
- selection;
- selected preview;
- open-preview dialog;
- source resolution;
- thumbnails;
- render metadata;
- render file actions;
- list view;
- grid view;
- columns view;
- Pierre adapter;
- status bar.

This is a real product surface. Most of it should stay.

### Why This Is Not Platonic

A reader still cannot understand the whole component in one pass.

The current modularization helps, but the top-level concept remains wide.

### Target

Make the domain read as four products:

```txt
browser
  path, query, sort, view, index, loading, selection

selected preview
  selected entry, resolved source, metadata/actions

open preview
  explicit open command, dialog state, resolved source

Pierre list adapter
  input, lifecycle, row decoration, selection bridge
```

Every file should belong to one product.

### Proposed File Groups

```txt
file-system-provider.tsx
file-system-controller.ts

file-system-browser-*.ts
file-system-preview-*.ts
file-system-open-preview-*.tsx
file-system-pierre-*.ts
```

Do not rename all files immediately. Use this as the mental map.

### Acceptance

- the docs explain the four products;
- architecture tests guard the four ownership boundaries;
- no file imports from all four product groups except the provider or easy API;
- no UI file mixes preview resolution and Pierre lifecycle;
- no Pierre file imports open-preview dialog code;
- no preview file imports Pierre code.

## Gap 6: Preview And Open Preview Have Similar Source Resolution

### Current Shape

Selected preview and open preview both need source resolution, but they serve
different intents:

- selected preview is ambient;
- open preview is explicit.

The current design preserves that distinction. Good.

The remaining risk is that both paths can drift:

- selected preview source cache;
- open-preview source resolution;
- `onFileOpen` override behavior;
- unavailable source fallback.

### Target

Extract a shared source-resolution command helper without merging the two
intents.

Example:

```ts
resolveFileSystemPreviewSource({
  file,
  resolveFileSource,
  signal,
})
```

Selected preview uses it for ambient rendering.

Open preview uses it for explicit open behavior.

Do not create a generic `PreviewManager`.

### Acceptance

- source resolution error behavior is shared;
- ambient preview and explicit open remain separate state machines;
- `onFileOpen` remains only on explicit open;
- tests cover source unavailable in both paths.

## Gap 7: Architecture Tests Are Useful But Too Source-Shape Heavy

### Current Strength

Architecture tests now catch important regressions:

- no broad explorer controller;
- no Pierre import in grid/columns;
- no file-system-controller import in Pierre modules;
- registry payload alignment;
- file-system composition grammar.

This is good.

### Remaining Problem

Some tests assert exact source strings. That can freeze spelling more than
meaning.

### Target

Use tests in layers:

```txt
behavior tests
  prove product workflows

architecture tests
  prove forbidden dependencies and exported surfaces

source-shape tests
  only for boundaries that cannot be proven otherwise
```

### Better Architecture Assertions

Prefer:

```ts
expect(importSpecifiers(file)).not.toContain("./file-system-controller")
```

over:

```ts
expect(file).toContain("currentLoading.folderErrors")
```

The second assertion is acceptable temporarily, but it guards spelling.

### Acceptance

- architecture tests focus on imports, exports, and forbidden names;
- behavior tests cover lazy, selection, preview, and source workflows;
- source-shape tests do not freeze incidental local variable names;
- every architecture test has a short comment explaining what regression it
  prevents.

## Gap 8: Speed Has Not Been Proven Deeply Enough

### Current Evidence

The component uses:

- Pierre virtualization for list view;
- TanStack virtualization for grid and columns;
- memoized indexes;
- source cache invalidation tests;
- large-list DOM-bound tests.

That is good.

### Missing Evidence

The platonic ideal needs stronger performance proof:

- provider context invalidation cost;
- search reset cost on large indexes;
- lazy folder update cost;
- decoration repaint cost;
- source cache memory behavior;
- thumbnail rendering pressure;
- columns view with deeply nested folders.

### Target Performance Budget

Add a local performance profile script or test harness:

```txt
10,000 files
1,000 folders
100 lazy folders
deep path depth 20
search update
sort update
select update
preview source update
lazy error update
```

Track:

- render count per named part;
- time to rebuild visible index;
- time to update Pierre model;
- DOM node count;
- number of source resolutions;
- number of thumbnail renders.

### Acceptance

- large-list selection does not rebuild source cache;
- preview resolution does not repaint Pierre rows;
- decoration-only update does not recreate file-system index;
- search update remains interactive at large scale;
- source cache does not grow after same-path item replacement.

## Gap 9: Public Documentation Should Teach The Boundary

### Current Problem

The implementation has a clear boundary, but a consumer may still ask:

- when do I use `FileSystem`?
- when do I compose `FileSystemProvider` parts manually?
- when do I use `FileViewer` directly?
- when do I use `ViewerRoot`?
- why is Pierre not public?
- why are there both selected preview and open preview?

### Target Docs

The docs should teach:

```tsx
// Easy API
<FileSystem items={items} />
```

```tsx
// Composed API
<FileSystemProvider items={items}>
  <ViewerRoot>
    <ViewerHeader>
      <FileSystemHeader />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar aria-label="Files">
        <FileSystemExplorer />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemSelectedFile />
      </ViewerSurface>
    </ViewerBody>
    <FileSystemOpenPreviewDialog />
  </ViewerRoot>
</FileSystemProvider>
```

And it should explicitly state:

- `ViewerRoot` is layout;
- `FileSystemProvider` is domain state;
- `FileSystemExplorer` is the browser;
- `FileSystemSelectedFile` is ambient preview;
- `FileSystemOpenPreviewDialog` is explicit open preview;
- Pierre is internal implementation detail;
- `FileViewer` renders one selected source, not a file system.

### Acceptance

- docs show easy and composed APIs;
- docs do not mention old `FileSystemViewer*` names;
- docs do not mention `FileSystemExplorerController`;
- docs explain selected preview vs open preview;
- docs explain why viewer primitive is not modified.

## Gap 10: The Code Still Has A Few Low-Entropy Lines

### Examples

Some lines exist only because React and Pierre need bridging:

```ts
const decorationRef = React.useRef(decoration)
const loadingRef = React.useRef(loading)
```

Some types exist only as aliases:

```ts
export type FileSystemExplorerState = FileSystemExplorerPart
```

The alias may be acceptable as public named-part vocabulary. But if it never
adds meaning, it should eventually disappear or be documented as the hook
result type.

### Target

Every exported type should answer:

- who consumes this?
- why does it exist?
- what boundary does it protect?

If the answer is "because it was convenient", delete it.

### Acceptance

- no exported type is a pure alias unless it names a public hook result;
- every file has one primary exported concept or a tightly related group;
- helper names state domain intent, not implementation mechanics;
- local variables do not use suffixes like `_` except to avoid a genuine
  language collision.

## Ideal End State

The final form should read like this:

```txt
FileSystemProvider
  creates browser, preview, and open-preview products

FileSystemHeader
  renders browser controls

FileSystemExplorer
  dispatches view-specific browser surfaces

FileSystemListView
  owns the Pierre tree surface

FileSystemPierreAdapter
  owns translation between file-system semantics and Pierre runtime

FileSystemSelectedFile
  renders ambient selected-file preview

FileSystemOpenPreviewDialog
  renders explicit open-file preview
```

The code should make these questions trivial:

- What owns path?
- What owns query?
- What owns selected path?
- What owns open preview?
- What owns source resolution?
- What owns Pierre path translation?
- What owns row decoration?
- What owns expansion snapshots?
- What owns lazy retry?
- What owns layout?

If a reader must inspect five files to answer one of those questions, the
design is not platonic.

## Phased Plan

### Phase 1: Make Explorer Projection More Exact

Implement dedicated factories:

- `createFileSystemListViewController`;
- `createFileSystemGridViewController`;
- `createFileSystemColumnsViewController`;
- `createFileSystemStatusState`.

Keep them in `file-system-explorer-controllers.ts` unless the file becomes too
large.

Do not change behavior.

Tests:

- existing file-system behavior suite;
- architecture test that `createFileSystemExplorerPart` delegates to the four
  factories;
- architecture test that list factory does not receive `source`;
- architecture test that grid/columns factories do not receive Pierre-only
  state.

### Phase 2: Name The Pierre Runtime Bridge

Extract:

- latest decoration access;
- latest loading access;
- decoration repaint.

Possible file:

```txt
file-system-pierre-runtime.ts
```

or:

```txt
file-system-pierre-decoration-repaint.ts
file-system-pierre-latest-state.ts
```

Prefer one file if it explains the persistent Pierre callback boundary.

Tests:

- lazy error appears;
- retry clears error;
- decoration update preserves expansion;
- same selection does not re-emit.

### Phase 3: Decide Provider Subscription Strategy

Measure first.

Add a render-count test or profiling script:

```txt
selected preview source resolves
  explorer render count should stay bounded

lazy folder decoration updates
  selected preview render count should stay bounded

query changes
  open preview dialog should not rerender unless open state changes
```

Then choose:

- keep single context with proof;
- split context by product;
- use external-store selectors.

Do not add more providers without evidence.

### Phase 4: Normalize Names

Audit exported file-system types.

For each exported type:

```txt
type name
suffix
commands?
read-only?
public hook result?
adapter boundary?
```

Rename only lying names.

Do not churn names that are merely imperfect but clear.

### Phase 5: Strengthen Docs

Update public docs for:

- easy API;
- composed API;
- selected preview vs open preview;
- viewer primitive boundary;
- Pierre as implementation detail.

Docs should teach the architecture without exposing internals.

### Phase 6: Replace Source-Shape Tests With Boundary Tests

Keep architecture tests, but reduce fragile string checks.

Prefer:

- import graph checks;
- exported type checks;
- forbidden dependency checks;
- behavior tests for workflows.

Only assert local variable names when the name itself is the architectural
contract.

## Anti-Goals

Do not:

- touch viewer primitives;
- add generic slot/provider machinery;
- expose Pierre publicly;
- hide file-system complexity behind `manager` or `engine`;
- merge selected preview and open preview;
- remove grid or columns to simplify the architecture;
- add compatibility wrappers;
- rename every file in one pass;
- build a custom tree runtime instead of Pierre;
- optimize context invalidation without measuring it.

## Final Acceptance Checklist

The component is close to platonic when all are true:

- `rg "FileSystemExplorerController" registry/new-york-v4/ui` returns nothing.
- `FileSystemExplorer` receives `FileSystemExplorerPart` directly.
- `createFileSystemExplorerPart` delegates to exact view factories.
- list view does not receive source resolution.
- grid and columns do not import Pierre modules.
- Pierre modules do not import `file-system-controller`.
- Pierre decoration repaint is named and isolated.
- no raw `model.render({})` appears in the model hook.
- provider subscription strategy is either split or proven cheap.
- selected preview and open preview share source-resolution semantics without
  merging state machines.
- docs teach easy API and composed API.
- architecture tests guard imports and exports, not incidental spelling.
- large-file-system performance has a measurable budget.
- every exported type suffix is truthful.
- all file-system behavior tests pass.
- registry build passes.
- typecheck has no file-system errors.

## Final Judgment

The current design is good enough to continue building on.

It is not yet Flaubertian.

The next pursuit is not more abstraction. It is precision:

```txt
make projections exact
name runtime bridges
prove render speed
teach boundaries
delete incidental ceremony
```

When that is done, the component should stop feeling like a complex system that
has been carefully managed. It should feel like the only reasonable way to
build a Pierre-native file explorer on top of the viewer primitive.
