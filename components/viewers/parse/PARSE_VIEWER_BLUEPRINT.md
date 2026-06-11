# Parse Viewer Blueprint

This is the implemented architecture for rendering documents that were parsed
page by page to markdown. The invariant is simple: page-by-page markdown must be
rendered page by page so the source document structure stays visible.

## North Star

`PageMarkdownViewer` is the reusable primitive. It knows nothing about Retab
parse responses. It receives markdown pages, renders them as separate document
pages, and can optionally synchronize with a source-document pane.

```tsx
<PageMarkdownViewer
  pages={pages}
  text={text}
  renderDocument={({ onCurrentPageChange }) => (
    <PdfViewer
      src="/document.pdf"
      bare
      onVisiblePageChange={onCurrentPageChange}
    />
  )}
/>
```

`ParseViewer` is only an adapter from `ParseResponse` to `PageMarkdownViewer`:

```tsx
<ParseViewer result={parseResult} renderDocument={renderDocument} />
```

## Module Boundaries

```txt
components/viewers/page-markdown/
  page-markdown-viewer.tsx     shell, pane layout, page sync wiring
  page-markdown-toolbar.tsx    page label, mode tabs, zoom controls, actions
  page-markdown-actions.tsx    copy/download behavior and compact action menu
  page-markdown-page.tsx       page frame, lazy render, rendered/text content
  page-markdown-hooks.ts       page measurement and pane sync hooks
  page-markdown-model.ts       pure scale, height, page-sync transitions
  page-markdown-types.ts       public primitive types

components/viewers/parse/
  parse-viewer.tsx             ParseResponse adapter only
```

Rules:

- No page-markdown module imports `ParseResponse`.
- `ParseViewer` does not own toolbar, markdown rendering, measurement, or sync.
- Pure logic lives in `page-markdown-model.ts`.
- Browser measurement and sync state live in `page-markdown-hooks.ts`.
- UI modules render controls and surfaces only.

## Public APIs

```ts
export interface PageMarkdownViewerProps {
  pages: string[]
  text?: string
  isProcessing?: boolean
  renderDocument?: (handlers: PageMarkdownDocumentHandlers) => ReactNode
  onVisiblePageChange?: (page: number) => void
  downloadFileName?: string
}
```

```ts
export interface ParseViewerProps {
  result: ParseResponse | null
  isProcessing?: boolean
  renderDocument?: PageMarkdownViewerProps["renderDocument"]
  onVisiblePageChange?: (page: number) => void
}
```

`pages` is the source of truth for renderable output. `text` is used for
copy/download when supplied; otherwise pages are joined with blank lines.

## Viewer Behavior

The toolbar exposes the same affordances as the other document viewers:

- `Page N of M`
- Rendered/Text mode
- zoom out
- zoom percent
- zoom in
- fit width
- copy markdown
- download markdown

Wide panes show actions inline. Narrow panes keep page and mode controls visible
and move secondary markdown actions into a menu based on measured toolbar width.

Each markdown page is rendered as its own page surface. Rendered mode uses
`react-markdown`, `remark-gfm`, and `rehype-raw`; Text mode preserves the raw
page markdown in a `pre`.

## Sync Model

The panes coordinate through pure page-pane transitions:

```ts
type PagePane = "markdown" | "document"

interface PagePaneState {
  page: number
  pane: PagePane
  version: number
}
```

Rules:

- Markdown scroll reports request a document scroll.
- Document scroll reports request a markdown scroll.
- A matching report from the target pane confirms the pending scroll.
- No timeout-based suppression is used.
- Repeated document reports for the same page are preserved as events, not
  collapsed into a single state value.

## Page Measurement

Offscreen pages reserve a stable height. The estimate is based on markdown line
count and scale; measured heights are keyed by mode, scale bucket, and content
signature. Changing markdown, mode, or scale invalidates the measurement.

## Verification

Focused coverage:

- `tests/page-markdown-model.test.ts`
- `tests/page-markdown-render.test.tsx`
- `tests/parse-viewer-adapter.test.tsx`

Registry export includes the parse adapter, the generic page-markdown modules,
and the shared `useElementWidth` hook.
