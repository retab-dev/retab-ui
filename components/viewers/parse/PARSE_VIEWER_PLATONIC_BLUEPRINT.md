# Parse Viewer Platonic Blueprint

This blueprint describes the final form of the parse/page-markdown viewer:
everything needed, nothing extra, with names and boundaries that make the code
hard to misuse.

## Standard

The component is perfect when:

- `ParseViewer` is only a parse-response adapter.
- `PageMarkdownViewer` is a generic page-by-page markdown viewer.
- Page structure is never flattened for rendering.
- Source-document sync is event-based, deterministic, and timeout-free.
- Each file has one reason to change.
- No module name mentions parse unless it consumes `ParseResponse`.
- UI files contain UI; model files contain pure logic; hooks bridge browser APIs.
- All magic values are named constants.
- Tests cover model transitions, visible-page detection, rendering, actions, and
  the parse adapter.

## Final Module Graph

```txt
components/viewers/parse/
  parse-viewer.tsx
    ParseResponse -> PageMarkdownViewer props

components/viewers/page-markdown/
  page-markdown-viewer.tsx
    public shell only

  page-markdown-pane.tsx
    markdown viewport, page list, scroll handler

  page-markdown-document-pane.tsx
    renderDocument mount point

  page-markdown-toolbar.tsx
    page indicator, mode tabs, zoom controls, action slot

  page-markdown-actions.tsx
    copy, download, compact menu

  page-markdown-page-frame.tsx
    page surface dimensions, lazy visibility, reserved height

  page-markdown-content.tsx
    rendered/text markdown content

  page-markdown-components.tsx
    ReactMarkdown component map

  page-markdown-hooks.ts
    page pane sync, measured page height

  visible-page.ts
    DOM visible-page calculation

  page-markdown-model.ts
    pure scale, measurement keys, sync transitions

  page-markdown-types.ts
    public and internal types

hooks/
  use-element-width.ts
```

## Public API

`PageMarkdownViewer` is the primitive:

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

`ParseViewer` is the adapter:

```ts
export interface ParseViewerProps {
  result: ParseResponse | null
  isProcessing?: boolean
  renderDocument?: PageMarkdownViewerProps["renderDocument"]
  onVisiblePageChange?: (page: number) => void
}
```

Rules:

- `pages` is the render source of truth.
- `text` is the copy/download source when supplied.
- Empty `pages` means empty viewer, even if `text` exists.
- Page numbers exposed across the API are 1-based.
- `downloadFileName` defaults to `document.md`; `ParseViewer` passes
  `parse-output.md`.

## Naming

Use one vocabulary everywhere:

- `page`, not `index`, for 1-based page numbers.
- `pageIndex` only for zero-based array access.
- `pane` for `"markdown"` or `"document"`.
- `reportPage` for observed visibility events.
- `scrollTarget` for a requested programmatic scroll.
- `confirmed` for a target pane acknowledging a pending scroll.
- `scale`, `fitScale`, `manualScale` for zoom state.
- `markdown`, `pages`, `text` for content.

Avoid:

- parse-specific names in page-markdown modules
- `current`, `doc`, `el`, `wrapper`, or `output` when a domain name exists
- timer/suppression vocabulary

## Sync Model

All cross-pane coordination flows through a pure reducer:

```ts
type PagePane = "markdown" | "document"

interface PagePaneEvent {
  pane: PagePane
  page: number
  sequence: number
}

interface PagePaneState {
  page: number
  pane: PagePane
  sequence: number
  pending: PagePaneEvent | null
}
```

Rules:

- Markdown visibility event requests document scroll.
- Document visibility event requests markdown scroll.
- Matching target-pane event clears `pending`.
- Same-page events are preserved with `sequence`.
- No `setTimeout` suppression.
- No ref reads during render.
- DOM scrolling happens in effects or event handlers only.

## Pane Split

`PageMarkdownViewer` should be boring:

```tsx
export function PageMarkdownViewer(props: PageMarkdownViewerProps) {
  const state = usePageMarkdownViewerState(props)

  if (state.isEmpty) return <PageMarkdownEmptyState ... />

  return props.renderDocument ? (
    <ResizablePanelGroup ...>
      <PageMarkdownDocumentPane ... />
      <PageMarkdownPane ... />
    </ResizablePanelGroup>
  ) : (
    <PageMarkdownPane ... />
  )
}
```

It should not calculate visible pages, render markdown, or render individual
toolbar buttons inline.

## Markdown Pane

`PageMarkdownPane` owns:

- markdown viewport ref
- scroll handler
- visible-page reporting
- page list rendering
- container width measurement for fit scale

It receives:

```ts
interface PageMarkdownPaneProps {
  pages: string[]
  text: string
  mode: PageMarkdownViewMode
  scale: number
  currentPage: number
  downloadFileName: string
  onModeChange: (mode: PageMarkdownViewMode) => void
  onZoom: (factor: number) => void
  onFitWidth: () => void
  onVisiblePageChange: (page: number) => void
}
```

## Page Frame

`PageMarkdownPageFrame` owns:

- `data-page-number`
- page dimensions
- intersection observer
- reserved height

It does not render toolbar controls or know about document sync.

## Markdown Content

`PageMarkdownContent` owns only:

- Rendered mode
- Text mode
- markdown component map

The ReactMarkdown component map should live in its own file so page framing can
change without touching markdown styling.

## Toolbar

Required controls:

- `Page N of M`
- Rendered/Text
- zoom out
- zoom percent
- zoom in
- fit width
- copy markdown
- download markdown

Rules:

- No viewport breakpoints.
- Use measured toolbar width.
- Move secondary actions into the menu below a named threshold:

```ts
const PAGE_MARKDOWN_COMPACT_ACTIONS_WIDTH = 460
```

## Actions

Copy/download behavior should be testable without rendering the full viewer:

```ts
export function createMarkdownBlob(text: string): Blob
export function normalizeMarkdownFileName(fileName?: string): string
```

The React components call these helpers.

## Tests

Required tests:

- pure scale clamps
- markdown page join behavior
- page height estimates
- measurement key invalidation
- page-pane transition reducer
- visible-page DOM calculation
- toolbar wide mode
- toolbar compact menu mode
- rendered/text mode switch
- copy success and failure states
- download file name
- parse adapter prop mapping

Current tests are a base. The missing high-value tests are compact toolbar,
copy/download helpers, and visible-page calculation as a pure DOM helper.

## Migration Steps

1. Extract `visible-page.ts` from `page-markdown-viewer.tsx`.
2. Extract `PageMarkdownPane`.
3. Extract `PageMarkdownDocumentPane`.
4. Extract `PageMarkdownPageFrame`.
5. Extract `PageMarkdownContent` and `page-markdown-components.tsx`.
6. Move toolbar threshold into a named constant.
7. Add action helper tests.
8. Add visible-page tests.
9. Regenerate registry output.
10. Run browser verification once unrelated docs build errors are fixed.

## Done Criteria

The platonic version is done when:

- `parse-viewer.tsx` is under 40 lines.
- `page-markdown-viewer.tsx` is under 120 lines.
- No file mixes toolbar, page rendering, and sync concerns.
- No parse-specific terms appear in page-markdown files.
- No unnamed numeric thresholds remain.
- Focused tests cover every pure helper and every public interaction.
- The docs route renders without toolbar overlap at desktop and narrow split-pane
  widths.
