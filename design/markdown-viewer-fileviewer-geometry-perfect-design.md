# Markdown Viewer FileViewer Geometry Perfect Design

## Verdict

The Markdown engine is strong, but the FileViewer integration is not yet the
platonic design.

The engine already has the right internal ideas:

- async document parsing
- precomputed chunk geometry
- measured-height correction
- inverse-sticky virtualization
- bounded rich block rendering
- native-find indexing

The flaw is at the shell boundary. Markdown still derives layout width from its
own live `ResizeObserver` during parent geometry changes. That makes Markdown a
private layout island inside a FileViewer shell that now has a shared chrome
motion contract.

The perfect design is not a new Markdown renderer. It is a sharper geometry
contract:

> FileViewer owns chrome geometry. Markdown owns document geometry. During
> chrome motion, Markdown freezes logical layout and lets FileViewer visually
> transform the registered document surface.

## Current Runtime

```mermaid
flowchart TD
  Route["FileViewerRoute markdown"]
  Adapter["MarkdownResourceContent"]
  Frame["PlainTextViewerFrame"]
  Content["MarkdownGreenfieldContent"]
  Viewport["ScrollArea viewport"]
  Observer["ResizeObserver"]
  ViewportSize["viewportSize width and height"]
  ContentWidth["contentWidth"]
  Layout["layoutMarkdownGreenfieldDocument"]
  MeasurementKeys["measured-height keys"]
  ChunkObserver["ChunkFrame ResizeObserver"]
  Projection["visible chunk projection"]
  Paint["paint"]

  Route --> Adapter
  Adapter --> Frame
  Frame --> Content
  Content --> Viewport
  Viewport --> Observer
  Observer --> ViewportSize
  ViewportSize --> ContentWidth
  ContentWidth --> Layout
  Layout --> MeasurementKeys
  MeasurementKeys --> ChunkObserver
  ChunkObserver --> Layout
  Layout --> Projection
  Projection --> Paint
```

This is locally coherent. The problem appears when the parent shell changes
width.

```mermaid
sequenceDiagram
  participant User as "User"
  participant Shell as "FileViewer shell"
  participant Browser as "Browser layout"
  participant Markdown as "Markdown viewer"
  participant Layout as "Markdown layout"
  participant Measure as "Chunk measurement"
  participant Scroll as "Scroll anchor"

  User->>Shell: "toggle sidebar"
  Shell->>Browser: "surface width animates"
  Browser->>Markdown: "viewport clientWidth changes"
  Markdown->>Layout: "new contentWidth"
  Layout->>Measure: "new measurement keys"
  Measure->>Layout: "visible chunks remeasure"
  Layout->>Scroll: "restore anchor"
  Scroll->>Browser: "write scrollTop"
  Browser->>Markdown: "next animated width"
```

The renderer is doing high-quality work at the wrong time. A sidebar animation
should not invalidate Markdown's logical document model every frame.

## Root Smell

There are two geometry owners.

```mermaid
flowchart LR
  subgraph Shell["FileViewer shell"]
    Motion["motion kernel"]
    RendererFrame["renderer frame contract"]
    SurfaceTransform["document surface transform"]
  end

  subgraph Markdown["Markdown viewer"]
    LocalRO["local ResizeObserver"]
    LocalWidth["local viewport width"]
    LocalLayout["local layout width"]
  end

  Motion --> RendererFrame
  RendererFrame -. "not consumed today" .-> Markdown
  LocalRO --> LocalWidth --> LocalLayout
  LocalLayout --> SurfaceTransform

  classDef smell fill:#3b0d0d,stroke:#ff6b6b,color:#fff
  class LocalRO,LocalWidth,LocalLayout smell
```

This is the same class of bug that made PDF, DOCX, image, text, and PPTX feel
unstable before they moved to the shared renderer-frame contract.

## Iteration 1: Add Overscan

```mermaid
flowchart TD
  Toggle["toggle sidebar"]
  WidthChanges["viewport width changes"]
  Overscan["increase Markdown overscan"]
  MoreChunks["more chunks mounted"]
  Relayout["layout still recomputes every width step"]
  Remeasure["measurement keys still change"]
  Jitter["scroll and visual jitter remain"]

  Toggle --> WidthChanges
  WidthChanges --> Overscan
  Overscan --> MoreChunks
  WidthChanges --> Relayout
  Relayout --> Remeasure
  Remeasure --> Jitter
```

Verdict: rejected.

Overscan can reduce blanking. It cannot fix geometry ownership. The issue is
not an undersized virtual window; it is a live layout clock competing with
FileViewer's motion clock.

## Iteration 2: Throttle ResizeObserver

```mermaid
flowchart TD
  Browser["browser width changes"]
  Observer["ResizeObserver"]
  Raf["requestAnimationFrame throttle"]
  React["React state commit"]
  Layout["Markdown layout"]
  Paint["paint"]

  Browser --> Observer --> Raf --> React --> Layout --> Paint
```

Verdict: rejected.

RAF throttling makes the wrong clock less noisy. It does not make it the right
clock. FileViewer already has the geometry clock; Markdown should consume it
instead of sampling the DOM during chrome motion.

## Iteration 3: Freeze Width Internally

```mermaid
flowchart TD
  ShellGeometry{"inside FileViewer shell geometry?"}
  LiveMeasure["read viewport.clientWidth"]
  FrozenWidth["keep previous measured width"]
  Layout["Markdown logical layout"]

  ShellGeometry -- "no" --> LiveMeasure --> Layout
  ShellGeometry -- "yes" --> FrozenWidth --> Layout
```

Verdict: necessary, but incomplete.

This prevents animated width steps from invalidating Markdown layout. But it
does not give FileViewer a registered document surface to visually compensate.
Without a registered surface, FileViewer cannot apply its transform policy to
Markdown the way it does for PDF, DOCX, PPTX, and image.

## Iteration 4: Register The Scroll Viewport

```mermaid
flowchart TD
  Surface["registered document surface"]
  ScrollViewport["ScrollArea viewport"]
  NativeScroll["native scroll"]
  Transform["FileViewer scale transform"]
  Problem["scrollbars, hit testing, and scroll range become part of visual transform"]

  Surface --> ScrollViewport
  ScrollViewport --> NativeScroll
  Surface --> Transform
  Transform --> Problem
```

Verdict: rejected.

The scroll viewport is not the document. It is the native scroll owner. Scaling
or visually holding it risks making scrollbars, scroll range, and pointer
geometry part of the motion effect.

## Iteration 5: Register The Virtual Canvas

```mermaid
flowchart TD
  ScrollViewport["ScrollArea viewport"]
  Canvas["markdown-virtual-canvas"]
  StickyWindow["markdown-sticky-window"]
  Chunks["mounted Markdown chunks"]
  MotionKernel["FileViewer motion kernel"]
  Transform["parent transform"]

  ScrollViewport --> Canvas
  Canvas --> StickyWindow
  StickyWindow --> Chunks
  MotionKernel --> Canvas
  Canvas --> Transform
```

Verdict: closer.

The virtual canvas is the right kind of surface because it is the visual
document body. Native scroll remains owned by the viewport. FileViewer can
transform the document surface without transforming the scroll owner.

The remaining question is scroll continuity. Markdown must capture its anchor
before chrome resize and settle once at the final width.

## Final Design

```mermaid
flowchart TD
  subgraph FileViewer["FileViewer shell"]
    ShellState["sidebar open state"]
    MotionKernel["motion kernel"]
    RendererFrame["renderer frame"]
    BeforeResize["before-chrome-resize event"]
  end

  subgraph MarkdownController["Markdown document controller"]
    LocalSize["local viewport size fallback"]
    ResolvedFrame["resolved renderer frame"]
    LayoutWidth["logical layout width"]
    Anchor["scroll anchor"]
    Layout["Markdown layout"]
    Measurements["measured heights"]
    Projection["visible projection"]
  end

  subgraph MarkdownDOM["Markdown DOM"]
    Viewport["scroll viewport"]
    Surface["registered virtual canvas"]
    Sticky["sticky render window"]
    Chunks["mounted chunks"]
  end

  ShellState --> MotionKernel
  MotionKernel --> RendererFrame
  MotionKernel --> BeforeResize
  BeforeResize --> Anchor

  LocalSize --> ResolvedFrame
  RendererFrame --> ResolvedFrame
  ResolvedFrame --> LayoutWidth
  LayoutWidth --> Layout
  Measurements --> Layout
  Layout --> Projection

  Viewport --> Surface
  Surface --> Sticky
  Sticky --> Chunks
  Projection --> Chunks
  MotionKernel --> Surface
```

The final renderer has one geometry entry point:

```mermaid
flowchart LR
  LocalFallback["local measured width fallback"]
  RendererFrame["FileViewerRendererFrame"]
  Policy{"transition layout policy"}
  Frozen["transaction from width"]
  Live["live or settled width"]
  ContentWidth["Markdown content width"]

  LocalFallback --> RendererFrame
  RendererFrame --> Policy
  Policy -- "freeze" --> Frozen --> ContentWidth
  Policy -- "live or settle" --> Live --> ContentWidth
```

## Final Transition Sequence

```mermaid
sequenceDiagram
  participant User as "User"
  participant Shell as "FileViewer shell"
  participant Motion as "Motion kernel"
  participant Surface as "Markdown virtual canvas"
  participant Markdown as "Markdown controller"
  participant Layout as "Markdown layout"
  participant Browser as "Browser"

  User->>Shell: "toggle sidebar"
  Shell->>Motion: "start transition"
  Motion->>Surface: "before-chrome-resize"
  Surface->>Markdown: "capture live scroll anchor"
  Motion->>Markdown: "rendererFrame sliding freeze"
  Markdown->>Layout: "keep transaction-from layout width"
  Motion->>Surface: "apply visual scale"
  Browser->>Browser: "paint one visual clock"
  Motion->>Markdown: "rendererFrame holding settle"
  Markdown->>Layout: "commit final layout width once"
  Markdown->>Browser: "restore anchor once"
  Motion->>Markdown: "rendererFrame idle live"
```

During `sliding`, Markdown does not recompute layout width from DOM reads.
During `holding`, Markdown commits the final width and performs one anchored
scroll restore. During `idle`, local measurement can resume for standalone and
settled quality.

## Final State Machine

```mermaid
stateDiagram-v2
  [*] --> StandaloneLive
  StandaloneLive --> ShellLive: "mounted inside FileViewer shell"
  ShellLive --> Preflight: "chrome resize requested"
  Preflight --> SlidingFrozen: "anchor captured"
  SlidingFrozen --> HoldingSettle: "motion elapsed"
  HoldingSettle --> AnchorRestore: "final layout committed"
  AnchorRestore --> ShellLive: "restore accepted"
  ShellLive --> StandaloneLive: "unmounted from shell"

  SlidingFrozen --> SlidingFrozen: "visual frames; logical width frozen"
  StandaloneLive --> StandaloneLive: "local ResizeObserver drives layout"
  ShellLive --> ShellLive: "settled renderer frame drives layout"
```

## Module Shape

```mermaid
flowchart TB
  Public["markdown-viewer.tsx"]
  ResourceFrame["plain-text-viewer-frame.tsx"]
  Controller["markdown-greenfield-content.tsx"]
  RendererFrameHook["useMarkdownGreenfieldRendererFrame"]
  Surface["MarkdownGreenfieldDocumentSurface"]
  Virtualizer["markdown-greenfield-virtualizer.ts"]
  Layout["markdown-greenfield-layout.ts"]
  Renderer["markdown-greenfield-renderer.tsx"]
  Store["markdown-greenfield-document-store.ts"]

  Public --> ResourceFrame
  ResourceFrame --> Controller
  Controller --> RendererFrameHook
  Controller --> Surface
  Controller --> Store
  Controller --> Layout
  Controller --> Virtualizer
  Surface --> Renderer
```

This is intentionally modest. Do not create a new public API. Do not fork the
Markdown renderer. The ideal pass should only sharpen ownership:

- `markdown-viewer.tsx` stays public.
- `plain-text-viewer-frame.tsx` stays the resource/error/suspense adapter.
- `markdown-greenfield-content.tsx` becomes a controller plus a small rendered
  surface.
- `useMarkdownGreenfieldRendererFrame` owns FileViewer geometry bridging.
- pure layout and virtualizer modules remain pure.

## Contract Checklist

The final implementation must satisfy these invariants:

- Markdown never reads DOM width as the authoritative layout width during
  FileViewer chrome motion.
- Markdown consumes `FileViewerRendererFrame` when inside `FileViewer`.
- Markdown keeps local `ResizeObserver` only as standalone fallback and settled
  measurement.
- The registered document surface is the virtual canvas, not the scroll
  viewport.
- The scroll viewport remains the native scroll owner.
- `before-chrome-resize` captures the live Markdown scroll anchor before the
  shell mutates layout.
- `sliding` freezes logical layout width.
- `holding` commits the final layout width once.
- measurement keys do not churn every animation frame.
- visible chunk projection does not remount because of chrome animation frames.
- tests prove canvas width, scrollTop, mounted chunk window, and measurement key
  width stay stable during sidebar motion.

## Perfect Runtime

```mermaid
flowchart LR
  Toggle["toggle"]
  Preflight["capture anchor"]
  Freeze["freeze logical width"]
  Visual["visual parent transform"]
  Settle["commit final width once"]
  Restore["restore anchor once"]
  Idle["resume live settled geometry"]

  Toggle --> Preflight --> Freeze --> Visual --> Settle --> Restore --> Idle
```

That is the platonic shape: one motion clock, one layout owner at a time, one
scroll restore, no redundant concepts.
