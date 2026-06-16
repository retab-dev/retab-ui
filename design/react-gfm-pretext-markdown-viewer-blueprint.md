# React GFM + Pretext Markdown Viewer Blueprint

## Goal

Build the Markdown viewer we actually need: the best parts of the unified /
`react-markdown` / GFM ecosystem, plus Pretext-grade continuous virtualization.

The user-facing result should feel like one continuous Markdown document, not a
series of pages and not a degraded text renderer. The implementation result
should be boring in the right places: upstream Markdown semantics, a small Retab
document model, Pretext-informed geometry, bounded mounted React, and measured
height correction.

The core sentence:

> Unified parses the whole Markdown document once. Retab derives virtual block
> geometry from that AST. React renders only the visible HAST slices with the
> same component policy as the high-quality Markdown path. Pretext improves
> estimates; it does not become the Markdown parser or renderer.

## Direct Answer To The Architecture Concern

The intended direction was right only at a high level: combine React/GFM
rendering quality with Pretext-style continuous virtualization. The current
implementation does not fully honor that direction yet.

The current Pretext viewer still has a risky middle layer:

- It uses `marked.lexer(markdown, { gfm: true })` in
  `registry/new-york-v4/ui/pretext-markdown-parser.ts` to create top-level
  chunks.
- It reparses chunk-local Markdown through `Markdown` / `MarkdownHooks` in
  `registry/new-york-v4/ui/pretext-markdown-renderer.tsx`.
- It manually injects document-wide reference and footnote definitions into
  chunk-local source strings.
- It estimates height from raw Markdown tokens and string heuristics in
  `registry/new-york-v4/ui/pretext-markdown-layout.ts`.
- It contains growing bespoke behavior around diagrams, raw HTML, hostile
  blocks, footnotes, source mapping, and table patching.

That is why it is buggy. The hard part of Markdown is not painting tags; it is
document-level parsing and transform semantics. Splitting source before unified
has established those semantics forces local code to rediscover tables,
footnotes, definitions, references, task items, escaped pipes, raw HTML,
directive boundaries, and source positions.

So the pushback is: the ambition is not naive, but the current implementation
shape is too bespoke. The right plan is not to keep adding special cases to the
Pretext viewer. The right plan is to move the split point later: parse the full
document with unified first, then virtualize stable AST-derived block slices.

## Non Goals

- Do not build a new Markdown parser.
- Do not ask Pretext to render Markdown.
- Do not virtualize by visible pages.
- Do not keep two separate Markdown semantic stacks for the old Markdown viewer
  and the Pretext viewer.
- Do not execute arbitrary MDX.
- Do not solve diagrams by expanding an ad hoc Mermaid renderer before the AST
  slicing architecture is corrected.
- Do not preserve old compatibility shims once the new model is ready. Make a
  hard cutover and update call sites.

## What Was Inspected

Upstream clones live outside the product source tree at
`/private/tmp/retab-markdown-research`.

Primary upstream files inspected:

- `/private/tmp/retab-markdown-research/react-markdown/lib/index.js`
- `/private/tmp/retab-markdown-research/react-markdown/test.jsx`
- `/private/tmp/retab-markdown-research/remark-gfm/lib/index.js`
- `/private/tmp/retab-markdown-research/micromark-extension-gfm/lib/index.js`
- `/private/tmp/retab-markdown-research/mdast-util-gfm/lib/index.js`
- `/private/tmp/retab-markdown-research/mdast-util-gfm-table/lib/index.js`
- `/private/tmp/retab-markdown-research/mdast-util-gfm-task-list-item/lib/index.js`
- `/private/tmp/retab-markdown-research/mdast-util-gfm-footnote/lib/index.js`
- `/private/tmp/retab-markdown-research/mdast-util-gfm-autolink-literal/lib/index.js`
- `/private/tmp/retab-markdown-research/mdast-util-gfm-strikethrough/lib/index.js`
- `/private/tmp/retab-markdown-research/micromark-extension-gfm-table/dev/lib/syntax.js`
- `/private/tmp/retab-markdown-research/micromark-extension-gfm-task-list-item/dev/lib/syntax.js`
- `/private/tmp/retab-markdown-research/remark-gfm/test/fixtures/**`

Current Retab files inspected:

- `registry/new-york-v4/ui/pretext-markdown-parser.ts`
- `registry/new-york-v4/ui/pretext-markdown-document-model.ts`
- `registry/new-york-v4/ui/pretext-markdown-layout.ts`
- `registry/new-york-v4/ui/pretext-markdown-virtualizer.ts`
- `registry/new-york-v4/ui/pretext-markdown-viewer-content.tsx`
- `registry/new-york-v4/ui/pretext-markdown-renderer.tsx`
- `registry/new-york-v4/ui/pretext-markdown-policy.ts`
- `registry/new-york-v4/ui/markdown-document-viewer.tsx`
- `registry/new-york-v4/ui/markdown-document-model.ts`
- `registry/new-york-v4/ui/markdown-document-renderer.tsx`
- `registry/new-york-v4/ui/markdown-document-renderers.tsx`
- `registry/new-york-v4/ui/markdown-document-plugins.ts`
- `registry/new-york-v4/blocks/parse-viewer-block.tsx`
- `content/docs/components/file-viewer/pretext-markdown-viewer.mdx`
- `design/pretext-markdown-viewer-missing-inventory.md`

Package license check:

- `react-markdown`: MIT
- `remark-gfm`: MIT
- `mdast-util-gfm`: MIT
- `micromark-extension-gfm`: MIT
- GFM subpackages inspected above: MIT

Copying small, relevant pieces is legally plausible with attribution, but the
engineering preference should be:

1. Use the package directly when the boundary fits.
2. Copy or adapt small algorithms only when virtualization/source mapping needs
   a hook the package does not expose.
3. Preserve license notices for non-trivial copied code.
4. Bring upstream fixtures into local tests with attribution rather than
   silently recreating expected behavior.

## Upstream Findings

### `react-markdown` Is A Thin Unified Wrapper

`react-markdown/lib/index.js` has three important responsibilities:

1. Build a unified processor.
2. Run Markdown through that processor.
3. Convert final HAST to JSX with component overrides.

The core processor shape is:

```js
unified()
  .use(remarkParse)
  .use(remarkPlugins)
  .use(remarkRehype, remarkRehypeOptions)
  .use(rehypePlugins)
```

Then `post(...)` walks the HAST tree to:

- replace or drop raw HTML when not parsed by `rehype-raw`,
- apply URL transforms to URL-bearing attributes,
- enforce `allowedElements`, `disallowedElements`, and `allowElement`,
- finally call `hast-util-to-jsx-runtime` with:
  - `components`,
  - `ignoreInvalidStyle: true`,
  - `passKeys: true`,
  - `passNode: true`.

The conclusion is important: `react-markdown` is not where GFM semantics live.
It is the bridge from unified trees to React. We should imitate this division
instead of making Pretext own semantics.

### `MarkdownHooks` Is Async Rendering, Not A Semantics Layer

`MarkdownHooks` memoizes the processor by plugin arrays/options, reparses when
`children` changes, and uses a cancellation flag in `useEffect`.

That makes it useful for chunk rendering with async rehype plugins such as
`rehype-pretty-code`, but it is a poor place to repair document-level semantics.
If each virtual chunk is passed as independent Markdown source, then references,
footnotes, heading slugs, table context, and plugin transforms are already
damaged before rendering begins.

### `remark-gfm` Only Registers Syntax Extensions

`remark-gfm/lib/index.js` pushes three extension families onto processor data:

- `micromarkExtensions.push(gfm(settings))`
- `fromMarkdownExtensions.push(gfmFromMarkdown())`
- `toMarkdownExtensions.push(gfmToMarkdown(settings))`

It does not render GFM. It teaches `remark-parse` how to tokenize GFM and how to
create mdast nodes.

### GFM Is A Bundle Of Lower-Level Behaviors

`micromark-extension-gfm/lib/index.js` combines:

- `gfmAutolinkLiteral()`
- `gfmFootnote()`
- `gfmStrikethrough(options)`
- `gfmTable()`
- `gfmTaskListItem()`

`mdast-util-gfm/lib/index.js` combines matching mdast conversions:

- autolink literal transforms into `link` nodes,
- footnotes into `footnoteReference` and `footnoteDefinition`,
- strikethrough into `delete`,
- tables into `table`, `tableRow`, and `tableCell`,
- task list items into `listItem.checked`.

That gives us stable AST node shapes to use for the Retab block model.

### Tables Are Exactly Where Local Regex Parsing Fails

`micromark-extension-gfm-table/dev/lib/syntax.js` is a full tokenizer and
resolver. It:

- validates header and delimiter row cell counts,
- infers alignment,
- rejects lazy body rows,
- handles escaped pipes,
- injects `table`, `tableHead`, `tableBody`, `tableHeader`, `tableData`, and
  related events,
- patches `_align` onto table events for mdast conversion.

`mdast-util-gfm-table/lib/index.js` then creates:

- `{ type: "table", align, children }`,
- `{ type: "tableRow", children }`,
- `{ type: "tableCell", children }`.

It also explicitly unescapes escaped pipes inside inline code only while
`this.data.inTable` is set.

The lesson: table semantics depend on tokenizer state and resolver state.
Chunking raw Markdown before this work is done is structurally fragile.

### Task Lists Are Not Just A Checkbox Regex

`micromark-extension-gfm-task-list-item` only recognizes `[x]` / `[ ]` when:

- the previous character is EOF,
- the tokenizer is in the first content of a list item,
- the marker is followed by valid whitespace/content.

`mdast-util-gfm-task-list-item` sets `listItem.checked` and removes the marker
from the first paragraph's first text node while adjusting source position.

The local renderer should render `listItem.checked`; it should not rediscover
whether a paragraph begins with `[x]`.

### Footnotes Are Document-Scoped

`mdast-util-gfm-footnote` creates:

- `footnoteReference` nodes with normalized, lowercased identifiers,
- `footnoteDefinition` nodes with children.

`remark-rehype` then produces a footnote section and backrefs. `react-markdown`
tests show the generated HAST includes `section[data-footnotes]`,
`id="user-content-fn-..."`, and backrefs.

This is a direct warning against chunk-local parsing. A chunk containing a
reference may need a definition elsewhere. A chunk containing a definition may
render nothing in-place because the footnote section belongs to document output.

### Autolinks Are A Transform, Not A Link Renderer

`mdast-util-gfm-autolink-literal` uses `mdast-util-find-and-replace` after
parsing. It:

- ignores existing `link` and `linkReference` nodes,
- recognizes `http://`, `https://`, and `www.`,
- recognizes emails,
- validates previous character context,
- validates domain shape,
- trims trailing punctuation while balancing parentheses,
- creates mdast `link` nodes.

Therefore source slicing after parsing is fine; source slicing before parsing
can change what is recognized.

### Strikethrough Has Construct Exclusions

`mdast-util-gfm-strikethrough` creates mdast `delete` nodes and avoids unsafe
serialization inside constructs where strikethrough cannot apply. Again, the
semantic node already exists after unified parse.

### Upstream Tests Are The Compatibility Baseline

`react-markdown/test.jsx` covers:

- basic CommonMark nodes,
- GFM delete/table/footnote behavior,
- safe URL transform behavior,
- `rehype-raw`,
- allowed/disallowed element filtering,
- component override contracts,
- source positions passed through `node`.

`remark-gfm/test/fixtures` covers:

- autolink literals,
- default strikethrough,
- `singleTilde: false`,
- tables,
- table alignment/no alignment,
- table padding options,
- table string width,
- task lists.

These should become local regression fixtures for the Pretext viewer adapter.

## Current Retab Diagnosis

### What The Old Parse Viewer Does Well

The route at `http://localhost:3100/docs/components/parse-viewer` uses
`ParseViewerMarkdown`, which relies on the existing `MarkdownDocumentViewer`
style architecture.

The existing Markdown viewer path:

- creates virtual chunks in `markdown-document-model.ts`,
- renders each chunk with `MarkdownHooks` in
  `markdown-document-renderer.tsx`,
- uses shared plugin arrays from `markdown-document-plugins.ts`,
- uses component overrides from `markdown-document-renderers.tsx`.

This path is visually better because final visible content is still rendered by
the unified / React Markdown stack. It is not perfect because it is page-shaped
and still uses `marked` for chunking, but its renderer boundary is sane.

### What The Pretext Viewer Does Right

The Pretext viewer already has some good pieces:

- separate content component,
- separate document model,
- separate layout module,
- separate virtualizer,
- pixel overscan,
- measured height feedback,
- rendered/source mode,
- scroll anchors across measurement changes,
- source-line lookup,
- dedicated URL/sanitize/policy files.

Those boundaries are worth preserving.

### What The Pretext Viewer Gets Wrong

The wrong part is the semantic split point.

Current flow:

```text
markdown string
  -> marked lexer tokens
  -> Retab chunks from raw token strings
  -> chunk-local Markdown source strings
  -> per-chunk react-markdown parse/render
  -> manual fixes for document-wide semantics
```

Target flow:

```text
markdown string
  -> unified full-document mdast
  -> full-document transforms
  -> full-document hast
  -> Retab blocks/chunks from AST source positions
  -> visible HAST block slices
  -> JSX via react-markdown-compatible component map
```

The current flow makes chunk boundaries visible to Markdown semantics. The
target flow makes chunk boundaries visible only to virtualization.

### Documentation Drift

`content/docs/components/file-viewer/pretext-markdown-viewer.mdx` currently
claims a very broad feature set. Some of that is implemented, some is partial,
and some depends on fragile local workarounds. Treat that page as product
aspiration until the architecture below is implemented and verified.

`design/pretext-markdown-viewer-missing-inventory.md` is useful as a gap list,
but it is not the rebuild architecture.

## Target Architecture

### Ownership

Markdown semantics belong to unified:

- CommonMark parsing,
- GFM parsing,
- math parsing,
- directives,
- raw HTML parse integration,
- mdast-to-hast conversion,
- footnote generation,
- code highlighting transforms,
- sanitization transforms.

Retab owns:

- source resource loading,
- document/block/chunk metadata,
- source-line and source-offset mapping,
- heading registry policy where we intentionally override upstream,
- continuous geometry,
- virtual windowing,
- scroll anchors,
- rich block measurement policy,
- viewer controls,
- component styling and interactions,
- security policy composition.

Pretext owns:

- line measurement primitives,
- width-sensitive text estimates,
- fast geometry hints for prose/code-like blocks.

React owns:

- rendering mounted HAST slices to JSX,
- component state for visible rich blocks,
- post-render measurement callbacks.

### Proposed Pipeline

```text
ViewerResource
  -> bounded Markdown string
  -> createPretextMarkdownUnifiedDocument(markdown)
      -> create processor
      -> parse full mdast
      -> run remark transforms
      -> convert to full hast
      -> run rehype transforms/sanitize
      -> collect document metadata
      -> derive block records from AST positions
      -> derive chunk records from block records
  -> layoutPretextMarkdownDocument(document, width, scale, measurements)
  -> getPretextMarkdownVisibleChunkFrames(...)
  -> render visible chunks from HAST slices
  -> measure mounted chunks
  -> anchor-preserving geometry update
```

### Key Invariant

A virtual chunk is a render transport, not a Markdown document.

No code should treat `chunk.markdown` as a complete Markdown document once the
new architecture lands. If a chunk needs source text, it can keep `sourceText`
for copy/source mode, but rendered mode must use AST/HAST slices derived from
the full document.

## Proposed Modules

### `pretext-markdown-unified-pipeline.ts`

Responsibilities:

- create the unified processor,
- expose a single parse/transform entry point,
- centralize remark and rehype plugin order,
- return mdast, hast, VFile messages, and derived metadata,
- keep plugin arrays stable and typed.

Exports:

- `createPretextMarkdownProcessor(options)`
- `parsePretextMarkdownDocument(markdown, options)`
- `PRETEXT_MARKDOWN_REMARK_PLUGINS`
- `PRETEXT_MARKDOWN_REHYPE_PLUGINS`

Rules:

- Do not import React.
- Do not import virtualizer/layout modules.
- Do not split Markdown source.
- Do not hide plugin errors unless the caller explicitly requests a recoverable
  fallback.

Initial plugin order should be close to the existing policy:

```text
remark-parse
remark-directive
Retab heading id injection or heading id collection
Retab code meta preservation
Retab internal metadata stripping
Retab restricted components
Retab definition list transform
remark-smartypants
Retab callouts / GitHub alerts
remark-gemoji
remark-gfm
remark-breaks
remark-math
remark-rehype allowDangerousHtml=true
rehype-raw
Retab input policy
Retab code meta bridge
rehype-sanitize with Retab schema
rehype-katex
rehype-pretty-code
```

We should audit whether `remark-gfm` should run earlier than some Retab prose
transforms. Any transform that expects stable mdast GFM node types must run
after GFM. Any transform that changes raw Markdown-ish text before GFM must be
justified by tests.

### `pretext-markdown-ast-types.ts`

Responsibilities:

- define narrow local types for mdast/hast nodes we inspect,
- avoid `any` leakage in document-model code,
- document which upstream node shapes we rely on.

Key node shapes:

- `heading`
- `paragraph`
- `list`
- `listItem`
- `blockquote`
- `code`
- `html`
- `thematicBreak`
- `table`
- `tableRow`
- `tableCell`
- `footnoteDefinition`
- `footnoteReference`
- `delete`
- HAST `element`, `text`, `root`, `raw`.

### `pretext-markdown-position-map.ts`

Responsibilities:

- convert unist positions into source offsets and 1-based source lines,
- repair missing offsets where possible from line/column,
- expose intersection helpers,
- own source-line offset arrays.

Exports:

- `createPretextMarkdownSourceMap(markdown)`
- `sourceRangeFromPosition(position, sourceMap)`
- `sourceTextForRange(markdown, range)`
- `lineRangeForOffsetRange(range, sourceMap)`
- `rangesIntersect(a, b)`

Rules:

- Source offsets are half-open: `[start, end)`.
- Source lines are inclusive and 1-based.
- Missing position is explicit: `sourceRange: null`, not guessed silently.
- Generated nodes keep a link to their closest source ancestor where possible.

### `pretext-markdown-block-model.ts`

Responsibilities:

- derive top-level render blocks from full mdast/hast,
- keep document-scoped definitions/footnotes out of chunk-local hacks,
- preserve enough metadata for layout and interactions,
- create stable block IDs.

Block record:

```ts
type PretextMarkdownBlock = {
  id: string
  index: number
  kind: PretextMarkdownBlockKind
  mdastNodeId: string | null
  hastNodeIds: string[]
  sourceRange: PretextMarkdownSourceRange | null
  sourceText: string
  headingId?: string
  headingText?: string
  isGenerated: boolean
  isRenderable: boolean
  isHostile: boolean
  layoutPolicy: PretextMarkdownLayoutPolicy
}
```

Block kinds:

- `frontmatter`
- `heading`
- `paragraph`
- `blockquote`
- `list`
- `table`
- `code`
- `math`
- `html`
- `thematicBreak`
- `definition`
- `footnotes`
- `component`
- `diagram`
- `image`
- `unknown`

Rules:

- Top-level mdast flow nodes are the primary block boundary.
- HAST nodes generated from one mdast block should remain attached to that
  block.
- Generated footnote sections are document-level generated blocks.
- Reference definitions and footnote definitions are semantic metadata; they
  are not arbitrary visible blocks unless rendered by the unified pipeline.
- Unknown nodes become explicit fallback blocks.

### `pretext-markdown-hast-index.ts`

Responsibilities:

- assign stable internal IDs to HAST nodes,
- map HAST nodes back to source ranges,
- map generated HAST nodes to mdast/source owners when possible,
- support efficient slice creation for visible chunks.

Exports:

- `indexPretextMarkdownHast(root, mdastIndex)`
- `getHastNodeById(id)`
- `getHastNodesForBlock(blockId)`
- `cloneHastSliceForChunk(chunk)`

Rules:

- Never mutate the canonical full-document HAST while rendering a chunk.
- Chunk slices must be cloned or structurally shared immutably.
- IDs used for React keys are internal and separate from DOM `id`.

### `pretext-markdown-chunker.ts`

Responsibilities:

- group AST-derived blocks into virtual chunks,
- keep headings with following content where appropriate,
- isolate hostile/rich/oversized blocks,
- create source ranges and render node references for each chunk.

Chunk record:

```ts
type PretextMarkdownChunk = {
  id: string
  index: number
  blockIds: string[]
  hastNodeIds: string[]
  sourceRange: PretextMarkdownSourceRange | null
  sourceText: string
  estimatedComplexity: number
  isHostile: boolean
}
```

Rules:

- Chunking is based on block records and estimated layout cost, not raw token
  count alone.
- Chunks cannot split an atomic rich block in phase one.
- Later large table/code virtualization can split inside rich blocks through
  specialized renderers, not by pretending partial Markdown is a document.

### `pretext-markdown-layout.ts`

Keep the module, but change its input from raw-markdown-ish blocks to
AST-derived block records.

Responsibilities:

- estimate chunk heights from block layout policies,
- use Pretext for prose/code-like text metrics,
- use deterministic reserved heights for rich blocks,
- accept measured heights,
- preserve scroll anchors when measurements arrive.

Layout policy:

```ts
type PretextMarkdownLayoutPolicy =
  | { kind: "hidden" }
  | { kind: "text"; font: "body" | "mono"; lineHeight: number; chromePx: number }
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { kind: "code"; language: string | null; lineCount: number }
  | { kind: "table"; rowCount: number; columnCount: number }
  | { kind: "image"; hasKnownSize: boolean; aspectRatio?: number }
  | { kind: "diagram"; diagramKind: string | null; sourceLineCount: number }
  | { kind: "math"; display: boolean; sourceLineCount: number }
  | { kind: "measure"; minHeight: number; maxInitialHeight?: number }
```

Rules:

- Estimates should be good enough to avoid visible scroll jumps.
- DOM measurement is allowed only as correction, not primary layout.
- Measurements are growth/shrink corrections tied to chunk identity and width.
- Rich block async completion must trigger a measurement pass without resetting
  scroll.

### `pretext-markdown-render-projection.tsx`

Responsibilities:

- render a HAST root/slice to JSX using the same contract as `react-markdown`,
- share component overrides with existing Markdown rendering where possible,
- apply URL transforms and allowed-element policy if not already applied in
  the processor,
- expose `onContentReady` and measurement hooks.

Implementation options:

1. Preferred: use `hast-util-to-jsx-runtime` directly, mirroring
   `react-markdown`'s `post(...)` function.
2. Acceptable transition: feed chunk source into `MarkdownHooks` only for
   chunks that are known not to depend on document-level semantics.
3. Not acceptable as final: all chunks reparsed from raw source strings.

Direct use of `hast-util-to-jsx-runtime` may require adding it to direct
dependencies if it is currently only transitive through `react-markdown`.

### `pretext-markdown-renderers.tsx`

Responsibilities:

- own React component overrides for rendered Markdown,
- style headings, paragraphs, lists, tables, code, images, diagrams, math,
  footnotes, raw HTML inline nodes, and restricted components,
- expose source-line markers from AST/HAST node positions,
- expose copy controls.

Rules:

- Component renderers cannot know about virtualizer math.
- Component renderers can call `onRichBlockReady` / `onMeasureNeeded`.
- Component renderers should consume source metadata from `node`, not recalculate
  from chunk-local Markdown.

### `pretext-markdown-policy.ts`

Keep as the policy home, but narrow it.

Responsibilities:

- URL policy,
- sanitizer schema,
- allowed raw HTML policy,
- restricted component policy,
- directive/callout policy,
- heading ID/clobber policy,
- Mermaid security policy,
- KaTeX trust/bounds policy.

Rules:

- Policy can define transforms.
- Policy should not do layout.
- Policy should not do virtualization.
- Policy should not rewrite source merely to make chunk-local parsing work.

## Source Mapping Design

Source mapping is the central reason not to simply render the whole document
offscreen.

The model needs three coordinate systems:

1. Source text:
   - absolute offset,
   - source line,
   - source column.
2. AST:
   - mdast node IDs,
   - HAST node IDs,
   - unist positions.
3. Virtual geometry:
   - block index,
   - chunk index,
   - estimated top/bottom,
   - measured top/bottom.

Required mappings:

- source offset -> block,
- source line -> block,
- block -> source range,
- block -> HAST node IDs,
- HAST node -> source range,
- heading ID -> block/chunk/frame,
- fragment ID -> scroll target,
- visible frame -> source line for rendered/source mode switching.

Rules:

- Top-level source-line scroll can be approximate inside a large variable-height
  block in phase one.
- Heading and fragment navigation must be exact enough to land the target block
  in view.
- Highlighting can start at chunk/block granularity, then improve to nested
  node granularity.
- Generated nodes such as footnote sections must have synthetic source mapping
  back to their definitions/references.

## Continuous Virtualization Contract

The viewer should behave as one document.

Required behavior:

- no visible page chrome,
- no page labels,
- no page gutters,
- no chunk borders unless the Markdown element itself has a border,
- stable scroll while measurements arrive,
- bounded mounted DOM for large files,
- source mode and rendered mode preserve position by source line/block anchor,
- fragment navigation works for offscreen headings,
- footnote ref/backref navigation works across offscreen chunks,
- images/diagrams/math/code highlighting can resolve asynchronously without
  collapsing or teleporting the viewport.

Virtualizer invariants:

- Input is `PretextMarkdownChunkFrame[]`.
- It does not import React.
- It does not inspect Markdown.
- It uses binary search for visible ranges.
- Overscan is pixel-based.
- Measurements are keyed by document ID, chunk ID, width, scale, and policy
  version.
- Anchor restore uses chunk/block identity and offset within frame.

## Rich Block Strategy

### Tables

Phase one:

- Use upstream GFM mdast table nodes.
- Render table HAST through shared components.
- Use row/column counts for estimated height.
- Keep table atomic at chunk level.
- Preserve horizontal scroll region.
- Patch table accessibility after render or, preferably, generate accessible
  props in renderer from HAST.

Later:

- Add internal row virtualization for huge tables.
- Add deterministic column sizing based on text metrics.
- Decide header stickiness.

### Code Blocks

Phase one:

- Keep `rehype-pretty-code`.
- Extract language/title/caption/line-number metadata from HAST properties.
- Estimate from line count and chrome.
- Keep block atomic unless hostile.

Later:

- Add line virtualization for very large fences.
- Use Shiki/Pretty Code output only for visible line ranges if feasible.

### Footnotes

Phase one:

- Stop injecting footnote definitions into chunk Markdown.
- Let full-document unified output generate footnote section.
- Treat the generated footnote section as a generated block near document end.
- Map footnote refs/backrefs by generated DOM IDs.

Acceptance:

- reference in chunk 1 can resolve definition in chunk 50,
- definition in chunk 1 can render footnote section at document end,
- backref scrolls to the reference even when offscreen.

### Reference Links And Images

Phase one:

- Stop injecting reference definitions into chunk Markdown.
- Let full-document unified resolve references.
- Render resolved HAST links/images in visible slices.

Acceptance:

- reference definition outside visible window still resolves,
- duplicate definitions follow upstream behavior,
- prototype-polluting identifiers follow upstream behavior.

### Diagrams

Phase one:

- Treat Mermaid fences as code-derived rich blocks.
- Preserve source in metadata.
- Reserve deterministic height.
- Render through the existing Mermaid component only after the AST slicing
  architecture is in place.
- Keep failure/source fallback.

Pushback:

- Diagrams are a symptom amplifier, not the root architecture. Do not spend the
  next iteration adding more hand-drawn Mermaid fallback grammars until chunking
  no longer corrupts Markdown semantics.

### Images

Phase one:

- Render sanitized HAST images through the existing safe image component.
- Estimate a conservative aspect-ratio placeholder before decode.
- Remeasure after load/error.

Later:

- Use source metadata when available.
- Cache decoded dimensions by URL.

### Math

Phase one:

- Use `remark-math` and `rehype-katex`.
- Keep KaTeX settings untrusted and bounded.
- Treat display math as rich measured block.

### Raw HTML

Phase one:

- Keep `rehype-raw` before sanitize.
- Keep Retab sanitizer schema.
- Prefix user-authored IDs/names where needed.
- Represent sanitized HAST elements directly, not as raw source chunks.

Acceptance:

- static safe HTML renders,
- scripts/styles/SVG active surfaces do not,
- raw HTML links follow URL policy,
- raw HTML does not get to inject internal `data-pretext-*` metadata.

## Implementation Plan

### Phase 0: Freeze Reality

Purpose: make the current behavior and desired parity visible before changing
architecture.

Tasks:

1. Add a fixture set that includes:
   - headings with duplicate IDs,
   - reference links with definitions far away,
   - footnotes with definitions far away,
   - GFM table with alignment and escaped pipes,
   - task lists,
   - autolink literals,
   - strikethrough,
   - raw HTML,
   - Mermaid fence,
   - code block with metadata,
   - long paragraph,
   - huge table/code hostile examples.
2. Add renderer parity tests comparing:
   - existing `MarkdownDocumentViewer` component output where practical,
   - unified full-document HAST output,
   - new Pretext projection output.
3. Copy upstream `remark-gfm` fixtures into a local test fixture folder with
   attribution.
4. Add browser smoke cases for:
   - desktop,
   - mobile width,
   - dark mode,
   - long scroll,
   - direct hash load,
   - footnote ref/backref,
   - table horizontal overflow,
   - Mermaid async settling.

Acceptance:

- We can reproduce at least one current Pretext viewer failure from chunk-local
  parsing.
- We have a fixture that proves full-document unified parse handles it.

### Phase 1: Build The Unified Document Adapter

Purpose: parse the full Markdown document once and expose the result without
yet replacing rendering.

Tasks:

1. Add `pretext-markdown-unified-pipeline.ts`.
2. Move plugin arrays from `pretext-markdown-policy.ts` into the pipeline or
   re-export them cleanly.
3. Add a parser entry:

   ```ts
   createPretextMarkdownUnifiedDocument(markdown: string): {
     mdast: Root
     hast: Root
     messages: VFileMessage[]
     sourceMap: PretextMarkdownSourceMap
   }
   ```

4. Add debug/test utilities to print block node summaries:
   - type,
   - source start/end,
   - generated/rendered status.
5. Test against upstream GFM fixtures.

Acceptance:

- One full-document parse produces mdast and HAST with GFM nodes.
- Footnotes and reference links resolve without prefix injection.
- Tests prove table/task/autolink/delete/footnote node shapes.

### Phase 2: Replace The `marked` Semantic Model

Purpose: stop using `marked` as the source of truth for Pretext blocks.

Tasks:

1. Add `pretext-markdown-block-model.ts`.
2. Derive blocks from full-document mdast flow nodes.
3. Attach HAST node IDs to blocks.
4. Preserve current public document model fields where the viewer still needs
   them:
   - `blocks`,
   - `chunks`,
   - `headings`,
   - `sourceLineCount`,
   - `wordCount`,
   - `text`.
5. Remove `parsePretextMarkdownTokens` from the main document path.
6. Keep frontmatter support either:
   - via a unified frontmatter plugin, or
   - as a pre-parse block with explicit source range, but not through `marked`.

Acceptance:

- `createPretextMarkdownDocument` no longer depends on `marked`.
- Heading IDs come from one model path.
- Reference/footnote definition collection by regex is gone or only retained
  for source-mode metadata, not rendering semantics.

### Phase 3: Render Visible HAST Slices

Purpose: stop reparsing chunk-local Markdown for rendered mode.

Tasks:

1. Add HAST indexing and slice cloning.
2. Add `PretextMarkdownHastChunkRenderer`.
3. Implement `hast-util-to-jsx-runtime` projection mirroring
   `react-markdown`'s `post(...)`:
   - component overrides,
   - `passNode`,
   - stable keys,
   - URL policy,
   - element allow/disallow policy if needed.
4. Keep old `PretextMarkdownChunkRenderer` behind a temporary internal flag
   only during transition.
5. Render basic block slices:
   - heading,
   - paragraph,
   - blockquote,
   - list,
   - thematic break,
   - code,
   - table.

Acceptance:

- Basic GFM fixture chunks render from HAST without calling
  `MarkdownHooks` per chunk.
- `referenceDefinitionsMarkdown` and `footnoteDefinitionsMarkdown` props are
  removed from rendered chunk flow.
- Component overrides still receive `node`.

### Phase 4: Source Mapping And Navigation

Purpose: preserve the viewer APIs that need source line addressing.

Tasks:

1. Implement source offset/line maps from unist positions.
2. Implement source-line to block/chunk lookup.
3. Implement heading ID to block/chunk lookup.
4. Implement fragment click interception against the model.
5. Implement footnote ref/backref lookup.
6. Implement rendered/source mode anchor conversion using:
   - exact heading/block if possible,
   - line-ratio fallback inside large blocks.

Acceptance:

- `scrollToLineRange` works before and after measurements.
- Direct hash loads work when the heading is initially offscreen.
- Back/forward fragment navigation restores targets.
- Footnote backrefs can target offscreen references.

### Phase 5: Layout Rebuild Around AST Blocks

Purpose: make Pretext improve geometry without contaminating semantics.

Tasks:

1. Replace raw-token height rules with block layout policies.
2. Use Pretext measurement for:
   - paragraphs,
   - headings,
   - list text,
   - blockquote text,
   - code text where non-highlighted estimate is enough.
3. Use deterministic reserves for:
   - tables,
   - images,
   - diagrams,
   - math,
   - component fallbacks.
4. Keep measurement feedback by chunk ID.
5. Preserve anchor on:
   - width change,
   - font ready,
   - image load,
   - Mermaid ready/error,
   - Pretty Code async completion.

Acceptance:

- Long documents do not jump materially while scrolling.
- Mounted chunk count stays bounded.
- Width changes do not reset position.

### Phase 6: Component Policy Consolidation

Purpose: eliminate duplicate old/new Markdown component styling where possible.

Tasks:

1. Compare:
   - `markdown-document-renderers.tsx`,
   - `pretext-markdown-renderer.tsx`.
2. Extract shared Markdown component primitives where they are genuinely shared:
   - links,
   - images,
   - tables,
   - code blocks,
   - headings,
   - callouts,
   - footnotes.
3. Keep Pretext-specific wrappers only for:
   - source mapping markers,
   - measurement callbacks,
   - continuous viewer styling.
4. Delete duplicated behavior when the shared primitive is ready.

Acceptance:

- The Pretext viewer visually matches or improves on parse-viewer Markdown.
- Link, image, code, table, and footnote policies are not duplicated in
  incompatible forms.

### Phase 7: Rich Block Hardening

Purpose: bring high-risk blocks to production quality after semantics are
stable.

Tasks:

1. Tables:
   - alignment,
   - inline cell Markdown,
   - captions if allowed through raw HTML,
   - accessibility,
   - TSV copy.
2. Code:
   - language normalization,
   - title/caption,
   - line numbers,
   - highlighted lines/chars,
   - diff lines,
   - copy controls.
3. Diagrams:
   - Mermaid package render,
   - deterministic placeholder,
   - sanitized SVG,
   - source/error fallback,
   - copy source/SVG.
4. Images/video:
   - URL policy,
   - loading/ready/failed,
   - aspect-ratio stabilization.
5. Math:
   - inline/block styling,
   - overflow region,
   - sanitizer compatibility.

Acceptance:

- Rich blocks can settle asynchronously without corrupting scroll.
- Browser smoke covers each rich block class.

### Phase 8: Performance And Hostility

Purpose: keep large documents fast without corrupting semantics.

Tasks:

1. Add large benchmarks:
   - 1 MB prose,
   - huge table,
   - huge code fence,
   - many headings,
   - many footnotes.
2. Define hostile thresholds by AST shape:
   - line count,
   - child count,
   - table rows/cells,
   - code length,
   - raw HTML size,
   - nesting depth.
3. Render hostile blocks through bounded source previews initially.
4. Later add internal virtualization for:
   - huge code fences,
   - huge tables.
5. Cache parse and layout products by stable document key.

Acceptance:

- No full-document React mount for large Markdown.
- No browser lock on pathological tables/code.
- Hostile fallback is explicit and copyable.

### Phase 9: Cutover

Purpose: replace the current Pretext viewer internals and then retire the old
Markdown path where appropriate.

Tasks:

1. Make the HAST-slice renderer the only rendered path.
2. Remove chunk-local Markdown rendering.
3. Remove `marked` from Pretext Markdown semantics.
4. Update docs to describe actual behavior.
5. Keep old `MarkdownDocumentViewer` only for routes that still require
   page-shaped rendering.
6. Once File Viewer and Parse Viewer have equivalent coverage, migrate callers.
7. Delete compatibility code after product callers move.

Acceptance:

- `PretextMarkdownViewer` is the File Viewer Markdown route.
- The parse-viewer Markdown pane can either stay page-scoped intentionally or
  share the unified rendering primitives.
- Docs stop claiming behavior that is not tested.

## Test Plan

### Unit Tests

Pipeline:

- full-document parse returns mdast/hast,
- plugin order is stable,
- GFM nodes exist for upstream fixtures,
- unsafe raw HTML is sanitized,
- URL policy applies to HAST URL attributes.

Block model:

- source positions map to source lines/offsets,
- headings generate stable IDs,
- duplicate headings suffix correctly,
- table block contains table HAST,
- footnote section is generated block,
- reference definitions do not render as arbitrary prose,
- missing positions are explicit.

Chunker:

- chunks stay under target estimated height,
- headings stay with next block when possible,
- rich/hostile blocks isolate,
- source ranges cover included blocks,
- chunks do not split atomic tables/code/diagrams in phase one.

Layout:

- paragraph estimates change with width,
- heading estimates include level spacing,
- code estimates include line count and chrome,
- table estimates include row/column count,
- measured heights override estimates,
- anchor restore works after measurement changes.

Virtualizer:

- binary search returns correct visible range,
- overscan is pixel-based,
- frame anchors resolve after height changes,
- source-line lookup uses chunk/frame mapping,
- empty documents behave.

Renderer:

- HAST slice renders headings/paragraphs/lists/tables/code,
- component overrides receive `node`,
- source-line data attributes are attached,
- links use target/rel policy,
- images use safe image component,
- footnote refs/backrefs render and navigate.

### Fixture Tests

Copy or mirror upstream fixtures with attribution:

- `remark-gfm/test/fixtures/autolink-literal`
- `remark-gfm/test/fixtures/strikethrough-default`
- `remark-gfm/test/fixtures/strikethrough-not-one`
- `remark-gfm/test/fixtures/table`
- `remark-gfm/test/fixtures/table-no-align`
- `remark-gfm/test/fixtures/table-no-padding`
- `remark-gfm/test/fixtures/table-string-length`
- `remark-gfm/test/fixtures/tasklist`

Add Retab fixtures:

- reference definition in another virtual chunk,
- footnote definition in another virtual chunk,
- duplicate headings with Unicode and DOM-clobber names,
- raw HTML with safe and unsafe tags,
- code metadata,
- Mermaid fence,
- huge table,
- huge code fence,
- malformed Markdown recovery.

### Browser Tests

Desktop:

- route loads,
- rendered mode shows continuous document,
- no page chrome,
- no horizontal document overflow,
- tables/code scroll horizontally inside their own regions,
- mounted chunks are bounded.

Mobile:

- text wraps,
- controls fit,
- tables/code do not widen page,
- headings and copy buttons do not overlap.

Dark mode:

- prose, table, code, callout, footnote, and diagram colors are legible.

Navigation:

- direct hash load,
- local heading click,
- browser back/forward,
- footnote ref/backref,
- `scrollToLineRange`.

Async stability:

- image load,
- image failure,
- Mermaid ready,
- Mermaid error,
- Pretty Code completion,
- font ready.

Performance:

- long continuous scroll,
- large document initial parse time,
- memory ceiling,
- mounted DOM count,
- resize behavior.

## Acceptance Criteria

The rebuild is complete when:

- Pretext Markdown rendered mode no longer reparses chunk-local Markdown.
- `marked` is not the Pretext Markdown semantic source of truth.
- Full-document unified parse owns GFM semantics.
- Reference links/images resolve across virtual chunk boundaries.
- Footnotes resolve across virtual chunk boundaries and render as a
  document-level generated section.
- Tables render from upstream GFM AST/HAST, not local table heuristics.
- Task list checkboxes render from `listItem.checked`.
- Autolinks render from generated link nodes.
- Strikethrough renders from `delete` nodes.
- Raw HTML is parsed/sanitized once in the unified pipeline.
- Component overrides are shared or intentionally aligned with the existing
  high-quality Markdown viewer.
- Pretext is used for geometry estimates only.
- Virtualization is continuous, pixel-overscanned, and bounded.
- Scroll anchors survive measurements, width changes, font readiness, and async
  rich block settling.
- Browser screenshots show a polished document, not a buggy source-ish
  renderer.
- Docs describe tested behavior only.

## First Concrete Implementation Cut

Do this first:

1. Add `pretext-markdown-unified-pipeline.ts`.
2. Parse the full document through the same remark/rehype policy.
3. Build a block summary from mdast top-level flow nodes.
4. Build a HAST slice renderer for only:
   - heading,
   - paragraph,
   - list,
   - blockquote,
   - code,
   - table,
   - thematic break.
5. Add tests proving reference links and footnotes work when source definitions
   live outside the visible chunk.

This cut will prove or disprove the architecture quickly. If it works, the rest
of the work is hard but straightforward. If it does not, the failure will be at
the right boundary: AST/HAST slicing, not Markdown reimplementation.

## Final Recommendation

Stop adding feature-specific patches to the current Pretext renderer until the
full-document unified adapter exists. In particular, pause Mermaid fallback
expansion except for crash containment. The diagram pain is real, but it is
being made worse by the current chunk-local rendering architecture.

The implementation should copy upstream code only where necessary. The bigger
win is to copy upstream architecture:

- parser extensions create AST semantics,
- transforms operate on full trees,
- HAST renders through component overrides,
- Retab virtualizes renderable tree slices.

That is the path to a viewer that looks like the existing React/GFM path, scrolls
like the Pretext path, and does not accumulate a private Markdown engine.
