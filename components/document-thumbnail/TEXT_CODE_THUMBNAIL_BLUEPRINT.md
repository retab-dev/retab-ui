# Text And Code Thumbnail Blueprint

This blueprint defines the final shape for text-like thumbnails after the
viewer split.

Text and code are different thumbnail surfaces. Text wraps. Code preserves
lines. JSON is code.

## Standard

The ideal thumbnail implementation is:

- Simple: one text thumbnail, one code thumbnail, one shared bounded text fetcher.
- Fast: read only the thumbnail prefix, render only static preview DOM, never load full viewers.
- Complete: empty, loading, stale async, retry, prose, code, and JSON behavior are covered.
- Minimal: no smart mixed renderer, no thumbnail virtualization, no Pretext dependency, no syntax engine.
- Modular: routing chooses text or code before rendering; each thumbnail renders exactly one concept.
- Exact: names match behavior.

## Components

```txt
components/document-thumbnail/renderers/text-thumbnail.tsx
  TextThumbnail
  wrapped prose preview
  no line numbers
  sans font

components/document-thumbnail/renderers/code-thumbnail.tsx
  CodeThumbnail
  dense code preview
  visible line numbers
  monospace font
  JSON pretty printing

components/document-thumbnail/thumbnail-text.ts
  shared bounded text prefix loading
```

`TextThumbnail` and `CodeThumbnail` may share `getThumbnailText`. They should
not share rendering decisions.

## Routing

The renderer registry, descriptor, or caller decides whether a resource is text
or code. `TextThumbnail` must not contain a code/prose classifier.

Canonical routing:

- `text` -> `TextThumbnail`
- code-like categories or explicit code routes -> `CodeThumbnail`
- `json`, `jsonl`, and `ndjson` -> `CodeThumbnail`
- `markdown` -> `MarkdownFirstPage`, unless the product intentionally routes it to prose text later

JSON is code. Logs are code when routed as code.

## Text Thumbnail

`TextThumbnail` renders prose only.

Rules:

- Normalize CRLF to LF.
- Trim outer whitespace.
- Split paragraphs on blank lines.
- Collapse single newlines inside paragraphs.
- Wrap naturally.
- Use sans typography.
- Render no line numbers.
- Render no gutter.
- Render an intentional empty state for empty content.

It should feel like a miniature page, not a miniature editor.

## Code Thumbnail

`CodeThumbnail` renders code only.

Rules:

- Preserve lines and whitespace.
- Use monospace typography.
- Show visible line numbers.
- Cap rendered lines with a private named constant.
- Pretty-print strict JSON when possible.
- Treat invalid JSON as raw code text.
- Treat JSONL and NDJSON as line-oriented code, not strict single-document JSON.

It should feel like a compact editor preview, not a prose page.

## Non-Goals

- No virtualization.
- No Pretext.
- No full `TextViewer` or `CodeViewer` dependency.
- No syntax highlighting unless a cheap shared primitive already exists.
- No automatic prose/code inference inside `TextThumbnail`.
- No compatibility wrapper named `TextFirstLines`.

## Required Rename

Replace the mixed boundary:

```txt
TextFirstLines
```

with exact exports:

```txt
TextThumbnail
CodeThumbnail
```

Update imports and tests at the same time. Do not keep aliases.

## Tests

Required tests:

- `.txt` text route renders `TextThumbnail`.
- `TextThumbnail` has no visible line numbers.
- `TextThumbnail` renders an empty state for empty content.
- `TextThumbnail` normalizes CRLF prose.
- code route renders `CodeThumbnail`.
- `CodeThumbnail` has visible line numbers.
- `CodeThumbnail` preserves whitespace.
- strict JSON is pretty-printed by `CodeThumbnail`.
- invalid JSON remains raw code text.
- JSONL and NDJSON render as line-oriented code.
- stale async responses do not replace the current thumbnail.
- unmounted async responses do not report errors.

## Acceptance Criteria

The work is complete when:

- There are two thumbnail renderers, not one mixed renderer.
- Text thumbnails never show line numbers.
- Code thumbnails always show line numbers.
- JSON routes to code.
- Both thumbnails use the shared bounded text loader.
- No thumbnail imports full viewer components.
- No thumbnail imports Pretext or virtualization code.
- The old `TextFirstLines` name is gone.
- Tests describe the text/code contract directly.
