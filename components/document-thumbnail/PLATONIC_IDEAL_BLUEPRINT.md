# Document Thumbnail Final Ideal Blueprint

This blueprint starts from the current post-refactor thumbnail architecture.

`FileThumbnail` is the dependency-free visual shell. `DocumentThumbnail` is the
installable first-unit renderer stack. The system is now modular, enforced, and
type-clean. It is not literally perfect. This note names only the remaining work
between the current state and the ideal.

## Standard

Platonic ideal means:

- Simple: one obvious owner for shell, image loading, routing, cache, decode, worker, error, and renderer behavior.
- Fast: lazy viewport gating, bounded decode concurrency, bounded caches, no duplicate parses, no unmeasured large-grid regressions.
- Complete: every supported format has loading, error, empty, fallback, retry, stale-render, accessibility, and reset behavior.
- Minimal: no local copies of shared primitives, compatibility names, speculative APIs, duplicate worker plumbing, or unused exports.
- Modular: every module owns one coherent responsibility.
- High entropy: every exported type or helper has a real consumer.
- Consistent: the same lifecycle concept gets the same name everywhere.
- Exact: registry names and docs distinguish the primitive shell from the document renderer stack.

## Current State

Implemented and enforced:

- `FileThumbnail` remains a dependency-free shell.
- `FileThumbnail` shell layout, image fade lifecycle, shimmer animation, fallback chrome, type surface, and extension/MIME mapping live in focused registry modules.
- `DocumentThumbnail` is a facade over descriptor resolution, resource creation, key creation, error state, and shell composition.
- Direct raster URL handling lives in `thumbnail-direct-image.tsx`.
- PDF and DOCX thumbnails depend on renderless `pdf-document-resource` and `docx-document-resource` primitives, not full viewer components.
- Client gating uses shared `useIsClient`.
- Renderer registration lives in `renderer-registry.tsx`.
- Client preview lifecycle lives in `thumbnail-client-preview.tsx`.
- Viewport gating lives in `thumbnail-in-view.ts`.
- Render-key scoped error projection lives in `thumbnail-error-state.ts`.
- Thumbnail output options live in `thumbnail-options.ts`.
- Cache mechanics live in `thumbnail-cache.ts`.
- Bounded text loading lives in `thumbnail-text.ts`.
- Decode concurrency lives in `thumbnail-decode-queue.ts`.
- Profiling lives in `thumbnail-profile.ts`.
- Suspense promise records live in `thumbnail-resource.ts`.
- Format and image errors live in `thumbnail-errors.ts`.
- Preview limits live in `thumbnail-limits.ts`.
- Test reset lives in `thumbnail-test-reset.ts`.
- TIFF and XLSX renderers use `thumbnail-worker-client.ts`.
- Registry metadata exposes `file-thumbnail` as a shell-only install, renderless PDF/DOCX resource primitives as shared libs, and `document-thumbnail` as the complete first-unit renderer stack without full viewer chrome.
- Architecture tests enforce the primitive/renderer boundary, direct-image extraction, shared client gate, renderer cache discipline, worker-client use, and registry scope.
- Worker-client and decode-queue tests cover request cleanup, worker reset/error rejection, transferables, and bounded concurrency.
- Focused thumbnail tests cover viewport gating, retry, cache identity, direct image shortcut, object URL revocation, prefix reads, DOCX buffer copying, and XLSX worker validation.

## Remaining Imperfections

- Stale async behavior is not exhaustively tested for every renderer class: PDF canvas, PPTX canvas, DOCX host writes, and worker-backed previews.
- Performance is protected by deterministic unit tests, but not by a large-grid benchmark or regression budget.
- Accessibility semantics are mostly correct and partly tested, but not fully audited across shell image, renderer image, iframe, shimmer, fallback, and clickable-parent contexts.
- The repo worktree has unrelated dirty changes, so final review is not isolated.

## Final Shape

The final module map should remain:

```txt
components/ui/file-thumbnail.tsx
  primitive visual shell only

registry/new-york-v4/ui/file-thumbnail.tsx
  public installable shell

registry/new-york-v4/ui/file-thumbnail-image.tsx
  browser image fade/load/error lifecycle

registry/new-york-v4/ui/file-thumbnail-shimmer.tsx
  shimmer animation and reduced-motion subscription

registry/new-york-v4/ui/file-thumbnail-fallback.tsx
  fallback icon and extension label

registry/new-york-v4/ui/file-thumbnail-extension.ts
  extension and MIME mapping

registry/new-york-v4/ui/file-thumbnail-types.ts
  public shell props and state types

components/document-thumbnail.tsx
  public DocumentThumbnail facade

components/document-thumbnail/types.ts
  public props, anchors, renderer contracts

components/document-thumbnail/descriptor.ts
  source/category resolution and TIFF detection

components/document-thumbnail/renderer-registry.tsx
  category -> first-unit renderer map

components/document-thumbnail/thumbnail-client-preview.tsx
  client gate, viewport gate, Suspense, error boundary

components/document-thumbnail/thumbnail-in-view.ts
  IntersectionObserver once-seen hook

components/document-thumbnail/thumbnail-error-state.ts
  render-key scoped error state and viewer error projection

components/document-thumbnail/thumbnail-options.ts
  category-specific cache option list

components/document-thumbnail/thumbnail-cache.ts
  generic bounded artifact cache

components/document-thumbnail/thumbnail-text.ts
  bounded text/range/stream prefix loading

components/document-thumbnail/thumbnail-decode-queue.ts
  global decode concurrency gate

components/document-thumbnail/thumbnail-profile.ts
  opt-in profiling helper

components/document-thumbnail/thumbnail-resource.ts
  Suspense promise records

components/document-thumbnail/thumbnail-errors.ts
  format error wrapping and image load errors

components/document-thumbnail/thumbnail-worker-client.ts
  typed request/response client for long-lived workers

components/document-thumbnail/thumbnail-test-reset.ts
  clears caches, workers, pending requests, decode queue, and Suspense records

components/document-thumbnail/thumbnail-direct-image.tsx
  direct URL image shortcut

components/document-thumbnail/renderers/*.tsx
  format-specific first-unit rendering only
```

## Canonical Language

Use these words consistently:

```txt
source          original viewer source
descriptor      resolved file category, name, and MIME metadata
resource        viewer resource created from source
thumbnailKey    expensive cache identity
renderKey       mounted render identity, including anchor and retry key
anchor          pinned visible corner
preview         rendered first-unit content
shell           dependency-free FileThumbnail frame
renderer        format-specific first-unit renderer
artifact        cached parse/render intermediate
decodeSlot      global heavy-work concurrency permit
workerRequest   one typed worker operation
errorState      render-key scoped error projection
reset           test-only cleanup of caches, workers, and promise records
```

## Workstream 1: Shell Exactness

Status: implemented.

`FileThumbnail` is split into:

```txt
file-thumbnail.tsx          public shell
file-thumbnail-types.ts     public shell props and state types
file-thumbnail-image.tsx    image fade/load/error lifecycle
file-thumbnail-shimmer.tsx  shimmer + reduced-motion hook
file-thumbnail-fallback.tsx fallback icon + extension label
file-thumbnail-extension.ts extension/MIME parsing
```

Rules that must stay true:

- Do not split if call sites become harder to read.
- Keep the registry item dependency-free.
- Keep public exports minimal: `FileThumbnail`, `FileThumbnailShimmer`, public props/types, and tested pure helpers only if they have consumers.

Acceptance:

- The public shell remains smaller or equally clear.
- No renderer dependency enters the primitive.
- Existing `FileThumbnail` tests still pass.

## Workstream 2: Direct Image Path

Status: implemented.

The fastest path is explicit without bloating the facade:

- `DocumentThumbnail` decides whether the descriptor/resource has a direct raster URL.
- `thumbnail-direct-image.tsx` owns TIFF exclusion, object-position anchoring, browser image error mapping, and `FileThumbnail` direct image props.

Acceptance:

- Direct image URL thumbnails never mount renderer lifecycle.
- Direct image failures still produce canonical thumbnail error state.
- Retry clears direct-image error state through `renderKey`.

## Workstream 3: Stale Async Proof

Goal: prove old renders cannot write or report errors after replacement.

Add tests for:

- DOCX render resolves after unmount and does not write into the old host.
- PDF canvas render rejects after unmount and does not flip the shell into error.
- PPTX canvas render rejects after unmount and does not flip the shell into error.
- Worker-backed TIFF/XLSX response resolves after replacement and does not affect the new render.
- Old `renderKey` error cannot override current `renderKey` state.

Acceptance:

- Every asynchronous renderer class has one stale-work regression test.
- Tests use controlled promises/callbacks, not wall-clock timing.

## Workstream 4: Large-Grid Performance Budget

Goal: prove the thumbnail grid remains fast under realistic load.

Add a deterministic benchmark or profiling test for a large grid:

- Many text/CSV thumbnails.
- Mixed direct images and renderer-backed files.
- Multiple TIFF/XLSX/PPTX/DOCX thumbnails queued together.

Measure:

- Number of fetches.
- Number of worker requests.
- Maximum concurrent decode slots.
- Number of mounted renderer previews before intersection.
- Cache hit rate on metadata-only rerenders.

Acceptance:

- The benchmark has explicit budgets.
- It does not fail from wall-clock noise unless isolated enough to be stable.
- The profiler output is useful when a budget fails.

## Workstream 5: Install Story

Status: implemented.

Registry semantics:

- Include all helper, renderer, and worker files.
- Include dependencies for PDF, DOCX, PPTX, XLSX, TIFF, Markdown, and sanitization.
- Keep `file-thumbnail` unchanged as the primitive shell.
- Add registry exactness tests or extend existing registry architecture tests.

Acceptance:

- Docs and registry metadata make the distinction impossible to misread.
- Installing `file-thumbnail` never installs renderer libraries.
- Installing `document-thumbnail`, if supported, installs a complete renderer stack without installing full PDF/DOCX viewers.

## Workstream 6: Accessibility Audit

Goal: make semantics intentional for every thumbnail state.

Audit:

- Shell image alt text.
- Decorative renderer image alt text.
- Fallback extension label.
- Error `aria-label` and `title`.
- Shimmer `aria-hidden`.
- Sandboxed iframe `title`, `tabIndex`, and `aria-hidden`.
- Focus behavior when the thumbnail is inside a clickable row/card/button.

Acceptance:

- No unexpected tab stops.
- User-facing image previews have file-name alt text.
- Decorative renderer previews stay hidden.
- Error state exposes the user-safe error message.
- Tests cover the highest-risk semantics.

## Workstream 7: Deletion And Entropy Pass

Goal: remove anything that exists only because the refactor happened.

For every thumbnail module, ask:

- Does this export have a real consumer?
- Does this helper remove more code than it adds?
- Is this option reflected in `thumbnailKey` if it changes output?
- Is this branch reachable?
- Is this name one of the canonical lifecycle words?
- Would a new engineer know where to change this behavior from the file name?

Acceptance:

- No compatibility barrels for deleted modules.
- No test-only public exports.
- No duplicate constants.
- No stale blueprint or docs references.

## Verification

Minimum commands:

```bash
pnpm test tests/thumbnail-architecture.test.ts
pnpm test tests/thumbnail-worker-client.test.ts tests/thumbnail-decode-queue.test.ts
pnpm test tests/file-thumbnail.test.tsx tests/docx-thumbnail.test.tsx tests/document-thumbnail-xlsx-worker.test.ts
pnpm typecheck
pnpm registry:validate
```

If registry metadata changes:

```bash
pnpm registry:build
pnpm registry:validate
```

Optional focused lint:

```bash
pnpm exec eslint components/document-thumbnail.tsx components/document-thumbnail registry/new-york-v4/ui/file-thumbnail.tsx tests/file-thumbnail.test.tsx tests/thumbnail-architecture.test.ts
```

## Definition Of Done

The thumbnail system reaches the ideal only when:

- `FileThumbnail` remains dependency-free and has exactly the right internal size.
- `DocumentThumbnail` is a facade, not a lifecycle warehouse.
- Direct image behavior is extracted.
- Shared primitives are reused instead of copied.
- Cache, text loading, decode queue, profiling, errors, and Suspense records live in separate named modules.
- Worker request plumbing is shared and tested.
- Stale async work cannot write or report errors after render replacement.
- All caches, workers, pending requests, decode queue, and Suspense records have a test reset path.
- Registry naming distinguishes shell from renderer stack.
- Installing `document-thumbnail` installs the renderer stack.
- Installing `document-thumbnail` does not install full PDF/DOCX viewer UI.
- Performance guardrails prove lazy rendering, bounded concurrency, and cache reuse under large-grid pressure.
- Accessibility behavior is intentional and tested.
- Architecture tests enforce the primitive/renderer boundary.
- Every exported symbol earns its place.
