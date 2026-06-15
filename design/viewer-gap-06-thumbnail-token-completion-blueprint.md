# Viewer Gap 06: Thumbnail Token Completion

## Question

How far should thumbnail sizing tokens go?

`FileThumbnail` now exposes named `thumbnailShape` and `thumbnailSize` tokens.
This solves the most important viewer-system sidebar cases. The remaining gap is
that older demos and some non-viewer consumers still use raw
`previewAspectRatio` and dimension classes.

## Current State

Good:

- `FileThumbnailFrame` owns loading, loaded, error, image, custom content, and
  fallback states.
- `FileThumbnail` owns generated previews.
- `thumbnailShape` supports common geometry.
- `thumbnailSize` supports common sidebar/card widths.
- Email and file-intake viewer sidebars use named tokens.
- Raw `className`, `style`, and `previewAspectRatio` remain available.

Bad:

- Some docs and demos still show `previewAspectRatio={1}` for square tiles.
- Some blocks still use raw `size-*` classes.
- `FileThumbnail` and `PdfThumbnailRail` have separate thumbnail shape systems.
- File-system thumbnails are out of scope for viewer cleanup but still use raw
  aspect ratio internally.

## Boundary

Do not force every thumbnail to use tokens.

Raw geometry remains valid when the thumbnail is part of a bespoke layout:

```tsx
<FileThumbnail
  className="absolute inset-0"
  style={{ aspectRatio: "16 / 10" }}
/>
```

The tokens are for common component-library cases:

```tsx
<FileThumbnail thumbnailShape="square" thumbnailSize="md" />
<FileThumbnail thumbnailShape="document" thumbnailSize="lg" />
```

## Token Contract

Current shape tokens:

```ts
type FileThumbnailShape = "document" | "square"
```

Current size tokens:

```ts
type FileThumbnailSize = "xs" | "sm" | "md" | "lg" | "xl"
```

These should stay intentionally boring. Do not add product names:

```txt
email
sidebar
attachment
upload
source
```

Those are consumer contexts, not primitive geometry.

## Migration Plan

### Step 1: Docs

Update file-thumbnail docs to prefer:

```tsx
<FileThumbnail thumbnailShape="square" thumbnailSize="lg" />
```

instead of:

```tsx
<FileThumbnail previewAspectRatio={1} className="size-16" />
```

### Step 2: Viewer-System Blocks

Migrate blocks that are clearly viewer-system sidebars or upload surfaces.

Good candidates:

```txt
dropzone media transcript queue
dropzone evidence timeline
dropzone comparison pair upload
dropzone spreadsheet import card
dropzone required packet slots
```

Leave bespoke visual demos alone if they are demonstrating custom layout.

### Step 3: Attachment Sidebar

Consider:

```tsx
<FileThumbnail thumbnailShape="document" thumbnailSize="lg" />
```

instead of hard-coded `h-16 w-12` plus `previewAspectRatio`.

### Step 4: File-System Boundary

Do not edit file-system internals as part of viewer cleanup.

If file-system later wants these tokens, it can consume them through its own
component boundary.

## PDF Thumbnail Rail

`PdfThumbnailRail` should remain separate:

```ts
type PdfThumbnailShape = "page" | "square"
```

Reason:

- PDF rail is virtualized.
- It sizes rows from page metrics.
- It follows current page.
- It owns rail scrolling behavior.

Do not merge `FileThumbnail` and `PdfThumbnailRail` just because both display
small previews.

## Success Criteria

- Common viewer-system sidebars use `thumbnailShape` and `thumbnailSize`.
- Docs teach tokens first.
- Raw geometry remains available for custom layouts.
- File-system internals are not touched by this effort.
- PDF rail keeps its own specialized sizing model.

## Failure Signals

- Token names become product-specific.
- `FileThumbnail` grows rail virtualization concerns.
- PDF thumbnail rail imports `FileThumbnail`.
- Demos lose useful custom layout examples because everything was mechanically
  tokenized.

## Final Position

Thumbnail tokens are a primitive convenience, not a universal layout mandate.
Use them for repeated sidebar/card geometry; keep escape hatches for bespoke
media surfaces.

