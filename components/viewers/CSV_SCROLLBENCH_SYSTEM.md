# CSV ScrollBench System

This document maps the CSV viewer performance system end to end: the generated
benchmark data, the ScrollBench harness, the CSV viewer stack, fixed-grid
virtualization, normal React rendering, the fast row-scroll path, profiling, and
the verification surface.

## Scope

This diagram is centered on the CSV ScrollBench path:

- `app/(view)/scrollbench/*`
- `registry/new-york-v4/ui/csv-viewer.tsx`
- `registry/new-york-v4/ui/csv-viewer-grid.tsx`
- `registry/new-york-v4/ui/fixed-grid-virtualization.ts`
- `registry/new-york-v4/ui/header-aware-scrollbar.tsx`
- `tests/fixed-grid-infrastructure.test.ts`
- `tests/csv-viewer.test.tsx`

It does not describe the entire Retab application. It describes the complete
runtime and profiling system involved when ScrollBench measures the CSV table.

## Full System Diagram

```mermaid
flowchart TB
  subgraph Route["Next.js route: app/(view)/scrollbench"]
    Page["page.tsx<br/>Reads query param viewer<br/>Normalizes initial viewer"]
    Client["ScrollBenchClient<br/>Owns selected viewer, run status, result state"]
    Core["scrollbench-core.ts<br/>Viewer registry, scenarios, constants, summary math"]
    Runner["scrollbench-runner.ts<br/>waitForScroller, measureScenario, viewportMetrics"]
  end

  subgraph Data["Generated benchmark fixtures"]
    CsvFixture["createScrollBenchCsv()<br/>20,000 data rows<br/>18 metric columns<br/>CSV text source"]
    JsonFixture["createScrollBenchJsonDocument()<br/>20k JSON table rows"]
    TextFixture["createScrollBenchText()<br/>30k log lines"]
    OtherFixture["PDF/XLSX/DOCX/PPTX/Image samples<br/>Used by other viewer modes"]
  end

  subgraph CsvViewerStack["CSV viewer stack"]
    CsvViewer["CsvViewer<br/>Resource state, dialect, controls, zoom, export actions"]
    CsvState["useCsvResourceState<br/>Parses text/blob/url/table sources<br/>Exposes columns and sourceRows"]
    CsvToolbar["CsvViewerControls<br/>Zoom and download actions"]
    CsvGrid["CsvGrid<br/>Sort state, row/column virtualization, active cell, row patch path"]
  end

  subgraph GridVirtualization["Fixed grid infrastructure"]
    FixedHook["useFixedGridVirtualization<br/>Virtual rows, virtual columns, scrollToCell"]
    ViewportHook["useFixedGridViewport<br/>Reads scrollTop/scrollLeft/client size in rAF"]
    VirtualMath["fixedVirtualItems<br/>Fixed-size range math, overscan, capped windows"]
    LayoutHelpers["fixed-grid-layout/template/row-style<br/>Canvas size, row window, grid template, row transforms"]
    ViewportShell["FixedGridViewport<br/>Scrollport div with data-slot csv-body"]
  end

  subgraph CsvRender["CSV rendered DOM"]
    TableRoot["role=table<br/>aria-rowcount 20001<br/>aria-colcount 19"]
    HeaderRow["Sticky header row<br/>row number column plus virtualized column headers"]
    RowWindow["role=rowgroup<br/>relative 660,000px row window"]
    RowPool["Stable CsvRow slots<br/>Visible rows plus hidden reserve slots"]
    CellPool["Visible cell divs<br/>Row number plus virtualized CSV cells"]
    Scrollbar["HeaderAwareScrollbar<br/>Custom vertical thumb below sticky header"]
  end

  subgraph NormalReactPath["Normal React render path"]
    ScrollEvent["scroll event"]
    ScheduleRead["requestAnimationFrame(readViewport)"]
    SetViewport["setViewport(next viewport)"]
    ReactRender["React reconciles CsvGrid"]
    RowKeys["Row keys<br/>Stable fixed row-pool slot index"]
    DomCommit["React commits row/cell DOM"]
  end

  subgraph FastJumpPath["Fast row-scroll path"]
    DetectJump["Detect vertical row movement<br/>classify jump flag for overscan"]
    JumpCallback["rowScrollStrategy.handleViewport(viewport)"]
    HandleCache["Cached row handles<br/>row element, row number text node, cell text nodes"]
    ComputeJumpRows["fixedVirtualItems for active viewport<br/>overscan 0, minimum visible count 1"]
    ImperativePatch["Imperative DOM patch<br/>transform rows<br/>hidden only when changed<br/>row number text node<br/>cell text node values"]
    SkipReact["Skip immediate React viewport update"]
    SettleTimer["80ms quiet timer"]
    ReactSettle["Commit viewport to React after scrolling settles<br/>Restores canonical ARIA and React state"]
  end

  subgraph ScrollBenchRun["ScrollBench measurement"]
    RunButton["Run button or window.__scrollbench.run()"]
    WaitScroller["waitForScroller() finds [data-slot='csv-body']"]
    ScenarioSmall["Small jump scenario<br/>stepRatio 0.1"]
    ScenarioLarge["Large jump scenario<br/>stepRatio 0.9"]
    Targets["buildScrollTargets<br/>120 bounce-position targets"]
    FrameLoop["Per target:<br/>set scrollTop<br/>dispatch scroll<br/>await requestAnimationFrame<br/>record duration"]
    Summary["summarizeFrameDurations<br/>fps, avg, p50, p95, max, over16, over33"]
    ResultPanel["Result panel<br/>Small fps, large fps, viewport metrics"]
  end

  subgraph Profiling["Profiling and diagnostics"]
    Playwright["Python Playwright Chromium<br/>Loads localhost scrollbench"]
    MutationObserver["MutationObserver<br/>childList, attributes, characterData"]
    PerfMetrics["Chrome Performance.getMetrics<br/>LayoutCount, RecalcStyleCount,<br/>LayoutDuration, ScriptDuration, TaskDuration"]
    CpuProfiler["Chrome CPU profiler<br/>JS self time by function"]
    ProfileArtifacts["/tmp/retab-csv-scrollbench-profile*.json"]
  end

  subgraph Tests["Verification surface"]
    FixedTests["tests/fixed-grid-infrastructure.test.ts<br/>virtualization math, viewport, scrollbar, jump settle"]
    CsvTests["tests/csv-viewer.test.tsx<br/>CSV rendering, parsing, sorting, zoom, integration"]
    Typecheck["tsc --noEmit"]
  end

  Page --> Client
  Client --> Core
  Client --> CsvFixture
  Client --> CsvViewer
  Core --> Runner

  CsvFixture --> CsvViewer
  CsvViewer --> CsvState
  CsvViewer --> CsvToolbar
  CsvViewer --> CsvGrid
  CsvState --> CsvGrid

  CsvGrid --> FixedHook
  FixedHook --> ViewportHook
  FixedHook --> VirtualMath
  CsvGrid --> LayoutHelpers
  CsvGrid --> ViewportShell

  CsvGrid --> TableRoot
  TableRoot --> HeaderRow
  TableRoot --> RowWindow
  RowWindow --> RowPool
  RowPool --> CellPool
  CsvGrid --> Scrollbar

  ViewportShell --> ScrollEvent
  ScrollEvent --> ScheduleRead
  ScheduleRead --> DetectJump
  DetectJump -->|not handled| SetViewport
  SetViewport --> ReactRender
  ReactRender --> RowKeys
  RowKeys --> DomCommit
  DomCommit --> RowPool

  DetectJump -->|handled by CSV| JumpCallback
  JumpCallback --> HandleCache
  JumpCallback --> ComputeJumpRows
  HandleCache --> ImperativePatch
  ComputeJumpRows --> ImperativePatch
  ImperativePatch --> RowPool
  ImperativePatch --> CellPool
  ImperativePatch --> SkipReact
  SkipReact --> SettleTimer
  SettleTimer --> ReactSettle
  ReactSettle --> ReactRender

  RunButton --> WaitScroller
  WaitScroller --> ScenarioSmall
  WaitScroller --> ScenarioLarge
  ScenarioSmall --> Targets
  ScenarioLarge --> Targets
  Targets --> FrameLoop
  FrameLoop --> ScrollEvent
  FrameLoop --> Summary
  Summary --> ResultPanel

  Playwright --> RunButton
  Playwright --> MutationObserver
  Playwright --> PerfMetrics
  Playwright --> CpuProfiler
  MutationObserver --> ProfileArtifacts
  PerfMetrics --> ProfileArtifacts
  CpuProfiler --> ProfileArtifacts

  FixedTests --> FixedHook
  FixedTests --> Scrollbar
  FixedTests --> FastJumpPath
  CsvTests --> CsvViewer
  Typecheck --> CsvViewerStack
  Typecheck --> GridVirtualization
```

## ScrollBench Runtime Sequence

```mermaid
sequenceDiagram
  autonumber
  participant User as User or profiler
  participant Client as ScrollBenchClient
  participant Runner as scrollbench-runner
  participant Scroller as csv-body scrollport
  participant Hook as useFixedGridViewport
  participant CsvGrid as CsvGrid
  participant Rows as pooled CSV rows
  participant React as React state/render

  User->>Client: Click Run or call window.__scrollbench.run()
  Client->>Runner: waitForScroller(getScroller)
  Runner->>Scroller: Verify scrollHeight > clientHeight
  Runner->>Runner: Build small and large scenarios

  loop For each scenario
    Runner->>Scroller: scrollTop = 0
    Runner->>Runner: Wait two animation frames
    loop 120 target positions
      Runner->>Scroller: Set scrollTop to target
      Runner->>Scroller: Dispatch scroll event
      Scroller->>Hook: passive scroll listener schedules rAF
      Hook->>Hook: read scrollTop, scrollLeft, client size
      Hook->>Hook: classify row jump by rowDelta
      alt Unsupported row scroll
        Hook->>React: setViewport(next)
        React->>CsvGrid: Recompute virtual rows and columns
        CsvGrid->>Rows: React reconciles row/cell DOM
      else Supported vertical CSV scroll
        Hook->>CsvGrid: rowScrollStrategy.handleViewport(next)
        CsvGrid->>CsvGrid: Compute visible scroll rows
        CsvGrid->>Rows: Reuse cached row handles
        CsvGrid->>Rows: Patch transform and text nodes imperatively
        CsvGrid-->>Hook: handled = true
        Hook->>Hook: Do not call setViewport immediately
        Hook->>Hook: Reset 80ms settle timer
      end
      Runner->>Runner: Wait requestAnimationFrame
      Runner->>Runner: Record frame duration
    end
  end

  Hook->>React: Settle timer commits final viewport
  React->>CsvGrid: Canonical render after row scroll settles
  CsvGrid->>Rows: Restore React-owned attributes and final DOM
  Runner->>Client: Return fps and frame metrics
  Client->>User: Render result panel
```

## State Ownership

```mermaid
flowchart LR
  subgraph ReactState["React-owned canonical state"]
    ViewerState["ScrollBenchClient state<br/>viewer, status, result"]
    CsvResource["CSV resource state<br/>columns, sourceRows, loading/error"]
    SortState["CsvGrid sort state<br/>columnIndex, descending"]
    ViewportState["Fixed grid viewport state<br/>scrollTop, scrollLeft, client size,<br/>jump flags"]
    VirtualState["Derived virtual rows/columns<br/>not stored outside render"]
  end

  subgraph Refs["Mutable refs"]
    ViewportRef["viewportRef<br/>actual csv-body element"]
    RowWindowRef["rowWindowRef<br/>rowgroup element"]
    PatchState["CsvRowPatchState<br/>current rows, rowOrder, columns,<br/>row height, activeCell"]
    HandleCacheRef["CsvRowPatcher rowHandleCacheRef<br/>cached row handles and text nodes"]
    ScrollbarRef["HeaderAwareScrollbar refs<br/>thumb element and metrics"]
  end

  subgraph DOMState["DOM-owned transient state during active row scroll"]
    RowTransform["row.style.transform"]
    RowHidden["row.hidden"]
    RowNumberText["row number Text.nodeValue"]
    CellText["cell span Text.nodeValue"]
    ThumbTransform["scrollbar thumb transform"]
  end

  ViewerState --> CsvResource
  CsvResource --> SortState
  SortState --> PatchState
  CsvResource --> PatchState
  ViewportState --> VirtualState
  VirtualState --> RowWindowRef
  ViewportRef --> ViewportState
  RowWindowRef --> HandleCacheRef
  PatchState --> RowTransform
  PatchState --> RowHidden
  PatchState --> RowNumberText
  PatchState --> CellText
  HandleCacheRef --> RowTransform
  HandleCacheRef --> RowNumberText
  HandleCacheRef --> CellText
  ScrollbarRef --> ThumbTransform
  DOMState -->|scroll settles| ReactState
```

## React Path Versus Row Patch Path

```mermaid
flowchart TB
  Scroll["Scroll frame"] --> Classify["Classify movement"]

  Classify -->|horizontal scroll| Normal
  Classify -->|active cell highlight present| Normal
  Classify -->|small table, no row virtualization| Normal
  Classify -->|row pool unavailable| Normal
  Classify -->|visible row count exceeds pool| Normal

  Normal --> ReactViewport["setViewport"]
  ReactViewport --> ReactRender["Render CsvGrid"]
  ReactRender --> ReactRows["Create/reconcile CsvRow elements"]
  ReactRows --> ReactCells["Create/reconcile cell elements and attributes"]

  Classify -->|supported vertical scroll| Fast["Row patch path"]
  Fast --> Cache["Read or reuse cached row handles"]
  Cache --> Math["Compute target row range with fixedVirtualItems"]
  Math --> Guards["Validate enough pooled rows and cells"]
  Guards --> PatchRows["Patch only required DOM"]
  PatchRows --> Transform["Update row transform if changed"]
  PatchRows --> Hidden["Update hidden only when changed"]
  PatchRows --> RowGuard["Skip cell loop if pooled row still maps to same source row"]
  RowGuard --> TextNodes["Update row number and cell text node values"]
  TextNodes --> Settle["Schedule React settle after quiet period"]
  Settle --> ReactViewport
```

## Rendered DOM Shape

```mermaid
flowchart TB
  Table["div role=table<br/>data-slot csv-grid<br/>aria-label CSV data"]
  Scope["CsvStyleScope<br/>plain div or ShadowRoot when isolateStyles=true"]
  Viewport["FixedGridViewport<br/>data-slot csv-body<br/>overflow auto"]
  Canvas["Canvas div<br/>relative width = rowNumberWidth + totalColumnSize<br/>contain layout paint style"]
  Header["Sticky header row<br/>role=row<br/>aria-rowindex=1"]
  HeaderNumber["Sticky row-number column header"]
  HeaderSpacerL["Left pad spacer for virtual columns"]
  HeaderCells["Virtual column headers<br/>sortable buttons"]
  HeaderSpacerR["Right pad spacer"]
  Rowgroup["rowgroup<br/>relative height = rowCount * rowHeight"]
  Row["CsvRow<br/>role=row<br/>absolute transform translate3d"]
  RowNumber["rowheader<br/>sticky left<br/>row number text"]
  CellSpacerL["Left pad spacer"]
  Cells["CSV cell divs<br/>role=cell<br/>span text node"]
  CellSpacerR["Right pad spacer"]
  CustomScrollbar["HeaderAwareScrollbar<br/>absolute track below header<br/>thumb transform translateY"]

  Table --> Scope
  Scope --> Viewport
  Viewport --> Canvas
  Canvas --> Header
  Header --> HeaderNumber
  Header --> HeaderSpacerL
  Header --> HeaderCells
  Header --> HeaderSpacerR
  Canvas --> Rowgroup
  Rowgroup --> Row
  Row --> RowNumber
  Row --> CellSpacerL
  Row --> Cells
  Row --> CellSpacerR
  Scope --> CustomScrollbar
```

## Profiling Stack

```mermaid
flowchart TB
  Script["Python Playwright profiling script"]
  Browser["Headless Chromium<br/>1440x900 dpr=1"]
  Page["http://localhost:3100/scrollbench?viewer=csv"]
  BenchApi["window.__scrollbench.run()<br/>window.__scrollbench.runScenario(id)"]
  Observer["MutationObserver<br/>childList, attributes, characterData"]
  Metrics["CDP Performance.getMetrics"]
  Cpu["CDP Profiler"]
  Json["Profile JSON in /tmp"]

  Script --> Browser
  Browser --> Page
  Page --> BenchApi
  Page --> Observer
  Browser --> Metrics
  Browser --> Cpu
  BenchApi --> Json
  Observer --> Json
  Metrics --> Json
  Cpu --> Json

  Json --> Baseline["Baseline<br/>large jump ~48.9fps<br/>~61k added elements<br/>~2.44s task time"]
  Json --> RowPool["Row-pool profile<br/>large jump ~60fps<br/>0 added elements<br/>~997ms task time"]
  Json --> FastJump["Fast-jump profile<br/>large jump ~60fps<br/>0 added elements<br/>~529ms task time<br/>~48ms script time"]
```

## Performance Evolution

```mermaid
flowchart LR
  Baseline["Baseline<br/>React reconciles jump frames<br/>large jump ~48.9fps<br/>~61,534 added elements<br/>~622ms script<br/>~2,442ms task"]
  Pooling["Jump row pooling<br/>reuse row keys while jumping<br/>large jump ~60fps<br/>~207 added elements<br/>~558ms script<br/>~997ms task"]
  FastImperative["Fast imperative jump path<br/>skip immediate setViewport<br/>patch row pool directly<br/>large jump ~60fps<br/>0 added elements<br/>~87ms script<br/>~625ms task"]
  CachedHandles["Cached handles and text nodes<br/>no per-frame row/cell queries<br/>no aria writes during jump<br/>large jump ~60fps<br/>0 added elements<br/>~48ms script<br/>~529ms task"]

  Baseline --> Pooling
  Pooling --> FastImperative
  FastImperative --> CachedHandles
```

## Important Invariants

```mermaid
flowchart TB
  Start["CSV grid scroll frame"] --> Invariants

  subgraph Invariants["Required invariants"]
    FixedRows["Rows have fixed height"]
    FixedColumns["Columns have fixed width"]
    StableSource["sourceRows array is stable for current resource"]
    StableColumns["columnItems describe current horizontal window"]
    NoActiveCell["No activeCell while using fast jump path"]
    NoHorizontalJump["No horizontal scroll during fast jump path"]
    EnoughPool["Existing row pool has enough rows and cells"]
    TextNodeShape["Cells contain direct span text nodes"]
    Settle["React receives final viewport after quiet period"]
  end

  FixedRows --> FastSafe["Fast path is safe"]
  FixedColumns --> FastSafe
  StableSource --> FastSafe
  StableColumns --> FastSafe
  NoActiveCell --> FastSafe
  NoHorizontalJump --> FastSafe
  EnoughPool --> FastSafe
  TextNodeShape --> FastSafe
  Settle --> Canonical["Canonical React DOM restored after scroll settles"]

  FastSafe --> Imperative["Imperative patch can run for current frame"]
  Imperative --> Canonical
```

## Why Shadow DOM Is Not The Primary Performance Lever

```mermaid
flowchart TB
  Cost["Measured large-jump costs"] --> Before["Before optimization<br/>DOM add/remove and style recalculation"]
  Cost --> After["After optimization<br/>script and character-data updates dominate"]

  Shadow["Shadow DOM style isolation"] --> Helps["Helps isolate component styles<br/>and avoid broad global selector effects"]
  Shadow --> NotHelp["Does not remove row math<br/>does not remove text updates<br/>does not remove scroll event work<br/>does not remove layout for transformed rows"]

  Before --> RowPooling["Row pooling directly removes add/remove churn"]
  After --> FastPath["Fast path directly reduces React/script churn"]
  Helps --> Embedding["Useful for embeddable viewer isolation"]
  NotHelp --> Decision["Not the next performance-first investment"]

  RowPooling --> Decision
  FastPath --> Decision
```

## Failure And Fallback Paths

```mermaid
flowchart TB
  Jump["Large vertical jump detected"] --> CanHandle{"Can CSV fast path handle it?"}

  CanHandle -->|no row window| ReactPath["Fallback to React setViewport"]
  CanHandle -->|no cached rows| BuildCache["Build row-handle cache"]
  BuildCache --> CacheOk{"Cache valid?"}
  CacheOk -->|no| ReactPath
  CacheOk -->|yes| MoreChecks

  MoreChecks{"All conditions true?"}
  MoreChecks -->|activeCell present| ReactPath
  MoreChecks -->|horizontal scroll or column jump| ReactPath
  MoreChecks -->|not virtualized rows| ReactPath
  MoreChecks -->|not enough pooled rows| ReactPath
  MoreChecks -->|not enough pooled cells| ReactPath
  MoreChecks -->|yes| FastPatch["Patch pooled rows imperatively"]

  FastPatch --> Settles["Schedule settle timer"]
  Settles --> ReactPath
```

## Test Coverage Map

```mermaid
flowchart TB
  FixedInfra["tests/fixed-grid-infrastructure.test.ts"]
  CsvViewerTests["tests/csv-viewer.test.tsx"]
  TypeScript["tsc --noEmit"]

  FixedInfra --> PublicEntrypoints["Public re-export wiring"]
  FixedInfra --> VirtualMath["fixedVirtualItems and fixedScrollOffset"]
  FixedInfra --> ViewportSwitch["Scroll element replacement and cleanup"]
  FixedInfra --> JumpOverscan["Jump overscan behavior"]
  FixedInfra --> FastSettle["Handled jump-row viewport skips immediate React update and settles later"]
  FixedInfra --> ScrollbarTests["Header-aware scrollbar geometry and transform offset"]
  FixedInfra --> ScrollBenchRunner["Scroller discovery, waitForScroller, measureScenario"]

  CsvViewerTests --> ParseRender["CSV parse/render states"]
  CsvViewerTests --> Sort["Sorting and row order"]
  CsvViewerTests --> Zoom["Zoom controls and row size scaling"]
  CsvViewerTests --> Export["Download/export behavior"]
  CsvViewerTests --> EdgeCases["Empty/error/worker/resource edge cases"]

  TypeScript --> ApiShape["Fixed-grid hook API and CSV fast-path types"]
```

## Operational Notes

- The ScrollBench route is a development and profiling surface, not a public
  product page.
- The CSV fixture is generated in memory and passed as a text source.
- The benchmark drives the actual scrollport by setting `scrollTop`; it does not
  synthesize wheel events.
- Each scenario records 120 frame durations.
- The CSV large-jump path now has two layers:
  - React row pooling through jump row keys.
  - An imperative fast path that skips immediate React viewport commits.
- The fast path is intentionally conservative. It declines to handle cases that
  involve active-cell highlighting, horizontal movement, missing row pool state,
  or unexpected DOM shape.
- React remains the canonical owner. The imperative path is a transient
  frame-level optimization; the settle timer returns control to React after
  jump scrolling quiets.
- The custom scrollbar thumb uses `transform` for vertical motion to avoid
  layout-position writes on every scroll frame.

## Current Performance Snapshot

The latest headless Chromium profile at 1440x900 showed this large-jump shape:

| Metric                 | Current fast path |
| ---------------------- | ----------------: |
| FPS                    |            ~59.93 |
| Added elements         |                 0 |
| Removed elements       |                 0 |
| Child-list mutations   |                 0 |
| Attribute changes      |            ~3,459 |
| Character-data changes |           ~39,936 |
| Script duration        |           ~47.6ms |
| Layout duration        |          ~217.9ms |
| Recalc style duration  |           ~27.7ms |
| Task duration          |          ~528.6ms |
| Max frame              |           ~18.8ms |

The latest profile artifact was written to:

```text
/tmp/retab-csv-scrollbench-profile-fast-jump-cached.json
```
