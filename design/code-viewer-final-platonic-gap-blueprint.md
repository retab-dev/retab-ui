# Code Viewer Final Platonic Gap Blueprint

## Purpose

`CodeViewer` has crossed the important architectural threshold: the DOM
ownership bug is gone, and the component is split into syntax, projection,
viewport, scheduling, and composition modules.

This document lists every remaining issue that keeps the component from the
platonic ideal:

- simplicity;
- speed;
- everything needed;
- nothing more;
- perfect modularization;
- high-entropy code;
- perfectly consistent names;
- Flaubertian exactness.

The goal is not another broad rewrite. The goal is the last compression pass:
remove the residue that only becomes visible after the major architecture is
already correct.

## Current Shape

```text
code-viewer.tsx
  public component and client-first fallback

code-viewer-content.tsx
  text resolution, bounds, zoom, toolbar, refs, imperative handle, composition

code-viewer-syntax.ts
  Prism JSON syntax detection, token flattening, token cache, syntax styles

code-viewer-projector.ts
  virtual range calculation, private row cache, DOM row patching, token DOM

code-viewer-viewport.tsx
  ScrollArea, fixed dimensions, empty row host

code-viewer-projection-scheduler.ts
  requestAnimationFrame, scroll listener, ResizeObserver cleanup
```

This is a good shape. It is not yet the final shape.

## Issue 1: `createCodeSyntax` Has a Dead Parameter

### Problem

`createCodeSyntax(resource, _text)` accepts `text` but does not use it.

The underscore makes the issue explicit, but it does not make it ideal. A
parameter that does not affect behavior is low-entropy API surface.

### Why It Matters

The function contract says text identity matters to syntax creation. The
implementation says it does not. That mismatch forces readers to ask whether
text was intended for future syntax detection, cache scoping, or invalidation.

### Ideal

Either:

```ts
function createCodeSyntax(resource: ViewerResource): CodeSyntax
```

or, if text truly matters:

```ts
function createCodeSyntax(input: {
  resource: ViewerResource
  text: string
}): CodeSyntax
```

Use the first unless there is a real text-dependent syntax decision.

### Acceptance

- no `_text` parameter;
- no unused parameter;
- tests still prove syntax cache identity resets when the calling component
  recreates syntax for new text.

## Issue 2: Syntax Styles Are Injected Per Viewer Instance

### Problem

`CodeViewerContent` conditionally renders:

```tsx
<style>{CODE_VIEWER_SYNTAX_STYLE}</style>
```

This works, but it means every JSON viewer instance owns a duplicate style tag.

### Why It Matters

Per-instance style injection is correct but imprecise. Syntax token classes are
global component styling, not per-resource state.

### Ideal

Move syntax token styles to the stable styling layer for the code viewer:

- component stylesheet if this registry supports one;
- shared CSS variables/class rules if already used by viewer primitives;
- a single deduplicated style boundary only if registry packaging requires
  inline styles.

Do not make consumers remember to import an extra stylesheet manually unless the
registry system already uses that pattern.

### Acceptance

- no per-instance duplicate `<style>` tags;
- token colors still render in light and dark themes;
- registry output still installs a complete working component.

## Issue 3: Projector Owns Too Many Sub-Responsibilities

### Problem

`code-viewer-projector.ts` is coherent, but it owns several separable concerns:

- virtual line window;
- row cache;
- row DOM creation;
- row DOM patching;
- token DOM rendering;
- token class mapping;
- style write minimization;
- row ordering.

This is not wrong. It is dense.

### Why It Matters

The projector is the most important correctness boundary. Dense code in that
module increases the cost of proving it cannot remove React-owned nodes, leak
rows, duplicate rows, or retain stale syntax spans.

### Ideal

Keep one public projector factory, but split private internals into precise
sections or internal helpers with exact names:

```text
createCodeProjector
  owns lifecycle and cache

createCodeRow
  creates static row shell

patchCodeRow
  patches row metadata, class, gutter, and content

patchCodeTokens
  patches token/text content only

syncVisibleRowOrder
  owns child ordering
```

Only extract another file if the projector remains hard to scan after internal
compression. The public API should not grow.

### Acceptance

- `createCodeProjector` remains the only exported factory;
- row cache remains private;
- token DOM patching is visibly separate from virtual range selection;
- no general reconciler abstraction appears.

## Issue 4: Projector Still Allocates `visibleRows` On Every Projection

### Problem

The projector computes:

```ts
const visibleRows = visibleLines.map(...)
syncRowOrder(rowHost, visibleRows)
```

The allocation is bounded by visible rows plus overscan, so it is acceptable.
It is not the absolute minimum work.

### Why It Matters

The code viewer is a scroll-time component. Scroll-time allocations should be
intentional and measured.

### Ideal

Keep the algorithm simple, but prove the allocation is either:

1. cheaper and clearer than a cursor-only projection loop; or
2. removable without making the projector harder to read.

The likely ideal is a direct cursor loop:

```text
for each visible line:
  prepare row
  insert before cursor only when needed
  advance cursor
remove trailing stale children
```

No intermediate `visibleRows` array unless tests or profiling show it is the
better tradeoff.

### Acceptance

- scroll projection performs no avoidable array allocation beyond
  `visibleLines`;
- repeated projection with the same visible range preserves row identity;
- row ordering tests still pass.

## Issue 5: DOM Write Minimization Is Not Directly Measured

### Problem

The projector avoids some low-value writes:

- style writes are guarded;
- text writes are guarded;
- rows are not duplicated;
- row order sync avoids appending rows already in place.

But tests mostly assert final DOM state, not write counts.

### Why It Matters

Performance claims should be backed by tests or measurement. Without direct
coverage, a future edit can accidentally reintroduce repeated `replaceChildren`
or unconditional style/text writes.

### Ideal

Add tests that spy on the relevant DOM mutation methods for stable projection:

- same input does not call `replaceChildren`;
- same input does not rewrite `textContent`;
- same input does not call `insertBefore`;
- syntax identity change patches content exactly where needed;
- content identity change clears once.

Keep these tests focused. Do not turn them into brittle implementation mirrors.

### Acceptance

- projector write-minimization tests exist;
- tests fail if stable projection clears and rebuilds the visible DOM;
- tests still allow necessary writes on content/syntax/layout changes.

## Issue 6: Token Content Always Rebuilds For Tokenized Lines

### Problem

For tokenized lines, `patchCodeContent` calls `replaceChildren()` and rebuilds
token spans whenever the row patch identity changes.

This is correct. It is not the most exact possible DOM patch.

### Why It Matters

JSON rows can be long, and highlight/layout changes should not require token
child replacement if token content did not change.

### Ideal

Separate row patch identity from content patch identity:

```text
rowLayoutIdentity
  line number + layout + highlight

rowContentIdentity
  text + syntax identity
```

Then:

- layout/highlight changes patch row/gutter/class only;
- text/syntax changes patch content;
- content patching can remain replace-based because it only runs when content
  actually changes.

### Acceptance

- highlighting a line does not rebuild token spans for unchanged text;
- zooming does not rebuild token spans;
- changing JSON text or syntax identity does rebuild token spans.

## Issue 7: Identity Is Correct But Not Fully Typed

### Problem

Identities are strings assembled with `"\u0000"` separators:

```ts
contentIdentity
layoutIdentity
syntaxIdentity
```

The names are good. The type system cannot distinguish them from arbitrary
strings.

### Why It Matters

This is a small but real precision gap. The blueprint says there are exactly
three identities. Types should help preserve that.

### Ideal

Use nominal aliases if they improve clarity without ceremony:

```ts
type CodeContentIdentity = string & {
  readonly __codeContentIdentity: unique symbol
}
type CodeLayoutIdentity = string & {
  readonly __codeLayoutIdentity: unique symbol
}
type CodeSyntaxIdentity = string & {
  readonly __codeSyntaxIdentity: unique symbol
}
```

Only do this if it makes call sites clearer. If branded strings add noise, keep
plain strings and enforce naming through tests.

### Acceptance

- identity concepts cannot be casually swapped, either by branded types or by
  tighter constructors;
- no generic `key` or `id` appears for projection identity.

## Issue 8: `CodeViewerContent` Still Computes Layout Identity Inline

### Problem

`CodeViewerContent` computes:

```ts
const gutterWidth = ...
const layoutIdentity = [lineHeight, gutterWidth].join("\u0000")
```

This is small, but it is one more detail in the composition module.

### Why It Matters

`CodeViewerContent` should read as a wiring diagram. Identity construction is a
domain rule.

### Ideal

Move identity construction to small named functions if it increases precision:

```ts
codeContentIdentity(...)
codeLayoutIdentity(...)
```

Do not create a module just for these functions. Put them near the owner of the
identity rule.

### Acceptance

- content reads clearly;
- identity construction has a precise name;
- no extra abstraction layer exists only to hold two joins.

## Issue 9: Accessibility Of The Projected Code Surface Is Implicit

### Problem

The projected host is a `<pre>` with imperative children. Line numbers and code
text are visible, but the component does not explicitly document or test its
accessibility contract.

### Why It Matters

The ideal includes everything needed. A code viewer should be readable,
copyable, and navigable enough for assistive technologies, or intentionally
scoped if full code-editor semantics are not provided.

### Ideal

Define the accessibility contract:

- the viewer is read-only;
- toolbar buttons have accessible names;
- line numbers are either presentational or intentionally included;
- highlighted lines have a visual state and, if needed, semantic state;
- the code surface remains keyboard-scrollable through the scroll area.

### Acceptance

- tests cover toolbar accessible names;
- tests cover whether line numbers are included or hidden from the accessibility
  tree;
- any chosen ARIA attributes are minimal and accurate.

## Issue 10: Copy Semantics Are Not Explicit

### Problem

Imperative rows interleave gutter and content spans. Browser selection may copy
line numbers depending on DOM/CSS behavior.

### Why It Matters

For a code viewer, copy behavior is part of the product. The ideal does not
leave it accidental.

### Ideal

Decide and test one behavior:

1. copy includes code text only; or
2. copy includes line numbers intentionally.

The likely ideal is code text only. If so, line numbers should be non-selectable
and not pollute clipboard text.

### Acceptance

- copy behavior is documented by tests;
- gutter DOM cannot accidentally become copied text if code-only copy is the
  desired behavior.

## Issue 11: Global Verification Is Red

### Problem

`pnpm exec tsc --noEmit --pretty false` is red in the current worktree due
file-system state/type mismatches outside the code-viewer refactor.

Observed failures include:

- `filters` missing from `FileSystemQueryState`;
- `"gallery"` not assignable to `FileSystemView`;
- file-system header state fields not matching current controller output.

### Why It Matters

Even if unrelated, a perfect component lives in a perfect verification context.
Global red typecheck weakens confidence in any claim of finality.

### Ideal

Repair the file-system type contracts in their own focused pass, then rerun the
global typecheck.

### Acceptance

- global `pnpm exec tsc --noEmit --pretty false` passes;
- no code-viewer claims depend on ignoring unrelated red gates.

## Issue 12: Browser Verification Is Split Across Direct Preview Routes

### Problem

The direct routes prove the actual rendered components:

```text
/view/blocks/file-system?selectedPath=workspace%2Fuse-debounced-value.ts
/view/blocks/fslight
```

The catalog route:

```text
/blocks#category-file-system
```

starts the file-system block with no selected file, so it does not prove code
projection until a file is selected.

### Why It Matters

The original reports referenced the catalog route. The direct preview route is
strong evidence for the component, but the catalog interaction path should also
be verified if finality is claimed.

### Ideal

Browser verification should cover both:

- direct preview URLs with selected files;
- catalog route interaction that selects a TypeScript or JSON file and confirms
  code projection.

### Acceptance

- catalog file-system block can select a code file and render it;
- catalog file-system-light block can select JSON and render syntax tokens;
- no `removeChild` / `NotFoundError` logs appear during either path.

## Issue 13: Tests Assert Boundaries By Source Text

### Problem

Some boundary tests read source files and assert strings such as:

```ts
expect(contentSource).not.toContain("Prism")
```

This is useful, but source-text tests are blunt instruments.

### Why It Matters

Source assertions can become brittle or miss semantic drift. They should support
real behavior tests, not replace them.

### Ideal

Keep a small number of source-boundary tests for architectural guardrails, but
prefer behavior tests for:

- DOM ownership;
- projection lifecycle;
- syntax cache;
- row order;
- write minimization;
- accessibility and copy semantics.

### Acceptance

- source-boundary tests are limited and high signal;
- every important source assertion has a corresponding behavior test where
  practical.

## Issue 14: Syntax Support Is Minimal By Design But Not Named As Such

### Problem

The syntax module currently supports JSON detection and plain text fallback.
That is fine for the current file-system JSON/TypeScript behavior, but the name
`CodeViewer` can imply broader language support.

### Why It Matters

The ideal includes everything needed and nothing more. Minimal syntax support is
good only if it is explicit.

### Ideal

Name the current scope clearly in tests and comments:

```text
JSON syntax highlighting is supported.
Other code-like text renders as plain fixed-line code.
```

Do not add broad language support unless a product requirement demands it.

### Acceptance

- tests assert TypeScript renders as plain code, not highlighted code;
- docs or comments do not imply full language highlighting.

## Issue 15: The Projector Reset API Is Present But Underused

### Problem

`CodeProjector` exposes:

```ts
reset(identity)
```

Current normal operation relies on `project()` detecting identity changes and
clearing rows internally.

### Why It Matters

A public method that is rarely needed may be unnecessary API. The blueprint
asked for it, but the implementation has shown that automatic reset inside
`project` might be enough.

### Ideal

Choose one:

1. keep `reset` because external lifecycle code needs an explicit hard reset;
2. remove `reset` if `project` and `destroy` fully cover the lifecycle.

No ornamental API.

### Acceptance

- every public projector method is called by production code or justified by a
  direct test;
- if `reset` remains, a test proves its exact behavior.

## Final Pass Plan

1. Remove dead API.

   Delete the unused `text` parameter from `createCodeSyntax`, or make it
   meaningful. Prefer deletion.

2. Decide style ownership.

   Remove per-instance syntax style injection if the registry can carry a
   stable style surface without consumer burden.

3. Tighten projector patch identities.

   Separate row layout/highlight patching from content/token patching so zoom
   and highlight changes do not rebuild token children.

4. Remove or justify scroll-time allocation.

   Replace `visibleRows` with cursor-order projection if it is simpler and
   faster.

5. Add write-minimization tests.

   Prove stable projection avoids unnecessary DOM writes.

6. Define accessibility and copy contracts.

   Add tests for toolbar names, line-number semantics, and clipboard/selection
   behavior.

7. Decide projector `reset`.

   Keep it only if it has real production or test value.

8. Verify catalog interactions.

   Use the catalog route, select code/JSON files, and confirm projection.

9. Restore global typecheck in a separate file-system pass.

   Do not claim a fully perfect system while `tsc` is red.

## Final Acceptance Criteria

The code viewer reaches the platonic ideal when:

- `createCodeSyntax` has no unused surface;
- syntax styles are owned once, not per viewer instance;
- `CodeViewerContent` remains a wiring diagram;
- `CodeViewerViewport` renders an empty row host and owns no domain logic;
- `CodeViewerProjector` has one public factory and no unnecessary public
  methods;
- projector tests prove no duplicate rows, no stale rows, and no unnecessary
  stable-projection writes;
- token DOM is not rebuilt for pure layout/highlight changes;
- syntax scope is explicit and minimal;
- accessibility and copy behavior are intentional and tested;
- direct preview and catalog browser paths render code without flicker or
  `removeChild` / `NotFoundError`;
- targeted registry artifacts are regenerated;
- global typecheck is green.

## Final Judgment

The current code viewer is architecturally serious. It is no longer a patched
component.

The remaining work is refinement, not rescue. That refinement still matters:
perfection is the removal of every unnecessary parameter, write, style tag,
ambiguous behavior, and unverifiable claim.
