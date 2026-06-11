# Blueprint — Field → Source linking abstraction

Status: **draft / brainstorm**
Scope: compose any field-rendering component (`json-form`, the extract field
list, `json-table`, markdown) with any document viewer (`pdf-viewer` today;
`docx`/`xlsx`/`image` later) so that hovering or selecting a field highlights
where its value came from in the document and scrolls to it.

---

## 1. Key finding — the emitter already exists

`json-form` already emits sources:

- `UiFormProps.setSourcesFieldPath?: (fieldPath: string | null)`
  (`components/json-form/json-form.tsx:208`) fires on field-label hover
  (`onMouseEnter`, ~line 3167) with the react-hook-form **dotted path**
  (`vendor.name`, `items.0.amount`) and clears to `null` on leave.
- There's already a `config.showSources` gate.

So `json-form` is a **source emitter**. After the PDF-viewer work, `PdfViewer`
is a **source target** (`renderPageOverlay` + `PdfHighlight` +
`scrollToPageArea`). What's missing is the **mediator in the middle**.

The `extract-viewer-block` we shipped *is* that mediator — but hand-wired to a
bespoke field list. **The abstraction is: generalize that middle so any emitter
talks to any target.**

---

## 2. Core abstraction — a mediator joined by a field path

Three roles, decoupled. The form and the viewer never import each other.

```
 EMITTER                MEDIATOR                        TARGET
 (json-form)            (the abstraction)               (pdf viewer)
 hover "vendor.name" ──► activePath ──► resolve ──► SourceLocation ──► highlight + scroll
                              ▲
                         sources: path → citation
```

The join key is a **field path**. Everything hinges on the form's path encoding
and the source map's keys being the *same string*. That is the contract — get it
right and the rest is plumbing.

---

## 3. Layers

### Layer 1 — Data: `document-source` (extend what exists)

Already shipped: `SourceCitation`, `SourceArea`, `SourceLocation`,
`citationToLocation`, `sourceLocationKey`.

Add the join structures:

- `SourcePath = string` — the agreed encoding (see Decision 1).
- `SourceMap = Record<SourcePath, SourceCitation | SourceCitation[]>` — citations
  keyed by path; arrays for multi-region fields. This is what an extraction
  produces *alongside* the value tree — parallel to json-form's existing
  `likelihoods: Record<string, any>`.
- `resolveSource(map, path) => SourceLocation | undefined`.

#### Where the `SourceMap` comes from — `GET /v1/extractions/sources`

The map is hydrated from the Retab **`/v1/extractions/sources`** endpoint.

Expected shape (to confirm against the live API when typing the client): Retab
returns provenance **mirroring the extracted data tree**, exactly like
`likelihoods` does for confidence — one entry per leaf field, the entry being a
citation (`page` + `polygon`/bbox + page dimensions). So the response is a
parallel tree, not a flat map.

The data layer therefore needs a **normalizer**:

```
extractionSourcesResponse  (tree mirroring the data, citation per leaf)
        │  flatten leaves → JSON-Pointer paths
        ▼
SourceMap = Record<JsonPointer, SourceCitation | SourceCitation[]>
```

- Flattening lives in a small `extractionSourcesToSourceMap(response)` helper in
  the data layer (or a `document-source/retab` adapter), keyed by JSON Pointer
  (Decision 1). Keeping it isolated means a different backend just swaps this one
  function.
- For the demo block we ship a **static fixture** captured from the endpoint
  (like `extract.json` today) so the showcase has no network/auth dependency; the
  live fetch is the consumer's responsibility, documented in the block.

### Layer 2 — Target contract: `SourceTargetHandle`

Formalize what `PdfViewer` already does. The minimal interface every
source-capable viewer satisfies:

- *draw a highlight for a location* — today `renderPageOverlay` + `PdfHighlight`
- *scroll to a location* — today `scrollToPageArea`

`PdfViewerHandle` already is one. Later `docx`/`xlsx`/`image` implement the same
shape — that is how "generalized sources" lands.

### Layer 3 — Controller: `useSourceLink` (generic mediator)

A headless hook — `useSourceLink({ sources, target })` — owning:

- `activePath` (hover) + `pinnedPath` (select), and the precedence between them
  (the hover-vs-select state machine the extract block hand-rolls today).
- dedupe (the `sourceLocationKey` ref trick).
- driving the target: on path change, resolve → scroll.

Returns `setActivePath` (→ straight into json-form's `setSourcesFieldPath`) and
`activeLocation` (→ into the viewer's overlay). **Fully viewer-agnostic.**

### Layer 4 — Adapter: per-viewer bridge

A tiny `<PdfSourceLayer>` / `bindPdfTarget(ref)` that turns `activeLocation`
into the `renderPageOverlay` callback and wires `scrollToPageArea`. One adapter
per viewer type. **The only viewer-specific code.**

### Resulting block (sketch of the seam, not implementation)

```
const link = useSourceLink({ sources, target: pdfRef })
<JsonForm setSourcesFieldPath={link.setActivePath} config={{ showSources: true }} />
<PdfViewer ref={pdfRef} renderPageOverlay={link.renderPdfOverlay} />
```

No bespoke field list.

---

## 4. Decisions that actually matter

These are the forks worth an explicit call; the rest follows.

### Decision 1 — Path encoding (the contract)

`json-form` emits dotted RHF paths (`items.0.amount`); Ajv / JSON-Pointer is
`/items/0/amount`. Pick one canonical form for `SourceMap` keys and convert at
the boundary.

- **Recommendation: store JSON Pointer.** It is the standard for "a location in a
  JSON document," survives keys that contain dots, and is what extraction
  backends tend to emit. Convert to/from RHF's dotted form **inside the json-form
  adapter only**.

### Decision 2 — Who owns hover vs. select

The emitter (json-form) only knows *hover*. To get click-to-pin + smooth-scroll
while hover stays a transient preview, the **controller** owns that state
machine.

- **Recommendation: controller owns it** (like the extract block today) so every
  emitter inherits pin/select for free.

### Decision 3 — One-way or bidirectional — **DECIDED: unidirectional**

Field → highlight only. The reverse channel (click a PDF region → focus the form
field) is **out of scope**.

- **Decision: unidirectional.** Keep the target contract minimal — the target
  only *consumes* a location (highlight + scroll); it does **not** emit paths
  back. No reverse channel baked into `SourceTargetHandle` or `useSourceLink`.
- Rationale: keeps every piece as standalone as possible (see Decision 5). A
  future reverse channel would be an *additive* concern (a separate "the target
  reported a path" callback), not a reshape of the one-way contract — so there's
  no rewrite cost to deferring it.

### Decision 4 — How generic is `SourceLocation`

PDF = `{ page, area% }`; xlsx = `{ sheet, cellRange }`; image = `{ area% }`.

- The **controller** (paths, hover/select) is 100% viewer-agnostic.
- The **citation→location** normalization and the **highlight/scroll** are
  viewer-specific.
- **Recommendation: generic mediator + per-viewer adapter.** Don't force one
  `SourceLocation` union to rule them all — each adapter owns its geometry.

### Decision 5 — Standalone pieces; refactor `extract-viewer-block` onto them — **DECIDED**

Goal: keep the pieces **as standalone as possible**.

- **A separate `json-form-sources` block** for the `json-form` ⨯ `pdf-viewer`
  composition. The two demos stay independent.
- The shared substance lives in the standalone, reusable pieces
  (`document-source`, `useSourceLink`, `PdfSourceLayer`); the blocks are thin
  compositions over them.
- **`extract-viewer-block` refactors onto `useSourceLink`.** Its bespoke
  hover/select/scroll state machine is deleted and replaced by the hook; the
  field list stays as its own emitter. This proves the abstraction subsumes the
  hand-wired version and is the migration test for the controller's API.

---

## 5. Recommendation — shape to build

**Headless controller hook + per-viewer adapters, no new React context** —
because json-form already provides the form-side transport
(`setSourcesFieldPath`), so a context would be redundant boilerplate.

| Piece | What | Reuse / new |
| --- | --- | --- |
| `document-source` | `SourceMap` + `resolveSource`, JSON-Pointer keyed | extend (shipped) |
| `extractionSourcesToSourceMap` | normalize `/v1/extractions/sources` tree → `SourceMap` | new |
| `useSourceLink` | generic mediator: active/pinned path, dedupe, drives target | new |
| `PdfSourceLayer` | adapter: `activeLocation` → overlay + scroll | new (later: `XlsxSourceLayer`, …) |
| `extract-viewer-block` | **refactor** onto `useSourceLink` (delete hand-wired state) | migrate |
| `json-form-sources` block | `JsonForm` ⨯ `PdfViewer` via `useSourceLink`, real schema | new demo |

Why this shape:

- Three independently reusable pieces (data, controller, adapter).
- Matches the repo's hook + render-prop idioms; no context system introduced.
- "Next viewer" becomes a single adapter, not a rewrite.
- Unidirectional + standalone (Decisions 3 & 5): each piece is independently
  usable and the new block adds no coupling back into existing components.
- `extract-viewer-block` migrating onto the hook is the proof + regression test.

---

## 6. Status of the forks — all resolved

- **Direction → unidirectional** (Decision 3). Field → viewer only; no reverse
  channel in the contract.
- **Placement → separate standalone block + refactor `extract-viewer-block`**
  (Decision 5). Reusable pieces stay standalone; the `json-form` ⨯ `pdf-viewer`
  demo is its own block; the existing block migrates onto `useSourceLink`.
- **Source of data → `GET /v1/extractions/sources`** (Layer 1). Provenance tree
  mirroring the data (like `likelihoods`), flattened to a JSON-Pointer `SourceMap`
  by an isolated normalizer; demo ships a static fixture.

To confirm during implementation: the exact `/v1/extractions/sources` response
schema (tree vs. flat; bbox vs. polygon; coordinate origin) — type the client
against the live API before finalizing `extractionSourcesToSourceMap`.

### Build order

1. `document-source`: add `SourceMap`, `resolveSource`, `extractionSourcesToSourceMap`.
2. `useSourceLink`: generic mediator (hover/pin/dedupe/scroll).
3. `PdfSourceLayer`: adapter over the existing `PdfViewerHandle`.
4. Refactor `extract-viewer-block` onto `useSourceLink` (regression test).
5. `json-form-sources` block + fixture + docs.

---

## Appendix — current building blocks

- `registry/new-york-v4/lib/document-source.ts` — `SourceCitation`,
  `SourceArea`, `SourceLocation`, `citationToLocation`, `sourceLocationKey`.
- `registry/new-york-v4/ui/pdf-viewer.tsx` — `PdfViewerHandle`
  (`scrollToPageArea`, `getViewportElement`), `PdfHighlight`, `renderPageOverlay`.
- `registry/new-york-v4/blocks/extract-viewer-block.tsx` — the hand-wired
  mediator; **to be refactored onto `useSourceLink`** (Decision 5), keeping its
  field list as an emitter.
- `components/json-form/json-form.tsx` — `setSourcesFieldPath` (emitter, already
  present), `config.showSources`, dotted RHF field paths.
