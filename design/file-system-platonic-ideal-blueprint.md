# File System Platonic Ideal Blueprint

## Verdict

The file-system component should be a document workspace primitive that can be
placed inside a viewer layout, not a viewer primitive itself.

The right hierarchy is:

```tsx
<FileSystemProvider items={items}>
  <ViewerRoot>
    <ViewerHeader>
      <FileSystemHeader />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar>
        <FileSystemBrowser />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemSelectedFile />
      </ViewerSurface>
    </ViewerBody>
    <FileSystemOpenDialog />
  </ViewerRoot>
</FileSystemProvider>
```

The viewer owns space. The file system owns browsing. The file viewer owns file
rendering. These three layers must stay separate.

The current list view is broken because that boundary is only half-real:

- `ViewerSidebar` is not a flex column.
- `FileSystemTree` assumes its parent lets `flex-1` fill height.
- the status bar can render while the list body collapses.
- the list header promises table columns, but the Pierre tree rows do not
  render matching table columns.

The fix is not to make `ViewerSidebar` smarter. The fix is to make the
file-system browser own its internal vertical layout and to make the list view
internally coherent.

## Perfection Standard

Platonic means:

- Simple: one owner for each behavior.
- Fast: virtualized where it matters, no hidden remount churn, no document
  preview work during pure navigation.
- Complete: navigation, sorting, filtering, selection, lazy folders, previews,
  opening, loading, errors, empty states, keyboard access, tests, docs.
- Nothing more: no compatibility aliases, no stale viewer-prefixed file-system
  exports, no unused generic abstractions, no shadow-DOM CSS tricks when React
  rows are clearer.
- Modular: pure data modules stay pure, React views stay view-only, async
  loading has one boundary.
- High entropy: every exported symbol carries product meaning.
- Consistent names: `item`, `entry`, `file`, `folder`, `path`,
  `currentPath`, `selectedPath`, `query`, `view`, and `source` mean one thing
  everywhere.
- Precise: if something renders a file-system part, name it `FileSystem*`; if
  something renders a generic viewer slot, name it `Viewer*`.

## Lessons From Extend And The Old Retab List

Extend gets the product shape right:

- flat object-store manifest in;
- Finder-style browser out;
- four views: icons/grid, list, columns, gallery;
- lazy folders;
- external ownership of URLs and thumbnails;
- document preview/open behavior built around the file type.

Extend also proves that Pierre can be used for a file-tree list, but their
implementation pays a tax:

- the list columns are encoded through Pierre's decoration lane;
- column alignment depends on CSS injected into the tree shadow DOM;
- model updates require imperative `resetPaths`, `setSearch`, and `setIcons`;
- the single component is very large, so small behavior changes require reading
  many unrelated concerns.

Our old Retab list got one thing right: the header and rows were the same
layout. It rendered actual React rows with a fixed column grid and virtualization.
That made the visual contract obvious.

The old list was not perfect because it owned tree mechanics directly:

- expansion state lived in the controller;
- row flattening was a domain concern;
- keyboard tree behavior had to be maintained locally.

The ideal keeps the old list's visual coherence and removes its stale
controller pollution.

## Core Decision

Do not use Pierre for the main file-system list view.

Use React-owned virtual rows for list view.

Reason:

The product surface is a Finder list, not a code-editor tree. A Finder list has
real columns. The header, rows, selection background, focus ring, truncation,
metadata, loading/error affordances, and responsive behavior should be one
React layout. Encoding columns into a shadow-DOM decoration span is not the
precise boundary.

Pierre remains a good library for a pure file tree. It is not the platonic
primitive for this component's list view.

The component should not depend on `@pierre/trees` unless a future
`FileSystemTreeView` is added as a distinct view with no table columns.

## Target Public API

The easy API:

```tsx
<FileSystem items={items} title="Files" />
```

The composed API:

```tsx
<FileSystemProvider items={items} title="Files">
  <ViewerRoot>
    <ViewerHeader>
      <FileSystemHeader />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar className="flex min-h-0 min-w-0 flex-1 flex-col">
        <FileSystemBrowser />
      </ViewerSidebar>
      <ViewerSurface className="hidden w-[42%] max-w-xl min-w-[22rem] flex-none lg:flex">
        <FileSystemSelectedFile />
      </ViewerSurface>
    </ViewerBody>
    <FileSystemOpenDialog />
  </ViewerRoot>
</FileSystemProvider>
```

Exported parts:

```txt
FileSystem
FileSystemProvider
useFileSystem
useFileSystemHeader
useFileSystemBrowser
useFileSystemSelectedFile
useFileSystemOpenDialog
FileSystemHeader
FileSystemBrowser
FileSystemSelectedFile
FileSystemOpenDialog
```

Do not export `FileSystemViewerProvider`, `FileSystemViewerHeader`,
`FileSystemViewerTree`, or `FileSystemViewerSelectedFile`.

## Naming Model

Use these names exactly:

- `item`: caller-provided manifest record.
- `entry`: normalized internal record.
- `file`: normalized file entry.
- `folder`: normalized folder entry.
- `path`: canonical file path or folder path.
- `folderPath`: canonical folder path ending with `/`, except root `""`.
- `currentPath`: folder currently being browsed.
- `selectedPath`: selected entry path.
- `source`: `ViewerSource` for a file preview.
- `view`: one of the file-system views.
- `query`: search, filters, sort.

Avoid:

- `tree` for the main browser.
- `node` for file-system entries.
- `viewer` in file-system domain exports.
- `row` outside the list view.

## Target Module Boundaries

```txt
file-system.tsx
  public composition, provider, named parts, open dialog

file-system-controller.ts
  path history, query, view, selection, source resolution

file-system-index.ts
  path normalization, entry normalization, child maps

file-system-query.ts
  filtering, sorting, category derivation

use-file-system-children-loader.ts
  lazy folder loading, request dedupe, errors, abort cleanup

file-system-browser.tsx
  switches between list, grid, columns, gallery
  owns the browser's full-height vertical layout

file-system-list-view.tsx
  virtualized Finder list rows only

file-system-list-model.ts
  pure visible-row derivation from index, currentPath, expandedFolders, query

file-system-grid-view.tsx
  grid view only

file-system-columns-view.tsx
  columns view only

file-system-gallery-view.tsx
  gallery view only

file-system-preview.tsx
  selected-file preview and metadata

file-system-controls.tsx
  toolbar, filter bar, status bar

file-system-types.ts
  public and shared types
```

No view imports another view. No pure module imports React. No controller imports
view code. No viewer primitive imports file-system code.

## Browser Layout Contract

`FileSystemBrowser` is required.

It owns:

- header-independent browser content;
- the current view;
- the status bar;
- the internal full-height flex column.

Shape:

```tsx
function FileSystemBrowser() {
  const state = useFileSystemBrowser()

  return (
    <div data-slot="file-system-browser" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <CurrentFileSystemView state={state} />
      </div>
      <FileSystemStatusBar controller={state.controller} />
    </div>
  )
}
```

The parent slot can be any block, flex item, sidebar, sheet, or standalone
section. The browser still fills its own vertical space.

This avoids relying on `ViewerSidebar` being a flex column.

## List View Ideal

The list view is a Finder list with true columns.

Columns:

```txt
Name        flexible, minimum 16rem
Type        9rem
Size        7rem
Modified    10rem
```

Row height:

```txt
36px desktop
40px coarse pointer
```

The header and every row use the same CSS grid template.

Rows are virtualized with `@tanstack/react-virtual`, because:

- it keeps DOM bounded;
- it stays in React;
- it gives exact control over row geometry;
- it does not require shadow-DOM styling;
- it makes tests inspect normal DOM.

The list model owns visible rows:

```ts
type FileSystemListRow = {
  entry: FileSystemEntry
  depth: number
  isExpandable: boolean
  isExpanded: boolean
}
```

Expansion state belongs to the list view, not the controller.

Reason:

Expansion is a presentation detail of the list view. Navigating by folders,
selecting entries, filtering, sorting, and resolving sources are domain state.
Disclosure inside one view is view state.

Preserve expansion per `currentPath` inside the list view:

```ts
Map<string, Set<string>>
```

When filters or search are active, reveal matching folder ancestors
temporarily. When filters clear, restore the previous expansion for that
folder.

## Keyboard Contract

The list view must support:

- `ArrowDown` and `ArrowUp`: move selection by visible row.
- `Home` and `End`: first and last visible row.
- `Enter`: open selected file or navigate into selected folder.
- `ArrowRight`: expand selected folder; if already expanded, move to first
  child.
- `ArrowLeft`: collapse selected folder; if already collapsed, move to parent.
- Printable keys: type-ahead among visible rows.
- Double click: open file or navigate folder.
- Single click: select.

Roving focus:

- one row has `tabIndex={0}`;
- all other rows have `tabIndex={-1}`;
- selected row and focused row stay synchronized;
- virtualization scrolls the target row into view before focusing.

ARIA:

- viewport has `role="tree"`;
- rows have `role="treeitem"`;
- rows set `aria-level`;
- expandable rows set `aria-expanded`;
- selected rows set `aria-selected`.

## Performance Contract

The list view must be cheap at 10,000 entries.

Hard rules:

- visible rows are memoized from `index`, `currentPath`, `query`, and local
  expansion state;
- row components receive stable handlers where possible;
- preview source resolution never happens on row hover;
- file thumbnail resolution in list rows is bounded or disabled by default;
- source preview happens only for selected file in `FileSystemSelectedFile` or
  opened file in `FileSystemOpenDialog`;
- no document viewer mounts during arrow-key movement unless selection settles
  or the selected preview is visible by design.

DOM budget:

```txt
list rows mounted <= visible rows + overscan
overscan <= 12
```

## Lazy Folder Contract

Lazy loading belongs to `use-file-system-children-loader.ts`.

Rules:

- de-dupe concurrent requests by `folderPath`;
- abort on unmount;
- keep previous children visible during retry;
- expose `loadingFolders` and `folderErrors`;
- never store loaded children outside the controller;
- normalize all returned items through the same index path.

List row affordances:

- loading folder shows inline `Loading`;
- failed folder shows inline retry affordance;
- retry does not change selection;
- expanding a lazy folder calls `ensureChildren(folder.path)`.

## Preview Contract

`FileSystemSelectedFile` renders the selected entry preview.

Rules:

- folders render folder information, not a fake file viewer.
- files resolve a `ViewerSource` through the controller.
- source resolution is cached by file path.
- preview loading, error, unsupported, and resolved states are explicit.
- opening a file uses the same source resolution path as preview.

The file-system preview may render `FileViewer`, but `FileViewer` must not know
about file-system state.

## View Composition Contract

The easy `FileSystem` composes:

```tsx
<FileSystemProvider>
  <ViewerRoot data-viewer="file-system" bare>
    <ViewerHeader>
      <FileSystemHeader />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar className="flex min-h-0 min-w-0 flex-1 flex-col border-r md:w-auto">
        <FileSystemBrowser />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemSelectedFile />
      </ViewerSurface>
    </ViewerBody>
    <FileSystemOpenDialog />
  </ViewerRoot>
</FileSystemProvider>
```

`FileSystemBrowser` is intentionally inside `ViewerSidebar` for the easy API,
but it must also work outside viewer primitives:

```tsx
<FileSystemProvider items={items}>
  <section className="flex h-[640px] flex-col rounded-lg border">
    <FileSystemHeader />
    <FileSystemBrowser />
  </section>
</FileSystemProvider>
```

This proves the separation.

## Tests Required

### Architecture

- No `FileSystemViewer*` exports.
- `FileSystem` easy API shows `ViewerRoot`, `ViewerHeader`, `ViewerBody`,
  `ViewerSidebar`, `ViewerSurface`, and file-system domain parts.
- `ViewerSidebar` is not modified to satisfy file-system internals.
- `FileViewer` does not import file-system modules.
- File-system domain parts do not import viewer primitives except the easy
  `FileSystem` composition.

### Layout

- list status bar remains pinned to the bottom of the browser.
- rows render between header and status in `ViewerSidebar`.
- rows render in standalone non-viewer composition.
- header and row columns align at desktop width.
- long names truncate without shifting Type, Size, or Modified.

### Behavior

- selecting a row updates `selectedPath`.
- double-clicking a file opens it.
- double-clicking a folder navigates into it.
- back and forward clear selection and preserve query behavior.
- sorting by Name, Type, Size, Modified changes visible row order.
- search reveals matching descendants and restores expansion when cleared.
- lazy folder loading shows loading and retry states.

### Performance

- 5,000 rows mount a bounded number of row buttons.
- switching view does not resolve every file source.
- arrowing through rows does not open files.

### Accessibility

- tree role and treeitem roles are present.
- selected row has `aria-selected`.
- expandable folders have `aria-expanded`.
- keyboard contract works through Testing Library.

## Removal Plan

Remove:

- `@pierre/trees` from file-system dependencies if no other exported
  file-system view uses it.
- `file-system-pierre-list-adapter.ts`.
- Pierre-specific shadow-root tests.
- `FILE_TREE_CSS`.
- `prepareFileTreeInput` and Pierre model lifecycle code.
- tests that inspect Pierre shadow DOM.

Keep:

- pure path/index/query tests;
- view behavior tests through public DOM;
- bounded DOM tests;
- source resolution tests.

## Implementation Sequence

1. Add `FileSystemBrowser` and `useFileSystemBrowser`.
2. Move status bar out of `FileSystemTree` and into `FileSystemBrowser`.
3. Rename `FileSystemTree` to `FileSystemBrowser` everywhere.
4. Rebuild list view with React virtual rows and true columns.
5. Add local list expansion state and pure visible-row derivation.
6. Remove Pierre adapter and dependency from file-system.
7. Update docs to show `FileSystemBrowser`.
8. Update architecture tests to enforce the separation.
9. Rebuild registry output.
10. Run focused file-system tests, architecture tests, TypeScript, and browser
    visual verification.

## Acceptance Bar

The component reaches the target when all of this is true:

- the list view is visually correct in the viewer sidebar;
- the list view is visually correct standalone;
- the status bar is bottom-pinned;
- rows render as real columns matching the header;
- no row logic depends on shadow DOM;
- the controller has no view-specific expansion state;
- `FileSystemBrowser` is the only file-system domain part responsible for
  internal browser layout;
- `ViewerRoot` and friends remain unchanged;
- the public API reads as file-system domain inside viewer layout;
- tests prove layout, behavior, accessibility, and bounded DOM.

## Final Shape

The ideal is not a clever provider hierarchy.

It is this:

```txt
FileSystemProvider
  owns file-system state

FileSystemHeader
  owns browser controls

FileSystemBrowser
  owns the current browsing view and internal height contract

FileSystemSelectedFile
  owns selected-entry preview

FileSystemOpenDialog
  owns explicit file opening

ViewerRoot / ViewerHeader / ViewerBody / ViewerSidebar / ViewerSurface
  own layout only

FileViewer
  owns rendering one file source
```

No layer leaks into the one below it. No row lies about its columns. No
component depends on a parent accidentally being `display: flex`.

