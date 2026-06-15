# Viewer Gap 07: Page Markdown Sync Boundary

## Question

Should parse/page-markdown sync converge with `SegmentedDocumentProvider`?

Not yet. Page markdown currently needs page sync, not segment/anchor sync. The
gap is making that boundary explicit so page markdown does not become a third
document interaction system by accident.

## Current State

Good:

- Page markdown is a real document renderer.
- Parse is a thin domain wrapper over page markdown.
- Markdown/page rendering is decomposed into model, pane, scale, scroll, sync,
  toolbar, and content.
- Page markdown sync uses a registered handle instead of a replay protocol.

Bad:

- It has its own current-page sync engine.
- It is separate from segmented document viewport state.
- Parse can feel less consistent as a standalone viewer because it may not have
  the same header/chrome expectations.
- If annotations are added later, page markdown could duplicate segment/anchor
  mechanics.

## Boundary

Page markdown owns:

```txt
markdown page model
page rendering
page scroll
current page
scale
search/highlight if markdown-specific
```

Segmented document owns:

```txt
semantic segments
page-local anchors
hover/preview
active segment
scroll to segment
scroll to anchor
overlays
legend/rail/ribbon synchronization
```

The shared contract is only a document handle:

```ts
type PageDocumentHandle = {
  scrollToPage: (pageNumber: number, options?: ScrollOptions) => void
}
```

Do not add segment behavior to page markdown until a real annotation use case
exists.

## Ideal Shape

Page markdown provider:

```tsx
<PageMarkdownViewerProvider source={source}>
  <PageMarkdownViewerToolbar />
  <PageMarkdownViewerContent />
</PageMarkdownViewerProvider>
```

Parse viewer:

```tsx
<ParseViewerProvider result={result}>
  <ViewerRoot>
    <ParseViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <ParseViewerMarkdown />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</ParseViewerProvider>
```

If parse has no standalone header, that should be deliberate:

```txt
ParseViewer is an embedded result surface.
```

or it should get a header:

```txt
ParseViewer is a standalone domain viewer.
```

## Convergence Trigger

Only converge with segmented-document mechanics if page markdown needs one of:

```txt
semantic output sections
field/source overlays
page-local bounding boxes
legend/rail segment navigation
hover/preview linked to document regions
```

Then the integration should be:

```tsx
<SegmentedDocumentProvider model={model}>
  <PageMarkdownViewerProvider source={source}>
    <SegmentedPageMarkdownBridge />
    <PageMarkdownViewerContent />
  </PageMarkdownViewerProvider>
</SegmentedDocumentProvider>
```

The bridge registers a segmented document handle. It does not merge providers.

## Avoid

Do not do this:

```ts
type PageMarkdownSegment = {
  id: string
  pageNumber: number
  markdownLineStart?: number
  metadata?: Record<string, unknown>
}
```

That would create a vague markdown-specific segment model.

## Success Criteria

- Page markdown sync remains handle-based.
- No `scrollRequest.version` protocol returns.
- Parse viewer explicitly declares whether it is embedded or standalone.
- Page markdown does not import segmented primitives unless it has real
  segment/anchor behavior.
- If annotations arrive, they adapt through a bridge instead of rewriting the
  page markdown provider.

## Failure Signals

- Page markdown adds hover/preview state that duplicates
  `SegmentedDocumentProvider`.
- Parse viewer grows hidden private chrome.
- Markdown annotations are modeled as untyped metadata.
- Page sync and segment sync are mixed in one large provider.

## Final Position

Keep page markdown separate for now. Its primitive is page sync, not segmented
evidence. Converge only through a bridge when annotations make that necessary.

