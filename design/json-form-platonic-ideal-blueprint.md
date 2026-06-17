# JSON Form Platonic Ideal Blueprint

Last audited: 2026-06-17

## Verdict

`JsonForm` is strong. It is not yet perfect.

The component has already crossed the important architectural threshold:
schema normalization, path encoding, source linking, object rendering, array
rendering, disclosure, virtual lists, and table support no longer all live in
one file.

The remaining work is not a rewrite. It is a convergence pass.

```txt
Keep every behavior.
Delete duplicate owners.
Finish the table extraction.
Split scalar controls by family.
Make source-link scheduling mechanically obvious.
Prove speed with profiles, not taste.
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

## Current Strong Center

The current shape is close:

- `json-form.tsx` is a composition root for schema, form context, source links,
  initial encoded values, root rendering, and submit decoding.
- `schema-model.ts` owns schema expansion, nullable unwrapping, field
  classification, array item resolution, dynamic properties, and table column
  detection.
- `path-codec.ts` owns encoded form paths, logical source paths, encoded value
  round-trips, and empty encoded array item values.
- `source-link.tsx` owns source-link context, scalar shells, table-cell active
  marking, pointer tracking, and scroll-hover recovery.
- `object-fields.tsx`, `array-fields.tsx`, `virtual-list.tsx`, and
  `disclosure.tsx` own coherent rendering primitives.
- `components/json-form/table/*` exists and points at the right final
  boundaries: cell, body, scroll, format, and config.
- The public prop is `sourceLink`.
- The table DOM contract is `data-source-path` / `data-source-active`.
- The scroll-hover bug is fixed: source hover restores to the cell under the
  pointer after table scroll, even when `onFieldHover(null)` causes a rerender.

The public API should stay small:

```tsx
<JsonForm
  form={form}
  schema={schema}
  sourceLink={sourceLink}
  defaultOpenPaths={["transactions"]}
  onSubmit={onSubmit}
>
  <Button type="submit">Save</Button>
</JsonForm>
```

```tsx
<JsonFormField name="vendor.name" schema={schema} />
```

## Remaining Blockers

### 1. Table Extraction Is Half-Finished

Current problem:

`components/json-form/table/array-table-cell.tsx`,
`array-table-body.tsx`, `array-table-scroll.ts`, `array-table-format.ts`, and
`array-table-config.ts` exist, but `components/json-form/array-table.tsx` still
contains local row rendering, local table body imports, local table constants,
local formatting, local cell rendering, and local cell commit normalization.

That creates two meanings for the same component:

```txt
table/array-table-cell.tsx
  the intended extracted table-cell implementation

array-table.tsx
  the implementation actually rendered today
```

This violates the ideal more than a large file would. Duplicate ownership is
worse than no extraction.

Target:

```txt
array-table.tsx
  table shell, column header, click/key activation, mode dispatch

table/array-table-row.tsx
  row layout, row value subscription, column iteration, remove button

table/array-table-cell.tsx
  display cell, editable cell props, editor routing, commit normalization

table/array-table-body.tsx
  static body and fixed-row virtualized body

table/array-table-scroll.ts
  stable scroll listener, latest callback refs, scroll-end timer

table/array-table-format.ts
  display formatting and data-cell kind mapping

table/array-table-config.ts
  table height, row height, virtualization thresholds
```

Success condition:

```txt
rg "function ArrayTableCellEditor|function formatTableCellValue|TABLE_MAX_HEIGHT|useArrayTableScrollActivity" components/json-form/array-table.tsx
```

returns nothing.

### 2. `array-table.tsx` Still Carries Row-Level Weight

Current problem:

Even after the intended table modules exist, the rendered table shell still owns
row subscription strategy, value lookup, path construction, cell model facts,
remove-button rendering, and row styles.

Target:

`ArrayTable` should read in one pass:

```txt
derive columns layout
derive active editor path
derive source table handlers
render header
choose static body or virtualized body
```

Everything per-row moves to `table/array-table-row.tsx`.

Success condition:

`array-table.tsx` contains no `useWatch`, no `useController`, no `DataCell`, no
`ScalarControl`, and no per-column cell branch.

### 3. `scalar-control.tsx` Mixes Too Many Families

Current problem:

`scalar-control.tsx` still owns enum equality, enum labels, nullable boolean
select, number parsing, compact table-cell editing, date/time parsing,
date/time picker state, textarea rendering, and plain input rendering.

It is coherent by domain, but not yet ideal by responsibility.

Target:

```txt
scalar-control.tsx
  dispatch only

scalar/enum-control.tsx
  enum labels, equality, enum select

scalar/number-control.tsx
  integer/number input and compact number cell editing

scalar/date-time-control.tsx
  date, time, date-time parsing and picker UI

scalar/text-control.tsx
  input, textarea, compact text cell editing

scalar/boolean-control.tsx
  checkbox and nullable boolean select
```

Success condition:

Each scalar family can be understood, changed, and tested without reading every
other scalar family.

### 4. Source-Link Scheduling Is Correct But Not Crystalline

Current problem:

`source-link.tsx` now correctly keeps source hover live during table scroll.
The implementation still has two scheduling channels:

```txt
pendingHoverFrameRef
pendingScrollHoverFrameRef
latestScrollHoverAtRef
latestPointerPointRef
hoveredSourcePathRef
activeSourceCellRef
```

These are justified by performance, but the final form should make the state
machine impossible to misread.

Target:

One small table-source hover controller with explicit states:

```txt
idle
hovering(path)
scrolling(lastPointerPoint, lastReportedPath)
```

Required invariants:

- normal pointer moves report once per animation frame;
- scroll moves sample `elementFromPoint` at a bounded cadence;
- scroll end always samples once after the final scroll event;
- `onFieldHover` fires only when the logical source path changes;
- `data-source-active` mutates only when the active DOM cell changes;
- cleanup cannot cancel a scroll-end restore after a source-link rerender.

Success condition:

Browser proof on `/blocks/sources-viewer`:

```txt
hover transactions.4.description
wheel-scroll the transaction table with the pointer stationary
after scroll: activePath === elementFromPoint(...).closest("[data-table-cell]").dataset.sourcePath
```

Profiler proof:

```txt
scroll-transactions-table ends with activeSourceCells: 1
source-link remains live during scrolling
attribute churn is bounded and lower than the current live-scroll baseline
```

### 5. Source Naming Is Mostly Fixed, But The Type Boundary Still Leaks History

Current problem:

The component API and DOM use source naming, but the shared UI type is still
`SourceFieldLink`, and some implementation names mix `field`, `source`,
`activePath`, `sourcePath`, and `logicalPath`.

This is acceptable engineering. It is not Flaubertian.

Target vocabulary:

```txt
sourceLink
sourcePath
activeSourcePath
hoverSourcePath
selectSourcePath
sourceLinked
data-source-path
data-source-active
```

Terms to avoid in `components/json-form`:

```txt
anchor
logicalPath
fieldActions
activePath, when the value specifically means active source path
```

Success condition:

```txt
rg "anchor|logicalPath|FieldActions|activePath" components/json-form tests/json-form*.tsx
```

returns only unrelated or deliberately documented matches.

### 6. Pure Model Proof Is Incomplete

Current problem:

The code already has pure modules for schema and path logic, but the final ideal
requires direct proof that these modules cannot regress through renderer tests
alone.

Target test files:

```txt
tests/json-form-schema-model.test.ts
tests/json-form-path-codec.test.ts
tests/json-form-source-link.test.tsx
```

Required coverage:

- `$ref`, `$defs`, `definitions`, `allOf`, nullable unions;
- dynamic properties from `additionalProperties` and `patternProperties`;
- encoded keys containing `.`, `[`, `]`, and empty strings;
- dirty encoded values do not reset on parent rerender;
- `JsonForm` and `JsonFormField` normalize through the same path;
- source-linked scalar and table cells have equivalent hover, focus, blur,
  click, and keyboard selection behavior.

## Target Module Map

Final `components/json-form` shape:

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

scalar-control.tsx
scalar/enum-control.tsx
scalar/number-control.tsx
scalar/date-time-control.tsx
scalar/text-control.tsx
scalar/boolean-control.tsx

table/array-table.tsx
table/array-table-row.tsx
table/array-table-cell.tsx
table/array-table-body.tsx
table/array-table-scroll.ts
table/array-table-format.ts
table/array-table-config.ts
```

This map is not a style preference. Each file names one owner concept.

## Implementation Sequence

### Phase 1: Make The Table Extraction Real

Wire the existing `components/json-form/table/*` modules into the rendered
table. Move `ArrayTableRow` out of `array-table.tsx`. Delete the local duplicate
cell, body, scroll, format, and constant code.

Run:

```txt
pnpm exec vitest run tests/json-form.test.tsx tests/json-form-edge.test.tsx
pnpm exec vitest run tests/sources.test.tsx
```

### Phase 2: Prove Source Scroll Behavior In Its Own Test File

Move the scroll-hover regression out of the broad form test into
`tests/json-form-source-link.test.tsx`, and keep a small integration assertion
in `tests/json-form.test.tsx` only if needed.

Run:

```txt
pnpm exec vitest run tests/json-form-source-link.test.tsx tests/json-form.test.tsx
```

Browser proof:

```txt
http://localhost:3100/blocks/sources-viewer
expand Transactions
hover a visible description cell
wheel-scroll inside the table
verify active source path equals the cell under the pointer
```

### Phase 3: Compress Table Cell Rendering

Make `ArrayTableCellModel` the only way a row talks to a cell. The row builds
facts; the cell owns display, edit, commit normalization, and `DataCell` props.

Run:

```txt
pnpm exec vitest run tests/json-form.test.tsx tests/json-form-edge.test.tsx
```

### Phase 4: Split Scalar Families

Create the `scalar/*` files. Keep `ScalarControl` as the public dispatcher so
call sites do not grow.

Run:

```txt
pnpm exec vitest run tests/json-form.test.tsx tests/json-form-edge.test.tsx
pnpm exec tsc --noEmit
```

### Phase 5: Normalize Source Vocabulary

Rename internal source-link variables to the target vocabulary. Do not change
public behavior. Do not add aliases.

Run:

```txt
pnpm exec vitest run tests/json-form-source-link.test.tsx tests/sources.test.tsx
rg "anchor|logicalPath|FieldActions" components/json-form tests/json-form*.tsx
```

### Phase 6: Add Pure Model Tests And Architecture Guards

Add direct tests for schema and path modules. Add a small architecture guard
that prevents table-cell code from returning to `array-table.tsx`.

Run:

```txt
pnpm exec vitest run \
  tests/json-form-schema-model.test.ts \
  tests/json-form-path-codec.test.ts \
  tests/json-form-source-link.test.tsx \
  tests/json-form.test.tsx \
  tests/json-form-edge.test.tsx
```

### Phase 7: Profile The Final Shape

Run large-array and source-interaction profiles after the extraction and naming
work. Compare against the current baseline; do not accept a cleaner structure
that makes the table slower.

Run:

```txt
node scripts/profile-json-form-large-array.mjs
node scripts/profile-json-form-sources-interactions.mjs
```

If a profiler requires a dev server, use an existing server or ask for one. Do
not restart a user-owned server without permission.

## Required Final Proof

Minimum proof for the completed ideal pass:

```txt
pnpm exec vitest run \
  tests/json-form-schema-model.test.ts \
  tests/json-form-path-codec.test.ts \
  tests/json-form-source-link.test.tsx \
  tests/json-form.test.tsx \
  tests/json-form-edge.test.tsx \
  tests/sources.test.tsx

pnpm exec vitest run tests/viewer-architecture.test.ts
pnpm exec tsc --noEmit
node scripts/profile-json-form-large-array.mjs
node scripts/profile-json-form-sources-interactions.mjs
```

Plus one browser check on the real sources viewer after any source-link or table
scroll change.

## Definition Of Done

`JsonForm` reaches the platonic ideal when all of this is true:

```txt
json-form.tsx is only a composition root.
Schema normalization is pure, single-path, and directly tested.
Path encoding is pure, single-owner, and cannot reset dirty values by accident.
JsonForm and JsonFormField have identical schema semantics.
Scalar controls are split by scalar family behind one small dispatcher.
Array table shell, row, cell, body, scroll, config, and formatting concerns are separate.
No table implementation exists in two places.
Source linking is optional, keyboard-equivalent, live during scroll, and locally owned.
Source naming is consistent from public prop to DOM attribute.
Large arrays remain fast.
Source-linked scrolling remains live without unnecessary DOM churn.
Focused tests, architecture tests, typecheck, profiler scripts, and browser proof pass.
```

Nothing more is needed. Nothing less is enough.
