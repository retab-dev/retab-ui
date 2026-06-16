# File Viewer Current Platonic Gap Blueprint

## Verdict

No, `FileViewer` has not reached the platonic ideal.

The public component grammar is close. The actual current implementation is not
yet clean enough to call perfect.

The main reason is no longer the big shape of the component. The big shape is
right:

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

The remaining gap is that the implementation and tests still leak uncertainty
about what is public, what is private, and what should be considered an escape
hatch.

The current design is good. It is not Flaubertian yet.

## Current Evidence

The current source says:

```ts
export {
  FileViewerProvider,
  useFileViewerResource,
} from "./file-viewer-internal"
```

That is the most important current fact.

Earlier direction was:

```txt
FileViewerProvider should not be the public authored concept.
```

The current implementation partially violates that by re-exporting the
provider from `file-viewer.tsx`.

The unit export test does not list `FileViewerProvider` in the expected public
anatomy, but the architecture test currently expects the provider re-export:

```ts
export {
  FileViewerProvider,
  useFileViewerResource,
} from "./file-viewer-internal"
```

That contradiction is not just a test issue. It reveals an unresolved design
question:

```txt
Is FileViewerProvider a public component, or is it implementation?
```

For the platonic ideal, the answer should be:

```txt
FileViewerProvider is implementation.
FileViewer is the public root.
```

## What Is Already Right

### The Anatomy Words Are Right

These names should stay:

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
```

They are direct. They are memorable. They map to visible anatomy.

`FileViewerBody` is better than `FileViewerContent`.

`FileViewerDocument` is better than exposing a route or renderer.

`FileViewerControls` is better than a format-specific toolbar.

### The Default Header Is Tasteful

The default header now has the right order:

```txt
title, meta                                      controls
```

The generic file icon is gone. That was the right subtraction.

### The Document Runtime Is Separated

The document runtime lives in:

```txt
registry/new-york-v4/ui/file-viewer-document.tsx
```

It owns:

- `FileViewerDocument`;
- `InternalFileViewerDocument`;
- suspense;
- fallback;
- error boundary;
- descriptor signal;
- route invocation;
- control cleanup.

That is the right file boundary.

### The Route Is Separated

The route lives in:

```txt
registry/new-york-v4/ui/file-viewer-route.tsx
```

It owns:

- lazy renderer imports;
- category dispatch;
- direct URL versus blob routing;
- renderer-specific prop adaptation;
- unsupported fallback.

The route is repetitive, but readable. Do not abstract it yet.

### Fallback And Zoom Are Split

The old mixed `file-viewer-chrome.tsx` is gone.

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

That is a better boundary.

## What Is Not Yet Platonic

## Gap 1: `FileViewerProvider` Is Public Again

This is the largest current imperfection.

The provider exists because React context needs it. That does not mean the user
should author it.

The public ideal is:

```tsx
<FileViewer source={source}>...</FileViewer>
```

not:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>...</ViewerRoot>
</FileViewerProvider>
```

### Why The Provider Re-Export Is A Problem

It creates two ways to build a file viewer:

```txt
easy root:
  FileViewer

lower-level root:
  FileViewerProvider + ViewerRoot
```

That is exactly the ambiguity we have been trying to remove.

It also makes the user ask:

```txt
Should I use FileViewer or FileViewerProvider?
Which one is more primitive?
Which one is shadcn-compliant?
```

The platonic answer should be:

```txt
Use FileViewer.
The provider is not part of the authored API.
```

### Correct Final State

`file-viewer.tsx` should export:

```ts
export { useFileViewerResource } from "./file-viewer-internal"
```

It should not export:

```ts
export { FileViewerProvider } from "./file-viewer-internal"
```

`FileViewerProvider` can remain exported from `file-viewer-internal.tsx`
because internal registry files need to import it, but the public module should
not re-export it.

### Test Correction

The architecture test should reject:

```ts
export {
  FileViewerProvider,
  useFileViewerResource,
} from "./file-viewer-internal"
```

and require:

```ts
export { useFileViewerResource } from "./file-viewer-internal"
```

The unit export test should explicitly assert:

```ts
expect(exports).not.toContain("FileViewerProvider")
```

Right now, the absence is not enforced strongly enough.

## Gap 2: `InternalFileViewerDocument` Is Still Registry-Visible

Current state:

```ts
export function InternalFileViewerDocument(...)
```

This is not re-exported as public anatomy, which is good.

But in a shadcn registry, copied source is visible. A determined consumer can
still import it directly from the installed file.

This is probably acceptable. It may be the cost of source distribution.

But it is not perfect encapsulation.

### Why This Is Acceptable

The internal runtime needs to be imported by `file-viewer.tsx` for default
composition:

```tsx
<InternalFileViewerDocument
  bare
  className="h-full"
  leafControls={false}
  leafDownload={false}
/>
```

The public document part must keep leaf controls and downloads enabled:

```tsx
<FileViewerDocument />
```

That distinction is real.

### Rule

Do not expose `InternalFileViewerDocument` from `file-viewer.tsx`.

Do not document it.

Do not use it in blocks.

Do not rename it to a prettier public-sounding name.

The ugliness of `Internal...` is useful. It tells the reader what it is.

## Gap 3: `FileViewerControls` Now Accepts Registered Title And Subtitle

Current controls registration state includes:

```ts
title?: React.ReactNode
subtitle?: React.ReactNode
position?: ViewerControlPosition | null
zoom?: ViewerZoomControl | null
rotate?: ViewerRotateControl | null
downloads?: ViewerDownloadAction[]
loading?: boolean
extra?: React.ReactNode
```

And `FileViewerControls` forwards:

```tsx
loading={controlsState?.loading ?? false}
subtitle={controlsState?.subtitle}
title={controlsState?.title}
```

This may be useful. It is also a taste risk.

`FileViewerHeader` already has:

```tsx
<FileViewerTitle />
<FileViewerMeta />
<FileViewerControls />
```

If renderers can register a `title` and `subtitle` into controls, then the
header can accidentally become:

```txt
file title, file meta, control title, control subtitle, position, controls
```

That may be correct for detached controls in a leaf viewer. It is questionable
inside the file header.

### Required Distinction

There are two contexts:

```txt
standalone ViewerControls
  may need title/subtitle

FileViewerControls inside FileViewerHeader
  should usually render operational controls, not another identity group
```

### Decision Needed

Either:

1. keep registered `title` and `subtitle` in `FileViewerControls`, but define
   the rule that they are document-control metadata, not file identity; or
2. strip `title` and `subtitle` from `FileViewerControls` and keep them only
   in lower-level `ViewerControls`.

For platonic simplicity, the second option is cleaner unless there is a real
call site proving the first.

### Test Needed

Tests should cover the intended behavior explicitly:

```txt
FileViewerTitle remains the file identity.
FileViewerMeta remains file metadata.
FileViewerControls does not duplicate file identity.
```

## Gap 4: Route Dispatch Is Readable But Repetitive

`file-viewer-route.tsx` still repeats renderer props across categories.

This is not the next thing to fix.

The explicit switch is better than a clever registry map if it lets the reader
answer:

- what handles PDF?
- what handles HTML?
- what receives `descriptorSignal`?
- what receives `controls`?
- what receives `download`?
- what receives `isolateStyles`?

The route file is not Flaubertian, but it is honest.

### Rule

Do not abstract route dispatch until repetition causes a real defect.

When the code is already simple, "less repetition" can become less clarity.

## Gap 5: `bare` Is Still Semantically Dense

`bare` means slightly different things depending on layer:

```txt
FileViewer bare with children:
  ViewerRoot bare

FileViewer bare without children:
  routed document only

FileViewerDocument bare:
  document frame reduction

format renderer bare:
  format frame reduction
```

This is acceptable because the meanings are related.

It is not perfect because one word carries several placement semantics.

### Rule

Do not add more meaning to `bare`.

It must not start meaning:

- disable controls;
- disable downloads;
- hide metadata;
- skip provider;
- change category detection;
- change route behavior.

### Tests Needed

The behavior should stay explicitly tested:

- `FileViewer bare` with no children renders only the routed document;
- `FileViewer bare` with children still creates the viewer root;
- `FileViewerDocument bare` still requires `FileViewer` context;
- `bare` does not alter file category routing.

## Gap 6: Visual Proof Is Missing

The architecture can be right and the component can still look wrong.

Tests prove:

- public exports;
- route behavior;
- registry boundaries;
- docs boundaries;
- control registration behavior.

They do not prove:

- long filename truncation;
- title/meta/control balance;
- sidebar trigger placement;
- thumbnail rail density;
- default fallback taste;
- mobile width behavior;
- overlay sidebar behavior;
- HTML zoom control alignment.

No dev server is currently available, and the repository instruction says not
to start one automatically.

### Required Visual QA

When a dev server is available, verify:

1. default PDF file viewer;
2. PDF thumbnails block;
3. split viewer block;
4. partition viewer block;
5. unknown file fallback;
6. long file name header;
7. bare file viewer inside another shell;
8. narrow viewport with sidebar trigger.

Until that happens, the component is architecturally good but not visually
proven.

## Gap 7: Tests Currently Encode Some Contradiction

The tests should express taste.

Right now the tests are close, but there is a mismatch around provider
publicness:

- unit export test omits `FileViewerProvider` from the expected public anatomy;
- architecture test expects the provider re-export.

The platonic ideal requires the tests to agree.

### Correct Test Position

Public API test:

```ts
expect(exports).not.toContain("FileViewerProvider")
```

Architecture test:

```ts
expect(fileViewerSource).toContain(
  'export { useFileViewerResource } from "./file-viewer-internal"'
)
expect(fileViewerSource).not.toMatch(
  /FileViewerProvider[\s\S]*from "\.\/file-viewer-internal"/
)
```

The exact regex can be cleaner, but the concept is clear:

```txt
FileViewerProvider is not a public export from file-viewer.tsx.
```

## The Target Public API

The final public exports should be exactly:

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

And relevant public types:

```txt
FileCategory
FileViewerProps
FileViewerHeaderProps
FileViewerTitleProps
FileViewerMetaProps
FileViewerControlsProps
FileViewerBodyProps
FileViewerSidebarProps
FileViewerSurfaceProps
FileViewerSidebarTriggerProps
FileViewerDocumentProps
```

Do not export:

```txt
FileViewerProvider
FileViewerRoute
InternalFileViewerDocument
FileViewerDocumentRenderer
useFileViewerContext
useOptionalFileViewerResource
useFileViewerHeader
FileViewerContent
FileHeader
PdfViewerHeader
file-viewer-chrome
```

## The Target Module Boundaries

### `file-viewer.tsx`

Should own:

- public root;
- public anatomy;
- default composition;
- file title/meta/controls rendering;
- sidebar prop pass-through to `ViewerRoot`;
- public `useFileViewerResource` re-export.

Should not publicly export:

- provider;
- route;
- internal document runtime.

### `file-viewer-internal.tsx`

Should own:

- provider;
- private context;
- descriptor/resource creation;
- descriptor signal;
- controls state.

This file can export internals for sibling modules. It should not be the public
user surface.

### `file-viewer-document.tsx`

Should own:

- public document anatomy part;
- internal document runtime;
- suspense/error/fallback lifecycle;
- route invocation.

### `file-viewer-route.tsx`

Should own:

- renderer dispatch;
- lazy imports;
- per-format prop adaptation.

### `file-viewer-fallback.tsx`

Should own:

- unsupported fallback;
- loading fallback;
- error boundary.

### `viewer-zoom.tsx`

Should own:

- generic zoom state;
- generic zoom buttons.

## Implementation Blueprint

### Step 1: Remove Provider From The Public Module

Change:

```ts
export {
  FileViewerProvider,
  useFileViewerResource,
} from "./file-viewer-internal"
```

to:

```ts
export { useFileViewerResource } from "./file-viewer-internal"
```

Do not delete `FileViewerProvider` from `file-viewer-internal.tsx`.

### Step 2: Align Tests With The Decision

Update the public export test:

```ts
expect(exports).not.toContain("FileViewerProvider")
```

Update architecture tests:

- reject provider re-export from `file-viewer.tsx`;
- still allow provider implementation inside `file-viewer-internal.tsx`;
- still allow `file-viewer.tsx` to use `<FileViewerProvider>` internally.

This distinction matters:

```txt
using provider internally: good
exporting provider publicly: not platonic
```

### Step 3: Decide Registered Title/Subtitle In FileViewerControls

Audit actual call sites for registered `title` and `subtitle`.

If no strong call site exists, remove this forwarding from
`FileViewerControls`:

```tsx
subtitle={controlsState?.subtitle}
title={controlsState?.title}
```

Keep it in lower-level `ViewerControls`.

If a strong call site exists, add tests documenting why it is acceptable and
how it does not duplicate `FileViewerTitle`.

### Step 4: Preserve The Route Switch

Do not refactor `file-viewer-route.tsx` in this pass.

Add only tests if a renderer prop difference is not covered.

### Step 5: Visual QA

Once a dev server is running, inspect:

- header title/meta/control layout;
- PDF thumbnails sidebar;
- split viewer;
- partition viewer;
- unknown fallback;
- long filename;
- narrow viewport.

Do not start the dev server automatically under current repo instructions.

### Step 6: Rebuild Registry Payloads

If source changes touch registry components, rebuild:

```txt
file-viewer
pdf-viewer
pdf-thumbnails-block
split-viewer-block
partition-viewer-block
sources-viewer-block
```

Then sync the registry index.

## Verification Plan

Required:

```bash
pnpm typecheck
pnpm test -- tests/file-viewer.test.tsx
pnpm test -- tests/pdf-viewer.test.tsx
pnpm test -- tests/viewer-architecture.test.ts -t "FileViewer|public viewer docs|relative internal module|public/r viewer metadata"
```

Expected caveat:

```txt
The full architecture suite may still fail the unrelated file-system width
assertion. That is outside this FileViewer blueprint.
```

Do not touch file-system as part of this work.

## Final Position

The public grammar is close to the final shape.

The component is not yet platonic because the current source still exposes
`FileViewerProvider` from the public module, and the tests do not speak with
one voice about whether that is public API.

The next correct move is not another abstraction. It is a hard boundary cut:

```txt
FileViewerProvider stays internal.
FileViewer remains the public root.
```

After that, the remaining work is proof:

- visual QA;
- route-switch preservation;
- `bare` semantics guarded by tests;
- no old names returning.

Do not redesign the component. Finish the boundary.
