# File Viewer Clean-Slate Platonic Ideal Blueprint

## Verdict

No. If the standard is the platonic ideal, the target is not "a faster sidebar toggle." The target is a file viewer whose state, motion, rendering, accessibility, and source navigation are so cleanly separated that the toggle is naturally instant because there is nothing expensive on the hot path.

This blueprint ignores existing implementation constraints. It does not preserve legacy component boundaries, compatibility shims, prop names, contexts, DOM shape, CSS contracts, or migration paths. It defines the component as it should exist if built from first principles.

## Product Definition

The component is a universal file viewer with an optional sidebar.

It has one primary job: render a file or document while letting the user inspect, navigate, and act on related source evidence without disrupting the document surface.

The sidebar toggle is a first-class interaction, not a side effect of layout. Opening or closing the sidebar must feel immediate on every supported document size because visual motion is owned by a tiny motion system, not by React tree reconciliation, broad style invalidation, renderer layout, or accessibility state commits.

## Main Design Principles

### 1. Public API Follows Shadcn Sidebar

The absolute public API reference is `registry/new-york-v4/ui/sidebar.tsx`.

The viewer should export flat, shadcn-style component names:

- `FileViewerProvider`
- `FileViewer`
- `FileViewerHeader`
- `FileViewerHeaderStart`
- `FileViewerHeaderEnd`
- `FileViewerIdentity`
- `FileViewerControls`
- `FileViewerBody`
- `FileViewerSidebar`
- `FileViewerSidebarContent`
- `FileViewerSidebarTrigger`
- `FileViewerSourceList`
- `FileViewerSourceItem`
- `FileViewerSourceTrigger`
- `FileViewerInset`
- `FileViewerViewport`
- `FileViewerDocument`

The viewer should not expose a dotted namespace API:

- no `FileViewer.Root`
- no `FileViewer.Header`
- no `FileViewer.Toolbar`
- no `FileViewer.Document`
- no `FileViewer.Sidebar`

The viewer should also not expose generic anatomy names like `Header`, `Body`, `Sidebar`, or `Document`, or shortened aliases like `FileHeader`. The prefix is part of the API. The correct public name is `FileViewerHeader`.

The component family should feel like shadcn sidebar adapted to file viewing: named anatomy exports, explicit provider, direct composition, `asChild` where useful, `data-slot` for stable anatomy, and minimal public state.

### 2. Declare Contracts, Do Not Discover Structure

The viewer should never depend on incidental DOM shape.

Every important element must be registered by name:

- `viewerShellElement`
- `documentViewportElement`
- `documentSurfaceElement`
- `sidebarElement`
- `viewerControlsElement`

Code should not hunt for these elements with selectors. A selector is an unstable question. A registered element is a contract.

### 3. Precompute Before Interaction

The ideal viewer follows a Pretext-style rule: expensive interpretation happens before interaction, not during interaction.

Before the user toggles the sidebar, the viewer should already know:

- The sidebar width.
- The closed and open transform values.
- The current document surface offset.
- The relevant document anchors.
- The source-to-document mapping.
- The visible page geometry.
- The next scroll target for each source item.

The click should choose a precomputed transition plan, not derive one from the live document.

### 4. Make Hot Paths Write-Only

A hot interaction may write to a tiny set of known properties. It should not read layout, walk the DOM, filter sources, compute anchors, or ask the renderer for fresh state.

For sidebar toggle, the hot path is allowed to write:

- `sidebarElement.style.transform`
- `documentSurfaceElement.style.transform`
- `sidebarElement.style.opacity` when needed

Anything else requires justification and a performance test.

### 5. Separate Intent, Visual State, And Semantic State

User intent, pixels, and accessibility semantics are different clocks.

- Intent changes immediately.
- Visual state changes on the next animation frame.
- Semantic state changes when the DOM should truthfully expose the settled interaction.

Collapsing these phases into one `open` boolean creates accidental work and ambiguous behavior.

### 6. Treat Renderers As Isolated Runtimes

A renderer is not a child component that happens to display pages. It is a runtime with its own decoding, virtualization, caching, and navigation.

The shell may host a renderer. It may not depend on renderer internals.

### 7. Prefer Data Plans Over DOM Reads

The viewer should build reusable data plans:

- `viewerGeometrySnapshot`
- `sourceAnchorIndex`
- `documentPositionIndex`
- `sidebarTransitionPlan`
- `keyboardNavigationPlan`

DOM reads are permitted only to refresh a named snapshot at scheduled boundaries. They are not permitted as scattered control flow.

### 8. Make Scheduling Explicit

Every expensive operation belongs to a named phase:

- `readGeometry`
- `computeTransitionPlan`
- `writeVisualState`
- `commitSemanticState`
- `settleLayoutState`
- `reportInteractionTiming`

If a function does more than one phase, it is probably too broad.

### 9. Enforce Stable Identity

The viewer must keep stable identities for:

- renderer runtimes
- command objects
- element registrations
- source rows
- document anchors
- geometry snapshots
- event handlers

Unstable identity causes hidden React work, stale measurements, remounts, and virtualization resets.

### 10. Prefer Narrow Mutation Over Broad React State

React state is for declarative product state. It is not the best tool for every pixel-level frame.

Fast visual motion can use narrow imperative writes when those writes are confined to a named geometry engine and covered by tests.

### 11. Make Forbidden Things Testable

Architecture principles must become checks.

If the design says "no hot DOM reads," tests should fail on hot `getBoundingClientRect()` calls outside the geometry engine. If the design says "no generic state selectors," tests should fail on `[data-state]` in viewer CSS.

## Non-Negotiable Qualities

### Simplicity

One concept has one owner.

- The shell owns layout slots.
- The controller owns viewer state.
- The geometry engine owns measurements and motion.
- The renderer owns document pixels.
- The sidebar owns source navigation.
- The accessibility coordinator owns semantic state, focus, and keyboard contracts.

No module should need to know how another module achieves its work.

### Speed

The hot path for the sidebar toggle is:

1. Read the current geometry snapshot.
2. Write compositor-safe transforms to the sidebar and document surface.
3. Schedule the semantic state commit after the visual transition.

The hot path must not:

- Re-render the file renderer.
- Recalculate the full viewer tree style.
- Reflow page virtualization.
- Update inherited CSS variables on broad ancestors.
- Trigger generic attribute selectors across the subtree.
- Run `ResizeObserver` callbacks on animated elements.
- Commit React state before the first visual frame.

### Everything Needed

The ideal viewer includes the full user-facing contract:

- Loading, empty, unsupported, password-protected, and error states.
- Keyboard access for toolbar controls, sidebar toggle, source navigation, page navigation, zoom, rotation, and search.
- Screen reader state that matches visual state after the visual transition settles.
- Mobile and desktop layouts with the same mental model.
- Deep linking to pages, selections, source anchors, and search results.
- Controlled and uncontrolled APIs only where control is genuinely useful.
- Renderer-level virtualization for large files.
- Stable hooks for analytics and performance instrumentation.
- Tests that prove the component stays fast, accessible, and modular.

### Nothing More

The ideal viewer excludes:

- Compatibility adapters.
- Duplicate primitive layers.
- Renderer-specific shell branches.
- Public hooks that expose internal implementation details.
- Generic `data-state` attributes in large subtrees.
- Layout-affecting root CSS variables on hot interactions.
- Multiple names for the same concept.
- Hidden global behavior encoded in selectors.
- Optional abstractions that only exist because of past implementation history.

### Perfect Modularization

The public component is small; the internals are strict.

The public surface should feel obvious:

```tsx
<FileViewerProvider source={file}>
  <FileViewer>
    <FileViewerHeader>
      <FileViewerSidebarTrigger />
      <FileViewerIdentity />
      <FileViewerControls />
    </FileViewerHeader>
    <FileViewerBody>
      <FileViewerInset>
        <FileViewerViewport>
          <FileViewerDocument />
        </FileViewerViewport>
      </FileViewerInset>
      <FileViewerSidebar aria-label="Sources">
        <FileViewerSidebarContent>
          <FileViewerSourceList>{sources}</FileViewerSourceList>
        </FileViewerSidebarContent>
      </FileViewerSidebar>
    </FileViewerBody>
  </FileViewer>
</FileViewerProvider>
```

The public shape is shadcn-style named anatomy, not namespace composition. The implementation should not mirror this JSX one-to-one. Public composition is for product ergonomics. Internal modules are for ownership.

### High Entropy Code

Every exported name must carry architectural information.

Bad names:

- `open`
- `state`
- `toggle`
- `panel`
- `rail`
- `viewerContext`

Ideal names:

- `isSidebarRequestedOpen`
- `isSidebarVisuallyOpen`
- `isSidebarSemanticallyOpen`
- `sidebarWidth`
- `documentSurfaceElement`
- `viewerGeometrySnapshot`
- `commitSidebarSemantics`

Longer names are acceptable when they remove ambiguity. Short names are acceptable only when the domain is already narrow.

### Perfectly Consistent Variable Names

The same concept has the same name everywhere.

- Use `sidebar`, never alternating between `sourceRail`, `panel`, `drawer`, and `rail`.
- Use `documentSurface`, never alternating between `content`, `canvas`, `pages`, and `body`.
- Use `viewerShell`, never alternating between `frame`, `root`, and `container`.
- Use `geometrySnapshot`, never alternating between `measurements`, `sizes`, and `bounds`.
- Use `semanticOpen` only for accessibility and DOM semantics.
- Use `visualOpen` only for on-screen motion state.
- Use `requestedOpen` only for user intent.

### Flaubertian Perfection

The final component should feel inevitable. The names, boundaries, DOM nodes, state phases, and CSS selectors should each be the only reasonable choice left.

If a future reader asks "why is this here?", the answer should be immediate from the boundary. If the answer requires history, the line does not belong.

## Clean-Slate Architecture

### 1. FileViewerController

The controller is a headless state machine.

It owns:

- The active file.
- The active renderer.
- The active page or position.
- The active source anchor.
- The requested sidebar state.
- The current visual transition phase.
- User-facing commands.

It does not own:

- DOM measurement.
- CSS class names.
- Renderer internals.
- Sidebar layout.
- Focus implementation details.

Its command surface should be explicit:

- `requestSidebarOpen()`
- `requestSidebarClose()`
- `toggleSidebarRequestedOpen()`
- `setActiveSourceAnchor(anchorId)`
- `setDocumentPosition(position)`
- `setZoomLevel(zoomLevel)`
- `rotateClockwise()`
- `enterSearchMode()`
- `exitSearchMode()`

### 2. ViewerGeometryEngine

The geometry engine is the only module allowed to measure and animate the viewer shell.

It owns:

- `viewerShellElement`
- `sidebarElement`
- `documentSurfaceElement`
- `viewerGeometrySnapshot`
- transition timing
- compositor writes
- settle callbacks

It exposes commands, not React state:

- `openSidebar()`
- `closeSidebar()`
- `setSidebarWidth(width)`
- `syncGeometrySnapshot()`
- `cancelActiveTransition()`

Its first-frame budget is strict: a toggle must schedule visible motion inside one animation frame, independent of document size.

### 3. ViewerShell

The shell is a slot layout with no document knowledge.

It owns:

- Overall viewer dimensions.
- Toolbar slot.
- Document slot.
- Sidebar slot.
- Overlay slot.
- Status slot.

It does not inspect file type, page count, source type, OCR state, or renderer state.

### 4. RendererRuntime

Each renderer implements the same contract:

```ts
type RendererRuntime = {
  readonly rendererKind: RendererKind;
  readonly documentSurfaceElement: HTMLElement | null;
  renderDocument(): React.ReactNode;
  scrollToPosition(position: DocumentPosition): void;
  getCurrentPosition(): DocumentPosition;
  getSelectionAnchor(): DocumentAnchor | null;
};
```

The renderer may virtualize, cache, decode, stream, and prefetch internally. The shell must not care.

The renderer must never be required to re-render for sidebar visual motion.

### 5. Sidebar

The sidebar is a domain surface, not a layout hack.

It owns:

- Source list rendering.
- Source filtering.
- Source grouping.
- Active source anchor display.
- Source-to-document navigation commands.
- Empty and loading states.

It does not own:

- Viewer width.
- Document transform.
- Renderer measurements.
- Global keyboard routing.

### 6. AccessibilityCoordinator

Accessibility is not the same state as visual animation.

The coordinator owns:

- `aria-expanded`
- `aria-controls`
- `hidden`
- `inert`
- focus restoration
- escape key behavior
- roving focus inside sidebar lists
- announcement timing

Visual state can move immediately. Semantic state should commit when doing so produces the clearest user experience.

### 7. ViewerCommandBus

The command bus is the internal boundary between UI controls and domain behavior.

Controls call commands. They do not reach into contexts, renderer refs, or geometry internals.

Examples:

- Toolbar sidebar button calls `toggleSidebarRequestedOpen()`.
- Source item click calls `setActiveSourceAnchor(anchorId)`.
- Page input calls `setDocumentPosition(position)`.
- Zoom control calls `setZoomLevel(zoomLevel)`.

## State Model

The sidebar has three separate phases:

```ts
type SidebarState = {
  isSidebarRequestedOpen: boolean;
  isSidebarVisuallyOpen: boolean;
  isSidebarSemanticallyOpen: boolean;
};
```

They must not be collapsed into `open`.

- `requestedOpen` is user intent.
- `visualOpen` is what the user currently sees.
- `semanticOpen` is what assistive technology and DOM semantics expose.

The viewer state should be narrow and declarative:

```ts
type FileViewerState = {
  file: ViewerFile;
  rendererKind: RendererKind;
  documentPosition: DocumentPosition;
  activeSourceAnchorId: string | null;
  sidebar: SidebarState;
  zoomLevel: ZoomLevel;
  rotation: DocumentRotation;
  loadState: ViewerLoadState;
  error: ViewerError | null;
};
```

No derived booleans should be stored. No visual measurements should live in React state.

## DOM Contract

The DOM must be stable, shallow, and named by responsibility.

Required elements:

- `viewerShellElement`
- `viewerControlsElement`
- `documentViewportElement`
- `documentSurfaceElement`
- `sidebarElement`
- `viewerOverlayElement`

The toggle hot path may write only to:

- `sidebarElement.style.transform`
- `sidebarElement.style.opacity` when needed
- `documentSurfaceElement.style.transform`
- a single shell-owned non-inherited layout value after motion settles, if required

No broad root style invalidation is allowed during visual motion.

### DOM Access Rules

The DOM is a registered surface, not a query surface.

Allowed:

- Registering a named element through a ref callback.
- Reading layout inside the geometry engine during a scheduled measurement phase.
- Writing compositor-safe visual state inside the geometry engine.
- Committing accessibility attributes inside the accessibility coordinator.

Forbidden:

- `querySelector` or `closest` for viewer internals.
- `getBoundingClientRect()` in click handlers.
- `offsetWidth`, `clientWidth`, `scrollWidth`, or computed style reads during visual motion.
- Walking parent or child nodes to infer viewer structure.
- Renderer code mutating shell DOM.
- Shell code mutating renderer DOM.
- Sidebar code reading document page DOM.

The only acceptable DOM reads are named reads into a `viewerGeometrySnapshot`. The only acceptable DOM writes are named writes owned by the geometry engine or accessibility coordinator.

### Element Registration Contract

Element registration must be explicit:

```ts
type ViewerElements = {
  viewerShellElement: HTMLElement;
  viewerControlsElement: HTMLElement;
  documentViewportElement: HTMLElement;
  documentSurfaceElement: HTMLElement;
  sidebarElement: HTMLElement;
  viewerOverlayElement: HTMLElement | null;
};
```

An element may be optional only when the product feature is optional. Required structure should never be hidden behind null checks that silently degrade behavior.

## CSS Contract

CSS should describe stable presentation, not orchestrate interaction state through broad selectors.

Allowed:

- Static layout classes.
- Component-scoped data attributes with specific names.
- CSS variables scoped to leaf elements.
- Containment on renderer and sidebar boundaries.
- Transform and opacity transitions on animated leaves.

Forbidden on the toggle hot path:

- Generic `[data-state]` selectors.
- Inherited CSS variables on high-level viewer roots.
- Selectors that make sidebar state affect unrelated descendants.
- CSS transitions that depend on document page layout.
- Animating width, margin, padding, or grid columns during the visual phase.

## Precomputation Contract

The viewer should precompute every value that can be known before interaction.

### Geometry Precomputation

Maintain a current `viewerGeometrySnapshot` containing:

- viewer shell bounds
- document viewport bounds
- document surface transform
- sidebar width
- open sidebar transform
- closed sidebar transform
- reduced-motion transition mode

The toggle consumes the snapshot. It does not measure the page.

### Source Precomputation

Maintain a `sourceAnchorIndex` containing:

- source id
- document anchor id
- target page
- target rectangle when available
- fallback scroll position
- label text
- match confidence when relevant

Source clicks consume the index. They do not search renderer DOM.

### Renderer Precomputation

Each renderer maintains its own `documentPositionIndex`.

For PDF, that means page dimensions, page offsets, rendered ranges, and anchor rectangles are cached by the renderer runtime. For images or text, it means the equivalent native position model.

### Transition Precomputation

The sidebar toggle should use a `sidebarTransitionPlan`:

```ts
type SidebarTransitionPlan = {
  sidebarFromTransform: string;
  sidebarToTransform: string;
  documentSurfaceFromTransform: string;
  documentSurfaceToTransform: string;
  durationMs: number;
  easing: string;
  shouldReduceMotion: boolean;
};
```

The click selects and executes this plan. It should not build it from live layout.

## Scheduling Contract

The viewer must not mix reads, computes, writes, and semantic commits in one opportunistic function.

The ideal toggle sequence is:

1. `readInteractionIntent`
2. `selectSidebarTransitionPlan`
3. `writeVisualState`
4. `markVisualState`
5. `commitSemanticState`
6. `settleLayoutState`
7. `reportInteractionTiming`

The first three steps must finish before the first visual frame. Later steps may be deferred, chunked, or scheduled after motion.

## Identity Contract

The viewer must keep identity stable across routine interaction.

Stable:

- command bus object
- renderer runtime object
- source anchor ids
- source row keys
- document page keys
- element registration callbacks
- geometry engine instance
- accessibility coordinator instance

Unstable:

- recreating command objects on every render
- recreating source arrays without content changes
- changing page keys after zoom or sidebar toggle
- remounting the renderer when sidebar state changes
- changing refs during visual motion

## Containment Contract

The viewer must limit the blast radius of style, layout, and paint work.

Required:

- CSS containment around renderer internals where compatible with the renderer.
- CSS containment around the sidebar list.
- Stable dimensions for toolbar and sidebar controls.
- Virtualization boundaries that do not depend on sidebar visual animation.
- No shell-level selector that can invalidate all rendered pages during a toggle.

## Data And Naming Contract

Every domain concept must have one canonical name and one canonical shape.

Required canonical concepts:

- `file`
- `rendererKind`
- `documentPosition`
- `documentAnchor`
- `sourceAnchor`
- `sidebar`
- `viewerGeometrySnapshot`
- `sidebarTransitionPlan`
- `viewerCommandBus`

Forbidden:

- Aliasing `sidebar` as `sourceRail`, `rail`, `panel`, or `drawer` in new code.
- Aliasing `documentSurface` as `content` in new code.
- Passing untyped bags named `state`, `data`, `meta`, or `context`.
- Booleans named `open`, `active`, `visible`, or `selected` outside a narrow local scope.

## Observability Contract

Performance must be visible without opening DevTools manually.

The viewer should emit internal marks for:

- sidebar toggle requested
- first visual write
- first animation frame after write
- visual transition settled
- semantic state committed
- layout state settled
- renderer commit during toggle, if any

A regression should identify which phase got slower.

## Performance Budget

The sidebar toggle is considered correct only if it meets these budgets on a large document:

- Click handler: under 2 ms at p95.
- First visible motion frame: within 16 ms at p95.
- No full-tree style invalidation before first paint.
- No document renderer React commit before first paint.
- No layout task over 5 ms before first paint.
- No cumulative dropped-frame burst during the first 150 ms of motion.
- Semantic settle work may run after visual motion, but must stay under 16 ms or be chunked.

These budgets are part of the component contract, not optional profiling notes.

## Required Tests

### Unit Tests

- State machine transitions for requested, visual, and semantic sidebar state.
- Command bus routing.
- Geometry snapshot updates.
- Accessibility commit timing.
- Renderer contract conformance.

### Architecture Tests

- No generic `[data-state]` selectors in viewer CSS.
- No inherited hot-path CSS variables on the viewer root.
- No `ResizeObserver` on animated sidebar or document surface elements.
- No `querySelector`, `closest`, or DOM tree walking for viewer internals.
- No hot-path `getBoundingClientRect()`, `offsetWidth`, `clientWidth`, `scrollWidth`, or computed style reads outside the geometry engine.
- No sidebar toggle code that imports renderer internals.
- No renderer remount when sidebar state changes.
- No recreated command bus object during sidebar toggle.
- No broad React context value churn during sidebar toggle.
- No renderer imports from shell internals.
- No shell imports from renderer internals.
- No public hook exposes geometry engine internals.

### Browser Performance Tests

Automated browser tests must measure the sidebar toggle on:

- A small document.
- A large virtualized PDF.
- A source-heavy document.
- Mobile viewport.
- Desktop viewport.

The test should fail when first visible motion, click handler cost, layout cost, or dropped-frame budget regresses.

### Accessibility Tests

- The sidebar toggle exposes the correct expanded state.
- Focus moves predictably when opening from keyboard.
- Focus restores predictably when closing.
- Escape closes the sidebar when focus is inside it.
- Hidden sidebar content is not reachable semantically after close settles.

## Ideal Module Map

```txt
file-viewer/
  public/
    file-viewer-root.tsx
    file-viewer-controls.tsx
    file-viewer-document.tsx
    file-viewer-sidebar.tsx
  controller/
    file-viewer-controller.ts
    file-viewer-state-machine.ts
    viewer-command-bus.ts
  geometry/
    viewer-geometry-engine.ts
    viewer-geometry-snapshot.ts
    sidebar-transition.ts
  accessibility/
    viewer-accessibility-coordinator.ts
    sidebar-focus.ts
  shell/
    viewer-shell.tsx
    viewer-shell-elements.ts
  renderers/
    renderer-runtime.ts
    pdf-renderer-runtime.tsx
    image-renderer-runtime.tsx
    text-renderer-runtime.tsx
  sources/
    sidebar-model.ts
    source-list.tsx
    source-anchor-navigation.ts
  tests/
    file-viewer-state-machine.test.ts
    viewer-geometry-engine.test.ts
    viewer-architecture.test.ts
    viewer-accessibility.test.tsx
    viewer-toggle-performance.spec.ts
```

This map is intentionally boring. Boring boundaries are fast to understand and hard to misuse.

## API Principles

The public API should be smaller than the internal architecture.

It should let product code express intent:

- render this file
- show these sources
- start at this position
- react when the active source changes
- control the sidebar when needed

It should not expose:

- geometry snapshots
- animation phases
- internal refs
- renderer cache internals
- layout implementation details
- compatibility aliases

## Ideal User Experience

The user clicks the sidebar toggle.

Immediately:

- The button reflects pressed intent.
- The sidebar starts moving.
- The document surface glides into its new visual position.
- The document remains readable.
- The toolbar remains stable.

During motion:

- The renderer does no expensive work.
- Source rows do not relayout the document.
- Page virtualization does not reset.
- Focus does not jump.

After motion:

- Semantic state catches up.
- Focus is placed or restored only when appropriate.
- The stable layout state is committed without visible shift.
- Analytics receive one coherent event.

That is the standard.

## Implementation Sequence

1. Define the clean state machine and command bus.
2. Build the geometry engine in isolation with synthetic DOM tests.
3. Build the shell as inert slots.
4. Build the accessibility coordinator against the state machine.
5. Build one renderer runtime against the renderer contract.
6. Build the sidebar against commands, not layout.
7. Add browser performance tests before adding more renderers.
8. Add remaining renderer runtimes.
9. Delete all non-ideal adapters and duplicate paths.
10. Ship only when the architecture tests and performance budgets pass.

## Final Standard

The component reaches the platonic ideal when the sidebar toggle is not merely optimized, but architecturally unable to be slow in normal operation.

The ideal is not a patched component with careful exceptions. It is a small public surface over strict internal ownership, where every phase has one name, every expensive responsibility is out of the hot path, and every module has exactly one reason to change.
