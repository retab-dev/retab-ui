# Sidebar Viewer Platonic Gap Blueprint

## Purpose

This document records why the current sidebar and viewer architecture is not
yet the platonic ideal.

The current direction fixes the largest conceptual collision:

```txt
SidebarProvider / Sidebar
  app-shell sidebar system

ViewerSidebar
  viewer-local spatial rail

SidebarList*
  providerless grouped-row grammar

SegmentSidebar / AttachmentSidebar / PDF thumbnail rail
  domain sidebars with domain-owned models
```

That is the right direction, but it is not perfection. The remaining work is
not cosmetic. Each issue below represents either a boundary leak, a naming
imperfection, a stale compatibility trace, or a missing proof that the
abstraction is exact.

Platonic ideal here means:

- simple enough that the ownership model is obvious from imports and JSX;
- fast at runtime and fast to understand;
- complete for real viewer/domain sidebar needs;
- free of compatibility props, duplicate paths, and speculative vocabulary;
- modularized so every module owns exactly one coherent concept;
- high entropy, where every exported name earns its place;
- consistent terminology across code, docs, tests, and registry payloads;
- precise enough that a future contributor cannot accidentally reintroduce the
  old app-sidebar, viewer-sidebar, and domain-sidebar confusion.

## Current State

The current architecture is improved, but it is not the platonic ideal.

The intended taxonomy is clear:

```txt
SidebarProvider / Sidebar
  app-shell sidebar system

ViewerSidebar
  viewer-local spatial rail

SidebarList*
  providerless grouped-row grammar

SegmentSidebar / AttachmentSidebar / PdfViewerThumbnails
  domain components with domain-owned state
```

Some of that taxonomy is implemented. Some of it is still only partially
expressed in source, docs, tests, and registry payloads. That distinction
matters. A component architecture is not finished when the names are plausible;
it is finished when the import graph, JSX examples, docs taxonomy, registry
dependencies, data attributes, tests, and visual behavior all make the same
model mechanically hard to violate.

Current code evidence shows the system is still inconsistent:

- `ViewerSidebar` correctly owns viewer-local placement, side, width,
  collapse, and overlay or inline behavior.
- `ViewerBody` is the intended positioning context for overlay sidebars, but
  that dominance rule is not documented or tested strongly enough.
- `SidebarProvider` and `Sidebar` remain the shadcn-style application sidebar
  system and must not be reused as viewer-local row grammar.
- `SidebarList*` exists as providerless grouped-row grammar, which is the right
  abstraction for domain sidebars embedded inside viewer rails.
- `SegmentSidebar` and `AttachmentSidebar` should compose `SidebarList*`
  instead of mounting nested `SidebarProvider` boundaries.
- `sidebar-row` exists as the right target for shared row variants, but every
  source, registry payload, and architecture test still needs to prove that
  `SidebarList*` no longer depends on app-shell sidebar internals.
- `PdfViewerThumbnails` exists as the right PDF-owned name, but stale
  references to `PdfThumbnailSidebar` must be prevented permanently.
- The semantic viewer wrappers
  `ViewerDocumentSurface`, `ViewerNavigationSidebar`, and
  `ViewerInspectorSidebar` are the desired direction, but the current source
  and tests are not yet in a stable, aligned state. Some docs and tests still
  teach raw `ViewerSurface` / `ViewerSidebar` where semantic wrappers would be
  clearer.
- `useViewerSidebar()` currently reads a public context separate from the
  internal registration context, which is the right shape, but the tests should
  permanently guard that boundary.

The system has the correct conceptual bones. The remaining work is to remove
every ambiguous name, stale prop, accidental dependency, undocumented semantic
selector, and weak proof that lets the old mental model return.

## External Baseline

This audit is anchored against two external systems:

- shadcn/ui `Sidebar`;
- Extend UI `DocumentViewerThumbnailSidebar`.

The point is not to copy either system. The point is to make the ownership
boundaries as clean as the best parts of both, while avoiding the places where
their assumptions are narrower than ours.

### shadcn/ui Sidebar

shadcn/ui treats `Sidebar` as an application layout primitive.

The public model is centered on:

```txt
SidebarProvider
  global sidebar state boundary

Sidebar
  app navigation shell

SidebarInset
  main content wrapper for inset layouts

SidebarTrigger
  trigger for the provider-owned sidebar

SidebarMenu / SidebarMenuItem / SidebarMenuButton
  app navigation row grammar
```

The official docs explicitly say to wrap the application in
`SidebarProvider`. The provider owns state such as expanded/collapsed,
desktop/mobile open state, and the sidebar toggle action.

That is excellent for app navigation. It is not the right primitive for a
document viewer rail that lives inside a viewer body.

The key lesson from shadcn is:

```txt
Provider scope should match layout scope.
```

An app-shell sidebar deserves an app-shell provider. A viewer-local sidebar
deserves a viewer-local owner. A providerless list inside a rail should not
pretend to be an app shell.

### Extend UI Document Viewer Sidebar

Extend UI has a more document-specific primitive:

```txt
DocumentViewerThumbnailSidebar
```

The docs describe it as shared responsive thumbnail sidebar behavior for PDF,
DOCX, and other document viewers. Its job is to render thumbnail navigation
inline on wider layouts and as an overlay on narrower layouts. Its API is small:

```txt
children
className
inline
open
```

The companion hooks are also narrow:

```txt
useElementWidth
useInlineThumbnailSidebar
```

This is a strong document-viewer abstraction because it separates responsive
sidebar shell behavior from the individual viewer implementations. It is also
more specialized than our current viewer primitive.

The key lesson from Extend is:

```txt
Document-specific rails should be named by document behavior.
```

Extend says "thumbnail sidebar" because its primitive is explicitly about
thumbnail navigation. Our system needs both a generic viewer spatial rail and
domain-specific children. Therefore the clean split is:

```txt
ViewerNavigationSidebar
  placement, side, collapse, overlay/inline behavior

PdfViewerThumbnails
  PDF thumbnail loading, rendering, page navigation, virtualization
```

### Comparison Judgment

Our system is trying to cover a wider space than either external reference:

- app-shell navigation;
- document viewer navigation rails;
- document viewer inspector panels;
- providerless row lists inside domain components;
- PDF thumbnails;
- segments;
- attachments;
- MIME parts;
- extraction fields;
- OCR/layout blocks.

That wider scope is why the taxonomy matters so much. A single word like
`sidebar` cannot carry all of these concepts without strict qualification.

The current architecture is moving in the right direction because it has
separate owners:

```txt
Sidebar
  app shell

ViewerSidebar
  viewer body rail

SidebarList
  providerless row grammar

SegmentSidebar / AttachmentSidebar / PdfViewerThumbnails
  domain behavior
```

But it is not yet perfect until code, docs, registry payloads, test selectors,
and examples make that separation mechanically hard to violate.

## Issue Ledger

This is the complete ledger of sidebar/viewer issues that must be treated as
real architecture work, not cosmetic cleanup.

### Issue 0: Layout Precedence

Severity: blocking visual architecture issue.

The screenshots exposed the core layout law:

```txt
ViewerHeader wins over ViewerSidebar.
ViewerSidebar wins over document-local chrome.
```

The sidebar must not start above the header. The header is the top-level viewer
row. At the same time, a document-local legend, toolbar, OCR overlay selector,
or page-local status bar must not push the sidebar down. Those local controls
belong inside the document surface, not beside the viewer rail.

The bug exists because three layout systems can currently compete:

- the root frame and rounded clipping;
- the body flex layout;
- absolute overlay projection;
- local document chrome inside the surface.

The correct rule is body-scoped:

```txt
ViewerRoot
  ViewerHeader
  ViewerBody
    ViewerSidebar
    ViewerDocumentSurface
      Legend / toolbar / document-local chrome
```

When `ViewerSidebar` is overlayed, `absolute` is correct only if
`ViewerBody` is the containing block. It is wrong if the containing block is
the root, the page, or the document surface.

Required proof:

- geometry tests prove `sidebar.top === viewerBody.top`;
- geometry tests prove `sidebar.bottom === viewerBody.bottom`;
- geometry tests prove `sidebar.top >= viewerHeader.bottom`;
- a legend inside the surface does not alter `sidebar.top`;
- both left and right sidebars satisfy the rule;
- inline, overlay, expanded, and collapsed states satisfy the same rule.

### Issue 1: Row Variants Must Not Belong To The App Sidebar

Severity: boundary leak.

The row styling shared by app-sidebar menu rows and providerless sidebar-list
rows is not app-shell behavior. It is shared row grammar. Keeping that styling
inside `sidebar.tsx` makes `sidebar.tsx` own too many concepts and tempts
`sidebar-list.tsx` to import from the app-shell primitive.

The final graph must be:

```txt
sidebar-row.ts
  pure row button variants

sidebar.tsx
  app-shell sidebar primitives
  imports sidebar-row.ts

sidebar-list.tsx
  providerless grouped row primitives
  imports sidebar-row.ts
```

Forbidden graph:

```txt
sidebar-list.tsx -> sidebar.tsx
```

Required proof:

- source test forbids `sidebar-list.tsx` importing `./sidebar`;
- registry test proves `sidebar-list` depends on `sidebar-row`, not `sidebar`;
- visual tests prove `SidebarMenuButton` and `SidebarListButton` still match
  where they intentionally share row styling.

### Issue 2: Stale Provider Naming Must Be Removed

Severity: stale abstraction / misleading public API.

`providerClassName` is an invalid prop name for `AttachmentSidebar` after the
embedded provider is removed. It encodes an implementation detail that should
not exist. If the component has no provider, no public prop should say
provider.

The final API must have one root styling escape hatch:

```ts
className?: string
```

Required proof:

- no source, docs, tests, registry payloads, or public examples contain
  `providerClassName`;
- `AttachmentSidebar` has no nested `SidebarProvider`;
- tests assert the root slot is the domain component and providerless
  sidebar-list grammar is used inside it.

### Issue 3: PDF Thumbnails Need PDF-Owned Naming

Severity: naming collision.

`PdfThumbnailSidebar` collapses two ownership layers into one name:

- PDF thumbnail behavior;
- viewer/sidebar spatial placement.

The PDF component should own thumbnail loading, thumbnail virtualization, page
selection, active page following, and PDF-specific accessibility. It should not
claim to be the spatial sidebar primitive.

The final composition should read:

```tsx
<ViewerNavigationSidebar aria-label="Pages">
  <PdfViewerThumbnails />
</ViewerNavigationSidebar>
```

Required proof:

- no export named `PdfThumbnailSidebar`;
- no registry item named `pdf-thumbnail-sidebar`;
- no docs teach the old name except this blueprint or an explicit migration
  note;
- PDF thumbnail behavior tests remain tied to `PdfViewerThumbnails`, not to
  generic sidebar behavior.

### Issue 4: Viewer Sidebar Purpose Vocabulary Must Be Proven

Severity: semantic API risk.

`viewerPurpose` is useful only if the values are few, stable, and tied to real
user intent. A purpose value should answer:

```txt
Why does this rail exist in the viewer?
```

It should not answer:

```txt
Which React component is inside it?
Which file format is active?
Which CSS mode is active?
```

The likely final vocabulary is:

```ts
type ViewerSidebarPurpose = "navigation" | "inspector" | "parts"
```

`outline` should not exist unless it changes behavior, styling, tests, or
public semantics in a way that cannot be expressed as navigation. A document
outline that jumps within the document is navigation unless proven otherwise.

Required proof:

- every real viewer sidebar call site is classified;
- the same concept uses the same purpose everywhere;
- no unused purpose remains in the type;
- docs define each purpose with examples;
- tests prevent speculative values from returning.

### Issue 5: Public And Internal Viewer Sidebar Contexts Need A Permanent Guard

Severity: encapsulation / performance risk.

The correct architecture is two contexts:

```txt
ViewerSidebarContext
  public control state and actions

ViewerSidebarInternalContext
  registration, root id, trigger focus, measured sidebar metadata
```

The public hook must not project or filter private data from a mixed context.
It should read the public context directly. The internal hook can read the
internal context. The current code is close to that shape, so the remaining
work is proof and naming discipline.

Required proof:

- `useViewerSidebar()` reads only the public context;
- `useOptionalViewerSidebar()` reads only the public context;
- internal registration functions are not visible in public hook return
  values;
- public context identity is stable when public values do not change;
- source tests fail if the public hook starts reading the internal context.

### Issue 6: Documentation Must Match The Taxonomy

Severity: contributor-facing architecture drift.

The docs cannot use `sidebar` as an overloaded word and expect readers to infer
the intended layer. The route structure should teach ownership.

Final documentation taxonomy:

```txt
components/sidebar
  app-shell SidebarProvider / Sidebar

components/sidebar-list
  providerless grouped row grammar

components/segment-sidebar
  segment domain component

components/attachment-sidebar
  attachment domain component

components/viewer
  ViewerRoot, ViewerHeader, ViewerBody, ViewerSidebar, semantic wrappers

viewers/pdf-viewer
  PdfViewerThumbnails and PDF viewer composition
```

Required proof:

- `sidebar.mdx` does not primarily teach `SegmentSidebar`;
- `sidebar-list.mdx`, `segment-sidebar.mdx`, and `attachment-sidebar.mdx`
  exist when those APIs are public;
- viewer docs explain `ViewerSidebar` separately from app `Sidebar`;
- examples show domain components nested inside viewer rails, not replacing
  viewer rails.

### Issue 7: Registry Dependencies Need Guardrails

Severity: public installability risk.

Local imports can work while registry installation is broken. That makes the
registry graph an architecture surface, not generated noise.

Required graph:

```txt
segment-sidebar -> sidebar-list
attachment-sidebar -> sidebar-list
sidebar-list -> sidebar-row
sidebar -> sidebar-row
```

Forbidden graph:

```txt
segment-sidebar -> sidebar
attachment-sidebar -> sidebar
sidebar-list -> sidebar
```

Required proof:

- tests compare source imports with registry dependencies for sidebar-related
  items;
- public registry payloads are rebuilt after source changes;
- registry JSON and `public/r/*.json` remain aligned;
- stale payload names such as `pdf-thumbnail-sidebar` fail tests.

### Issue 8: Semantic Wrappers Must Earn Their Exports

Severity: API minimality risk.

The desired semantic wrappers are:

```tsx
<ViewerDocumentSurface />
<ViewerNavigationSidebar />
<ViewerInspectorSidebar />
```

These wrappers are acceptable only if they remove repeated ambiguity. They are
not acceptable if they exist for symmetry.

`ViewerDocumentSurface` is likely core because primary document rendering is a
recurring concept. `ViewerNavigationSidebar` is likely core because page rails,
segment rails, thumbnail rails, and outlines all share navigation intent.
`ViewerInspectorSidebar` must be proven across extraction fields, OCR/layout
blocks, metadata panels, and edit panels.

Required proof:

- each wrapper has multiple real call sites or represents a core public
  concept;
- wrappers have no state and do not hide layout order;
- raw `ViewerSidebar` remains available for rare purposes;
- docs explain when to use a wrapper versus the raw primitive;
- tests and docs are aligned with the wrappers instead of fighting them.

### Issue 9: Semantic Data Attributes Need A Contract

Severity: selector API drift.

`data-slot`, `data-viewer-role`, and `data-viewer-purpose` are only valuable if
their stability is explicit.

Recommended contract:

```txt
data-slot
  stable structural selector for tests and local styling

data-viewer-role
  stable semantic selector for viewer surface role

data-viewer-purpose
  stable semantic selector for viewer sidebar purpose
```

If documented, these attributes become public styling and test hooks. Changing
values should then be treated as an API change. If they are internal only, docs
should not encourage app code to rely on them.

Required proof:

- viewer docs state the contract;
- tests use the same names and values;
- no casual one-off semantic data attribute is added without taxonomy review.

### Issue 10: Full Naming Sweep Is Still Required

Severity: global consistency risk.

The system still contains overlapping terms:

```txt
surface
document surface
viewer surface
body
pane
panel
rail
sidebar
navigation sidebar
inspector sidebar
parts
attachments
thumbnails
outline
```

The naming sweep must not be mechanical. It must classify ownership first:

```txt
ViewerRoot
  viewer frame and measurement boundary

ViewerHeader
  top row outside sidebar positioning

ViewerBody
  body region and sidebar containing block

ViewerSidebar
  spatial rail inside ViewerBody

ViewerDocumentSurface
  primary document rendering area

Sidebar
  app-shell primitive

SidebarList
  providerless grouped row grammar

PdfViewerThumbnails
  PDF thumbnail behavior
```

Required proof:

- same concept, same name;
- different concept, different name;
- no public name encodes removed implementation details;
- docs, tests, registry items, public examples, and source imports use the
  same terms.

### Issue 11: Tests Currently Encode Conflicting Opinions

Severity: proof-system failure.

An architecture test suite should be the memory of the design. Right now some
tests still encode older opinions, such as raw `ViewerSidebar` and
`ViewerSurface` being preferred in places where semantic wrappers are the
target. A test that protects the wrong architecture is worse than no test
because it turns cleanup into a regression.

Required proof:

- tests describe the final taxonomy, not the temporary state;
- source-level architecture tests and behavioral tests agree;
- docs tests and registry tests agree with source;
- no test asserts the absence of a name that the blueprint says should become
  public API;
- no test allows a stale compatibility prop or old component name to remain.

### Issue 12: Runtime Proof Is Too CSS-String Heavy

Severity: visual regression risk.

Class assertions are useful but insufficient for the original screenshot bug.
The bug was geometric: what visually wins, where the sidebar begins, and which
region owns scroll and clipping.

Required proof:

- browser-level geometry tests for header/body/sidebar/surface/legend;
- screenshot coverage for `/blocks#split`;
- overlay and inline mode coverage;
- left and right sidebars;
- collapsed and expanded states;
- document-local chrome inside the surface.

### Issue 13: No Compatibility Aliases

Severity: repository principle violation.

The repository explicitly asks for hard cutovers and no compatibility shims.
That means every rename and boundary correction must update call sites instead
of leaving aliases.

Forbidden final states:

```txt
PdfThumbnailSidebar re-exporting PdfViewerThumbnails
providerClassName still accepted as an alias for className
EmbeddedSidebarProvider kept for old domain sidebars
scope or data-sidebar-scope kept for old nested sidebar scoping
```

Required proof:

- stale names are absent from source, docs, tests, registry, and public
  payloads;
- any stale name that appears in a test appears only as a forbidden-string
  assertion.

## Issue 0: Layout Precedence Is Not Explicit Enough

### Current Shape

The screenshots exposed a real ambiguity in the viewer layout contract.

In one state, the legend/header area visually beat the sidebar: the legend
consumed the top band and the sidebar began below it. The request was that the
sidebar should occupy the full available body height.

In the next state, the sidebar was made to win too much: it crossed into the
header/title area. The correction was that the header should dominate.

The intended visual hierarchy is:

```txt
ViewerRoot
  owns full rounded frame and clipping

ViewerHeader
  wins the top row

ViewerBody
  begins below ViewerHeader

ViewerSidebar
  wins full ViewerBody height

ViewerDocumentSurface
  scrolls/render documents beside the sidebar

In-document legends/toolbars
  live inside ViewerDocumentSurface and must not resize or displace
  ViewerSidebar
```

The critical phrase is:

```txt
header wins over sidebar; sidebar wins over document-local chrome.
```

### Why This Is Not Platonic

The architecture has the right component names, but the dominance rules are
not first-class enough.

The current bug class exists because the implementation can express multiple
competing truths:

- the header can be a normal child that consumes height;
- a legend can be a normal child that also consumes height;
- the sidebar can be absolute, which removes it from ordinary flow;
- the document surface can scroll independently;
- sticky or absolute children can escape the intended body hierarchy;
- the rounded root frame can clip some things but not others depending on
  where overflow is applied.

When these rules are implicit, fixing one screenshot risks breaking the next.
That is exactly what happened: the first fix made the sidebar dominate the
legend, but also let it invade the header.

A platonic layout primitive should make the dominance rule structural, not
incidental.

### Why The Sidebar Is Absolute

The sidebar becomes `absolute` in overlay/collapsed behavior because overlay
sidebars must sit on top of the document surface without changing the surface
layout.

Inline sidebars participate in layout:

```txt
ViewerBody
  display: flex

ViewerSidebar inline
  takes width in flow

ViewerDocumentSurface
  receives remaining width
```

Overlay sidebars should not participate in layout:

```txt
ViewerBody
  position: relative

ViewerSidebar overlay
  position: absolute
  inset-block: 0
  inset-inline-start/end: 0

ViewerDocumentSurface
  keeps its layout width
```

That is the right reason for `absolute`: overlay is a viewer-body-local
projection, not a document-flow column.

The danger is using absolute positioning without a precise containing block.
The containing block must be `ViewerBody`, not `ViewerRoot`, not the page, and
not an inner document surface. If the containing block is wrong, the sidebar
will either:

- start too high and cover the header;
- start too low and lose to a legend;
- escape rounded clipping;
- fail to match the document body height;
- create pointer-event or z-index conflicts with local toolbars.

### Target Shape

Make the layout contract explicit:

```txt
ViewerHeader
  static block above the body
  never overlapped by ViewerSidebar

ViewerBody
  relative containing block
  min-height: 0
  overflow: hidden or clip at the viewer-body boundary

ViewerSidebar
  full block-size of ViewerBody
  inline mode: flex item
  overlay mode: absolute child of ViewerBody

ViewerDocumentSurface
  min-width: 0
  min-height: 0
  owns document scroll

Legend / document-local toolbar
  child of ViewerDocumentSurface
  cannot affect ViewerSidebar height or top offset
```

This means the sidebar does not occupy the full `ViewerRoot` height. It
occupies the full `ViewerBody` height. That distinction is the entire bug.

### Required Invariants

The implementation should make these invariants obvious:

- `ViewerSidebar` never renders outside `ViewerBody`;
- `ViewerSidebar` never overlaps `ViewerHeader`;
- `ViewerSidebar` always spans from the top of `ViewerBody` to the bottom of
  `ViewerBody`;
- document-local legends and controls never change the sidebar's top offset;
- overlay mode does not change document surface layout width;
- inline mode does change document surface layout width;
- rounded clipping applies to both sidebar and surface consistently;
- collapsed/offcanvas state preserves the same body-scoped containing block.

### Implementation Plan

1. Treat `ViewerBody` as the only positioning context for viewer sidebars.
2. Keep `ViewerHeader` outside the body and above any sidebar positioning
   context.
3. Ensure all document-local legends/toolbars live inside
   `ViewerDocumentSurface`.
4. For inline mode, render the sidebar as a flex item.
5. For overlay/offcanvas mode, render the sidebar as an absolute child whose
   inset is relative to `ViewerBody`.
6. Avoid compensating with magic `top` values. The DOM hierarchy should provide
   the top offset.
7. Add screenshots or DOM geometry tests for:
   - header height;
   - sidebar top;
   - body top;
   - legend top;
   - sidebar bottom;
   - body bottom.
8. Test both left and right sidebars.
9. Test inline, overlay, expanded, and collapsed states.
10. Test a surface with a legend/header row and a surface without one.

### Tests

Add a browser-level geometry test rather than relying only on class assertions.

Required assertions:

```txt
sidebar.top === viewerBody.top
sidebar.bottom === viewerBody.bottom
sidebar.top >= viewerHeader.bottom
legend.top >= viewerBody.top
legend.left >= documentSurface.left
legend does not change sidebar.top
```

The exact pixel values can allow a small tolerance for subpixel rendering, but
the relationships must hold.

### Done Criteria

- The screenshot state at `/blocks#split` shows the header above the sidebar.
- The sidebar occupies the full body height.
- The legend is visually inside the document surface, not above the sidebar.
- No z-index or absolute-position workaround encodes a fixed header height.
- The body-scoped dominance rule is documented and tested.

## Issue 1: SidebarListButton Reuses Variants From Sidebar

### Current Shape

`SidebarListButton` needs the same row styling grammar as `SidebarMenuButton`,
but it must not import that grammar from `sidebar.tsx`.

The forbidden import graph is:

```txt
sidebar-list.tsx
  imports sidebarMenuButtonVariants from sidebar.tsx
```

That graph may look harmless if the imported value is pure, but conceptually it
is wrong. `SidebarList*` is providerless row grammar. `Sidebar` is the
app-shell sidebar system. A providerless primitive depending on the app-shell
primitive file is a boundary smell.

### Why This Is Not Platonic

The dependency direction makes the primitive hierarchy less honest.

The ideal hierarchy should be:

```txt
sidebar-row-variants.ts
  pure row styling contract

sidebar.tsx
  app-shell sidebar primitives
  imports sidebar-row-variants.ts

sidebar-list.tsx
  providerless grouped-row primitives
  imports sidebar-row-variants.ts
```

The current hierarchy is:

```txt
sidebar.tsx
  owns app-shell primitives
  also owns row variants

sidebar-list.tsx
  imports row variants through the app-shell primitive module
```

That means `sidebar.tsx` owns more than one concept:

- app-shell sidebar provider and layout;
- mobile sheet behavior;
- cookie persistence;
- keyboard shortcut behavior;
- menu and group primitives;
- shared row styling variants.

The row styling variants are not inherently app-shell behavior. They are shared
sidebar grammar. Keeping them inside `sidebar.tsx` makes the module lower
entropy because one file carries both behavior-heavy app sidebar code and a
small pure styling primitive.

### Target Shape

Extract the shared row variants and any tiny button-render helpers that are
truly common into a narrow module.

Preferred target:

```txt
registry/new-york-v4/ui/sidebar-row.ts
components/ui/sidebar-row.ts
```

Exports:

```ts
export const sidebarRowButtonVariants = cva(...)
export type SidebarRowButtonVariantProps =
  VariantProps<typeof sidebarRowButtonVariants>
```

Only extract what is shared and pure. Do not move provider behavior,
collapsible state, tooltip behavior, mobile logic, or app-shell concerns.

Then:

```txt
sidebar.tsx
  imports sidebarRowButtonVariants

sidebar-list.tsx
  imports sidebarRowButtonVariants
```

### Naming Decision

Use `sidebarRowButtonVariants`, not `sidebarMenuButtonVariants`, for the shared
primitive.

Reason:

- `menu` is accurate inside `SidebarMenuButton`;
- `row` is more accurate across both `SidebarMenuButton` and
  `SidebarListButton`;
- `button` remains in the name because this is not group, header, content, or
  rail styling.

### Implementation Plan

1. Create `registry/new-york-v4/ui/sidebar-row.ts`.
2. Move the `cva(...)` row button variant definition from `sidebar.tsx` into
   `sidebar-row.ts`.
3. Export a precise variant prop type from `sidebar-row.ts`.
4. Update `sidebar.tsx` to import the row variants and preserve
   `SidebarMenuButton` behavior.
5. Update `sidebar-list.tsx` to import the row variants directly from
   `sidebar-row.ts`.
6. Add `components/ui/sidebar-row.ts` as the public wrapper.
7. Add a registry item for `sidebar-row`.
8. Add `sidebar-row` to `sidebar` and `sidebar-list` registry dependencies.
9. Rebuild affected registry payloads.
10. Add or update architecture tests so `sidebar-list.tsx` does not import from
    `./sidebar`.

### Tests

Add an architecture test:

```txt
sidebar-list.tsx must not import "./sidebar"
sidebar.tsx may import "./sidebar-row"
sidebar-list.tsx may import "./sidebar-row"
```

Keep behavior tests for:

- active state styling;
- disabled state styling;
- `asChild` rendering;
- default `button` type behavior.

### Done Criteria

- `sidebar-list.tsx` has no dependency on `sidebar.tsx`.
- Shared row styling lives in a pure file.
- Registry item graph reflects the new dependency.
- No visual or behavioral regression in `SidebarMenuButton` or
  `SidebarListButton`.

## Issue 2: AttachmentSidebar Must Not Keep providerClassName

### Current Shape

`AttachmentSidebarProps` must not include:

```ts
providerClassName?: string
```

Earlier embedded-provider composition made that prop plausible. In the current
architecture it is forbidden because `AttachmentSidebar` should be a
providerless domain component using `SidebarList*`.

### Why This Is Not Platonic

`providerClassName` is now a lie.

There is no provider in `AttachmentSidebar`. The prop name encodes an
implementation detail that no longer exists. It invites callers to think there
is still an embedded `SidebarProvider` boundary inside the component.

This violates three repository principles:

- no legacy adapters;
- no compatibility shims;
- perfectly consistent variable names.

It also lowers entropy. A future reader has to ask:

```txt
What provider?
Why does providerClassName still exist?
Is AttachmentSidebar secretly mounting a provider?
Which class wins, className or providerClassName?
```

Those questions should not exist.

### Target Shape

Remove `providerClassName`.

The final props should be:

```ts
export interface AttachmentSidebarProps {
  items: readonly AttachmentSidebarItem[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  header?: React.ReactNode
  emptyLabel?: React.ReactNode
  children?: React.ReactNode
  side?: "left" | "right"
  width?: string
  className?: string
}
```

There should be exactly one styling escape hatch for the root:

```ts
className?: string
```

If callers need to style inner content, add a named prop only if there is a
real repeated need. Do not preserve vague old provider naming.

### Implementation Plan

1. Remove `providerClassName` from `AttachmentSidebarProps`.
2. Remove it from the function parameter list.
3. Remove it from the root `cn(...)` call.
4. Search for all call sites.
5. Replace `providerClassName` with `className` only when it targeted the root.
6. If a call site used both `providerClassName` and `className`, merge them at
   the call site into one explicit `className`.
7. Update tests that mention provider wrappers or provider class semantics.
8. Rebuild the `attachment-sidebar` registry payload and any items that bundle
   it.

### Tests

Add or update tests to assert:

- no `data-slot="sidebar-wrapper"` exists inside `AttachmentSidebar`;
- root is `data-slot="attachment-sidebar"`;
- root also has `data-sidebar-list`;
- no source file contains `providerClassName`.

### Done Criteria

- `rg "providerClassName"` returns no results in source, tests, docs, and
  registry payloads.
- `AttachmentSidebar` props describe only the current implementation.
- No compatibility branch remains.

## Issue 3: PdfThumbnailSidebar Is A Naming Mismatch

### Current Shape

The PDF thumbnail rail has been moving away from sidebar-shaped naming:

```txt
PdfViewerThumbnails
```

That is the right direction. The remaining issue is making the cutover total:
no stale export, registry item, docs example, test helper, or payload name
should continue to teach `PdfThumbnailSidebar`.

### Why This Is Not Platonic

`PdfThumbnailSidebar` is not a normal sidebar list.

It owns:

- PDF document loading for thumbnails;
- page size measurement;
- virtualized thumbnail rows;
- active-page follow behavior;
- page-specific keyboard behavior;
- geometry that should not be forced into menu row primitives.

Calling it a `Sidebar` creates false symmetry with:

```txt
ViewerSidebar
Sidebar
SegmentSidebar
AttachmentSidebar
```

Those names already carry distinct meanings. Keeping `PdfThumbnailSidebar`
adds another meaning:

```txt
"sidebar" can also mean a PDF-owned virtualized thumbnail rail
```

That is exactly the ambiguity this architecture is trying to remove.

### Target Shape

Prefer PDF-owned naming:

```txt
PdfViewerThumbnails
```

or, if the component is specifically the rail and not the complete thumbnail
subsystem:

```txt
PdfViewerThumbnailRail
```

The strongest name is `PdfViewerThumbnails` if it is part of the named PDF
viewer composition API:

```tsx
<PdfViewerProvider>
  <PdfViewerHeader />
  <PdfViewerBody>
    <PdfViewerThumbnails />
    <PdfViewerPages />
  </PdfViewerBody>
</PdfViewerProvider>
```

Use `ViewerNavigationSidebar` only at the compound viewer composition level
when the rail is being placed inside a broader viewer frame.

### Naming Rules

Use `Sidebar` only when the component owns spatial sidebar layout or generic
sidebar grammar.

Use `Thumbnails` or `ThumbnailRail` when the component owns PDF page thumbnail
behavior.

Use `ViewerNavigationSidebar` when the component is a viewer spatial rail with
a navigation purpose.

Do not use `PdfThumbnailSidebar` as an alias. The repository guideline says no
legacy adapters and no compatibility shims. This should be a hard rename.

### Implementation Plan

1. Audit current `PdfThumbnailSidebar` references.
2. Decide between `PdfViewerThumbnails` and `PdfViewerThumbnailRail`.
3. Rename the source export.
4. Rename tests.
5. Rename docs references.
6. Rename registry item names if the public registry exposes the old name.
7. Rename e2e selectors only if they use component-specific names.
8. Update examples to make placement explicit:

   ```tsx
   <ViewerNavigationSidebar aria-label="Pages">
     <PdfViewerThumbnails />
   </ViewerNavigationSidebar>
   ```

9. Rebuild all affected registry payloads.
10. Add architecture tests preventing the old export and old registry name from
    reappearing.

### Tests

Add architecture assertions:

```txt
No source export named PdfThumbnailSidebar.
No docs mention PdfThumbnailSidebar except historical migration notes.
No registry item named pdf-thumbnail-sidebar.
PDF thumbnail rail is imported through PDF viewer naming.
```

Behavior tests should remain focused on:

- virtualization;
- active page sync;
- click to navigate;
- keyboard navigation;
- page thumbnail loading and error states.

### Done Criteria

- `rg "PdfThumbnailSidebar"` returns no source or docs results except this
  blueprint or an explicitly marked migration note.
- Public API uses PDF-owned names.
- Viewer composition examples show `ViewerNavigationSidebar` as placement and
  PDF thumbnails as PDF behavior.

## Issue 4: ViewerSidebarPurpose Vocabulary Is Not Fully Proven

### Current Shape

The intended semantic prop is:

```ts
export type ViewerSidebarPurpose = "navigation" | "inspector" | "parts"
```

When implemented, it should emit:

```tsx
data-viewer-purpose="..."
```

The intended semantic wrappers are:

```tsx
<ViewerNavigationSidebar />
<ViewerInspectorSidebar />
```

The current codebase is not yet fully aligned with that intended shape. Some
call sites and documentation still use raw `ViewerSidebar` for common
navigation and inspector rails, and some architecture tests still encode older
expectations around raw primitives. This issue is therefore not only about the
type definition; it is about making source, docs, tests, and registry examples
agree on the same vocabulary.

### Why This Is Not Platonic

The direction is right, but the vocabulary is not yet proven across the whole
viewer system.

Semantic vocabularies are dangerous when they are introduced before the full
domain inventory is complete. If the names are too broad, they become vague. If
they are too narrow, later components need awkward additions.

Vocabulary uncertainty:

- Is `parts` only for MIME/file parts, or any multi-part document navigation?
- Is `outline` a subtype of `navigation`, or should it not exist at all?
- Is an OCR block panel an `inspector`, an `outline`, or `metadata`?
- Should page thumbnails be `navigation`, `thumbnails`, or remain purpose
  `navigation` with the child component expressing thumbnails?
- Should a field editing panel be `inspector`, `fields`, or `extraction`?

The candidate values are reasonable. They are not yet proven enough to call
perfect until every real sidebar use has been classified.

### Target Shape

Define purpose names by user intent, not component implementation.

Candidate final vocabulary:

```ts
export type ViewerSidebarPurpose = "navigation" | "inspector" | "parts"
```

Do not add `outline` unless the system has a meaningful distinction between
outline navigation and other navigation rails. A value that exists only because
the child component is named "outline" is not high entropy.

The purpose should answer:

```txt
What is this rail for in the viewer?
```

It should not answer:

```txt
Which component renders inside it?
Which file format is active?
Which CSS layout does it use?
```

### Audit Matrix

Every current viewer sidebar use should be classified:

```txt
Split viewer page rail
  purpose: navigation
  reason: jumps between pages/segments on the document axis

PDF thumbnails block rail
  purpose: navigation
  reason: page navigation through thumbnail previews

Email MIME parts rail
  purpose: parts
  reason: selects message body, text fallback, inline parts, and attachments

Edit viewer field panel
  purpose: inspector
  reason: edits or inspects extraction fields for the selected document

Layout blocks OCR panel
  purpose: inspector
  reason: inspects OCR/layout blocks associated with the document

Future document outline
  purpose: navigation or outline
  decision needed: only add outline if it changes behavior, styling, or tests
```

### Implementation Plan

1. Build a table of every `<ViewerSidebar` and wrapper call site.
2. Record side, aria label, child component, and intended user purpose.
3. Decide whether `outline` survives.
4. Update `ViewerSidebarPurpose` accordingly.
5. Update wrappers only for purposes that are common enough to deserve names.
6. Avoid creating wrappers for every purpose. Wrappers should encode repeated
   semantics, not provide decorative aliases.
7. Add tests that every public viewer sidebar example has an accessible label
   and, when meaningful, a stable `data-viewer-purpose`.

### Tests

Architecture tests should assert:

- no raw `ViewerSidebar` in viewer examples when a semantic wrapper is the
  established local convention;
- every `ViewerSidebar` has an `aria-label` or an accessible name;
- allowed `data-viewer-purpose` values are documented and used by at least one
  real component;
- no unused purpose remains in the public type.

### Done Criteria

- Purpose names match real viewer intents.
- No speculative purpose remains.
- Call sites use the same purpose name for the same concept.
- Docs explain the vocabulary with examples.

## Issue 5: Public And Internal Viewer Sidebar Contexts Need Permanent Separation

### Current Shape

The viewer sidebar system needs both public control state and private
registration machinery.

The desired public hooks are:

```ts
useViewerSidebar()
useOptionalViewerSidebar()
```

The desired private hooks are:

```ts
useViewerSidebarInternal()
useOptionalViewerSidebarInternal()
```

Current source is already close to the correct shape: public hooks read
`ViewerSidebarContext`, while private hooks read `ViewerSidebarInternalContext`.
That is the right architecture. The remaining issue is that the boundary must
be guarded permanently, because this is exactly the kind of internal/public
split that future edits can accidentally collapse.

### Why This Is Not Platonic

Projection is a boundary patch, not a perfect boundary. The ideal state is
separate contexts, and the current source should keep that state.

The risk is regression:

1. A future edit might make the public hook read the internal context again.
2. A future internal field might leak through a public return object.
3. A future refactor might make public context identity churn when only
   internal registration state changes.

The boundary should be impossible to violate silently.

### Target Shape

Keep the context split explicit:

```txt
ViewerSidebarContext
  state
  open
  setOpen
  toggle
  mode
  requestedMode
  collapsible
  side

ViewerSidebarInternalContext
  publicSidebar
  registerSidebar
  sidebar id
  measurement and layout internals
```

Public hooks read only `ViewerSidebarContext`.

Internal hooks read `ViewerSidebarInternalContext`.

`ViewerRoot` owns both providers. Public values should be memoized with exact
dependencies.

### Implementation Plan

1. Keep `ViewerSidebarContextValue` public and free of registration fields.
2. Keep `ViewerSidebarInternalContextValue` private to `viewer.tsx`.
3. Keep separate React contexts.
4. Ensure `useViewerSidebar()` reads the public context only.
5. Ensure `useOptionalViewerSidebar()` reads the public context only.
6. Keep private hooks explicitly named:

   ```ts
   useViewerSidebarInternal()
   useOptionalViewerSidebarInternal()
   ```

7. Memoize the public value once in `ViewerRoot`.
8. Memoize the internal value separately.
9. Do not reintroduce a public projection helper from internal state.
10. Add tests proving public hook keys never include internal fields.

### Performance Requirement

The public context value should be referentially stable when public fields do
not change.

That matters because downstream controls may use the hook result in effects or
memoized child props. Even if the current UI does not suffer, the ideal
primitive should not create avoidable churn.

### Tests

Add tests for:

- public hook key set;
- public hook object identity across unrelated internal registration changes;
- trigger behavior still working after sidebar registration;
- auto mode still switching correctly after container measurement;
- no public access to registration methods.

Architecture test:

```txt
useViewerSidebar must not call useViewerSidebarInternal.
```

or, more generally:

```txt
Public hooks read public context only.
Private hooks read internal context.
```

### Done Criteria

- Private fields cannot leak through public hooks by construction.
- Public context value is memoized.
- Registration internals are invisible to consumers.
- Tests prove both runtime and source-level boundaries.

## Issue 6: Sidebar Documentation Does Not Mirror The Exact Taxonomy

### Current Shape

The docs are improved, but the route and concepts are still under pressure.

`sidebar.mdx` has historically carried domain sidebar documentation, especially
around `SegmentSidebar`, while the word `sidebar` now refers to at least three
different layers:

```txt
Sidebar
  app-shell primitive

ViewerSidebar
  viewer spatial primitive

SegmentSidebar / AttachmentSidebar
  domain sidebars

SidebarList*
  providerless row grammar
```

### Why This Is Not Platonic

The code can be correct while the docs still teach the wrong mental model.

If the docs route named `sidebar` primarily documents `SegmentSidebar`, it
preserves the old ambiguity. New contributors will continue to ask whether
`SegmentSidebar` is a shadcn sidebar, a viewer sidebar, or a domain component.

A platonic system needs documentation that makes the hierarchy impossible to
misread.

### Target Shape

Split docs by concept.

Preferred docs routes:

```txt
components/sidebar
  SidebarProvider, Sidebar, app-shell sidebar primitives

components/sidebar-list
  providerless grouped-row primitives

components/segment-sidebar
  SegmentSidebar domain component

components/attachment-sidebar
  AttachmentSidebar domain component

components/viewer
  ViewerRoot, ViewerBody, ViewerSidebar, ViewerDocumentSurface,
  ViewerNavigationSidebar, ViewerInspectorSidebar

viewers/pdf-viewer
  PdfViewerThumbnails or PdfViewerThumbnailRail
```

The docs should never rely on the reader already knowing which "sidebar" layer
is being discussed.

### Required Explanations

The docs should explicitly answer:

- Use `Sidebar` when building app navigation.
- Use `ViewerSidebar` when placing a rail inside a viewer body.
- Use `ViewerNavigationSidebar` for viewer-local navigation rails.
- Use `ViewerInspectorSidebar` for viewer-local inspection or editing panels.
- Use `SidebarList*` when building a providerless grouped row list inside a
  viewer, modal, card, or domain component.
- Use `SegmentSidebar` when rendering segment navigation from `Segment[]`.
- Use `AttachmentSidebar` when rendering file attachment navigation.
- Do not put `SidebarProvider` inside `ViewerSidebar` unless there is a new,
  documented app-shell reason.

### Implementation Plan

1. Rename or split the current `sidebar.mdx` route.
2. Add a primitive app-sidebar doc if missing.
3. Add a `sidebar-list.mdx` doc for providerless grouped-row grammar.
4. Move `SegmentSidebar` content to `segment-sidebar.mdx`.
5. Add or update `attachment-sidebar.mdx`.
6. Update examples to show composition boundaries, not just isolated widgets.
7. Add source and docs tests preventing old route ambiguity from returning.

### Tests

Architecture tests should assert:

- `sidebar.mdx` does not present `SegmentSidebar` as the primary sidebar
  component;
- `segment-sidebar.mdx` exists if `SegmentSidebar` is publicly documented;
- `sidebar-list.mdx` exists if `SidebarList*` is public registry API;
- docs mention `ViewerSidebar` separately from `Sidebar`;
- docs include at least one example where `ViewerNavigationSidebar` wraps a
  domain rail or thumbnail rail.

### Done Criteria

- The docs taxonomy matches the code taxonomy.
- The word `sidebar` is always qualified when ambiguity is possible.
- Docs routes map to public component boundaries.

## Issue 7: Registry Topology Is Corrected But Needs Permanent Guardrails

### Current Shape

The latest direction adds `sidebar-list` and `sidebar-row` to the registry
graph so providerless row grammar can be installed without depending on
app-shell sidebar internals.

The intended graph is:

```txt
segment-sidebar depends on sidebar-list
attachment-sidebar depends on sidebar-list
sidebar-list depends on sidebar-row
sidebar depends on sidebar-row
```

This must be true in both `registry.json` and `public/r/*.json`, and it must
stay true as imports change.

### Why This Is Not Platonic

The registry graph is easy to break when source imports change.

The architecture test already checks some relative imports for viewer entries,
but providerless sidebar primitives deserve their own guardrails because they
are now part of the public registry surface.

If a future change makes `segment-sidebar.tsx` import a new local module and
forgets to add the registry dependency, local development will still work while
registry installation breaks.

### Target Shape

Every registry item should have dependency tests matching its source imports.

For sidebar work specifically:

```txt
segment-sidebar
  must include sidebar-list
  must not include sidebar
  must not include embedded provider dependencies

attachment-sidebar
  must include sidebar-list
  must not include sidebar directly unless source imports it directly

sidebar-list
  includes sidebar-row instead of sidebar

sidebar
  includes sidebar-row after Issue 1
```

### Implementation Plan

1. Add a test that parses source imports for the sidebar registry items.
2. Add a test that compares those imports to `registryDependencies`.
3. Special-case aliases only where the registry system requires them.
4. Add assertions for forbidden dependencies:

   ```txt
   segment-sidebar -> sidebar
   attachment-sidebar -> sidebar
   sidebar-list -> sidebar
   ```

5. Keep public/r content-alignment tests.

### Done Criteria

- Registry dependency drift fails tests before it reaches users.
- Source import changes and registry dependency changes move together.
- The public registry can install each sidebar item independently.

## Issue 8: The Semantic Wrappers Are Useful But Not Yet Proven As The Minimum API

### Current Shape

The target architecture includes:

```tsx
<ViewerNavigationSidebar />
<ViewerInspectorSidebar />
<ViewerDocumentSurface />
```

These wrappers should be intentionally thin. They should encode common
`viewerPurpose` and `viewerRole` values without introducing slots or new state.

The current repository is not yet settled. Some tests and docs still prefer
raw `ViewerSidebar` and `ViewerSurface`; some intended wrapper usages are not
present in the canonical source. That means the question is still open:
which wrappers are the minimum public API, and where should raw primitives
remain the better expression?

### Why This Is Not Platonic

Thin wrappers are only perfect if they remove repeated ambiguity without
creating unnecessary names.

`ViewerDocumentSurface` is likely justified because primary document rendering
is a repeated and important concept.

`ViewerNavigationSidebar` is likely justified because page rails, thumbnails,
outlines, and segment navigation all need the same placement semantics.

`ViewerInspectorSidebar` is plausible, but it needs proof across extraction
field panels, OCR/layout panels, metadata panels, and future detail panels.

If a wrapper is used only once or adds no clarity beyond a prop, it is not high
entropy.

### Target Shape

Keep only wrappers that satisfy all criteria:

- used in multiple real call sites or represent a core public concept;
- prevent a repeated naming or purpose mistake;
- have no independent state;
- do not hide layout order;
- do not become a slot API.

Potential final set:

```txt
ViewerDocumentSurface
ViewerNavigationSidebar
ViewerInspectorSidebar
```

Potential removals:

- remove any wrapper that remains single-use after the full audit;
- use raw `ViewerSidebar viewerPurpose="..."` for rare purposes.

### Implementation Plan

1. Count wrapper usages.
2. Classify each usage by user intent.
3. Remove wrappers that do not meet the criteria.
4. Add docs explaining why wrappers exist.
5. Add tests only for wrappers that are public API.

### Done Criteria

- Every wrapper earns its export.
- No wrapper exists only because it sounds symmetrical.
- Raw primitives remain available for uncommon compositions.

## Issue 9: Data Attributes Are Good But Need A Style/Test Contract

### Current Shape

The target semantic viewer API should emit:

```txt
data-viewer-role
data-viewer-purpose
```

This is useful for tests, styling, and semantic inspection.

The current source and examples are not yet fully aligned around these
attributes. That makes the contract work part of the implementation, not
documentation polish after the fact.

### Why This Is Not Platonic

Data attributes can become passive decoration if there is no contract around
who may use them.

Questions:

- Are these attributes public styling hooks?
- Are they test-only hooks?
- Are they stable registry API?
- Can app code rely on them?
- Should docs mention them?

If the answer is unclear, the attributes are useful but not perfect.

### Target Shape

Document the contract.

Recommended contract:

```txt
data-slot
  stable structural selector for tests and local styling

data-viewer-role
  stable semantic selector for viewer surface role

data-viewer-purpose
  stable semantic selector for viewer sidebar purpose
```

If the attributes are public, treat value changes as API changes. If they are
not public, do not document them as styling hooks.

### Implementation Plan

1. Decide public or internal status.
2. Document the decision in viewer docs.
3. Update tests to reflect the intended contract.
4. Avoid adding semantic data attributes casually.

### Done Criteria

- Attribute status is explicit.
- Values are covered by tests.
- Docs and tests use the same vocabulary.

## Issue 10: The System Still Needs A Full Naming Sweep

### Current Shape

The code now uses better names, but the larger repository still has many
historical names around viewer shells, sidebars, thumbnails, rails, surfaces,
and parts.

### Why This Is Not Platonic

Perfect variable names are not local. The same concept must get the same name
everywhere.

Known name families that must be audited:

```txt
surface
document surface
viewer surface
body
document pane
panel
rail
sidebar
navigation sidebar
inspector sidebar
parts
attachments
thumbnails
outline
```

The hard part is not replacing words mechanically. The hard part is deciding
which concepts are truly distinct.

### Target Vocabulary

Proposed vocabulary:

```txt
ViewerRoot
  outer viewer frame and measurement boundary

ViewerHeader
  header above the body

ViewerBody
  body region below the header

ViewerSidebar
  spatial rail inside ViewerBody

ViewerNavigationSidebar
  ViewerSidebar for navigation intent

ViewerInspectorSidebar
  ViewerSidebar for inspection/editing intent

ViewerSurface
  generic flexible surface inside ViewerBody

ViewerDocumentSurface
  primary document rendering surface

Sidebar
  app-shell sidebar primitive

SidebarList
  providerless grouped-row primitive family

SegmentSidebar
  domain segment navigation component

AttachmentSidebar
  domain file attachment navigation component

PdfViewerThumbnails
  PDF-owned thumbnail navigation component
```

### Implementation Plan

1. Run `rg` for the known name families.
2. Build a table of current name, concept, owner module, and proposed final
   name.
3. Rename only when the concept is wrong or ambiguous.
4. Avoid renaming for taste.
5. Update tests and docs in the same pass.
6. Rebuild registry payloads.

### Done Criteria

- Same concept, same name.
- Different concept, different name.
- No name encodes a removed implementation detail.
- No name implies the wrong ownership layer.

## Execution Order

The correct order is:

1. Lock the layout precedence rule:
   `ViewerHeader` wins over `ViewerSidebar`, and `ViewerSidebar` wins over
   document-local legends inside `ViewerDocumentSurface`.
2. Prove no stale provider naming remains.
3. Prove `sidebar-row` owns shared row variants.
4. Add permanent registry topology tests.
5. Guard the public/private viewer sidebar context split.
6. Audit and finalize `ViewerSidebarPurpose`.
7. Prove or prune semantic wrappers.
8. Prove the PDF thumbnail naming cutover is total.
9. Split and rewrite sidebar docs.
10. Perform the full naming sweep.

Reasoning:

- The screenshot bug is a structural layout-contract bug. It should be fixed
  before further API polish, otherwise the API can look clean while the visual
  hierarchy is still ambiguous.
- Stale provider naming is the smallest pure cleanup and removes an explicit
  obsolete abstraction.
- `sidebar-row` fixes the row-variant dependency smell and sets up a cleaner
  registry graph.
- Registry guardrails should land before more renames.
- The context split is internal but important, so the guardrails should land
  after the simpler source and registry boundaries are clean.
- Purpose and wrapper audits should happen before docs, otherwise docs will
  encode unstable vocabulary.
- PDF thumbnail naming proof and docs should move after the vocabulary is
  settled.
- The full naming sweep should come last so it is based on final decisions, not
  temporary names.

## Non-Goals

- Do not introduce a slot-object viewer shell.
- Do not add `ViewerSidebarProvider`.
- Do not make `Sidebar` aware of segments, PDFs, files, emails, OCR blocks, or
  extraction fields.
- Do not force PDF thumbnails into `SidebarListButton`.
- Do not add compatibility aliases for renamed components.
- Do not preserve stale prop names for migration comfort.
- Do not create wrappers for symmetry.
- Do not rename working concepts just because a shorter name exists.

## Final Standard

The sidebar/viewer system reaches the platonic ideal only when all of these are
true:

- the layout hierarchy is unambiguous: header wins over sidebar, sidebar wins
  over document-local chrome, and all sidebar positioning is scoped to
  `ViewerBody`;
- the import graph mirrors the conceptual graph;
- every public prop describes the current implementation;
- every exported wrapper earns its existence across real call sites;
- every semantic value is used, documented, and tested;
- domain components own domain state and no generic primitive knows domain
  concepts;
- registry dependencies are mechanically guarded;
- docs teach the same taxonomy as the code;
- old names do not survive as aliases or compatibility paths;
- the same concept has the same name everywhere.

Until then, the architecture is improved, but not perfect.
