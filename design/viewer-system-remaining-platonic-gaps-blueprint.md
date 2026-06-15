# Viewer System Remaining Platonic Gaps Blueprint

## Purpose

This blueprint converts the latest viewer-system review into a concrete cleanup
plan.

The goal is not to add capability. The goal is to remove the last pieces that
make the API feel less than inevitable.

The standard remains:

```txt
simplicity
speed
everything needed
nothing more
perfect modularization
high-entropy code
consistent names
shadcn-grade composition
```

The mandatory reading for this work is
[`viewer-system-platonic-reading-blueprint.md`](./viewer-system-platonic-reading-blueprint.md).

## Non-Goals

Do not touch file-system.

Do not add compatibility shims.

Do not preserve old names for migration comfort.

Do not create new provider layers.

Do not introduce slot objects, shell wrappers, render props, or universal viewer
components.

## Current Verdict

The viewer system is structurally good, but not platonic.

The center is right:

- `ViewerRoot` is the spatial primitive;
- sidebar control belongs to `ViewerRoot`;
- `FileViewer` is a file leaf renderer;
- split and partition share segmented-document mechanics;
- broad composed-viewer hooks are mostly gone;
- architecture tests now protect many of the right absences.

The remaining problems are not missing abstractions.

They are public-surface impurities:

- `SegmentedDocumentProvider` still exposes an aggregate context hook;
- email part names are inconsistent with the rest of the domain viewers;
- old email blueprints still teach the rejected public-hook model;
- internal selector files are exported as registry modules;
- `PdfViewerHeader` does not let custom children fully own header content.

## Target Shape

The final viewer system should read as anatomy:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

Domain viewers should remain named compositions:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot defaultOpen sidebarSide="right">
    <EmailViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <EmailViewerContent />
      </ViewerSurface>
      <ViewerSidebar>
        <EmailViewerPartsSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

The public API should expose components and narrow coordination hooks, not full
provider state.

## 1. Subtract The Segmented Document State Bag

### Problem

`SegmentedDocumentProvider` currently exports:

```ts
export type SegmentedDocumentContextValue = {
  model: SegmentedDocumentModel
  viewport: SegmentedDocumentViewport
}

export function useSegmentedDocument(): SegmentedDocumentContextValue
```

That is an aggregate state hook.

It is not as dangerous as the old domain hooks, but it is the same pattern in a
more respectable coat.

If users learn to write this:

```ts
const { model, viewport } = useSegmentedDocument()
```

then the primitive has become another public state bag.

### Target

Keep public narrow hooks:

```ts
useSegmentedDocumentViewport()
useSegmentedDocumentModel()
useSegmentedItemLink()
```

Make the aggregate hook private:

```ts
function useSegmentedDocumentContext(): SegmentedDocumentContextValue
```

or, if a separate module truly needs both values, expose a deliberately internal
name:

```ts
useInternalSegmentedDocument()
```

The preferred version is no public aggregate hook.

### Required Code Changes

- Remove `export` from `SegmentedDocumentContextValue`.
- Remove `export` from `useSegmentedDocument`.
- Update `useSegmentedDocumentViewport` and `useSegmentedDocumentModel` to call
  the private context hook.
- Update `useSegmentedItemLink` so it uses either:
  - the private context hook in the same module, if moved; or
  - the two narrow public hooks, if it remains separate.
- Update tests that call `useSegmentedDocument()` directly.

### Tests

Architecture tests must assert:

```txt
no export type SegmentedDocumentContextValue
no export function useSegmentedDocument(
yes export function useSegmentedDocumentViewport
yes export function useSegmentedDocumentModel
yes export function useSegmentedItemLink
```

Behavior tests should use narrow hooks instead of the aggregate hook.

## 2. Rename Email Parts To Match The System

### Problem

Email is structurally good but lexically inconsistent.

Current public parts:

```ts
EmailHeader
EmailPartsSidebar
EmailContent
EmailViewerFrame
```

The rest of the domain viewers use the domain-viewer prefix:

```ts
SplitViewerHeader
PartitionViewerHeader
ClassifierViewerHeader
PageMarkdownViewerContent
ParseViewerMarkdown
```

The active viewer blueprint uses:

```ts
EmailViewerHeader
EmailViewerPartsSidebar
EmailViewerContent
```

The current email names are not wrong in isolation. They are wrong in the
library.

### Target

Public email anatomy:

```ts
EmailViewer
EmailViewerProvider
EmailViewerHeader
EmailViewerContent
EmailViewerPartsSidebar
```

Private implementation helpers:

```ts
EmailViewerFrame
EmailHeader
EmailContent
EmailPartsSidebar
```

Or, ideally, delete the private names and use the final names internally too.

### Required Code Changes

- Rename `EmailHeader` to `EmailViewerHeader`.
- Rename `EmailContent` to `EmailViewerContent`.
- Rename `EmailPartsSidebar` to `EmailViewerPartsSidebar`.
- Make `EmailViewerFrame` private, or remove it by inlining the default
  composition inside `EmailViewer`.
- Update recursive nested email rendering to use the private default layout
  helper if one remains.
- Update tests and registry payloads.
- Do not export old aliases.

### Tests

Architecture tests must assert:

```txt
export function EmailViewerHeader
export function EmailViewerContent
export function EmailViewerPartsSidebar
no export function EmailHeader
no export function EmailContent
no export function EmailPartsSidebar
no export function EmailViewerFrame
```

The easy API test should read:

```tsx
<EmailViewerProvider>
<ViewerRoot>
<EmailViewerHeader>
<ViewerBody>
<ViewerSurface>
<EmailViewerContent>
<ViewerSidebar>
<EmailViewerPartsSidebar>
```

## 3. Supersede Stale Email Blueprints

### Problem

Some older email blueprints still describe the rejected public-hook model as the
ideal.

Examples include guidance that lists:

```ts
useEmailViewer
useEmailHeader
useEmailPartsSidebar
useEmailContent
```

That directly contradicts the current hook law:

```txt
if the hook exists only so the library's own first-party part can render,
it is private.
```

Docs that teach old taste are active architectural debt.

### Target

All public design documents should point to the active viewer standard:

```txt
viewer-system-platonic-reading-blueprint.md
viewer-system-shadcn-platonic-blueprint.md
```

Old documents may remain only as historical notes, but they must not present
obsolete APIs as current advice.

### Required Docs Changes

Supersede or rewrite:

- `email-viewer-final-blueprint.md`
- `email-viewer-terminal-perfection-blueprint.md`
- `email-viewer-remaining-perfection-blueprint.md`
- any viewer-system document that recommends public `useEmail*` part hooks;
- any viewer-system document that recommends `EmailViewerFrame` as public API.

### Tests

Architecture docs tests should reject:

```txt
useEmailViewer
useEmailHeader
useEmailPartsSidebar
useEmailContent
EmailViewerFrame
```

unless the document explicitly marks them as removed historical APIs.

## 4. Contain Internal Selector Exports

### Problem

The cleanup moved PDF and edit part-state hooks into internal files.

That is better than exporting them from public provider modules, but it is not
perfect because registry files are copied source. Anything exported from a copied
file looks available.

Current pattern:

```ts
export function useInternalPdfViewerHeader()
export function useInternalPdfViewerPages()
export function useInternalEditViewerLayout()
export function useInternalEditViewerHeader()
```

This is acceptable, but not beautiful.

### Target

Best version:

```txt
internal selectors are unexported because the first-party parts live in the same
module
```

Acceptable version:

```txt
internal selectors live in explicitly internal modules and are never re-exported
from public entrypoints or documented examples
```

The current system is at the acceptable version.

The platonic version is stricter.

### Required Code Changes

Choose one path:

1. Collapse first-party parts and internal selectors into the same file where
   that improves clarity.
2. Keep internal modules but add architecture tests that forbid importing them
   from examples, blocks, and docs.
3. Add file-level `@internal` comments to internal modules.

Do not create public wrapper hooks to hide the issue.

### Tests

Architecture tests should assert:

```txt
no public entrypoint re-exports useInternal*
no example imports *-internal-context
no docs recommend importing *-internal-context
```

Registry manifests may include internal files only when first-party copied
components require them.

## 5. Make PdfViewerHeader Children Own The Header

### Problem

`PdfViewerHeader` currently renders custom `children`, then still renders a
default `ViewerToolbar`.

That makes custom composition additive instead of substitutive:

```tsx
<PdfViewerHeader>
  <MyHeader />
</PdfViewerHeader>
```

does not mean "use my header content." It means "prepend my content before the
default toolbar."

That is inconsistent with `FileViewerHeader`, where custom children replace the
default content.

### Target

Use the simpler rule:

```tsx
<PdfViewerHeader>{children}</PdfViewerHeader>
```

If `children` is present, render only children.

If `children` is absent, render the default toolbar.

### Required Code Changes

- In `PdfViewerHeader`, branch on `children`.
- Preserve default toolbar behavior when `children` is absent.
- Keep `toolbar={false}` meaningful for the default header.
- Add a test proving custom children do not render the default toolbar.

### Tests

Add or update PDF viewer tests:

```txt
PdfViewerHeader with children renders children
PdfViewerHeader with children does not render ViewerToolbar title
PdfViewerHeader without children renders default toolbar
toolbar=false suppresses toolbar controls in default mode
```

## 6. Strengthen Architecture Tests

### Problem

The tests now catch many old API mistakes, but they still bless some remaining
imperfections:

- `EmailViewerFrame` is expected;
- email names without the `Viewer` prefix are expected;
- `useSegmentedDocument()` is not rejected;
- internal selector modules are accepted without guardrails around examples and
  docs.

### Target

Architecture tests should protect the final taste, not the last migration.

### Required Test Changes

Add assertions for:

```txt
no export function useSegmentedDocument(
no export type SegmentedDocumentContextValue
no export function EmailViewerFrame
no export function EmailHeader
no export function EmailContent
no export function EmailPartsSidebar
yes export function EmailViewerHeader
yes export function EmailViewerContent
yes export function EmailViewerPartsSidebar
no docs/examples import *-internal-context
no docs recommend public first-party part hooks
```

Tests should also keep existing protections:

```txt
no ViewerShell
no ViewerSlots
no renderDocument
no public useFileViewer
no public useEditViewer
no public usePdfViewer
no public useSplitViewer
no public usePartitionViewer
no public useParseViewer
no public usePageMarkdownViewer
```

## 7. Final Acceptance Criteria

The system reaches this blueprint's target when:

- no public hook returns a full viewer or segmented-document context;
- every public hook represents a real external composition seam;
- email part names match the domain-viewer naming pattern;
- `EmailViewerFrame` is not public API;
- stale email docs no longer teach removed hooks;
- internal selector modules are either removed or clearly isolated;
- PDF header customization follows the same replacement rule as FileViewer;
- tests enforce the absence of all removed surfaces;
- registry payloads match the source;
- file-system remains untouched.

## Implementation Order

1. Subtract `useSegmentedDocument()` and update segmented tests.
2. Rename email public parts and remove public `EmailViewerFrame`.
3. Update email tests and registry payloads.
4. Supersede stale email/viewer docs.
5. Fix `PdfViewerHeader` children semantics.
6. Add architecture tests for the new absences.
7. Run typecheck, targeted tests, registry build, and whitespace check.

## Final Test Commands

Run at minimum:

```bash
pnpm registry:build
pnpm exec tsc --noEmit --pretty false
pnpm exec vitest run tests/viewer-architecture.test.ts tests/email-viewer.test.tsx tests/pdf-viewer.test.tsx tests/segment-surfaces.test.tsx
pnpm exec eslint registry/new-york-v4/ui/email-viewer.tsx registry/new-york-v4/ui/pdf-viewer.tsx registry/new-york-v4/ui/segmented-document-provider.tsx tests/viewer-architecture.test.ts
git diff --check
```

## The Taste Test

After this work, a reader should be able to infer the system from JSX:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

And then infer every domain viewer as a named composition of that anatomy.

If a public export does not help that reading, it should not exist.
