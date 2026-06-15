# Viewer System Shadcn Platonic Blueprint

## Purpose

This is the standard the viewer system should be judged against.

The goal is not to make every viewer maximally configurable. The goal is to make
the system feel inevitable: simple, fast, complete, sharply modular, and free of
surplus API.

The design target is shadcn-grade composition:

```txt
small primitives
clear anatomy
few hooks
private machinery
public taste
```

The user should understand the component by reading the JSX. If they need to
learn a large context object, the design has already drifted.

## Core Verdict

The viewer system is now structurally good, but not platonic.

The recent direction is correct:

- `ViewerRoot` is the primitive center.
- Domain viewers compose viewer anatomy.
- Split and partition share segmented-document mechanics without becoming one
  generic mega-viewer.
- Broad composed-viewer hooks have mostly been removed.
- Sidebar control belongs to `ViewerRoot`, just like shadcn sidebar control
  belongs to the sidebar provider.

The remaining work is subtraction:

- remove or hide internal part-state hooks;
- stop exporting broad state bags;
- make tests protect the small public surface, not old completeness;
- update stale design docs so the written ideal does not teach the previous
  architecture.

## The Platonic Shape

The primitive anatomy is:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The primitive owns only spatial viewer behavior:

- root containment;
- header placement;
- body layout;
- one primary sidebar;
- sidebar open state;
- sidebar trigger context;
- inline versus overlay sidebar mode;
- surface containment.

It must not know about:

- files;
- MIME parts;
- PDF pages;
- split jobs;
- partition votes;
- OCR fields;
- extraction sources;
- upload queues;
- file-system trees.

Those are domain layers.

## Public API Law

The public API is anatomy first, hooks second.

Public by default:

- components users compose directly;
- primitive props needed for layout and state control;
- domain model types users must construct;
- narrow hooks that enable real external coordination.

Private by default:

- provider context values;
- state used only by one named part;
- header state hooks;
- sidebar state hooks for domain viewers;
- busy/empty/layout hooks;
- measurement hooks;
- pane synchronization hooks;
- mechanical viewport objects unless they are the explicit public seam.

The fact that a named part uses a hook is not evidence that the hook should be
public.

## Hook Law

Good public hooks are scarce and obvious.

Examples of acceptable hooks:

```ts
useViewerSidebar()
useOptionalViewerSidebar()
useSplitViewerDocumentControls()
usePartitionViewerDocumentControls()
useParseViewerDocument()
usePageMarkdownViewerDocument()
usePdfViewerThumbnails()
```

These hooks represent real composition seams:

- toggle a sidebar from a custom button;
- connect a custom document surface to split or partition navigation;
- connect a thumbnail rail to a PDF;
- synchronize an external document surface.

Bad public hooks are state mirrors:

```ts
useEmailViewer()
useSplitViewer()
usePartitionViewer()
useEditViewer()
useFileViewer()
usePdfViewer()
useXViewerHeader()
useXViewerSidebar()
useXViewerEmpty()
useXViewerBusy()
```

Those hooks expose implementation shape instead of user intent.

The rule:

```txt
if a hook exists only so the library's own part can render,
it is private.
```

## Provider Law

Providers are allowed. Providers are not the product.

A provider is justified when it coordinates state across independently placed
parts:

- a sidebar trigger placed inside a header;
- thumbnails controlling a document;
- a custom document reporting current page;
- a segment legend previewing document regions.

A provider is not justified just to make every component symmetrical.

The public mental model should stay JSX-first:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot>
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

The provider supports the composition. It should not invite users to consume a
large `EmailViewerState` object.

## Viewer Versus FileViewer

`Viewer` and `FileViewer` should not be competing abstractions.

The ideal boundary:

```txt
Viewer     = spatial chrome primitive
FileViewer = file leaf renderer
```

`ViewerRoot` owns layout and sidebar behavior.

`FileViewer` owns source resolution and file-type rendering:

- PDF;
- image;
- DOCX;
- PPTX;
- XLSX;
- CSV;
- HTML;
- text;
- code;
- markdown;
- unsupported files.

`FileViewer` may provide a convenient default chrome:

```tsx
<FileViewer source={source} />
```

It may also expose composed parts:

```tsx
<FileViewerProvider source={source}>
  <ViewerRoot>
    <FileViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <FileViewerContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileViewerProvider>
```

But it should not become a second full viewer philosophy. Its public surface
should not be a broad mirror of internal descriptor/resource state.

## Segmented Document Law

Split, partition, sources, OCR, and bbox viewers should converge at mechanics,
not taste.

The shared primitive is not a generic visual viewer. It is a document interaction
model:

```ts
type SegmentedDocumentModel = {
  pages: SegmentedPage[]
  segments: DocumentSegment[]
  anchors?: SegmentAnchor[]
  rows?: SegmentRow[]
}
```

The distinction matters:

```txt
DocumentSegment = semantic document section
SegmentAnchor   = page-local visual target
SegmentRow      = display grouping for ribbons or legends
```

Shared behavior:

- current page;
- scroll progress;
- active or previewed segment;
- document handle registration;
- scroll to page;
- scroll to segment start;
- scroll to anchor.

Domain-specific behavior stays outside:

- split result semantics;
- partition output and vote semantics;
- extraction schemas;
- OCR text;
- source paths;
- email MIME parts;
- file-system trees.

There should not be a giant `<SegmentedViewer>`.

There should be small segment primitives and named domain viewers that compose
them.

## Domain Viewer Law

Domain viewers should be thin compositions.

Split:

```tsx
<SplitViewerProvider result={result}>
  <ViewerRoot>
    <SplitViewerHeader />
    <ViewerBody>
      <SplitViewerSidebar />
      <ViewerSurface>
        <SplitViewerLegend />
        <SplitViewerDocument />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</SplitViewerProvider>
```

Partition:

```tsx
<PartitionViewerProvider result={result}>
  <ViewerRoot>
    <PartitionViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <PartitionViewerRibbon />
        <PartitionViewerDocument />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PartitionViewerProvider>
```

Email:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot>
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

Parse:

```tsx
<ParseViewerProvider result={result}>
  <ViewerRoot>
    <ViewerBody>
      <ViewerSurface>
        <ParseViewerMarkdown />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</ParseViewerProvider>
```

The JSX is the API. Hooks are escape hatches, not the main path.

## Current Gaps

### 1. FileViewer Still Has The Old API Shape

`FileViewer` still exposes a broad state family:

```txt
FileViewerState
FileViewerHeaderState
FileViewerContentState
useFileViewer()
useFileViewerHeader()
useFileViewerContent()
```

That shape is clean in a React sense, but not shadcn-sharp. It teaches users that
the way to customize a viewer is to consume internal state hooks.

The ideal public surface is smaller:

```txt
FileViewer
FileViewerProvider
FileViewerHeader
FileViewerContent
FileViewerProps
FileViewerProviderProps
FileViewerHeaderProps
FileViewerContentProps
```

Only add a public hook if a real external composition seam exists.

### 2. Edit And PDF Still Export Implementation Hooks From Internal Files

Edit and PDF have improved public entrypoints, but their implementation modules
still export hooks that are mostly used by their own parts.

The ideal is one of these:

```txt
preferred:
  keep part-state hooks unexported in the same module

acceptable:
  move implementation hooks to an explicitly internal file

not ideal:
  export every part-state hook from a provider module
```

For registry code, file-level privacy matters because users copy files. Anything
exported from a copied file looks public.

### 3. Tests Still Preserve Some Historical Surface

Architecture tests should protect the final taste, not the last migration.

They should assert:

- no broad composed-viewer aggregate hooks;
- no exported provider context values;
- public hooks are allowlisted;
- file-viewer exports do not grow accidentally;
- implementation hooks are not re-exported from public entrypoints;
- registry payloads match source exports.

They should not assert that old broad hooks must continue to exist.

### 4. Stale Blueprints Create Architectural Drift

Old blueprints that describe removed APIs as current truth should be treated as
historical notes, not guidance.

The current standard is:

```txt
no public aggregate viewer hooks
few public composition hooks
private part-state hooks
anatomical JSX as the main API
```

## Export Checklist

Before exporting anything, answer yes to at least one:

1. Does a user need this component to compose a different layout?
2. Does this prop control visible behavior that cannot be expressed with JSX?
3. Does this hook coordinate an external component with viewer state?
4. Does this type define input data users must construct?
5. Is this primitive independently useful outside the current domain viewer?

If the answer is no, keep it private.

## Naming Law

Same concept, same name.

Use:

- `source` for file/document input;
- `resource` for resolved downloadable/viewable resource;
- `document` for rendered document surface;
- `model` for derived domain model;
- `viewport` for scroll/current-page interaction controller;
- `segments` for semantic document sections;
- `anchors` for page-local targets;
- `rows` for display grouping;
- `open` for sidebar open state;
- `defaultOpen` for uncontrolled initial sidebar state;
- `onOpenChange` for controlled sidebar changes.

Avoid:

- `state` as a public catch-all;
- `data` when the concept is known;
- `item` when it is a segment, file, part, field, or page;
- `viewerState` for provider context values;
- duplicated names like `sidebarOpen` when `open` is scoped by `ViewerRoot`.

## Performance Law

The ideal is fast by construction.

The viewer system should avoid:

- global state for local viewer interactions;
- rerendering entire viewers for hover-only changes;
- broad context values consumed by many heavy children;
- recomputing file descriptors on every render;
- mounting hidden document engines unnecessarily;
- expensive sidebar thumbnails without virtualization or stable dimensions.

Performance is not a later optimization. It is part of the API boundary.

Small public APIs make performance easier because fewer external consumers depend
on internal state shape.

## Accessibility Law

Minimal does not mean incomplete.

The primitive must cover:

- semantic regions where useful;
- labelled sidebars;
- keyboard-operable sidebar triggers;
- focus return for overlay sidebars;
- escape behavior for overlay sidebars;
- disabled states;
- loading and empty states that remain readable.

These are required behavior, not optional props.

## Anti-Patterns

Do not introduce:

```txt
ViewerShell
ViewerPanel
ViewerMain
ViewerAside
ViewerSidebarProvider
ViewerLayoutProvider
ViewerSlots
slots={{ ... }}
renderDocument({ slots })
viewerPurpose
sidebarKind
surfaceRole
useXViewer(): XViewerState
```

These names usually signal that the primitive is trying to encode too much taste
or too much domain knowledge.

## Definition Of Done

The viewer system reaches the platonic target when:

- a new user can compose a viewer by reading JSX, not provider internals;
- `ViewerRoot` remains the only spatial chrome primitive;
- `FileViewer` is clearly a leaf renderer, not a competing root abstraction;
- domain viewers expose components and narrow coordination hooks only;
- part-state hooks are private unless there is a documented external need;
- segmented-document code owns interaction mechanics, not visual opinion;
- split, partition, sources, and OCR share mechanics without sharing one giant
  visual component;
- tests prevent public API expansion by accident;
- stale architecture docs no longer contradict current code;
- every exported name feels necessary.

The final test is aesthetic:

```txt
Could this API be smaller without losing real capability?
```

If yes, it is not done.
