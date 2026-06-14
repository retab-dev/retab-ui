# Partition Viewer Segmented Model Blueprint

## Judgment

The partition viewer is structurally healthier than the email viewer because it
already reduces domain output to a shared, high-entropy UI model: `Segment[]`.
That is the right center of gravity.

The remaining problem is not the primitive viewer composition. The remaining
problem is that `PartitionViewerProvider` currently does too much derived model
work inline. It owns interactive document state, but it also normalizes pages,
builds colors, merges legend chunks, builds ribbon rows, calculates page count,
and adapts consensus votes.

The platonic direction is:

```tsx
PartitionResult
  -> createPartitionViewerModel(result)
  -> PartitionViewerProvider
  -> PartitionViewerHeader + document surface
```

The provider should own live UI state. The model should own deterministic
derivation.

This blueprint intentionally excludes file-system and file-viewer concerns.

## Existing Shape

Current partition primitives:

- `PartitionResult`: Retab API shape.
- `PartitionChunk`: `{ key, pages }`.
- `Segment`: shared UI shape for split, partition, legend, sidebar, and ribbon.
- `SegmentLegend`: keyed color legend surface.
- `PageRibbon`: page-axis ribbon / waterfall surface.
- `PartitionViewerProvider`: context owner and inline model factory.
- `PartitionViewerHeader`: renders `SegmentLegend` and `PageRibbon`.
- `usePartitionViewerDocument`: bridge from document renderer back to partition
  state.

The good part is the shared `Segment[]` abstraction:

```ts
type Segment = {
  id: string
  label: string
  pages: number[]
  color: string
  index: number
  confidence?: number | null
}
```

This is the correct semantic compression. Split and partition should converge
around this model.

## Current Issues

### 1. Provider Does Model Work

`PartitionViewerProvider` currently derives:

- `hasOutput`
- `voteChoices`
- `pageCount`
- color map
- legend segments
- consensus/vote ribbon rows
- normalized pages

Those are pure transformations of `PartitionResult`. They are not provider
state.

The provider should not be the place where we discover what the result means.
It should be the place where live interaction state is held.

### 2. Partition Has A Private Segment Derivation Path

The shared `segments.ts` module already has `toSegments`, `buildColorMap`,
`segmentsPageCount`, and page helpers. Partition still hand-rolls a nearby but
different conversion in the provider.

That makes partition and split look more different than they are.

### 3. Legend Rows And Ribbon Rows Are Not Named As A Model

`legendSegments` and `rows` are good concepts, but they are just provider-local
memo output. They deserve a named model type.

The missing type is:

```ts
type PartitionViewerModel = {
  hasOutput: boolean
  pageCount: number
  legendSegments: Segment[]
  ribbonRows: RibbonRow[]
}
```

Once this exists, the rest of the component becomes easier to reason about.

### 4. Split And Partition Use Different Controller Shapes

Split uses `useSegmentViewportController`; partition owns lighter local
document state:

```ts
currentPage
scrollProgress
scrollRequest
requestPageScroll
```

The difference may be justified today, but conceptually they are the same
family: page-segmented document viewers. The final system should make that
family visible.

### 5. Consensus Modeling Is Under-expressed

Partition has output chunks and vote choices. Both become ribbon rows, but the
model does not name what each row means.

Current rows are effectively:

- output rows
- vote rows

The ideal model should encode that explicitly:

```ts
type PartitionRibbonRowKind = "output" | "vote"

type PartitionRibbonRow = RibbonRow & {
  kind: PartitionRibbonRowKind
  voteIndex?: number
}
```

The UI may still consume plain `RibbonRow[]`, but the domain model should know
what it produced.

## Target Data Structures

### API Shape

Keep the Retab API mirror small and direct:

```ts
type PartitionChunk = {
  key: string
  pages: number[]
}

type PartitionResult = {
  output: PartitionChunk[]
  consensus: {
    choices: PartitionChunk[][]
    likelihoods: PartitionChunkLikelihood[] | null
  }
  usage: PartitionUsage | null
}
```

Do not add UI fields to this shape.

### Shared Segment Shape

Keep `Segment` as the common UI model:

```ts
type Segment = {
  id: string
  label: string
  pages: number[]
  color: string
  index: number
  confidence?: number | null
}
```

This is the lingua franca for:

- `SegmentLegend`
- `SegmentSidebar`
- `PageRibbon`
- split viewer
- partition viewer
- future classification/segmented document surfaces

### Partition Viewer Model

Create a pure derived model:

```ts
type PartitionViewerModel = {
  hasOutput: boolean
  pageCount: number
  legendSegments: Segment[]
  ribbonRows: RibbonRow[]
}
```

If consensus rows need stronger semantics:

```ts
type PartitionViewerModel = {
  hasOutput: boolean
  pageCount: number
  legendSegments: Segment[]
  ribbonRows: PartitionRibbonRow[]
}

type PartitionRibbonRow = RibbonRow & {
  kind: "output" | "vote"
  voteIndex?: number
}
```

The UI can downcast `PartitionRibbonRow[]` to `RibbonRow[]` where needed.

### Partition Viewer State

Keep live document state separate:

```ts
type PartitionViewerState = {
  currentPage: number
  scrollProgress: number
  scrollRequest: PartitionDocumentScrollRequest | null
}
```

Commands:

```ts
type PartitionViewerCommands = {
  requestPageScroll: (page: number) => void
  onCurrentPageChange: (page: number) => void
  onScrollProgressChange: (progress: number) => void
}
```

Document hook state:

```ts
type PartitionDocumentState = {
  onCurrentPageChange: (page: number) => void
  onScrollProgressChange: (progress: number) => void
  scrollRequest: PartitionDocumentScrollRequest | null
}
```

This shape is already good.

## Target Functions

### `createPartitionViewerModel`

Pure function. No React.

```ts
function createPartitionViewerModel(
  result: PartitionResult | null
): PartitionViewerModel
```

Responsibilities:

- return empty model for `null` result
- normalize pages
- build one shared color map across output and votes
- merge output chunks with the same display key for the legend
- build ribbon rows from output and vote choices
- compute page count from every segment in output and votes

### `createPartitionLegendSegments`

Pure function.

```ts
function createPartitionLegendSegments(
  output: PartitionChunk[],
  colors: Map<string, string>
): Segment[]
```

Responsibilities:

- group by display label/key
- merge pages for repeated keys
- preserve deterministic order
- preserve deterministic color

### `createPartitionRibbonRows`

Pure function.

```ts
function createPartitionRibbonRows(
  result: PartitionResult,
  colors: Map<string, string>
): PartitionRibbonRow[]
```

Responsibilities:

- output chunks become `kind: "output"`
- consensus vote choices become `kind: "vote"`
- row ids are stable
- segment ids are stable and unique even when keys repeat

## Provider Shape

The provider should become:

```tsx
function PartitionViewerProvider({ result, isProcessing, children }) {
  const model = React.useMemo(
    () => createPartitionViewerModel(result),
    [result]
  )

  const [currentPage, setCurrentPage] = React.useState(1)
  const [scrollProgress, setScrollProgress] = React.useState(0)
  const [scrollRequest, setScrollRequest] =
    React.useState<PartitionDocumentScrollRequest | null>(null)

  const requestPageScroll = React.useCallback((page: number) => {
    setScrollRequest((current) => ({
      pageNumber: normalizeTargetPage(page),
      version: (current?.version ?? 0) + 1,
    }))
  }, [])

  const document = React.useMemo(
    () => ({
      onCurrentPageChange: setCurrentPage,
      onScrollProgressChange: setScrollProgress,
      scrollRequest,
    }),
    [scrollRequest]
  )

  return (
    <PartitionViewerContext.Provider
      value={{
        model,
        state: {
          currentPage,
          scrollProgress,
          scrollRequest,
        },
        commands: {
          requestPageScroll,
          onCurrentPageChange: setCurrentPage,
          onScrollProgressChange: setScrollProgress,
        },
        document,
        isProcessing,
        result,
      }}
    >
      {children}
    </PartitionViewerContext.Provider>
  )
}
```

The exact context shape can be flatter for ergonomics, but the conceptual split
must remain:

- `model`: pure result-derived data
- `state`: live viewport/document state
- `commands`: transitions
- `document`: renderer bridge

## Public Hooks

Keep hooks narrow:

```ts
function usePartitionViewerHeader(): {
  currentPage: number
  legendSegments: Segment[]
  pageCount: number
  requestPageScroll: (page: number) => void
  rows: RibbonRow[]
  scrollProgress: number
}
```

This hook can remain ergonomic. It does not need to expose the whole context.

```ts
function usePartitionViewerDocument(): PartitionDocumentState
```

This hook is good and should stay. It is the bridge a PDF/document renderer
needs.

Optional future hook:

```ts
function usePartitionViewerModel(): PartitionViewerModel
```

Useful for tests, docs, and custom renderers.

## Composition Target

The easy API remains:

```tsx
<PartitionViewer result={result} />
```

The composed API remains:

```tsx
<PartitionViewerProvider result={result}>
  <ViewerRoot>
    <PdfViewerHeader />
    <PartitionViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <PartitionDocument />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</PartitionViewerProvider>
```

For blocks with a PDF source:

```tsx
<PartitionViewerProvider result={result}>
  <PdfViewerProvider source={source}>
    <ViewerRoot>
      <PdfViewerHeader />
      <PartitionViewerHeader />
      <ViewerBody>
        <ViewerSurface>
          <PartitionSourceDocument />
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  </PdfViewerProvider>
</PartitionViewerProvider>
```

This is shadcn-compliant: provider owns state, visible components compose
primitives, and layout stays explicit.

## Split / Partition Convergence

Partition and split should not be forced into one public component too early.
They have different product language:

- partition: keyed chunks, consensus, votes, waterfall
- split: subdocuments, page rail, sidebar trigger

But they should share a lower-level model/controller vocabulary:

```ts
type SegmentedDocumentModel = {
  segments: Segment[]
  pageCount: number
}

type SegmentedDocumentViewport = {
  currentPage: number
  scrollProgress: number
  requestPageScroll: (page: number) => void
}
```

Partition-specific model can extend it:

```ts
type PartitionViewerModel = SegmentedDocumentModel & {
  legendSegments: Segment[]
  ribbonRows: PartitionRibbonRow[]
}
```

Split-specific model can extend it:

```ts
type SplitViewerModel = SegmentedDocumentModel & {
  pageRailSegments: Segment[]
}
```

This gives shared structure without flattening the product concepts into a
vague mega-component.

## Naming Rules

Use one word for each concept:

- `result`: raw Retab result
- `chunk`: raw partition/split output item
- `segment`: normalized UI model
- `model`: pure derived data
- `state`: live mutable UI state
- `commands`: functions that cause state transitions
- `document`: document renderer bridge
- `rows`: ribbon rows

Avoid:

- `data`
- `items`
- `viewModel` if `model` is enough
- `selected` for partition categories

There is no persistent selected partition key. Currentness comes from the
document page. Hover and focus are transient preview state owned by segment
interaction.

## Accessibility Rules

Segment surfaces should continue to avoid fake selection state.

Correct:

- `aria-current="page"` when the segment owns the current page
- focus state for keyboard navigation
- button labels describing page ranges

Avoid:

- `aria-selected`
- `aria-pressed`
- persistent selected segment state

Clicking a segment is navigation, not selection.

## Tests

Add pure model tests:

- null result returns empty model
- empty output returns `hasOutput: false`
- repeated output keys merge in `legendSegments`
- repeated output keys do not collide in `ribbonRows`
- unsorted pages normalize and dedupe
- `pageCount` uses max page across output and votes
- color map is shared across output and votes
- whitespace keys use display-label fallback consistently

Keep interaction tests:

- clicking legend requests scroll to the earliest normalized page
- scrolling document updates active legend/ribbon state
- vote rows do not change legend grouping
- empty/processing states remain distinct

Architecture tests:

- provider imports `createPartitionViewerModel`
- provider does not inline color map construction
- provider does not inline page normalization
- `PartitionViewerHeader` consumes hook state, not raw result
- easy API composes `PartitionViewerProvider`, `ViewerRoot`, `PartitionViewerHeader`,
  `ViewerBody`, `ViewerSurface`

## Migration Plan

1. Extract pure model helpers beside partition viewer, or into a shared
   partition model file.
2. Move all result-derived `useMemo` logic from provider into
   `createPartitionViewerModel`.
3. Keep current public hooks and JSX composition unchanged.
4. Add pure model tests before changing behavior.
5. Compare split viewer and decide whether a shared segmented viewport
   controller should be extracted.

## Final Target

The partition viewer should read as:

```tsx
const model = createPartitionViewerModel(result)
const state = usePartitionViewportState()

return (
  <Provider value={{ model, state, commands, document }}>
    {children}
  </Provider>
)
```

Everything else should be visible composition:

```tsx
<ViewerRoot>
  <PdfViewerHeader />
  <PartitionViewerHeader />
  <ViewerBody>
    <ViewerSurface>
      <PartitionSourceDocument />
    </ViewerSurface>
  </ViewerBody>
</ViewerRoot>
```

That is the clean design:

- raw result stays raw
- pure model derivation is testable
- provider owns live state only
- segment surfaces stay shared
- viewer primitives stay layout primitives
- split and partition converge through `Segment[]`, not through a bloated
  all-purpose viewer
