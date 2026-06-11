# File Thumbnail Final Completion Record

The final deletion pass is implemented.

## Completed Invariants

- `FileThumbnail` has one state API: `state`.
- `FileThumbnailShimmer` is self-contained and does not require global keyframes.
- No file-thumbnail style tag is rendered.
- No `FileThumbnailStyles` compatibility export remains.
- Document thumbnail resource keys use length-prefixed encoding.
- Retry keys preserve primitive type, including bigint.
- TIFF renderer internals stay private.
- Object URL ownership lives in `useObjectUrl`, which revokes URLs on cleanup.
- CSV, Markdown, HTML, and plain text renderers live in separate modules.
- `DocumentThumbnail` selects non-image renderers through an exhaustive typed
  registry.
- Image remains the direct fast path.
- PDF intentionally reuses the shared PDF viewer cache by `src`.

## Module Boundaries

- `registry/new-york-v4/ui/file-thumbnail.tsx`: shell, self-contained shimmer,
  fallback, MIME extension display.
- `components/document-thumbnail.tsx`: public adapter, image fast path, renderer
  registry, client/viewport gate.
- `components/document-thumbnail/types.ts`: public adapter types and resource
  identity.
- `components/document-thumbnail/cache.ts`: shared fetch/decode helpers.
- `components/document-thumbnail/errors.tsx`: render error boundary.
- `components/document-thumbnail/renderers/*`: one renderer family per module,
  plus shared layout and lifecycle hooks.

## Verification

```bash
./node_modules/.bin/vitest run tests/file-thumbnail.test.tsx
./node_modules/.bin/tsc --noEmit --pretty false -p tsconfig.thumbnail.json
```

Full-repo typecheck remains informational while unrelated schema-editor and
reference frontend errors exist.
