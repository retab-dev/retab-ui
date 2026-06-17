# Pretext Markdown Viewer — Platonic Refactor Blueprint

## Purpose

The viewer works and is well-tested. This blueprint is not about features; it is
about reaching the form the original blueprint promised and the current code has
drifted from:

> simple · fast · everything that's needed, nothing more · perfectly modular ·
> high-entropy code · perfectly consistent names

This document is the plan to close that gap. It is grounded in a full read of the
nine modules (~8,000 lines) and cites concrete locations. It supersedes nothing
in `react-gfm-pretext-markdown-viewer-blueprint.md`; it is the cleanup pass that
the "owns everything until stable" clauses there explicitly deferred.

## Current State (measured)

| Module | Lines | Health |
| ------ | ----: | ------ |
| `pretext-markdown-renderer.tsx` | 3479 | Overloaded — ~37% is a Mermaid engine |
| `pretext-markdown-policy.ts` | 1394 | 7 cohesive concerns in one file |
| `pretext-markdown-viewer-content.tsx` | 1116 | God-component, 13 effects, 2 virtualizers |
| `pretext-markdown-document-model.ts` | 1061 | Clean core + ~350 lines of foreign parsing |
| `pretext-markdown-layout.ts` | 490 | Good, but 3× repeated measure ritual |
| `pretext-markdown-virtualizer.ts` | 214 | Exemplary |
| `pretext-markdown-parser.ts` | 90 | Justified, over-formalized seam |
| `pretext-markdown-table-accessibility.ts` | 79 | Platonic — leave alone |
| `pretext-markdown-viewer.tsx` | 30 | Platonic — leave alone |

Two files already meet the ideal. The work is concentrated in the four large
files, in this order of leverage.

## Design Invariants (the contract every change must keep)

1. **One job per file.** A reader should predict a file's contents from its name.
2. **One way to say one thing.** A concept gets exactly one name and one helper.
3. **No redundant renderer.** If a library renders it, we do not also hand-roll it.
4. **No dead surface.** No no-op plugins, unreachable branches, or unread fields.
5. **Units in names.** Pixel quantities end in `Px`; line/char counts say so.
6. **One prefix.** Every internal symbol is `pretextMarkdown*` / `PretextMarkdown*`
   or none are. No `Marked*` / bare-name third family.
7. **Boundaries hold.** model = no React/DOM; layout = no React/no DOM nodes;
   virtualizer = no React/no parsing.

---

## Phase 1 — Extract the Mermaid subsystem (highest leverage)

**Problem.** `renderer.tsx:1772–3268` (~1,300 lines) is a complete diagram
feature living inside the markdown renderer. It contains:

- a from-scratch SVG layout engine (`renderBasicMermaidDiagram` and the
  sequence/state/class variants, ~2896–3254) that **duplicates the real mermaid
  library** already lazy-imported at ~2829–2853;
- nine per-type summary parsers (`read…{State,Class,Er,Pie,Journey,Gantt,
  GitGraph,Timeline,MindMap}DiagramSummary`, ~2211–2421);
- two parallel dispatchers over those nine types — one for height
  (`estimatePretextMarkdownDiagramBodyHeight`, 1953–2041), one for the a11y
  sentence (`describePretextMarkdownDiagram`, 2043–2190).

**Decision (revised during implementation).** The hand-written SVG fallback
engine is **not** redundant dead code as first assumed — it is deliberate, tested
behavior (6 tests across sequence/state/class/er/pie, a `%% force-basic-fallback`
switch, the failure path when the real Mermaid layout cannot run). It is **kept
and isolated**, not deleted.

**Target.**

- New file `pretext-markdown-mermaid.tsx` owns the lazy `<PretextMarkdownDiagram>`
  component, the SVG sanitizer, the basic SVG fallback engine, and the diagram
  summary/describe/estimate logic.
- New file `pretext-markdown-controls.tsx` owns the interaction helpers shared by
  code blocks, tables, and diagrams (`PretextMarkdownCopyButton`,
  `scrollPretextMarkdownHorizontalRegion`, `readPretextMarkdownSelectedText`).
  This breaks the renderer↔mermaid import cycle cleanly instead of relying on a
  runtime cycle.
- Collapse the nine parsers + two dispatchers into one table (folded into Phase 3,
  the dedup pass):

  ```ts
  const DIAGRAM_TYPES: Array<{
    test: (firstLine: string) => boolean
    summarize: (lines: string[]) => DiagramSummary | null
    describe: (s: DiagramSummary) => string
    estimateBodyHeightPx: (s: DiagramSummary) => number
  }> = [...]
  ```

  One pass produces both the description and the height; per-type pixel-accurate
  height guesses collapse to one line-count heuristic unless profiling proves a
  type needs more.

**Outcome.** `renderer.tsx` drops to ~2,000 lines and does one job: map markdown
nodes to React elements. The largest source of repetition in the codebase is gone.

---

## Phase 2 — Split `policy.ts` along its visible seams

**Problem.** `policy.ts` bundles seven independently-cohesive concerns; the
comment enumerating them already reads like a table of contents.

**Target files.**

| New file | Moves | Source span |
| -------- | ----- | ----------- |
| `pretext-markdown-url-policy.ts` | URL/image/media/SVG sanitization + scheme/decode helpers | 153–332 |
| `pretext-markdown-components.ts` | component registry, markdown + directive parsing, prop validation, callout normalization | 41–151, 554–576, 578–863, 1135–1373 |
| `pretext-markdown-sanitize.ts` | sanitizer schema + SVG/KaTeX option blobs | 166–200, 488–552 |
| `pretext-markdown-policy.ts` (remaining) | plugin order + remark/rehype transform factory + prose transforms | 159–249, 334–486, 865–1133, 1375–1394 |

**Rules.** `url-policy.ts` has zero coupling to the rest (only its own regexes) —
extract it first. `parsePretextComponentProps` (796) is the shared core of both
component paths and anchors `components.ts`.

---

## Phase 3 — De-duplicate (raise entropy)

Each item below is a verbatim or near-verbatim repetition. Replace with one
helper.

**`policy.ts` / `components.ts`:**
- `getNodeProperties(node)` — the `"properties" in node` prologue is written 5×
  (388, 401, 423, 457, + alert variant).
- `readDataProp(props, "data-…")` — the `camelCase ?? "data-kebab"` dual-read
  appears ~13× (383, 408, 413, 430, 437, 464, 469, 472…).
- Merge `parsePretextComponentMarkdown` (578) and
  `…OpeningMarkdown` (596) into one mode-parameterized function.
- Drop the duplicated component-attr allowlist on `div` (520–526); it is already
  on `"*"` (502–513).

**`renderer.tsx`:**
- `rawInline(tag, style)` factory for the ~12 identical inline-element components
  (~537–661).
- One `buildDiagramSvg(positions, edges, markerId)` — moot once Phase 1 deletes
  the SVG engine, but if any fallback survives, the `<defs><marker>` block is
  copy-pasted 4×.
- Fold the triple footnote predicates and the four kind→className switches
  (`calloutClassName` 2810, `alertClassName` 3523, `alertTitleClassName` 3538,
  `alertIcon` 3553) into one record-of-records keyed by kind.

**`layout.ts`:**
- `measureWrappedLineCount({ text, font, textWidthPx, fontScale })` — the
  prepare→measure→fallback ritual is written 3× (148–154, 231–237, 369–375).
- `estimateWrappedLineCount(...)` — `estimateHostile…ChunkHeight` (244–270) and
  `…BlockHeight` (272–295) are clones; share the wrapped-line core.
- Name the magic `8` once: `const APPROX_CHAR_WIDTH_PX = 8` (used at 260, 288,
  479, 487).

**`model.ts`:**
- Replace the 8-variable mutating `flushChunk` closure inside
  `createMarkdownBodyChunks` (366–561) with a small `ChunkAccumulator`, and reuse
  it for the fallback (348) and catch (530) chunk literals.

---

## Phase 4 — Naming and terminology pass

**One prefix.** Rename the `Marked*` family in `parser.ts`
(`normalizeMarkedToken`, `readMarkedListOrdered`…) and the bare-name helpers in
`renderer.tsx` (`codeLanguage`, `escapeSvg`, `pluralize`, `parseMermaidNode`,
`resolveTableCellAlignment`, `renderBasicMermaid*`) to the single
`pretextMarkdown*` convention. Pick `read` for "extract value or null" and
`parse` for "string → structure"; apply consistently (`readPretextComponent
ClosingMarkdown` at 616 currently *parses*).

**Units in names.**
- `offsetWithinChunk` → `offsetWithinChunkPx` (virtualizer:11) — it is pixels next
  to char-offset `sourceStartOffset`.
- `sourceLineCount` at `layout.ts:375` is a *wrapped* count → `wrappedLineCount`.
- `countLineBreaks` (model:623) returns a line *count*, not breaks → rename or fix
  to `length - 1`.

**Frame vs chunk.** Sibling virtualizer functions disagree
(`getPretextMarkdownSourceLineForScrollTop` calls the result `frameIndex` at 135;
`getPretextMarkdownFrameScrollAnchor` calls the same search's result `chunkIndex`
at 43). Pick one. Per the original blueprint, settle the four-term vocabulary
(`block` / `chunk` / `frame` / `window`) and either adopt `chunkStartLine` /
`blockStartLine` or amend the blueprint to bless the current uniform
`sourceStartLine` (recommended — it is better; fix the blueprint).

**Scroll API.** Unify `scrollLineRange` / `scrollToChunkFrame` /
`scrollToLineRange` (content) onto one `scrollTo*` shape. Rename the
`highlightRange` prop that actually receives search ranges
(`viewer-content.tsx:617`) so the name stops lying.

---

## Phase 5 — Delete dead surface

- **Remove the no-op `remarkRestorePretextComponentMarkdownFallbacks`** (body is
  empty, `policy.ts:1363`) from its definition and the live pipeline (239).
- Collapse `sanitizePretextMarkdownMediaUrl` into the image sanitizer — its second
  SVG check (295) is unreachable.
- Drop the `PretextMarkdownSvgSanitizer` injected-sanitizer indirection (159–164);
  the options blob is DOMPurify-specific anyway.
- Prune the ~10 self-mapping code-language aliases (renderer ~250–285);
  `normalizePretextMarkdownCodeLanguage` already returns input on miss.
- Remove the dead `maxLineWidth` computation (layout 485–488) if no caller reads
  it; every current call site reads only `lineCount`.
- Audit the model's symmetric `find…ForLine` / `find…ForOffset` and
  `…IntersectsLineRange` / `…IntersectsOffsetRange` pairs; delete the half with no
  consumer.

---

## Phase 6 — Decompose the orchestrator

**Problem.** `viewer-content.tsx` is a 575-line god-component (1116 with
colocated helpers): 13 effects, two independent virtualizers, and the same
"stash-in-ref, restore-in-effect" scroll dance three times.

**Target — extract three hooks and one component:**

- `useScrollAnchor(viewportRef, frame.chunks)` → returns `capture()`; absorbs the
  capture/pending-ref/restore-effect triad plus the width, zoom, measure, and
  view-mode-line restore call sites.
- `useMarkdownSearch(document, query)` → matches + active index + nav; deletes the
  two redundant `activeSearchMatchIndex` clamp effects (478–488) in favor of the
  render-time `Math.min` already present.
- `useFragmentNav(...)` → resolve / hashchange / popstate.
- Either **reuse the plain-text source canvas** for the "Text" tab or collapse the
  duplicated `line ↔ scrollTop` formulas (286 / 336 / 842) into one
  `sourceLineMetrics` helper. Today the source path is a second hand-rolled
  virtualizer (`PretextMarkdownSourceCanvas`, 824–909).
- Replace the obfuscated `void fontEpoch` layout-invalidation channel (134) with
  an explicitly named dependency, and move `useTextViewerFontEpoch` to the shared
  text-viewer module where its name says it belongs.

**Outcome.** Orchestrator lands at ~200–250 lines that wire model + layout +
virtualizer + renderer and delegate the rest.

---

## Execution Order and Guardrails

Phases are independently shippable and ordered by leverage. Recommended sequence:
**1 → 5 → 3 → 2 → 4 → 6** (delete dead code before refactoring around it; defer
the orchestrator until the modules it consumes are stable).

Per the original blueprint's upstream rule and existing test suites, every phase
must keep green:

- `tests/pretext-markdown-*.test.ts(x)` (parser, model, layout, virtualizer,
  policy, viewer, table-accessibility, architecture)
- `e2e/pretext-markdown-viewer.spec.ts`
- typecheck, `pnpm registry:build` for touched items, local shadcn CLI install smoke

Add one regression test per extraction (Mermaid registry, split policy modules,
extracted hooks) so the seam is pinned. No phase changes rendered output or the
public `TextViewerProps` contract; this is pure form.

## Definition of Done (the ideal, made checkable)

- [x] `renderer.tsx` does only node→element mapping; Mermaid lives in its own file
- [x] Mermaid subsystem isolated in `pretext-markdown-mermaid.tsx`; shared
      interaction helpers in `pretext-markdown-controls.tsx` (no import cycle)
- [x] `policy.ts` is plugin-order + transforms + DOM readers only; url-policy /
      components / sanitize split out (1394 → 532 lines, acyclic)
- [x] No symbol appears under two prefixes; `Marked*` family gone (parser
      renamed; bare-name renderer/mermaid helpers prefixed)
- [x] Key pixel quantity renamed (`offsetWithinChunk` → `offsetWithinChunkPx`)
      and the lying count name fixed (`countLineBreaks` → `countLines`,
      `sourceLineCount` → `lineCount` at the component-fallback estimate)
- [x] Zero no-op plugins, unreachable branches, or unread fields (removed the
      no-op remark plugin, the unreachable media SVG check, the dead
      `maxLineWidth`, the dead `findPretextMarkdownChunkForLine`, 10 self-map
      aliases)
- [x] The flagged verbatim repetitions are collapsed (layout measure/estimate
      rituals, policy node-prop reads, component-markdown parsers, the alert
      kind→style switches, the mermaid 14-branch dispatchers, the model
      `flushChunk` closure). NOTE: the `rawInline` factory was deliberately NOT
      done — react-markdown's `satisfies Components` map makes a generic factory
      require casts that *lower* type safety; 11 honest typed JSX blocks are
      better than one cast-laden abstraction.
- [x] Search / anchor / fragment nav are extracted hooks (`useMarkdownSearch`,
      `useScrollAnchor`, `useFragmentNav`); main component 576 → 458 lines.
      NOTE: kept the hooks in-file (no new registry files) so the file total
      didn't drop to ≤250 — the *component* shrank and the concerns are
      separated, which was the real goal.
- [ ] One virtualizer for both modes — deliberately NOT merged. The rendered and
      source paths are genuinely different (variable-height chunks vs fixed-height
      lines); the duplicated `line ↔ scrollTop` math was collapsed into shared
      helpers instead. Merging was judged high-risk / low-reward.
- [x] All existing tests green (175/176; the one failure is a pre-existing
      environment issue — the shadcn CLI smoke fails because the local pnpm
      ignores `pnpm.overrides`, unrelated to this refactor) + whole-project
      `tsc` and `eslint` clean

## The one sentence

When this is done, the same description still fits — *React/GFM renders the
visible Markdown; Pretext gives the virtualizer good geometry; the virtualizer
keeps the mounted document bounded* — but now every file's name predicts its
contents, every concept has one name, and nothing in the tree is there twice or
for nothing.
