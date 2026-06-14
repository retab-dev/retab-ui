# Viewer System Post-Merge Coherence Blueprint

## Objective

Define the next pass after merging anchored-document into the main viewer branch.

The goal is not to invent another abstraction.

The goal is to make the existing abstractions behave as one library:

```txt
viewer primitives
leaf viewers
domain providers
target adapters
source acquisition
anchored document interaction
```

The branch now contains several strong local designs. The next risk is that they
remain individually good but collectively noisy.

This pass should make the system feel inevitable.

## Current State

The merged architecture has the right ingredients:

- `ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSidebar`,
  `ViewerSurface`;
- leaf viewers that render sources;
- `EmailViewerProvider`;
- `PdfViewerProvider`;
- `FileSystemViewerProvider`;
- `UploadableFileViewerProvider`;
- `AnchoredDocumentProvider`;
- explicit PDF thumbnail sidebar composition;
- explicit split viewer composition;
- anchored extraction, OCR, edit, and multi-format source examples;
- dropzone/uploadable viewer composition.

The next work is not "add more primitives."

The next work is:

```txt
remove drift
remove duplicate vocabulary
remove old conceptual residue
prove the examples line up
```

## Standard

The viewer system is coherent only when:

- every composed viewer reads as the same grammar;
- every provider owns one state machine;
- every leaf viewer renders one source;
- every acquisition component produces sources but does not render documents;
- every anchored document experience uses the anchored provider;
- every registry example teaches the same mental model;
- every doc page names the same concepts the implementation uses;
- generated registry output matches source;
- tests guard the architecture instead of merely rendering happy paths.

No compatibility wrappers should be kept for emotional comfort.

## Non-Goals

Do not:

- add a universal `ViewerProvider`;
- add a generic `ViewerShell`;
- add slot-object APIs;
- add `anchoredItems` to leaf viewers;
- move dropzone state into viewer providers;
- move file rendering into domain sidebars;
- create generic anchored row components before visual convergence exists;
- preserve old names in comments because they are familiar.

The pass should be subtractive.

## Phase 1: Freeze The Dirty Tree

Before more design work, split the current dirty tree into coherent commits.

Suggested groups:

```txt
anchored document
  already committed as c1ddebb1

viewer primitives / composed viewers
  email
  split
  file-system
  PDF thumbnails

dropzone / uploadable viewer
  acquisition components
  examples
  registry output

data-cell / schema
  control contract
  picker/select/text controls
  tests

pretext markdown
  model
  renderer
  virtualizer
  table accessibility
  docs
```

Do not keep everything in one uncommitted mass. Architecture judgment becomes
weak when unrelated changes are tangled.

## Phase 2: System Vocabulary Audit

Create one naming table and enforce it across code, docs, examples, and tests.

Use:

```txt
Root
Header
Body
Sidebar
Surface
Provider
Source
Resource
Part
Segment
Item
Anchor
Target
Preview
Selected
Active
Activate
```

Avoid shared-layer drift:

```txt
Shell
Frame
Panel
Pane
Rail
Current
Hovered
Pinned
SourceLink
SourceMap
```

Domain names are allowed only at domain boundaries:

```txt
MIME part
split segment
file-system node
upload item
OCR block
extraction field
edit field
```

Architecture tests should search for forbidden shared-layer names where they
matter, not everywhere in the repo.

## Phase 3: Provider Boundary Audit

For every provider, write its one sentence and check imports against it.

### Email

```txt
EmailViewerProvider owns MIME projection and selected part.
```

Allowed:

- parse/project message;
- choose body or attachment;
- expose header, parts list, selected part hooks;
- recurse for nested messages.

Forbidden:

- generic viewer layout decisions;
- file rendering internals;
- anchored-document state;
- raw MIME tree as the primary sidebar UI.

### PDF

```txt
PdfViewerProvider owns PDF resource, page state, zoom, and header controls.
```

Allowed:

- current page;
- zoom;
- document resource;
- viewer handle coordination;
- thumbnails through explicit sidebar parts.

Forbidden:

- extraction fields;
- OCR blocks;
- anchored items;
- source maps;
- upload state.

### Split

```txt
SplitViewerProvider owns split result navigation and selected segment/page.
```

Allowed:

- segment selection;
- page rail state;
- workflow controls;
- segment legend state.

Forbidden:

- owning PDF rendering;
- `renderDocument` slots;
- duplicated PDF toolbar state.

### File System

```txt
FileSystemViewerProvider owns tree expansion, selection, and source resolution.
```

Allowed:

- folder/file selection;
- expansion;
- loading/error/empty states;
- selected source resolution.

Forbidden:

- becoming `FileViewer`;
- nested viewer shell;
- format-specific rendering logic.

### Uploadable File Viewer

```txt
UploadableFileViewerProvider owns acquisition queue and selected upload source.
```

Allowed:

- drop state;
- selected uploaded file;
- accepted/rejected items;
- source conversion.

Forbidden:

- format rendering;
- anchored document state;
- generic viewer layout alternatives.

### Anchored Document

```txt
AnchoredDocumentProvider owns item-anchor preview, selection, and activation.
```

Allowed:

- items;
- preview item;
- selected item;
- active item;
- target navigation.

Forbidden:

- layout;
- sidebars;
- fields;
- OCR blocks;
- MIME parts;
- source maps;
- leaf viewer imports.

## Phase 4: Example Coherence Audit

Every block should teach the same composition grammar.

Required examples:

- `email-viewer`;
- `pdf-thumbnails`;
- `split-viewer`;
- `file-system`;
- `dropzone-uploader-viewer`;
- `extract-viewer`;
- `extraction-viewer`;
- `layout-blocks`;
- `edit-viewer`.

For each example, verify:

- the JSX exposes the layout;
- provider is above named parts, not above generic primitives without reason;
- header is full-width when present;
- sidebar and surface are siblings under body;
- selected file rendering goes through a leaf viewer;
- domain sidebars do not contain nested file-viewer chrome;
- generated registry code matches source code.

## Phase 5: Visual Verification

Architecture tests are not enough.

Run browser verification for the blocks that prove composition:

```txt
/blocks#email-viewer
/blocks#pdf-thumbnails
/blocks#split-viewer
/blocks#file-system
/blocks#dropzone-uploader-viewer
/blocks#extract-viewer
/blocks#extraction-viewer
```

For each screenshot, check:

- no nested cards inside cards;
- no duplicated headers;
- sidebar and surface align;
- text does not overflow controls;
- thumbnails are square where intended;
- attachment/body sections are visually distinct;
- active/selected/preview states are legible;
- empty/loading/error states are not broken.

## Phase 6: Documentation Rewrite

The docs should stop describing components as isolated widgets.

They should explain the system:

```txt
Sources render in leaf viewers.
Domain viewers compose primitives.
Providers own one domain state machine.
Anchored document is optional item-anchor coordination.
Dropzone is acquisition.
```

Docs to audit:

- `content/docs/viewers/file-viewer.mdx`;
- `content/docs/viewers/pdf-viewer.mdx`;
- `content/docs/viewers/email-viewer.mdx`;
- `content/docs/components/split-viewer.mdx`;
- `content/docs/components/file-system.mdx`;
- dropzone docs;
- extraction/OCR docs if present.

Every doc should include at least one explicit composition example when the
component is compound.

## Phase 7: Tests

Add or strengthen architecture tests:

- generic viewer primitives stay at five;
- composed viewers use `ViewerRoot / Header / Body / Sidebar / Surface`;
- leaf viewers do not import domain providers;
- domain providers do not import unrelated providers;
- `FileViewer` does not accept layout or anchored props;
- `PdfViewer` does not accept thumbnail/sidebar/anchored props;
- dropzone does not import file viewer internals;
- anchored document core does not import source-map or leaf viewer types;
- docs examples contain the canonical grammar.

Add behavior tests where architecture alone cannot prove the experience:

- email body/attachment selection;
- split segment selection and document child rendering;
- file-system folder/file selection;
- uploadable viewer selected file rendering;
- PDF thumbnails current-page sync;
- anchored extraction preview/selection persistence.

## Phase 8: Registry Integrity

Registry integrity is a release gate.

Run:

```txt
bun run registry:build
```

Then verify:

- no stale registry JSON references deleted files;
- `public/r/registry.json` contains every new item;
- deleted items are gone;
- generated examples include current names;
- registry dependencies match source imports.

Do not hand-edit generated registry output unless resolving a merge conflict;
regenerate after resolving.

## Acceptance Criteria

This pass is complete when:

- dirty work is split into coherent commits;
- registry build passes;
- typecheck passes or remaining failures are explicitly outside viewer-system
  scope and documented;
- focused viewer tests pass;
- browser screenshots prove the main compound blocks render correctly;
- no component has two competing conceptual APIs;
- every provider has one sentence and import graph evidence supports it;
- docs teach the same model as the code;
- old names are absent from shared-layer code and docs;
- adding a new composed viewer has an obvious recipe.

## Final Recipe

The desired end state should be boring:

```tsx
<DomainProvider>
  <ViewerRoot>
    <DomainHeader />
    <ViewerBody>
      <ViewerSidebar>
        <DomainList />
      </ViewerSidebar>
      <ViewerSurface>
        <LeafViewer source={source} bare />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</DomainProvider>
```

If the domain has anchored interactions:

```tsx
<AnchoredDocumentProvider items={items} target={target}>
  <DomainProvider>
    <ViewerRoot>
      <DomainHeader />
      <ViewerBody>
        <ViewerSidebar>
          <DomainItems />
        </ViewerSidebar>
        <ViewerSurface>
          <LeafViewer source={source} bare overlay={overlay} />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </DomainProvider>
</AnchoredDocumentProvider>
```

That is the library.

Everything else is a domain detail.

