# FileViewer Sidebar Toggle Motion Diagrams

## Question

Have we reached the perfect design for `FileViewer` sidebar toggle motion with
fit-width PDF rendering?

The answer is: the current implementation now has the right runtime behavior
and the right ownership direction. The remaining perfection question is whether
the contracts should be compressed into fewer named internal modules.

The browser failure that forced the final design was precise:

- page 4 was the reading location before close;
- close preserved page 4;
- reopen computed the correct page-4 target;
- the browser clamped that target because the virtualized DOM scroll range was
  temporarily too short;
- once the PDF scaffold expanded, no second restore happened.

That means the root issue was not only virtualization, not only anchor math, and
not only component hierarchy. It was a missing contract between anchor
restoration and temporary physical scroll range.

## Current Final Model

```mermaid
flowchart TD
  User["User toggles sidebar"]
  Shell["FileViewer shell"]
  Motion["FileViewer motion kernel"]
  Preflight["before-chrome-resize event"]
  PdfRuntime["PDF document runtime"]
  Geometry["Viewer document geometry transaction"]
  Scroll["Viewer document scroll"]
  Virtualizer["PDF virtualizer"]
  Browser["Browser scroll range"]
  Paint["Paint"]

  User --> Shell
  Shell --> Motion
  Motion --> Preflight
  Preflight --> PdfRuntime
  PdfRuntime --> Geometry
  Geometry --> Scroll
  Scroll --> Browser
  Browser --> Paint
  Scroll --> Virtualizer
  Virtualizer --> Browser
```

The contract is intentionally layered:

- `FileViewer` owns chrome geometry and the animation clock.
- Renderer runtime owns reading-anchor capture.
- Geometry transaction owns which anchor should survive a layout change.
- Scroll owns physical/logical scroll restoration.
- Virtualization owns mounted boxes only.

## Iteration 1: More Overscan

```mermaid
flowchart TD
  Toggle["Toggle sidebar"]
  Resize["Fit-width PDF layout changes"]
  Overscan["Render more nearby pages"]
  FewerBlanks["Fewer blank frames"]
  Clamp["Browser can still clamp scrollTop"]
  Jump["Reading position still jumps"]

  Toggle --> Resize
  Resize --> Overscan
  Overscan --> FewerBlanks
  Resize --> Clamp
  Clamp --> Jump
```

Verdict: rejected as the primary fix.

Overscan improves visual availability, but it cannot preserve continuity. It
does not own scroll, and it cannot make an invalid physical `scrollTop` valid.

## Iteration 2: Semantic Anchor Preservation

```mermaid
sequenceDiagram
  participant Scroll as "PDF scroll"
  participant Anchor as "Semantic anchor"
  participant Layout as "PDF layout"
  participant Viewport as "Scroll viewport"

  Scroll->>Anchor: "capture pageNumber + yPercent"
  Layout->>Layout: "fit-width scale changes"
  Anchor->>Layout: "resolve target scrollTop"
  Layout->>Viewport: "scrollTo target"
```

Verdict: necessary, but incomplete.

This preserves meaning, not necessarily pixels. If the DOM scroll range is
temporarily shorter than the semantic target, the browser clamps the write.

## Iteration 3: Chrome Resize Preflight

```mermaid
sequenceDiagram
  participant Shell as "FileViewer shell"
  participant Motion as "Motion kernel"
  participant Surface as "Registered document surface"
  participant Pdf as "PDF runtime"
  participant Anchor as "Reading anchor cache"

  Shell->>Motion: "start transition"
  Motion->>Surface: "dispatch before-chrome-resize"
  Surface->>Pdf: "measure current scroll"
  Pdf->>Anchor: "cache pre-resize anchor"
  Motion->>Motion: "commit chrome resize frame"
```

Verdict: correct, but still incomplete.

This fixed the timing bug where anchor capture could happen after browser
clamp. The later browser proof showed the preflight fired with the correct
values, yet reopen still jumped. That proved the target was correct but applied
too early for the virtualized scroll range.

## Iteration 4: Chrome Settle Uses Cached Anchor

```mermaid
flowchart TD
  Settle["chrome-resize settle"]
  Cached["cached preflight reading anchor exists"]
  Live["live DOM scrollTop"]
  Target["target layout scrollTop"]

  Settle --> Cached
  Cached --> Target
  Live -. "ignored for chrome settle" .-> Target
```

Verdict: correct anchor choice.

During chrome settle, live DOM scroll is not authoritative. It may be the
browser's temporary clamp value. The cached semantic anchor is the truth.

## Iteration 5: Deferred Scroll Restore

```mermaid
flowchart TD
  Restore["Resolve semantic anchor to logical target"]
  Position["Resolve logical target to physical scrollTop"]
  RangeCheck{"physical target <= current DOM max?"}
  Apply["apply scrollTop now"]
  Pending["store pending restore"]
  Virtualizer["virtualizer rebuilds scaffold"]
  Flush{"range can now accept target?"}
  Replay["replay scrollTop"]
  Cancel["cancel on user/programmatic intent/reset"]

  Restore --> Position
  Position --> RangeCheck
  RangeCheck -- "yes" --> Apply
  RangeCheck -- "no, but target is valid in expected layout" --> Pending
  Pending --> Virtualizer
  Virtualizer --> Flush
  Flush -- "yes" --> Replay
  Flush -- "not yet" --> Pending
  Pending -. "new intent" .-> Cancel
```

Verdict: accepted.

This is the missing contract. Scroll restoration is not complete when
`scrollTo` is called. It is complete when the physical DOM range can represent
the logical target.

## Final Runtime Sequence

```mermaid
sequenceDiagram
  participant User as "User"
  participant Shell as "FileViewer shell"
  participant Motion as "Motion kernel"
  participant Pdf as "PDF runtime"
  participant Geometry as "Document geometry"
  participant Scroll as "Document scroll"
  participant Virt as "PDF virtualizer"
  participant Browser as "Browser"

  User->>Shell: "toggle sidebar"
  Shell->>Motion: "startTransition(target)"
  Motion->>Pdf: "before-chrome-resize"
  Pdf->>Scroll: "measure current scroll"
  Scroll->>Geometry: "cache reading anchor"

  Motion->>Motion: "animate chrome on one rAF clock"
  Motion->>Pdf: "rendererFrame: sliding/freeze"
  Pdf->>Virt: "retain transition page window"

  Motion->>Pdf: "rendererFrame: holding/settle"
  Geometry->>Scroll: "resolve cached anchor in target layout"
  Scroll->>Browser: "attempt physical scroll restore"

  alt "DOM range is ready"
    Browser-->>Scroll: "target accepted"
  else "DOM range is temporarily too short"
    Browser-->>Scroll: "target would clamp"
    Scroll->>Scroll: "defer restore"
    Virt->>Browser: "expand scaffold"
    Scroll->>Browser: "replay target"
  end

  Motion->>Pdf: "rendererFrame: idle/live"
```

## Final State Machine

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Preflight: "toggle"
  Preflight --> Sliding: "anchor captured"
  Sliding --> Holding: "motion elapsed"
  Holding --> RestoreNow: "target range available"
  Holding --> RestorePending: "target range temporarily short"
  RestorePending --> RestorePending: "next frame, range still short"
  RestorePending --> RestoreNow: "range expanded"
  RestorePending --> Cancelled: "user scroll, programmatic target, reset"
  RestoreNow --> Idle: "visual hold released"
  Cancelled --> Idle
```

## Ownership Graph

```mermaid
flowchart TB
  subgraph Chrome["FileViewer chrome"]
    State["sidebar requested/open state"]
    Kernel["motion kernel"]
    Elements["registered shell elements"]
  end

  subgraph Renderer["Renderer runtime"]
    Surface["document surface"]
    PreResize["pre-resize measurement"]
    Layout["document layout model"]
  end

  subgraph Continuity["Continuity contracts"]
    Anchor["semantic reading anchor"]
    Transaction["geometry transaction"]
    Restore["scroll restore"]
    Pending["pending range-aware restore"]
  end

  subgraph PDF["PDF internals"]
    Scale["fit-width scale"]
    Virtualizer["page window"]
    Raster["render scheduler"]
  end

  State --> Kernel
  Kernel --> Elements
  Kernel --> Surface
  Surface --> PreResize
  PreResize --> Anchor
  Layout --> Transaction
  Anchor --> Transaction
  Transaction --> Restore
  Restore --> Pending
  Scale --> Layout
  Virtualizer --> Pending
  Raster --> Virtualizer
```

## Perfect Design Invariants

```mermaid
flowchart TD
  A["No chrome code reads renderer layout DOM"]
  B["No renderer code controls sidebar state"]
  C["Chrome resize has one motion clock"]
  D["Chrome settle uses cached/preflight anchor"]
  E["Live DOM scroll is ignored when it can be clamp-contaminated"]
  F["Virtualization never owns continuity"]
  G["Scroll restore waits for physical range if needed"]
  H["New user/programmatic intent cancels pending restore"]

  A --> C
  B --> C
  C --> D
  D --> E
  E --> G
  F --> G
  G --> H
```

These are the non-negotiable contracts. If a future refactor violates one, the
toggle can regress even if the ordinary page-4 case still works.

## Are We At Perfection?

For the observed bug path, yes: the design now matches the problem.

For the component as a whole, the final compression target is this:

```mermaid
classDiagram
  class FileViewerMotionKernel {
    +startTransition(target)
    +publishSettledTarget(target)
    +setDocumentSurfaceElement(element)
  }

  class ViewerDocumentGeometryTransaction {
    +cacheReadingAnchor(metrics)
    +prepare(previousLayout, scrollTop)
    +commit(transaction)
  }

  class ViewerDocumentScroll {
    +syncScrollPosition()
    +scrollViewportToLogicalTop(target)
    +deferUntilPhysicalRange(target)
    +cancelPendingRestore()
  }

  class RendererRuntime {
    +handleBeforeChromeResize()
    +measureScroll()
    +writeAnchorOrigin()
  }

  class PdfVirtualizer {
    +retainTransitionWindow()
    +releaseAfterSettle()
  }

  FileViewerMotionKernel --> RendererRuntime
  RendererRuntime --> ViewerDocumentScroll
  ViewerDocumentScroll --> ViewerDocumentGeometryTransaction
  ViewerDocumentScroll --> PdfVirtualizer
```

The current implementation already has these responsibilities, but they are
spread across hooks. The only possible next perfection pass would be
compression: make the names and module boundaries line up exactly with this
class diagram.

## Final Sentence

Sidebar toggle is not a PDF resize. It is a chrome viewport transition that
preserves a semantic reading anchor, then commits the renderer resize only when
the scroll range can represent the target.
