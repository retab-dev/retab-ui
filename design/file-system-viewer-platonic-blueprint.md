# File System Viewer Platonic Blueprint

## Source Review

I reviewed Extend UI's file-system implementation from
`https://github.com/extend-hq/ui`, cloned locally at
`/tmp/extend-ui-inspection` on commit `01edd8f`.

The relevant source is:

- `/tmp/extend-ui-inspection/apps/v4/components/ui/file-system.tsx`
- `/tmp/extend-ui-inspection/apps/v4/registry/new-york-v4/blocks/file-system-block.tsx`
- `/tmp/extend-ui-inspection/apps/v4/content/docs/components/file-system.mdx`
- `/tmp/extend-ui-inspection/apps/v4/components/file-system-docs.tsx`

The docs describe the component as a Finder-style browser over a flat
S3/R2-style manifest. It accepts files and optional folder prefixes, derives
missing folders from paths, supports icon, list, column, and gallery views,
lazy-loads folder contents, and treats signed URLs and thumbnail URLs as
external concerns.

The implementation is strong in behavior and weak in boundaries:

- `file-system.tsx` is about 5,065 lines.
- The thin block wrapper just renders `<FileSystem {...props} />`.
- The component file owns manifest indexing, sorting, filtering, search,
  lazy folder loading, history, selection, virtualization, responsive toolbar
  layout, icon rendering, list-tree integration, columns, gallery, preview URL
  resolution, and viewer dialog orchestration.
- It depends on `@pierre/trees`, Hugeicons, local shadcn primitives, Extend's
  file thumbnail, and Extend's PDF/DOCX/XLSX viewers.

## What Extend Gets Right

Keep these ideas:

- Flat object-store manifest input. This maps naturally from `ListObjectsV2`,
  R2, GCS, or Retab source lists.
- Explicit folders are optional. Missing folder prefixes are inferred, but
  explicit lazy folders still matter for paginated object stores.
- URLs are not assumed to be public. A `getFileUrl`-style hook is necessary
  for presigned URLs.
- Lazy folder traversal is first-class. Folders can advertise `hasChildren`
  and load on demand.
- Multiple views share one selection and navigation model.
- Grid, columns, and gallery use windowing instead of rendering every item.
- Type-ahead and roving tab index make keyboard use feel native.
- Preview work is delayed while users scrub through items.
- Recently opened gallery previews are kept alive so expensive document
  parsing is not repeated immediately.

## Where Retab Can Be Better

Retab already has better primitives for the hard part: file previewing.

Existing Retab pieces to build on:

- `registry/new-york-v4/ui/file-viewer.tsx`
  routes a `ViewerSource` to PDF, DOCX, image, PPTX, XLSX, CSV, markdown, HTML,
  text, code, and unsupported states.
- `registry/new-york-v4/ui/file-thumbnail.tsx`
  accepts metadata, `ViewerSource`, browser `File`, generated thumbnails,
  custom preview content, and external preview image URLs.
- `registry/new-york-v4/lib/viewer-source.ts`
  already defines `ViewerSource`, `FileCategory`, category detection, and
  stable viewer identities.
- The repo already ships `@tanstack/react-virtual`, file thumbnail workers,
  viewer resources, canonical viewer errors, and file-size formatting.

So the Retab file-system viewer should not reimplement document routing,
thumbnail generation, or format detection. It should be a navigation shell that
composes `FileViewer` and `FileThumbnail`.

## Product Shape

The component should feel like a document workspace, not a clone of Finder for
its own sake.

Primary surfaces:

- **Browse**: dense list or grid for finding files quickly.
- **Preview**: persistent preview pane for the selected file, not only a modal.
- **Inspect**: metadata, source key, size, timestamps, page/file type, and
  caller-provided metadata.
- **Open**: full viewer dialog or caller-owned callback.

Views:

- `list`: default for operational workflows. Dense rows, sortable columns,
  tree disclosure, keyboard-first navigation.
- `grid`: thumbnail overview for packets, images, scans, and mixed documents.
- `columns`: useful for deep object prefixes.
- `gallery`: optional higher-cost view for visual review flows.

The better default is `list`, not `icons`. In document workflows users usually
need names, statuses, sizes, dates, and metadata before large thumbnails.

## Public API

Use Retab vocabulary and sources.

```ts
export type FileSystemView = "list" | "grid" | "columns" | "gallery"

export type FileSystemFolderItem = {
  kind: "folder"
  path: string
  name?: string
  parentPath?: string
  hasChildren?: boolean
  createdAt?: string
  updatedAt?: string
  metadata?: Record<string, string>
}

export type FileSystemFileItem = {
  kind: "file"
  path: string
  key?: string
  name?: string
  parentPath?: string
  mimeType?: string
  size?: number
  createdAt?: string
  updatedAt?: string
  etag?: string
  source?: ViewerSource
  previewSource?: ViewerSource
  previewImageUrl?: string | null
  previewAspectRatio?: number
  metadata?: Record<string, string>
}

export type FileSystemItem = FileSystemFolderItem | FileSystemFileItem

export type FileSystemLoadChildrenArgs = {
  path: string
  cursor: string | null
  signal: AbortSignal
}

export type FileSystemLoadChildrenResult = {
  items: FileSystemItem[]
  nextCursor?: string | null
}

export type FileSystemResolveSourceArgs = {
  file: FileSystemFileItem
  signal: AbortSignal
}

export type FileSystemProps = {
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

Use `mimeType`, not `contentType`, to match `ViewerSource`.

`source` is the primary file preview input. If a file only has a private object
key, `resolveSource` returns a URL `ViewerSource` with the presigned URL. That
same source feeds both `FileViewer` and generated `FileThumbnail` unless
`previewSource` or `previewImageUrl` overrides it.

## Module Shape

Do not create another monolith.

```txt
registry/new-york-v4/ui/file-system.tsx
  public component
  imports the controller and view components

registry/new-york-v4/ui/file-system-types.ts
  public types

registry/new-york-v4/ui/file-system-index.ts
  pure path normalization, parent lookup, folder inference, child maps

registry/new-york-v4/ui/file-system-query.ts
  pure sort, search, filter, visible-path derivation

registry/new-york-v4/ui/file-system-controller.ts
  useFileSystemController()
  history, selection, lazy loading, cancellation, resolved source cache

registry/new-york-v4/ui/file-system-preview.tsx
  FileSystemPreview
  FileSystemThumbnail
  bridges FileSystemFileItem to FileViewer/FileThumbnail

registry/new-york-v4/ui/file-system-list-view.tsx
registry/new-york-v4/ui/file-system-grid-view.tsx
registry/new-york-v4/ui/file-system-columns-view.tsx
registry/new-york-v4/ui/file-system-gallery-view.tsx
  view-only components

registry/new-york-v4/ui/file-system-chrome.tsx
  toolbar, breadcrumbs, status bar, metadata pane
```

Pure model files should have direct unit tests. View files should stay thin.

## Controller Responsibilities

`useFileSystemController` owns:

- Normalize paths and build the index.
- Merge eager items with lazily loaded items.
- Maintain navigation history.
- Maintain controlled or uncontrolled selection.
- Abort stale `loadChildren` and `resolveSource` calls.
- Cache resolved `ViewerSource` by stable file identity.
- Expose visible children for the current path.
- Expose selected item, parent folder, breadcrumbs, loading states, and errors.

It must not render UI and must not import `FileViewer`, `FileThumbnail`, or view
components.

## Preview Responsibilities

`FileSystemPreview` owns:

- Convert selected file to a `ViewerSource`.
- Show loading, unavailable, unsupported, and error states.
- Render `FileViewer source={source} bare className="h-full"`.
- Keep a bounded LRU of recent viewer mounts only if profiling proves repeated
  document parsing is a real problem.

Prefer a simple mounted preview first. Extend's portal reparenting pool is
clever, but it is also the kind of mechanism that should be justified by local
profiling. Retab's viewer resource caches and thumbnail caches may already make
the simpler version fast enough.

`FileSystemThumbnail` owns:

- Render `FileThumbnail previewImageUrl={...}` when an external image exists.
- Render `FileThumbnail source={previewSource ?? source}` when a previewable
  source exists.
- Render metadata-only `FileThumbnail file={{ name, type }}` otherwise.

## View Behavior

List view:

- Use Retab-owned row DOM rather than `@pierre/trees` shadow DOM.
- Use `@tanstack/react-virtual` for rows.
- Flatten visible tree rows from the index and expansion state.
- Render columns for name, type, size, modified date, and optional metadata.
- Support arrow navigation, Home/End, Enter to open, Space to select, and
  type-ahead.

Grid view:

- Use `@tanstack/react-virtual` with measured column count.
- Stable tile dimensions; labels reserve two lines.
- Arrow navigation follows visual grid geometry.
- Thumbnails use `FileThumbnail`.

Columns view:

- Use one virtualized column per path in the selection trail.
- Defer expensive preview updates during rapid keyboard movement.
- Right arrow enters folders; left arrow returns to parent.

Gallery view:

- Treat as an enhanced preview mode, not the primary surface.
- Filmstrip is virtualized.
- Preview pane uses the same `FileSystemPreview`.
- Delay source resolution while selection is still changing.

## Error And Loading States

Extend mostly drops lazy-loading failures silently. Retab should expose them.

States:

- Folder loading.
- Folder load failed with retry.
- Source resolution loading.
- Source resolution failed with retry.
- Unsupported file.
- Empty folder.
- No search/filter results.

`loadChildren` and `resolveSource` receive an `AbortSignal`; stale results must
not update state after navigation.

## Search And Filter

Start with:

- Name/path search.
- File category filter derived through `detectCategory`.
- Date modified filter.
- Size sort.

Do not add a generic query language. Keep filters explicit and serializable.

The controller should expose the full query state so future apps can sync it to
URL params without refactoring the component.

## Accessibility

Target behavior:

- Toolbar controls have visible labels or icon labels.
- Each view has one tab stop, then roving focus inside.
- Rows/tiles use `role="option"` inside `role="listbox"` for single selection.
- Tree list rows expose depth, expanded state, and folder/file semantics.
- Preview pane is labelled by selected file name.
- Status bar uses `aria-live="polite"` for item counts and selected item.

Avoid shadow DOM row rendering unless a dependency becomes clearly worth it; it
complicates styling, testing, event handling, and accessible DOM inspection.

## Implementation Phases

1. Build model and controller only.
   - `file-system-index.ts`
   - `file-system-query.ts`
   - `file-system-controller.ts`
   - Unit tests for path normalization, folder inference, lazy merge,
     selection invalidation, sorting, search, and abort behavior.

2. Ship list view plus persistent preview.
   - This is the most useful document-workflow surface.
   - Use `FileViewer` and `FileThumbnail`.
   - Add tests for keyboard selection, open behavior, lazy folder retry, and
     source resolution.

3. Add grid and columns.
   - Reuse controller state.
   - Add virtual-window tests for stable row/tile counts and selection scroll.

4. Add gallery only if the product needs it.
   - Start without portal reparenting.
   - Add bounded keep-alive only after measuring repeated parse cost.

5. Register the component.
   - Add `components/ui/file-system.tsx` export shim.
   - Add registry metadata and a block demo.
   - Rebuild `public/r`.

## Tests

Unit tests:

- Path normalization keeps root as `""` and folders slash-suffixed.
- Files infer all ancestor folders.
- Explicit folders override inferred names and metadata.
- Duplicate file paths resolve deterministically.
- Folder modified date derives from newest descendant only when missing.
- Search marks matching files and ancestors visible.
- Filters do not show empty ancestor branches.
- Sort keeps folders before files within each sibling group.
- Lazy folder load follows cursors and aborts stale requests.
- Source resolver caches by path/key/etag identity.

Component tests:

- List keyboard arrows move selection.
- Enter opens file or navigates into folder.
- Type-ahead jumps to the expected visible row.
- View switching preserves selection.
- Search clears selection when selected item disappears.
- Lazy folder errors show retry and retry succeeds.
- Preview renders `FileViewer` for resolved URL sources.
- Thumbnails render generated `FileThumbnail` when source is available and
  static frame when only metadata is available.

E2E/browser checks:

- Desktop list with preview.
- Narrow toolbar layout.
- Large manifest scroll performance.
- Keyboard-only traversal from toolbar through list and preview.

## Non-Goals

- No OS-perfect Finder clone.
- No drag/drop move/copy in the first pass.
- No multi-select until actions require it.
- No custom document parsing inside the file-system component.
- No private object-store SDK imports in UI code.
- No second file-category detection table.

## Decision

We should not copy Extend's implementation.

Use its behavior as a benchmark, especially flat manifests, lazy folders,
keyboard interaction, and Finder views. Build the Retab version around our
existing `ViewerSource`, `FileViewer`, `FileThumbnail`, viewer caches, and
TanStack virtualization. The result should be smaller, easier to test, format
complete from day one, and more useful for Retab document workflows because the
selected file has a persistent first-class preview instead of being mostly a
browser item until double-clicked.
