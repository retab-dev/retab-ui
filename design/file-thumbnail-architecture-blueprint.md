# File Thumbnail Architecture Blueprint

## Goal

`FileThumbnail` should be the only public component for rendering a compact file
preview.

The caller should not need to know whether a thumbnail is static metadata, an
external image, a browser `File`, a URL, a blob, inline text, a PDF first page,
or a spreadsheet worker result. That distinction is implementation detail.

The ideal public model is:

```tsx
<FileThumbnail file={file} />
<FileThumbnail source={source} />
<FileThumbnail file={{ name, type }} />
<FileThumbnail previewImageUrl={url} />
<FileThumbnail previewContent={content} />
```

`FileThumbnailFrame` remains a primitive. It is the dependency-free visual shell
used by `FileThumbnail` and by consumers that already own thumbnail generation.

## Current Shape

The public surface is correct:

- `FileThumbnail` is the complete component.
- `FileThumbnailFrame` is the static shell.
- There is no separate public document thumbnail component.

The internal boundary is:

- `FileThumbnail` owns input normalization and static-vs-generated routing.
- `GeneratedFileThumbnail` owns descriptor, resource, key, error, direct-image,
  and client-preview orchestration.
- Format renderers stay below the generated-preview boundary.

The public component file should stay readable without understanding the whole
engine.

## Shape

Create one internal generated-preview boundary.

```txt
registry/new-york-v4/ui/file-thumbnail.tsx
  public API
  static-vs-generated routing
  no direct cache, key, registry, worker, or renderer imports

components/file-thumbnail/generated-preview.tsx
  internal engine entry point
  descriptor resolution
  resource creation
  cache/render key creation
  direct image fast path
  client preview orchestration
  error-state ownership

components/file-thumbnail/renderers/*
  format-specific rendering only

components/file-thumbnail/*
  private support machinery
  cache, keys, options, worker client, descriptor, errors
```

`file-thumbnail.tsx` imports only:

```ts
import { GeneratedFileThumbnail } from "@/components/file-thumbnail/generated-preview"
```

from the renderer package.

It does not import:

- `descriptor`
- `keys`
- `thumbnail-client-preview`
- `thumbnail-direct-image`
- `thumbnail-error-state`
- `thumbnail-options`

## Public API Boundary

`FileThumbnail` owns input normalization.

Responsibilities:

- Accept `file`, `source`, `previewImageUrl`, `previewContent`, `state`, and
  frame props.
- Decide whether the caller supplied an already-renderable preview.
- Convert browser `File` into a `ViewerSource`.
- Fall back to `FileThumbnailFrame` for metadata-only files.
- Delegate generated previews to `GeneratedFileThumbnail`.

Non-responsibilities:

- It should not know how thumbnail keys are computed.
- It should not know which formats have renderers.
- It should not know which formats use workers.
- It should not know how direct URL images report canonical errors.

## Internal Engine Boundary

`GeneratedFileThumbnail` owns generated preview orchestration.

Proposed props:

```ts
interface GeneratedFileThumbnailProps
  extends Omit<FileThumbnailFrameProps, "file" | "onError"> {
  source: ViewerSource
  as?: FileCategory
  anchor: ThumbnailAnchor
  retryKey?: React.Key
  onError?: (error: unknown, info: ViewerErrorInfo) => void
}
```

Responsibilities:

- Resolve the thumbnail descriptor.
- Create the viewer resource.
- Compute expensive cache identity.
- Compute render identity.
- Choose direct image vs renderer pipeline.
- Own error state.
- Render `FileThumbnailFrame` around generated content.

Non-responsibilities:

- It should not export descriptor, key, cache, or worker helpers.
- It should not expose renderer modules to public UI code.
- It should not accept metadata-only `ThumbnailFile`; public `FileThumbnail`
  already handles that branch.

## Renderer Boundary

Each renderer should be a narrow format module.

Allowed responsibilities:

- Read the smallest required resource capability.
- Produce one visible first-unit preview.
- Throw canonical thumbnail errors for unsupported or failed format reads.
- Clean up object URLs, canvases, workers, and third-party viewer instances.

Forbidden responsibilities:

- No public `FileThumbnail` imports.
- No unbounded `Map` caches.
- No local `useIsClient` copies.
- No full viewer imports such as `pdf-viewer` or `docx-viewer`.
- No cross-format branching.

## Naming

Keep public names short and consumer-oriented:

- `FileThumbnail`
- `FileThumbnailFrame`
- `FileThumbnailProps`
- `FileThumbnailFrameProps`

Keep internal names explicit and engine-oriented:

- `GeneratedFileThumbnail`
- `ThumbnailClientPreview`
- `ThumbnailDescriptor`
- `ThumbnailRenderer`
- `ThumbnailAnchor`

Avoid bringing back document terminology. The component thumbnails files, not
only documents.

## Registry Shape

`file-thumbnail` should install the complete experience:

- public `file-thumbnail.tsx`
- public `file-thumbnail-types.ts`
- internal `file-thumbnail/*`
- renderer workers
- required registry dependencies
- required npm dependencies

`file-thumbnail-frame` should remain small:

- frame component
- fallback
- extension helper
- image helper
- shimmer
- `utils`

There should be no registry item for a separate document thumbnail.

## Tests

Architecture tests should enforce the boundary, not implementation names for
their own sake.

Required tests:

- `FileThumbnailFrame` stays dependency-free.
- Public `FileThumbnail` imports only `GeneratedFileThumbnail` from
  `file-thumbnail`.
- Renderers do not import public `FileThumbnail`.
- PDF and DOCX thumbnails do not import full viewers.
- Worker-backed renderers use the shared worker client.
- Renderer caches go through the bounded cache primitive.
- Registry does not contain a separate document thumbnail item.
- `file-thumbnail` registry item contains renderer files and workers.

Useful assertion:

```ts
expect(publicFileThumbnailSource).toContain(
  "@/components/file-thumbnail/generated-preview"
)
expect(publicFileThumbnailSource).not.toContain(
  "@/components/file-thumbnail/keys"
)
expect(publicFileThumbnailSource).not.toContain(
  "@/components/file-thumbnail/descriptor"
)
```

## Implementation Checklist

1. `components/file-thumbnail/generated-preview.tsx` exists.
2. `GeneratedFileThumbnail` lives in that file.
3. Renderer-only imports live below that boundary.
4. `FileThumbnail` remains responsible for source normalization and static
   routing.
5. Registry files ship `generated-preview.tsx` with `file-thumbnail`.
6. Architecture tests enforce the boundary.
7. Focused thumbnail/dropzone tests, thumbnail typecheck, registry build,
   registry validation, and MDX generation pass.

## Done State

The architecture is done when a reader can understand the public component in
one pass:

```txt
FileThumbnail
  if caller supplied preview -> FileThumbnailFrame
  else if no generated source -> FileThumbnailFrame
  else -> GeneratedFileThumbnail
```

Everything below that is private engine code.
