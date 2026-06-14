# File System Definitive Platonic Blueprint

## Verdict

The file system is not a viewer.

The file system is a source chooser.

The viewer is a source renderer.

The inevitable relationship is:

```tsx
<FileSystemProvider {...props}>
  <FileSystemBrowser />
  <FileSystemSelection>
    {({ source }) => <FileViewer source={source} />}
  </FileSystemSelection>
</FileSystemProvider>
```

Not:

```tsx
<Viewer>
  <FileSystemViewer />
</Viewer>
```

The file-system provider owns browsing state. The file-system browser renders
browsing. The file-system selection exposes the selected source. The caller
decides where `FileViewer` goes.

That is the whole architecture.

## The Product

The component should be a Pierre-native-feeling, Finder-like document explorer
for Retab UI:

- flat public API;
- shadcn-like composition;
- no Finder clone clutter;
- no viewer pollution;
- no Pierre leakage;
- no compatibility layer;
- no optional architecture theater;
- exact selected-source handoff to the existing file-viewer primitive.

It should feel like Extend's file-system API at the call site, but with a much
cleaner internal architecture and a better source model.

## Non-Negotiables

1. `FileSystemProvider` owns browsing.
2. `FileSystemBrowser` renders browsing.
3. `FileSystemSelection` exposes the selected source.
4. The caller decides where `FileViewer` goes.
5. `ViewerRoot`, `ViewerBody`, `ViewerSidebar`, and `ViewerSurface` remain
   generic layout primitives.
6. File-system exports are named `FileSystem*`, never `FileSystemViewer*`.
7. Pierre is private implementation detail.
8. Lazy loading is explicit domain state, not scattered refs.
9. Source resolution is explicit domain state, separate from folder loading.
10. The public API is flat unless grouping proves objectively clearer.
11. The internal architecture is decomposed even when the public API is flat.
12. The list view must render real aligned columns, not tree decorations
    pretending to be table cells.

## Canonical Public API

The default API is product-grade and flat:

```tsx
<FileSystem
  items={items}
  loadChildren={loadChildren}
  resolveSource={resolveSource}
  title="Files"
  defaultPath="/"
  defaultView="list"
/>
```

Controlled state is available only where the caller naturally needs ownership:

```tsx
<FileSystem
  items={items}
  loadChildren={loadChildren}
  resolveSource={resolveSource}
  path={path}
  onPathChange={setPath}
  selectedPath={selectedPath}
  onSelectedPathChange={setSelectedPath}
  view={view}
  onViewChange={setView}
  query={query}
  onQueryChange={setQuery}
/>
```

Do not group the public API like this unless the call site becomes clearer:

```tsx
<FileSystem
  data={{ items, loadChildren }}
  state={{ path, onPathChange }}
  sources={{ resolveSource }}
/>
```

The shadcn lesson is that the call site should read like product usage, not
like internal architecture.

## Canonical Composed API

The composed API exists for custom layouts:

```tsx
<FileSystemProvider
  items={items}
  loadChildren={loadChildren}
  resolveSource={resolveSource}
>
  <FileSystemRoot>
    <FileSystemHeader />
    <FileSystemBody>
      <FileSystemBrowser />
      <FileSystemSelection>
        {({ source }) => <FileViewer source={source} />}
      </FileSystemSelection>
    </FileSystemBody>
  </FileSystemRoot>
</FileSystemProvider>
```

`FileSystemSelection` is the bridge. It exposes selection state and resolved
source state. It does not decide layout.

```tsx
<FileSystemSelection>
  {({ entry, source, sourceState }) =>
    sourceState.status === "ready" ? <FileViewer source={source} /> : null
  }
</FileSystemSelection>
```

`FileSystemPreview` may exist as a convenience helper, but it is not the
conceptual center.

The composed API may use generic viewer layout primitives inside file-system
parts, but file-system parts must not be children of a required `ViewerRoot`.
The two systems are separate.

Good:

```tsx
<FileSystemProvider {...props}>
  <FileSystemRoot>
    <FileSystemHeader />
    <FileSystemBody>
      <FileSystemBrowser />
      <FileSystemSelection>
        {({ source }) => <FileViewer source={source} />}
      </FileSystemSelection>
    </FileSystemBody>
  </FileSystemRoot>
</FileSystemProvider>
```

Also good:

```tsx
<FileSystemProvider {...props}>
  <ViewerRoot>
    <FileSystemHeader />
    <ViewerBody>
      <ViewerSidebar>
        <FileSystemBrowser />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemSelection>
          {({ source }) => <FileViewer source={source} />}
        </FileSystemSelection>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileSystemProvider>
```

Bad:

```tsx
<FileSystemViewerProvider>
  <ViewerRoot>
    <FileSystemViewerHeader />
    <FileSystemViewerTree />
  </ViewerRoot>
</FileSystemViewerProvider>
```

That names the wrong ownership boundary.

## Export Surface

Export exactly the product surface:

```txt
FileSystem
FileSystemProvider
useFileSystem
useFileSystemItem
useFileSystemSelectedItem
useFileSystemSelectedSource

FileSystemRoot
FileSystemHeader
FileSystemBody
FileSystemBrowser
FileSystemSelection
FileSystemEmptyState
FileSystemErrorState

FileSystemListView
FileSystemGridView
FileSystemColumnView
FileSystemGalleryView
```

Do not export:

```txt
FileSystemViewer
FileSystemViewerProvider
FileSystemViewerHeader
FileSystemViewerTree
FileSystemController
FileSystemKernelRuntime
FileSystemPierre*
```

Internal machinery should be testable, but it should not become public product
API.

## Naming Dictionary

Every concept gets one name.

```txt
item
  caller-provided file-system object

entry
  normalized internal object

file
  normalized entry with file semantics

folder
  normalized entry with folder semantics

path
  canonical entry path

folderPath
  canonical folder path

currentPath
  folder currently being browsed

selectedPath
  selected entry path

expandedPaths
  expanded folder paths

query
  search text, filters, sort

view
  "list" | "grid" | "columns" | "gallery"

source
  ViewerSource resolved from a selected file

preview
  optional convenience rendering around FileSystemSelection

open
  modal or external full-file action
```

Forbidden synonyms:

```txt
node
entryItem
fileItem
selectedFilePath
activePath
currentFolder
treePath
viewerFile
previewFile
```

Use boring exact names. The code should not require translation.

## Domain Model

The caller provides `FileSystemItem`.

```ts
type FileSystemItem = {
  path: string
  name?: string
  kind: "file" | "folder"
  mimeType?: string
  size?: number
  modifiedAt?: Date | string | number
  children?: FileSystemItem[]
}
```

The component normalizes to `FileSystemEntry`.

```ts
type FileSystemEntry = {
  path: string
  name: string
  kind: "file" | "folder"
  mimeType: string | null
  size: number | null
  modifiedAt: number | null
  parentPath: string
  isLoaded: boolean
  isLoading: boolean
  loadError: string | null
}
```

Normalization rules:

- root is `"/"`;
- folder paths are canonical and slash-stable;
- file paths are canonical and slash-stable;
- duplicate paths fail loudly in development;
- names are derived from paths when absent;
- unknown metadata is `null`, not `undefined`;
- caller input is never mutated.

## Source Model

The file system never knows how to render a file.

It only resolves selected files to `ViewerSource`:

```ts
type ResolveFileSystemSource = (
  entry: FileSystemEntry
) => ViewerSource | Promise<ViewerSource>
```

Source lifecycle is separate from folder lifecycle:

```txt
folder loading:
  path -> children

source resolving:
  selected file path -> ViewerSource
```

They must not share request state, errors, caches, or naming.

Source states:

```txt
idle
loading
ready
error
```

Stale source results are ignored by request id. Selecting another file cancels
the previous source request when possible.

Folders do not resolve sources.

Files do not load children.

## Internal Architecture

Final file layout:

```txt
registry/new-york-v4/ui/
  file-system.tsx
    public easy component and named parts

  file-system-provider.tsx
    context wiring only

  file-system-context.tsx
    strict context hooks only

  file-system-types.ts
    public item, query, view, callback types

  file-system-entry.ts
    normalized entry type and helpers

  file-system-index.ts
    pure path index, child maps, normalization

  file-system-query.ts
    pure search, filter, sort functions

  file-system-kernel.ts
    pure state, events, reducer, commands

  file-system-kernel-runtime.ts
    synchronous dispatch loop and command queue

  file-system-folder-load-runtime.ts
    loadChildren requests, aborts, dedupe, stale rejection

  file-system-selection-runtime.ts
    selected entry source resolution

  file-system-open-runtime.ts
    explicit open-file lifecycle

  file-system-selectors.ts
    pure projections from kernel state

  file-system-list-memory.ts
    list expansion, reveal, focus, reset memory

  file-system-browser.tsx
    chooses list/grid/columns/gallery

  file-system-selection.tsx
    render-prop bridge from selected entry/source state to caller-owned layout

  file-system-list-view.tsx
    virtual aligned list rows

  file-system-grid-view.tsx
    icon/grid browser

  file-system-columns-view.tsx
    column browser

  file-system-gallery-view.tsx
    large preview browser

  file-system-preview.tsx
    optional convenience wrapper over FileSystemSelection
```

Dependency direction:

```txt
file-system.tsx
  -> provider
  -> runtime hooks
  -> kernel
  -> pure helpers

views
  -> context hooks
  -> selectors

selection
  -> selected source

optional preview
  -> selection
  -> FileViewer convenience
```

Forbidden direction:

```txt
kernel -> React
kernel -> DOM
kernel -> FileViewer
kernel -> Pierre
index -> React
query -> React
source runtime -> folder runtime
folder runtime -> source runtime
FileViewer -> FileSystem
Viewer -> FileSystem
```

## State Machine

There is one durable state machine:

```ts
type FileSystemState = {
  index: FileSystemIndex
  currentPath: string
  selectedPath: string | null
  expandedPaths: Set<string>
  view: FileSystemView
  query: FileSystemQuery
  history: FileSystemHistory
  folderRequests: Record<string, FileSystemFolderRequest>
  selectedSource: FileSystemSourceState
  openSource: FileSystemSourceState
}
```

Reducer events are domain events:

```txt
itemsChanged
pathChanged
folderSelected
fileSelected
folderToggled
viewChanged
queryChanged
folderLoadRequested
folderLoadSucceeded
folderLoadFailed
sourceRequested
sourceSucceeded
sourceFailed
openRequested
openSucceeded
openFailed
```

Reducer commands are side-effect requests:

```txt
loadFolder
resolveSelectedSource
resolveOpenSource
notifyPathChange
notifySelectionChange
notifyViewChange
notifyQueryChange
```

The reducer decides what should happen.

Runtimes decide how it happens.

No React effect should infer domain behavior by comparing arbitrary previous
props. Controlled prop reconciliation must emit explicit reducer events.

## Runtime Machines

Use small runtimes with exact ownership.

```txt
FileSystemKernelRuntime
  owns dispatch, state ref, command flushing

FileSystemFolderLoadRuntime
  owns loadChildren, AbortController, request ids, ensure waiters

FileSystemSelectionRuntime
  owns resolveSource for selected file

FileSystemOpenRuntime
  owns resolveSource for explicit open actions

FileSystemControlledPropsRuntime
  translates controlled prop changes into reducer events
```

No runtime should know JSX part names.

No runtime should branch on visual view mode unless the behavior is genuinely
view-dependent.

## Browser Views

The browser is the file-system surface. It owns the empty/loading/error/list
layout for browsing.

```tsx
<FileSystemBrowser />
```

It switches between:

```txt
list
grid
columns
gallery
```

The view switch is not a viewer concern.

### List View

The list view is the default and must be perfect.

Requirements:

- header columns and row columns use the same CSS grid;
- rows are virtualized for large folders;
- selection background spans the full row;
- focus ring spans the full row;
- name, type, size, and modified columns align exactly;
- folder rows and file rows share one row grammar;
- loading child rows are explicit;
- error child rows are explicit;
- horizontal overflow is avoided by truncation, not layout collapse;
- vertical height is owned by the browser, not inherited accidentally.

Do not encode columns into a tree decoration lane.

Do not depend on shadow-DOM CSS injection for alignment.

### Grid View

Grid view is for visual browsing.

Requirements:

- square thumbnails;
- stable tile size;
- no gray sidebar background;
- selected state does not resize tiles;
- filenames clamp predictably;
- folders and files use the same tile grammar.

### Columns View

Columns view is for path exploration.

Requirements:

- each column is one folder;
- selecting a folder appends a column;
- selecting a file updates selection state;
- lazy loading appears in the column that requested it;
- keyboard left/right maps to parent/child movement.

### Gallery View

Gallery view is for preview-first browsing.

Requirements:

- source resolution is demand-driven;
- preview caching is bounded;
- no invisible permanent DOM hoarding;
- item metadata remains readable;
- switching away cancels unneeded source work.

## Header

`FileSystemHeader` owns file-system controls only:

- title;
- path breadcrumbs;
- back/forward;
- view switcher;
- search;
- filters;
- sort.

It does not own:

- file rendering toolbar;
- PDF zoom;
- CSV download;
- image rotate;
- source-renderer-specific actions.

Those belong to `FileViewer` or leaf viewers.

The header can be hidden:

```tsx
<FileSystem showHeader={false} />
```

But hiding it must not remove state. It only removes chrome.

## Selection

`FileSystemSelection` is the only conceptual bridge between browsing and
rendering:

```tsx
<FileSystemSelection>
  {({ entry, source, sourceState }) => (
    <ViewerSurface>
      {sourceState.status === "ready" ? <FileViewer source={source} /> : null}
    </ViewerSurface>
  )}
</FileSystemSelection>
```

It exposes:

```txt
entry
  selected normalized entry, or null

sourceState
  idle | loading | ready | error

source
  ViewerSource when sourceState is ready

retry
  retry source resolution when sourceState is error
```

It does not render `FileViewer` by definition.

The caller decides:

- whether selection appears beside the browser;
- whether selection appears below the browser;
- whether selection opens in a dialog;
- whether selection renders a file viewer;
- whether selection renders custom metadata instead of a file viewer.

This is the sharper primitive. It prevents the file system from quietly
becoming a viewer.

## Preview Convenience

`FileSystemPreview` may exist, but only as sugar:

```tsx
function FileSystemPreview() {
  return (
    <FileSystemSelection>
      {({ entry, source, sourceState, retry }) => (
        <FileSystemSelectionSurface
          entry={entry}
          source={source}
          sourceState={sourceState}
          retry={retry}
        />
      )}
    </FileSystemSelection>
  )
}
```

It is allowed to render `FileViewer`, but it must be implemented entirely in
terms of `FileSystemSelection`.

It must not own browsing state, source resolution, layout policy, or file
viewer internals.

If it passes `bare` or equivalent layout props to `FileViewer`, the meaning
must remain exact:

```txt
bare = parent owns outer frame
```

Not:

```txt
bare = remove random chrome until it visually works
```

The default `FileSystem` component should use `FileSystemSelection` directly.
`FileSystemPreview` is optional sugar for callers who want the default selected
file surface without writing the render prop.

## Pierre Boundary

Pierre can be used only behind an adapter.

Allowed:

```txt
file-system-pierre-list-tree.tsx
file-system-pierre-expansion.ts
file-system-pierre-reset.ts
```

Forbidden:

```txt
FileSystemProps imports Pierre types
FileSystemState stores Pierre model objects
FileSystemHeader calls Pierre APIs
FileSystemSelection knows Pierre exists
```

If Pierre makes the list view less exact, do not use Pierre for the list view.

The product requirement is a Retab file explorer. Pierre is an implementation
option, not the product.

## Accessibility

The browser must be keyboard complete.

Required behavior:

- arrow keys move selection;
- enter opens or selects the focused item according to view policy;
- right arrow expands or enters folder;
- left arrow collapses or goes to parent;
- typeahead works inside the current folder when search is not focused;
- search input remains normal text input;
- selected row uses `aria-selected`;
- list/grid expose appropriate roles;
- loading and error states are announced when they change;
- focus is restored after modal close.

Do not fake accessibility with clickable divs and no keyboard model.

## Performance

The component must be fast by construction.

Rules:

- normalize once per `items` identity;
- derive visible entries with memoized pure selectors;
- virtualize list rows above the small-folder threshold;
- do not resolve selected sources during folder-only navigation;
- do not resolve all thumbnails eagerly;
- cancel stale folder and source requests;
- cache resolved sources by stable entry identity when safe;
- bound gallery preview cache size;
- avoid remounting `FileViewer` when only browser selection metadata changes;
- keep row props scalar and stable.

Performance is not a final optimization pass. It is part of the architecture.

## Error And Loading States

Every async operation has four visible states:

```txt
idle
loading
ready
error
```

Folder loading errors live on folders.

Source resolving errors live on selected/open source state.

Search empty states are not errors.

Unsupported file types are not source errors. They are valid `FileViewer`
unsupported states.

Retry actions are local:

- retry folder loading on the folder row or folder surface;
- retry selected source resolution in the selection surface;
- retry open source in the open dialog.

## Styling

The visual language should be quiet and exact:

- white or token background, no arbitrary gray sidebar fill;
- one border model;
- square thumbnails;
- consistent left alignment;
- compact row density;
- no decorative cards inside cards;
- controls use icons where icon semantics are obvious;
- search and filters live in the header;
- optional preview convenience uses the same file viewer grammar as every
  other source.

The list view should look native to Retab, not like macOS Finder copied
literally.

## Testing Contract

Unit tests:

- path normalization;
- duplicate path detection;
- index child maps;
- query filtering;
- sorting;
- reducer transitions;
- stale folder load rejection;
- stale source rejection;
- controlled prop reconciliation;
- history behavior.

Render tests:

- list header and rows render same columns;
- selection changes selected source state;
- folder loading row appears;
- folder error row appears;
- selected source loading appears;
- selected source error appears;
- controlled `path`, `selectedPath`, `view`, and `query` work;
- keyboard navigation works.

E2E tests:

- list view opens folder and selects file;
- grid view selects file;
- columns view navigates parent/child;
- gallery view resolves only visible previews;
- search filters current folder;
- modal open returns focus;
- large folder remains responsive.

Visual checks:

- list columns align;
- thumbnails are square;
- no double nesting around caller-rendered file viewer;
- no gray sidebar background;
- header/body hierarchy is:

```tsx
<header />
<div className="flex">
  <browser />
  <selection />
</div>
```

## Documentation

Docs should teach the mental model first:

```txt
FileSystem chooses a ViewerSource.
FileViewer renders a ViewerSource.
```

Then show:

1. simple usage;
2. lazy folder loading;
3. custom source resolution;
4. controlled selection;
5. custom composed layout;
6. custom selection rendering;
7. large folder performance notes.

Do not document internal kernels, runtimes, or Pierre adapters as user-facing
concepts.

## What To Delete

Delete anything that preserves an old false boundary:

```txt
FileSystemViewer*
viewer-prefixed file-system docs
legacy controller modules
compatibility aliases
unused grouped public props
Pierre public exports
shadow-DOM list column hacks
duplicate source/open code paths
special preview shells that bypass FileSystemSelection
```

The final design should not carry fossils.

## Implementation Order

1. Freeze the public names.
2. Define `FileSystemItem`, `FileSystemEntry`, `FileSystemQuery`, and
   `FileSystemView`.
3. Build pure normalization and index modules.
4. Build the kernel reducer and selectors.
5. Build runtimes for folder loading, source resolving, open resolving, and
   controlled props.
6. Wire `FileSystemProvider` as clean composition only.
7. Build `FileSystemHeader`, `FileSystemBrowser`, and
   `FileSystemSelection`.
8. Rebuild list view with real aligned React columns.
9. Add grid, columns, and gallery views only after list is perfect.
10. Delete stale modules and docs.
11. Update registry examples.
12. Add unit, render, e2e, and visual verification.

## Final Shape

The final easy component:

```tsx
export function FileSystem(props: FileSystemProps) {
  return (
    <FileSystemProvider {...props}>
      <FileSystemRoot>
        <FileSystemHeader />
        <FileSystemBody>
          <FileSystemBrowser />
          <FileSystemSelection>
            {({ source }) => <FileViewer source={source} />}
          </FileSystemSelection>
        </FileSystemBody>
      </FileSystemRoot>
    </FileSystemProvider>
  )
}
```

The final conceptual model:

```txt
FileSystemItem[]
  -> normalized FileSystemEntry index
  -> browser state
  -> selected file
  -> ViewerSource
  -> FileSystemSelection
  -> caller-rendered FileViewer
```

The final sentence:

```txt
The file system is a fast, accessible document browser whose only rendering
opinion is to expose the selected source.
```

That is the platonic structure.
