# Pierre-Native File System Viewer Blueprint

## Thesis

Build a Pierre-native file-system explorer as a domain component, then compose
it inside the existing viewer primitive.

The viewer primitive stays untouched.

The ideal shape is:

```tsx
<FileSystemProvider items={items}>
  <ViewerRoot data-viewer="file-system">
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
    <FileSystemOpenDialog />
  </ViewerRoot>
</FileSystemProvider>
```

The product is not a Finder clone. It is a clean, shadcn-like document file
explorer powered by Pierre, using our viewer primitive as the layout exercise.

## Perfection Standard

The component should be:

- simple: one state owner, one explorer surface, one source-resolution path;
- fast: Pierre owns the virtualized tree, previews resolve on demand, model
  updates avoid remount churn;
- complete: navigation, search, filters, sorting, lazy folders, selection,
  preview, open dialog, loading, errors, keyboard access, tests, docs;
- minimal: no old React row list, no duplicate tree state, no viewer-prefixed
  file-system exports, no generic abstractions invented for one component;
- modular: better than Extend by splitting data, controller, Pierre adapter,
  controls, preview, and composition into precise files;
- high entropy: every file and symbol carries one responsibility;
- consistent: `item`, `entry`, `file`, `folder`, `path`, `currentPath`,
  `selectedPath`, `query`, `source`, and `model` mean exactly one thing;
- precise: viewer names describe layout, file-system names describe browsing,
  file-viewer names describe rendering one file.

## Non-Negotiables

Do not change:

- `ViewerRoot`;
- `ViewerHeader`;
- `ViewerBody`;
- `ViewerSidebar`;
- `ViewerSurface`;
- `FileViewer`.

Do change:

- file-system composition;
- file-system browser layout;
- Pierre integration;
- tests and docs that encode the file-system API.

The file-system component is a demo and proof of the viewer primitive. It must
not force file-system assumptions into the primitive.

## Current Problems

### The Body Collapses

`FileSystemTree` assumes a flex-column parent. `ViewerSidebar` is an `aside`
with sizing and overflow, not a file-system browser layout container.

Result:

- toolbar renders;
- list header renders;
- status bar renders;
- Pierre body has no reliable height;
- rows disappear or collapse.

The fix is not to modify `ViewerSidebar`.

The fix is for `FileSystemExplorer` to own the full-height flex column it needs.

### The Pierre Model Lifecycle Is Weak

The current implementation creates `new FileTree(...)` inside `useMemo`.

Extend uses `useFileTree`, which creates one stable model and then updates that
model imperatively through Pierre methods such as:

- `resetPaths`;
- `setSearch`;
- `setIcons`;
- `setGitStatus`;
- `scrollToPath`.

That is the native Pierre lifecycle. We should use it.

### The Header Lies About The Rows

The current list header says:

```txt
Name | Type | Size | Modified
```

But Pierre rows provide:

```txt
content lane | decoration lane
```

If we want Pierre-native, the row metadata must be rendered through Pierre's
decoration lane and styled as Pierre row metadata, not as a separate fake table.

### The Naming Is Off

`FileSystemTree` is too narrow.

The primary domain surface should be:

```txt
FileSystemExplorer
```

It is the browsing surface, not merely a tree. Internally it can use Pierre's
tree model.

## Lessons From Extend

Keep:

- Pierre as the native explorer/list engine;
- flat object-store manifest input;
- explicit folders for lazy loading;
- object-store-friendly path semantics;
- external URL/thumbnail ownership;
- viewer dialog behavior for supported document files;
- row decoration for metadata;
- stable Pierre model lifecycle.

Improve:

- do not put everything in one 5k-line component;
- keep indexing, filtering, sorting, and path conversion in pure modules;
- isolate Pierre model setup in one hook;
- isolate Pierre row decoration in one file;
- use our viewer primitive for layout instead of a bespoke shell;
- keep file-system domain exports separate from viewer exports;
- make tests inspect behavior through stable public DOM and Pierre APIs where
  appropriate, not through accidental implementation shape.

## Target Public API

Easy API:

```tsx
<FileSystem items={items} title="Files" />
```

Composed API:

```tsx
<FileSystemProvider items={items} title="Files">
  <ViewerRoot>
    <ViewerHeader>
      <FileSystemHeader />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar className="min-w-0 flex-1 border-r md:w-auto">
        <FileSystemExplorer />
      </ViewerSidebar>
      <ViewerSurface className="hidden w-[42%] max-w-xl min-w-[22rem] flex-none lg:flex">
        <FileSystemSelectedFile />
      </ViewerSurface>
    </ViewerBody>
    <FileSystemOpenDialog />
  </ViewerRoot>
</FileSystemProvider>
```

Standalone API:

```tsx
<FileSystemProvider items={items} title="Files">
  <section className="flex h-[640px] min-h-0 flex-col rounded-lg border">
    <FileSystemHeader />
    <FileSystemExplorer />
  </section>
</FileSystemProvider>
```

Exports:

```txt
FileSystem
FileSystemProvider
useFileSystem
useFileSystemHeader
useFileSystemExplorer
useFileSystemSelectedFile
useFileSystemOpenDialog
FileSystemHeader
FileSystemExplorer
FileSystemSelectedFile
FileSystemOpenDialog
```

Do not export:

```txt
FileSystemViewerProvider
FileSystemViewerHeader
FileSystemViewerTree
FileSystemViewerSelectedFile
```

## Component Responsibilities

### FileSystem

The easy API.

It composes:

- `FileSystemProvider`;
- viewer primitives;
- file-system parts.

It owns no file-system state directly.

### FileSystemProvider

Owns domain state:

- current path;
- path history;
- query;
- sort;
- filters;
- selected path;
- loaded lazy children;
- folder loading/errors;
- source cache.

It does not render viewer primitives.

### FileSystemHeader

Owns controls:

- back;
- forward;
- current path label;
- search;
- filters;
- sort affordance if it belongs outside Pierre;
- optional view controls only if multiple views remain.

It does not render `ViewerHeader`.

### FileSystemExplorer

Owns the browser area:

- full-height flex column;
- Pierre tree surface;
- empty state;
- status bar;
- browser-level loading/error placement.

It is the part that makes file-system work inside `ViewerSidebar` and outside
viewer primitives.

### FileSystemSelectedFile

Owns selected-entry preview.

Rules:

- folder selection renders folder information;
- file selection resolves `ViewerSource`;
- resolved file source renders through `FileViewer`;
- loading, unavailable, unsupported, and error states are explicit.

### FileSystemOpenDialog

Owns explicit file opening.

It uses the same source-resolution path as selected preview.

## Module Architecture

```txt
file-system.tsx
  public provider, easy composition, named parts

file-system-controller.ts
  state transitions, selection, navigation, source resolution

file-system-index.ts
  normalize paths, build file/folder maps, derive child relations

file-system-query.ts
  search, filters, sort, category labels

use-file-system-children-loader.ts
  lazy folder loading, abort, request dedupe, errors

file-system-explorer.tsx
  FileSystemExplorer shell and status placement

file-system-pierre-model.ts
  useFileSystemPierreModel

file-system-pierre-input.ts
  pure conversion from FileSystemIndex/query/currentPath to Pierre paths

file-system-pierre-decoration.ts
  row decoration text, title, and CSS variables/unsafeCSS

file-system-controls.tsx
  FileSystemHeader controls and status bar

file-system-preview.tsx
  selected file/folder preview

file-system-types.ts
  public and shared types
```

No file should exceed its responsibility.

Target size:

```txt
file-system.tsx                 < 260 lines
file-system-controller.ts        < 420 lines
file-system-explorer.tsx         < 180 lines
file-system-pierre-model.ts      < 260 lines
file-system-pierre-input.ts      < 180 lines
file-system-pierre-decoration.ts < 180 lines
```

These are budgets, not hard laws, but exceeding them should trigger skepticism.

## Pierre Model Contract

Use `useFileTree`.

The model is created once for the explorer instance:

```ts
const { model } = useFileTree({
  flattenEmptyDirectories: false,
  icons,
  initialExpansion: "closed",
  initialSelectedPaths,
  itemHeight,
  overscan,
  preparedInput,
  renderRowDecoration,
  search: false,
  unsafeCSS,
  onSelectionChange,
})
```

After mount:

- path/filter/sort changes call `model.resetPaths`;
- search changes call `model.setSearch` if using Pierre search;
- selected path changes update Pierre selection without recreating the model;
- icon changes call `model.setIcons`;
- folder expansion state is collected from the model before resets;
- current path changes remount or reset intentionally, not accidentally.

Do not create `new FileTree(...)` inside component render or `useMemo`.

## Pierre Path Contract

File-system paths are absolute to the manifest root:

```txt
financials/report.pdf
financials/
```

Pierre paths are relative to `currentPath`:

```txt
report.pdf
archive/old.pdf
```

All conversion lives in `file-system-pierre-input.ts`.

Exports:

```ts
type FileSystemPierreInput = {
  paths: string[]
  pathEntries: Map<string, FileSystemEntry>
  preparedInput: PreparedFileTreeInput
}

function buildFileSystemPierreInput(args: {
  currentPath: string
  index: FileSystemIndex
  query: FileSystemQueryState
}): FileSystemPierreInput

function toPierrePath(path: string, currentPath: string): string
function fromPierrePath(path: string | null, input: FileSystemPierreInput): FileSystemEntry | null
```

Tests must cover:

- root path conversion;
- nested current path conversion;
- folder trailing slash normalization;
- omitted entries outside `currentPath`;
- query-filtered descendants;
- unknown Pierre paths.

## Row Decoration Contract

The Pierre row has two semantic lanes:

```txt
content
decoration
```

Use decoration for metadata.

Do not fake a four-column React table above Pierre rows unless the Pierre rows
are styled to match it.

Recommended minimal row metadata:

```txt
Name | Modified | Size
```

Implementation:

- `content` lane is Pierre-native file/folder name and icon;
- decoration text is size or child count;
- decoration title or data attribute carries modified date;
- `unsafeCSS` styles decoration as two aligned metadata columns.

This mirrors Extend's proven technique but isolates it in
`file-system-pierre-decoration.ts`.

If the component wants no table affordance, remove the column header entirely
and use a clean explorer toolbar plus Pierre rows. Do not show a header that
the row layout does not honor.

## Visual Standard

Clean shadcn-like explorer:

- quiet border;
- no decorative gradients;
- no macOS Finder mimicry;
- compact toolbar;
- clear path label;
- subtle filters;
- row hover uses `accent/50`;
- selected row uses `primary` or a softer token depending on theme fit;
- metadata is muted;
- icons are consistent across explorer, preview, and thumbnails.

The explorer should feel like a serious document workflow tool, not an OS clone.

## Layout Contract

`FileSystemExplorer` renders:

```tsx
<div className="flex min-h-0 flex-1 flex-col">
  <FileSystemExplorerToolbarOrHeader />
  <div className="min-h-0 flex-1">
    <PierreFileTree className="block size-full" />
  </div>
  <FileSystemStatusBar />
</div>
```

or, if toolbar lives only in `FileSystemHeader`:

```tsx
<div className="flex min-h-0 flex-1 flex-col">
  <div className="min-h-0 flex-1">
    <PierreFileTree className="block size-full" />
  </div>
  <FileSystemStatusBar />
</div>
```

The key rule:

`FileSystemExplorer` never relies on its parent being a flex column.

If it needs full height inside a block parent, the parent must give it height.
Inside `ViewerSidebar`, it must fill because the explorer itself is a flex item
with `min-h-0 flex-1`.

## Search And Filter Contract

There are two valid modes.

### External Filtering

React/file-system filters produce a new Pierre path list.

Use for:

- file type filters;
- modified date filters;
- advanced object-store filters.

### Pierre Search

Pierre search owns text matching and highlighting.

Use for:

- text search;
- keyboard search session;
- hide-non-matches behavior.

Do not rebuild the model on every search keystroke if Pierre can own the search
session directly.

## Selection Contract

Single selection.

Rules:

- clicking a row selects it;
- keyboard focus should mirror selection for a file explorer feel;
- selecting a folder triggers lazy load if needed;
- double-clicking a folder navigates;
- double-clicking a file opens;
- Enter opens focused/selected entry;
- controlled `selectedPath` remains supported.

The controller stores `selectedPath`.

Pierre stores focused row and internal selection view state.

The model hook synchronizes them in one place.

## Lazy Folder Contract

Lazy folder loading remains domain state, not Pierre state.

Rules:

- `ensureChildren(folderPath)` dedupes concurrent loads;
- loading and error state are exposed by folder path;
- row decoration or row content shows loading/error;
- retry uses the same loader;
- loaded children become normal items in the index;
- path reset preserves relevant expansion.

## Preview Contract

`FileSystemSelectedFile` is not Pierre-specific.

It consumes file-system state:

- selected folder;
- selected file;
- source loading state;
- resolved source.

It renders file previews through `FileViewer`.

That means Pierre can be replaced later in the explorer without touching preview
logic, and file rendering can evolve without touching Pierre.

## What To Remove From The Current Implementation

Remove:

- `FileSystemTree` naming;
- manual `new PierreFileTreeModel(...)` lifecycle;
- table header that does not match Pierre row metadata;
- any assumption that `ViewerSidebar` is a flex column;
- Pierre path math inside the view component;
- shadow DOM test helpers that assert incidental row structure.

Keep:

- `FileSystemProvider`;
- `FileSystemHeader`;
- `FileSystemSelectedFile`;
- `FileSystemOpenDialog`;
- pure index/query modules;
- lazy children loader;
- viewer primitive composition.

Rename:

```txt
FileSystemTree -> FileSystemExplorer
useFileSystemTree -> useFileSystemExplorer
FileSystemTreeState -> FileSystemExplorerState
```

## Tests

### Architecture Tests

Assert:

- `FileSystem` composes `FileSystemProvider`, viewer primitives, and
  file-system domain parts in visible order.
- file-system domain parts do not render viewer slots.
- viewer primitive files do not import file-system modules.
- no `FileSystemViewer*` exports.
- Pierre model logic lives in `file-system-pierre-model.ts`.
- Pierre path conversion lives in `file-system-pierre-input.ts`.

### Pure Tests

Cover:

- index construction;
- query filtering;
- sorting;
- Pierre path conversion;
- row decoration metadata;
- lazy loader request dedupe.

### Component Tests

Cover:

- explorer rows render in `ViewerSidebar`;
- explorer rows render standalone;
- status bar is bottom-stable;
- selecting a row updates preview;
- double-clicking file opens dialog;
- double-clicking folder navigates;
- search updates visible rows;
- filters update visible rows;
- lazy folder loading and retry;
- controlled selection.

### Visual Browser Test

Required before accepting the change:

- open file-system block/demo;
- verify list/explorer rows are visible;
- verify preview surface renders selected entry;
- verify no overlap in desktop width;
- verify mobile/medium width does not collapse rows;
- verify console has no React/Pierre errors.

## Implementation Sequence

1. Create `FileSystemExplorer` and `useFileSystemExplorer`.
2. Replace `FileSystemTree` in easy API, docs, and tests.
3. Add `file-system-pierre-input.ts` for path/input preparation.
4. Add `file-system-pierre-decoration.ts` for decoration text and CSS.
5. Add `file-system-pierre-model.ts` using `useFileTree`.
6. Move Pierre lifecycle out of `file-system-list-view.tsx`.
7. Decide whether there is still a separate `file-system-list-view.tsx`; if
   Pierre is the explorer, prefer `FileSystemExplorer` as the rendered surface.
8. Remove fake table header or make it precisely match Pierre decoration lanes.
9. Fix explorer height contract inside `ViewerSidebar` without touching viewer.
10. Update docs and architecture tests.
11. Rebuild registry output.
12. Run focused tests, TypeScript, and browser visual verification.

## Acceptance Bar

The component is correct when:

- it is Pierre-native;
- it composes inside viewer primitives without changing them;
- the explorer rows are visible and stable;
- the Pierre model is stable through `useFileTree`;
- path/filter/sort/search updates do not remount unnecessarily;
- file-system state and Pierre model synchronization live in one hook;
- preview rendering is independent of Pierre;
- docs teach domain parts inside viewer slots;
- code is more modular than Extend's monolithic file-system source;
- no old Finder/table implementation remains as a second path.

## Final Ideal

The final component should read like this:

```txt
FileSystemProvider
  domain state

FileSystemHeader
  controls

FileSystemExplorer
  Pierre-native browsing surface

FileSystemSelectedFile
  selected entry preview

FileSystemOpenDialog
  explicit file opening

ViewerRoot / ViewerHeader / ViewerBody / ViewerSidebar / ViewerSurface
  layout only

FileViewer
  one file source renderer
```

That is the clean version of Extend's idea: same Pierre-native explorer instinct,
better boundaries, better names, our viewer primitive as the layout proof.

