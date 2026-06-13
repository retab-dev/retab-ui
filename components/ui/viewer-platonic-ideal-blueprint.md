# Viewer Platonic Ideal Blueprint

This note records the end-state architecture for the viewer system after the
hardening pass. It is intentionally stricter than a migration plan: future work
should preserve these invariants or improve them with an equally hard cut.

## Standard

Platonic ideal means:

- Simple: one obvious place for every behavior.
- Fast: no avoidable render work, repeated target lookup, or slow feedback loop.
- Complete: every needed state, error, empty view, keyboard path, and test exists.
- Minimal: no compatibility aliases, dead exports, speculative APIs, or duplicate concepts.
- Modular: every module owns one responsibility and hides its internals.
- High entropy: every line carries behavior, type information, or useful structure.
- Consistent: the same concept has the same name in every viewer.
- Exact: public APIs describe what the system does and nothing else.

## Current End State

- Shared `useIsClient` is the only hydration gate.
- Shared `ViewerSlots` is the only slot shape; format slot names are type aliases.
- Heavy document viewers use `slots`, not legacy chrome props.
- Source adapters use the `formatAnchorToTarget` grammar.
- DOCX target resolution is index-first after render commit.
- DOCX highlight and imperative scroll share the same committed render index.
- XLSX session responsibilities are split into sheet state, scale, scroll, download, active-cell, sheet, resource, chrome, and types.
- Text line rendering and virtualization are split.
- CSV resource, download, chrome, grid, and row patching are separated.
- Registry metadata lists imported internal modules exactly.
- Generated `public/r` payloads match `registry.json` and source file content.
- Whole-repo typecheck is green.

## Final Shape

Every heavy viewer should read as this map:

```txt
format-viewer.tsx          public facade, lazy/resource boundary, Suspense/error shell
format-viewer-types.ts     public props, slots alias, handle, target types
format-viewer-resource.ts  load/cache/retain/reset logic, when format-specific
format-viewer-core.ts      pure constants, normalization, small deterministic helpers
format-viewer-scale.ts     scale state and commands
format-viewer-scroll.ts    viewport state, scroll math, imperative scroll requests
format-viewer-content.tsx  loaded document composition
format-viewer-chrome.tsx   toolbar, frame, fallback, skeleton, error display
format-source.tsx          source anchor -> viewer target bridge
```

Formats may omit files they do not need. They should not hide multiple
responsibilities in the facade to avoid creating a file.

## Canonical Language

Use these names exactly:

```txt
source          original user/document input
resource        resolved viewer-ready data
target          viewer-native source location
anchor          external source citation or pointer
highlight       prop/state describing emphasis
overlay         rendered positioned emphasis
slots           document-attached external UI
chrome          viewer-owned frame, toolbar, fallback, skeleton
viewport        scroll container
scale           current zoom value
defaultScale    initial uncontrolled zoom value
currentItem     page, slide, frame, sheet, row, or equivalent visible context
```

Canonical adapter names:

```txt
pdfAnchorToTarget
docxAnchorToTarget
imageAnchorToTarget
textAnchorToTarget
csvAnchorToTarget
xlsxAnchorToTarget
```

Do not keep old names as aliases. Do not introduce format-specific synonyms
unless the underlying concept is actually different.

## Enforced Invariants

`tests/viewer-architecture.test.ts` must fail when:

- A stale source-adapter or compatibility symbol comes back.
- A viewer defines its own client hydration hook.
- A viewer slot type becomes an interface instead of a `ViewerSlots` alias.
- A registry viewer entry omits one of its relative internal imports.
- `public/r/registry.json` diverges from `registry.json`.
- A generated viewer payload differs from the current source file content.

These tests are part of the architecture. Do not weaken them to make registry
drift pass.

## Performance Guardrails

The viewer tests should keep proving:

- DOCX highlight changes do not rebuild the render index.
- DOCX imperative scroll does not walk the document after commit.
- Text virtualization keeps rendered lines bounded for large files.
- XLSX sheet switching does not reparse the workbook.
- High-risk viewer controls retain accessible names and selected state.

Prefer call-count or DOM-count assertions over wall-clock timing.

## Registry Exactness

Registry entries must include every internal relative module required by an
installable viewer. This includes shared viewer primitives such as:

```txt
viewer-error.tsx
viewer-slots.ts
use-is-client.ts
viewer-lru-cache.ts
```

Run `pnpm registry:build` after registry metadata changes, then run the
architecture test. The generated payload must be reproducible.

## Deletion And Entropy Rule

For every viewer module, ask:

- Does this export have a real consumer?
- Does this helper remove more code than it adds?
- Does this type name match the canonical language?
- Can this branch happen in production?
- Is this fallback required or just historical?
- Would a new engineer know where to change the behavior from the file name?

Delete anything that fails those questions. The ideal viewer stack should get
smaller after safety improves.

## Verification

Minimum commands:

```bash
pnpm test tests/viewer-architecture.test.ts
pnpm test tests/docx-viewer.test.tsx tests/docx-viewer-edge-cases.test.tsx tests/docx-source.test.tsx
pnpm test tests/sources.test.tsx tests/pdf-source.test.tsx tests/image-viewer-edge-cases.test.tsx
pnpm test tests/image-viewer.test.tsx tests/pptx-viewer.test.tsx
pnpm test tests/text-viewer.test.tsx tests/text-viewer-edge-cases.test.tsx tests/text-viewer-bug-hunt.test.tsx
pnpm test tests/csv-viewer.test.tsx tests/csv-viewer-sort.test.tsx tests/csv-viewer-edge-cases.test.ts tests/csv-viewer-stream.test.ts
pnpm test tests/xlsx-viewer-zoom.test.tsx tests/xlsx-viewer-ref.test.tsx tests/xlsx-viewer-integration.test.tsx tests/xlsx-viewer-download.test.ts tests/xlsx-viewer-edge.test.ts tests/xlsx-viewer-worker.test.ts
pnpm registry:build
pnpm registry:validate
pnpm typecheck
```

Optional but desirable:

```bash
pnpm exec eslint registry/new-york-v4/ui components/ui tests
```

## Definition Of Done

The viewer system holds the ideal only while:

- Whole-repo typecheck is green.
- The architecture test fails on every known class of viewer drift.
- There are no compatibility shims or stale adapter names.
- DOCX target resolution is index-only after render commit.
- Source highlighting and imperative scrolling share target resolution in every applicable viewer.
- Registry metadata is exact and generated output is reproducible.
- Accessibility is intentionally tested for the main controls.
- Public APIs are small, consistent, and complete.
- Each facade is a readable composition layer, not a behavior warehouse.
- Every exported symbol earns its place.
