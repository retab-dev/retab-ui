# Markdown Viewer Missing Inventory

## Current Shipped Contract

The File Viewer Markdown path now routes to `TextViewer` with
`mode="markdown"`. It no longer uses the old injected-HTML
`MarkdownDocViewer`.

Implemented:

- Markdown tokenization with `marked` GFM mode.
- Pretext-backed block preparation and custom frame virtualization.
- Paragraphs, headings, emphasis, strike, inline code, lists, task markers,
  blockquotes, rules, fenced/indented code blocks, standalone images, and
  tables.
- Safe `http:`, `https:`, relative, fragment, and `mailto:` links.
- Safe standalone image URLs for `http:`, `https:`, `blob:`, and relative
  paths.
- Standalone image loading/error state with inert alt-text fallback.
- Fenced code language labels and per-block copy.
- Inert fallback for unsafe links, unsafe images, and raw HTML.
- Semantic table DOM with visible body-row materialization.
- File Viewer routing separation: Markdown/Text use Text Viewer; logs, JSON,
  MDX, and code use Code Viewer.

## Missed Or Still Incomplete

### 1. Markdown Dialect Contract

- `.mdx` routes to Code Viewer rather than Markdown mode; MDX preview rendering
  is intentionally unsupported.
- Frontmatter is not explicitly parsed, hidden, or rendered.
- Math, footnotes, definition lists, admonitions, directives, and Mermaid-style
  blocks are not supported.
- The actual contract is "whatever `marked` GFM emits plus our projection
  subset", but this is not formalized as a fixture matrix.
- Unsupported constructs do not have a single documented degradation rule beyond
  "inert fallback".

### 2. Source Mapping

- Nested blockquote children still use broad parent token ranges.
- Nested list item ranges are narrower than before, but exact child-block ranges
  are still approximate.
- Code-fence visual lines do not map to exact source sub-lines.
- Plain-text hard-wrapped paragraph grouping still maps many physical source
  lines to one rendered block.
- `scrollToLineRange` finds the intersecting block, not the exact nested
  Markdown construct.

### 3. Tables

- Table cells are flattened to mostly plain text; nested inline structure is not
  preserved per fragment.
- Long cell text uses a fixed row height and can clip instead of expanding or
  wrapping with measured height.
- There is row virtualization, but no column virtualization for very wide
  tables.
- No caption support.
- No table-level copy behavior.
- Horizontal scrolling has not been browser-tested on narrow/mobile viewports.
- Table accessibility has basic table DOM, but no explicit tests for screen
  reader navigation, header association, or keyboard horizontal scrolling.

### 4. Images

- Only standalone image paragraphs render as real image blocks.
- Inline images inside prose still degrade to text-like chips.
- Image layout reserves a fixed height instead of using intrinsic dimensions or
  aspect-ratio placeholders.
- No retry behavior for failed image loads.
- `blob:` and relative image URLs are allowed but not covered by tests.
- `data:` image URL policy is unresolved.
- SVG policy is unresolved.

### 5. Raw HTML

- Raw HTML is inert, but there is no sanitized HTML subset.
- Unsupported block HTML height is based on code/text fallback, not a deliberate
  HTML fallback design.
- Tests cover scripts, inline event handlers, and unsafe image-like HTML, but
  not forms, iframes, embeds, style tags, SVG HTML, or mixed raw/Markdown edge
  cases.

### 6. Code Fences

- No syntax highlighting.
- No per-line code copy action.
- Long code fences use visible-line materialization, but there is no focused
  huge-code-fence performance test.
- Code fence rendering is intentionally simpler than Code Viewer and does not
  share its tokenizer.

### 7. Markdown Semantics And Accessibility

- Headings use `role="heading"`/`aria-level`, not real `h1`/`h2` DOM.
- Lists are visually marked blocks, not real `ul`/`ol`/`li` structures.
- Blockquotes are visual rails, not real `blockquote` DOM.
- Rules are visual lines, not real `hr` DOM.
- Task list items are visual markers, not readable checkbox controls.
- Virtualized offscreen content means browser accessibility trees and native
  find only see mounted content.
- Focus retention while virtualized content mounts/unmounts is untested.

### 8. Links And Navigation

- Links always open in a new tab; there is no host interception hook.
- Link titles are sanitized in the model but not surfaced consistently for
  inline links.
- Heading slugs and in-document fragment navigation are not implemented.
- Reference-style links may work through `marked`, but we have no explicit
  projection tests for them.
- Autolinks and email autolinks are not explicitly tested.

### 9. Selection, Copy, And Find

- Native text selection across virtualized block boundaries is unverified.
- Copy behavior is undefined: rendered text, original Markdown, or mixed.
- Browser find cannot find unmounted content reliably.
- No application-level find index exists.
- Table copy, link copy, and image alt-copy behavior are undefined.

### 10. Large Document Performance

- Markdown parsing and projection run on the main thread.
- There is no worker boundary for huge Markdown documents.
- Prepared frame data is memoized in React, but there is no shared cache keyed by
  source, width, font scale, and mode.
- There are no hard memory caps for prepared tokens, inline runs, table rows, or
  highlight state.
- Huge single paragraphs, huge nested lists, and huge mixed Markdown files need
  performance fixtures.
- Overscan reduction under memory pressure is not implemented.

### 11. Styling Fidelity

- Typography tokens are local constants, not shared design tokens.
- CSS and Pretext measurement can drift if font family, weight, size, line
  height, or spacing changes outside the model.
- Dark mode has not been visually audited.
- Narrow/mobile layout has not been visually audited.
- Long links, long words, mixed CJK/RTL/emoji text, and combining marks need
  fixtures.

### 12. Error And Fallback States

- Markdown parse failure falls back to plain text, but this is not surfaced to
  users or tests.
- Pretext preparation failure now preserves inline fragments, but fallback
  wrapping is only approximate.
- Rendering errors rely on the outer File Viewer boundary; the Text Viewer
  projection/materialization path has no dedicated error boundary.
- Unsupported constructs can look like ordinary text, which may hide the fact
  that the Markdown was degraded.

### 13. Test Coverage

- Missing dialect fixture matrix.
- Missing source-line mapping tests for nested Markdown and tables.
- Missing huge paragraph, huge list, huge table, and huge code-fence performance
  tests.
- Missing browser tests for selection, copy, find, keyboard navigation, zoom,
  resize, dark mode, and mobile widths.
- Missing visual regression screenshots.
- Missing security fixtures for forms, iframes, embeds, SVG, styles, and
  additional URL protocol edge cases.

## Explicit Non-Goals Unless Reopened

- Full browser CSS layout.
- Arbitrary raw HTML execution.
- Perfect GitHub visual parity.
- Replacing the Code Viewer for logs, JSON, or source code.
