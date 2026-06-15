# Viewer System Final Internal Perfection Blueprint

## Purpose

This blueprint describes the remaining distance between the current viewer system
and the platonic ideal.

The last pass fixed the important public-surface problems:

- PDF no longer exports first-party header/pages selector hooks.
- Edit no longer exports frame/chrome selector hooks.
- generated registry output no longer ships the removed selector names.
- `components/ui/pdf-viewer.tsx` is a pure re-export.
- architecture tests now guard the public boundary instead of preserving the old
  exported hooks.

That is a good design.

It is not yet the platonic ideal.

The remaining work is not conceptual expansion. It is internal compression:

```txt
same public API
fewer internal roles per file
sharper names
less private plumbing
tests that prove taste without fossilizing implementation
```

## Standard

The target remains:

```txt
Simplicity
Speed
Everything needed
Nothing more
Perfect modularization
High-entropy code
Perfectly consistent variable names
Flaubertian precision
shadcn-grade taste
```

The next pass should make the implementation feel obvious after reading it.

If a maintainer has to ask why one module owns six different responsibilities,
the system is not perfect.

## Current Verdict

The public model is now close to ideal.

The internal model is not.

Current strong points:

- `ViewerRoot` is the shared layout and sidebar state primitive.
- `FileViewer` remains the file renderer.
- `PdfViewer` exposes clean named PDF parts.
- `EditViewer` exposes clean named edit parts.
- `SegmentedDocumentProvider` remains the document annotation/navigation engine.
- raw context exports and broad composed-viewer hooks are gone from the relevant
  public surface.

Current remaining weaknesses:

- `components/viewers/edit/edit-viewer-provider.tsx` is too dense.
- `registry/new-york-v4/ui/pdf-viewer-context.tsx` and
  `registry/new-york-v4/ui/pdf-viewer-content.tsx` still communicate through a
  header-control setter bridge.
- some names describe implementation mechanics instead of durable concepts.
- some architecture tests still use string searching where a source-level export
  inspection would be more exact.

## Non-Goals

Do not touch file-system source.

Do not add:

- a new generic viewer;
- a new shell;
- a new slot object API;
- a render prop API;
- public internal hooks;
- compatibility aliases;
- legacy shims;
- another provider just to move code around.

Do not broaden the public surface to solve internal discomfort.

The public API should stay boring.

## 1. Edit: Provider File Is Too Dense

### Current Shape

`components/viewers/edit/edit-viewer-provider.tsx` currently owns all of this:

```txt
provider props
public provider state types
private context type
public document hook
public fields hook
private frame state
private chrome state
easy EditViewer component
private EditViewerRoot
context-bound EditViewerHeader
context-bound EditViewerDocument
context-bound EditViewerFields
busy/empty wrappers
mode state
selection bridge
page overlay bridge
resolved provider
```

This is clean from the outside but crowded on the inside.

The file has become a pressure container for avoiding public hook leaks. That was
the right hard cut. It is not the final beautiful shape.

### Problem

The file now mixes four layers:

```txt
state kernel
composition shell
public named anatomy
private view adapters
```

Those layers are coherent, but they are not the same responsibility.

The file is fast enough at runtime. It is slower than ideal for human parsing.

### Target

Keep the public surface exactly this:

```ts
EditViewer
EditViewerProvider
EditViewerHeader
EditViewerDocument
EditViewerFields
EditViewerToolbar
useEditViewerDocument
useEditViewerFields
```

Do not export:

```ts
EditViewerRoot
useEditFrameState
useEditChromeState
useEditViewerContext
EditViewerContextValue
```

But split the source so each file has one role.

### Preferred Source Shape

```txt
edit-viewer-provider.tsx
  owns context, provider, public narrow hooks

edit-viewer-anatomy.tsx
  owns context-bound public anatomy
  imports a private accessor from provider only if it is not exported from the
  package entrypoint

edit-viewer.tsx
  owns the public entrypoint re-exports
  exports EditViewer easy API

edit-viewer-document.tsx
edit-viewer-fields.tsx
edit-viewer-header.tsx
  pure view components only
```

The hard part is the private accessor.

Do not solve it by exporting `useEditViewerContext`.

Two acceptable shapes:

### Option A: Private Same-Folder Module

Create a private, non-registry-public module:

```txt
edit-viewer-context.tsx
  const EditViewerContext
  function useEditViewerContext()
```

Then `edit-viewer-provider.tsx` and `edit-viewer-anatomy.tsx` can import it.

This is acceptable only if:

- the module is not exported from `edit-viewer.tsx`;
- registry output does not teach it as a public import;
- architecture tests assert no public export of the context or broad hook;
- the filename does not include `internal` as a public-looking concept.

### Option B: Keep Co-location

Keep the provider file as the owner, but reorganize it into clear sections:

```txt
public types
private context
public hooks
public anatomy
provider implementation
private state builders
private bridges
```

This avoids extra modules but does not reach perfect modularization.

Option A is more platonic if done without creating a public seam.

### Acceptance Criteria

- `EditViewerProvider` remains the only provider.
- `EditViewerRoot` is private.
- `EditViewerHeader`, `EditViewerDocument`, and `EditViewerFields` remain public
  named parts.
- only `useEditViewerDocument` and `useEditViewerFields` are public hooks.
- no file exports `EditViewerContext`, `EditViewerContextValue`, or
  `useEditViewerContext`.
- pure view files do not import provider hooks.
- the easy `EditViewer` remains the single one-line composition a user expects.

## 2. PDF: Header Controls Bridge Is Functional But Not Inevitable

### Current Shape

PDF is split into:

```txt
pdf-viewer.tsx
  public easy API and public exports

pdf-viewer-context.tsx
  provider, header, pages, thumbnails hook

pdf-viewer-content.tsx
  resource rendering, page virtualization, scroll, toolbar control production
```

`PdfResourceContent` accepts:

```ts
setHeaderControls?: (controls: PdfViewerHeaderControls | null) => void
```

That lets the rendering engine report toolbar state up to the provider, so
`PdfViewerHeader` can render a detached header.

This works.

It is still a little mechanical.

### Problem

`PdfViewerHeaderControls` is not a domain concept. It is a transport shape
between two first-party modules.

The public API is clean, but the internal API says:

```txt
content renders pages
content computes controls
content sends controls up
header reads controls down
```

That is a legitimate React pattern. It is not obviously inevitable.

### Target

The PDF implementation should communicate one durable concept:

```txt
one PDF document viewport state
```

Not:

```txt
header controls
control setter
header state
pages state
```

### Possible Better Shape

Move the shared document runtime state into one private model:

```ts
type PdfDocumentViewport = {
  currentPage: number
  pageCount: number
  scale: number
  downloadAction: ViewerResource["originalDownload"]
  zoomIn: () => void
  zoomOut: () => void
  fitWidth: () => void
  rotate: () => void
  scrollToPage: (page: number) => void
}
```

Then `PdfViewerHeader` and `PdfViewerPages` consume the same named viewport
state.

Important: this should not become a public hook unless there is a real external
composition need.

### Alternative: Keep Current Bridge But Rename It

If the bridge stays, rename it toward the durable thing:

```txt
PdfViewerHeaderControls -> PdfDocumentViewportControls
setHeaderControls -> setViewportControls
headerControls -> viewportControls
```

This is less ideal than eliminating the bridge, but the language becomes more
accurate.

### Acceptance Criteria

- no public `usePdfViewerHeaderState`;
- no public `usePdfViewerPagesState`;
- no public `usePdfViewerHeaderControlSetter`;
- `PdfViewerHeaderControls` either disappears or is renamed away from header
  ownership;
- `PdfResourceContent` remains usable by `FileViewer`;
- `PdfViewerHeader` remains a named part;
- `PdfViewerPages` remains a named part;
- `PdfViewerThumbnails` remains the only public optional PDF state hook.

## 3. Public Entry Files Should Be Pure Maps

### Current Good Shape

This is good:

```ts
export * from "@/registry/new-york-v4/ui/pdf-viewer"
```

`components/ui/pdf-viewer.tsx` and `components/ui/pdf-viewer-content.tsx` are
now pure re-exports.

### Remaining Question

For composed viewers under `components/viewers`, the entrypoint files should
also read like public maps when possible.

`components/viewers/edit/edit-viewer.tsx` is now close:

```txt
public re-exports only
```

This is good.

The next question is whether every composed viewer entrypoint follows the same
principle:

```txt
entrypoint = public surface
provider/model/anatomy = implementation
```

### Target

For each composed viewer:

```txt
*-viewer.tsx should be either:
  complete easy API implementation, if small;
  or a public map, if the viewer has multiple modules.
```

It should not be a half-entrypoint, half-state-kernel, half-layout file.

### Acceptance Criteria

- each composed viewer has an obvious public entrypoint;
- public entrypoints do not export private helpers;
- source modules are named by responsibility, not by temporary migration state;
- no `internal-*` filename appears in public registry output.

## 4. Names Need One Final Precision Pass

### Good Names

These names are durable:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
ViewerSidebarTrigger
FileViewer
PdfViewer
PdfViewerHeader
PdfViewerPages
PdfViewerThumbnails
EditViewer
EditViewerDocument
EditViewerFields
SegmentedDocumentProvider
DocumentSegment
SegmentAnchor
```

### Suspicious Names

These names are not public leaks anymore, but they still reveal implementation
mechanics:

```txt
EditFrameState
EditChromeState
PdfHeaderViewState
PdfPagesViewState
PdfViewerHeaderControls
setHeaderControls
headerControls
```

They are acceptable privately. They are not Flaubertian.

### Target

Names should describe what the thing is in the domain, not which component
currently consumes it.

Prefer:

```txt
document
viewport
fields
selection
mode
status
controls
surface
```

Be suspicious of:

```txt
chrome
frame
header state
pages state
setter
view state
```

### Acceptance Criteria

- same concept has the same noun everywhere;
- different concepts do not share a vague noun;
- no public type is named after an implementation workaround;
- private names are still precise enough that comments are rarely needed.

## 5. Tests Should Ratchet Architecture Without Becoming Architecture

### Current State

`tests/viewer-architecture.test.ts` is valuable.

It catches:

- exported context leaks;
- old selector names;
- removed shell/slot/anchored concepts;
- registry output regressions;
- broad public hooks.

But some assertions still inspect strings in a way that can make the test itself
feel like the architecture.

### Target

Architecture tests should prove:

```txt
public export surface
registry manifest shape
removed files absent
runtime compositions render
forbidden concepts absent from shipped source
```

They should not require:

```txt
private helper name
private function location
exact local implementation order
incidental string in a source file
```

### Better Test Helpers

Use AST helpers for:

```txt
exported function names
exported type names
exported const names
import specifiers
JSX element order
registry file paths
```

Use raw string checks only for:

```txt
deleted concept names
deprecated public names
registry artifact names
data-slot names
explicit user-facing docs
```

### Acceptance Criteria

- forbidden public names are tested through export inspection when possible;
- private names are tested only when the name is itself the contract;
- tests mention old names only as negative assertions;
- tests do not force the PDF/Edit implementation back into worse file shapes;
- generated registry output is tested as output, not assumed from source.

## 6. Performance And Render Shape Audit

### Current Risk

The refactor improves boundaries but does not yet prove render performance.

The places worth auditing:

- `EditViewerProvider` memo boundaries;
- `useEditViewerFields()` object spreading;
- `PdfViewerProvider` header control updates;
- `PdfResourceContent` effect that reports controls upward;
- thumbnail synchronization with PDF page state;
- `SegmentedDocumentProvider` consumers in split/partition/sources/edit.

### Target

No visible interaction should trigger unrelated expensive rerenders.

Examples:

- hovering an edit field should not rebuild the whole document model;
- scrolling a PDF should update current page without forcing unrelated sidebar
  content to remount;
- changing PDF zoom should not reset thumbnails;
- field search should not rebuild source document resources.

### Verification

Use targeted React Profiler or render-count tests only where there is evidence of
churn.

Do not add speculative memo wrappers everywhere.

### Acceptance Criteria

- no avoidable document-resource recreation;
- provider values are memoized around durable state;
- high-frequency scroll/page updates stay scoped;
- no new context value combines unrelated high-frequency and low-frequency state
  unless consumers are intentionally shared.

## 7. Registry Source Rule Must Stay Sharp

### Current Rule

Every viewer file should be one of:

```txt
source file
thin re-export
generated artifact
```

This rule is now visible in PDF.

### Target

Make this rule boring across the viewer system.

Examples:

```txt
registry/new-york-v4/ui/foo.tsx      source
components/ui/foo.tsx                pure re-export
public/r/foo.json                    generated artifact
```

or:

```txt
components/viewers/foo/foo-viewer.tsx source entrypoint
public/r/foo-block.json              generated artifact
```

No file should make the reader wonder whether it is canonical.

### Acceptance Criteria

- pure re-export files contain exactly one export line;
- source files contain implementation;
- generated files are never hand-edited;
- registry manifests include every source file needed by generated artifacts;
- architecture tests enforce this for core viewer primitives.

## Implementation Order

1. Audit `edit-viewer-provider.tsx` for separable responsibilities.
2. Decide whether to introduce a private same-folder context owner for Edit.
3. If yes, split Edit into context/provider/anatomy without adding public hooks.
4. Audit PDF header-control bridge and either remove it or rename it toward
   viewport language.
5. Replace remaining string-ratchet tests with export/import/JSX helper checks
   where feasible.
6. Run a small render/performance audit only on high-frequency state paths.
7. Rebuild registry output.
8. Run the full targeted viewer verification.

## Verification

Run:

```bash
pnpm registry:build
pnpm exec tsc --noEmit --pretty false
pnpm exec vitest run tests/viewer-architecture.test.ts --reporter=dot
pnpm exec vitest run tests/pdf-viewer.test.tsx tests/edit-viewer-model.test.ts tests/edit-viewer-render.test.tsx --reporter=dot
pnpm exec vitest run tests/page-markdown-render.test.tsx tests/parse-viewer.test.tsx tests/parse-viewer-adapter.test.tsx --reporter=dot
pnpm exec vitest run tests/sources.test.tsx tests/layout-blocks-document-ai.test.ts --reporter=dot
```

Run searches:

```bash
rg -n "export const .*Context|export type .*ContextValue|export interface .*ContextValue" \
  components/viewers registry/new-york-v4/ui registry/new-york-v4/blocks components/ui

rg -n "usePdfViewerHeaderState|usePdfViewerPagesState|usePdfViewerHeaderControlSetter|useEditViewerFrameState|useEditViewerChromeState" \
  components registry/new-york-v4 public/r tests

rg -n "ViewerShell|SegmentedViewer|renderDocument|slots\\?:|slots=\\{|anchored-evidence|AnchoredDocumentProvider|anchored-document-viewer|pdf-anchor-target|anchoredItems" \
  components registry/new-york-v4 public/r content/docs tests
```

Expected search shape:

- raw context exports only in approved primitives or file-system;
- old selector names only in negative tests;
- removed shell/slot/anchored names only in negative tests or superseded design
  documents;
- generated registry output contains no removed public concepts.

## Final Acceptance Criteria

The viewer system reaches the internal platonic ideal when:

- public APIs are unchanged and boring;
- Edit provider code no longer feels like a catch-all file;
- PDF detached header composition no longer needs header-named plumbing;
- private context remains private without concentrating all anatomy in one
  oversized module;
- tests prove boundaries without freezing private helper names;
- registry source/re-export/generated rules are uniform;
- no implementation name exists only to describe a past workaround.

## Final Taste Test

A reader should be able to open the files and predict the architecture from the
names alone:

```txt
viewer = spatial grammar
file viewer = file rendering
pdf viewer = PDF provider and named PDF parts
pdf content = PDF document rendering
edit provider = edit state
edit anatomy = context-bound edit parts
edit views = pure UI
segmented document = annotation/navigation engine
```

If the reader must remember migration history to understand why a name exists,
the system is not done.

The ideal is not more powerful than the current system.

It is smaller, sharper, and harder to misunderstand.
