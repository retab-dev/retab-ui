# File System Viewer Post-Implementation Blueprint

## Purpose

This blueprint captures what the first File System implementation taught us and
defines the next ideal version.

The first implementation proved the core direction: Retab should not copy
Extend's Finder monolith. The right component is a source-first document
workspace over a flat manifest, composed from Retab's existing `FileViewer`,
`FileThumbnail`, `ViewerSource`, viewer caches, and registry primitives.

## Current State

Implemented surfaces:

- `registry/new-york-v4/ui/file-system.tsx`
- `registry/new-york-v4/ui/file-system-types.ts`
- `registry/new-york-v4/ui/file-system-index.ts`
- `registry/new-york-v4/ui/file-system-query.ts`
- `registry/new-york-v4/ui/file-system-controller.ts`
- `registry/new-york-v4/ui/file-system-preview.tsx`
- `registry/new-york-v4/ui/file-system-list-view.tsx`
- `registry/new-york-v4/ui/file-system-grid-view.tsx`
- `registry/new-york-v4/ui/file-system-columns-view.tsx`
- `registry/new-york-v4/ui/file-system-gallery-view.tsx`
- `registry/new-york-v4/ui/file-system-utils.ts`
- `components/ui/file-system.tsx`
- `registry/new-york-v4/blocks/file-system-block.tsx`

Registry items:

- `file-system`
- `file-system-block`

Verification added:

- `tests/file-system-index.test.ts`
- `tests/file-system.test.tsx`

The component now has:

- Flat manifest input.
- Inferred folder hierarchy.
- Explicit lazy folder entries.
- Shared controller state for list, grid, columns, and gallery.
- Search.
- File-category filters.
- Modified-date presets.
- Sort by name, type, size, and modified date.
- Lazy folder loading with retry.
- Source resolution with abort signals and cache identity.
- Persistent preview pane powered by `FileViewer`.
- Thumbnails powered by `FileThumbnail`.
- Generated registry output.

## Lessons

### The Data Boundary Is The Product

The hardest part is not the view. It is the file-system model:

- path normalization
- folder inference
- loaded item merging
- visible path derivation
- selected item validity
- lazy folder state
- source resolution state
- filter/sort/search semantics

When this boundary is clean, each visual surface is a projection. When this
boundary leaks into view files, the component starts drifting toward Extend's
monolith.

### Retab Should Be Source-First

`ViewerSource` is the right primitive. The file-system component should not
traffic primarily in URLs, file-type strings, and preview callbacks.

The stable flow is:

```txt
manifest file -> ViewerSource -> FileThumbnail / FileViewer
```

`resolveSource` exists only for private object-store files that do not already
carry a `ViewerSource`.

### The Preview Is Not A Modal Afterthought

The persistent preview pane is the difference between a file browser and a
document workspace.

The default interaction should be:

```txt
select row -> preview immediately
double click / open -> larger dialog or caller action
```

This is more useful for Retab workflows than a Finder-style browser where
preview is mostly deferred until open.

### Tests Need To Hit The Query Layer Directly

The date-filter bug proved that component tests alone are too indirect. Query
state can look wired in the UI while the pure visible-index derivation ignores
part of it.

Every query feature needs a pure test in `file-system-query` or
`file-system-index`, plus one component test that proves the UI drives it.

### Browser Review Still Matters

Automated tests passed before the selected-row contrast issue was visible. The
browser screenshot caught it immediately.

Every viewer/workspace component needs at least one visual smoke pass after
implementation.

### Full Typecheck Can Be Noisy In A Dirty Tree

Focused tests, scoped lint, registry build, and browser smoke were still useful
evidence even when unrelated files temporarily blocked global checks.

The final report must distinguish component evidence from unrelated workspace
state.

## Ideal Architecture

Keep the module split, but make responsibilities sharper.

```txt
file-system.tsx
  public shell only
  composes toolbar, browser pane, preview pane, dialog

file-system-types.ts
  public item/source/action contracts

file-system-index.ts
  path normalization
  folder inference
  child maps
  folder metadata derivation

file-system-query.ts
  search/filter/sort
  visible index derivation
  category/date labels

file-system-controller.ts
  navigation
  controlled/uncontrolled selection
  expansion
  lazy children
  source resolution
  command callbacks

file-system-preview.tsx
  selected-file source resolution
  FileViewer routing
  FileThumbnail routing
  preview errors/retry

file-system-list-view.tsx
file-system-grid-view.tsx
file-system-columns-view.tsx
file-system-gallery-view.tsx
  view projections only

file-system-chrome.tsx
  toolbar, filters, status, breadcrumbs
```

The next cleanup should extract `file-system-chrome.tsx`. The current shell is
still doing too much toolbar/filter/status work.

## Public API Direction

Keep the current API shape, but sharpen it around document-workspace use cases.

```ts
type FileSystemProps = {
  items: FileSystemItem[]
  title?: string
  className?: string
  defaultPath?: string
  defaultView?: FileSystemView
  view?: FileSystemView
  onViewChange?: (view: FileSystemView) => void
  selectedPath?: string | null
  defaultSelectedPath?: string | null
  onSelectionChange?: (item: FileSystemItem | null) => void
  loadChildren?: (
    args: FileSystemLoadChildrenArgs
  ) => Promise<FileSystemLoadChildrenResult>
  resolveSource?: (
    args: FileSystemResolveSourceArgs
  ) => Promise<ViewerSource | null>
  onFileOpen?: (file: FileSystemFileItem, source: ViewerSource | null) => void
  renderFileActions?: (file: FileSystemFileItem) => React.ReactNode
  renderMetadata?: (item: FileSystemItem) => React.ReactNode
}
```

Do not add object-store SDK concepts to the public API. Keep object-store
details behind caller-owned `loadChildren` and `resolveSource`.

## Query Model

The query model should become explicitly serializable.

```ts
type FileSystemQueryState = {
  search: string
  filters: {
    categories: FileCategory[]
    updatedAfter: "last7" | "last30" | null
  }
  sort: {
    key: "name" | "kind" | "size" | "updatedAt"
    direction: "asc" | "desc"
  }
}
```

Next additions should use the same pattern:

- size range
- created date
- metadata key filters
- extension filter

Do not add ad hoc state inside view files.

## View Standards

### List

List is the default surface.

Requirements:

- Tree semantics.
- Virtualized rows.
- Stable row height.
- Sortable columns.
- Folder disclosure.
- Enter opens.
- Arrow navigation.
- Type-ahead.
- Selected row readable in light and dark mode.

### Grid

Grid is for visual scanning, not dense metadata.

Requirements:

- Virtualized rows.
- Measured column count.
- Stable tile dimensions.
- Two-line labels.
- `FileThumbnail` only; no local thumbnail engine.

### Columns

Columns are for deep prefixes.

Requirements:

- Virtualized rows in every column.
- Right arrow enters folder.
- Left arrow moves to parent.
- Selection should not trigger expensive preview work until it settles.

### Gallery

Gallery is optional and should remain a reuse of preview, not another preview
engine.

Requirements:

- Virtualized filmstrip.
- Same `FileSystemPreview`.
- Delay source resolution during rapid scrubbing.
- Add keep-alive only after profiling shows repeated parse cost.

## Preview Standards

Preview resolution:

```txt
file.previewImageUrl -> FileThumbnail image
file.previewSource -> FileThumbnail source
file.source -> FileThumbnail/FileViewer source
resolveSource(file) -> cached ViewerSource
metadata only -> FileThumbnail frame
```

The preview pane should own:

- loading state
- source resolution errors
- retry
- unsupported source state
- selected file metadata footer

The preview pane should not own:

- folder navigation
- file open policy
- filtering
- sorting
- thumbnail rendering internals

## Accessibility Standard

Target roles:

- list view: `tree` / `treeitem`
- grid view: `listbox` / `option`
- columns: each column as `listbox` / `option`
- gallery filmstrip: `listbox` / `option`
- preview pane labelled by selected file
- status bar `aria-live="polite"`

Every icon-only control needs an accessible label. Every custom selectable row
needs focus-visible styling.

## Performance Standard

The component should stay cheap with thousands of files.

Rules:

- Index/query work must stay memoized and pure.
- Views must virtualize any unbounded list.
- Thumbnail rendering must be delegated to `FileThumbnail`.
- Source resolution must be cached by file identity.
- Lazy folder requests must be abortable.
- Rapid selection changes should defer heavy preview work.

Do not introduce a portal reparenting preview pool until profiling proves it is
needed. Retab's viewer resource caches may make it unnecessary.

## Test Plan

Pure tests:

- path normalization
- explicit folder normalization
- folder inference
- duplicate path resolution
- folder modified-date derivation
- search visible ancestors
- category filters
- modified-date filters
- sort comparators
- tree flattening

Controller/component tests:

- select file previews through `FileViewer`
- folder double-click navigates
- category filter hides non-matches
- modified-date filter hides stale files
- lazy folder failure shows retry
- retry loads children
- view switching preserves selection
- `onFileOpen` overrides dialog behavior

Browser checks:

- desktop list with preview
- selected-row contrast
- grid tile wrapping
- columns scroll
- gallery filmstrip
- no console/page errors

## Next Implementation Pass

1. Extract `file-system-chrome.tsx`.
2. Add keyboard navigation parity across grid, columns, and gallery.
3. Add URL-sync-friendly controlled `query` / `onQueryChange`.
4. Add component tests for view switching and `onFileOpen`.
5. Add a Playwright e2e spec for `/view/blocks/file-system`.
6. Profile a large synthetic manifest.
7. Decide whether gallery needs a bounded preview keep-alive pool.

## Non-Goals

- Do not clone Finder exactly.
- Do not add drag/drop file moving yet.
- Do not add multi-select until batch actions exist.
- Do not duplicate file category detection.
- Do not implement thumbnails locally.
- Do not import object-store SDKs.
- Do not merge viewer internals into file-system internals.

## Decision

The component's north star is:

```txt
flat manifest + source resolution + Retab viewers = document workspace
```

Any change that strengthens that equation is aligned. Any change that turns the
component into a self-contained file manager, preview renderer, or object-store
client is drift.
