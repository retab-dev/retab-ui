# Viewer System Existing Issues Blueprint

Last audited: 2026-06-14

## Objective

Inventory every meaningful issue in the current viewer system with enough
precision that the next implementation pass can remove ambiguity instead of
creating another abstraction layer.

This is a fault blueprint, not a defense of the current design.

The standard is the platonic ideal:

```txt
Simplicity.
Speed.
Everything needed.
Nothing more.
Perfect modularization.
High-entropy code.
Perfectly consistent names.
Flaubertian precision.
```

Compatibility is not a criterion here. The only question is whether the system
is the cleanest possible component system for file viewing, document review,
sidebars, thumbnails, email MIME parts, file-system browsing, dropzone upload,
OCR review, extraction review, split review, parse review, edit review, and the
registry/docs/tests around them.

## Current Verdict

The direction is mostly right, but the current system has not reached the
platonic ideal.

The good center is:

```txt
ViewerRoot owns viewer space.
ViewerSidebar is the spatial sidebar primitive.
ViewerSidebarTrigger toggles the nearest ViewerRoot sidebar.
ViewerSurface is the primary content region.
Domain providers own domain state.
FileViewer routes one file-like source to a renderer.
Format providers exist only when named format parts need shared state.
AnchoredDocumentProvider bridges semantic items to document targets.
Dropzone acquires sources before they enter the viewer system.
```

The remaining issues are not superficial. They are the issues that make the
component library feel close but not inevitable:

```txt
The primitive vocabulary is starting to grow semantic helper exports.
Viewer and FileViewer remain easy to confuse.
Full viewers and content renderers are still not separated by names.
FileViewer has no public named-part layer.
bare means too many things.
Some composed viewers still embed full viewers where renderers are needed.
Email still loses MIME body alternatives.
File-system gallery mode violates the viewer/sidebar/surface grammar.
OCR, extraction, sources, and edit share a pattern but not a precise product name.
The docs and architecture tests still encode conflicting old decisions.
The registry/public payload workflow still needs stricter proof.
```

## Non-Negotiable Vocabulary

These meanings should be treated as law.

```txt
ViewerRoot
  Spatial root. Owns viewer-local sidebar state and frame.

ViewerHeader
  Header region in the current ViewerRoot.

ViewerBody
  Flex body region in the current ViewerRoot.

ViewerSidebar
  One primary auxiliary panel for the current ViewerRoot.

ViewerSidebarTrigger
  Button that toggles the registered ViewerSidebar for the nearest ViewerRoot.

ViewerSurface
  Primary content region inside a ViewerBody.

FileViewer
  Routes one ViewerSource-like source to one file/document renderer.

Full format viewer
  Easy API that renders complete format chrome.
  Example: PdfViewer.

Format named part
  Explicit region of a format viewer.
  Example: PdfViewerHeader, PdfViewerPages, PdfViewerThumbnails.

Document renderer
  Content-only renderer for one resolved source/resource.
  Example target: PdfDocumentRenderer, HtmlDocumentRenderer.

Domain provider
  State owner for one workflow.
  Example: EmailViewerProvider, FileSystemProvider, SplitViewerProvider.

Domain part
  Named component consuming one domain provider.
  Example: EmailViewerHeader, EmailViewerPartsList.

Domain viewer
  Easy API assembled from the same public provider, viewer primitives, and parts.

AnchoredDocumentProvider
  Selection/preview bridge from semantic items to document anchors.
  It is not layout and not a file router.

Dropzone
  Source acquisition. It can feed FileViewer but must not become FileViewer.
```

The ideal domain composition remains:

```tsx
<DomainProvider>
  <ViewerRoot>
    <DomainHeader />
    <ViewerBody>
      <ViewerSidebar aria-label="Domain navigation">
        <DomainSidebarContent />
      </ViewerSidebar>
      <ViewerSurface>
        <FileViewer source={selectedSource} />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</DomainProvider>
```

When the selected content is not a generic file route, the surface should
contain an explicit content part:

```tsx
<ViewerSurface>
  <PdfViewerProvider source={source}>
    <PdfViewerPages />
  </PdfViewerProvider>
</ViewerSurface>
```

or the future renderer shape:

```tsx
<ViewerSurface>
  <PdfDocumentRenderer source={source} />
</ViewerSurface>
```

## Severity

```txt
P0 = conceptual contradiction, broken UI hierarchy, or likely product bug.
P1 = blocks the platonic public API.
P2 = proof, accessibility, docs, naming, or quality gap.
P3 = polish that should not drive architecture alone.
```

## Hard Contradictions In The Current Tree

These are the fastest ways to see that the system is not finished.

1. `registry/new-york-v4/ui/viewer.tsx` now exports semantic helpers
   `ViewerNavigationSidebar`, `ViewerInspectorSidebar`, and
   `ViewerDocumentSurface`, while the prior primitive law said the generic
   viewer exports should stay spatial and minimal.
2. `registry/new-york-v4/ui/file-system.tsx` makes gallery mode turn
   `ViewerSidebar` into `width="100%"` and removes `ViewerSurface`, which
   contradicts the desired grammar where the file-system tree/gallery is
   auxiliary and the selected file preview remains the primary surface.
3. `registry/new-york-v4/ui/segmented-document-viewer.tsx`,
   `registry/new-york-v4/blocks/parse-viewer-block.tsx`,
   `components/viewers/edit/edit-viewer-document-pane.tsx`, and several docs
   still embed full `PdfViewer` instances inside existing viewer surfaces.
4. `registry/new-york-v4/ui/email-viewer.tsx` still renders only one body node
   in the MIME sidebar and labels it generically as `Body`.
5. `registry/new-york-v4/ui/file-viewer.tsx` routes into a mixed set of names:
   `PdfResourceViewer`, `DocxResourceViewer`, `ImageResourceViewer`,
   `PptxResourceViewer`, `XlsxResourceViewer`, `CsvDocViewer`,
   `HtmlDocViewer`, `ChenglouTextViewer`, `PretextMarkdownViewer`, and
   `CodeViewer`.
6. `bare` appears across almost every viewer and renderer, but its meaning is
   not consistent enough to be trusted as a structural boundary.
7. `tests/viewer-architecture.test.ts` still contains string-level assertions
   that encode old decisions, including the gallery full-body grammar.
8. Public docs still show non-ideal embedded full viewers in composition
   examples.

## Issue 1: `Viewer` And `FileViewer` Still Sound Too Similar

Severity: P1

Evidence:

- `registry/new-york-v4/ui/viewer.tsx` exports the spatial primitives.
- `registry/new-york-v4/ui/file-viewer.tsx` exports a source router.
- Docs and examples repeatedly use "viewer" for both the outer spatial root and
  the leaf file renderer.

Why it matters:

The authors of the library are still asking whether `Viewer` and `FileViewer`
should be folded together. That is enough proof that the boundary is not
communicated with perfect clarity.

Target:

Keep the two concepts separate, but make the distinction impossible to miss:

```txt
ViewerRoot = spatial composition.
FileViewer = one-source file rendering route.
DomainViewer = workflow composition over ViewerRoot and FileViewer/renderers.
```

Proof:

- Docs define the distinction before usage examples.
- `FileViewer` never imports `ViewerSidebar`, workflow providers, or domain
  state.
- Domain viewers compose `ViewerRoot` explicitly instead of hiding spatial
  structure behind `FileViewer`.

## Issue 2: The Generic Viewer Primitive Is Growing Semantic Taxonomy

Severity: P1

Evidence:

`registry/new-york-v4/ui/viewer.tsx` includes:

```txt
ViewerSurfaceRole = primary-document | supporting-document | metadata
ViewerSidebarPurpose = navigation | inspector | outline | parts
ViewerNavigationSidebar
ViewerInspectorSidebar
ViewerDocumentSurface
```

Why it matters:

This may be a useful move, but it changes the primitive from pure spatial
grammar into a semantic taxonomy. If the taxonomy is incomplete, every domain
will either misuse it or ask for another purpose:

```txt
parts
fields
pages
attachments
sources
blocks
metadata
queue
tree
gallery
outline
inspector
navigation
```

That is the beginning of generic semantic sprawl.

Target:

Choose one of two designs:

1. Pure primitive:
   - remove `viewerPurpose`, `viewerRole`, and semantic wrapper exports;
   - let domains label sidebars and surfaces with `aria-label` and
     `data-slot`;
   - keep `ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSidebar`,
     `ViewerSidebarTrigger`, and `ViewerSurface`.
2. Intentional semantic primitive:
   - keep semantic roles;
   - document the exact finite list;
   - show how domains map onto it;
   - prove the list does not need app-specific growth.

The platonic preference is the pure primitive unless accessibility proof shows
that the semantic layer pays for itself.

Proof:

- Architecture test matches the chosen export list.
- Public docs teach either pure spatial grammar or the exact semantic role
  grammar, not both.
- No domain-specific term is added to `viewer.tsx` unless it is proven generic.

## Issue 3: Full Viewers And Content Renderers Are Not Separated By Names

Severity: P0

Evidence:

Current public and internal names include:

```txt
PdfViewer
PdfResourceViewer
PdfViewerPages
ImageViewer
ImageResourceViewer
DocxViewer
DocxResourceViewer
XlsxViewer
XlsxResourceViewer
PptxViewer
PptxResourceViewer
CsvViewer
CsvDocViewer
HtmlDocViewer
TextViewer
ChenglouTextViewer
PretextMarkdownViewer
CodeViewer
```

Why it matters:

The name does not reliably tell the user whether a component renders:

```txt
a complete framed viewer;
a format provider-backed named part;
a content-only renderer;
a resource-first internal entry;
a file-router branch.
```

That is why full viewers are still being nested inside surfaces.

Target:

Use one role-based naming scheme.

Full easy APIs:

```txt
PdfViewer
ImageViewer
DocxViewer
XlsxViewer
CsvViewer
HtmlViewer
TextViewer
CodeViewer
PptxViewer
PretextMarkdownViewer
```

Named parts:

```txt
PdfViewerHeader
PdfViewerPages
PdfViewerThumbnails
FileViewerHeader
FileViewerContent
```

Content-only renderers:

```txt
PdfDocumentRenderer
ImageDocumentRenderer
DocxDocumentRenderer
XlsxDocumentRenderer
CsvDocumentRenderer
HtmlDocumentRenderer
TextDocumentRenderer
CodeDocumentRenderer
PptxDocumentRenderer
PretextMarkdownDocumentRenderer
```

Proof:

- No public recommended docs mention `*ResourceViewer` or `*DocViewer`.
- `FileViewer` routes to document renderers or private internals with
  unambiguous names.
- Composed viewers never embed a full viewer when a renderer or named content
  part exists.

## Issue 4: `FileViewer` Has No Public Named-Part Middle Layer

Severity: P1

Evidence:

The easy API exists:

```tsx
<FileViewer source={source} />
```

But the equivalent decomposed API does not exist:

```tsx
<FileViewerProvider source={source}>
  <FileViewerHeader />
  <FileViewerContent />
</FileViewerProvider>
```

Why it matters:

Email, file-system, dropzone, edit, and future workflows need precise control
over file identity, file controls, and file content. Today they either:

```txt
use full FileViewer bare;
reach into format-specific internals;
accept duplicate or missing chrome;
invent local wrappers.
```

Target:

Decide explicitly:

1. No public `FileViewerProvider`:
   - then every workflow must use content-only document renderers.
2. Add a narrow public `FileViewerProvider`:
   - owns one source;
   - resolves one resource;
   - selects one renderer;
   - exposes `FileViewerHeader` and `FileViewerContent`;
   - owns no sidebar, upload queue, MIME tree, file-system tree, extraction
     state, or anchored selection.

Proof:

- Email body preview can render content without duplicate metadata.
- File-system preview can show file metadata once.
- Dropzone can show upload state outside the file content.
- No workflow imports `file-viewer-core` or `file-viewer-chrome`.

## Issue 5: `bare` Is Overloaded

Severity: P1

Evidence:

`bare` appears on `ViewerRoot`, `FileViewer`, `PdfViewer`, PDF states,
image/docx/xlsx/pptx/text/code/Markdown frames, error states, fallbacks, and
docs.

Current meanings include:

```txt
remove border;
remove radius;
change background;
fill parent height;
hide an outer card;
render embedded;
remove a toolbar;
make a full viewer look like a renderer;
avoid double nesting visually.
```

Why it matters:

`bare` hides visual symptoms but does not create the right component boundary.
It can make nested full viewers look acceptable while the DOM and provider
hierarchy are still wrong.

Target:

Define exactly one meaning:

```txt
bare = remove only the component's outer frame so the parent owns the frame.
```

Separate concepts must get separate APIs:

```txt
content-only -> use a renderer or named content part.
no-toolbar -> use a named content part or toolbar={false}.
fill-parent -> className or a dedicated size prop if necessary.
```

Proof:

- Docs define `bare` once and reuse the same wording everywhere.
- Tests prove `bare` does not remove required controls from full viewers.
- Examples stop relying on `bare` to turn full viewers into renderers.

## Issue 6: `ViewerRoot` Is Both Provider And Frame

Severity: P2

Evidence:

`ViewerRoot` owns:

```txt
context provider;
sidebar open state;
sidebar registration;
auto inline/overlay measurement;
border/radius/background;
bare frame mode.
```

Why it matters:

The provider role is right. The styled-frame role may also be right. The issue
is that the primitive simultaneously answers:

```txt
How do viewer parts communicate?
What should a default viewer frame look like?
```

Target:

Make this deliberate:

```txt
ViewerRoot is the canonical viewer frame.
ViewerRoot bare is the embedded frame mode.
```

or:

```txt
ViewerRoot is structural only.
ViewerFrame owns border/background/radius.
```

The current code leans toward the first. If kept, docs and tests should say so.

Proof:

- Docs show framed root and bare root.
- Nested examples show why `bare` belongs on the nested root only when the
  nested component is truly a complete viewer.
- Browser screenshots show no accidental double borders.

## Issue 7: One Sidebar Per Root Needs A Chosen Failure Philosophy

Severity: P1

Evidence:

`ViewerRoot` throws when a second `ViewerSidebar` registers under the same root.

Why it matters:

The invariant is correct:

```txt
one ViewerRoot;
one primary ViewerSidebar;
one sidebar state machine;
one trigger target.
```

But unconditional production throws need to be a conscious library decision.

Target:

Choose one:

```txt
strict always: throw in every environment and document it;
strict in development: throw in development and degrade predictably in production.
```

Proof:

- Tests cover duplicate sidebars under one root.
- Tests cover nested roots each registering one sidebar.
- Docs state the invariant.

## Issue 8: Sidebar Registration Is Effect-Timed

Severity: P2

Evidence:

Before `ViewerSidebar` registers, `ViewerSidebarTrigger` uses fallback data:

```txt
fallback sidebar id;
default left side;
canToggleSidebar=false;
aria-disabled=true.
```

Why it matters:

This is acceptable in a shadcn-style composition model, but it creates a
short-lived unregistered state. If the component is used in SSR, Suspense,
conditional rendering, or a lazy sidebar, that state needs proof.

Target:

Keep effect registration, but treat it as an explicit design:

```txt
Triggers may render before sidebars register.
They are inert until registration.
They become active when a collapsible sidebar exists.
```

Proof:

- Test initial trigger state without sidebar.
- Test conditional sidebar mount activates the trigger.
- Test SSR/hydration produces stable ids and no warnings.

## Issue 9: Trigger Without Sidebar Is A Softly Invalid Control

Severity: P2

Evidence:

When no sidebar registers, trigger renders with `aria-disabled=true`, but the
button is not natively disabled unless the caller passes `disabled`.

Why it matters:

A keyboard user can focus a control that cannot do anything. That may be the
right tradeoff for lazy sidebars, but it is not yet specified.

Target:

Choose one:

```txt
aria-disabled but focusable for lazy sidebar compatibility;
native disabled when no sidebar is registered;
development warning for a trigger that never gets a sidebar.
```

Proof:

- Keyboard tests for no-sidebar trigger.
- Conditional sidebar test.
- Docs explain why the trigger may be inert during registration.

## Issue 10: Overlay Sidebar Focus Model Is Only Partially Specified

Severity: P1

Evidence:

Overlay sidebars:

```txt
close on Escape;
close on outside pointer down;
ignore same-root trigger pointer races;
return focus to the last trigger on Escape when possible;
do not trap focus;
do not render a scrim.
```

Why it matters:

This can be the correct non-modal navigation model, but it must not become a
half-dialog by accident.

Target:

Document the model:

```txt
Viewer overlay sidebar is non-modal.
It is not a dialog.
It does not trap focus.
Escape closes it.
Outside pointer down closes it.
Same-root trigger toggles it.
Focus returns on Escape if the trigger still exists.
Inline sidebars ignore Escape by default.
```

Proof:

- Tests for Escape, focus return, outside pointer down, inside pointer down,
  trigger click, nested root trigger isolation, and inline mode.
- Docs compare overlay sidebar to non-modal navigation, not Dialog.

## Issue 11: Resize Behavior Is Implemented But Not A Settled Design

Severity: P2

Evidence:

`ViewerRoot` uses `ResizeObserver`, an inline breakpoint, and hysteresis.

Why it matters:

The implementation is reasonable, but the design choice is still implicit:

```txt
React measurement state versus CSS container queries.
Overlay fallback when ResizeObserver is missing.
Breakpoint/hysteresis values.
```

Target:

Keep the JS path only if it is fully documented and tested. Otherwise move to a
CSS container-query design.

Proof:

- Tests for unavailable `ResizeObserver`.
- Tests for 0px measurements.
- Tests for hysteresis around the breakpoint.
- Browser screenshots for narrow and wide containers.

## Issue 12: `ViewerSurface` Has Weak Accessibility Semantics

Severity: P2

Evidence:

`ViewerSurface` is a `div`. It can carry `viewerRole`, but it does not provide
an accessible name or landmark by default.

Why it matters:

The document preview area is often the primary region a user needs to find.
Silence may be acceptable if the renderer provides the accessible document
region, but that is not enforced.

Target:

Choose a rule:

```txt
composed viewers label ViewerSurface with role="region";
or content renderers own the accessible document region;
or semantic wrapper exports provide the label contract.
```

Proof:

- Email, PDF thumbnails, file-system, extraction, OCR, edit, and dropzone have
  discoverable main regions.
- Nested viewers do not create duplicate main landmarks.

## Issue 13: `ViewerBody` Allows Multiple Primary Surfaces Without Naming The Pattern

Severity: P2

Evidence:

Parse uses two `ViewerSurface` siblings inside a resizable panel group. Other
workflows may need side-by-side documents.

Why it matters:

The grammar says `ViewerSurface` is primary content. Two peer surfaces means a
split workspace, not one primary region.

Target:

Either document that `ViewerBody` is a low-level flex grammar that may contain
multiple surfaces, or make split workspaces explicit inside one surface:

```tsx
<ViewerSurface>
  <ResizablePanelGroup>...</ResizablePanelGroup>
</ViewerSurface>
```

Proof:

- Parse docs state the chosen grammar.
- Architecture tests do not treat every multi-pane layout as a sidebar.
- Browser screenshots show equal-height split panes.

## Issue 14: The Second Sidebar System Pollutes The Vocabulary

Severity: P1

Evidence:

The codebase has both:

```txt
ViewerSidebar
Sidebar
EmbeddedSidebarProvider
AttachmentSidebar
SegmentSidebar
```

`SegmentSidebar` uses `EmbeddedSidebarProvider` internally. `AttachmentSidebar`
also uses the shadcn-style sidebar stack. Email deliberately avoids it.

Why it matters:

There are two meanings for "sidebar":

```txt
spatial viewer sidebar;
row/list/menu styling system.
```

The distinction can be correct, but the names do not make it obvious enough.

Target:

Keep `ViewerSidebar` as the only spatial viewer sidebar.

If the shadcn sidebar primitives are used inside the panel, docs must name them
as list/menu styling infrastructure, not spatial ownership:

```txt
ViewerSidebar = panel placement and collapse.
Sidebar / EmbeddedSidebarProvider = sidebar-themed row/menu styling.
```

Proof:

- Docs explain the boundary once.
- Domain sidebars never use `SidebarProvider` to control viewer layout.
- `AttachmentSidebar` is either renamed to `AttachmentList`/`AttachmentPanel`
  or explicitly documented as a complete row system, not a spatial viewer
  primitive.

## Issue 15: `FileViewer` Routes Into Mixed Chrome Contracts

Severity: P0

Evidence:

`registry/new-york-v4/ui/file-viewer.tsx` routes to:

```txt
PdfResourceViewer
ImageResourceViewer
DocxResourceViewer
PptxResourceViewer
XlsxResourceViewer
CsvDocViewer
HtmlDocViewer
PretextMarkdownViewer
ChenglouTextViewer
CodeViewer
```

Why it matters:

These branches do not share one public contract for:

```txt
file identity;
toolbar controls;
download;
loading state;
error state;
content-only rendering;
embedded rendering;
outer frame.
```

Target:

Route through one normalized renderer contract:

```txt
source -> resource -> descriptor -> document renderer
```

with optional file chrome above it:

```txt
FileViewerHeader
FileViewerContent
```

Proof:

- Every category has a renderer with the same high-level props.
- `FileViewer` does not special-case visual chrome differently per route.
- Email and file-system can opt into content-only without private imports.

## Issue 16: Resource-First Internals Are Public-Looking

Severity: P1

Evidence:

Names like `PdfResourceViewer` and `ImageResourceViewer` are exported and used
as if they are parts of the public system.

Why it matters:

`ResourceViewer` sounds like a complete viewer. In practice it is a lower-level
entry for an already resolved `ViewerResource`.

Target:

Make resource-first components private, or rename them as renderer internals:

```txt
PdfDocumentRenderer
PdfDocumentRendererFromResource
```

Proof:

- Public docs do not recommend `ResourceViewer`.
- Registry exports expose only the intended public grammar.

## Issue 17: File Viewer Error, Empty, Loading, And Unsupported States Are Not Unified

Severity: P2

Evidence:

The system has:

```txt
ViewerFallback
UnsupportedCard
FileErrorBoundary
ViewerErrorBoundary
PdfViewerFallback
format-specific fallback frames
FileSystemPreview messages
Email MIME "not previewable" message
Dropzone empty state
```

Why it matters:

Different states occupy different visual hierarchy levels. Some replace the
file content, some replace the whole frame, some include download actions, some
do not.

Target:

Define a state placement rule:

```txt
source acquisition state belongs to acquisition provider.
resource loading state belongs to renderer/content region.
unsupported format state belongs to FileViewerContent.
workflow empty state belongs to domain surface.
fatal viewer state belongs to the smallest failing region.
```

Proof:

- State matrix for each viewer.
- Tests cover loading, empty, unsupported, render error, retry, and download.
- Visual screenshots show states at the same hierarchy level.

## Issue 18: Format Controls Do Not Share A Common Contribution Mechanism

Severity: P1

Evidence:

PDF pushes header controls from the rendered pages into the provider. Other
formats have local toolbar/frame patterns. `FileViewer` has no cross-format
header contribution model.

Why it matters:

The common file header cannot be built cleanly until format controls can
contribute commands without every domain reimplementing them.

Target:

Either:

```txt
format controls stay inside content renderers;
```

or:

```txt
renderers register controls into FileViewerProvider / format provider.
```

Proof:

- PDF, image, text/code, CSV/XLSX, DOCX, and PPTX each expose controls in the
  chosen place.
- Header controls reset correctly on source change.
- Strict mode does not leave stale controls.

## Issue 19: `PdfViewer` Is Still Used As Both Full Viewer And Embedded Leaf

Severity: P0

Evidence:

Full `PdfViewer` is still embedded in:

- `registry/new-york-v4/ui/segmented-document-viewer.tsx`
- `registry/new-york-v4/blocks/parse-viewer-block.tsx`
- `components/viewers/edit/edit-viewer-document-pane.tsx`
- `registry/new-york-v4/blocks/json-form-sources-block.tsx`
- `registry/new-york-v4/blocks/legend-variants-block.tsx`
- docs for split, extract, parse, and related workflows.

Why it matters:

This creates nested viewer roots and nested file chrome where the parent
workflow already owns the layout.

Target:

Inside another viewer, use:

```tsx
<PdfViewerProvider source={source}>
  <PdfViewerPages />
</PdfViewerProvider>
```

or the future:

```tsx
<PdfDocumentRenderer source={source} />
```

Use `<PdfViewer />` only when the PDF is the complete viewer.

Proof:

- Architecture test catches full `PdfViewer` in composed workflow surfaces.
- Docs use `PdfViewerPages` or renderer in composition examples.
- Browser screenshots show no double headers or frames.

## Issue 20: `PdfViewerPages` Still Depends On `PdfResourceViewer`

Severity: P1

Evidence:

`PdfViewerPages` renders `PdfResourceViewer` with `toolbar={false}`.

Why it matters:

The public part is good, but the internal name and behavior still reflect the
old contract. `toolbar={false}` is a prop-based way to turn a fuller thing into
a content part.

Target:

Make the content part a true content renderer:

```txt
PdfViewerPages -> PdfDocumentRenderer
```

or keep the current shape but hide `PdfResourceViewer` from public usage.

Proof:

- `PdfViewerPages` has no conceptual dependency on "resource viewer" naming in
  docs.
- `PdfResourceViewer` is private or renamed.

## Issue 21: PDF Header Controls Use Hidden Child-To-Provider Registration

Severity: P1

Evidence:

`PdfViewerHeader` reads `headerControls`; `PdfResourceViewer` computes them and
sets them through provider state.

Why it matters:

The visual tree says header first, pages second. The data flow says pages
produce header controls after render. That is workable but non-obvious.

Target:

Either document this as the required controller bridge, or move the controller
up into `PdfViewerProvider`.

Proof:

- Header fallback state is correct before controls exist.
- Controls clear on document change.
- Strict mode does not duplicate or leak controls.

## Issue 22: `PdfViewerThumbnails` Is Misnamed

Severity: P1

Evidence:

`registry/new-york-v4/ui/pdf-viewer-thumbnails.tsx` exports
`PdfViewerThumbnails` as an alias to `PdfViewerThumbnails`.

Why it matters:

The spatial sidebar is `ViewerSidebar`. The thumbnail content is not the
sidebar. The old name brings back the original confusion.

Target:

Use:

```txt
PdfViewerThumbnails
PdfThumbnailRail
PdfThumbnailItem
```

Remove `PdfViewerThumbnails` unless it actually renders a `ViewerSidebar`.

Proof:

- Public docs and blocks import `PdfViewerThumbnails`.
- Registry item names are aligned with the chosen public API.

## Issue 23: PDF Thumbnail Width Has Two Owners

Severity: P2

Evidence:

The block sets:

```tsx
<ViewerSidebar width="9rem">
  <PdfViewerThumbnails />
</ViewerSidebar>
```

`PdfViewerThumbnails` also accepts `width?: number` for thumbnail size.

Why it matters:

One width is layout panel width. The other is thumbnail image width. The names
are the same conceptually but different physically.

Target:

Rename or document:

```txt
ViewerSidebar width = panel width.
PdfViewerThumbnails thumbnailWidth = thumbnail canvas width.
```

Proof:

- Props use distinct names.
- Tests/screenshot prove square/consistent thumbnail sizing.

## Issue 24: Email MIME Projection Loses Body Alternatives

Severity: P0

Evidence:

`getSidebarSections` picks one body node:

```txt
prefer text/html;
else text/plain;
else first renderable node.
```

Why it matters:

For `multipart/alternative`, the user should see useful alternatives:

```txt
Body
  Text body
  HTML body

Attachments
  prospectus.pdf
  sales.csv
```

Current behavior hides valid body representations.

Target:

Project all useful renderable body leaves:

```txt
non-attachment;
non-inline-resource;
non-structural multipart;
deduped/grouped by multipart semantics where needed.
```

Proof:

- Test text + HTML body alternatives both appear.
- Default selection still prefers HTML when present.
- Inline CID resources stay hidden from attachments.
- Attachments still include every regular attachment.

## Issue 25: Email Body Labels Are Too Generic

Severity: P1

Evidence:

`MimePartSidebarItem` receives `label="Body"` for body rows.

Why it matters:

Users need to distinguish:

```txt
Text body
HTML body
Markdown body
Attached message
review-note.html
```

Target:

Rows should use semantic labels, not section labels.

Proof:

- Tests assert "Text body" and "HTML body" row labels.
- Screenshot shows left alignment and truncation.

## Issue 26: Email Selected Part Uses Full `FileViewer bare`

Severity: P1

Evidence:

`EmailViewerSelectedPart` renders:

```tsx
<FileViewer source={display.source} as={display.category} bare />
```

Why it matters:

Email already has a message header and parts sidebar. For body content, a file
metadata header is usually noise. For attachments, a compact file toolbar may
be appropriate. A single `FileViewer bare` cannot express that distinction.

Target:

Email selected-part rendering should choose:

```txt
body preview: content-only renderer, no file identity header;
attachment preview: content renderer plus compact attachment controls;
message/rfc822: nested EmailViewer because it is a complete nested message.
```

Proof:

- HTML body preview has no duplicate metadata header.
- HTML attachment preview has exactly one clear toolbar.
- PDF attachment keeps page controls and download.
- Text body preview has readable spacing.

## Issue 27: Recursive Email Is Correct But Unbounded

Severity: P2

Evidence:

`message/rfc822` renders nested `<EmailViewer bare />`.

Why it matters:

This is semantically right for attached emails, but deep recursion can create
many providers, roots, resize observers, headers, and sidebar states.

Target:

Keep recursion but bound it:

```txt
render nested email only when selected;
add depth-aware compact styling if needed;
avoid eager descendant rendering;
ensure nested trigger targets nearest root.
```

Proof:

- Test nested `message/rfc822`.
- Test deep nesting does not mount every descendant eagerly.
- Browser screenshot for nested hierarchy.

## Issue 28: File-System Gallery Mode Violates Viewer Grammar

Severity: P0

Evidence:

`FileSystemBody` currently does this:

```txt
if gallery:
  ViewerSidebar width = 100%;
  ViewerSurface is not rendered.
else:
  ViewerSidebar width = min(22rem, 85vw);
  ViewerSurface contains FileSystemSelectedFile.
```

Why it matters:

This makes `ViewerSidebar` mean "the entire file browser" instead of "auxiliary
navigation/context". It destroys the root grammar exactly where file-system is
supposed to prove the model:

```txt
header;
body;
sidebar for file system;
surface for selected file.
```

Target:

File-system should always keep the same skeleton:

```tsx
<ViewerBody>
  <ViewerSidebar aria-label="Files" width="min(22rem, 85vw)">
    <FileSystemExplorer />
  </ViewerSidebar>
  <ViewerSurface>
    <FileSystemSelectedFile />
  </ViewerSurface>
</ViewerBody>
```

If gallery is a primary browsing mode, it belongs inside `FileSystemExplorer`,
not by replacing the whole viewer body.

Proof:

- Gallery mode still renders `ViewerSurface`.
- Sidebar width remains auxiliary.
- Screenshot proves gallery/list/grid/columns preserve the same spatial
  hierarchy.

## Issue 29: File-System Preview Uses `aside` Inside `ViewerSurface`

Severity: P1

Evidence:

`FileSystemPreview` renders an `aside` even though it is placed inside
`ViewerSurface`.

Why it matters:

An `aside` inside the primary surface says "auxiliary content inside primary
content". But the selected file preview is the primary region of the
file-system viewer.

Target:

Use a region/content element for the selected preview:

```txt
section or div with role/label if needed;
not aside.
```

Proof:

- File-system preview exposes "File preview" as a discoverable region without
  misusing landmark semantics.
- No nested auxiliary landmark inside the primary surface.

## Issue 30: File-System Has Two Open Models

Severity: P1

Evidence:

File-system has:

```txt
selected file preview in ViewerSurface;
openedFile dialog through FileSystemOpenDialog;
onFileOpen override path.
```

Why it matters:

Selection, preview, and opening are related but distinct. The current API can
make it unclear whether clicking a file selects, previews, opens, or delegates
to `onFileOpen`.

Target:

Name the three actions precisely:

```txt
select file -> affects ViewerSurface preview.
open file -> explicit command/dialog/external callback.
resolve source -> async data acquisition for preview/open.
```

Proof:

- Tests cover click, keyboard selection, open command, dialog close, and
  external `onFileOpen`.
- Docs define the interaction model.

## Issue 31: Pierre File-System Bridge Is Powerful But Dense

Severity: P2

Evidence:

The file-system tree/list now has Pierre bridge modules:

```txt
file-system-pierre-input.ts
file-system-pierre-model.ts
file-system-pierre-decoration.ts
file-system-pierre-decoration-version.ts
file-system-pierre-order.ts
file-system-pierre-selection.ts
file-system-pierre-expansion.ts
```

Why it matters:

This may be the right performance layer, but it is now its own subsystem. If
the naming is not exact, the file-system viewer will become difficult to
maintain.

Target:

Make the bridge boundary explicit:

```txt
FileSystemController owns domain state.
Pierre input adapts entries to Pierre.
Pierre model owns ordering/selection/expansion projection.
React views render projected rows.
Decoration modules own presentation-only row state.
```

Proof:

- Tests for path conversion, ordering, expansion, selection, and decoration.
- React list views do not construct Pierre models directly.
- No compatibility alias remains unless intentionally chosen as a final API.

## Issue 32: File-System Naming Is Not Aligned With The Viewer Vocabulary

Severity: P2

Evidence:

The exported easy API is `FileSystem`, with provider `FileSystemProvider`,
header `FileSystemHeader`, explorer `FileSystemExplorer`, selected part
`FileSystemSelectedFile`.

Why it matters:

This is not wrong, but it differs from names like `EmailViewer`,
`SplitViewer`, `PdfViewer`. The component is a viewer-like domain composition
but is named as a domain object.

Target:

Choose:

```txt
FileSystem = component is a file-system browser, not necessarily a viewer;
```

or:

```txt
FileSystemViewer = explicit viewer composition.
```

Do not keep both unless one is a documented alias and compatibility does not
matter.

Proof:

- Docs use one name consistently.
- Registry item name matches component identity.

## Issue 33: Split Viewer Uses `children` As The Document Contract

Severity: P1

Evidence:

`SplitViewerDocument` renders `children` when output exists. Consumers wire the
actual source document outside the split provider.

Why it matters:

This is flexible, but the contract is implicit. The split viewer owns segment
navigation and page scroll state, but the child must know to call
`useSplitViewerDocumentControls`.

Target:

Keep children if it remains the cleanest extension point, but name the pattern:

```txt
SplitViewerDocument is a slot-like named part.
Document child must bind to useSplitViewerDocumentControls.
```

or provide a first-class `SplitViewerDocumentSurface`.

Proof:

- Docs show the exact child contract.
- Test proves document controls can be consumed by the child.
- No hidden `renderDocument` slot object returns.

## Issue 34: Segmented Document Viewer Duplicates Split Concepts

Severity: P1

Evidence:

`SegmentedDocumentViewer` composes segment sidebar, legend, page timeline, and
optional PDF. Split viewer also owns segment/page rail/legend/page state.

Why it matters:

The same product language appears in two places:

```txt
segment sidebar;
segment legend;
page rail/timeline/ribbon;
current page;
scroll to segment start.
```

Target:

Define whether `SegmentedDocumentViewer` is:

```txt
the reusable segment review primitive used by split/partition;
```

or:

```txt
a demo/legacy composition that should be replaced by split/partition parts.
```

Proof:

- One segment-review vocabulary in docs.
- Shared segment interactions live in one place.
- Full `PdfViewer` nesting is removed from `SegmentedDocumentViewer`.

## Issue 35: OCR, Extraction, Sources, And Edit Share A Pattern But Not A Name

Severity: P1

Evidence:

The following all use a document plus semantic item panel:

```txt
ExtractViewerBlock
ExtractionViewerBlock
DocumentAiLayoutBlocks
EditViewer
TextSourcesBlock
JsonForm sources block
image/csv/xlsx/docx sources blocks
```

They share:

```txt
AnchoredDocumentProvider;
active/preview/selected item;
document target adapter;
overlay/highlight;
sidebar/panel of semantic items;
SourceIndicator-like status.
```

Why it matters:

These are almost the same product grammar. If each workflow keeps inventing its
own names, the library will feel larger than it is.

Target:

Name the shared grammar:

```txt
AnchoredReview
DocumentReview
SourceReview
```

or keep `AnchoredDocumentProvider` as the engine and create a documented recipe
for the product composition:

```txt
provider;
viewer root;
document surface;
semantic item sidebar;
target adapter;
overlay adapter;
item list/form/block panel.
```

Proof:

- OCR and extraction use the same vocabulary.
- Edit viewer does not need a separate mental model.
- Source examples demonstrate adapters, not new architecture.

## Issue 36: Anchored Source Adapter Code Is Scattered

Severity: P1

Evidence:

`extraction-viewer-block.tsx` contains `sourceToDocumentAnchor` and several
per-format target adapters. Other blocks also convert Retab/Document sources to
PDF/image/text/csv/xlsx/docx targets.

Why it matters:

The source-to-anchor conversion is core library behavior, not demo glue. If it
stays scattered, every new anchored workflow will duplicate it.

Target:

Expose a single adapter layer:

```txt
documentSourceToAnchor(source)
useDocumentAnchoredTarget(format, ref)
useDocumentAnchoredOverlay(format, options)
```

or one explicitly named per-format adapter family.

Proof:

- No block contains a large switch over source anchor kinds.
- Tests cover every source anchor conversion.
- Unsupported anchor kinds fail in one predictable way.

## Issue 37: Multi-Format Extraction Still Uses Full Viewers For Non-PDF

Severity: P1

Evidence:

`extraction-viewer-block.tsx` uses `PdfViewerPages` for PDF, but uses full
`ImageViewer`, `TextViewer`, `CsvViewer`, `XlsxViewer`, and `DocxViewer` for
other formats.

Why it matters:

This is the same boundary issue as PDF, just less visible because the other
formats have fewer named parts. The parent extraction viewer owns the layout.
The child should be a document renderer or a named content part.

Target:

Every format should expose a content-only renderer or named part that can be
used inside anchored workflows.

Proof:

- Extraction block does not embed full format viewers.
- Format controls remain available where needed.
- Screenshots show one hierarchy.

## Issue 38: Dropzone Fits The Layering, But Uploadable Viewer Blurs Panel Semantics

Severity: P2

Evidence:

`useDropzone` is headless and source acquisition focused. The uploadable viewer
composition wraps it with:

```txt
UploadableFileViewerProvider;
UploadableFileViewerRoot;
UploadableFileViewerHeader;
UploadableFileViewerSummary as ViewerSidebar;
UploadableFileViewerContent as ViewerSurface;
```

Why it matters:

This is mostly good. The only weak point is whether "summary" is truly a
sidebar. It is not navigation; it is selected-file context and upload action.

Target:

Treat it as a valid `ViewerSidebar` only if the primitive sidebar is defined as
"auxiliary panel", not merely navigation.

Proof:

- Docs show file summary side panel as a supported sidebar use.
- Sidebar aria-label is domain-specific.
- Drag/drop acquisition stays outside FileViewer.

## Issue 39: Dropzone Provider Owns Acquisition And Selected Source Together

Severity: P2

Evidence:

`UploadableFileViewerProvider` owns the dropzone state, selected file, and
derived `BlobViewerSource`.

Why it matters:

This is not provider soup. It is one workflow provider. But the provider name
must make clear it is uploadable-file-viewer state, not a generic file viewer
provider.

Target:

Keep the provider narrow:

```txt
one selected upload file;
one derived viewer source;
dropzone intake/rejections;
no renderer internals;
no domain sidebars outside the upload workflow.
```

Proof:

- Dropzone examples never import file-viewer internals.
- `renderViewer` receives a source and nothing else.

## Issue 40: Public Docs Still Teach Non-Ideal Composition

Severity: P1

Evidence:

Docs still include examples with full viewers embedded in composed viewer
surfaces:

```txt
content/docs/components/extract-viewer.mdx
content/docs/components/split-viewer.mdx
content/docs/viewers/parse-viewer.mdx
content/docs/components/classification-viewer.mdx
```

Why it matters:

Docs are API. If the docs teach `PdfViewer bare` inside another viewer, users
will copy nested roots and duplicate chrome.

Target:

Docs must teach composition in this order:

1. Domain provider and viewer primitives.
2. Named parts/content renderers inside surfaces.
3. Easy API as the preassembled version.
4. `bare` only as frame styling.

Proof:

- Architecture test checks docs for embedded full viewers in composition
  sections.
- Every doc page has an explicit "Composition" section before "Usage".

## Issue 41: Architecture Tests Are Too String-Based

Severity: P2

Evidence:

`tests/viewer-architecture.test.ts` scans source strings for snippets and
import patterns.

Why it matters:

String tests catch drift cheaply, but they also encode formatting and can
freeze accidental decisions. The current file still asserts old file-system
gallery grammar.

Target:

Use a layered proof strategy:

```txt
source text tests for forbidden imports and public export boundaries;
AST tests for structural invariants;
render tests for DOM hierarchy;
browser screenshots for visual hierarchy.
```

Proof:

- Remove stale assertions that contradict the target design.
- Add render tests for viewer skeletons.
- Keep string tests only where they are exact and valuable.

## Issue 42: Registry Path And Payload Freshness Are Workflow Traps

Severity: P1

Evidence:

The tree now has `scripts/verify-registry-file-paths.mjs`, and `package.json`
uses it before `shadcn build`. Public payload files in `public/r` still drift
whenever source or registry entries change.

Why it matters:

The component registry is the product. If `registry.json` references missing
or untracked files, or `public/r/*.json` is stale, the library ships broken
copy-paste payloads.

Target:

Registry build must be deterministic and preflighted:

```txt
all registry files exist;
all registry files are git-known;
all relative imports are listed or provided by dependencies;
public/r registry metadata matches registry.json;
public/r payload contents match source files.
```

Proof:

- `pnpm registry:build` runs preflight and rebuild.
- Architecture tests compare `public/r` payloads.
- CI runs both.

## Issue 43: Public Registry Names Preserve Old Confusion

Severity: P2

Evidence:

Registry names include:

```txt
pdf-viewer-thumbnails
pdf-thumbnails-block
split-viewer-block
extract-viewer-block
extraction-viewer-block
text-sources-block
layout-blocks
```

Why it matters:

Registry names are public conceptual labels. If they preserve old names like
"thumbnail sidebar" while the actual model is `ViewerSidebar` plus
`PdfViewerThumbnails`, they slow down comprehension.

Target:

Registry names should mirror the final vocabulary:

```txt
pdf-viewer
pdf-thumbnails
anchored-extraction-viewer
ocr-block-review
source-review
split-viewer
file-system
dropzone-file-viewer
```

Proof:

- Registry names match docs headings and exported components.
- No registry item name implies a spatial primitive that it does not own.

## Issue 44: Browser Verification Is Not Systematic

Severity: P2

Evidence:

The viewer system has many visual hierarchy requirements:

```txt
no double headers;
no double borders;
sidebars aligned;
email Body/Attachments sidebar;
square thumbnails;
file-system sidebar plus surface;
overlay sidebar dismissal;
mobile inline/overlay breakpoint.
```

Why it matters:

Many of these cannot be proven by unit tests alone.

Target:

Define a browser verification matrix:

```txt
pdf thumbnails block;
email viewer with body and attachments;
file-system list/grid/gallery/columns;
split viewer;
extract viewer;
OCR/layout blocks;
dropzone uploadable viewer;
mobile and desktop widths.
```

Proof:

- Playwright or Browser screenshots for each route/block.
- Pixel/DOM checks for nonblank render and no overlapping headers.
- Console error check.

## Issue 45: Performance Has No Unified Viewer Budget

Severity: P2

Evidence:

The system includes:

```txt
PDF virtualization;
PDF thumbnail virtualization;
text virtualization;
CSV/XLSX workers;
image workers;
thumbnail decode queues;
file-system Pierre tree model;
lazy FileViewer imports;
object URL lifecycle in email.
```

Why it matters:

Each part has performance work, but there is no single viewer-system budget:

```txt
mount cost;
resize cost;
scroll cost;
thumbnail decode concurrency;
large document memory;
deep email recursion;
file-system row count.
```

Target:

Create explicit budgets by viewer family:

```txt
PDF 400 pages;
text 100k lines;
CSV 100k rows;
XLSX large workbook;
email with nested MIME and large attachments;
file-system 10k entries;
thumbnail rail fast scroll.
```

Proof:

- Performance tests or profiling scripts for the heavy paths.
- No provider renders the whole subtree unnecessarily.

## Issue 46: Loading/Empty/Error State Placement Is Not Defined For Domain Viewers

Severity: P1

Evidence:

Split, partition, parse, edit, file-system, email, OCR, extraction, and
dropzone each render empty/loading/error states locally.

Why it matters:

Without a shared rule, users get inconsistent hierarchy:

```txt
some states replace the whole root;
some replace surface;
some replace sidebar;
some show overlays;
some hide headers.
```

Target:

Define state placement:

```txt
workflow unavailable -> surface empty state;
workflow processing -> surface or overlay depending on whether old output remains;
sidebar empty -> sidebar content area;
renderer loading -> renderer content region;
fatal root error -> smallest recoverable root region.
```

Proof:

- State matrix in docs or design doc.
- Unit tests for each domain state.
- Screenshots for loading/empty/error variants.

## Issue 47: Source Acquisition, Routing, And Anchoring Need A Single Diagram

Severity: P2

Evidence:

Three separate concerns are mixed in conversation and docs:

```txt
Dropzone/FileSystem acquire or resolve source.
FileViewer routes source to renderer.
AnchoredDocumentProvider maps semantic items to targets inside renderers.
```

Why it matters:

These layers are clean only if users can see the pipeline.

Target:

Document the pipeline:

```txt
acquire source -> route source -> render document -> attach anchors -> review semantic items.
```

Proof:

- One diagram in the main viewer docs.
- Dropzone, file-system, extraction, OCR, edit, and email link back to it.

## Issue 48: Easy APIs And Named Parts Are Not Uniform Across Domain Viewers

Severity: P1

Evidence:

Some viewers expose a complete provider/named-part grammar:

```txt
EmailViewerProvider, EmailViewerHeader, EmailViewerPartsList,
EmailViewerSelectedPart

SplitViewerProvider, SplitViewerHeader, SplitViewerPageRail,
SplitViewerLegend, SplitViewerDocument
```

Others are less complete or use different naming:

```txt
ParseViewerMarkdown
PartitionViewerDocumentState
ClassifierViewerHeader
FileSystemExplorer
UploadableFileViewerSummary
```

Why it matters:

Users should be able to learn one composition recipe and apply it everywhere.

Target:

For every domain viewer, expose:

```txt
Provider
Header
Sidebar/Panel/List part if applicable
Surface/Document/SelectedContent part
Easy API assembled from the same parts
narrow hooks for each public part
```

Proof:

- Architecture tests check named parts and narrow hooks.
- Docs teach composition first.
- Easy API implementation is literally the public composition.

## Issue 49: `ViewerSidebar` Width Defaults Are Too Generic For Domain Reality

Severity: P2

Evidence:

Sidebars use many widths:

```txt
10rem default;
9rem PDF pages;
16rem selected file;
19rem email parts;
240px extracted fields;
320px OCR/edit fields;
420px extraction fields;
min(22rem, 85vw) file-system.
```

Why it matters:

This is not wrong, but it means width is not merely primitive styling. It is a
domain design decision. The primitive should not pretend one default is enough.

Target:

Keep default as a fallback, but every real domain sidebar should choose an
explicit width.

Proof:

- Docs examples set width intentionally.
- Design tokens or guidelines define common sidebar widths.

## Issue 50: Sidebar Visual Styling Is Split Between Primitive And Domains

Severity: P2

Evidence:

`ViewerSidebar` has `bg-background`, transition classes, width, positioning,
and overflow. Domains add borders, backgrounds, padding, scroll containers, and
sometimes `bg-muted/20`.

Why it matters:

The primitive should own placement and collapse mechanics. Domains should own
row/content styling. Border ownership is currently inconsistent.

Target:

Define ownership:

```txt
ViewerSidebar owns position, width, collapse, overflow clipping.
Domain sidebar owns border side, padding, scroll area, rows, section headers.
ViewerRoot owns outer frame.
```

Proof:

- Sidebars align visually across email, PDF, file-system, split, extraction,
  OCR, edit, and dropzone.
- No gray background appears in sidebar content unless domain explicitly wants
  it.

## Issue 51: Sidebar Accessibility Labels Are Better But Still Need Boundary
Proof

Severity: P2

Evidence:

Many current examples use labels:

```txt
Email parts
PDF pages
Files
Extraction fields
OCR blocks
Document fields
Selected file
Segments
```

Why it matters:

The primitive cannot invent a meaningful accessible name. The docs must teach
that every public `ViewerSidebar` needs a domain label.

Target:

Every real and documented `ViewerSidebar` has `aria-label` or
`aria-labelledby`.

Proof:

- Architecture test scans docs and registry blocks.
- Render tests query sidebars by role and name.
- Collapsed sidebars are inert and not keyboard reachable.

## Issue 52: The System Has Too Many Blueprints With Overlapping Truth

Severity: P2

Evidence:

The `design/` folder contains many viewer-related blueprints:

```txt
viewer-primitives-composition-blueprint.md
viewer-primitives-platonic-ideal-blueprint.md
viewer-root-sidebar-final-blueprint.md
viewer-root-sidebar-remaining-platonic-gap-blueprint.md
viewer-system-final-boundary-blueprint.md
viewer-system-final-convergence-blueprint.md
viewer-system-existing-issues-blueprint.md
shadcn-grade-file-viewer-primitive-blueprint.md
file-system-* blueprints
dropzone-* blueprints
```

Why it matters:

Blueprint drift is now a real source of ambiguity. Some documents encode older
decisions. Some encode the final target. Some are implementation notes.

Target:

Create one current source of truth:

```txt
viewer-system-existing-issues-blueprint.md = current fault inventory.
viewer-system-final-boundary-blueprint.md = final target vocabulary.
viewer-root-sidebar-remaining-platonic-gap-blueprint.md = primitive-specific
  sidebar work, if still needed.
```

Archive or mark older blueprints as superseded.

Proof:

- Top of every older blueprint points to the current source of truth or states
  that it is historical.
- New work references one current blueprint.

## Issue 53: Typecheck And Verification Are Polluted By Non-Viewer Debt

Severity: P2

Evidence:

The tree currently has many unrelated dirty files and prior typecheck failures
outside viewer work.

Why it matters:

If full verification cannot run cleanly, viewer changes can be merged with
unknown risk.

Target:

Separate viewer verification from whole-repo debt:

```txt
focused viewer test command;
registry build command;
docs/architecture command;
browser smoke command;
full repo typecheck when unrelated debt is cleared.
```

Proof:

- Final implementation reports focused viewer verification.
- Any unrelated blocking typecheck debt is named with file paths.

## Issue 54: The Final "How To Build A Viewer" Recipe Is Missing

Severity: P1

Evidence:

The architecture is now spread across primitives, domain examples, docs, tests,
and blueprints. There is no single recipe a contributor can follow.

Why it matters:

The next viewer will either copy the best pattern or copy an older accidental
pattern. The system is only platonic if the right pattern is obvious.

Target:

Document the canonical recipe:

1. Identify whether the component is source acquisition, source routing,
   document rendering, anchored review, or a domain workflow.
2. If it needs shared workflow state, create one domain provider.
3. Expose named parts with narrow hooks.
4. Compose `ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSidebar`, and
   `ViewerSurface` explicitly.
5. Use `ViewerSidebar` only for auxiliary panels.
6. Use `FileViewer` only for one selected file source.
7. Use format named parts or document renderers inside parent viewer surfaces.
8. Use `AnchoredDocumentProvider` only for semantic item to target
   coordination.
9. Use dropzone/file-system only to acquire or select sources.
10. Add loading, empty, error, accessibility, performance, docs, registry, and
    browser proof before calling the viewer complete.

Proof:

- Recipe appears in docs.
- Every existing composed viewer is audited against it.
- New viewers can be created without private imports.

## Implementation Priority

The next implementation pass should fix contradictions before polish.

1. Decide whether `viewer.tsx` remains pure spatial primitive or keeps semantic
   helper exports. Remove the losing path.
2. Remove full `PdfViewer` nesting from composed viewers and docs where
   `PdfViewerPages` or a renderer can be used.
3. Fix file-system gallery mode so `ViewerSurface` remains primary and
   `ViewerSidebar` remains auxiliary.
4. Fix email body projection and body labels.
5. Decide the `FileViewerProvider` / content-renderer question.
6. Normalize `bare` semantics.
7. Rename or remove `PdfViewerThumbnails`.
8. Make the anchored review pattern explicit across OCR, extraction, sources,
   and edit.
9. Replace stale architecture tests with source/AST/render/browser proof where
   appropriate.
10. Rebuild registry payloads and run browser verification.

## Acceptance Gates

The viewer system reaches the next meaningful plateau when all of these are
true:

```txt
ViewerRoot remains the only spatial provider.
ViewerSidebar remains the only spatial sidebar primitive.
Every ViewerRoot has at most one primary ViewerSidebar.
Every sidebar has a domain-accessible label.
FileViewer routes one source and owns no workflow state.
Full viewers are not embedded where content renderers or named content parts
exist.
bare has one documented meaning.
Email shows all useful body alternatives and attachments.
File-system always keeps sidebar plus surface grammar.
PDF thumbnails use ViewerSidebar + PdfViewerThumbnails vocabulary.
OCR, extraction, sources, and edit share the anchored review vocabulary.
Dropzone remains acquisition and does not import file-viewer internals.
Docs teach composition before easy API.
Architecture tests encode final decisions, not old accidents.
Registry preflight and public/r freshness pass.
Focused unit tests pass.
Browser screenshots prove no double header, double frame, overlap, or blank
render in the core blocks.
```

## Final Judgment

The provider idea is not a dead end.

The primitive idea is not a dead end.

The risk is not provider usage. The risk is imprecise ownership:

```txt
generic primitives gaining semantic taxonomy;
FileViewer pretending to be both router and renderer chrome;
full viewers being used as embedded renderers;
domain viewers hiding layout instead of composing named parts;
old sidebar/list primitives leaking into spatial sidebar vocabulary;
tests freezing accidental implementation details.
```

The final design is still reachable, but it requires hard deletion of the
confusing paths. The system should converge on this single sentence:

```txt
Viewer primitives compose space; domain providers compose workflow state;
FileViewer routes one source; document renderers display content; anchored
providers connect semantic items to document targets.
```
