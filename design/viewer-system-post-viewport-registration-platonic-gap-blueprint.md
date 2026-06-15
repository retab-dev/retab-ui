# Viewer System Post-Viewport-Registration Platonic Gap Blueprint

## Purpose

This blueprint records the state of the viewer system after the latest
implementation pass:

- `PdfResourceContentProps` no longer exposes `setViewportControls`.
- PDF viewport coordination moved behind same-folder registration context.
- PDF source is split into smaller files.
- Edit has provider, same-folder store, anatomy, and pure view files.
- Architecture tests guard the intended public import surface.
- Render/mount tests cover PDF detached header plus thumbnails, and Edit
  hover/search preserving the mounted document renderer.

The system is now good.

It is not perfect.

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

We have not reached the platonic ideal.

We have reached a design that is coherent enough to protect.

The remaining work is not more architecture. It is subtraction, proof, and
exact naming.

Current best statement:

```txt
The conceptual center is right.
The source still exposes a few implementation mechanics.
```

## Non-Goals

Do not touch file-system implementation.

Do not add:

- another generic viewer;
- another file viewer;
- another default provider;
- compatibility shims;
- slot object APIs;
- render-prop anatomy;
- public broad context hooks;
- speculative context splitting.

Do not chase symmetry.

The next pass should make the existing system harder to misunderstand.

## Protected Shape

The system should continue to read as:

```txt
viewer.tsx
  shared spatial grammar and sidebar state

file-viewer.tsx
  leaf file renderer

pdf-viewer.tsx
  public PDF experience and re-exports

pdf-viewer-content.tsx
  low-level PDF document renderer

pdf-viewer-context.tsx
  PDF named-part coordination

edit-viewer.tsx
  public Edit import map

edit-viewer-provider.tsx
  Edit model/state bridge

edit-viewer-anatomy.tsx
  context-bound Edit named parts

edit-viewer-store.tsx
  same-folder Edit implementation state

segmented-document-provider.tsx
  semantic document segment and navigation engine
```

The right composition remains:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The right domain-viewer rule remains:

```txt
domain viewer = domain model adapter + viewer primitives + leaf renderer
```

## Remaining Gap 1: PDF Viewport Registration Is Still Visible Source Machinery

### Current Shape

PDF now has:

```txt
pdf-viewer-viewport.tsx
  PdfDocumentViewportRegistrationProvider
  usePdfDocumentViewportRegistration
```

This is a significant improvement over a public setter prop.

`PdfResourceContentProps` no longer advertises first-party transport plumbing.

### Why It Is Still Imperfect

In a shadcn-style registry, same-folder implementation files are copied and
visible. So the registration context is not public API, but it is visible API
matter.

The user can still read:

```txt
content computes viewport controls
content registers controls through context
provider stores controls
header reads controls
```

That is honest React.

It is not invisible.

### Ideal Direction

The perfect PDF shape would be one of two things:

```txt
Option A: accept same-folder registration as first-party internal machinery.
Option B: replace it with a document viewport handle owned by PdfViewerPages.
```

Option B may look like:

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
  scrollToPage: PdfViewerHandle["scrollToPage"]
  scrollToPageArea: PdfViewerHandle["scrollToPageArea"]
}
```

But this is not automatically better. If it adds a second concept next to
`PdfViewerHandle`, it is worse.

### Acceptance Test

The current registration file is acceptable only if:

- users never need to import it;
- docs never teach it;
- `PdfResourceContentProps` stays clean;
- naming stays document-specific, not header-specific;
- detached header, thumbnail rail, and `FileViewer` PDF rendering keep working.

## Remaining Gap 2: PDF Context Cadence Is Proven Only Partially

### Current Shape

`PdfViewerProvider` still keeps one context value:

```txt
resource
currentPage
viewportControls
viewerHandle
setCurrentPage
setViewerHandle
```

The latest tests prove:

- detached header updates when zoom changes;
- thumbnail rail does not remount on zoom;
- PDF document resource is not reloaded on zoom.

That is good evidence.

It is not complete evidence.

### Why It Is Still Imperfect

The context combines:

```txt
stable resource state
scroll-frequency current page state
zoom/rotate viewport control state
mounted handle state
```

This may be fine.

But "may be fine" is not platonic.

### Ideal Direction

Do not split context until measurement says it matters.

If measurement exposes churn, split by cadence:

```txt
PdfDocumentResourceContext
  resource

PdfDocumentViewportContext
  currentPage
  viewportControls
  viewerHandle
```

If measurement does not expose churn, keep one context. Fewer providers are
better than theoretical purity.

### Acceptance Test

Add only targeted render tests:

- scroll page changes do not remount pages or thumbnails;
- zoom/rotate do not recreate resource;
- thumbnails follow current page without rebuilding page metrics unnecessarily.

No generic profiler framework.

## Remaining Gap 3: Edit Store Is Clean, But Still Broad

### Current Shape

Edit uses:

```txt
EditStoreProvider
useEditStore
```

inside the edit folder.

Public users import:

```txt
EditViewer
EditViewerProvider
EditViewerHeader
EditViewerDocument
EditViewerFields
```

The public entrypoint does not export `useEditStore`.

### Why It Is Still Imperfect

The store is broad:

```txt
state
mode
fields
selection
document
options
```

This means field search, hover, selection, mode changes, and document state all
share one carrier.

The render test proves the document renderer stays mounted during hover/search.

It does not prove every pure subview avoids unnecessary renders.

### Ideal Direction

Do not split the store by default.

Split only if tests show meaningful churn.

Possible final shape if needed:

```txt
EditDocumentStateContext
EditFieldsStateContext
EditSelectionStateContext
EditChromeStateContext
```

But that is only better if it makes code simpler or materially faster. More
providers are not automatically better.

### Acceptance Test

Keep current store if:

- field search preserves document resources;
- hover preserves document resources;
- field panel updates remain local enough;
- public entrypoint never exports store internals;
- examples and docs never import store internals.

## Remaining Gap 4: Edit Public Hooks Were Extra Power

### Current Shape

Edit exposes component anatomy, not broad hooks:

```txt
EditViewerDocument
EditViewerFields
```

### Why The Cut Is Correct

The former document and fields hooks duplicated the named anatomy without a real
external composition that justified the extra surface.

The component anatomy is clearly useful.

The hooks existed because first-party anatomy was split, not because external
users had a proven need to build materially different valid surfaces.

### Ideal Direction

Teach only named components.

Keep the store hook same-folder private to the Edit implementation.

### Acceptance Test

- public entrypoint exports `EditViewerProvider` and `EditViewerProviderProps`
  from the provider;
- public entrypoint does not export Edit document or fields hooks;
- public entrypoint does not export Edit store state types;
- docs teach composition through named anatomy only.

## Remaining Gap 5: Registry Privacy Is A Social Contract

### Current Shape

The registry must include implementation files:

```txt
pdf-viewer-content.tsx
pdf-viewer-context.tsx
pdf-viewer-viewport.tsx
edit-viewer-store.tsx
edit-viewer-anatomy.tsx
edit-viewer-provider.tsx
```

This is correct for shadcn-style source distribution.

### Why It Is Still Imperfect

Every copied file is importable.

There is no true package-private boundary.

Privacy comes from:

```txt
entrypoint exports
docs
examples
tests
names that do not invite direct use
```

That is acceptable for shadcn.

It is not absolute.

### Ideal Direction

Make the entrypoint overwhelmingly obvious.

Internal names should be boring enough that users do not reach for them.

Avoid names like:

```txt
InternalSomething
PrivateSomething
AdvancedSomething
```

Those names make implementation seams feel like concepts.

Prefer plain responsibility names:

```txt
store
context
content
anatomy
viewport
```

### Acceptance Test

Docs and examples import only from public entrypoints.

Architecture tests should reject:

```txt
edit-viewer-store
useEditStore
EditStoreProvider
pdf-viewer-viewport
PdfDocumentViewportRegistrationProvider
usePdfDocumentViewportRegistration
```

outside implementation files and generated registry payloads.

## Remaining Gap 6: Architecture Tests Still Mix Contracts And Source Taste

### Current Shape

The architecture test is valuable. It now uses an AST helper for exported
functions in one place.

It still has many raw string checks.

### Why It Is Still Imperfect

Raw string checks are good for deleted names:

```ts
expect(content).not.toContain("ViewerShell")
```

They are weaker for export shape and import boundaries.

They can accidentally freeze private implementation names.

### Ideal Direction

Use AST helpers for:

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
deleted concepts
data-slot names
docs copy
registry artifact strings
explicit forbidden legacy names
```

### Acceptance Test

The architecture suite should prove contracts without making private helper
names sacred.

## Remaining Gap 7: Repo-Wide Typecheck Is Not Green

### Current Shape

Viewer-targeted tests pass.

Repo-wide typecheck currently fails on markdown registry files importing missing
type modules:

```txt
unist
unified
```

This is unrelated to the viewer changes.

It still matters.

### Why It Blocks Perfection

The platonic ideal is whole-system coherence.

A component library cannot claim perfection while repo-wide typecheck is red.

Even if the failure is outside the viewer system, it means the system state is
not clean.

### Ideal Direction

Fix the markdown type dependency issue separately and keep it out of viewer
architecture decisions.

Possible options:

```txt
add explicit type/package dependencies
replace direct imports with local minimal structural types
move markdown registry types behind a local type module
```

The right choice belongs to the markdown viewer surface, not to PDF/Edit.

### Acceptance Test

`pnpm exec tsc --noEmit --pretty false` passes from the repo root.

## Final Implementation Sequence

1. Freeze current viewer public API with AST-based architecture tests.
2. Add doc/example import-boundary checks for PDF viewport internals.
3. Decide whether Edit public hooks are real external seams.
4. Add one more PDF scroll render/mount test.
5. Add one more Edit field-panel render-scope test if current store churn is
   suspected.
6. Replace fragile architecture string checks where they assert export shape.
7. Fix the unrelated markdown typecheck failure in a separate markdown pass.

## Verification

Run:

```bash
pnpm registry:build
pnpm exec vitest run tests/viewer-architecture.test.ts --reporter=dot
pnpm exec vitest run tests/pdf-viewer.test.tsx tests/edit-viewer-model.test.ts tests/edit-viewer-render.test.tsx --reporter=dot
pnpm exec vitest run tests/page-markdown-render.test.tsx tests/parse-viewer.test.tsx tests/parse-viewer-adapter.test.tsx --reporter=dot
pnpm exec vitest run tests/sources.test.tsx tests/layout-blocks-document-ai.test.ts --reporter=dot
pnpm exec tsc --noEmit --pretty false
git diff --check
```

Run searches:

```bash
rg -n "setViewportControls|setHeaderControls|headerControls|PdfViewerHeaderControls" \
  components registry public/r tests

rg -n "PdfDocumentViewportRegistrationProvider|usePdfDocumentViewportRegistration|pdf-viewer-viewport" \
  components registry public/r content tests

rg -n "useEditStore|EditStoreProvider|edit-viewer-store" \
  components/viewers/edit content registry/new-york-v4/blocks public/r tests
```

Expected shape:

- old PDF setter/header-control names appear only in negative tests;
- PDF viewport registration appears only in PDF implementation and generated
  registry payloads;
- Edit store appears only in Edit implementation and generated registry
  payloads;
- docs/examples teach public entrypoints only;
- repo-wide typecheck is green.

## Platonic Acceptance Criteria

The viewer system reaches the platonic ideal only when:

- `ViewerRoot` is the only layout/sidebar primitive center;
- `FileViewer` is only the leaf file renderer;
- composed viewers are thin domain compositions;
- PDF detached header support has no public transport prop;
- PDF viewport registration is either accepted as the minimal internal
  mechanism or replaced by a simpler handle model;
- Edit store broadness is measured and either accepted or split by proven
  cadence;
- every public hook has a real external customization use;
- registry internals are present only because copied source needs them;
- docs and examples never import implementation files;
- architecture tests protect public contracts without freezing private taste;
- repo-wide typecheck is green;
- no name exists because of migration history.

## Taste Test

A reader should be able to say:

```txt
Viewer gives me space.
FileViewer renders a file.
PdfViewer composes PDF parts.
EditViewer composes edit parts.
SegmentedDocument coordinates document annotations.
Everything else is implementation detail.
```

If that sentence needs an exception, the system is not yet perfect.
