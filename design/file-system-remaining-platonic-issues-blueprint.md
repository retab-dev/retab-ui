# File System Remaining Platonic Issues Blueprint

## Purpose

This blueprint lists the remaining reasons the current `FileSystem` has not reached the platonic ideal.

Platonic ideal means:

- simplicity;
- speed;
- everything needed;
- nothing more;
- perfect modularization;
- high-entropy code;
- perfectly consistent names;
- Flaubertian precision.

Current judgment after this pass: the architecture is substantially better, but not perfect.

The correct direction is in place:

- `FileSystem` composes viewer primitives.
- Viewer primitives own layout only.
- Pierre owns the native tree runtime.
- File rendering stays in `FileViewer`.
- `file-system-light` remains by product decision.

The remaining problems are not evidence that the provider model failed. They are evidence that the file-system domain still carries a few convenience decisions, adapter lifecycle contracts, and proof gaps that need to be made explicit.

## Current Shape

The main easy API is now structurally correct:

```tsx
<FileSystemProvider {...providerProps}>
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
    <FileSystemOpenFileDialog />
  </ViewerRoot>
</FileSystemProvider>
```

The Pierre adapter is now split:

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

That is much closer. It is not yet inevitable.

## Issue 1: `file-system.tsx` Was Too Large

Previous state:

- `registry/new-york-v4/ui/file-system.tsx` was over 400 lines.
- It contains provider state, narrow hooks, easy API layout, body layout, header composition, explorer switching, selected preview, modal dialog, and dialog viewer plumbing.

This is too much for one file if the target is Flaubertian precision.

The file is not chaotic, but it is still a mixed document:

- domain provider;
- part hook surface;
- easy API composition;
- modal preview behavior;
- small private layout helpers.

### Implemented Fix

Split by public concept, not by arbitrary size:

```txt
file-system.tsx
file-system-provider.tsx
file-system-parts.tsx
file-system-open-file-dialog.tsx
```

Target ownership:

`file-system.tsx`

- exports the easy API;
- re-exports public types and named parts;
- contains almost no logic.

`file-system-provider.tsx`

- owns `FileSystemProvider`;
- owns `useFileSystem`;
- owns context type.

`file-system-parts.tsx`

- owns `useFileSystemHeader`;
- owns `useFileSystemExplorer`;
- owns `useFileSystemSelectedFile`;
- owns `FileSystemHeader`;
- owns `FileSystemExplorer`;
- owns `FileSystemSelectedFile`.

`file-system-open-file-dialog.tsx`

- owns `useFileSystemOpenFileDialog`;
- owns `FileSystemOpenFileDialog`;
- owns `FileSystemPreviewDialog`;
- owns `FileSystemDialogViewer`.

This makes each file read like one idea.

Current state:

- `file-system.tsx` is the easy API and re-export surface.
- `file-system-provider.tsx` owns provider context.
- `file-system-parts.tsx` owns named-part hooks and components.
- `file-system-open-file-dialog.tsx` owns fallback open-preview dialog behavior.

This issue is solved for this pass.

## Issue 2: The Provider Still Stores A God Controller

The public hooks are narrow now, but internally the context still exposes:

```ts
controller: ReturnType<typeof useFileSystemController>
```

Then each hook projects a slice:

```ts
const { controller, title } = useFileSystem()
```

This is acceptable, but not perfect. The provider still has a central object that knows everything:

- path navigation;
- history;
- query;
- view mode;
- selection;
- child loading;
- source resolution;
- file opening;
- categories;
- current entries;
- raw index;
- visible index.

The narrow hooks reduce public leakage. They do not fully remove internal conceptual compression.

### Fix

Do not split too early if it adds ceremony. But the ideal internal state would have typed slices:

```ts
type FileSystemNavigationState
type FileSystemQueryState
type FileSystemSelectionState
type FileSystemLoadingState
type FileSystemSourceState
type FileSystemViewState
```

The context should expose named state slices, not a single controller blob.

Possible target:

```ts
type FileSystemContextValue = {
  navigation: FileSystemNavigationState
  query: FileSystemQueryController
  selection: FileSystemSelectionController
  loading: FileSystemLoadingController
  source: FileSystemSourceController
  view: FileSystemViewController
  openFilePreview: FileSystemOpenFilePreviewController
  title: string
}
```

This should happen only if it makes the implementation clearer. A fake split would be worse than the current controller.

Acceptance test: no named part hook should reach a capability outside its conceptual slice.

## Issue 3: `FileSystemOpenFileDialog` Is Useful But Philosophically Impure

The easy API has two preview modes:

- selected file preview in `ViewerSurface`;
- opened file preview in `Dialog`.

This is useful. It is also conceptually awkward because the file-system primitive becomes:

- browser;
- selected preview;
- modal preview launcher;
- modal preview renderer.

The name is now precise, but the role is still debatable.

### Fix

Make a final product decision and encode it explicitly.

Path A: modal preview is first-class.

- Keep `FileSystemOpenFileDialog`.
- Move it to its own file.
- Document it as part of the easy API behavior.
- Keep `FileSystemProvider` responsible for fallback modal state.
- Add a clear distinction between selection and opened preview.

Path B: modal preview is demo composition.

- Remove dialog state from the provider.
- Keep only `onFileOpen`.
- Provide a `FileSystemWithOpenDialog` block or example.

Current recommendation: keep Path A for product usefulness, but isolate it completely so it no longer makes `file-system.tsx` feel like two components in one file.

## Issue 4: `file-system-light` Remains A Parallel Story

Product decision: keep `file-system-light`.

That decision is valid. It still prevents the file-system family from being perfectly minimal.

There are now two registry UI components:

- `file-system`;
- `file-system-light`.

They are not the same abstraction. They have different goals and different data contracts.

### Fix

Do not remove it. Instead, make the boundary explicit in docs and registry copy.

`file-system`

- full browser-plus-preview file-system component;
- supports folders, query, multiple views, lazy children, selection, source resolution, preview, and modal open.

`file-system-light`

- lightweight flat-file picker/viewer;
- not the canonical file-system architecture;
- intentionally not part of the provider/named-part composition story.

Acceptance test: docs must not present `file-system-light` as a smaller version of the same primitive. It is a separate convenience component.

## Issue 5: Pierre Expansion Was Too Heavy

Previous state:

- `file-system-pierre-expansion.ts` is the largest Pierre adapter module.
- It owns snapshots, query-mode expansion, retry expansion, model refs, current controller refs, directory detection, and reset identity helpers.

This is not accidental complexity. It reflects real lifecycle coupling:

- Pierre owns expanded tree state.
- Retab owns semantic query state.
- Lazy folders can fail and retry.
- Resetting paths can lose expansion.
- Query expansion should not overwrite normal expansion.

Still, it is dense.

### Implemented Fix

Split expansion only if the names improve.

Possible target:

```txt
file-system-pierre-expansion.ts
file-system-pierre-expansion-snapshot.ts
file-system-pierre-lazy-retry.ts
```

`file-system-pierre-expansion.ts`

- public hook;
- composes snapshot and retry helpers.

`file-system-pierre-expansion-snapshot.ts`

- `PierreExpansionSnapshot`;
- `rememberExpansionBeforeReset`;
- `resolveExpansionAfterReset`;
- `collectOpenPierrePaths`;
- `collectDirectoryPierrePaths`.

`file-system-pierre-lazy-retry.ts`

- retry expansion after failed lazy folder loads.

Do this only if the resulting code is easier to read. Three tiny files with leaky names would be worse.

Current state:

- `file-system-pierre-expansion.ts` is the React composition hook.
- `file-system-pierre-expansion-snapshot.ts` owns pure snapshot policy.
- `file-system-pierre-lazy-retry.ts` owns retry expansion after lazy folder failures.
- `file-system-pierre-reset-identity.ts` owns reset identity and diff helpers.

This issue is solved enough for the current architecture pass. The remaining work is not further splitting; it is adding more behavioral proof around reset causes and lazy-loading flows.

## Issue 6: Reset Identity Still Feels Like A Workaround

The new `file-system-pierre-reset.ts` is a good split. But the concept itself is still awkward:

```ts
currentPath
decorationVersion
hasSemanticQuery
input
```

This exists because the app has to decide when Pierre needs a reset.

The design is correct, but not beautiful. It is a reconciliation object between two state machines.

### Fix

Make reset identity more explicit as an adapter contract:

```ts
type FileSystemPierreResetCause = "path-input" | "semantic-query" | "decoration"
```

Or expose helper names that describe why identity changes:

```ts
createPathInputResetKey
createDecorationResetKey
createSemanticQueryResetKey
```

Do not add ceremony unless it makes debugging reset behavior easier.

Acceptance test: when a reader sees reset logic, they should know which changes reset paths, which changes decoration, and which changes expansion policy.

## Issue 7: Row Decoration Still Uses A CSS Encoding Trick

The row decoration domain model is better now:

```ts
type FileSystemPierreRowMeta = {
  detailLabel: string
  kindLabel: string
}
```

But the adapter still maps into Pierre's limited decoration surface:

```ts
return {
  text: meta.detailLabel,
  title: meta.kindLabel,
}
```

And CSS uses `title` as displayed content.

This is a local, contained hack. It is not a platonic rendering model.

### Implemented Fix

Short term:

- Keep the hack private to `file-system-pierre-decoration.ts`.
- Do not leak `title` or `text` as file-system domain concepts.
- Add a short comment explaining why `title` is used as row metadata transport.

Long term:

- If Pierre supports richer row decoration slots, replace the CSS encoding with real markup.

Acceptance test: no other module should know that row kind is transported through `title`.

Current state:

- the `title` transport remains private to `file-system-pierre-decoration.ts`;
- a local comment explains the Pierre limitation;
- no other file-system module refers to the transport detail.

This issue is contained, but not philosophically perfect until Pierre exposes richer row metadata slots.

## Issue 8: Gallery Mode Is Now Architecturally Correct But Product-Ambiguous

Gallery now behaves as a browser view inside `FileSystemExplorer`, while selected preview remains in `ViewerSurface`.

That fixed the double-preview problem.

But the product meaning of gallery is now less rich than before:

- before: gallery owned a large preview plus thumbnail strip;
- now: gallery is a thumbnail grid in the browser sidebar.

This is architecturally cleaner. It may or may not be the desired product behavior.

### Fix

Decide what `view="gallery"` means:

Path A: gallery is an explorer mode.

- Keep it in the sidebar.
- Make thumbnails excellent.
- Keep preview exclusively in `ViewerSurface`.

Path B: gallery is a full-layout mode.

- Do not special-case `FileSystemBody`.
- Instead expose a separate composed example:

```tsx
<FileSystemProvider>
  <ViewerRoot>
    <FileSystemHeader />
    <ViewerBody>
      <ViewerSurface>
        <FileSystemGalleryExplorer />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileSystemProvider>
```

Current recommendation: Path A for the canonical `FileSystem`; Path B only as a block/example if needed.

## Issue 9: Tests Are Still Too Source-String Heavy

Architecture tests still inspect source text for:

- import boundaries;
- export names;
- composition order;
- forbidden strings.

This was useful during migration. It is not the platonic final testing strategy.

String tests can protect architecture, but they can also freeze spelling instead of behavior.

### Fix

Keep string tests only for hard boundaries:

- viewer primitives do not import file-system;
- `FileViewer` does not import file-system;
- no `FileSystemViewer*`;
- no `FileSystemTree`;
- no slot-object APIs.

Move everything else toward behavior:

- easy API renders one `ViewerRoot`;
- header/body/sidebar/surface are in the expected DOM hierarchy;
- list sorting changes row order;
- selection updates preview;
- modal opens only when no `onFileOpen` is supplied;
- query expansion restores normal expansion;
- lazy retry expands after success;
- gallery renders as explorer-only and does not duplicate preview.

Acceptance test: the implementation can be refactored internally without editing tests that only cared about source spelling.

## Issue 10: The File-System Docs Need A Sharper Story

The code now has a story. The docs should say it directly:

- `FileSystem` is the preassembled browser-plus-preview layout.
- `FileSystemProvider` and named parts let users build another layout.
- `FileSystemExplorer` owns browser modes.
- `FileSystemSelectedFile` owns selected preview.
- `FileSystemOpenFileDialog` is fallback open behavior.
- `file-system-light` is not the same abstraction.

Without this, consumers will infer API boundaries from examples and may misuse parts.

### Implemented Fix

Update docs with three sections:

1. Easy API.
2. Named-part composition.
3. Boundary rules.

Boundary rules:

- Do not put file-system state into viewer primitives.
- Do not use `FileViewer` as a file browser.
- Do not use `file-system-light` when folder/query/preview composition is needed.
- Use `onFileOpen` when app-level routing owns opening.
- Use the built-in dialog only for local preview fallback.

Current state:

- docs show the easy API and named-part composition;
- docs describe `FileSystemOpenFileDialog`;
- docs state boundary rules;
- docs explain that `file-system-light` is a separate lightweight flat-file convenience, not the canonical provider/named-part architecture.

The docs now tell the right story. They can still be improved with more visual examples, but the architecture boundary is documented.

## Issue 11: Naming Is Good, But Some Names Still Carry Implementation Scars

Good names:

- `FileSystemOpenFileDialog`;
- `openedFilePreview`;
- `openFilePreview`;
- `entriesByPierrePath`;
- `pierrePaths`;
- `decorationVersion`;
- `hasSemanticQuery`.

Names still worth reconsidering:

- `FileSystemExplorerState`: it is hook return data, not state in the state-machine sense.
- `explorerController`: accurate, but slightly heavy.
- `FileSystemPreviewController`: could be `FileSystemSelectedFileController`.
- `FileSystemStatusController`: acceptable, but maybe `FileSystemStatusState` if it is read-only.
- `FileSystemPierreResetIdentity`: accurate, but mechanical.

### Fix

Do one naming pass only if it removes ambiguity.

Do not rename for taste. Rename only when the new name tells a reader which world a value belongs to:

- file-system domain;
- Pierre runtime;
- viewer layout;
- selected preview;
- open dialog preview.

## Issue 12: The Component Is Fast Enough, But Speed Is Not Yet Proven

Pierre gives the list a strong runtime foundation, but the component does not yet have explicit performance proof.

Potential performance risks:

- rebuilding file-system input on index identity changes;
- expansion snapshot work on large trees;
- decoration version changes resetting too much;
- source resolution cache invalidation;
- thumbnail-heavy gallery rendering;
- repeated controller object identity changes.

### Implemented Fix

Add performance-oriented tests or profiling scripts:

- large tree render smoke test;
- sort update budget;
- search update budget;
- expansion reset budget;
- gallery thumbnail budget.

Do not optimize blindly. First measure.

Acceptance test: there is at least one large-tree regression test that proves the Pierre path does not devolve into rendering all rows.

Current state:

- a large-list test proves the Pierre-backed list keeps DOM rows bounded.
- this is structural performance proof, not wall-clock benchmarking.

Remaining work:

- add search, sort, and gallery structural performance tests if those paths become hot;
- avoid timing assertions until the environment is controlled.

## Issue 13: Accessibility Is Present But Not Audited As A System

The implementation uses roles from Pierre, buttons, tabs, labels, and viewer landmarks. But the file-system component has not had a dedicated accessibility audit.

Potential gaps:

- view mode tabs on small screens;
- keyboard behavior across list/grid/columns/gallery;
- modal focus return after close;
- sidebar trigger labeling in composed layouts;
- status updates for loading/error folders;
- screen-reader names for file thumbnails.

### Fix

Run an accessibility pass as its own blueprint or implementation pass.

Acceptance tests:

- keyboard open works in all explorer modes;
- modal close returns focus to the opened row;
- lazy loading and errors announce status;
- gallery thumbnails have stable accessible names;
- view switch controls remain keyboard reachable.

## Issue 14: Source Resolution Cache Is Hidden In The Controller

The controller owns a source cache:

```ts
const sourceCache = React.useRef(new Map<string, ViewerSource | null>())
```

That is practical. It is also hidden behavior:

- cache lifetime follows provider lifetime;
- cache key is file path;
- no documented invalidation beyond provider recreation;
- source changes for same path may be stale unless upstream identity changes force a new provider/controller.

### Implemented Fix

Make cache semantics explicit.

Options:

- document path-based source cache;
- include source identity in cache key when available;
- clear cache when `items` identity changes;
- expose a controlled resolver cache only if a real use case needs it.

Acceptance test: changing a file source for the same path should either update preview or be documented as unsupported.

Current state:

- the source cache clears synchronously when the `items` identity changes;
- a same-path source change test proves selected preview can update after item replacement.

Remaining work:

- document the provider-lifetime path cache semantics;
- consider richer cache keys only if a real same-path mutable-source use case requires it.

## Issue 15: Lazy Folder Loading Is Powerful But Hard To Reason About

Lazy loading currently interacts with:

- query filtering;
- visible index;
- folder errors;
- loading folders;
- expansion snapshots;
- retry expansion;
- columns keyboard child selection.

This is one of the most complex parts of the component.

### Fix

Create a small lifecycle document or test matrix:

```txt
folder click
folder double click
folder retry
query while loading
navigation while loading
selection while loading
columns child auto-select
load failure
load success after failure
```

The code may be acceptable, but the state machine should be explicit.

Acceptance test: every row in the matrix has a test or a documented non-goal.

## How To Solve This

The next pass should not be a rewrite. It should be a compression pass: move each remaining responsibility to the one place where it becomes obvious.

The goal is not more files for their own sake. The goal is that every exported symbol has one reason to exist and one owner.

### Phase 1: Split The Public Component Surface

This phase is complete. It remains here as the record of the solved shape.

Target file graph:

```txt
file-system.tsx
  exports easy API and re-exports public parts

file-system-provider.tsx
  exports FileSystemProvider
  exports useFileSystem
  owns context internals

file-system-parts.tsx
  exports useFileSystemHeader
  exports useFileSystemExplorer
  exports useFileSystemSelectedFile
  exports FileSystemHeader
  exports FileSystemExplorer
  exports FileSystemSelectedFile

file-system-open-file-dialog.tsx
  exports useFileSystemOpenFileDialog
  exports FileSystemOpenFileDialog

file-system-layout.tsx
  private or public only if needed
  exports FileSystemBody if composition docs need it
```

Recommended final `file-system.tsx`:

```tsx
"use client"

import { cn } from "@/lib/utils"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "./viewer"

import { FileSystemOpenFileDialog } from "./file-system-open-file-dialog"
import {
  FileSystemExplorer,
  FileSystemHeader,
  FileSystemSelectedFile,
} from "./file-system-parts"
import { FileSystemProvider } from "./file-system-provider"
import type { FileSystemProps } from "./file-system-types"

export { FileSystemProvider, useFileSystem } from "./file-system-provider"
export {
  FileSystemExplorer,
  FileSystemHeader,
  FileSystemSelectedFile,
  useFileSystemExplorer,
  useFileSystemHeader,
  useFileSystemSelectedFile,
} from "./file-system-parts"
export {
  FileSystemOpenFileDialog,
  useFileSystemOpenFileDialog,
} from "./file-system-open-file-dialog"
export type { ... } from "./file-system-types"

export function FileSystem({ className, ...providerProps }: FileSystemProps) {
  return (
    <FileSystemProvider {...providerProps}>
      <ViewerRoot
        data-viewer="file-system"
        bare
        defaultSidebarOpen
        className={cn(
          "h-[640px] rounded-lg border bg-background text-foreground",
          className
        )}
      >
        <ViewerHeader className="flex flex-col">
          <FileSystemHeader />
        </ViewerHeader>
        <ViewerBody>
          <ViewerSidebar
            aria-label="Files"
            width="min(22rem, 85vw)"
            className="flex min-w-0 flex-col border-r"
          >
            <FileSystemExplorer />
          </ViewerSidebar>
          <ViewerSurface className="bg-background">
            <FileSystemSelectedFile />
          </ViewerSurface>
        </ViewerBody>
        <FileSystemOpenFileDialog />
      </ViewerRoot>
    </FileSystemProvider>
  )
}
```

This file should be boring. Boring is the target.

Acceptance now met:

- `file-system.tsx` should be under roughly 120 lines.
- It should contain no `React.useState`.
- It should contain no `React.useCallback`.
- It should contain no dialog internals.
- It should contain no controller slicing.
- It should contain the canonical composition in one readable block.

### Phase 2: Make The Provider Context Honest

Do not start by exploding `useFileSystemController`. First make the context contract explicit.

Current context shape:

```ts
type FileSystemContextValue = {
  controller: ReturnType<typeof useFileSystemController>
  openedFilePreview: ...
  openFilePreview: ...
  ...
}
```

Near-term target:

```ts
type FileSystemProviderController = ReturnType<typeof useFileSystemController>

type FileSystemOpenFilePreviewState = {
  openedFilePreview: FileSystemOpenedFilePreview | null
  openFilePreview: (file: FileSystemFileEntry) => void
  setOpenedFilePreview: React.Dispatch<
    React.SetStateAction<FileSystemOpenedFilePreview | null>
  >
}

type FileSystemRenderers = {
  renderFileActions?: FileSystemProps["renderFileActions"]
  renderMetadata?: FileSystemProps["renderMetadata"]
}

type FileSystemContextValue = {
  controller: FileSystemProviderController
  openFilePreviewState: FileSystemOpenFilePreviewState
  renderers: FileSystemRenderers
  title: string
}
```

This is still one controller, but the non-controller concerns are no longer loose fields. It removes ambiguity before deeper splitting.

Long-term target, only if proven clearer:

```ts
type FileSystemContextValue = {
  navigation: FileSystemNavigationController
  query: FileSystemQueryController
  selection: FileSystemSelectionController
  loading: FileSystemLoadingController
  source: FileSystemSourceController
  view: FileSystemViewController
  openFilePreview: FileSystemOpenFilePreviewController
  renderers: FileSystemRenderers
  title: string
}
```

Do not create this long-term shape by just wrapping the same object in many names. Each slice must own coherent behavior and be independently understandable.

Acceptance:

- `useFileSystemHeader` cannot access source resolution or lazy loading.
- `useFileSystemExplorer` cannot access dialog state.
- `useFileSystemSelectedFile` cannot access navigation or query mutation.
- `useFileSystemOpenFileDialog` cannot access selection except through the opened file preview state.

### Phase 3: Make Modal Preview First-Class Or Remove It

Recommendation: keep it first-class.

Reason: the easy API should be useful without app routing. Double-clicking a file should do something complete.

Make that decision explicit with types:

```ts
type FileSystemOpenedFilePreview = {
  file: FileSystemFileEntry
  source: ViewerSource | null
}

type FileSystemOpenFilePreviewController = {
  openedFilePreview: FileSystemOpenedFilePreview | null
  openFilePreview: (file: FileSystemFileEntry) => void
  closeFilePreview: () => void
}
```

Prefer a named close function over exposing `setOpenedFilePreview` publicly:

```ts
export function useFileSystemOpenFileDialog() {
  const { openFilePreviewState } = useFileSystem()
  return {
    closeFilePreview: openFilePreviewState.closeFilePreview,
    openedFilePreview: openFilePreviewState.openedFilePreview,
  }
}
```

The provider may keep an internal setter, but the public part should speak in commands, not raw state mutation.

Target behavior:

- click selects;
- double-click opens;
- Enter opens focused row in list/grid/gallery;
- selected preview and opened preview are intentionally different states;
- if `onFileOpen` is provided, built-in modal does not open;
- if source resolution fails, dialog opens with `Preview unavailable`.

Acceptance:

- tests prove selected preview updates on single click;
- tests prove modal opens on double click without `onFileOpen`;
- tests prove modal does not open with `onFileOpen`;
- tests prove close returns focus to the row or at least to the file-system root.

### Phase 4: Decide The Explorer View Contract

The canonical easy API should stay browser-plus-preview.

That means all `FileSystemExplorer` views are browser views:

- list: native tree browser;
- grid: card/grid browser;
- columns: column browser;
- gallery: thumbnail browser.

None of these should render the selected file document preview. `FileSystemSelectedFile` is the only selected-preview owner.

Document this as a hard rule:

```txt
Explorer views select and open entries.
Explorer views do not render the selected document surface.
```

If a full-page gallery is wanted, create a composed block, not a `FileSystemBody` special case.

Target block:

```tsx
export function FileSystemGalleryBlock() {
  return (
    <FileSystemProvider items={items}>
      <ViewerRoot bare>
        <ViewerHeader>
          <FileSystemHeader />
        </ViewerHeader>
        <ViewerBody>
          <ViewerSurface>
            <FileSystemExplorer />
          </ViewerSurface>
        </ViewerBody>
        <FileSystemOpenFileDialog />
      </ViewerRoot>
    </FileSystemProvider>
  )
}
```

Acceptance:

- `FileSystemBody` has no `view === "gallery"` branch.
- exactly one selected preview surface exists in the easy API.
- gallery tests assert no duplicate `FileViewer`.

### Phase 5: Split Pierre Expansion Only Along Real State Boundaries

This phase is complete for the current pass. Keep the target below as the constraint that prevents future drift.

The expansion module should be split only if the new files map to real concepts.

Target:

```txt
file-system-pierre-expansion.ts
file-system-pierre-expansion-snapshot.ts
file-system-pierre-lazy-retry.ts
```

`file-system-pierre-expansion-snapshot.ts`:

```ts
export type FileSystemPierreExpansionSnapshot = {
  expandedPierrePaths: Set<PierrePath>
  source: "normal" | "query"
}

export function rememberFileSystemPierreExpansionSnapshot(args: {
  identity: FileSystemPierreResetIdentity
  model: PierreFileTreeModel
  snapshotsByCurrentPath: Map<string, FileSystemPierreExpansionSnapshot>
}): void

export function resolveFileSystemPierreExpansionAfterReset(args: {
  identity: FileSystemPierreResetIdentity
  snapshotsByCurrentPath: ReadonlyMap<string, FileSystemPierreExpansionSnapshot>
}): PierrePath[]
```

`file-system-pierre-lazy-retry.ts`:

```ts
export function useFileSystemPierreLazyRetryExpansion({
  controller,
  modelRef,
}: {
  controller: FileSystemExplorerController
  modelRef: React.MutableRefObject<PierreFileTreeModel | null>
}) {
  return React.useCallback((args: FileSystemPierreSelectedEntry | null) => {
    ...
  }, [])
}
```

`file-system-pierre-expansion.ts` then becomes:

```ts
export function useFileSystemPierreExpansion({ controller }) {
  const modelRef = React.useRef<PierreFileTreeModel | null>(null)
  const snapshotsByCurrentPathRef = React.useRef(new Map())
  const expandRetriedFolder = useFileSystemPierreLazyRetryExpansion({
    controller,
    modelRef,
  })

  return {
    expandRetriedFolder,
    modelRef,
    rememberBeforeReset,
    resolveAfterReset,
  }
}
```

Acceptance:

- snapshot logic imports no React except types if possible;
- retry logic knows about `ensureChildren` and `folderErrors`;
- expansion hook composes both and owns refs;
- no file exceeds its conceptual responsibility.

### Phase 6: Make Reset Causes Readable

The reset identity should explain what kind of change happened.

Do not necessarily add a union if it complicates code. But do add helper naming that makes reset reasons obvious:

```ts
type FileSystemPierreResetIdentity = {
  currentPath: string
  decorationVersion: string
  hasSemanticQuery: boolean
  input: FileSystemPierreInput
}

function createFileSystemPierreResetIdentity(...)
function fileSystemPierreResetIdentityChanged(...)
```

If debugging remains hard, introduce:

```ts
type FileSystemPierreResetDiff = {
  didChangeCurrentPath: boolean
  didChangeDecoration: boolean
  didChangeSemanticQuery: boolean
  didChangeInput: boolean
}
```

Use it only in tests or development diagnostics unless product code needs it.

Acceptance:

- reset tests cover each reset reason separately;
- test names state the reset cause;
- no test relies only on the full reset identity changing.

### Phase 7: Convert Architecture Tests To Behavioral Proofs

Keep only hard-boundary string tests.

Keep:

```ts
expect(fileViewer).not.toContain("FileSystemProvider")
expect(viewer).not.toContain("file-system")
expect(fileSystem).not.toContain("FileSystemViewer")
expect(fileSystem).not.toContain("FileSystemTree")
```

Replace composition-order string tests with DOM tests:

```ts
it("renders the canonical browser plus preview hierarchy", () => {
  render(<FileSystem items={items} />)

  const root = screen.getByTestId(...)
  const body = root.querySelector('[data-slot="viewer-body"]')
  expect(body?.children[0]).toHaveAttribute("data-slot", "viewer-sidebar")
  expect(body?.children[1]).toHaveAttribute("data-slot", "viewer-surface")
})
```

Replace source-string hook tests with type-level or behavior tests:

- render `<FileSystemHeader />` inside provider and assert it can navigate/search/sort;
- render `<FileSystemExplorer />` inside custom layout and assert selection works;
- render `<FileSystemSelectedFile />` alone in custom layout and assert preview works;
- render `<FileSystemOpenFileDialog />` and assert double-click opens.

Acceptance:

- refactoring from one file into four files should not require changing architecture tests;
- tests fail when behavior or boundaries break, not when lines move.

### Phase 8: Prove Performance With A Large Tree Harness

This phase has a first structural proof. It is not the full performance story.

Add a focused performance guard that is cheap enough for CI.

Suggested test:

```ts
it("virtualizes a large list without rendering every row", async () => {
  const items = createLargeFileSystemItems({
    folders: 100,
    filesPerFolder: 100,
  })

  render(<FileSystem items={items} defaultPath="folder-001/" />)

  await findFileTreeItem(/file-001/i)
  expect(fileTreeShadowRoot().querySelectorAll("[role='treeitem']").length)
    .toBeLessThan(80)
})
```

Add interaction budget tests only if stable:

- sorting should not create thousands of DOM nodes;
- search should show matching rows without expanding every row as DOM;
- decoration changes should not clear selected preview.

Do not assert wall-clock timing unless the test environment is controlled. Prefer structural performance assertions:

- row count;
- render count;
- model recreation count;
- scroll call count.

Acceptance:

- large tree test exists;
- it proves virtualized DOM stays bounded;
- it proves sort/search do not render all rows.

### Phase 9: Audit Accessibility As A Workflow

Add tests that match user workflows, not isolated attributes.

Required workflows:

1. Keyboard list open.
2. Keyboard grid open.
3. Keyboard gallery open.
4. Columns lazy child selection.
5. Dialog close focus behavior.
6. Loading folder announcement.
7. Failed folder retry announcement.

Example:

```ts
it("returns focus after closing the open-file dialog", async () => {
  render(<FileSystem defaultPath="reports/" items={items} />)

  const row = await findFileTreeItem(/report.pdf/i)
  fireEvent.doubleClick(row)
  await screen.findByRole("dialog")
  fireEvent.keyDown(document, { key: "Escape" })

  await waitFor(() => {
    expect(row).toHaveFocus()
  })
})
```

If focus return cannot be guaranteed because the dialog library owns focus restoration, document that and assert the closest stable behavior.

Acceptance:

- every explorer mode has keyboard open coverage;
- dialog focus behavior is either tested or documented as delegated;
- loading/error state has an accessible announcement path.

### Phase 10: Make Source Cache Semantics Explicit

This phase has the minimum correct implementation. Documentation and richer cache keys remain optional future work.

The source cache should not be a hidden surprise.

Preferred behavior:

- cache source resolution by file path and source identity;
- clear stale entries when `items` changes;
- keep failed resolutions cached only if intentional.

Possible implementation:

```ts
function fileSystemSourceCacheKey(file: FileSystemFileEntry) {
  const source = file.source
  if (source?.kind === "url") return `${file.path}\0url\0${source.url}`
  if (source?.kind === "text") return `${file.path}\0text\0${source.text}`
  return file.path
}
```

If this is too broad, at minimum clear cache on `items` identity change:

```ts
React.useEffect(() => {
  sourceCache.current.clear()
}, [items])
```

Acceptance:

- test changing same-path source updates selected preview;
- or docs explicitly state that source resolution is path-cached for provider lifetime.

### Phase 11: Write The Lazy Loading Matrix As Tests

Turn the lifecycle matrix into a test table.

Suggested matrix:

```ts
const lazyScenarios = [
  "click expands loaded folder",
  "double click navigates folder",
  "failed folder displays error decoration",
  "retry folder expands after success",
  "query while loading does not select stale child",
  "navigation while loading does not select stale child",
  "selection while loading cancels child auto-select",
  "columns child auto-select works after success",
  "load failure keeps lazy folder selected",
]
```

Each row should have one test or a named non-goal.

Acceptance:

- lazy behavior is no longer tribal knowledge;
- each cross-state interaction has a test name that explains expected behavior.

## Platonic End State

The final form should feel like this:

```txt
FileSystem
  easy API composition only

FileSystemProvider
  domain state only

FileSystemParts
  named part hooks and named part components only

FileSystemOpenFileDialog
  modal fallback preview only

FileSystemController
  file-system domain controller
  no viewer layout
  no Pierre runtime

FileSystemExplorer
  browser mode switcher
  no selected-preview rendering

FileSystemSelectedFile
  selected preview only

Pierre adapter
  input: path conversion and prepared input
  model: useFileTree wiring
  reset: reset lifecycle
  order: sort adapter
  selection: selection sync
  expansion: expansion composition
  expansion snapshot: pure snapshot policy
  lazy retry: failed lazy folder retry expansion
  decoration: row metadata adapter
  decoration version: decoration invalidation key
```

In the platonic version, a reader can answer these questions without searching:

- Where does layout live? `FileSystem` and viewer primitives.
- Where does file-system state live? `FileSystemProvider` and controller.
- Where does Pierre state live? Pierre adapter modules.
- Where does selected preview live? `FileSystemSelectedFile`.
- Where does modal preview live? `FileSystemOpenFileDialog`.
- Where does file rendering live? `FileViewer`.
- Where does lightweight flat-file behavior live? `file-system-light`.

## Prioritized Next Steps

1. Replace remaining non-boundary source-string tests with behavior tests.
2. Run an accessibility pass across list, grid, columns, dialog, loading, and error flows.
3. Write the lazy-loading lifecycle matrix as tests.
4. Document source cache semantics explicitly.
5. Decide whether the provider's internal god controller deserves real state slices.
6. Add search, sort, and gallery structural performance tests if those paths become hot.
7. Add richer docs examples only where they clarify composition boundaries.

## Non-Goals

Do not touch viewer primitives for this pass.

Do not remove `file-system-light`.

Do not add compatibility aliases.

Do not reintroduce `FileSystemViewer*`.

Do not reintroduce `FileSystemTree`.

Do not make `FileViewer` aware of file-system concepts.

Do not make Pierre own semantic file-system query.

## Final Verdict

The current `FileSystem` is much better than before this pass. It is still not platonic.

It now has the right ownership direction and a workable provider/named-part model. The remaining gap is the last layer of proof and inevitability:

- fewer hidden lifecycle contracts;
- behavioral proof instead of source-string proof;
- broader measured speed instead of assumed speed;
- accessibility verified as a system.

The next perfecting pass should be surgical. The architecture does not need another revolution.
