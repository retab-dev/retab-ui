# Code Viewer Terminal Platonic Blueprint

## Purpose

The current `CodeViewer` is correct where it most needed to be correct: React no
longer co-owns the virtual row DOM, so the `removeChild` crash class is gone.

This blueprint defines the next and final cut: the version of the component that
is not merely fixed, but exact.

The target is a code viewer with:

- one owner for every DOM subtree;
- one source of truth for every derived value;
- one module per coherent responsibility;
- no duplicated rendering path;
- no speculative option;
- no naming drift;
- no wasted render, layout, tokenization, or DOM write.

## Current State

The implemented fix established the essential invariant:

```text
React owns the shell.
The projector owns row children.
No subtree is shared.
```

That invariant is the right foundation, but the component is not yet the
platonic ideal. `code-viewer-content.tsx` still contains too many jobs:

- text resource reads;
- syntax detection;
- Prism token flattening;
- token caching;
- row cache management;
- DOM row creation;
- DOM row patching;
- virtual range projection;
- scroll and resize scheduling;
- toolbar state;
- viewport layout;
- imperative handle wiring.

This is correct enough to ship. It is not exact enough to be final.

## Final Shape

The final system should have five modules:

```text
code-viewer.tsx
  public component, fallback policy, exported types

code-viewer-content.tsx
  resolved text, toolbar state, imperative handle, composition

code-viewer-syntax.ts
  language detection, tokenization, token cache

code-viewer-projector.ts
  virtual row cache, DOM row creation, DOM row patching, projection lifecycle

code-viewer-viewport.tsx
  scroll area, dimensions, empty row host, viewport ref
```

Optional only if it removes real complexity:

```text
code-viewer-projection-scheduler.ts
  requestAnimationFrame, scroll listener, ResizeObserver lifecycle
```

Do not create helper modules for names, constants, or single-use wrappers. A
module must own a real boundary.

## Hard Invariants

### DOM Ownership

The row host is empty in JSX:

```tsx
<pre ref={rowHostRef} />
```

React may create, key, size, and discard the host. React may not render line
children into it.

The projector may create, update, append, reorder, and remove row children. The
projector may not mutate any node outside the host.

### Projection Lifecycle

The projector has one public surface:

```ts
type CodeProjectionInput = {
  rowHost: HTMLPreElement
  viewport: HTMLDivElement
  textLines: readonly string[]
  lineHeight: number
  gutterWidth: string
  highlightRange: TextLineRange | null
  syntax: CodeSyntax
}

type CodeProjector = {
  project(input: CodeProjectionInput): void
  reset(identity: CodeProjectionIdentity): void
  destroy(): void
}
```

The projector owns its cache internally. React never touches `rows`, row
elements, render keys, or token spans.

`reset` clears all DOM rows and all row cache state. `destroy` cancels nothing
outside the projector unless the scheduler is moved into it.

### Identity

There are only three identities:

```text
contentIdentity
  content key + retry version + text bounds

layoutIdentity
  line height + gutter width

syntaxIdentity
  language + grammar version
```

No other ad hoc key should exist. If a row changes, it must be explainable by
one of these identities or by the row's own text/highlight state.

### Rendering

There is one live rendering path: imperative projection.

Server rendering may show the skeleton. It must not render React-owned live
rows into the projected host. If a future static snapshot is required for SEO or
copyable no-JS output, it must use a separate keyed snapshot host that the
projector never sees.

## Module Contracts

### `code-viewer.tsx`

Owns:

- public `CodeViewer` export;
- type exports;
- the fact that code projection is client-first.

Does not own:

- resource reads;
- syntax;
- projection;
- row DOM.

The final file should remain nearly as small as it is now.

### `code-viewer-content.tsx`

Owns:

- resolved text;
- `textLines`;
- text bounds;
- retry-aware content identity;
- zoom state;
- toolbar composition;
- `scrollToLineRange`;
- refs passed across boundaries.

Does not own:

- Prism grammar details;
- DOM row creation;
- row cache invalidation internals;
- scroll listener implementation details if a scheduler module exists.

This file should read like a wiring diagram. Every line should describe data
flow between stable parts.

### `code-viewer-syntax.ts`

Owns:

- language detection from `ViewerResource`;
- JSON grammar;
- token flattening;
- per-line token caching;
- the max line length for tokenization.

Exports:

```ts
type CodeSyntax = {
  identity: string
  getLineTokens(line: string): readonly CodeTokenLeaf[] | null
}

type CodeTokenLeaf = {
  text: string
  kind: string
}

function createCodeSyntax(resource: ViewerResource, text: string): CodeSyntax
```

The same concept gets the same name everywhere:

- use `syntax`, not alternating `grammar`, `lineTokens`, and `syntaxKey`;
- use `kind` for token classification, not `type`;
- use `identity` for invalidation, not `key` unless it is a React key.

### `code-viewer-projector.ts`

Owns:

- virtual line calculation;
- row cache;
- row creation;
- row patching;
- row removal;
- host clearing;
- total host height;
- minimal DOM writes.

Exports:

```ts
function createCodeProjector(): CodeProjector
```

The projector must make the illegal state unrepresentable: callers should not
receive row elements or row cache arrays.

Projection should avoid low-value writes:

- do not append a row that is already the last child in the correct order;
- do not rewrite `textContent` if the text did not change;
- do not replace token children if the token render identity did not change;
- do not rewrite style values unless the value changed;
- do not scan unrelated cache entries if visible range movement can be handled
  by previous and next visible bounds.

Keep the algorithm direct. Do not introduce a general reconciler.

### `code-viewer-viewport.tsx`

Owns:

- `ScrollArea`;
- viewport ref attachment;
- row host ref attachment;
- stable dimensions;
- the empty projected host.

It should not know about:

- resources;
- syntax;
- highlights;
- row cache;
- tokenization.

The viewport component should be boring. That is the ideal.

### `code-viewer-projection-scheduler.ts`

Create this module only if it makes `CodeViewerContent` meaningfully simpler.

Owns:

- `requestAnimationFrame` coalescing;
- scroll listener setup;
- resize observer setup;
- cleanup.

Exports:

```ts
function useCodeProjectionScheduler({
  viewportRef,
  project,
}: {
  viewportRef: React.RefObject<HTMLDivElement | null>
  project: () => void
}): void
```

No policy belongs here. It only schedules.

## Naming Standard

Use these exact concept names:

```text
rowHost
viewport
projector
projection
contentIdentity
layoutIdentity
syntax
syntaxIdentity
textLines
visibleLines
lineHeight
gutterWidth
highlightRange
```

Avoid these names in new code:

```text
pre
staticRows
grammar
lineTokens
syntaxKey
renderKey
data
item
node
el
```

Exception: `renderKey` may remain private inside the projector if it is the most
precise name for a row's patch identity. It must not leak across module
boundaries.

## Performance Standard

The ideal viewer is fast because it does less work:

- no React row reconciliation;
- no server/client row swap;
- no repeated tokenization for identical lines within the same text identity;
- no full DOM clear except content identity, syntax identity, or hard layout
  reset;
- no unnecessary row child replacement;
- no scroll-time React state update;
- no scroll-time allocation of large arrays beyond the visible window.

Expected behavior:

- small files render immediately after text resolution;
- large files project only visible rows plus overscan;
- scroll work is coalesced to one animation frame;
- zoom reuses row elements where possible and patches dimensions;
- source changes clear stale rows deterministically.

## Accessibility and UX Standard

The ideal component includes everything needed and nothing decorative:

- toolbar controls remain keyboard reachable;
- zoom controls have accessible names;
- line numbers are selectable only if this is intentional;
- highlighted lines expose the same visual state after scroll and zoom;
- loading skeleton does not flicker into an error state;
- render errors say render, load errors say load;
- download behavior is unchanged across fallback, loaded, and error states.

Do not add feature text, help copy, or visible explanatory UI.

## Test Plan

### Unit Tests

Add focused tests for the new module boundaries:

- `createCodeSyntax` detects JSON from filename and MIME type.
- `createCodeSyntax` skips empty and over-limit lines.
- token cache returns stable tokens for repeated identical lines.
- `createCodeProjector().project()` creates only visible rows.
- projection removes rows that leave the visible range.
- projection does not duplicate rows after repeated calls.
- projection preserves rows across scroll when they remain visible.
- projection resets completely when `contentIdentity` changes.
- projection patches syntax when `syntaxIdentity` changes.
- projection patches highlight state without clearing all rows.

### Integration Tests

Keep the existing regression tests and add:

- inline text never server-renders row children inside the projected host;
- URL text suspends to skeleton, then projects rows;
- JSON renders token spans after suspense;
- zoom changes line transforms without duplicate rows;
- source changes from long to short removes stale rows;
- source changes from JSON to plain text removes stale token spans;
- render exceptions map to `render_failed`;
- resource exceptions remain load/read errors.

### Browser Verification

Verify these routes in the running app:

```text
http://localhost:3100/blocks?selectedPath=workspace%2Fuse-debounced-value.ts
http://localhost:3100/blocks#category-file-system
```

Required observations:

- TypeScript preview renders line-numbered code;
- file-system-light JSON preview renders syntax tokens;
- no `removeChild` or `NotFoundError` appears in console;
- no visible flicker from code to error state;
- switching between JSON, TypeScript, PDF, image, and missing text does not
  leave stale rows;
- zoom, scroll, retry, and download still work.

## Implementation Sequence

1. Extract `code-viewer-syntax.ts`.

   Move JSON grammar, token flattening, token classes, token cache creation, and
   syntax identity into one module. Update names to `syntax`, `kind`, and
   `identity`.

2. Extract `code-viewer-projector.ts`.

   Move row cache, DOM row creation, row patching, row removal, and projection
   into a `createCodeProjector` factory. Make the row cache private.

3. Extract `code-viewer-viewport.tsx`.

   Move the scroll area and empty host JSX. Keep it free of syntax and resource
   concepts.

4. Optionally extract the scheduler.

   Do this only if the resulting `CodeViewerContent` is materially smaller and
   clearer.

5. Compress `CodeViewerContent`.

   It should compose text, syntax, viewport, projector, toolbar, and imperative
   handle. It should not contain DOM projection logic.

6. Tighten DOM writes.

   After the modules are clean, optimize projector writes where the tests can
   prove behavior. Do not optimize before the boundary is exact.

7. Regenerate registry artifacts for affected items.

   Use targeted registry builds only:

   ```bash
   pnpm registry:build:items code-viewer text-viewer file-viewer file-system
   ```

## Non-Goals

- Do not replace imperative projection with React-rendered rows.
- Do not rewrite `FileViewer`.
- Do not change file-system selection behavior.
- Do not add server-rendered rows inside the projected host.
- Do not add compatibility shims for the old mixed-ownership behavior.
- Do not introduce a generic virtual DOM reconciler.
- Do not expand language support unless it falls out of the syntax boundary
  without changing the public API.

## Acceptance Criteria

The component reaches this blueprint when:

- `code-viewer-content.tsx` no longer contains Prism grammar, row cache, DOM row
  creation, or row patching;
- the projector has a single public factory and private cache;
- the syntax module has one naming system for language, tokens, and identity;
- the viewport renders the empty row host and nothing else below it;
- row projection tests prove no duplicate rows, no stale rows, and correct
  reset behavior;
- integration tests prove inline, URL, JSON, zoom, retry, and source-change
  behavior;
- browser verification passes on both file-system demos;
- targeted registry artifacts are regenerated;
- no module contains a compatibility branch for the old architecture.

## Final Judgment

The terminal ideal is not the largest possible component. It is the smallest
complete one.

Every boundary exists because it prevents a real class of mistake. Every name
is stable because the concept is stable. Every row is written by exactly one
owner. Every render path has one reason to exist. Nothing apologizes for an old
design.
