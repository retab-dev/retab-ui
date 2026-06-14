# Component Library System Coherence Platonic Blueprint

## Verdict

The component library has not reached the platonic ideal.

The direction is right when each layer has one job:

```txt
viewer primitives
  own spatial layout and sidebar mechanics

domain models
  own domain state and semantic projection

domain parts
  render named regions from one domain model

leaf viewers
  render one resolved source

registry pipeline
  publishes the exact source that was tested
```

The system is wrong whenever one concept has two paths.

The email audit proved the rule. The email content surface resolved CID inline
resources, but the sidebar thumbnail received the raw MIME source. The UI looked
mostly right, tests mostly passed, and the browser still emitted a raw `cid:`
request. That was not a visual bug. It was a system coherence bug: one MIME node
had two source-resolution paths.

The platonic ideal is the deletion of every such fork.

## Definition Of Perfection

Perfection means:

- one source of truth for authored component code;
- one source-resolution path per domain object;
- one layout grammar for composed viewers;
- one provider per domain state machine;
- one public word per concept;
- one registry generation path;
- one proof suite that catches model, render, registry, and browser drift;
- no compatibility adapters;
- no duplicate concepts with softer names;
- no speculative abstractions;
- no hidden state outside the owning layer.

Backward compatibility is not part of this judgment.

If the perfect shape requires a hard cut, the hard cut is the design.

## Current Coherence Facts

Last inspected: 2026-06-14.

The email route is now coherent under focused proof:

```txt
email unit tests: pass
email architecture slice: pass
email e2e route: pass
email registry payload: source-matching
email browser route: no raw cid, no failed cid requests, no console errors
```

The full tree is not coherent:

```txt
typecheck:
  blocked by file-system runtime code

components/ui vs registry/new-york-v4/ui:
  components/ui files: 192
  registry ui files: 325
  shared files: 190
  byte-identical shared files: 19
  divergent shared files: 171
  component-only files: 2
  registry-only files: 135

relative imports:
  currently resolvable
```

This means the tree is not broken at the import layer. It is broken at the
source-of-truth layer.

## The Final System

The final system has five layers.

```txt
1. canonical source
2. model layer
3. provider layer
4. primitive layout layer
5. generated distribution layer
```

Each layer must be explainable without referencing another layer's internals.

## Layer 1: Canonical Source

There must be exactly one authored implementation source for each component.

Given the current tree shape, the clean target is:

```txt
registry/new-york-v4/ui/*
  canonical authored component source

components/ui/*
  generated local import facade
  either re-export stubs or deleted where unused

public/r/*.json
  generated registry payload
```

The forbidden state is:

```txt
components/ui/button.tsx
registry/new-york-v4/ui/button.tsx
  both hand-edited
  both different
  both treated as real
```

The perfect rule:

```txt
No component implementation may have two authored copies.
```

A local docs app may import through `@/components/ui/*`, but those files must be
mechanically generated from the canonical source or become one-line facades:

```ts
export * from "@/registry/new-york-v4/ui/email-viewer"
```

If a facade needs local behavior, it is not a facade. Move that behavior to the
canonical source.

## Layer 2: Model Layer

Every domain viewer starts from a model, not from JSX.

The model layer owns semantic truth:

```txt
Email
  MIME tree
  message scope
  selected part
  inline resources
  body and attachment projection
  nested message recursion

PDF
  document resource
  page metrics
  current page
  zoom
  thumbnails

Split
  segments
  selected segment
  segment-page mapping
  viewport target

Dropzone
  acquisition queue
  upload state
  accepted/rejected files
  selected acquired source

Anchored evidence
  fields/items
  document anchors
  active anchor
  hover/preview target
```

The model layer returns complete render data:

```txt
labels
descriptions
selected flags
empty reasons
resolved sources
thumbnail sources
accessibility labels
counts
```

The render layer must not rediscover domain truth.

## The Source Resolution Law

Every displayable thing must pass through one resolver.

Email example:

```txt
MimePartNode
  -> resolveEmailPreviewSource()
  -> EmailFilePayload
  -> FileViewer or FileThumbnail
```

The content surface and the sidebar thumbnail must not each decide how to turn a
MIME part into a source. They must receive the same resolved source.

General rule:

```txt
Domain object
  -> domain resolver
  -> resolved viewer source
  -> leaf viewer or thumbnail
```

Forbidden:

```txt
main content path:
  domain object -> resolver -> safe source

thumbnail path:
  domain object -> raw source
```

This is the exact class of bug that leaked raw `cid:` URLs.

## Layer 3: Provider Layer

A provider is React transport for a domain model.

A provider is not:

- a layout primitive;
- a visual shell;
- a registry adapter;
- a compatibility layer;
- a generic event bus.

The perfect provider shape:

```tsx
<EmailViewerProvider message={message}>{children}</EmailViewerProvider>
```

The provider owns:

```txt
controlled/uncontrolled selection
model memoization
domain actions
resource materialization
resource cleanup
```

The provider does not own:

```txt
ViewerRoot frame
ViewerSidebar position
ViewerSurface size
FileViewer rendering
file-system selection
global app layout
```

Every provider should have a one-sentence contract:

```txt
EmailViewerProvider owns MIME projection and selected MIME part.
PdfViewerProvider owns PDF resource, page state, zoom, and thumbnails.
SplitViewerProvider owns split segments and selected segment/page.
DropzoneProvider owns source acquisition before sources enter viewers.
AnchoredDocumentProvider owns anchor activation between items and document.
```

If the sentence contains "and layout", the provider is wrong.

## Layer 4: Viewer Primitives

The viewer primitives are spatial grammar only.

The complete generic grammar is:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The sidebar trigger belongs to the nearest `ViewerRoot`:

```tsx
<ViewerSidebarTrigger />
```

The trigger must work from any descendant of that root:

```tsx
<ViewerHeader>
  <ViewerSidebarTrigger />
</ViewerHeader>

<Toolbar>
  <ViewerSidebarTrigger />
</Toolbar>

<ViewerSurface>
  <ViewerSidebarTrigger />
</ViewerSurface>
```

There is no separate generic sidebar provider.

`ViewerRoot` is the sidebar provider.

The primitive layer owns:

```txt
frame
border
radius
header/body/surface/sidebar slots
sidebar open state
sidebar registration
sidebar trigger wiring
responsive sidebar behavior
viewer-local CSS variables
spatial accessibility
```

The primitive layer does not own:

```txt
selected file
selected MIME part
current PDF page
split segment
dropzone queue
OCR block
extraction field
file-system node
```

## Domain Composition Shape

Every composed domain viewer should be expressible as:

```tsx
<DomainProvider>
  <ViewerRoot>
    <DomainHeader />
    <ViewerBody>
      <ViewerSidebar aria-label="Domain navigation">
        <DomainSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <DomainContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</DomainProvider>
```

The easy API is just the preassembled composition:

```tsx
<EmailViewer message={message} />
```

It must use the same provider and same named parts that consumers can compose
manually.

Forbidden:

```txt
Easy API uses private state path.
Composed API uses public state path.
Tests cover only easy API.
Registry exports only easy API.
```

That creates two systems.

## FileViewer Boundary

`FileViewer` is a leaf source router.

It owns:

```txt
one ViewerSource
format detection
format viewer dispatch
format-native loading/errors
format-native controls
```

It does not own:

```txt
email MIME selection
file-system browsing
dropzone acquisition
split navigation
OCR selection
extraction field selection
sidebar layout
domain headers
```

The correct relationship:

```txt
domain viewer contains FileViewer
FileViewer does not contain domain viewer
```

Examples:

```tsx
<EmailContent>
  <FileViewer source={selectedPart.source} />
</EmailContent>

<FileSystemViewerSurface>
  <FileViewer source={selectedFile.source} />
</FileSystemViewerSurface>

<DropzonePreview>
  <FileViewer source={selectedUpload.source} />
</DropzonePreview>
```

This is not a hierarchy of importance. It is a hierarchy of ownership.

## Email As The Reference Domain

The email viewer should remain the reference example because it exercises the
hardest boundaries:

```txt
recursive structure
domain header
domain sidebar
nested content
inline resources
attachments as file sources
HTML sandboxing
thumbnail rendering
controlled selection
resource cleanup
```

The ideal email model is:

```txt
EmailViewerMessage
  -> buildMimeTree()
  -> createMimeMessageScope()
  -> deriveEmailViewerModel()
      header
      sidebar
      content
```

The render path is:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot defaultSidebarOpen>
    <EmailHeader />
    <ViewerBody>
      <ViewerSurface>
        <EmailContent />
      </ViewerSurface>
      <ViewerSidebar side="right" aria-label="Email parts">
        <EmailPartsSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

The source path is:

```txt
MimePartNode
  -> resolveEmailPreviewSource()
  -> content.file.source
  -> FileViewer

MimePartNode
  -> resolveEmailPreviewSource()
  -> sidebar.item.thumbnail.source
  -> FileThumbnail
```

The same MIME node must not produce two different source meanings.

## Dropzone Boundary

Dropzone is source acquisition.

Dropzone does not become a viewer.

The perfect relationship:

```tsx
<DropzoneProvider>
  <ViewerRoot>
    <DropzoneHeader />
    <ViewerBody>
      <ViewerSidebar>
        <DropzoneFileList />
      </ViewerSidebar>
      <ViewerSurface>
        <FileViewer source={selectedUpload.source} />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</DropzoneProvider>
```

Dropzone owns:

```txt
drag state
paste state
input state
accepted files
rejected files
upload progress
selected upload
conversion to ViewerSource
```

FileViewer owns the preview.

ViewerRoot owns the layout.

## Anchored Evidence Boundary

Sources, OCR, extraction, and edit workflows should converge around one
anchored evidence model when they mean the same product concept.

The concept is not "source viewer" or "OCR viewer". The concept is:

```txt
semantic items anchored to document evidence
```

The perfect shared model:

```txt
AnchoredDocumentProvider
  document source/resource
  anchors
  active anchor
  preview anchor
  scroll/focus actions
```

Domain-specific layers supply item meaning:

```txt
Extraction
  fields and values

OCR
  blocks, lines, words

Sources
  citations and bounding boxes

Edit
  editable fields and validation
```

The shared provider should not know those business names. It should know
anchors, targets, activation, and document navigation.

## Registry Layer

The registry payload is generated distribution, not authored source.

The perfect rule:

```txt
source file changes
  -> registry build
  -> public/r payload changes
  -> registry index changes
  -> drift test passes
```

Forbidden:

```txt
manual JSON patching as normal workflow
source file changed but public/r unchanged
public/r changed but source unchanged
docs import code not present in registry payload
tests import a file not published by registry
```

Every registry item needs a drift proof:

```txt
for every public/r item:
  each payload file content exactly equals current source file content
```

This must be automated and mandatory.

## Docs Layer

Docs should demonstrate the public API, not private wiring.

Each component doc should include exactly three levels:

```txt
1. easy API
2. composed API
3. data contract
```

For email:

```tsx
<EmailViewer message={message} />
```

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot>
    <EmailHeader />
    <ViewerBody>
      <ViewerSurface>
        <EmailContent />
      </ViewerSurface>
      <ViewerSidebar aria-label="Email parts">
        <EmailPartsSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

Docs must not show old names, private paths, compatibility wrappers, or
deprecated hierarchy.

## Naming Law

One concept gets one name.

Use:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSidebarTrigger
ViewerSurface

FileViewer
FileThumbnail

EmailViewerProvider
EmailHeader
EmailPartsSidebar
EmailContent
```

Avoid duplicate generic synonyms:

```txt
ViewerShell
ViewerFrame
ViewerPanel
ViewerRail
ViewerContent
ViewerChrome
ViewerWrapper
```

Avoid domain names that hide ownership:

```txt
EmailAttachmentViewer
  unclear whether it owns MIME selection or file rendering

FileSystemFileViewer
  unclear whether it browses files or renders one source

SourcesViewer
  unclear whether it owns evidence, document, or both
```

Prefer names that expose the boundary:

```txt
EmailPartsSidebar
EmailContent
FileSystemTree
FileSystemContent
AnchoredEvidenceList
AnchoredDocumentSurface
DropzoneFileList
DropzonePreview
```

## State Law

State lives where the question is asked.

```txt
Is the sidebar open?
  ViewerRoot

Which MIME part is selected?
  EmailViewerProvider

Which upload is selected?
  DropzoneProvider

Which file-system node is selected?
  FileSystemViewerProvider

Which page is visible?
  PdfViewerProvider or document renderer state

Which anchor is active?
  AnchoredDocumentProvider
```

No state should be mirrored for convenience.

Derived state should be derived by pure functions.

## Performance Law

The ideal system is fast because it avoids duplicate work:

- build domain trees once per input identity;
- materialize object URLs only for the active inline resource scope;
- revoke object URLs on scope change;
- virtualize heavy document surfaces;
- keep thumbnails bounded and square;
- do not render hidden recursive viewers unnecessarily;
- keep source identity stable after resolution;
- avoid provider values that churn without semantic change.

The performance target is not only runtime speed. It is reader speed.

The fastest code to maintain is the code where every line has a reason.

## Accessibility Law

The primitives own spatial accessibility:

```txt
complementary regions
aria labels
aria-hidden for collapsed sidebars
trigger aria-expanded
focus rings
keyboard operability
responsive sidebar behavior
```

Domain parts own domain accessibility:

```txt
email part labels
attachment descriptions
body/attachment section headings
file names
empty reasons
error messages
```

Leaf viewers own format accessibility:

```txt
page labels
zoom controls
download controls
table semantics
image alt presentation policy
HTML iframe title/sandbox
```

## Test Law

Each composed viewer needs four proof layers.

### 1. Model Tests

Pure tests for domain projection:

```txt
input domain object
  -> model
  -> exact header/sidebar/content/empty/source shape
```

Email examples:

```txt
multipart related selects HTML body
inline resources collect content-id and content-location keys
sidebar body and content use the same resolved source
attachments do not become inline resources
nested messages obey recursion budget
security envelopes produce named empty states
```

### 2. Architecture Tests

Static tests for boundaries:

```txt
domain files do not import private leaf internals
viewer primitives do not import domain models
registry payload includes every required file
facades do not contain implementation logic
no forbidden vocabulary exports
```

### 3. Route E2E Tests

Browser tests for real composed behavior:

```txt
header/body/sidebar/surface hierarchy
sidebar trigger works
thumbnail geometry
no double nesting
surface width
mobile trigger
no raw domain URLs
no failed requests
no console errors
```

### 4. Registry Drift Tests

Distribution tests:

```txt
public/r payload content equals source
registry index includes item
docs install command points at existing item
demo imports public API
```

## CI Gate

The final CI gate is:

```txt
pnpm typecheck --pretty false
pnpm exec vitest run tests/viewer-architecture.test.ts
pnpm exec vitest run tests/email-viewer.test.tsx
pnpm exec vitest run tests/pdf-viewer.test.tsx
pnpm exec vitest run tests/dropzone.test.tsx
pnpm exec playwright test e2e/email-viewer.spec.ts
pnpm exec playwright test e2e/pdf-thumbnail-sidebar.spec.ts
node scripts/verify-registry-payloads.mjs
```

The exact command list can change. The principle cannot:

```txt
type proof
model proof
architecture proof
browser proof
registry proof
```

All must pass for the system to be called coherent.

## Required Hard Cuts

These are not optional if the target is perfection.

### 1. Kill Dual Authored Sources

Pick one canonical source. Generate or delete the other.

No manual divergence between `components/ui` and `registry/new-york-v4/ui`.

### 2. Kill Compatibility Wrappers

No `ViewerShell` as conceptual center.

No old props kept because examples still use them.

No aliases that let two names survive for one concept.

### 3. Kill Duplicate Source Resolution

Every domain object gets one resolver.

Content, thumbnail, download, and nested preview paths consume the resolved
object.

### 4. Kill Provider Nesting Without State Ownership

Providers exist only for state machines.

If a provider only exists to make a trigger work, that state belongs in
`ViewerRoot`.

### 5. Kill Test Assertions That Encode Serialization Accidents

Tests should assert meaning:

```txt
white background
not gray sidebar
no raw cid
no failed request
full-width surface
square thumbnail
```

They should not fail because one browser serializes white as `lab(100 0 0)`
instead of `rgb(255, 255, 255)`.

## Implementation Order

### Phase 1: Freeze The Grammar

Declare these as stable:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSidebarTrigger
ViewerSurface
FileViewer
FileThumbnail
```

Remove or demote generic synonyms.

### Phase 2: Canonicalize Source

Make one tree canonical.

Generate:

```txt
components/ui facades
public/r payloads
registry index
```

Add drift tests.

### Phase 3: Normalize Domain Models

For each domain viewer:

```txt
input contract
pure model
provider transport
named parts
easy API assembled from parts
```

No private easy-path implementation.

### Phase 4: Resolve Sources Once

For every domain:

```txt
domain object
  -> resolved source payload
  -> content + thumbnail + download
```

Add browser e2e checks for failed requests and raw protocol leaks.

### Phase 5: Compress Docs

Every doc page shows:

```txt
easy API
composed API
data contract
```

Nothing else unless it is needed for real use.

### Phase 6: Make CI The Judge

The word "coherent" should mean:

```txt
all proof layers pass on a clean tree
```

Not:

```txt
the component looks right in one route
```

## Acceptance Criteria

The system reaches the platonic ideal when all are true:

- there is exactly one authored implementation for every UI component;
- every facade is generated or trivial;
- every registry payload matches source;
- `pnpm typecheck --pretty false` passes;
- every composed viewer uses `ViewerRoot/Header/Body/Sidebar/Surface`;
- every sidebar trigger is owned by `ViewerRoot`;
- every domain provider owns exactly one state machine;
- every easy API is assembled from exported provider and parts;
- every domain source is resolved once and reused by content/thumbnails;
- browser tests catch raw URL/protocol leaks;
- file acquisition, file browsing, file rendering, and domain viewing are separate concepts;
- docs show the same API that tests and registry publish;
- no compatibility layer remains;
- no duplicate name remains for the same concept.

## Final Judgment

The platonic component library is not a larger abstraction.

It is a stricter one.

The perfect system is small because every layer refuses work that belongs to
another layer.

```txt
ViewerRoot owns space.
Domain providers own state.
Domain models own meaning.
FileViewer owns one source.
Registry owns distribution.
Tests own proof.
```

Everything else is either a named domain part or it should be deleted.
