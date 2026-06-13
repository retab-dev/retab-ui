# Markdown Document Viewer Platonic Ideal Blueprint

## Verdict

The Markdown document viewer is strong, but it has not reached the platonic
ideal.

It has the right architecture: React/GFM renders Markdown, Pretext informs
initial geometry, a custom virtualizer bounds mounted content, and measured
heights become authoritative. The remaining work is not a feature scramble. It
is a precision pass: fewer responsibilities per module, sharper names, measured
performance budgets, and removal of every ambiguous boundary.

## North Star

One sentence should explain the component:

React/GFM renders visible Markdown pages; Pretext-informed layout gives the
custom virtualizer accurate first-frame geometry; measured pages keep scrolling
stable.

Everything in the implementation should support that sentence. Anything else is
excess.

## Non-Negotiable Qualities

- Simple: one owner for each concept.
- Fast: bounded mounting, RAF-batched scroll work, no full-document DOM.
- Complete: GFM, code, tables, math, callouts, footnotes, images, links, safe
  HTML, text mode, copy, download, zoom, highlights, and scroll-to-line.
- Minimal: no duplicate render paths, compatibility shims, speculative APIs, or
  unused options.
- Modular: parser, layout, virtualizer, renderer, plugins, sanitizer, copy, URL
  policy, and table accessibility are separate.
- High entropy: every line carries behavior, state, policy, or a tested
  contract.
- Consistent names: the same concept has the same name in every file.
- Measured: performance claims are backed by a repeatable fixture or browser
  profile.

## Current Shape

The viewer currently has the correct major pieces:

- `markdown-document-model.ts` parses source into blocks and pages.
- `markdown-document-layout.ts` owns Pretext-informed estimates.
- `markdown-document-virtualizer.ts` owns geometry and anchors.
- `markdown-document-viewer.tsx` owns the shell, viewport, measurement, and
  mounted pages.
- `markdown-document-renderer.tsx` owns React Markdown rendering readiness.
- `markdown-document-renderers.tsx` owns visual Markdown element overrides.
- `markdown-document-plugins.ts` owns language plugin policy.
- `markdown-document-sanitize.ts` owns raw HTML sanitization.
- `markdown-document-table-accessibility.ts` owns table header/cell patching.
- File Viewer routes Markdown through this component.

This is production-grade. It is not yet inevitable.

## Remaining Gaps

### 1. Viewer Orchestration Is Still Too Wide

`markdown-document-viewer.tsx` still coordinates many responsibilities:

- resource text loading
- mode and zoom state
- viewport sizing
- scroll position
- virtual window computation
- page measurement
- scroll anchor preservation
- toolbar wiring
- imperative viewer handle

That is acceptable, but not ideal. The ideal viewer should read like a
composition root, not a workflow engine.

Target:

- extract page measurement into a hook
- extract scroll anchor lifecycle into a hook
- extract toolbar state wiring where it reduces noise
- keep the viewer as the only React component that knows all pieces exist

Do not create abstractions for their own sake. Extract only boundaries that make
the file shorter, clearer, and easier to test.

### 2. Runtime Projection Needs One Chosen Shape

There are two viable render strategies:

- React-windowed pages: React maps `virtualWindow.items` to mounted page
  components.
- Imperative projected pages: the canvas owns stable DOM slots and individual
  React roots.

Both can be fast. The ideal component has exactly one. The chosen strategy
should be documented in the file and covered by tests.

Decision rule:

- use React-windowed pages if simplicity wins and profiling shows no scroll
  hitching
- use imperative projection only if it measurably improves scroll or mount
  churn

No hybrid state. No dead projection helpers. No duplicate page lifecycle.

### 3. Performance Is Proven Functionally, Not Quantitatively

The current tests prove bounded mounting. They do not prove runtime budget.

Add a repeatable performance fixture:

- 6,000-line prose Markdown
- 6,000-line mixed Markdown with tables, code, headings, and lists
- one hostile fenced code block
- one hostile table
- zoom change while scrolled
- scroll-to-line while measurements are still settling

Record:

- initial render time
- mounted page count
- measurement update count
- dropped-frame risk during scroll
- time from scroll event to projected window update
- number of React roots or mounted page components

Budgets should be concrete. Example:

- initial mount under 150 ms in local Chromium for 6,000 ordinary lines
- mounted pages under 40 for normal viewport sizes
- one scheduled scroll projection per animation frame
- no full-document Markdown DOM
- no page-height correction loop after readiness settles

### 4. Naming Needs A Final Pass

The component has mostly good names, but the ideal version should make these
terms exact everywhere:

- `sourceLine`: 1-based line in the full source file
- `renderedLine`: 1-based line in page-local rendered Markdown
- `pageStartLine`: first source line owned by a page
- `pageEndLine`: last source line owned by a page
- `pageId`: stable semantic page identity
- `pageKey`: render/measurement key for one page in one mode, width, and scale
- `virtualItem`: virtualizer output, never document data
- `estimatedHeight`: layout estimate before DOM measurement
- `measuredHeight`: DOM-derived authoritative height
- `renderState`: renderer lifecycle, not virtualizer state

Ban near-synonyms unless they describe different things.

### 5. Hostile Blocks Need A Final Policy

Hostile block detection exists, but the policy should be explicit.

Define:

- what counts as hostile
- whether hostile pages are isolated
- whether hostile code gets inner line virtualization
- whether hostile tables get row virtualization
- whether hostile paragraphs are allowed to wrap naturally or need chunking

Default ideal:

- isolate hostile blocks as their own pages
- keep ordinary pages simple
- add inner virtualization only after profiling proves a real problem
- never make normal Markdown pay complexity tax for pathological input

### 6. Pretext Must Stay In Its Lane

Pretext is valuable because it gives fast, deterministic text-flow estimates.
It should not become a second Markdown renderer.

Use Pretext for:

- prose line estimates
- heading estimates
- list and blockquote text estimates
- callout body estimates
- pre-wrap code estimates

Do not use Pretext for:

- table rendering
- math rendering
- HTML rendering
- final Markdown layout
- source-of-truth page height

The browser remains the final layout engine for mounted Markdown pages.

### 7. Sanitization And Plugin Policy Need Contract Tests

The feature surface is now broad enough that security and plugin behavior should
be locked independently from the visual viewer tests.

Add or maintain tests for:

- unsafe `javascript:` links are inert
- unsafe image protocols are inert
- raw event handlers are stripped
- user classes and inline styles are stripped unless explicitly allowed
- safe HTML tags survive
- math renders through KaTeX
- directives render only supported callout kinds
- footnotes keep accessible backrefs
- heading IDs are stable and duplicate-safe

The renderer should not become the security policy.

## Ideal Module Map

```text
markdown-document-viewer.tsx
  composition root: resource, toolbar, viewport, mounted page orchestration

markdown-document-model.ts
  source parsing, block identity, page grouping, line mapping

markdown-document-layout.ts
  Pretext-informed estimates and hostile-block classification

markdown-document-virtualizer.ts
  offsets, binary search, visible window, anchors, scroll target math

markdown-document-renderer.tsx
  React Markdown invocation and render readiness lifecycle

markdown-document-renderers.tsx
  visual element overrides only

markdown-document-plugins.ts
  remark/rehype plugin order and Markdown language policy

markdown-document-sanitize.ts
  safe raw HTML schema

markdown-document-table-accessibility.ts
  post-render table header/cell relationships

markdown-document-copy.tsx
  copy buttons and clipboard serialization

markdown-document-url-policy.ts
  URL protocol policy for links and images

markdown-document-performance.ts
  test or benchmark helpers only, no runtime product dependency
```

## Implementation Plan

### Phase 1: Choose One Projection Strategy

Audit `markdown-document-viewer.tsx`.

Deliverables:

- one mounted-page strategy
- no dead projection helpers
- no duplicate page component lifecycle
- one measurement path
- one readiness path

Acceptance:

- focused Markdown tests pass
- 6,000-line bounded mount test passes
- no `rg` hits for obsolete projection helpers if React-windowed pages are the
  chosen strategy
- no `virtualWindow.items.map` page rendering if imperative projection is the
  chosen strategy

### Phase 2: Extract Real Ownership From The Viewer

Extract only where it removes meaningful complexity.

Candidates:

- `useMarkdownPageMeasurements`
- `useMarkdownScrollAnchor`
- `useMarkdownViewportSize`
- `MarkdownDocumentViewport`
- `MarkdownDocumentToolbar`

Acceptance:

- `markdown-document-viewer.tsx` reads top-down
- no hook hides Markdown policy
- no hook imports parser or renderer policy unless it owns that concern
- all extracted hooks have focused tests when they contain logic

### Phase 3: Make Performance Measurable

Add performance fixtures and a repeatable profiling script or test helper.

Acceptance:

- fixtures cover ordinary and hostile Markdown
- output reports mount count and measurement churn
- browser trace or scripted profile is documented
- thresholds fail loudly when violated

### Phase 4: Naming And Contract Sweep

Rename only for precision, not style.

Acceptance:

- glossary terms are used consistently
- old names are absent
- tests describe behavior using the same vocabulary as source
- no compatibility aliases remain

### Phase 5: Security And Markdown Feature Contract

Move security expectations into dedicated tests.

Acceptance:

- sanitizer policy has isolated tests
- URL policy has isolated tests
- plugin behavior has isolated tests
- viewer tests focus on integration, not every plugin edge case

## Done Definition

The component reaches the local platonic ideal when all of these are true:

- the architecture can be explained in one sentence
- every module has one owner and one reason to change
- only visible pages mount
- measurements are authoritative
- scroll remains stable while measurements arrive
- Markdown feature support is complete for the product surface
- unsafe input stays inert
- hostile input is isolated
- performance has numeric budgets
- tests cover contracts, not implementation accidents
- there is no dead code, duplicate path, compatibility shim, or vague name

Until then, the component is strong, but not perfect.
