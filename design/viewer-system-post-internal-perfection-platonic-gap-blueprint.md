# Viewer System Post-Internal-Perfection Platonic Gap Blueprint

## Purpose

This blueprint records the remaining distance between the current viewer system
and the platonic ideal after the internal-perfection implementation pass.

The previous pass completed important work:

- Edit now has a public entrypoint, provider, same-folder store, anatomy, and
  pure views.
- PDF no longer uses header-control naming.
- `PdfDocumentViewportControls` lives in the neutral PDF type module.
- registry output is regenerated and teaches the same source shape.
- architecture tests now guard the new source boundaries.

That work makes the system good.

It does not make the system perfect.

The standard remains:

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

## Verdict

We have reached a coherent viewer architecture.

We have not reached the platonic ideal.

The remaining imperfections are smaller and more exact than before. They are not
about inventing a new abstraction. They are about removing the last pieces of
visible plumbing and making the source so obvious that the architecture can be
read from file names alone.

Current best statement:

```txt
The system is structurally right.
The system is not yet formally beautiful.
```

## Non-Goals

Do not touch file-system implementation.

Do not add:

- a new generic viewer;
- a new file viewer;
- another provider layer by default;
- a slot object API;
- render-prop anatomy;
- compatibility aliases;
- legacy adapters;
- public broad context hooks.

Do not chase abstraction symmetry for its own sake.

The next work should be subtraction and exact naming, not expansion.

## Current Strong Shape

The following decisions are now worth protecting:

```txt
ViewerRoot             shared layout and sidebar state primitive
ViewerHeader           shared header region
ViewerBody             shared body region
ViewerSidebar          shared sidebar region
ViewerSurface          shared primary surface region
ViewerSidebarTrigger   trigger usable anywhere under ViewerRoot
FileViewer             leaf file renderer
PdfViewer              composed PDF experience
EditViewer             composed edit experience
SegmentedDocument      document annotation/navigation engine
```

The right conceptual center is still:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The right composition rule is still:

```txt
domain viewer = domain model adapter + viewer primitives + leaf renderer
```

The right public hook rule is still:

```txt
only expose hooks for real external composition seams
```

## Remaining Gap 1: PDF Still Exposes A Plumbing Prop

### Current Shape

`PdfResourceContent` exposes:

```ts
setViewportControls?: (
  controls: PdfDocumentViewportControls | null
) => void
```

This is better than the old shape:

```ts
setHeaderControls?: (controls: PdfViewerHeaderControls | null) => void
```

But it is still visibly a setter prop used for first-party coordination between
`PdfViewerPages` and `PdfViewerHeader`.

The name is now accurate.

The existence of the prop is still not ideal.

### Why It Is Imperfect

`PdfResourceContent` is a useful lower-level exported component. A user reading
its props sees an implementation transport for the composed PDF viewer:

```txt
content computes controls
content reports controls upward
provider stores controls
header reads controls downward
```

That is a legitimate React pattern.

It is not the platonic ideal because the prop is not primarily user-facing. It
exists because first-party PDF parts are split.

### Ideal Direction

The ideal is a private registered document viewport handle:

```ts
type PdfDocumentViewportHandle = {
  currentPage: number
  pageCount: number
  scale: number
  downloadAction: ViewerResource["originalDownload"]
  fitWidth: () => void
  rotate: () => void
  zoomIn: () => void
  zoomOut: () => void
  scrollToPage: (pageNumber: number, options?: ScrollToOptions) => void
  scrollToPageArea: (
    target: PdfPageAreaTarget,
    options?: ScrollToOptions
  ) => void
}
```

Then `PdfViewerPages` registers the handle with the provider, and
`PdfViewerHeader` consumes the current viewport state.

The public lower-level rendering component should not need to advertise a
setter-shaped first-party bridge.

### Acceptable Intermediate Shape

If we keep a callback, make it read as an observation hook:

```ts
onViewportControlsChange?: (
  controls: PdfDocumentViewportControls | null
) => void
```

That is less setter-like and more public-API honest.

But the perfect shape is no public-ish transport prop at all.

### Completion Criteria

- `PdfResourceContentProps` no longer contains `setViewportControls`.
- either no viewport transport prop exists, or it is named
  `onViewportControlsChange`.
- no first-party module imports a transport type from a consumer module.
- `PdfViewerHeader` still works detached from `PdfViewerPages`.
- `PdfViewer` easy API remains unchanged.
- `FileViewer` can still render PDFs through `PdfResourceContent`.

## Remaining Gap 2: PDF Context Combines High-Frequency And Low-Frequency State

### Current Shape

`PdfViewerProvider` stores one context value containing:

```txt
resource
currentPage
viewportControls
viewerHandle
setCurrentPage
setViewportControls
setViewerHandle
```

This is simple.

It may also be overly broad.

### Why It Is Imperfect

PDF page changes can be high-frequency during scroll.

The resource is stable and low-frequency.

The viewer handle is stable except mount/unmount.

The viewport controls change on page, zoom, rotate, and document changes.

Putting all of this in one context is readable, but not formally ideal if
consumers do not all need the same update cadence.

### Ideal Direction

Do not split context speculatively.

First prove whether the broad context creates meaningful rerenders.

If it does, split by cadence:

```txt
PdfDocumentResourceContext
  resource

PdfDocumentViewportContext
  currentPage
  viewportControls
  viewerHandle
  navigation actions
```

or keep one context and memoize consumers if measurements show no problem.

### Completion Criteria

- a render-count test or React Profiler note proves current behavior is fine; or
- context is split only where measured churn exists;
- `PdfViewerThumbnails` does not remount on zoom;
- `PdfViewerHeader` updates on page/zoom without rebuilding resource objects;
- no extra provider exists without a measured reason.

## Remaining Gap 3: Edit Store Is Private By Entrypoint, But Visible In Copy Code

### Current Shape

Edit has:

```txt
edit-viewer.tsx          public map
edit-viewer-provider.tsx state/model bridge and narrow hooks
edit-viewer-store.tsx    same-folder context carrier
edit-viewer-anatomy.tsx  context-bound public anatomy
edit-viewer-*.tsx        pure views
```

This is the right source split.

The public entrypoint does not export:

```txt
EditStore
EditStoreProvider
useEditStore
```

That is good.

### Why It Is Imperfect

In a shadcn-style registry, users copy source files. Same-folder exports are not
truly private. They are not public API, but they are visible and importable.

`useEditStore` is therefore a practical internal seam, not a formal private
seam.

This may be acceptable.

It is not perfect.

### Possible Ideal Direction

Rename the store around the provider implementation rather than the viewer:

```txt
edit-viewer-state.tsx
  EditViewerStateProvider
  useEditViewerState
```

But that risks sounding public.

Another option is to keep the current shape and rely on tests/docs:

```txt
public entrypoint never exports it
docs never teach it
examples never import it
architecture tests assert those facts
```

The question is taste:

```txt
Is "store" clearer as internal implementation,
or does "state" sound more like a public hook?
```

Current answer:

```txt
EditStore is acceptable.
It is not platonic.
```

### Completion Criteria

- decide explicitly whether same-folder store visibility is acceptable in this
  component library;
- if accepted, document the boundary in tests and registry docs;
- if rejected, collapse the store back into provider or rename it without
  creating public-seeming hooks;
- never export `useEditStore` from `edit-viewer.tsx`;
- never teach `useEditStore` in docs or examples.

## Remaining Gap 4: Edit Public Anatomy May Still Be Slightly Too Broad

### Current Shape

The public edit anatomy is:

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

This is coherent.

### Why It May Be Imperfect

`EditViewerHeader` is useful for composition.

`EditViewerDocument` is useful for composition.

`EditViewerFields` is useful for composition.

The hooks are useful if a user wants to build custom document or fields parts.

But there is a subtle risk:

```txt
component anatomy + hooks for the same anatomy may be duplicate power
```

The public API may contain both:

```tsx
<EditViewerFields />
```

and:

```ts
const fields = useEditViewerFields()
```

This is justified only if custom fields surfaces are a real need.

### Ideal Direction

Keep the hooks only if there is a clear external customization use case.

If the only consumers are first-party anatomy, hooks should become same-folder
implementation details.

The test is simple:

```txt
Can a user build a materially different but valid edit viewer with the hook?
```

If yes, keep it.

If no, remove it from the public entrypoint.

### Completion Criteria

- each public edit hook has a documented external composition use;
- no hook exists only because first-party anatomy is split;
- docs show component anatomy first, hooks only as advanced composition;
- `useEditViewerDocument` and `useEditViewerFields` remain narrow if kept.

## Remaining Gap 5: Architecture Tests Still Use Too Many Raw String Checks

### Current Shape

The architecture test is valuable. It catches regressions around:

- public hooks;
- context exports;
- removed shell concepts;
- registry files;
- composed-viewer structure.

It also still uses many direct string assertions.

### Why It Is Imperfect

String checks are appropriate for deleted concept names:

```ts
expect(content).not.toContain("ViewerShell")
```

They are weaker for public API shape:

```ts
expect(content).toContain("EditViewerHeader")
```

They can accidentally preserve local implementation details.

### Ideal Direction

Use AST helpers for contracts:

```txt
exported functions
exported types
exported consts
import specifiers
JSX tag order
registry file paths
```

Use raw strings only for:

```txt
deleted names
deprecated concepts
docs copy
registry artifact names
data-slot names
```

### Completion Criteria

- public export checks use AST helpers;
- import-boundary checks use import specifier resolution;
- JSX composition checks use existing JSX tag helpers;
- raw string checks remain only where the exact string is the contract;
- tests do not force private helper names.

## Remaining Gap 6: Registry Privacy Is A Social Contract, Not A Type Boundary

### Current Shape

The registry includes implementation files because shadcn code is copied:

```txt
edit-viewer-store.tsx
edit-viewer-anatomy.tsx
edit-viewer-provider.tsx
pdf-viewer-context.tsx
pdf-viewer-content.tsx
```

This is correct for a registry distribution.

### Why It Is Imperfect

All files in a registry item are visible. A user can import from any of them.

So privacy is established by:

```txt
entrypoint exports
docs
examples
tests
names
```

not by package boundaries.

That is the shadcn tradeoff.

### Ideal Direction

Make internal modules feel boring and unattractive to import directly.

Avoid names that look like public primitives:

```txt
useEditStore          acceptable but tempting
useEditViewerState    too public-sounding
useInternalEditViewer forbidden because "internal" leaks migration taste
```

The entrypoint should be the obvious import path.

### Completion Criteria

- docs consistently import from public entrypoints;
- examples consistently import from public entrypoints;
- internal files have names by responsibility, not public product names;
- architecture tests reject docs/examples importing internal store modules;
- registry manifests include internals only because the public entrypoint needs
  them.

## Remaining Gap 7: Performance Is Assumed More Than Proven

### Current Shape

The code uses `React.useMemo`, `React.useCallback`, resource memoization, and
virtualization.

Tests prove behavior.

They do not fully prove render shape.

### Why It Is Imperfect

The platonic ideal includes speed.

Speed means:

```txt
runtime performance
render performance
reader comprehension
feedback loop speed
```

The system has strong runtime foundations, but some high-frequency paths are not
measured:

- PDF scroll page updates;
- PDF zoom/rotate viewport controls;
- thumbnail rail follow behavior;
- edit field hover/preview;
- edit field search/filter;
- segmented document selection propagation.

### Ideal Direction

Add render-count tests only for high-risk paths:

```txt
PDF scroll updates header/current page without remounting pages/thumbnails
PDF zoom updates pages/header without recreating resource
Edit hover updates overlays/field highlight without rebuilding field model
Edit search rebuilds field projection but not document resources
```

Do not add broad profiler infrastructure unless a concrete churn risk appears.

### Completion Criteria

- at least one render-count test covers PDF detached header plus thumbnails;
- at least one render-count test covers edit hover/search separation;
- no new memo wrapper is added without measured value;
- resource objects stay stable across high-frequency UI state.

## The Next Ideal Pass

The next pass should not be large.

It should be a precision pass with this order:

1. Audit `PdfResourceContentProps`.
2. Decide whether `setViewportControls` should become
   `onViewportControlsChange` or disappear behind a registered viewport handle.
3. Measure PDF context churn before splitting context.
4. Decide whether `useEditViewerDocument` and `useEditViewerFields` are truly
   public composition seams.
5. Tighten docs/examples so only public entrypoint imports are taught.
6. Replace fragile architecture string checks with AST/export helpers where the
   exact string is not the contract.
7. Add minimal render-count tests for PDF and Edit high-frequency paths.

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
rg -n "setViewportControls|onViewportControlsChange|PdfDocumentViewportControls" \
  registry/new-york-v4/ui components/ui public/r tests

rg -n "useEditStore|EditStoreProvider|EditStore" \
  components/viewers/edit content registry/new-york-v4/blocks public/r tests

rg -n "usePdfViewerHeaderState|usePdfViewerPagesState|usePdfViewerHeaderControlSetter|PdfViewerHeaderControls|setHeaderControls|headerControls" \
  components registry/new-york-v4 public/r tests
```

Expected shape:

- old PDF header-control names appear only in negative tests;
- `useEditStore` appears only in edit implementation files and generated
  registry internals, never docs/examples/public entrypoint;
- if `setViewportControls` remains, the decision is explicit and justified;
- no public broad viewer hooks are introduced.

## Final Acceptance Criteria

The viewer system reaches the platonic ideal only when:

- `ViewerRoot` remains the only layout/sidebar primitive center;
- `FileViewer` remains the leaf file renderer;
- composed viewers are thin domain compositions;
- PDF detached header support has no public-ish setter plumbing;
- Edit same-folder store visibility is either accepted as a shadcn tradeoff or
  eliminated;
- every public hook has a real external composition use;
- high-frequency render paths are measured or otherwise proven scoped;
- registry files teach exactly the intended import paths;
- architecture tests prove public contracts without freezing private helper
  details;
- no name exists only because of migration history.

## Taste Test

A reader should be able to inspect the system and say:

```txt
viewer.tsx is the spatial grammar.
file-viewer.tsx renders a resolved file.
pdf-viewer.tsx exports the PDF experience.
pdf-viewer-content.tsx renders the PDF document.
pdf-viewer-context.tsx coordinates named PDF parts.
edit-viewer.tsx is the public edit map.
edit-viewer-provider.tsx owns edit state and domain bridges.
edit-viewer-anatomy.tsx binds edit state to viewer anatomy.
edit-viewer-store.tsx is same-folder implementation state.
edit-viewer-header/document/fields are pure views.
segmented-document-provider.tsx owns document annotations and navigation.
```

If that explanation needs caveats about legacy, compatibility, or accidental
plumbing, the system is not perfect.

The remaining work is not to make the system more powerful.

The remaining work is to make it harder to misunderstand.
