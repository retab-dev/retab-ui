# Code Viewer DOM Ownership Platonic Blueprint

## Problem

The file-system and file-system-light demos expose the same failure:

```text
NotFoundError: Failed to execute 'removeChild' on 'Node':
The node to be removed is not a child of this node.
```

The visible symptom is a text preview that flickers and then falls into the
generic text error state:

```text
Couldn't load this text file.
```

The samples are present. The file-system shells are not the root cause. They
only route selected `.ts` and `.json` files through the shared `FileViewer` text
path:

```text
FileSystemPreview / FileSystemLight
  -> FileViewer
  -> CodeViewer
  -> CodeViewerContent
```

The defect is a DOM ownership violation inside `CodeViewerContent`.

## Root Cause

`CodeViewerContent` currently lets React and an imperative virtualizer both own
the same `<pre>` children.

The sequence is:

1. The first client render still has `isClient === false`.
2. `CodeViewerContent` renders static React-owned `<span>` rows into `<pre>`.
3. `useLayoutEffect` runs `projectRows()`.
4. `projectRows()` calls `pre.replaceChildren()` and appends imperative rows.
5. `useIsClient()` flips to true and React reconciles away the old static rows.
6. React tries to remove `<span>` nodes that the projector already removed.
7. The `ViewerErrorBoundary` catches the DOM exception and reports a text load
   error.

This is not a fetch problem, a route problem, a Next.js problem, or a
file-system selection problem. It is a single ownership bug: React believes it
owns nodes that imperative code has already destroyed.

## Platonic Ideal

The ideal code viewer has one clear rule:

**A DOM subtree has exactly one owner for its entire lifetime.**

React may own shells, toolbar, scroll containers, fallback states, accessibility
metadata, and component lifecycle. The imperative projector may own the virtual
row layer. They must never co-own row nodes.

The result should be:

- no hydration crash;
- no flicker from static rows being replaced after mount;
- no generic error state for internal render failures;
- fast rendering for large files;
- deterministic rendering for small files;
- one code path for inline text and URL text after content resolves;
- no duplicated row grammar between SSR and client projection;
- no compatibility shim that preserves the broken mixed-ownership behavior.

## Target Architecture

`CodeViewerContent` should split into three small responsibilities:

```text
CodeViewerContent
  reads text, owns viewer state, toolbar, refs, and scroll APIs

CodeViewerViewport
  owns scroll area, sizing, and the row host element

CodeViewerProjection
  owns all row DOM below the row host, imperatively
```

The critical boundary:

```tsx
<pre ref={rowHostRef} suppressHydrationWarning />
```

React never renders line rows inside this element on the client. The projector
never mutates outside this element.

## Rendering Policy

### Server

URL-backed code sources should server-render the existing skeleton and never
fetch.

Inline text sources have two acceptable final states. Pick one and make it
consistent:

1. Prefer the same skeleton as URL-backed sources for perfect client parity and
   zero mixed ownership.
2. Or server-render a static read-only code snapshot and mount the client
   projector into a different keyed host, so React can discard the snapshot
   without the projector touching it.

The simpler ideal is option 1. It gives one invariant: the projected row host is
empty until the client projector owns it.

### Client

Once text is available, React renders the frame and an empty row host. A layout
effect projects the visible rows into that host. React never renders row
children into the host, even for tiny files.

There should be no `isClient ? null : renderStaticCodeRows(...)` branch inside
the projected row host.

## DOM Ownership Contract

The projector may:

- set row host dimensions;
- append rows to the row host;
- remove rows it created;
- update row text, syntax spans, transforms, and classes;
- clear the row host during content identity changes;
- cancel pending animation frames on unmount.

The projector may not:

- mutate toolbar DOM;
- mutate scroll-area DOM outside the row host;
- remove React-rendered children;
- depend on React-rendered row children being present;
- use stale cached row elements after `textLines`, `lineHeight`, or grammar
  identity changes.

React may:

- render the viewer shell;
- render toolbar controls;
- render loading and error states;
- hold refs to viewport and row host;
- create a new keyed row host when content identity changes.

React may not:

- render row `<span>` children into the imperative row host;
- reconcile any child node that the projector can remove.

## Implementation Plan

1. Remove React-owned static rows from `CodeViewerContent`.

   Delete the `staticRows` branch and the `renderStaticCodeRows` function unless
   it is moved to a separate server-only snapshot component with a distinct
   keyed host. The projected `<pre>` should render no children.

2. Key the projected row host by content identity.

   Use the same identity that already drives text content reset:

   ```text
   contentBaseKey + retryVersion + maxBytes + maxLines
   ```

   The key should reset the row host and projection cache when the source
   changes. It should not reset on scroll.

3. Reset projection cache in one place.

   Replace scattered row clearing with a single cache reset path:

   ```text
   resetCodeProjection(cache, rowHost)
   ```

   It should clear rows, current text identity, line height, and any row
   references. This makes cache invalidation explicit and testable.

4. Keep the row renderer imperative.

   Large-file performance depends on avoiding React reconciliation per visible
   row. Preserve the current virtual row projection model, but make its host
   exclusively imperative.

5. Make error boundaries classify projector crashes as render errors.

   The current text fallback says "Couldn't load this text file" even when the
   fetch succeeded and rendering crashed. After ownership is fixed this should
   be rare, but the boundary should still distinguish:

   ```text
   load/read failure -> Couldn't load this text file.
   render/project failure -> Couldn't render this text file.
   ```

   Do not add a broad catch in the projector. Let genuine render defects fail
   into the viewer boundary with the right domain.

6. Keep file-system components unchanged.

   `FileSystemPreview` and `FileSystemLight` should not special-case text,
   JSON, or TypeScript. Their responsibility ends at selecting a file and
   passing its `ViewerSource` to `FileViewer`.

## Tests

### Regression Unit Tests

Add or restore coverage that fails on the current implementation:

- `CodeViewer` renders inline text with line numbers without a
  `NotFoundError`.
- `CodeViewer` renders URL text after suspense resolves without a
  `NotFoundError`.
- rerendering from inline text to URL fallback clears old text and does not
  leave stale refs.
- rerendering from a large source to a small source drops stale virtual rows.
- changing zoom reprojects rows without duplicate rows or stale transforms.
- JSON token spans render inside imperative rows after projection.

The existing command that currently reproduces the crash is:

```bash
pnpm exec vitest run tests/code-viewer.test.tsx -t "renders inline value with line numbers" --reporter=dot
```

The fixed implementation should pass that test without logging a React
recoverable error.

### Browser Verification

Use the running Next app and verify both routes:

```text
http://localhost:3100/blocks?selectedPath=workspace%2Fuse-debounced-value.ts
http://localhost:3100/blocks#category-file-system
```

Required observations:

- the TypeScript preview renders line-numbered code;
- the JSON preview in file-system-light renders line-numbered code;
- there is no flicker into an error state;
- console contains no `removeChild` / `NotFoundError`;
- selection changes between PDF, image, JSON, and TypeScript do not leave stale
  text rows.

## Non-Goals

- Do not rewrite `FileViewer`.
- Do not change file-system selection semantics.
- Do not replace the virtualizer with full React rendering for all rows.
- Do not add a compatibility path that keeps both static React rows and
  imperative rows in the same host.
- Do not mask the exception by catching and ignoring DOM errors.

## Acceptance Criteria

The work is complete when:

- no React-owned row is ever inserted into the projector host;
- no projector-created row is ever reconciled by React;
- text, JSON, and source-code files render in both file-system demos;
- the current `NotFoundError` regression test passes;
- code-viewer tests covering source changes, zoom changes, URL suspense, and
  syntax tokens pass;
- browser verification shows no flicker and no console error.

## Final Shape

The final component should feel inevitable:

- `FileSystem` selects files.
- `FileViewer` routes formats.
- `CodeViewer` owns text viewer state.
- `CodeViewerViewport` owns layout.
- `CodeViewerProjection` owns row DOM.

No layer reaches across that boundary. No fallback pretends to be a live
projection. No error message lies about a render crash as a load failure. Every
line has one reason to exist.
