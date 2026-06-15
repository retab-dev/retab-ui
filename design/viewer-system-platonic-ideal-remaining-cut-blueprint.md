# Viewer System Platonic Ideal Remaining Cut Blueprint

## Purpose

This blueprint records the honest post-implementation judgment of the viewer
system.

The question is not:

```txt
Is the system better?
```

It is:

```txt
Has the system reached the platonic ideal?
```

Platonic ideal means:

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

No.

The viewer system has reached a good design.

It has not reached perfection.

The conceptual direction is now correct:

```txt
Viewer primitives own spatial layout.
Domain providers own domain state.
Leaf viewers render files.
Segmented document owns semantic document navigation.
Named parts compose the experience.
Public hooks exist only for real external composition seams.
```

The remaining work is not another conceptual rewrite.

The remaining work is subtraction, compression, and proof.

## Non-Goals

Do not touch the file-system implementation.

Do not add:

- a generic mega viewer;
- another provider layer by default;
- compatibility wrappers;
- public broad context hooks;
- slot-object APIs;
- render-prop anatomy;
- speculative state splitting;
- symmetry for its own sake.

Do not chase every historical blueprint. Old blueprints are historical notes.
The source, tests, current docs, and current public registry are the authority.

## Current Good Shape

The shared viewer primitive grammar is right:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

`ViewerRoot` owning sidebar state is right.

PDF composition is now the right shape:

```tsx
<PdfViewerProvider source={source}>
  <ViewerRoot>
    <PdfViewerHeader />
    <ViewerBody>
      <ViewerSidebar>
        <PdfViewerThumbnails />
      </ViewerSidebar>
      <ViewerSurface>
        <PdfViewerPages />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PdfViewerProvider>
```

Edit composition is now the right public shape:

```tsx
<EditViewerProvider result={result}>
  <ViewerRoot>
    <EditViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <EditViewerDocument />
      </ViewerSurface>
      <ViewerSidebar>
        <EditViewerFields />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EditViewerProvider>
```

Split and partition are converging correctly:

```txt
domain result
  -> domain viewer model
  -> segmented document model
  -> shared viewport controller
  -> domain-specific composition
```

The provider pattern is not a dead end.

It is correct when the provider owns real shared state:

- sidebar state;
- PDF resource and document handle state;
- segmented document viewport state;
- Edit domain state;
- split and partition domain state.

It is wrong when it becomes ceremony.

## Remaining Gap 1: PDF Engine Is Still Too Large

### Current Shape

`pdf-viewer-content.tsx` is now separated from the public facade.

That is a real improvement.

But `PdfResourceContent` still owns too much at once:

```txt
resource retain/release
first-page measurement
scale
rotation
page size cache
page layout
scroll model
viewport registration
virtualized page window
imperative handle
toolbar fallback
document rendering
```

The module is isolated.

It is not yet beautiful.

### Why It Is Not Platonic

A perfect internal engine has dense lines, but each block should feel
inevitable.

Right now the file is correct, but the reader has to keep too many concerns in
working memory.

The smell is not public API bloat.

The smell is internal cognitive width.

### Ideal Direction

Extract only if the extraction makes the code smaller to read.

Likely cuts:

```txt
usePdfDocumentResourceLifecycle(resource)
usePdfDocumentViewportControls(input)
PdfDocumentPagesLayer
```

Avoid extracting:

```txt
usePdfEverything
PdfViewerEngineProvider
PdfViewerRuntime
```

The goal is not more files.

The goal is a smaller obvious center.

### Acceptance Test

PDF internals are closer to ideal when:

- `PdfResourceContent` reads as orchestration, not implementation;
- page rendering lives in a small named layer;
- viewport control construction is named once;
- no new public exports are introduced;
- existing PDF render, scroll, zoom, rotate, thumbnail, and resource tests stay
  green.

## Remaining Gap 2: PDF Has Two State Mechanisms

### Current Shape

PDF uses both:

```txt
PdfViewerContext
PdfDocumentViewportRegistrationProvider
```

This removed the worse public setter prop.

It also made the detached header case work well.

### Why It Is Not Platonic

The user-facing composition is simple.

The internal coordination is still slightly non-obvious:

```txt
PdfViewerPages computes controls.
PdfViewerPages registers controls.
PdfViewerProvider stores controls.
PdfViewerHeader reads controls.
```

That is defensible.

It is not self-evident.

### Ideal Direction

Do not change this unless the replacement removes a concept.

The possible better shape is:

```txt
PdfViewerPages registers a single document viewport handle.
PdfViewerHeader and thumbnails consume the handle.
```

But if that creates both:

```txt
PdfViewerHandle
PdfDocumentViewportHandle
```

then it is probably worse.

### Acceptance Test

Keep the current registration layer unless a new design proves:

- fewer named concepts;
- fewer moving parts;
- no public API expansion;
- detached header still works;
- thumbnails still follow page state;
- imperative scroll still works;
- `PdfResourceContentProps` remains free of transport props.

## Remaining Gap 3: Edit Store Is Publicly Clean, Internally Broad

### Current Shape

Edit now has:

```txt
edit-viewer.tsx          public import map
edit-viewer-provider.tsx domain state builder
edit-viewer-store.tsx    same-folder implementation context
edit-viewer-anatomy.tsx  context-bound named parts
edit-viewer-*.tsx        pure views and model files
```

Public broad hooks were removed.

That was the right cut.

### Why It Is Not Platonic

The internal store still carries:

```txt
state
mode
fields
selection
document
options
```

That is acceptable.

It is not minimal in the mathematical sense.

The latest tests prove no remount churn across field-panel churn.

They do not prove render minimality at every subview.

### Ideal Direction

Do not split the store because it feels broad.

Split only if profiling or tests show meaningful churn.

If a split is justified, the only acceptable split is by real consumer
boundaries:

```txt
EditDocumentContext
EditFieldsContext
EditChromeContext
```

But the better outcome may be no split.

### Acceptance Test

Edit is closer to ideal when:

- public entrypoint stays anatomy-only;
- `useEditStore` appears only inside the Edit implementation and generated
  payload;
- field search and hover do not reload document resources;
- custom composition with named parts does not remount document or field panel;
- any future store split removes code or measurable render work.

## Remaining Gap 4: Split And Partition Still Repeat Domain Context Grammar

### Current Shape

Split and partition now share the important mechanics:

```txt
SegmentedDocumentProvider
useSegmentedDocumentViewport
SegmentViewportController
documentHandlers
SegmentLegend
PageRibbon / SegmentPageRail
```

This is the right convergence point.

### Why It Is Not Platonic

Each viewer still repeats a similar local pattern:

```txt
DomainViewerContext
useDomainViewerContext
useDomainViewerHeader
useDomainViewerDocument
useDomainViewerEmpty
useDomainViewerDocumentControls
```

Some of that is useful naming.

Some of it may be boilerplate.

### Ideal Direction

Do not make a generic `<SegmentedViewer>`.

Instead, compress duplicated local context only if the result remains named and
domain-specific.

Possible extraction:

```ts
function useDomainSegmentedViewport(model) {
  return {
    segmentedDocumentModel,
    viewport,
  }
}
```

But only if it removes repetition without hiding domain decisions.

### Acceptance Test

Split and partition are closer to ideal when:

- their domain models remain explicit;
- their public document-control hooks remain narrow;
- `SegmentedDocumentProvider` remains the shared behavior layer;
- no generic visual segmented viewer appears;
- repeated local hook scaffolding is reduced or proven intentional.

## Remaining Gap 5: Segmented Document Model Is Right But Not Fully Proven

### Current Shape

The shared model separates semantic segments from page-local anchors:

```txt
DocumentSegment
SegmentAnchor
SegmentRow
SegmentedDocumentModel
```

This is the right conceptual model.

Partition now explicitly has:

```txt
viewportSegments
legendSegments
ribbonRows
```

That naming is correct.

### Why It Is Not Platonic

The model has been proven for split and partition.

It has not been fully proven across:

- sources;
- OCR;
- extraction bboxes;
- layout blocks;
- edit field overlays;
- future document evidence viewers.

The danger is not the current model.

The danger is future pressure adding domain-specific props to the segmented
provider.

### Ideal Direction

Keep the provider domain-blind.

It may know:

```txt
pages
segments
anchors
rows
current page
scroll progress
hover
selection
preview
scrollToPage
scrollToSegmentStart
scrollToAnchor
document handle
```

It must not know:

```txt
partition votes
split jobs
OCR text
extraction schemas
files
emails
workflow runs
```

### Acceptance Test

The segmented model is closer to ideal when:

- sources and OCR can use the same model without adapter contortions;
- partition keeps `viewportSegments`, `legendSegments`, and `ribbonRows`
  separate;
- split remains simple with only semantic segments;
- bbox viewers use anchors instead of pretending page-local boxes are semantic
  segments;
- no prop named `partitionMode`, `splitMode`, `ocrMode`, or similar enters the
  shared provider.

## Remaining Gap 6: ViewerRoot Is Powerful Enough But Not Tiny

### Current Shape

`ViewerRoot` owns:

```txt
open / defaultOpen / onOpenChange
auto inline-or-overlay sidebar mode
sidebar registration
single primary sidebar invariant
escape close
outside click close
focus return
trigger state
side
collapsible mode
width
data attributes
```

This is the right ownership boundary.

### Why It Is Not Platonic

The primitive is compact relative to what it does, but not tiny.

It is a layout primitive plus a sidebar coordinator.

That is acceptable because the shadcn sidebar has the same tension: easy common
use, expressive composition, provider-backed control.

Still, the API should be watched carefully.

### Ideal Direction

Freeze the primitive vocabulary:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
ViewerSidebarTrigger
useViewerSidebar
useOptionalViewerSidebar
```

Everything else should need strong proof.

### Acceptance Test

Viewer primitives remain ideal-adjacent when:

- no `ViewerShell` returns;
- no `ViewerPanel`, `ViewerMain`, or `ViewerAside` appears;
- no slot object API appears;
- no `purpose`, `role`, or domain classification props appear;
- sidebar trigger works anywhere under the root;
- one root owns one primary sidebar;
- nested viewer means nested `ViewerRoot`.

## Remaining Gap 7: Architecture Tests Are Heavy

### Current Shape

The architecture tests protect important boundaries:

- public broad hooks are absent;
- raw contexts are private;
- viewer primitives stay anatomical;
- PDF internals are not taught by docs/examples;
- Edit store is not public;
- source and segmented composition stay separated.

This is useful.

### Why It Is Not Platonic

A perfect API needs fewer fences.

The current tests are partly compensating for the system having gone through
many shapes.

They are valuable, but heavy.

### Ideal Direction

Keep the tests while the system is still settling.

Over time, replace brittle string assertions with:

- AST export checks;
- registry item shape checks;
- focused public-doc import checks;
- small behavioral tests.

Remove historical-name assertions once old names are no longer a realistic
regression vector.

### Acceptance Test

The architecture tests are closer to ideal when:

- export-shape tests use AST helpers;
- docs/examples boundary checks use import parsing, not broad text search;
- behavioral tests cover the real risks;
- old-name negative assertions are only kept for names that are likely to
  regress;
- the test file reads like a contract, not an archaeological record.

## Remaining Gap 8: Historical Blueprints Are Noisy

### Current Shape

Older design files still mention removed APIs:

```txt
useEditViewerDocument
useEditViewerFields
PdfViewerHeaderControls
setHeaderControls
setViewportControls
```

The source and current public docs are clean.

The design archive is not clean.

### Why It Is Not Platonic

For implementation, historical blueprints are harmless.

For taste, they are noisy.

A reader can no longer tell which document is active without reading dates and
context.

### Ideal Direction

Do not rewrite history.

Add a small design index that marks:

```txt
current authority
historical note
superseded
do not implement
```

Or move old blueprints into an archive folder.

### Acceptance Test

The design archive is closer to ideal when:

- there is one obvious current viewer-system blueprint;
- superseded blueprints are marked as superseded or archived;
- current implementation decisions are not contradicted by nearby active docs;
- source and tests remain the final authority.

## Final Target Shape

The ideal viewer library should feel like this:

```txt
Viewer primitives:
  layout and sidebar state only

FileViewer:
  source router and leaf renderer only

PDF:
  document resource + pages + header + thumbnails

Email:
  MIME model + header + parts sidebar + selected part file viewer

Edit:
  edit model + private store + named anatomy

Split:
  split model + segmented document + page rail + document

Partition:
  partition model + segmented document + legend + ribbon + document

Sources / OCR:
  evidence model + segmented document anchors + domain sidebar/document
```

No component should need to know about a neighboring domain.

No primitive should know why it is being used.

No domain viewer should reimplement sidebar behavior, document viewport
navigation, or file rendering.

## Implementation Order

### Step 1: Compress PDF Internals

Audit `pdf-viewer-content.tsx`.

Extract only the pieces that make the orchestration smaller:

```txt
resource lifecycle
viewport controls
page layer
```

Do not change public API.

### Step 2: Decide Whether PDF Registration Is Final

Write one focused comparison:

```txt
current registration context
vs
single viewport handle
```

Keep the current layer unless the alternative removes concepts.

### Step 3: Reduce Split / Partition Boilerplate

Look for real duplicate context scaffolding.

Do not create a generic segmented viewer.

Only extract a tiny behavior helper if it removes code and preserves domain
clarity.

### Step 4: Prove Segmented Model Across Sources And OCR

Build or audit one sources/OCR adapter against:

```txt
segments + anchors
```

Reject any design that adds source/OCR-specific props to
`SegmentedDocumentProvider`.

### Step 5: Clean The Architecture Test Contract

Convert remaining export-shape string checks to AST where useful.

Separate:

```txt
public API contract
implementation boundary contract
historical regression contract
```

### Step 6: Mark The Design Archive

Create a viewer design index.

Mark old blueprints as historical rather than active.

Do not edit file-system blueprints.

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

Run targeted search audits:

```bash
rg -n "setViewportControls|setHeaderControls|headerControls|PdfViewerHeaderControls" \
  components registry/new-york-v4 content tests public/r

rg -n "useEditViewerDocument|useEditViewerFields|EditViewerFieldsPartState" \
  components registry/new-york-v4 content tests public/r

rg -n "partitionMode|splitMode|ocrMode|sourceMode" \
  registry/new-york-v4/ui/segmented-document* components/ui/segmented-document*
```

Expected result:

- old PDF transport names appear only in historical design docs or negative
  tests;
- removed Edit hooks do not appear in source, docs, examples, or public
  payloads;
- segmented provider remains domain-blind;
- registry output is synchronized.

## Definition Of Done

The viewer system reaches the next plateau when:

- PDF internals are smaller without public API expansion;
- Edit remains public-anatomy-only;
- split and partition share behavior without sharing taste;
- sources/OCR prove the segmented model;
- architecture tests read as a contract rather than a museum;
- public docs teach only the current grammar;
- the design archive has an obvious current authority.

That would still not guarantee metaphysical perfection.

But it would make the component library feel much closer to inevitable.
