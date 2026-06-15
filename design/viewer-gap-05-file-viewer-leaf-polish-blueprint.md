# Viewer Gap 05: FileViewer Leaf Polish

## Question

What remains between the current FileViewer and the ideal file-rendering
primitive?

The major architectural cut is done: FileViewer is complete chrome by default,
`bare` is the nested/content form, `FileViewerHeader` and `FileViewerContent`
are named parts, and CSV/HTML content adapters no longer use `*DocViewer`.

The remaining gaps are smaller but still matter.

## Current State

Good:

- `<FileViewer source />` is a complete viewer.
- `<FileViewer source bare />` is the nested/content form.
- `FileViewerProvider` owns one source and resolved render state.
- `FileViewerHeader` owns identity and download.
- `FileViewerContent` owns routing.
- Public hooks are narrow.
- Content-only CSV/HTML adapters are named `CsvFileContent` and
  `HtmlFileContent`.
- Generated registry output no longer carries `CsvDocViewer` or
  `HtmlDocViewer`.

Bad:

- `FileViewerContentProps` is still narrow.
- `PdfViewerPages` delegates through `PdfResourceContent`.
- Some leaf viewer names still mix complete viewer and content concepts.
- Markdown has multiple families whose names do not clearly explain the product
  distinction.
- Some leaf viewers include their own toolbar/chrome, while others are pure
  content.

## Content Prop Surface

`FileViewerContent` currently takes a small set of props. That is good for now,
but the ideal named-parts API may need explicit controls:

```ts
type FileViewerContentProps = {
  className?: string
  bare?: boolean
  showLeafDownload?: boolean
  fallback?: React.ReactNode
  unsupportedFallback?: React.ReactNode
}
```

Only add these when a concrete composed viewer needs them. Do not add speculative
slot props.

## Leaf Naming Rule

The naming rule should stay strict:

```txt
*Viewer
  complete easy component or standalone renderer with its own user-facing chrome

*Content
  content-only part inside another viewer

*Pages
  paginated document surface

*Canvas
  rendering surface

*Grid / *Workbook
  table/workbook surfaces

*ResourceContent
  resource-first adapter used by FileViewer route
```

Bad names:

```txt
*DocViewer for content-only adapters
*ResourceViewer for content-only adapters
```

## PDF Call Path

Current:

```txt
FileViewerRoute -> PdfResourceContent
PdfViewerPages  -> PdfResourceContent
```

This is not wrong. It is slightly indirect because `PdfViewerPages` sounds like
the page-rendering part but delegates back through the resource adapter.

Ideal:

```txt
PdfResourceContent
  owns resource loading
  renders PdfViewerPages once document resource is ready

PdfViewerPages
  owns page rendering only
  does not have to route through resource content
```

Only change this if the current path makes tests, docs, or consumers harder to
reason about.

## Markdown Families

The current names are not self-explanatory enough:

```txt
PretextMarkdownViewer
MarkdownDocumentViewer
PageMarkdownViewer
```

The blueprint should document the distinction:

```txt
PretextMarkdownViewer
  markdown text/file rendering in FileViewer.

MarkdownDocumentViewer
  legacy or full markdown document surface, if still needed.

PageMarkdownViewer
  page-synchronized markdown output, used by parse/page workflows.
```

If two names describe the same product, collapse them. If they describe
different products, document the boundary in code and docs.

## Success Criteria

- FileViewer remains the only public file source router.
- Leaf renderers do not recreate file identity headers.
- Content-only adapters use content names.
- PDF page/resource boundaries are easy to explain.
- Markdown variants have documented product boundaries.
- No generic slot system returns.

## Failure Signals

- A leaf renderer adds file name, category, and download header again.
- `ResourceDocShell` reappears under a new name.
- FileViewer starts importing email, split, partition, upload, or file-system
  domain state.
- Markdown route selection becomes hidden in ad hoc conditionals.

## Final Position

FileViewer is now structurally good. Remaining work is precision: content prop
surface, leaf naming, and documentation of markdown/PDF boundaries.

