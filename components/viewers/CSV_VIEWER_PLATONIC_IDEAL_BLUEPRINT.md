# CSV Viewer Platonic Ideal Blueprint

This document defines the ideal `CsvViewer`: everything needed for CSV and TSV
source viewing, nothing extra.

The current component is useful and much harder to break than before. This
blueprint is stricter. It describes the version that should feel inevitable
after every prop, helper, state transition, and variable name has been forced to
justify itself.

## Definition Of Perfect

`CsvViewer` is perfect when it is exactly this:

Render delimited text as an addressable, source-linked, virtualized table.

```tsx
<CsvViewer src="/samples/sales.csv" />
<CsvViewer src="/samples/sales.tsv" />
<CsvViewer value={csvText} />
```

It is not a spreadsheet. It is not an editor. It is not a data-grid framework.
It is not a general analytics surface. It is the minimal viewer for delimited
records.

Perfection means:

- complete: CSV and TSV viewing works from every supported source
- minimal: no public prop exists for implementation convenience
- obvious: every behavior has one owner
- stable: large files, failed loads, sorting, and rapid prop changes are boring
- verified: every performance and correctness claim has tests or measurements
- consistent: one vocabulary is used everywhere
- dense: code carries information, not ceremony or defensive folklore

## Non-Negotiables

1. Sync, streamed, and worker parsing produce identical records.
2. No parser path silently truncates user data.
3. CSV and TSV route through the same abstraction with only the delimiter
   changing.
4. Source coordinates are stable under sorting and virtualization.
5. Every rendered cell is addressable by source row and source column.
6. `src` loading begins from the response stream when possible.
7. Worker parsing is real chunked parsing, not whole-file parsing in another
   thread.
8. Errors are typed states, not strings passed through ad hoc branches.
9. Download output matches the visible delimiter unless original bytes are
   returned.
10. Shadow/style isolation is an adapter concern, not part of table semantics.
11. Test-only helpers do not leak from the public component module.
12. Variable names use one vocabulary everywhere.

## Public API

The ideal public API is smaller and more deliberate than the current one.

```ts
export interface CsvViewerHandle {
  scrollToCell: (cell: CsvCellAddress, options?: CsvScrollOptions) => void
  getViewportElement: () => HTMLDivElement | null
}

export interface CsvViewerProps {
  src?: string
  value?: string
  source?: Blob
  data?: CsvTable
  dialect?: CsvDialect
  className?: string
  toolbar?: boolean
  downloadName?: string
  height?: number
  fillHeight?: boolean
  activeCell?: CsvCellAddress | null
  isolateStyles?: boolean
}

export interface CsvCellAddress {
  rowIndex: number
  columnIndex: number
}

export interface CsvScrollOptions {
  behavior?: ScrollBehavior
}
```

Rules:

- `value`, `src`, `source`, and `data` are mutually exclusive in spirit. If more
  than one is passed, precedence is documented and tested.
- `source` means `Blob` or `File`, not a raw string. Raw strings use `value`.
- `dialect`, not scattered props, owns delimiter and header semantics.
- `toolbar` is a boolean, not several independent chrome flags.
- `downloadName` names the output file. It is not inferred in multiple places.
- `scrollToCell` accepts the same shape as `activeCell`; no parallel positional
  API.
- Virtualization tuning is not public by default. It belongs in an internal
  performance policy unless a product caller proves it needs control.

## Dialect Model

Delimited text needs one small dialect type.

```ts
export interface CsvDialect {
  delimiter: "," | "\t" | string
  hasHeader: boolean
}
```

Defaults:

- `.csv` and `text/csv`: `{ delimiter: ",", hasHeader: true }`
- `.tsv` and `text/tab-separated-values`: `{ delimiter: "\t", hasHeader: true }`
- `value` and `source` without hints: `{ delimiter: ",", hasHeader: true }`

Rules:

- File extension wins over MIME when both are present and conflict.
- Explicit `dialect` wins over inference.
- Dialect inference is pure and directly tested.
- Serialization uses the same dialect that parsing used.

## Vocabulary

Use these names everywhere:

| Concept                 | Name                     |
| ----------------------- | ------------------------ |
| Full normalized table   | `csvTable`               |
| Column labels           | `columns`                |
| Source rows             | `sourceRows`             |
| Source row index        | `rowIndex`               |
| Source column index     | `columnIndex`            |
| Display row index       | `displayRowIndex`        |
| Source-to-display map   | `displayIndexByRowIndex` |
| Cell address            | `cellAddress`            |
| Delimiter/header config | `dialect`                |
| Load state              | `resourceState`          |
| Scroll container        | `viewportElement`        |
| Download filename       | `downloadName`           |
| Worker request identity | `parseRequestId`         |

Avoid aliases like `col`, `idx`, `lit`, `parsedRows`, `parsedColumns`,
`effectiveSource`, `urlBlob`, `activeDelimiter`, and `display`. They are not
wrong locally, but they make readers translate between vocabularies.

## Ideal Module Shape

The public component file should be composition only.

```txt
registry/new-york-v4/lib/csv-parser.ts
registry/new-york-v4/lib/csv-normalizer.ts
registry/new-york-v4/lib/csv-dialect.ts
registry/new-york-v4/ui/csv-viewer.tsx
registry/new-york-v4/ui/csv-viewer-state.ts
registry/new-york-v4/ui/csv-viewer-resource.ts
registry/new-york-v4/ui/csv-viewer-worker.ts
registry/new-york-v4/ui/csv-viewer.worker.ts
registry/new-york-v4/ui/csv-viewer-grid.tsx
registry/new-york-v4/ui/csv-viewer-toolbar.tsx
registry/new-york-v4/ui/csv-viewer-scrollbar.tsx
registry/new-york-v4/ui/csv-viewer-style-scope.tsx
registry/new-york-v4/ui/csv-viewer-download.ts
registry/new-york-v4/ui/csv-viewer-test-utils.ts
```

Responsibilities:

- `csv-parser.ts`: incremental RFC-4180-ish parser only.
- `csv-normalizer.ts`: header handling, width growth, row padding, table shape.
- `csv-dialect.ts`: delimiter/header inference and serialization dialect.
- `csv-viewer.tsx`: public props, ref, and composition only.
- `csv-viewer-state.ts`: typed resource and parse state transitions.
- `csv-viewer-resource.ts`: `src`, `value`, `source`, and `data` input
  normalization.
- `csv-viewer-worker.ts`: typed worker client and fallback policy.
- `csv-viewer.worker.ts`: chunked worker parser.
- `csv-viewer-grid.tsx`: table layout, virtualization, sorting projection.
- `csv-viewer-toolbar.tsx`: counts, download, optional zoom if retained.
- `csv-viewer-scrollbar.tsx`: custom scrollbar only.
- `csv-viewer-style-scope.tsx`: shadow-root isolation only.
- `csv-viewer-download.ts`: filename and delimited text serialization.
- `csv-viewer-test-utils.ts`: mocks and cache resets used only by tests.

No React import is allowed in parser, normalizer, dialect, resource, worker
protocol, or download modules.

## Parser And Normalizer

The parser emits records. The normalizer emits table events.

```ts
export type CsvTableEvent =
  | { type: "columns"; columns: string[] }
  | { type: "rows"; rows: string[][] }
```

Rules:

- The parser does not know about headers.
- The normalizer does not know about chunks, files, workers, or React.
- Later wider rows grow the table and emit updated columns.
- Previously emitted row batches are padded by the receiver through one tested
  utility, not by scattered loops.
- Malformed-but-readable CSV remains tolerant.
- IO failures and decode failures are not parser failures.

## Resource State

The viewer has exactly five user-facing states.

```ts
type CsvResourceState =
  | { status: "idle" }
  | { status: "loading"; rowCount: number; columnCount: number }
  | { status: "ready"; csvTable: CsvTable }
  | { status: "empty"; columns: string[] }
  | { status: "error"; error: CsvViewerError }
```

`CsvViewerError` is typed:

```ts
type CsvViewerError =
  | { kind: "fetch"; status?: number }
  | { kind: "decode" }
  | { kind: "worker" }
  | { kind: "aborted" }
  | { kind: "unknown" }
```

Rules:

- Aborted stale work never renders an error.
- Failed current work renders a local error state.
- Empty means parsing finished and produced no data rows.
- Loading may show partial row and column counts.
- No branch checks a raw error string.

## Worker Ideal

The ideal worker is a normal bundled module.

```ts
export interface CsvWorkerRequest {
  parseRequestId: string
  source: Blob
  dialect: CsvDialect
  batchSize: number
}

export type CsvWorkerResponse =
  | { type: "columns"; parseRequestId: string; columns: string[] }
  | { type: "rows"; parseRequestId: string; rows: string[][] }
  | { type: "done"; parseRequestId: string }
  | { type: "error"; parseRequestId: string; error: CsvViewerError }
```

Rules:

- No `Function#toString()` worker construction.
- No inline source concatenation.
- No duplicate parser logic in the worker.
- Every worker message carries `parseRequestId`.
- Worker and main-thread parsing share the same parity test suite.
- Worker fallback to main thread is allowed only for worker construction failure,
  not for parser/runtime errors.

## Grid Semantics

The grid renders a projection of source rows.

```ts
interface CsvGridProjection {
  columns: string[]
  sourceRows: string[][]
  rowOrder: number[] | null
  displayIndexByRowIndex: Map<number, number> | null
}
```

Rules:

- Sorting changes `rowOrder`, never `sourceRows`.
- `activeCell.rowIndex` always refers to `sourceRows`.
- Row headers display source row numbers unless an explicit future prop says
  otherwise.
- `aria-rowindex` reflects display position.
- `scrollToCell` maps source row index to display row index before scrolling.
- Virtualization owns rendering only; it never owns table semantics.

## Style Isolation

Style isolation is a performance adapter, not a CSV concept.

Rules:

- The main grid must render correctly without isolation.
- Isolation is opt-in and behavior-preserving.
- Shadow-root CSS copying lives in its own module.
- `:has()` stripping has a test for rule filtering and a browser performance
  note with before/after measurements.
- If isolation cannot copy required styles, it fails closed with a visible grid,
  not a blank surface.

## Download Semantics

Downloads are deterministic:

- `src`: download original bytes.
- `value`, `source`, `data`: serialize the normalized table with the active
  dialect.
- Tab-delimited generated files default to `.tsv`.
- Comma-delimited generated files default to `.csv`.
- Fields quote only when required by delimiter, quote, CR, or LF.
- Row endings are CRLF.

Serialization is pure and fully tested.

## FileViewer Boundary

`FileViewer` remains a router. It should not parse CSV.

Ideal boundary:

```tsx
<CsvViewer
  src={descriptor.src}
  dialect={csvDialectFromDescriptor(descriptor)}
  downloadName={descriptor.downloadName}
  toolbar={false}
  fillHeight
/>
```

Rules:

- `csvDialectFromDescriptor` is pure.
- It lives outside `FileViewer` if CSV owns dialect inference.
- `FileViewer` passes descriptor facts, not CSV internals.
- FileViewer tests cover routing and dialect inference only.

## Tests

The ideal suite has four layers.

### Pure Tests

Cover:

- parser chunk boundaries
- quoted delimiters and quoted newlines
- escaped quotes
- CRLF and lone CR
- dialect inference
- normalizer width growth
- serialization
- source/display row projection

### Resource Tests

Cover:

- `src` streaming from `Response.body`
- Blob streaming
- string value parsing
- stale request cancellation
- failed fetch error state
- worker construction fallback
- worker runtime error state

### Component Tests

Cover:

- rendering headers and cells
- loading to ready
- loading to empty
- loading to error
- sorting asc, desc, none
- source-coordinate highlighting after sorting
- `scrollToCell` after sorting
- generated download delimiter and filename
- toolbar hidden/visible

### Browser Verification

Cover:

- large CSV scrolls smoothly
- large TSV parses correctly
- remote streaming shows partial rows before completion
- worker mode does not block interaction
- sticky header and row gutter remain aligned
- style isolation is visually equivalent
- no console errors
- memory does not grow unbounded across repeated mounts

## Removal List

The platonic implementation removes or hides:

- inline string worker construction
- parser/normalizer duplication
- public virtualization tuning props
- separate `showZoom` and `showDownload` props
- raw error string state
- `source` accepting raw strings
- helper exports from the public component module
- comments that justify accidental architecture
- local variable aliases for the same concept

## Acceptance Criteria

The component reaches this blueprint when:

- `csv-viewer.tsx` is a thin composition file.
- No React-free module imports React.
- The worker is a typed module.
- Main-thread and worker parsing share one parity suite.
- CSV and TSV work through direct `CsvViewer` and `FileViewer`.
- Sorting never breaks source-linked highlighting or scrolling.
- Downloads preserve original bytes for `src` and active dialect otherwise.
- Loading, empty, ready, and error states are typed and tested.
- Browser verification documents scroll performance and memory behavior.
- The public API has no prop that exists only because the implementation needed
  it.
