# File Viewer Post-Implementation Platonic Gap Blueprint

## Verdict

No, `FileViewer` has not reached the platonic ideal.

It has reached a strong public design. The public grammar now feels right. The
remaining issues are not big conceptual mistakes. They are the last pieces of
implementation residue that separate "good component architecture" from
"inevitable component architecture."

The important distinction:

```txt
public API: close to ideal
internal implementation: good, still not perfect
```

The current public grammar should remain:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>

  <FileViewerBody>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

This is the right shape. The remaining question is whether the internals now
deserve that public shape.

## What Perfection Means Here

For `FileViewer`, the platonic ideal means:

- the public API is small enough to remember;
- the names are exact;
- every visible part maps to one visual or semantic responsibility;
- private files are private in practice;
- no old names survive as compatibility crutches;
- the easy API and composed API are the same model at different density;
- file identity is owned once;
- document rendering is owned once;
- header controls are registered upward, not prop-drilled downward;
- sidebar state is viewer state, not file-format state;
- format renderers know their own state;
- domain viewers compose file viewing instead of becoming file viewers;
- the implementation is as clear as the API;
- tests enforce boundaries rather than testing incidental implementation noise.

The ideal can be summarized as:

```txt
FileViewer is the file-scoped viewer root.
ViewerRoot is the generic layout primitive.
FileViewerDocument is the routed file output.
Format renderers own format behavior.
Domain viewers own domain behavior.
```

Anything else is either implementation or waste.

## Current Proven State

The current system has these strong properties.

### Public anatomy is coherent

The exported public anatomy is:

```txt
FileViewer
FileViewerHeader
FileViewerTitle
FileViewerMeta
FileViewerControls
FileViewerBody
FileViewerSidebar
FileViewerSurface
FileViewerSidebarTrigger
FileViewerDocument
useFileViewerResource
```

These are the right public words.

`FileViewerBody` is the right replacement for the old ambiguous
`FileViewerContent`. `Body` means layout row. `Surface` means main visual
region. `Document` means routed file output.

### Provider is no longer the concept

`FileViewerProvider` still exists internally, but the user does not author it.

The public model is:

```tsx
<FileViewer source={source}>...</FileViewer>
```

not:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>...</ViewerRoot>
</FileViewerProvider>
```

This is correct. React context needs a provider. Users do not need a provider
as a concept.

### Header is file-level, not PDF-level

The header now belongs to the file viewer:

```tsx
<FileViewerHeader>
  <FileViewerTitle />
  <FileViewerMeta />
  <FileViewerControls />
</FileViewerHeader>
```

PDF does not need its own parallel `PdfViewerHeader`.

The active renderer registers controls upward. The header renders them. That is
the right ownership direction.

### The icon was removed from the default title

This matters more than it sounds.

The default title should say what the file is. A generic file icon is low
information, visual noise, and usually bad taste. If a domain wants an icon, it
can add one in custom header composition.

The default should remain:

```txt
title, meta                                      controls
```

not:

```txt
icon, title                                     meta, controls
```

### Document runtime is separated from public anatomy

The anatomy file no longer owns suspense, error boundary, route invocation, and
descriptor signal plumbing.

That work is in:

```txt
registry/new-york-v4/ui/file-viewer-document.tsx
```

This is correct.

The public file should read like a table of contents. The document runtime file
should read like a runtime.

### Route dispatch is separated

Renderer dispatch lives in:

```txt
registry/new-york-v4/ui/file-viewer-route.tsx
```

This is correct. File routing is not public anatomy.

### Fallback and zoom are split

The old mixed chrome file is gone.

Current shape:

```txt
file-viewer-fallback.tsx
  UnsupportedCard
  ViewerFallback
  FileErrorBoundary

viewer-zoom.tsx
  useZoom
  ZoomActions
```

This is better than `file-viewer-chrome.tsx`.

The file names now match the responsibilities.

### Registry payloads know the split

The file viewer registry item now includes:

```txt
file-viewer.tsx
file-viewer-internal.tsx
file-viewer-document.tsx
file-viewer-route.tsx
file-viewer-core.ts
file-viewer-fallback.tsx
viewer-zoom.tsx
```

That is the right install boundary.

### Composed viewers use the grammar

The important composed viewers now speak the `FileViewer` grammar:

- PDF viewer;
- PDF thumbnails;
- split viewer;
- partition viewer;
- sources viewer where file viewing is nested inside a broader source workflow;
- email attachment rendering;
- dropzone preview rendering.

This validates the public grammar. A component API is only real when multiple
call sites survive it cleanly.

## Current File Map

The current implementation should be read as these layers.

### Public file anatomy

```txt
registry/new-york-v4/ui/file-viewer.tsx
```

Owns:

- public root;
- public anatomy;
- default composition;
- public prop types;
- public re-exports;
- header title/meta/control rendering;
- bridge to `ViewerRoot`;
- bridge to private provider.

Should not own:

- route dispatch;
- suspense;
- error boundary;
- fallback skeletons;
- zoom logic;
- MIME trees;
- file-system trees;
- split/partition state;
- source/OCR state.

### File viewer context

```txt
registry/new-york-v4/ui/file-viewer-internal.tsx
```

Owns:

- `FileViewerProvider`;
- file viewer context;
- descriptor resolution;
- viewer resource creation;
- descriptor abort signal;
- controls registration state;
- narrow public `useFileViewerResource`.

This file is implementation, even though it ships in the registry.

### Document runtime

```txt
registry/new-york-v4/ui/file-viewer-document.tsx
```

Owns:

- public `FileViewerDocument`;
- internal `InternalFileViewerDocument`;
- document runtime hook;
- fallback;
- suspense;
- error boundary;
- controls cleanup;
- route invocation.

This is the most important internal seam.

### Route dispatch

```txt
registry/new-york-v4/ui/file-viewer-route.tsx
```

Owns:

- lazy imports of format renderers;
- category dispatch;
- blob/direct URL handling;
- unsupported fallback;
- renderer-specific prop adaptation.

This file should remain boring and explicit unless repetition starts causing
real defects.

### Source and descriptor model

```txt
registry/new-york-v4/ui/file-viewer-core.ts
```

Owns:

- `FileCategory`;
- `ViewerSource`;
- descriptor resolution;
- descriptor reset key;
- prose text detection.

### Fallback/error UI

```txt
registry/new-york-v4/ui/file-viewer-fallback.tsx
```

Owns:

- unsupported file card;
- generic file fallback skeleton;
- file error boundary.

### Zoom helper

```txt
registry/new-york-v4/ui/viewer-zoom.tsx
```

Owns:

- small zoom state hook;
- zoom action buttons used by HTML file preview.

This file is intentionally not `file-viewer-zoom.tsx` because the primitive is
generic enough. If another viewer consumes it, the name will still make sense.

## What Is Good Enough To Freeze

These decisions should be considered settled.

### `FileViewer` should remain the root

Do not bring back a public `FileViewerProvider`.

`FileViewer` is both easy API and composition root. That is the right shadcn
pattern.

### `FileViewerBody` should remain the layout name

Do not reintroduce `FileViewerContent`.

`Content` is overloaded. `Body`, `Surface`, and `Document` are precise.

### `FileViewerDocument` should remain the routed output

The user should not pass the source twice.

Good:

```tsx
<FileViewer source={source}>
  <FileViewerSurface>
    <FileViewerDocument />
  </FileViewerSurface>
</FileViewer>
```

Bad:

```tsx
<FileViewer source={source}>
  <FileViewerDocument source={source} />
</FileViewer>
```

### Controls should continue registering upward

The header should not receive PDF props.

Good:

```txt
PdfViewerPages owns PDF state.
PdfViewerPages registers controls.
FileViewerControls renders controls.
```

Bad:

```tsx
<FileViewerHeader
  page={page}
  totalPages={totalPages}
  zoom={zoom}
  onZoomIn={onZoomIn}
/>
```

### Sidebar trigger should remain root-driven

The sidebar trigger should work anywhere inside the same `FileViewer` because
the root owns the sidebar state.

That is the right shadcn sidebar lesson.

## The Remaining Residue

These are the things that keep the component from being perfect.

## Gap 1: Registry Privacy Is Still Convention, Not Encapsulation

Current state:

```ts
// file-viewer-document.tsx
export function InternalFileViewerDocument(...)
```

This is registry-internal, not public from `file-viewer.tsx`. That is good.

But because shadcn registry components ship as source files, the symbol is
still visible to a consumer who opens the installed source.

This is not a fatal design flaw. It may be irreducible in a registry system.
But it is not perfect encapsulation.

### Why it exists

`file-viewer.tsx` needs an internal document runtime for the default full
viewer:

```tsx
<InternalFileViewerDocument
  bare
  className="h-full"
  leafControls={false}
  leafDownload={false}
/>
```

The public `FileViewerDocument` must keep leaf controls/downloads on:

```tsx
<FileViewerDocument />
```

Those two placements have different control ownership.

### Why not solve it with public props

This would be worse:

```tsx
<FileViewerDocument leafControls={false} leafDownload={false} />
```

It exposes internal placement semantics to users.

### Why not solve it with a compatibility wrapper

This would also be worse:

```tsx
<FileViewerDocumentRenderer />
```

The name reads public and describes implementation, not anatomy.

### Acceptable final position

Keep:

```txt
FileViewerDocument          public anatomy
InternalFileViewerDocument  registry-internal runtime
```

and enforce:

```txt
no docs import it
no blocks import it
no public re-export exposes it
tests assert absence from public module exports
```

### More perfect but probably not worth it

Move `FileViewer` default composition into the document module so
`InternalFileViewerDocument` does not need to be imported by `file-viewer.tsx`.

This would likely make boundaries less obvious, not more obvious.

Recommendation: accept the current impurity.

## Gap 2: `FileViewer` Has Three Internal Render Paths

Current high-level shape:

```tsx
if (children != null) {
  return provider + ViewerRoot + children
}

if (bare) {
  return provider + FileViewerDocument
}

return provider + ViewerRoot + default children
```

This is understandable, but it is not crystalline.

There are really three behaviors:

1. composed viewer;
2. bare leaf file document;
3. default full file viewer.

The public model is one component. The implementation still shows three cases.

### Why this is not automatically bad

The three branches map to real product behavior:

- with children, the caller owns anatomy;
- `bare` without children means "only the routed document";
- no children and not bare means "full default viewer."

The branches are not accidental.

### Why it is still residue

The easy API and composed API should feel like one model.

The branch:

```tsx
if (bare) return <FileViewerDocument bare />
```

does not use `ViewerRoot`. That is intentional, but it means bare no-children
is a special rendering path.

### Possible refinement

Extract private render helpers:

```ts
function renderComposedFileViewer(...)
function renderBareFileViewerDocument(...)
function renderDefaultFileViewer(...)
```

This would not reduce logic, but it would make the cases named.

### Better refinement

Leave the branches but make tests document the distinction:

```txt
bare + no children renders routed document only
bare + children still uses ViewerRoot bare
no children renders full default anatomy
children renders caller anatomy
```

Recommendation: do not refactor yet. The code is direct. A helper extraction
may lower entropy.

## Gap 3: The Internal Header Hook Is Slightly Broader Than Its Name

Current state:

```ts
type FileViewerState = {
  descriptor: FileDescriptor
  resource: ViewerResource
  controlsState: ViewerControlsState | null
  setControlsState: (state: ViewerControlsState | null) => void
}

type FileViewerHeaderState = FileViewerState

function useFileViewer(): FileViewerState
function useFileViewerHeader(): FileViewerHeaderState
```

This is private, so it is not a major issue.

But it is a little soft:

```txt
useFileViewerHeader returns all file viewer state used by title/meta/controls.
```

It is not truly "header state" as a distinct model. It is a narrowed context
read for header parts.

### Possible refinement

Make the hook name match its actual use:

```ts
function useFileViewerHeaderState()
```

or remove the alias:

```ts
function useFileViewerParts()
```

But this may be worse. `useFileViewerHeader` is simple and private.

### Perfection criterion

No public hook should return this state.

As long as this remains private, the impurity is acceptable.

Recommendation: leave it unless a future edit touches this area.

## Gap 4: Route Dispatch Is Clear But Repetitive

Current route dispatch handles:

- text source;
- blob source with no direct URL;
- direct URL source;
- PDF;
- DOCX;
- image;
- PPTX;
- XLSX;
- CSV;
- markdown;
- HTML;
- plain text/prose/code distinction;
- unsupported fallback.

The repetition is real.

Examples of repeated concepts:

```txt
resource={resource}
className={className}
bare={bare}
download={leafDownload}
controls={leafControls}
isolateStyles={isolateStyles}
descriptorSignal={descriptorSignal}
```

### Why not abstract immediately

The route file is private and explicit.

Every important behavior is easy to answer:

- what handles PDF?
- what handles blob DOCX?
- what receives `controls`?
- what receives `download`?
- what receives `descriptorSignal`?
- what receives `isolateStyles`?
- what happens when unsupported?

A renderer registry map might reduce lines but make these questions harder.

### Possible future shape

Only if repetition becomes defect-prone:

```ts
type FileRouteMode = "text" | "blob-without-url" | "direct-url"

type FileRouteRequest = {
  mode: FileRouteMode
  category: FileCategory
  descriptor: FileDescriptor
  resource: ViewerResource
}
```

Then route from category plus mode.

### Rejection criterion

Reject any abstraction that produces:

```ts
const routes = {
  pdf: createResourceRoute(...),
  image: createResourceRoute(...),
}
```

if it hides per-renderer prop differences.

Recommendation: do not refactor now.

## Gap 5: `bare` Is Useful But Semantically Dense

`bare` currently means:

```txt
reduce or remove outer frame/chrome
```

But it appears in multiple layers:

- `FileViewer`;
- `ViewerRoot`;
- `FileViewerDocument`;
- format renderers;
- fallback states.

This is convenient, but dense.

### Why it works

Every viewer needs some way to embed inside a larger shell.

`bare` is short, familiar, and already used across the system.

### Why it is not perfect

`bare` can mean slightly different things depending on placement:

```txt
FileViewer bare with children -> ViewerRoot bare
FileViewer bare without children -> document only
FileViewerDocument bare -> document chrome reduction
PdfViewerPages bare -> PDF page surface without outer frame
```

These are related, not identical.

### Required invariant

Do not add more meaning to `bare`.

It must not start meaning:

- disable controls;
- disable download;
- disable provider;
- disable route;
- hide metadata;
- change file type detection.

### Possible documentation improvement

Docs should explicitly say:

```txt
With children, FileViewer bare removes the spatial frame.
Without children, FileViewer bare renders only the routed document.
```

This may already be documented. Keep it that way.

Recommendation: accept `bare`, but defend it with tests and docs.

## Gap 6: `useFileViewerResource` Is A Necessary Escape Hatch

The only public hook should remain:

```ts
useFileViewerResource()
```

This is acceptable because format-level or advanced composed integrations may
need the active file resource.

But it is still an escape hatch.

### What must not happen

Do not add:

```ts
useFileViewer()
useFileViewerContext()
useFileViewerHeader()
useFileViewerDocument()
useFileViewerControls()
useOptionalFileViewerResource()
```

The moment public hooks expose the provider shape, the component becomes less
shadcn-like.

### Future acceptable hooks

Only add a narrow hook if the exact value is stable:

```ts
useFileViewerResource()
useFileViewerDescriptor()
```

Even `useFileViewerDescriptor()` should be treated skeptically.

Recommendation: keep one hook.

## Gap 7: Header Meta Is Correct But Not Deeply Thought Through

Current metadata logic:

```ts
const meta = resource.mimeType || descriptor.mimeType || descriptor.category
```

This is simple and mostly good.

But "meta" can mean several things:

- MIME type;
- category;
- page count;
- selected partition count;
- split confidence;
- domain-specific facts.

The file-level `FileViewerMeta` should remain passive file identity, not active
document position.

Document position belongs in controls:

```txt
Page 4 of 12
Slide 2 of 8
Frame 7
```

Domain facts can be custom header children:

```tsx
<FileViewerHeader>
  <FileViewerTitle />
  <SplitViewerHeaderMeta />
  <FileViewerControls />
</FileViewerHeader>
```

### Required invariant

`FileViewerMeta` should not become a general-purpose domain metadata renderer.

It is file metadata.

Recommendation: keep it simple.

## Gap 8: Registry Tests Are Doing Real Architecture Work

Because this is a shadcn registry, source files are copied into consumers'
projects.

That means privacy cannot be enforced only by package exports.

Current architecture tests are doing important work:

- no public export of internal provider;
- no public export of internal route;
- no public export of internal document runtime;
- no docs/blocks import private modules;
- public registry payload mirrors source;
- relative internal modules are listed by registry items;
- old names stay dead.

This is good.

But tests are now part of the architecture. They must stay high signal.

### Risk

Architecture tests can become brittle if they assert too many incidental
strings.

### Good architecture assertion

```txt
file-viewer.tsx must not export FileViewerProvider
```

### Brittle architecture assertion

```txt
file-viewer.tsx must contain a specific line break
```

Recommendation: keep boundary assertions, avoid formatting assertions.

## Gap 9: Visual Perfection Is Not Fully Proven By Tests

Typecheck and unit tests prove behavior and boundaries.

They do not prove:

- header balance at narrow widths;
- long filename truncation with controls;
- PDF thumbnails layout with sidebar trigger;
- overlay sidebar behavior;
- mobile body/surface sizing;
- unknown file fallback taste;
- HTML zoom toolbar visual alignment.

The current work should be considered architecturally verified, not fully
visually proven.

### Needed visual proof

When a dev server is available, visually inspect:

- default PDF viewer;
- PDF thumbnails block;
- split viewer block;
- partition viewer block;
- file viewer unknown file fallback;
- long file name in header;
- bare file viewer inside another shell;
- mobile width with sidebar trigger.

Do not start a dev server automatically unless explicitly allowed by project
instructions and user request. The current repository instruction says not to
start one.

Recommendation: add visual QA as a separate explicit pass.

## Gap 10: FileViewer Is Now Good Enough That Further Cuts Can Hurt It

This is the most important meta-point.

The system is close enough that "more abstraction" is now dangerous.

Bad future moves:

- make a generic route registry too early;
- make `FileViewerDocument` configurable with internal props;
- expose `FileViewerProvider`;
- add a compound namespace API and named exports at the same time;
- make `FileViewer` know about split/partition/source/email/file-system;
- add compatibility aliases;
- turn `FileViewerHeader` into a format-specific control surface;
- rebuild sidebar state inside file viewer.

The final work is mostly subtraction and enforcement, not invention.

## The Exact Ideal

The ideal public usage remains:

```tsx
<FileViewer source={source} />
```

for easy use.

And:

```tsx
<FileViewer source={source} defaultOpen>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>

  <FileViewerBody>
    <FileViewerSidebar aria-label="Document pages">
      <PdfViewerThumbnails />
    </FileViewerSidebar>
    <FileViewerSurface>
      <PdfViewerPages />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

for composed use.

That is one model, not two.

## The Exact Non-Ideal

Do not drift toward:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    <FileViewerHeader />
    <FileViewerRoute />
  </ViewerRoot>
</FileViewerProvider>
```

Do not drift toward:

```tsx
<FileViewer
  source={source}
  header
  sidebar
  thumbnails
  pdfControls
  splitMode
  partitionMode
/>
```

Do not drift toward:

```tsx
<FileViewer.DocumentRenderer />
```

or:

```tsx
<FileViewerContent />
```

The current named exports are better.

## Implementation Plan For The Last Mile

This is not an urgent rewrite. It is a preservation and last-mile polish plan.

### Step 1: Freeze the public API

Keep exactly:

```txt
FileViewer
FileViewerHeader
FileViewerTitle
FileViewerMeta
FileViewerControls
FileViewerBody
FileViewerSidebar
FileViewerSurface
FileViewerSidebarTrigger
FileViewerDocument
useFileViewerResource
```

Reject new public concepts unless a real use case proves them.

### Step 2: Keep internal names honest

Keep:

```txt
InternalFileViewerDocument
file-viewer-internal
file-viewer-route
file-viewer-fallback
viewer-zoom
```

Do not rename internals to prettier public-sounding names.

### Step 3: Do not refactor route dispatch yet

Leave `file-viewer-route.tsx` explicit.

Only refactor if:

- a new format makes the repeated branches materially worse;
- tests start missing category-specific behavior;
- renderer prop differences become hard to audit.

### Step 4: Add visual proof

Add a manual or browser-backed visual QA pass for:

- header layout;
- sidebar trigger;
- thumbnail rail;
- long filenames;
- fallback states;
- mobile/narrow widths.

This should be separate from architecture work.

### Step 5: Keep docs focused on anatomy

Docs should teach:

1. easy API;
2. anatomy composition;
3. sidebar composition;
4. format-specific provider nesting only when needed.

Docs should not teach:

- internal provider;
- route file;
- internal document runtime;
- fallback module;
- zoom module.

### Step 6: Protect against old names

Keep tests rejecting:

```txt
FileViewerContent
FileHeader
PdfViewerHeader
FileViewerDocumentRenderer
file-viewer-chrome
FileViewerProvider public export
FileViewerRoute public export
```

These names are attractive because they are familiar. They are still wrong for
the final model.

## Completion Criteria For True Perfection

The component can be called perfect only when the following are true.

### Public API criteria

- public exports are minimal and stable;
- no public provider;
- no public route;
- no public internal document runtime;
- no old compatibility aliases;
- docs use only public anatomy.

### Internal criteria

- file names match responsibilities;
- route dispatch remains readable;
- branch behavior is intentional and tested;
- no file-level module owns two unrelated concepts;
- private hooks stay private;
- no domain state enters file viewer.

### Composition criteria

- PDF viewer uses file header;
- PDF thumbnails use file sidebar;
- split viewer uses file header/body/surface;
- partition viewer uses file header/body/surface;
- sources/OCR use outer domain viewer when the workflow is broader than one
  file;
- email uses file viewer for selected parts, not for MIME ownership;
- dropzone uses file viewer for selected previews, not upload state;
- file-system contains file viewer, not the reverse.

### Verification criteria

- `pnpm typecheck` passes;
- `tests/file-viewer.test.tsx` passes;
- `tests/pdf-viewer.test.tsx` passes;
- the relevant architecture slice passes;
- full architecture has no FileViewer failures;
- registry payloads are rebuilt and aligned;
- visual QA covers header/sidebar/surface/fallback cases.

The known file-system assertion is outside this blueprint and should not be
used to judge FileViewer perfection.

## Final Position

The current design is good.

The public grammar is probably the right final grammar.

The provider approach is not a dead end because the provider is no longer the
authoring surface. It is implementation. That is exactly where it belongs.

The remaining imperfections are small:

```txt
registry-visible internals
implementation branching
route repetition
bare semantic density
visual proof still incomplete
```

None of those invalidate the design.

But if perfection means:

```txt
simplicity
speed
everything needed
nothing more
perfect modularization
high entropy code
perfect names
Flaubertian exactness
```

then the honest answer remains:

```txt
not yet
```

The public API is nearly there. The last mile is preservation, proof, and a few
small cuts. Do not start another architecture swing.
