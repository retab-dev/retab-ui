# Text Viewer Performance Blueprint

## Purpose

Make the current Text Viewer fast by removing the largest synchronous costs first,
then tightening scroll projection. The target is a simple viewer routing model:
Markdown uses the Markdown Viewer, code-like text uses the Code Viewer, and prose
text uses the fastest prose projection.

This blueprint is about the live `registry/new-york-v4` implementation. It does
not replace the broader native prose design in
`design/text-viewer-native-chunk-prose-blueprint.md`.

## Current Diagnosis

The live public Text Viewer is implemented by:

- `registry/new-york-v4/ui/text-viewer.tsx`
- `registry/new-york-v4/ui/text-viewer-content.tsx`
- `registry/new-york-v4/ui/text-viewer-layout.ts`
- `registry/new-york-v4/ui/text-viewer-resource.ts`
- `registry/new-york-v4/ui/text-viewer-chenglou-content.tsx`
- `registry/new-york-v4/ui/file-viewer-route.tsx`

The expensive work is not frame layout. In a local pure-function timing pass over
the existing `app/(view)/text-viewer-profile` markdown fixture:

- `TextViewer` markdown preparation for about 282 KB took roughly 3.2s to 4.1s
  after warmup.
- `layoutTextDocument` for the same prepared document took about 2ms to 3ms.
- `MarkdownViewer` document creation for the same markdown took about 388ms cold
  and under 1ms on cache hits.
- plain text and log-like text preparation was much healthier: 10k record lines
  prepared in roughly 200ms to 250ms and laid out in about 3ms.

The first performance rule is therefore clear: do not optimize the frame loop
before eliminating avoidable full-document parse and preparation.

## Target Routing

One source kind should not imply one renderer. The router should choose by
document intent:

| Input | Target renderer |
| --- | --- |
| `.md`, `.markdown`, `text/markdown` | `MarkdownViewer` |
| source files, logs, JSON, XML, YAML, stack traces | `CodeViewer` |
| prose `.txt`, plain notes, natural-language inline text | `ChenglouTextViewer` or the native prose path |
| explicitly requested exact text mode | current exact Text Viewer path |

`FileViewer` already does part of this: markdown goes to `MarkdownViewer`, prose
text goes to `ChenglouTextViewer`, and non-prose text goes to `CodeViewer`.
Public `TextViewer` should converge on the same routing instead of keeping
`mode="markdown"` on the slow text-layout path.

## Non-Goals

- Do not make Text Viewer a second Markdown Viewer.
- Do not slow Code Viewer or mix line-number code behavior into prose.
- Do not preserve backward-compatible internal adapters for the old markdown path.
- Do not add a new generic virtualization library.
- Do not start, stop, or manage dev servers from performance scripts.

## Phase 1: Add An Executable Baseline

Create `scripts/verify-text-viewer-performance.mjs`.

The script should expect an already-running dev server, matching repo policy. It
should not start, stop, or restart the server.

Measure these routes:

- `/text-viewer-profile?variant=current`
- `/text-viewer-profile?variant=chenglou`
- `/text-viewer-profile?variant=vanillacheng`
- `/view/markdown-viewer`
- `/scrollbench?viewer=text`

Capture:

- time to viewer shell
- time to first visible text
- time until initial render settles
- mounted row or chunk count
- small-scroll FPS and frame percentiles
- large-jump FPS and frame percentiles
- long tasks during initial open and scrolling

Start with observational JSON output in an ignored artifact path. Commit budgets
only after the routing and projection changes land.

Acceptance:

- The script can run against `localhost:3100` or a supplied `BASE_URL`.
- It outputs machine-readable JSON.
- It fails clearly when the server is absent.
- It does not mutate source files or require a clean git tree.

## Phase 2: Route Markdown Out Of Text Viewer

Remove the slow public markdown path from `TextViewer`.

Work:

- Delete or deprecate `TextViewer`'s markdown parse route in
  `text-viewer-layout.ts`.
- When `TextViewer` receives markdown by extension, MIME, or explicit mode, render
  `MarkdownViewer`.
- Keep the public `TextViewerHandle` contract by forwarding
  `scrollToLineRange` and `getViewportElement`.
- Move any remaining contract tests that assert Markdown syntax rendering from
  `TextViewer` to `MarkdownViewer`, unless they specifically assert delegation.
- Update docs that imply Markdown routes through `TextViewer(mode="markdown")`.

Acceptance:

- `FileViewer` and public `TextViewer` agree on markdown routing.
- `TextViewer` no longer calls `marked.lexer` for markdown content.
- Markdown fragment links, tables, raw HTML safety, images, and source-line
  scrolling remain covered through `MarkdownViewer`.
- The text-viewer profile shows current markdown open time close to the
  Markdown Viewer path, not the old Pretext text-layout path.

## Phase 3: Make Chenglou Projection The Public Prose Path

The React projection in `text-viewer-content.tsx` is valuable as a correctness
reference, but it should not be the default hot path for public prose text.

Work:

- Rename the current React path to an explicit exact/debug content implementation.
- Make public prose `TextViewer` render `ChenglouTextViewerContent`.
- Remove duplicate public entry points once parity is proven; keep one exported
  prose component.
- Keep `TextViewerFrame`, controls, download actions, highlight, and imperative
  handle behavior unchanged.

Acceptance:

- `tests/text-viewer-prose-cutover.test.tsx` and
  `tests/text-viewer-vanillacheng-parity.test.tsx` converge on one public
  implementation.
- Scroll projection happens through one requestAnimationFrame path.
- Fast scroll does not require React to reconcile every visible block window.
- There is no user-visible regression in highlight, copy, zoom, or source-line
  navigation.

## Phase 4: Cache Prepared Text Documents

Text loading is cached for URL and blob sources, but prepared text documents are
computed per mount. Add a bounded prepared-document cache.

Cache key:

```ts
type TextPreparedDocumentCacheKey = {
  contentIdentity: string
  mode: "text"
  maxBytes: number
  maxLines: number
  fontPolicyVersion: string
}
```

Rules:

- Cache prepared documents, not layout frames.
- Keep layout frames dependent on width and zoom.
- Bound cache size and evict oldest entries.
- Clear cache in tests.
- Do not cache thrown errors as prepared documents.

Acceptance:

- Remounting the same large inline text reuses the prepared document.
- Changing text, bounds, mode, or font policy invalidates the cache.
- Layout still updates immediately on width and zoom changes.

## Phase 5: Fix Inline Text Identity

`textPayloadIdentityKey(text)` currently embeds the whole text in resource keys.
That is hostile to large inline strings and keeps huge key strings alive.

Work:

- Prefer `source.identityKey` for text sources when supplied.
- For default text identity, use a compact stable key such as length plus hash.
- Make the same compact identity drive resource keys and render reset keys.
- Document that callers with mutable text must provide a changing `identityKey`,
  or let the default hash key handle it.

Acceptance:

- Large inline text does not appear verbatim in Map keys.
- Same text still resolves to the same default identity.
- Different text with the same length does not collide under normal hash tests.
- Existing resource cache tests cover text source identity changes.

## Phase 6: Remove Scroll Hot-Path Waste

After routing and projection are fixed, tighten the remaining hot path.

Work:

- Avoid building string window keys on every scroll comparison.
- Compute the projected window once per frame and pass structured window data to
  projection.
- Cache materialized visible line windows per block, width, scale, and window.
- Add a source-line-to-frame index or binary search helper for
  `scrollToLineRange`; avoid linear frame scans on frequent source navigation.
- Ensure highlight changes do not automatically scroll on every hover-driven
  update unless the caller explicitly requests navigation.

Acceptance:

- Small scroll produces minimal allocations.
- Large jumps do not rematerialize unchanged visible row content.
- Source-linked hover remains visually responsive without scroll jank.
- Performance script captures lower scripting time, not only better FPS.

## Phase 7: Delete Dead Paths

Once the new routing is proven, remove obsolete code instead of preserving
compatibility shims.

Candidates:

- public `TextViewer(mode="markdown")` behavior
- duplicate `VanillaChengTextViewer` export if it only aliases the final path
- stale architecture docs that describe the old TanStack line virtualizer
- tests that assert implementation details of the removed markdown path

Acceptance:

- The public API surface is smaller.
- The implementation has one prose path, one markdown path, and one code path.
- Documentation describes the actual routing.

## Verification Matrix

Focused tests:

- `pnpm vitest run tests/text-viewer-prose-cutover.test.tsx`
- `pnpm vitest run tests/text-viewer-vanillacheng-parity.test.tsx`
- `pnpm vitest run tests/markdown-text-viewer-contract.test.tsx`
- `pnpm vitest run tests/markdown-viewer.test.tsx`
- `pnpm vitest run tests/code-viewer.test.tsx`

Browser verification:

- text profile current/prose route
- markdown viewer route
- file viewer markdown route
- file viewer prose text route
- scrollbench code route

Performance verification:

- `node scripts/verify-text-viewer-performance.mjs --base-url http://localhost:3100`

## Completion Definition

The work is done when:

- markdown no longer enters Text Viewer's Pretext markdown parser;
- prose public Text Viewer uses the fast projection path;
- repeated large inline text opens reuse prepared documents;
- inline text resource keys are compact;
- text performance has an executable baseline;
- stale docs and duplicate paths are removed.
