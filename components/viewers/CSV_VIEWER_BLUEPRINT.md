# CSV Viewer Blueprint

This is the target design for `CsvViewer` after the current implementation is
hardened. The viewer is already directionally strong: it has a small parser,
row and column virtualization, progressive row rendering, source-link hooks,
bounded URL blob caching, and optional shadow-root style isolation for hostile
host CSS. The remaining work is about making parsing semantics, streaming,
integration, and verification as rigorous as the table surface.

## North Star

`CsvViewer` should render CSV and TSV files consistently from any supported
source:

```tsx
<CsvViewer source={{ kind: "url", url: "/samples/sales.csv" }} />
<CsvViewer source={{ kind: "url", url: "/samples/sales.tsv" }} />
<CsvViewer source={{ kind: "text", text: csvText, fileName: "sales.csv" }} />
<CsvViewer source={{ kind: "table", table: { columns, rows } }} />
```

The same logical file should produce the same table regardless of whether it is
provided as a URL source, Blob source, text source, or pre-parsed table source.
Large inputs should start rendering progressively without blocking the main
thread, and the public API should make delimiter and header behavior explicit
enough that hosts like `FileViewer` cannot accidentally misparse TSV as CSV.

## Public API

Keep the API focused on tabular text viewing:

```ts
export interface CsvViewerProps {
  source?: CsvViewerSource
  worker?: boolean
  batchSize?: number
  delimiter?: string
  hasHeader?: boolean
  showRowNumbers?: boolean
  virtualized?: boolean
  overscan?: number
  columnOverscan?: number
  rowHeight?: number
  columnWidth?: number
  scale?: number
  showZoom?: boolean
  showDownload?: boolean
  height?: number
  fillHeight?: boolean
  label?: string
  activeCell?: { row: number; col: number } | null
  isolateStyles?: boolean
  className?: string
}
```

Rules:

- `source` is the only public data entrypoint.
- URL, Blob, text, and parsed table inputs are distinguished by `source.kind`.
- `delimiter` must affect every input path consistently.
- `hasHeader` must affect every input path consistently.
- Text sources are acceptable for small strings and may parse synchronously.
- URL and Blob sources are the large-file paths and should parse off the render
  path when possible.
- Table sources are already normalized and should not be reparsed.
- Display controls such as zoom, height, virtualization, and row numbers must not
  change parse semantics.
- `activeCell` and `scrollToCell` use data coordinates, not display coordinates.

## Current Assessment

The implementation in `registry/new-york-v4/ui/csv-viewer.tsx` and
`registry/new-york-v4/lib/csv.ts` has good foundations:

- The parser is dependency-free and handles quoted fields, escaped quotes, CRLF,
  custom delimiters, and chunk boundaries.
- The parser factory is worker-safe because it does not depend on closure state.
- Rows and columns are virtualized with TanStack Virtual.
- The header and body share one scroller, keeping horizontal alignment simple.
- URL blobs are cached with LRU eviction.
- Source-link integration exposes `scrollToCell`.
- `isolateStyles` can avoid expensive host `:has()` invalidation during dense
  virtualized scrolling.

It is not yet the final design.

Remaining concerns:

- `FileViewer` routes `.tsv` files to `CsvViewer`, but does not pass
  `delimiter="\t"`, so TSV files are parsed as one comma-delimited column.
- `parseCsv` pads to the widest record, while streaming and worker paths fix the
  width from the header or first record and truncate later wider rows.
- The worker path calls `source.text()` and parses the entire file before posting
  row batches, so worker mode is progressive rendering but not true streaming
  parsing.
- The URL source path fetches a complete Blob before parsing starts, so remote
  files do not begin rendering until the whole response has downloaded.
- Worker failures are collapsed into "done" state, which hides parse/load errors
  from the user.
- `scrollToCell` does not account for sorted display order, so source-link
  scrolling can land on the wrong visible row after sorting.
- Download serialization always emits comma-delimited CSV for generated exports,
  even when the viewer parsed TSV or another delimiter.
- There are parser tests, but no focused React tests for viewer rendering,
  source/worker behavior, URL source loading, TSV routing, source anchors,
  sorting, download, or error states.

## Invariants

These rules should be true after hardening:

1. The same records produce the same `columns` and `rows` for text, URL, Blob,
   table, and worker paths.
2. `delimiter` and `hasHeader` are honored by every parsing path.
3. TSV files routed through `FileViewer` are parsed with tab delimiters.
4. Large local files parse incrementally without materializing a second complete
   text copy on the main thread.
5. Remote files can begin parsing before the full response is downloaded when
   the browser exposes a readable response body.
6. Worker mode and main-thread streaming mode produce identical parse results.
7. Parse and fetch errors are visible and do not masquerade as empty data.
8. Sorting changes display order only; source coordinates remain stable.
9. `scrollToCell(row, col)` scrolls to the source row even after sorting.
10. Download output matches the displayed delimiter unless returning original
    source bytes.
11. Virtualization never changes row or column semantics.
12. Style isolation must remain opt-in and must not be required for correct
    visuals.

## Parse Model

Use one normalization path for sync, streaming, and worker parsing.

Target shape:

```ts
export interface CsvShape {
  columns: string[]
  width: number
}

export interface CsvNormalizer {
  accept(record: string[]): { columns?: string[]; row?: string[] }
  finish(): ParsedCsv
}
```

Rules:

- Header handling should live in the normalizer, not be reimplemented in
  `parseCsv`, `streamCsv`, and the worker string.
- Ragged rows need one explicit policy. Prefer widest-record preservation for
  full sync parsing and streaming paths, because truncating user data is worse
  than growing columns.
- If columns must grow after initial header emission, emit a `columns` update and
  pad previously accumulated rows consistently.
- The worker should reuse the same normalizer logic as the main-thread stream,
  either by serializing self-contained helper functions or by moving the worker
  into a bundled module.
- Invalid CSV should remain tolerant by default, but fatal read/worker failures
  should surface as errors.

## Streaming Model

Remote and local large-file paths should stream bytes/text into the same parser.

Target data flow:

```txt
Blob/File/string/Response.body
  -> decoded text chunks
  -> createCsvParser().push(chunk)
  -> CsvNormalizer.accept(record)
  -> batched state updates
```

Rules:

- For `Blob` and `File`, prefer `blob.stream().pipeThrough(new TextDecoderStream())`.
- For URL sources, prefer `fetch(source.url).body` when available; fall back to
  Blob parsing only when streaming is unavailable.
- For text sources, slice into bounded chunks.
- Worker mode should parse chunks in the worker and post batches as they are
  produced.
- Main-thread fallback should yield periodically with an abort signal.
- The viewer should batch state updates by row count and/or elapsed time to avoid
  excessive React commits.
- Every async path needs a request identity or cancellation guard so stale loads
  never update a newer file.

## Worker Ownership

The inline string worker is acceptable as a short-term implementation detail, but
it should not own separate parsing semantics.

Preferred end state:

- A dedicated worker module, such as `csv-viewer.worker.ts`.
- Shared parser/normalizer utilities that are worker-safe.
- `CsvWorkerRequest` and `CsvWorkerMessage` types in source code rather than
  implicit string protocol.
- Object URL cleanup if inline workers remain.

Required worker messages:

```ts
type CsvWorkerMessage =
  | { type: "columns"; columns: string[] }
  | { type: "rows"; rows: string[][] }
  | { type: "error"; message: string }
  | { type: "done" }
```

Rules:

- A worker parse error should set viewer error state.
- A worker construction error may fall back to main-thread streaming.
- A worker runtime error should not silently render partial data as complete.
- Worker and main-thread paths must share tests for ragged rows, TSV, quoted
  multiline fields, and abort behavior.

## FileViewer Integration

`FileViewer` should remain a router, but it must pass enough format identity to
the leaf viewer for correct parsing.

Target helper:

```ts
function delimiterFromCsvDescriptor(descriptor: FileDescriptor): string {
  return extensionOf(descriptor.fileName) === "tsv" ||
    descriptor.mimeType === "text/tab-separated-values"
    ? "\t"
    : ","
}
```

Rules:

- `.csv` and `text/csv` default to comma.
- `.tsv` and `text/tab-separated-values` default to tab.
- An explicit `CsvViewer delimiter` prop should still win for direct usage.
- FileViewer should not parse CSV itself.
- FileViewer tests should cover `.csv`, `.tsv`, `text/csv`, and
  `text/tab-separated-values`.

## Sorting And Source Coordinates

Sorting must not break source-link behavior.

Current row rendering maps display index to source row via `order`, but
`activeCell` and `scrollToCell` still compare/scroll by display index.

Target behavior:

- `activeCell.row` is always a source row index.
- Row numbers display source row numbers, unless a future explicit option asks
  for display row numbers.
- `scrollToCell(sourceRow, col)` finds the current display index for `sourceRow`
  when sorted, then scrolls that display index into view.
- Highlighting compares the source row for a rendered display row, not the
  display index.

Implementation sketch:

```ts
const displayIndexBySourceRow = React.useMemo(() => {
  if (!order) return null
  const map = new Map<number, number>()
  order.forEach((sourceIndex, displayIndex) =>
    map.set(sourceIndex, displayIndex)
  )
  return map
}, [order])
```

## Download Semantics

Download behavior should be predictable:

- If the resource exposes an original download, offer that original file.
- If `delimiter` is `"\t"`, serialize tab-delimited output for generated data.
- If `delimiter` is omitted, serialize comma-delimited output.
- Use the source file name when possible.
- Use `data.tsv` for tab-delimited generated downloads and `data.csv` otherwise.

Target helper:

```ts
function serializeDelimited(
  columns: string[],
  rows: string[][],
  delimiter: string
): string
```

Rules:

- Quote fields when they contain delimiter, quote, CR, or LF.
- Always double inner quotes.
- Keep CRLF row endings for generated delimited text.

## Error And Empty States

The viewer should distinguish loading, empty, and failed states.

States:

- `loading`: fetch or parse is still active.
- `ready-empty`: parse completed and produced no data rows.
- `ready`: parse completed with at least one row or at least columns.
- `error`: fetch, decode, parser, or worker failed.

Rules:

- Empty state should not display while a source is still loading.
- Error state should include a terse message and keep the viewer chrome stable.
- Retrying should happen through the resource retry path or by changing source
  identity.
- Worker errors should not be treated as successful completion.

## Accessibility

The current ARIA table roles are a reasonable base, but they should be tightened.

Rules:

- Keep `role="table"`, `role="row"`, `role="columnheader"`, and `role="cell"`
  consistent with the virtualized DOM.
- `aria-rowcount` and `aria-colcount` should reflect total logical data.
- Sort buttons should expose `aria-sort` on the column header.
- Loading and error states should be announced through a polite live region.
- Icon-only controls must keep labels and titles.
- Keyboard users should be able to activate sort and download controls.

## Tests

Add focused tests before broad visual work.

### Parser And Normalizer Tests

Cover:

- CSV and TSV delimiters.
- quoted delimiters and quoted newlines.
- escaped quotes across chunk boundaries.
- CRLF split across chunk boundaries.
- ragged rows with later wider records.
- `hasHeader: true` and `hasHeader: false`.
- sync parse and streaming parse parity.
- worker protocol parity for representative inputs.

### Component Tests

Cover:

- text source renders headers and cells.
- `CsvViewer source` transitions loading to rows.
- worker failure shows error rather than empty state.
- clicking a header cycles asc, desc, none.
- sorting preserves source-coordinate active-cell highlighting.
- `scrollToCell` resolves source row to display row after sorting.
- download serialization uses the active delimiter.
- empty input renders empty state only after parsing completes.

### FileViewer Integration Tests

Cover:

- `.csv` route passes comma delimiter.
- `.tsv` route passes tab delimiter.
- `text/csv` without extension parses comma-delimited data.
- `text/tab-separated-values` without extension parses tab-delimited data.

### Browser Verification

Use docs/demo samples to verify:

- CSV and TSV render with correct columns.
- Large local CSV starts showing rows progressively.
- Remote CSV starts showing rows progressively when streaming fetch is available.
- Sorting does not break source highlighting.
- Horizontal and vertical scrolling keep header and row-number gutter aligned.
- `isolateStyles` does not visibly change rendering.
- Narrow containers keep toolbar controls usable.

## Implementation Plan

1. Add a shared parser normalizer so sync, main-thread streaming, and worker
   parsing produce identical columns and rows.
2. Add tests that demonstrate current ragged-row parity failures.
3. Update `streamCsv` to emit column updates when later rows widen the table, or
   choose and document a no-truncation policy that remains identical everywhere.
4. Replace the worker's whole-file `source.text()` parse with chunked parsing.
5. Surface worker/runtime errors through viewer error state.
6. Stream URL sources from `fetch().body` when possible, falling back to Blob
   parsing.
7. Teach `FileViewer` to pass tab delimiter for TSV descriptors.
8. Make sorting source-coordinate aware for `activeCell`, row numbers, and
   `scrollToCell`.
9. Serialize generated downloads with the active delimiter and filename
   extension.
10. Add parser, component, and FileViewer integration regression tests.
11. Run the docs demo in a browser and verify scroll, sort, loading, error, and
    source-highlight behavior.

## Non-Goals

- Do not replace `CsvViewer` with a spreadsheet component.
- Do not add editing, filtering, formulas, pivoting, or cell selection ranges.
- Do not make `FileViewer` parse CSV or inspect row data.
- Do not turn `isolateStyles` on by default without performance evidence.
- Do not add a heavy CSV dependency unless the local parser cannot meet the
  target invariants.
- Do not redesign the visual language while hardening parse and state behavior.

## Acceptance Criteria

- CSV and TSV render correctly through direct `CsvViewer` usage and through
  `FileViewer`.
- `parseCsv`, main-thread streaming, and worker parsing produce identical output
  for the same input and options.
- Later wider rows are not silently truncated.
- Large `source` inputs render progressively without blocking the main thread.
- URL sources begin parsing from streaming responses when available.
- Runtime worker errors produce an error state.
- Sorting does not break source-linked scroll or active-cell highlighting.
- Generated downloads preserve the active delimiter.
- Focused parser and React tests cover the hardening cases above.
- Browser verification passes for CSV, TSV, large-file scroll, sort, download,
  and style-isolated rendering.
