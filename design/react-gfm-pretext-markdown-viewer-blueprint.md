# React GFM + Pretext Markdown Viewer Blueprint

## Purpose

Build the Markdown viewer that combines the two things we actually want:

- React/GFM rendering quality for real Markdown documents.
- Chenglou-style Pretext geometry and custom virtualization for speed.

The mistake to avoid is treating Markdown as code. Markdown is prose and
document structure. It should wrap naturally, render tables and lists like a
document, and still stay fast on large files.

The second mistake to avoid is asking Pretext to become the whole Markdown
renderer. Pretext should provide layout intelligence and stable geometry.
React Markdown should render the mounted document content.

## Target

The target viewer should be:

- simple: one parsing pipeline, one render pipeline, one virtualizer
- fast: bounded mounted content, no full-document React render
- complete: GFM, math, callouts, footnotes, code, tables, safe HTML
- modular: parser, layout, virtualization, rendering, and policy separated
- exact: consistent naming, explicit invariants, no compatibility shims

## Architecture

```text
markdown source
  -> markdown document model
  -> semantic blocks with source ranges
  -> virtual chunks
  -> Pretext-informed height estimates
  -> custom virtualizer window
  -> React/GFM renders visible chunks
  -> ResizeObserver records actual heights
  -> anchor-preserving offset update
```

Pretext is not the renderer. It is the fast geometry layer.

React Markdown is not the virtualizer. It is the visible content renderer.

The custom virtualizer owns scroll math and mounted ranges.

## Why Pretext Belongs Here

Pretext is useful because it lets us answer layout questions before mounting
DOM:

- How many wrapped visual lines does a paragraph probably occupy?
- How tall is a code block with pre-wrap?
- What is the max line width for a text run?
- How should width and zoom changes affect estimated geometry?

Those answers let the virtualizer start with good offsets instead of terrible
guesses. Good estimates mean fewer scroll jumps, fewer measurement corrections,
and less visible churn.

Pretext does not replace final browser layout for Markdown. Browser layout is
still better for tables, nested lists, footnotes, math HTML, links, images, and
rich Markdown component styling.

## Upstream Repos To Clone First

Before implementing another custom Markdown feature from scratch, clone the
libraries that already solve the hard parts and use their implementation and
test suites as the basis for our own narrowed version. "React/GFM" means the
real upstream stack we already rely on: `react-markdown`, `remark-gfm`, and the
rehype packages around raw HTML, sanitization, slugs, code highlighting, and
math. Do not invent local parsing tricks when a focused upstream library
already has source code and tests for the behavior.

This is the default implementation workflow for the Pretext Markdown viewer.
Start by reading the relevant upstream package and the existing Retab viewer
component that already uses the same idea, then translate the smallest useful
piece into the new component. For example, React/GFM behavior should be based on
`react-markdown` plus `remark-gfm` and compared against the current Markdown
document renderer before adding local code.

Use a local research folder outside the shipped source tree. These repos are
not vendored product code; they are reference implementations that we can grep,
run, compare, and translate into this viewer's smaller security model.
If a clone already exists, use it as-is unless the feature explicitly depends
on newer upstream behavior.

Clone/update protocol:

1. Keep clones under `tmp/markdown-upstreams`.
2. If a repo is missing, clone it from the exact link in the table below.
3. If a repo already exists and the behavior is version-sensitive, update it
   with `git -C tmp/markdown-upstreams/<repo> pull --ff-only`.
4. Before writing local code, run `rg` inside the clone for the syntax,
   transformer, sanitizer, or renderer behavior being implemented.
5. Read the upstream tests for that behavior and add the smallest equivalent
   Retab regression test.
6. Use the package directly when the package boundary fits our security,
   dependency, and bundle constraints; otherwise translate only the narrow
   algorithm we need.
7. Preserve upstream license notices when copying non-trivial code.

```bash
mkdir -p tmp/markdown-upstreams
cd tmp/markdown-upstreams

git clone https://github.com/chenglou/pretext.git
git clone https://github.com/remarkjs/react-markdown.git
git clone https://github.com/remarkjs/remark-gfm.git
git clone https://github.com/micromark/micromark.git
git clone https://github.com/micromark/micromark-extension-gfm.git
git clone https://github.com/syntax-tree/mdast-util-gfm.git
git clone https://github.com/remarkjs/remark-frontmatter.git
git clone https://github.com/syntax-tree/mdast-util-frontmatter.git
git clone https://github.com/remarkjs/remark-directive.git
git clone https://github.com/syntax-tree/mdast-util-directive.git
git clone https://github.com/remarkjs/remark-math.git
git clone https://github.com/remarkjs/remark-rehype.git
git clone https://github.com/rehypejs/rehype-raw.git
git clone https://github.com/rehypejs/rehype-sanitize.git
git clone https://github.com/syntax-tree/hast-util-sanitize.git
git clone https://github.com/rehypejs/rehype-slug.git
git clone https://github.com/rehype-pretty/rehype-pretty-code.git
git clone https://github.com/shikijs/shiki.git
git clone https://github.com/mdx-js/mdx.git
git clone https://github.com/mermaid-js/mermaid.git
git clone https://github.com/jaywcjlove/remark-github-blockquote-alert.git
git clone https://github.com/7nohe/remark-alerts.git
git clone https://github.com/remarkjs/remark-gemoji.git
git clone https://github.com/rhysd/remark-emoji.git
git clone https://github.com/silvenon/remark-smartypants.git
```

Local reference inventory:

| Area                     | Local clone                                             | Upstream repo                                                                                             |
| ------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Pretext geometry         | `tmp/markdown-upstreams/pretext`                        | [chenglou/pretext](https://github.com/chenglou/pretext)                                                   |
| React Markdown rendering | `tmp/markdown-upstreams/react-markdown`                 | [remarkjs/react-markdown](https://github.com/remarkjs/react-markdown)                                     |
| GFM                      | `tmp/markdown-upstreams/remark-gfm`                     | [remarkjs/remark-gfm](https://github.com/remarkjs/remark-gfm)                                             |
| Markdown tokenizer       | `tmp/markdown-upstreams/micromark`                      | [micromark/micromark](https://github.com/micromark/micromark)                                             |
| GFM tokenizer            | `tmp/markdown-upstreams/micromark-extension-gfm`        | [micromark/micromark-extension-gfm](https://github.com/micromark/micromark-extension-gfm)                 |
| GFM AST utilities        | `tmp/markdown-upstreams/mdast-util-gfm`                 | [syntax-tree/mdast-util-gfm](https://github.com/syntax-tree/mdast-util-gfm)                               |
| Frontmatter              | `tmp/markdown-upstreams/remark-frontmatter`             | [remarkjs/remark-frontmatter](https://github.com/remarkjs/remark-frontmatter)                             |
| Frontmatter AST utility  | `tmp/markdown-upstreams/mdast-util-frontmatter`         | [syntax-tree/mdast-util-frontmatter](https://github.com/syntax-tree/mdast-util-frontmatter)               |
| Directives               | `tmp/markdown-upstreams/remark-directive`               | [remarkjs/remark-directive](https://github.com/remarkjs/remark-directive)                                 |
| Directive AST utility    | `tmp/markdown-upstreams/mdast-util-directive`           | [syntax-tree/mdast-util-directive](https://github.com/syntax-tree/mdast-util-directive)                   |
| Math syntax              | `tmp/markdown-upstreams/remark-math`                    | [remarkjs/remark-math](https://github.com/remarkjs/remark-math)                                           |
| Markdown to HAST         | `tmp/markdown-upstreams/remark-rehype`                  | [remarkjs/remark-rehype](https://github.com/remarkjs/remark-rehype)                                       |
| Raw HTML parsing         | `tmp/markdown-upstreams/rehype-raw`                     | [rehypejs/rehype-raw](https://github.com/rehypejs/rehype-raw)                                             |
| Sanitization             | `tmp/markdown-upstreams/rehype-sanitize`                | [rehypejs/rehype-sanitize](https://github.com/rehypejs/rehype-sanitize)                                   |
| Sanitizer schema utility | `tmp/markdown-upstreams/hast-util-sanitize`             | [syntax-tree/hast-util-sanitize](https://github.com/syntax-tree/hast-util-sanitize)                       |
| Heading slugs            | `tmp/markdown-upstreams/rehype-slug`                    | [rehypejs/rehype-slug](https://github.com/rehypejs/rehype-slug)                                           |
| Code highlighting        | `tmp/markdown-upstreams/rehype-pretty-code`             | [rehype-pretty/rehype-pretty-code](https://github.com/rehype-pretty/rehype-pretty-code)                   |
| Tokenization themes      | `tmp/markdown-upstreams/shiki`                          | [shikijs/shiki](https://github.com/shikijs/shiki)                                                         |
| MDX parsing              | `tmp/markdown-upstreams/mdx`                            | [mdx-js/mdx](https://github.com/mdx-js/mdx)                                                               |
| Mermaid diagrams         | `tmp/markdown-upstreams/mermaid`                        | [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid)                                               |
| GitHub alerts            | `tmp/markdown-upstreams/remark-github-blockquote-alert` | [jaywcjlove/remark-github-blockquote-alert](https://github.com/jaywcjlove/remark-github-blockquote-alert) |
| Alert variants           | `tmp/markdown-upstreams/remark-alerts`                  | [7nohe/remark-alerts](https://github.com/7nohe/remark-alerts)                                             |
| GitHub emoji             | `tmp/markdown-upstreams/remark-gemoji`                  | [remarkjs/remark-gemoji](https://github.com/remarkjs/remark-gemoji)                                       |
| Emoji shortcodes         | `tmp/markdown-upstreams/remark-emoji`                   | [rhysd/remark-emoji](https://github.com/rhysd/remark-emoji)                                               |
| Typography               | `tmp/markdown-upstreams/remark-smartypants`             | [silvenon/remark-smartypants](https://github.com/silvenon/remark-smartypants)                             |

Existing Retab references to compare before implementing:

| Area                   | Existing local reference                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin pipeline        | [`registry/new-york-v4/ui/markdown-document-plugins.ts`](/Users/sachaichbiah/Local/retab-ui/registry/new-york-v4/ui/markdown-document-plugins.ts)       |
| React render overrides | [`registry/new-york-v4/ui/markdown-document-renderers.tsx`](/Users/sachaichbiah/Local/retab-ui/registry/new-york-v4/ui/markdown-document-renderers.tsx) |
| URL safety policy      | [`registry/new-york-v4/ui/markdown-document-url-policy.ts`](/Users/sachaichbiah/Local/retab-ui/registry/new-york-v4/ui/markdown-document-url-policy.ts) |
| Copy controls          | [`registry/new-york-v4/ui/markdown-document-copy.tsx`](/Users/sachaichbiah/Local/retab-ui/registry/new-york-v4/ui/markdown-document-copy.tsx)           |
| Diagram rendering      | [`registry/new-york-v4/ui/markdown-document-diagram.tsx`](/Users/sachaichbiah/Local/retab-ui/registry/new-york-v4/ui/markdown-document-diagram.tsx)     |

Current package behavior to preserve:

| Package              | Used today in Retab | Upstream repo                                                                           | Rule                                                                  |
| -------------------- | ------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `react-markdown`     | Yes                 | [remarkjs/react-markdown](https://github.com/remarkjs/react-markdown)                   | Keep its component override contract as the rendered chunk boundary.  |
| `remark-gfm`         | Yes                 | [remarkjs/remark-gfm](https://github.com/remarkjs/remark-gfm)                           | Treat upstream GFM behavior and tests as the compatibility baseline.  |
| `rehype-raw`         | Yes                 | [rehypejs/rehype-raw](https://github.com/rehypejs/rehype-raw)                           | Keep raw HTML parsing behind the viewer sanitizer.                    |
| `rehype-sanitize`    | Yes                 | [rehypejs/rehype-sanitize](https://github.com/rehypejs/rehype-sanitize)                 | Narrow the upstream schema instead of creating a parallel sanitizer.  |
| `rehype-slug`        | Yes                 | [rehypejs/rehype-slug](https://github.com/rehypejs/rehype-slug)                         | Use one slug algorithm for the model and rendered DOM.                |
| `rehype-pretty-code` | Yes                 | [rehype-pretty/rehype-pretty-code](https://github.com/rehype-pretty/rehype-pretty-code) | Reuse tokenization and metadata behavior, do not write a highlighter. |

Local clone target: the upstream repositories above live in
`tmp/markdown-upstreams` in this workspace. They are deliberately outside the
registry/component source tree and must not be vendored into shipped source, but
implementation work should treat them as the first reference. Before adding a
feature, grep the matching clone, read its tests, and copy the smallest proven
behavior into our model or use the package directly when that is cleaner.

Implementation rule: start from the upstream source and tests for the feature
being implemented, then keep only the minimal behavior that belongs in our
viewer. This should make the custom component simpler than accumulating local
remark tricks, because each feature starts from a proven parser or renderer and
is narrowed deliberately.

Hard rule: a Pretext Markdown feature is not considered ready until it has an
identified upstream basis in the table below, an existing Retab comparison when
one exists, and a local regression test that captures the behavior we are
taking. The implementation may call the upstream package directly or translate a
small algorithm, but it should not start from a blank local regex/parser.

Implementation basis by feature:

| Feature                    | Start from local clone                                       | Upstream link                                                                                                                                      | Retab output                                                            |
| -------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Continuous geometry        | `tmp/markdown-upstreams/pretext`                             | [chenglou/pretext](https://github.com/chenglou/pretext)                                                                                            | Width-sensitive chunk estimates and visible-window projection.          |
| Rendered Markdown surface  | `tmp/markdown-upstreams/react-markdown`                      | [remarkjs/react-markdown](https://github.com/remarkjs/react-markdown)                                                                              | Component override boundary for visible chunks.                         |
| GFM tables/tasks/footnotes | `tmp/markdown-upstreams/remark-gfm`                          | [remarkjs/remark-gfm](https://github.com/remarkjs/remark-gfm)                                                                                      | GFM behavior copied from upstream tests, not hand-rolled parsing.       |
| Frontmatter model          | `tmp/markdown-upstreams/remark-frontmatter`                  | [remarkjs/remark-frontmatter](https://github.com/remarkjs/remark-frontmatter)                                                                      | First-class YAML/TOML frontmatter blocks with source fidelity.          |
| Directive callouts         | `tmp/markdown-upstreams/remark-directive`                    | [remarkjs/remark-directive](https://github.com/remarkjs/remark-directive)                                                                          | Safe directive AST projection into Retab callouts/components.           |
| GitHub alerts              | `tmp/markdown-upstreams/remark-github-blockquote-alert`      | [jaywcjlove/remark-github-blockquote-alert](https://github.com/jaywcjlove/remark-github-blockquote-alert)                                          | `> [!NOTE]`-style alerts normalized to the same internal callout model. |
| Mermaid diagrams           | `tmp/markdown-upstreams/mermaid`                             | [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid)                                                                                        | Diagram rendering states, errors, sizing, and source fallback.          |
| MDX syntax                 | `tmp/markdown-upstreams/mdx`                                 | [mdx-js/mdx](https://github.com/mdx-js/mdx)                                                                                                        | Restricted component markdown, never arbitrary executable MDX.          |
| Sanitized raw HTML         | `tmp/markdown-upstreams/rehype-raw`, `rehype-sanitize`       | [rehypejs/rehype-raw](https://github.com/rehypejs/rehype-raw), [rehypejs/rehype-sanitize](https://github.com/rehypejs/rehype-sanitize)             | Narrow viewer schema and URL policy.                                    |
| Heading anchors            | `tmp/markdown-upstreams/rehype-slug`                         | [rehypejs/rehype-slug](https://github.com/rehypejs/rehype-slug)                                                                                    | One shared slug algorithm for model IDs and DOM IDs.                    |
| Code highlighting          | `tmp/markdown-upstreams/rehype-pretty-code`, `shiki`         | [rehype-pretty/rehype-pretty-code](https://github.com/rehype-pretty/rehype-pretty-code), [shikijs/shiki](https://github.com/shikijs/shiki)         | Tokenized code blocks without a local highlighter.                      |
| Emoji and typography       | `tmp/markdown-upstreams/remark-gemoji`, `remark-smartypants` | [remarkjs/remark-gemoji](https://github.com/remarkjs/remark-gemoji), [silvenon/remark-smartypants](https://github.com/silvenon/remark-smartypants) | Docs polish transforms backed by upstream behavior and tests.           |

When the top-level remark/rehype package is only a thin wrapper, go one level
down before implementing. The useful logic is often in `micromark-*`,
`mdast-util-*`, or `hast-util-*` packages. For GFM, compare
`remark-gfm`, `micromark-extension-gfm`, and `mdast-util-gfm` together before
changing table, task-list, autolink, strikethrough, or footnote behavior. For
sanitization, compare `rehype-sanitize` and `hast-util-sanitize` together
before changing the schema.

Study these repos by responsibility:

- **Layout and geometry**: `chenglou/pretext`.
  - Copy the architectural split: prepare once, layout by width, project only
    the visible window.
  - Keep the implementation custom to our viewer because our DOM and block
    model are different.
- **React Markdown boundary**: `remarkjs/react-markdown`.
  - Use its component override model and safety assumptions as the rendering
    boundary reference.
  - Do not reimplement the whole renderer if a visible-window React Markdown
    path can keep our semantics exact.
- **GFM syntax**: `remarkjs/remark-gfm`.
  - Use its tests and mdast expectations for tables, task lists, autolinks,
    strikethrough, and footnotes.
  - Do not hand-roll GFM parsing.
- **Frontmatter**: `remarkjs/remark-frontmatter`.
  - Use its tokenizer behavior so YAML/TOML frontmatter is first-class in the
    model and still source-faithful in text mode.
- **Directives and callouts**: `remarkjs/remark-directive`.
  - Use the directive AST shape as the basis for our safe component/callout
    model.
- **GitHub blockquote alerts**:
  `jaywcjlove/remark-github-blockquote-alert` and `7nohe/remark-alerts`.
  - Compare both transforms and tests, then implement our narrow transformer
    against our internal callout model.
- **Math**: `remarkjs/remark-math` plus the current `rehype-katex` path.
  - Use the upstream syntax handling; keep rendering behind our sanitizer and
    component policy.
- **Markdown-to-HTML bridge**: `remarkjs/remark-rehype`.
  - Use the bridge behavior as the reference for mdast-to-hast semantics where
    React rendering still needs HTML-like nodes.
- **Raw HTML and sanitization**: `rehypejs/rehype-raw` and
  `rehypejs/rehype-sanitize`.
  - Base allowed tags/attributes on rehype sanitize schemas, then narrow them
    for viewer safety.
- **Heading anchors**: `rehypejs/rehype-slug`.
  - Use its slug behavior as the compatibility reference, but keep our viewer
    model and rendered DOM IDs generated by the same function so fragment
    navigation cannot drift.
- **Code highlighting**: `rehype-pretty/rehype-pretty-code` and
  `shikijs/shiki`.
  - Reuse their tokenization/highlighting behavior where possible; avoid a
    custom syntax highlighter.
- **MDX/component markdown**: `mdx-js/mdx`.
  - Study `remark-mdx` parsing for JSX element names and attributes, but do not
    execute arbitrary MDX.
  - Implement a restricted component AST that maps only whitelisted component
    names and serializable props.
- **Mermaid and diagrams**: `mermaid-js/mermaid`.
  - Use Mermaid's parser/renderer rather than building a diagram grammar.
  - Wrap it in our deterministic sizing, loading, error, copy, and security
    states.
- **Emoji shortcodes**: `remarkjs/remark-gemoji` and `rhysd/remark-emoji`.
  - Prefer GitHub-compatible gemoji behavior for docs; decide explicitly if we
    need the wider node-emoji set.
- **Typography**: `silvenon/remark-smartypants`.
  - Use its transform cases to avoid brittle regex-only punctuation rewriting.

Rules for upstream-derived work:

- Clone and read upstream source/tests before writing a custom parser,
  transformer, sanitizer, or renderer.
- Prefer using the package directly when it fits our security and bundle
  constraints.
- When a package is too broad, translate its narrow algorithm and tests into our
  model instead of inventing a parallel behavior.
- Preserve upstream license notices when copying non-trivial code.
- Add a local regression test for every upstream behavior we depend on.
- Never vendor large third-party repos into the app source tree.

## Rendering Boundary

### React/GFM Owns

- Markdown semantics
- GFM tables
- task lists
- footnotes
- math rendering
- callout rendering
- safe raw HTML rendering
- code block presentation
- copy controls
- image states
- accessible table markup

### Pretext Owns

- text measurement primitives
- paragraph line estimates
- code block line estimates
- width-sensitive frame estimates
- stable geometry inputs for the virtualizer

### Custom Virtualizer Owns

- visible chunk range
- total canvas height
- measured height map
- anchor capture and restore
- zoom and width relayout behavior
- bounded mounted content

## Module Shape

### `markdown-document-model.ts`

Owns source parsing and stable document records.

Exports:

- `createMarkdownDocument(text)`
- `findMarkdownChunkForLine(chunks, sourceLine)`
- `markdownChunkIntersectsLineRange({ chunk, range })`
- `serializeMarkdownTableForClipboard(markdown)`
- document, chunk, block, and source range types

Rules:

- no React imports
- no DOM imports
- no virtualizer imports
- source lines are always 1-based
- chunks use `chunkStartLine` and `chunkEndLine`
- blocks use `blockStartLine` and `blockEndLine`

### `markdown-document-layout.ts`

Owns Pretext-informed estimates.

Exports:

- `createMarkdownLayoutEstimate(document, options)`
- `estimateMarkdownBlockHeight(block, layoutStyle)`
- `estimateMarkdownChunkHeight(chunk, layoutStyle)`

Inputs:

- content width
- zoom
- font shorthand
- line height
- block spacing
- code font
- code line height

Rules:

- no React imports
- no DOM measurement
- Pretext style inputs must match CSS
- width is clamped with `Math.max(1, width)`
- estimates may be wrong, but must be stable and cheap

### `markdown-document-virtualizer.ts`

Owns scroll geometry.

Exports:

- visible range calculation
- offset lookup
- anchor capture
- anchor restore
- scroll-to-line offset

Rules:

- no React imports
- no Markdown parsing
- no DOM measurement
- binary-search frame offsets
- overscan in pixels, not items
- measured heights are authoritative

### `markdown-document-renderer.tsx`

Owns one visible chunk render lifecycle.

Responsibilities:

- invoke React Markdown through the configured plugin pipeline
- isolate async render readiness
- call measurement notification after render/mutation
- expose chunk root refs for table accessibility patches

Rules:

- no virtualizer math
- no plugin declarations inline
- no sanitizer declarations inline

### `markdown-document-renderers.tsx`

Owns visual Markdown component overrides.

Includes:

- headings
- paragraphs and breaks
- lists and task checkboxes
- blockquotes
- links
- images
- code and pre
- tables
- footnotes
- `details`, `summary`, `kbd`, `mark`, `sub`, `sup`

Rules:

- visual components only
- no parser policy
- no sanitizer policy
- no virtualizer math

### `markdown-document-plugins.ts`

Owns Markdown language policy.

In the Pretext implementation this starts as `pretext-markdown-policy.ts`,
which owns plugin order, sanitizer schema, URL policy, GitHub alert transforms,
directive callout transforms, restricted component parsing, and prose transforms
until the surface is stable enough to split further.

Order:

```text
remark-gfm
remark-breaks
remark-math
remark-directive
remark-callouts
rehype-raw
rehype-sanitize
rehype-slug
rehype-katex
rehype-pretty-code
```

Rules:

- plugin arrays are stable constants
- user raw HTML is sanitized before renderer-generated KaTeX and Shiki markup
- Pretty Code remains async

### `markdown-document-sanitize.ts`

Owns safe HTML.

Allow:

- safe document tags
- GFM footnote attributes
- task-list checkboxes
- `details` and `summary`
- `kbd`, `mark`, `sub`, `sup`
- generated callout data attributes
- tightly scoped generated KaTeX and Pretty Code attributes

Block:

- `script`
- event handlers
- unsafe URL protocols
- arbitrary user-authored class names
- arbitrary inline styles

### `markdown-document-callouts.ts`

Owns directive semantics.

Supported input names:

- `note`
- `info`
- `tip`
- `success`
- `warning`
- `caution`
- `danger`
- `error`
- `failure`

Normalized output kinds:

- `note`
- `info`
- `tip`
- `warning`
- `danger`

Syntax:

```md
:::warning{title="Migration note"}
This renders as a warning callout.
:::
```

The remark transform should emit neutral data properties:

- `dataCalloutKind`
- `dataCalloutTitle`

The React renderer converts those properties into UI.

## Chenglou Tricks To Keep

- Prepare source/style data once; layout many times.
- Keep CSS and Pretext style inputs identical.
- Wait for font readiness or use stable explicit fonts.
- Cache prepared text by content and style version.
- Cache frame estimates by width, zoom, and style version.
- Use binary search for visible ranges.
- Overscan in pixels.
- Batch scroll and resize projection with `requestAnimationFrame`.
- Preserve scroll anchors across measured height changes.
- Never compute virtual heights with hidden probe DOM.
- Never render the full document just to learn its size.
- Clamp widths to at least 1 CSS pixel.
- Treat very large blocks as hostile and give them a secondary strategy.

## What We Should Not Copy

Do not copy the markdown-chat demo as a full renderer for this component.

That path is perfect for chat-style text projection, but our viewer needs real
document Markdown:

- real tables
- nested lists
- accessible semantics
- math output
- footnotes
- safe HTML
- code block UI
- parse-viewer-level polish

Pretext should improve geometry. React/GFM should preserve document fidelity.

## Virtualization Unit

Use chunk virtualization first.

A chunk is a grouped set of top-level Markdown blocks with a stable source-line
range. Chunks are an internal virtualization unit only: they must not create
visible page frames, page labels, page gutters, or page boundaries in the user
experience.

Why chunks:

- fewer mounted React roots
- closer to parse viewer visual quality
- clean boundary for source-line lookup and measurement
- simpler table and list containment

Rules:

- keep headings with following blocks when possible
- do not split tables initially
- do not split fenced code blocks initially
- allow over-height chunks for hostile blocks
- measure actual chunk height after render
- chunk estimates are only the starting geometry
- apply document styling on the continuous canvas, not as per-chunk page chrome

## Hostile Blocks

Large blocks need explicit handling.

Examples:

- a single 10,000-line fenced code block
- a huge generated table
- a paragraph with megabytes of unbroken text
- deeply nested generated lists

Initial strategy:

- cap mounted chunks, not source lines
- detect hostile blocks during modeling
- keep hostile blocks in their own chunk
- estimate conservatively with Pretext where possible
- render only the hostile chunk when visible

Future strategy:

- add internal virtualization for hostile code blocks
- add table row virtualization only if profiling proves it is needed

## Measurement Policy

Use estimates first and measurements second.

Rules:

- Pretext estimates feed the first virtual frame.
- `ResizeObserver` records actual rendered chunk heights.
- measured heights replace estimates.
- updating heights must preserve the current scroll anchor.
- zoom and width changes rebuild estimates and clear incompatible
  measurements.
- document identity changes clear all measurements.

## File Viewer Routing

File Viewer should route by content semantics:

- Markdown files use this Markdown document viewer.
- prose text uses the fast Pretext text viewer.
- logs, JSON, source code, and line-oriented text use the Code Viewer.

The tabs should say what the user is choosing:

- `Text` for prose
- `Code` for code/log/source
- `Markdown` for Markdown

## Tests

### Model

- frontmatter line accounting
- heading ids and duplicate suffixes
- chunk grouping
- block source ranges
- table source preservation
- hostile block detection

### Layout

- paragraph estimate changes with width
- code estimate respects line count
- width clamps at 1 pixel
- repeated layout with same key reuses cached work
- font/style mismatch is impossible through typed options

### Virtualizer

- visible range uses binary search
- overscan is pixel-based
- mounted chunk count remains bounded
- measured heights replace estimates
- anchor restore prevents jumps
- scroll-to-line works before and after measurement

### Renderer

- GFM tables
- task lists
- hard breaks
- math
- callouts
- footnotes
- safe HTML
- unsafe HTML blocked
- highlighted code
- code copy
- table copy
- image loading and failure states

### Integration

- File Viewer routes Markdown to this viewer
- File Viewer routes prose to Text Viewer
- File Viewer routes logs/code to Code Viewer
- stale async resource loads do not win
- large Markdown mounts a bounded number of chunks

## Acceptance Criteria

The component is done when:

- plugin policy exists in exactly one module
- sanitizer policy exists in exactly one module
- callout policy exists in exactly one module
- React renderers contain no virtualizer math
- virtualizer contains no React
- model contains no React or DOM logic
- Pretext is used for estimates, not full Markdown rendering
- React/GFM owns final visible Markdown rendering
- large files do not mount the full document
- scroll remains stable as measurements arrive
- tables remain accessible after async rendering
- safe HTML is useful but not dangerous
- File Viewer uses this path for Markdown
- focused tests, typecheck, registry build, and local shadcn CLI registry
  install smoke pass

## Final Shape

The ideal viewer has one clean sentence:

React/GFM renders the visible Markdown document; Pretext gives the virtualizer
good geometry; the custom virtualizer keeps the mounted document bounded.
