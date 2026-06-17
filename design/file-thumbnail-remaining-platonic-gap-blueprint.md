# File Thumbnail Remaining Platonic Gap Blueprint

## Verdict

`FileThumbnail` is close to the ideal, but it is not finished.

The architecture is fundamentally right:

- `FileThumbnailFrame` is a dependency-free shell.
- `FileThumbnail` is the public facade.
- `GeneratedFileThumbnail` owns the generated-preview engine.
- Format renderers sit below the engine boundary.
- Expensive work is lazy, cached, bounded, and worker-backed where needed.
- The focused thumbnail tests and thumbnail TypeScript config pass.

The remaining work is not a rewrite. It is a subtraction pass: remove ambiguous
public states, complete the small missing geometry token, compress repeated
render lifecycles, and tighten names.

## Target State

The ideal component has one public concept:

```tsx
<FileThumbnail ... />
```

It can render:

- metadata fallback;
- caller-owned preview content;
- caller-owned preview image;
- browser `File`;
- `ViewerSource`;
- generated first-unit previews for supported file categories.

The caller should never need to know whether the implementation uses a browser
image, a PDF canvas, a DOCX DOM render, an iframe, a worker, a bounded cache, or
a resource suspense record.

## Non-Goals

- Do not reintroduce `DocumentThumbnail`.
- Do not split public components by format.
- Do not make generated preview helpers public.
- Do not add compatibility adapters.
- Do not broaden renderer inputs back to full viewer objects.
- Do not change visual design unless required by the API cleanup.

## Gap 1: Public Props Are Too Permissive

Current issue:

`FileThumbnailProps` inherits frame preview props and also accepts generated
preview props. This allows invalid or surprising combinations such as:

```tsx
<FileThumbnail source={source} previewContent={content} />
<FileThumbnail source={source} previewImageUrl={url} />
<FileThumbnail source={source} state="loading" />
```

Those calls compile, but they bypass generated preview routing because
`previewContent`, `previewImageUrl`, or `state` selects the frame path.

Ideal:

Make the public props a union of explicit modes.

```ts
type FileThumbnailProps =
  | FileThumbnailGeneratedProps
  | FileThumbnailFramePreviewProps
  | FileThumbnailMetadataProps
```

Rules:

- Generated mode accepts `source` or browser `File`.
- Generated mode accepts `as`, `anchor`, `retryKey`, and generated `onError`.
- Frame preview mode accepts `previewContent`, `previewImageUrl`, `state`, and
  `onPreviewError`.
- Metadata mode accepts plain `{ name, type }` only.
- Shared visual props remain shared.

The implementation can keep the same runtime branches, but TypeScript should
make impossible states impossible.

Acceptance:

- Ambiguous prop combinations fail typecheck.
- Existing valid examples still compile.
- Runtime branch order becomes obvious from prop shape, not hidden precedence.

## Gap 2: Anchor Geometry Is Incomplete

Current issue:

`ThumbnailAnchor` describes corner pinning but omits `bottom-right`.

Ideal:

Complete the token:

```ts
export type ThumbnailAnchor =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
```

Update both maps:

```ts
"bottom-right": "bottom-0 right-0"
"bottom-right": "object-right-bottom"
```

Acceptance:

- Every named corner is supported.
- Generated preview anchoring, direct image anchoring, and tests use the same
  token.

## Gap 3: Renderer Lifecycle Is Repeated

Current issue:

PDF, DOCX, and PPTX thumbnails each implement the same shape:

- callback ref receives a DOM node;
- start async render;
- keep an `active` flag;
- catch async render errors;
- ignore late failures after unmount;
- optionally cancel renderer work.

The code is correct and tested, but the lifecycle is repeated.

Ideal:

Introduce one internal hook for imperative thumbnail rendering:

```ts
function useImperativeThumbnailRender<Element extends HTMLElement>({
  render,
  cancel,
  deps,
}: {
  render: (element: Element) => Promise<void> | void
  cancel?: () => void
  deps: React.DependencyList
}): {
  ref: React.RefCallback<Element>
  renderError: unknown
}
```

Rules:

- The hook owns `active` lifecycle.
- The hook throws nothing; renderers throw `renderError` themselves to preserve
  the current error-boundary flow.
- PDF can pass a cancellation callback for `task.cancel()`.
- DOCX and PPTX can omit cancellation but still get stale-error protection.

Acceptance:

- Existing stale async regression tests still pass.
- No renderer has a local `let active = true` render lifecycle.
- Format renderers still own format-specific dimensions and third-party calls.

## Gap 4: Low-Value Metadata Adapter

Current issue:

`thumbnailFileMeta(resource)` is a tiny destructuring adapter whose name reads
like a model constructor but does not add behavior.

Ideal:

Either remove it or rename it to reveal why it exists.

Preferred hard cut:

```ts
function pickThumbnailFileMeta({
  fileName,
  mimeType,
  sourceKind,
}: ThumbnailFileMeta): ThumbnailFileMeta {
  return { fileName, mimeType, sourceKind }
}
```

The current helper exists to keep expensive helpers on narrow contracts. That is
good. The name should say that.

Acceptance:

- Narrow content-contract tests remain.
- No helper name implies more behavior than it has.

## Gap 5: Constants Belong At Module Scope

Current issue:

Some fixed rendering dimensions are declared inside render functions.

Ideal:

Move stable constants to module scope:

- PDF render width.
- PPTX fill size.
- iframe base size.

Acceptance:

- Render functions read as dataflow, not setup.
- No behavior change.

## Implementation Order

1. Complete `ThumbnailAnchor` with `bottom-right` and add tests.
2. Convert `FileThumbnailProps` into explicit mode unions.
3. Update call sites that relied on ambiguous prop combinations.
4. Add the imperative render lifecycle hook.
5. Migrate PDF, DOCX, and PPTX renderers to the hook.
6. Rename or remove `thumbnailFileMeta`.
7. Move stable constants to module scope.
8. Run focused thumbnail tests and the thumbnail TypeScript config.

## Required Verification

Run:

```sh
pnpm vitest run tests/thumbnail-architecture.test.ts tests/file-thumbnail.test.tsx tests/file-thumbnail-accessibility.test.tsx tests/thumbnail-regressions.test.tsx tests/thumbnail-decode-queue.test.ts tests/thumbnail-worker-client.test.ts tests/text-code-thumbnail.test.tsx tests/docx-thumbnail.test.tsx tests/file-thumbnail-xlsx-worker.test.ts
pnpm tsc -p tsconfig.thumbnail.json
```

Visual verification still matters. Do not start a dev server from the agent.
Have the user start the local docs app, then inspect the FileThumbnail examples
and generated-format demos in browser.

## Done Definition

`FileThumbnail` reaches the ideal when:

- impossible public states are unrepresentable;
- every anchor name is complete and symmetric;
- repeated imperative renderer lifecycle code is gone;
- renderer modules remain narrow and format-specific;
- generated preview machinery stays private;
- cache, worker, and resource boundaries remain tested;
- the public file remains readable without understanding the engine;
- the code has no compatibility shim, duplicate path, or low-value name.
