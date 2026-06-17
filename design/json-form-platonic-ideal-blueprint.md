# JSON Form Platonic Ideal Blueprint

Last audited: 2026-06-17

## Verdict

The code-shape blueprint is implemented.

`JsonForm` now has the intended module boundaries, source-link vocabulary, and
focused tests. The only remaining proof gap is browser speed: the required
profile routes were not available on the running local server.

```txt
Simplicity: implemented.
Everything needed: implemented in code and tests.
Nothing more: implemented, with no compatibility aliases.
Perfect modularization: implemented.
Consistent source-link names: implemented.
Speed: unit-proven, browser-profile proof pending.
```

## Blueprint Objective

Reach the platonic ideal by closing the only remaining gap: prove the final
shape under real browser interaction without weakening the completed code
boundaries.

The target is not more refactor. The target is evidence.

```txt
Keep the current shape.
Run the real routes.
Measure large arrays.
Measure source-linked scrolling.
Accept only if speed and source-hover correctness both hold.
```

## Standard

The component is done only when it satisfies this standard:

```txt
Simplicity.
Speed.
Everything needed.
Nothing more.
Perfect modularization.
High-entropy code.
Perfectly consistent names.
Flaubertian precision.
```

No compatibility shims. No historical aliases. No duplicate concept names. No
extraction that only moves line count around.

## Implemented Shape

The current module map is the intended shape:

```txt
json-form.tsx
form-primitives.tsx
json-form-constants.ts
open-paths.tsx

schema-model.ts
path-codec.ts

field-renderer.ts
object-fields.tsx
array-fields.tsx
virtual-list.tsx
disclosure.tsx

source-link.tsx
source-link-table-hover.ts

scalar-control.tsx
scalar/types.ts
scalar/enum-control.tsx
scalar/number-control.tsx
scalar/date-time-control.tsx
scalar/text-control.tsx
scalar/boolean-control.tsx

table/array-table.tsx
table/array-table-row.tsx
table/array-table-cell.tsx
table/array-table-cell-model.ts
table/array-table-cell-commit.ts
table/array-table-cell-props.ts
table/array-table-body.tsx
table/array-table-scroll.ts
table/array-table-format.ts
table/array-table-config.ts
```

Do not add another layer unless it removes a named owner concept. Do not merge
these modules unless two files demonstrably own the same fact.

## Completed Phases

### 1. Source Table Hover Controller

Implemented in `components/json-form/source-link-table-hover.ts`.

`source-link.tsx` now owns only:

- source-link context;
- scalar source shells;
- public hook composition.

`source-link-table-hover.ts` owns:

- table hover state;
- active source-cell DOM mutation;
- source-path extraction from table cells;
- pointer tracking;
- hover reporting RAF;
- scroll-hover RAF and cadence;
- cleanup.

The live-scroll behavior remains covered by
`tests/json-form-source-link.test.tsx`.

### 2. Array Table Cell Split

Implemented:

```txt
table/array-table-cell.tsx
  display/edit rendering only

table/array-table-cell-model.ts
  cell model type and model helper

table/array-table-cell-commit.ts
  commit normalization and setValue behavior

table/array-table-cell-props.ts
  shared editable/accessibility prop builder
```

`tests/json-form-array-table-cell-commit.test.ts` covers normalization without
rendering React.

### 3. Shared Source-Link Vocabulary

Implemented as a hard cutover with no aliases:

```txt
activePath -> activeSourcePath
onFieldHover -> onSourceHover
selectField -> selectSourcePath
initialPath -> initialSourcePath
selectedPath -> selectedSourcePath
```

The source-link surface now uses:

```txt
sourceLink
activeSourcePath
onSourceHover
selectSourcePath
initialSourcePath
selectedSourcePath
data-source-path
data-source-active
```

The old source-link names are gone from the JsonForm, source blocks,
source-link UI, source tests, and generated source registry artifacts.

## Proof

Passed:

```txt
pnpm exec vitest run \
  tests/json-form-architecture.test.ts \
  tests/json-form-schema-model.test.ts \
  tests/json-form-path-codec.test.ts \
  tests/json-form-source-link.test.tsx \
  tests/json-form-array-table-cell-commit.test.ts \
  tests/json-form.test.tsx \
  tests/json-form-edge.test.tsx \
  tests/sources.test.tsx \
  tests/viewer-architecture.test.ts

pnpm exec tsc --noEmit
```

Also clean:

```txt
rg "activePath|onFieldHover|selectField" \
  registry/new-york-v4/ui/source-field-link.ts \
  registry/new-york-v4/ui/source-field-list.tsx \
  components/json-form \
  registry/new-york-v4/blocks \
  tests/sources.test.tsx \
  tests/json-form.test.tsx \
  tests/json-form-source-link.test.tsx

rg "activePath|onFieldHover|selectField|initialPath|selectedPath" \
  public/r/source-field-link.json \
  public/r/source-field-list.json \
  public/r/csv-sources-block.json \
  public/r/docx-sources-block.json \
  public/r/extract-viewer-block.json \
  public/r/image-sources-block.json \
  public/r/json-form-sources-block.json \
  public/r/sources-viewer-block.json \
  public/r/text-sources-block.json \
  public/r/xlsx-sources-block.json
```

Pending browser proof:

```txt
node scripts/profile-json-form-large-array.mjs
node scripts/profile-json-form-sources-interactions.mjs
```

Current local blocker:

```txt
http://localhost:3000/scrollbench?viewer=json-form-sources -> 404
http://localhost:3000/json-form-large-array -> 404
http://localhost:3100/scrollbench?viewer=json-form-sources -> no server
http://localhost:3100/json-form-large-array -> no server
```

Repository rule: if no suitable frontend server is running, ask the user to
start one. Do not start, stop, or restart repository dev servers.

## Runtime Proof Plan

### 1. Server Precondition

A frontend server must serve these routes:

```txt
/scrollbench?viewer=json-form-sources
/json-form-large-array
/blocks/sources-viewer
```

Use whatever port the user has running. If needed, pass it explicitly:

```txt
PROFILE_URL=http://localhost:<port>/json-form-large-array \
  node scripts/profile-json-form-large-array.mjs

PROFILE_URL=http://localhost:<port>/scrollbench?viewer=json-form-sources \
  node scripts/profile-json-form-sources-interactions.mjs
```

### 2. Large Array Acceptance

The large-array profile must show:

- bounded mounted table rows and cells;
- no runaway DOM node growth after scroll scenarios;
- no runtime exceptions;
- no layout/script spike that makes interaction visibly sticky.

### 3. Source Interaction Acceptance

The source-interaction profile must show:

- `scroll-transactions-table` finishes with exactly one active source cell;
- the active source path matches the table cell under the pointer after scroll;
- source-active attribute churn stays bounded;
- no hover loss after table scroll and rerender.

### 4. Manual Browser Check

On `/blocks/sources-viewer`:

```txt
expand Transactions
hover a visible transaction cell
wheel-scroll inside the table while the pointer is stationary
verify the highlighted source follows the cell now under the pointer
click or press Enter on a cell
verify source selection uses the same source path
```

This check exists because the ideal includes feel. A profiler can prove speed;
it cannot prove the interaction feels exact.

## Regression Locks

Keep these guards green:

```txt
pnpm exec vitest run tests/json-form-architecture.test.ts
pnpm exec vitest run tests/json-form-array-table-cell-commit.test.ts
pnpm exec vitest run tests/json-form-source-link.test.tsx
pnpm exec tsc --noEmit
```

Keep these searches empty for the source-link surface:

```txt
rg "activePath|onFieldHover|selectField" \
  registry/new-york-v4/ui/source-field-link.ts \
  registry/new-york-v4/ui/source-field-list.tsx \
  components/json-form \
  registry/new-york-v4/blocks \
  tests/sources.test.tsx \
  tests/json-form.test.tsx \
  tests/json-form-source-link.test.tsx
```

Do not introduce compatibility aliases for old names. If a name changes again,
change every call site in one hard cutover.

## Definition Of Done

`JsonForm` reaches the platonic ideal when all of this is true:

```txt
json-form.tsx is only a composition root.
Schema normalization is pure, single-path, and directly tested.
Path encoding is pure, single-owner, and cannot reset dirty values by accident.
JsonForm and JsonFormField have identical schema semantics.
Scalar controls are split by scalar family behind one small dispatcher.
Array table shell, row, body, scroll, config, and formatting concerns are separate.
Array table cell rendering, prop building, model facts, and commit normalization are separate.
Source linking is optional, keyboard-equivalent, live during scroll, and locally owned.
Source table hover state has one explicit controller.
Source naming is consistent from public prop to DOM attribute.
Large arrays pass profiler proof.
Source-linked scrolling passes profiler proof without unnecessary DOM churn.
Focused tests, architecture tests, typecheck, profiler scripts, and browser proof pass.
```

Everything except the final browser profiler proof is implemented and verified.
