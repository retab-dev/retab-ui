# File Viewer From-Scratch Platonic Blueprint

## Verdict

No, the current File Viewer is not yet the platonic ideal.

The mistake would be to interpret "simplicity" as "fewer components." The
shadcn Sidebar proves the opposite. It exposes many small parts:
`SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarRail`, `SidebarInset`,
`SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenuButton`,
`SidebarMenuAction`, and more.

The genius is not component scarcity. The genius is concept scarcity.

File Viewer should therefore have more building blocks than Sidebar, because it
has more real domains: file resources, document rendering, renderer controls,
sidebar navigation, evidence/source lists, virtualized pages, motion, geometry,
and accessibility. The ideal is not fewer parts. The ideal is that every public
part names exactly one real contract, and every internal module owns exactly one
reason to exist.

The target is:

- many small public primitives
- one obvious state owner
- one obvious motion owner
- one renderer contract
- no compatibility aliases
- no duplicate anatomy
- no incidental DOM discovery
- no hot-path React work
- no names that almost mean the same thing

## Absolute Reference

The reference is `registry/new-york-v4/ui/sidebar.tsx`.

The relevant lessons are:

1. Public names are flat exports, not dotted namespace members.
   `SidebarHeader`, not `Sidebar.Header`.

2. The provider owns state. Anatomical parts are mostly DOM, styling, and
   `data-*` contracts.

3. The public surface is large because the UI grammar is large. That is fine.
   The state model remains small.

4. Data attributes are part of the component contract:
   `data-slot`, `data-sidebar`, `data-state`, `data-collapsible`,
   `data-variant`, `data-side`.

5. `SidebarRail` is legitimate because it is a real pointer target, not a
   decorative alias.

6. `asChild` exists only where substituting the rendered element is genuinely
   useful.

7. Styling flows from state attributes and local variants, not from consumers
   reaching into internals.

8. The root component gives descendants enough context, but descendants do not
   own the root state machine.

File Viewer should copy this grammar, not Sidebar's exact implementation.

## Product Definition

File Viewer is a bounded document/file viewing primitive.

It must render one active file while allowing the user to:

- understand what file is being viewed
- use renderer-specific controls
- navigate optional file-related side content
- inspect evidence, thumbnails, attachments, fields, and source references
- keep reading while the sidebar opens or closes
- retain accessible semantics during motion

The sidebar toggle is the hardest interaction. If that interaction is fast and
correct, the architecture is probably sound. If that interaction is slow, the
architecture is probably leaking renderer work, layout reads, React rerenders,
or semantic updates into the hot path.

## Public API Grammar

### Required Rule

All public parts use flat shadcn-style names.

Allowed:

```tsx
<FileViewerProvider>
  <FileViewer>
    <FileViewerHeader />
    <FileViewerContent />
  </FileViewer>
</FileViewerProvider>
```

Forbidden:

```tsx
<FileViewer.Provider>
  <FileViewer.Root>
    <FileViewer.Header />
    <FileViewer.Content />
  </FileViewer.Root>
</FileViewer.Provider>
```

There is no dotted API.

### Canonical Composed Usage

```tsx
<FileViewerProvider source={source}>
  <FileViewer>
    <FileViewerHeader>
      <FileViewerSidebarTrigger />
      <FileViewerHeaderTitle />
      <FileViewerHeaderMeta />
      <FileViewerControls />
    </FileViewerHeader>

    <FileViewerContent>
      <FileViewerSidebar aria-label="Document navigation">
        <FileViewerSidebarHeader />
        <FileViewerSidebarContent />
        <FileViewerSidebarFooter />
        <FileViewerSidebarRail />
      </FileViewerSidebar>

      <FileViewerInset>
        <FileViewerViewport>
          <FileViewerDocument />
        </FileViewerViewport>
      </FileViewerInset>
    </FileViewerContent>
  </FileViewer>
</FileViewerProvider>
```

This is the source of truth. Any easy API must expand to this anatomy. It must
not be a second implementation.

### Public Components

Core:

- `FileViewerProvider`
- `FileViewer`
- `FileViewerHeader`
- `FileViewerHeaderTitle`
- `FileViewerHeaderMeta`
- `FileViewerControls`
- `FileViewerSidebarTrigger`
- `FileViewerContent`
- `FileViewerInset`
- `FileViewerViewport`
- `FileViewerDocument`
- `FileViewerPreview`

Sidebar:

- `FileViewerSidebar`
- `FileViewerSidebarHeader`
- `FileViewerSidebarContent`
- `FileViewerSidebarFooter`
- `FileViewerSidebarRail`
- `FileViewerSidebarSection`
- `FileViewerSidebarSectionHeader`
- `FileViewerSidebarSectionTitle`
- `FileViewerSidebarSectionAction`
- `FileViewerSidebarSectionContent`
- `FileViewerSidebarSeparator`

Source/evidence primitives:

- `FileViewerSourceList`
- `FileViewerSourceItem`
- `FileViewerSourceTrigger`
- `FileViewerSourceAction`
- `FileViewerSourceBadge`
- `FileViewerFieldSource`
- `FileViewerFieldSourceLabel`
- `FileViewerFieldSourceValue`
- `FileViewerFieldSourceStatus`
- `FileViewerLegend`

Hooks:

- `useFileViewerResource`
- `useFileViewerSidebar`
- `useFileViewerRendererFrame`
- `useFileViewerViewportSize`

### Names To Remove

These are not part of the ideal public surface:

- `FileViewerSurface`
- `FileViewerTitle`
- `FileViewerMeta`
- `FileViewerControls`
- `FileViewerBody`
- `FileViewerIdentity`
- `FileViewerHeaderStart`
- `FileViewerHeaderEnd`

Reasons:

- `FileViewerSurface` is only `FileViewerInset + FileViewerViewport`. That is a
  convenience composition, not a primitive contract.
- `FileViewerTitle` and `FileViewerMeta` are too global. The precise names are
  `FileViewerHeaderTitle` and `FileViewerHeaderMeta`.
- The controls primitive is named `FileViewerControls`, because renderers
  register controls, not arbitrary chrome.
- `FileViewerBody` competes with `FileViewerContent`. The shadcn analogy is
  `SidebarContent`, so the viewer row should be `FileViewerContent`.
- `FileViewerIdentity`, `FileViewerHeaderStart`, and `FileViewerHeaderEnd` are
  layout opinions, not durable anatomy.

## Component Responsibility Table

| Public part | Responsibility |
| --- | --- |
| `FileViewerProvider` | Resource, descriptor, controls registration, provider-level sidebar props. |
| `FileViewer` | Bounded shell, sidebar state owner, geometry owner, motion owner. |
| `FileViewerHeader` | Horizontal header container. |
| `FileViewerHeaderTitle` | Active file display name. |
| `FileViewerHeaderMeta` | Passive descriptor metadata. |
| `FileViewerControls` | Renderer-registered controls and file download actions. |
| `FileViewerSidebarTrigger` | Explicit control that toggles the nearest file viewer sidebar. |
| `FileViewerContent` | Horizontal region below the header containing sidebar plus main inset. |
| `FileViewerSidebar` | Optional file-scoped side panel. |
| `FileViewerSidebarRail` | Thin pointer target for sidebar resize/toggle affordance. |
| `FileViewerInset` | Main document column and document frame alignment boundary. |
| `FileViewerViewport` | Renderer viewport boundary. |
| `FileViewerDocument` | Active resource route host. |

No public part should own two unrelated jobs.

## Internal Module Boundaries

The ideal module map is:

```txt
file-viewer.tsx
file-viewer-provider.tsx
file-viewer-context.tsx
file-viewer-frame.tsx
file-viewer-content.tsx
file-viewer-header.tsx
file-viewer-document.tsx
file-viewer-route.tsx
file-viewer-resource-state.ts
file-viewer-controls-context.ts
file-viewer-state-machine.ts
file-viewer-command-bus.ts
file-viewer-elements.ts
file-viewer-accessibility.ts
file-viewer-keyboard.ts
file-viewer-motion-kernel.ts
file-viewer-transition-plan.ts
file-viewer-renderer-contract.ts
viewer-measurement.ts
```

Responsibilities:

- `file-viewer.tsx` exports public names only. No logic.
- `file-viewer-provider.tsx` owns resource and controls providers.
- `file-viewer-context.tsx` defines contexts and public hooks. No state
  transitions.
- `file-viewer-frame.tsx` owns the shell state machine integration.
- `file-viewer-content.tsx` owns anatomical DOM under the shell.
- `file-viewer-header.tsx` owns header anatomy.
- `file-viewer-document.tsx` owns document boundary, fallback, suspense, and
  route handoff.
- `file-viewer-route.tsx` maps descriptor categories to renderers.
- `file-viewer-state-machine.ts` is pure sidebar state logic.
- `file-viewer-command-bus.ts` exposes imperative commands as stable functions.
- `file-viewer-elements.ts` registers named DOM contracts.
- `file-viewer-accessibility.ts` centralizes `aria-*`, `inert`, and focus
  restoration.
- `file-viewer-keyboard.ts` centralizes keyboard policy.
- `file-viewer-motion-kernel.ts` owns hot-path animation writes.
- `file-viewer-transition-plan.ts` is pure geometry transition planning.
- `file-viewer-renderer-contract.ts` is the only geometry contract consumed by
  renderers.
- `viewer-measurement.ts` is the only general-purpose element measurement
  primitive.

## State Model

The public state model should be simple:

```ts
type FileViewerSidebarState = {
  canToggleSidebar: boolean
  isSidebarOpen: boolean
  setSidebarOpen: (value: boolean | ((isSidebarOpen: boolean) => boolean)) => void
  sidebarMode: "inline" | "overlay"
  sidebarSide: "left" | "right"
  sidebarState: "expanded" | "collapsed"
  toggleSidebar: () => void
}
```

The internal state model may be richer:

- requested open
- visual open
- semantic open
- inline/overlay mode
- measured body width
- measured sidebar width
- motion frame
- pending semantic settle
- pending raster publish

But the public hook should not leak phase machinery. Consumers should not have
to decide whether they want requested, visual, or semantic open. The component
should decide.

Internal naming must be precise:

- `isSidebarRequestedOpen`
- `isSidebarVisuallyOpen`
- `isSidebarSemanticallyOpen`
- `sidebarVisualState`
- `sidebarMode`
- `sidebarSide`

Public naming should be ergonomic:

- `isSidebarOpen`
- `setSidebarOpen`
- `toggleSidebar`
- `sidebarState`

## Motion Contract

Sidebar toggle must be a write-only hot path.

Allowed during the toggle hot path:

- read the current motion snapshot from memory
- compute the next transition plan from cached geometry
- write sidebar gap width
- write sidebar panel width/transform
- write document surface transform
- update named data attributes on registered elements
- update trigger `aria-expanded`

Forbidden during the toggle hot path:

- walking the DOM
- querying selectors
- reading page layout
- recomputing source anchors
- rerendering PDF pages
- recalculating visible pages
- rebuilding renderer controls
- measuring arbitrary elements
- notifying broad React context consumers per animation frame

The motion kernel owns:

- current geometry snapshot
- current transaction
- target geometry
- `requestAnimationFrame`
- direct writes to registered elements

React may subscribe to settled snapshots. React should not drive each animation
frame.

## DOM Contracts

Every important DOM element is registered by name:

- `viewerShellElement`
- `viewerContentElement`
- `documentFrameElement`
- `documentViewportElement`
- `documentSurfaceElement`
- `sidebarGapElement`
- `sidebarElement`
- `sidebarTriggerElement`
- `viewerControlsElement`

No file viewer code should use `querySelector` to find these elements.

Selectors are questions. Registrations are contracts.

Allowed DOM reads:

- `viewer-measurement.ts`
- `file-viewer-motion-kernel.ts` for CSS length resolution only
- renderer-specific measurement modules that declare their contract

All other layout reads need an architecture test and a written justification.

## Data Attribute Contract

File Viewer should mirror shadcn Sidebar's reliance on stable attributes.

Required attributes:

- `data-slot="file-viewer-root"`
- `data-slot="file-viewer-header"`
- `data-slot="file-viewer-content"`
- `data-slot="file-viewer-sidebar"`
- `data-slot="file-viewer-sidebar-rail"`
- `data-slot="file-viewer-inset"`
- `data-slot="file-viewer-viewport"`
- `data-slot="file-viewer-document"`
- `data-file-viewer-sidebar-state="expanded" | "collapsed"`
- `data-file-viewer-sidebar-mode="inline" | "overlay"`
- `data-file-viewer-sidebar-side="left" | "right"`
- `data-file-viewer-sidebar-open="true" | "false"`

State attributes are for styling and tests. They are not a substitute for the
element registry.

## Accessibility Contract

Accessibility is not a side effect of CSS.

The accessibility coordinator owns:

- sidebar `aria-hidden`
- sidebar `inert`
- trigger `aria-controls`
- trigger `aria-expanded`
- trigger `aria-disabled`
- focus restoration when a semantic sidebar closes
- Escape behavior for the active viewer

Intent, visual state, and semantic state are separate clocks:

- intent changes immediately
- pixels move on animation frames
- semantics settle when the component can truthfully expose the result

Inline close may keep semantics open during the visual collapse if removing the
sidebar from the accessibility tree would steal focus or lie about interactive
content before motion completes.

## Renderer Contract

Renderers do not know about sidebar DOM.

Renderers may consume:

```ts
type FileViewerRendererFrame = {
  element: HTMLDivElement | null
  align: "start" | "center" | "end"
  isTransitioning: boolean
  layoutInlineSize: number | null
  rasterInlineSize: number | null
  settledInlineSize: number | null
  transactionFromInlineSize: number | null
  transactionToInlineSize: number | null
  motionProgress: number
  motionPhase: "idle" | "sliding"
}
```

Renderers may not:

- read file viewer sidebar elements
- infer sidebar state from DOM classes
- query the viewer tree
- own shell motion
- mutate shell geometry

PDF should use the renderer frame to:

- compute fit-width scale
- keep raster preparation ahead of visual resize
- avoid rerendering every page during sidebar animation
- preserve scroll anchors
- separate display scale from render scale

## PDF Renderer Architecture

The PDF renderer should stay split:

- `pdf-viewer-document-resource.ts`: retain/release document resources.
- `pdf-viewer-document-layout.ts`: scale, rotation, fit-width, renderer frame.
- `pdf-viewer-document-runtime.ts`: scroll, virtualization, render scheduling.
- `pdf-viewer-pages-layer.tsx`: DOM layer for virtualized pages.
- `pdf-viewer-document-controls.ts`: controls state and registration.

This split is correct because each file has a different clock:

- resource lifetime
- layout math
- scroll/runtime state
- page DOM rendering
- controls projection

Those clocks should not be collapsed back into `pdf-viewer-content.tsx`.

## Controls Contract

Renderer controls are registered, not pushed through props from the shell.

Flow:

```txt
renderer -> useViewerControlsRegistration -> FileViewerProvider -> FileViewerControls
```

`FileViewerControls` renders the current registered state:

- page position
- zoom
- rotate
- downloads
- renderer-specific extra actions
- loading state

The shell does not know what a PDF page is. The PDF renderer does not own the
File Viewer header.

## Source And Evidence Contract

Source navigation should be data-first.

The ideal viewer has source/evidence primitives for display, but navigation
targets are precomputed data:

- source id
- descriptor key
- page number
- normalized page area
- scroll target
- availability state
- label and metadata

Clicking a source should choose a target from an index. It should not rebuild
anchors from rendered DOM.

## Easy APIs

Easy APIs are allowed only if they are thin compositions.

Allowed:

```tsx
<FileViewerPreview source={source} />
```

It must expand to:

```tsx
<FileViewerProvider source={source}>
  <FileViewer>
    <FileViewerInset>
      <FileViewerViewport>
        <FileViewerDocument />
      </FileViewerViewport>
    </FileViewerInset>
  </FileViewer>
</FileViewerProvider>
```

Forbidden:

- a second file routing path
- a second controls path
- a second fallback path
- private anatomy that public composition cannot reproduce

## What Belongs In Public API

A component belongs in the public API if at least one of these is true:

1. It owns a semantic DOM landmark or region.
2. It owns a real layout boundary.
3. It owns a stable data-slot contract.
4. It is a real interactive affordance.
5. It is a reusable source/evidence primitive.
6. It is required to compose renderer controls without private APIs.

A component does not belong in the public API if:

1. It only saves two lines of JSX.
2. It duplicates another primitive.
3. It names a visual placement instead of a contract.
4. It exists only for legacy compatibility.
5. It exposes an internal phase or implementation detail.

## Naming Law

The same concept gets the same word everywhere.

Use:

- `sidebar`, not `panel`, `drawer`, `rail`, and `nav` interchangeably
- `content` for the area below the header
- `inset` for the main document column
- `viewport` for the renderer viewport
- `document` for the active routed document
- `controls` for renderer actions
- `source` for evidence/navigation source rows
- `fieldSource` for field-level source cards

Do not use:

- `body`
- `surface`
- `identity`
- `toolbar`
- `start`
- `end`
- `chrome`

unless the word names a real independent contract that cannot be named more
precisely.

## Tests As Architecture Law

Architecture tests should enforce:

- no dotted `FileViewer.*` public API
- no public compatibility aliases
- no `FileViewerSurface`
- no `FileViewerTitle` or `FileViewerMeta`
- required exports exist
- docs use the same names as the source
- registry payloads match source
- no `querySelector` in File Viewer shell/renderers
- DOM reads stay in approved measurement modules
- motion writes stay in `file-viewer-motion-kernel.ts`
- accessibility writes stay in `file-viewer-accessibility.ts`
- PDF split files remain split
- renderer route remains resource-first
- controls flow through registration
- source navigation uses data contracts, not DOM discovery

Performance tests should verify:

- sidebar toggle does not rerender PDF pages
- sidebar toggle does not recompute page virtualization during the frame loop
- sidebar toggle does not call renderer layout reads in the click handler
- inline transition keeps visual motion smooth on large PDFs
- Escape closes only the active viewer
- focus restores to trigger when semantic sidebar closes

## Implementation Sequence

### Phase 1: Freeze The Public Grammar

- Rename `FileViewerTitle` to `FileViewerHeaderTitle`.
- Rename `FileViewerMeta` to `FileViewerHeaderMeta`.
- Rename `FileViewerControls` to `FileViewerControls`.
- Delete `FileViewerSurface` from the public API.
- Keep `FileViewerSidebarRail` if it remains a real pointer affordance.
- Keep `FileViewerContent`, not `FileViewerBody`.
- Update docs, tests, registry payloads, and examples in one cut.

### Phase 2: Tighten The State Surface

- Hide requested/visual/semantic phases from the public hook.
- Public hook returns `isSidebarOpen`, `setSidebarOpen`, `toggleSidebar`,
  `sidebarState`, `sidebarMode`, `sidebarSide`, and `canToggleSidebar`.
- Internal contexts may keep phase-specific names.
- Keep command bus stable for internal interactive controls.

### Phase 3: Make The Hot Path Minimal

- Ensure click handler only calls the command bus.
- Ensure command bus only updates intent and starts the motion plan.
- Ensure the frame loop only writes registered element styles.
- Ensure semantic/accessibility updates are coordinated, not scattered.

### Phase 4: Finish Renderer Isolation

- PDF consumes only `FileViewerRendererFrame`.
- PDF pages layer registers the document surface explicitly.
- PDF runtime owns scroll and virtualization.
- PDF layout owns fit-width/display/render scale.
- No renderer reaches into shell DOM.

### Phase 5: Delete Legacy

- No adapters.
- No aliases.
- No duplicate docs.
- No "old name" exports.
- No hidden fallback paths.

## Final Shape

The final component should feel like this:

```tsx
<FileViewerProvider source={source}>
  <FileViewer>
    <FileViewerHeader>
      <FileViewerSidebarTrigger />
      <FileViewerHeaderTitle />
      <FileViewerHeaderMeta />
      <FileViewerControls />
    </FileViewerHeader>

    <FileViewerContent>
      <FileViewerSidebar aria-label="Pages">
        <FileViewerSidebarHeader />
        <FileViewerSidebarContent>
          <FileViewerSourceList />
        </FileViewerSidebarContent>
        <FileViewerSidebarFooter />
        <FileViewerSidebarRail />
      </FileViewerSidebar>

      <FileViewerInset>
        <FileViewerViewport>
          <FileViewerDocument />
        </FileViewerViewport>
      </FileViewerInset>
    </FileViewerContent>
  </FileViewer>
</FileViewerProvider>
```

That is the platonic target: shadcn grammar, file-viewer specificity, renderer
isolation, fast motion, explicit DOM contracts, and no extra names.
