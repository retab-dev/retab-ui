# JSON Form Platonic Ideal Blueprint

Last audited: 2026-06-16

## Objective

Define the final shape of `JsonForm` as a schema-driven editable form component.

The standard is perfection:

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

The current implementation is strong, but it is not the platonic ideal. It has
serious behavior coverage, lazy mounting, dense table mode, virtualization, and
source linking. The remaining problems are boundary problems: too many domains
live in one file, a few schema paths are not normalized identically, and source
linking is partly embedded in table implementation details.

## Current Verdict

`JsonForm` is useful and well-tested. After the 2026-06-16 implementation pass,
it is much closer to inevitable, but final performance proof is still pending.

The good center is:

```txt
JsonForm owns whole-form rendering and submit decoding.
JsonFormField owns one field path.
schema-utils owns JSON Schema expansion and classification.
form-primitives owns local shadcn-compatible form parts.
Flat scalar object arrays render as editable tables.
Large arrays avoid mounting every row.
Source linking is opt-in.
```

The implemented center is now sharper:

```txt
Schema model produces normalized render nodes.
Path codec owns react-hook-form path encoding and output decoding.
Scalar controls own scalar editing only.
Array table owns grid interaction only.
Source link adapter owns field preview and selection only.
JsonForm composes these pieces and owns no low-level mechanics.
```

Implementation checkpoint:

- `json-form.tsx` is a composition root for schema normalization, form context,
  source-link context, encoded initial values, root rendering, and submit
  decoding.
- `schema-model.ts` owns schema expansion, nullable unwrapping, field
  classification, array item resolution, dynamic object property matching, and
  table column detection.
- `path-codec.ts` owns encoded form paths, source paths, encoded value
  round-trips, and empty encoded array item values.
- `scalar-control.tsx`, `source-link.tsx`, `object-fields.tsx`,
  `array-fields.tsx`, `array-table.tsx`, `disclosure.tsx`, and
  `virtual-list.tsx` now each have one coherent owner concept.
- The public source-link prop is `sourceLink`; the old `anchorLink` compatibility
  path is gone.

## Non-Negotiable Contract

`JsonForm` should accept:

```tsx
<JsonForm
  form={form}
  schema={schema}
  onSubmit={onSubmit}
  textInput="input"
  sourceLink={sourceLink}
  defaultOpenPaths={["transactions"]}
>
  <Button type="submit">Save</Button>
</JsonForm>
```

`JsonFormField` should accept:

```tsx
<JsonFormField name="vendor.name" schema={schema} />
```

Both APIs must use the same schema normalization and the same path codec. A
single-field render should not be a weaker version of whole-form render.

## Current Strengths

The component already earns its place:

- `JsonForm` delegates form state to `react-hook-form`.
- Scalar fields render through local `FormField` primitives.
- Nested objects and arrays lazy-mount behind disclosure rows.
- Flat scalar object arrays collapse into a dense editable table.
- Large card arrays use `@tanstack/react-virtual`.
- Large table arrays use fixed-row virtualization.
- Special object keys round-trip through an encoded form path.
- Nullable scalar, enum, date, time, date-time, boolean, tuple array,
  `additionalProperties`, and `patternProperties` cases have tests.
- Source hover and selection work in table and non-table contexts.

These strengths should be preserved. The blueprint is not a rewrite for novelty.
It is a compression pass that makes the current behavior easier to reason about
and harder to regress.

## Platonic Module Boundaries

### `components/json-form/schema-model.ts`

Owns schema normalization.

Responsibilities:

- expand local `$ref`;
- merge `allOf`;
- unwrap nullable unions;
- classify field kind;
- resolve array item schemas;
- resolve static, pattern, and additional properties;
- produce stable render descriptors.

It should not import React.

Ideal exports:

```ts
export type JsonFormSchemaNode
export type JsonFormFieldKind
export type JsonFormColumn

export function normalizeJsonFormSchema(schema: JSONSchema7): JsonFormSchemaNode
export function jsonFormFieldKind(schema: JsonFormSchemaNode): JsonFormFieldKind
export function jsonFormObjectEntries(node: JsonFormSchemaNode, value: unknown): JsonFormObjectEntry[]
export function jsonFormArrayItemNode(node: JsonFormSchemaNode, index: number): JsonFormSchemaNode
export function jsonFormTableColumns(node: JsonFormSchemaNode): JsonFormColumn[] | null
export function emptyJsonFormValue(node: JsonFormSchemaNode): unknown
```

`expandRefs`, `unwrapNullable`, `fieldKind`, `scalarObjectColumns`,
`emptyValueFor`, and the dynamic-property helpers should converge here.

### `components/json-form/path-codec.ts`

Owns the mismatch between logical JSON keys and `react-hook-form` dot paths.

Responsibilities:

- encode one object key;
- decode one object key;
- join form paths;
- join source/logical paths;
- encode default values before form rendering;
- decode submit values after form rendering;
- decide whether a schema requires encoded paths.

It should not import React.

Ideal exports:

```ts
export function encodeJsonFormKey(key: string): string
export function decodeJsonFormKey(key: string): string
export function joinJsonFormPath(parent: string, key: string | number): string
export function joinJsonSourcePath(parent: string, key: string | number): string
export function schemaNeedsJsonFormPathEncoding(
  node: JsonFormSchemaNode
): boolean
export function encodeJsonFormValue(
  node: JsonFormSchemaNode,
  value: unknown
): unknown
export function decodeJsonFormValue(
  node: JsonFormSchemaNode,
  value: unknown
): unknown
```

The codec must be pure and testable. It must not reset form state by schema
object identity.

### `components/json-form/scalar-control.tsx`

Owns scalar editing.

Responsibilities:

- string input;
- textarea;
- number and integer input;
- boolean checkbox;
- nullable boolean select;
- enum select;
- date, time, and date-time picker;
- compact cell editor variant.

It should not know about objects, arrays, source links, disclosure, or table row
virtualization.

### `components/json-form/source-link.tsx`

Owns optional field source interactions.

Responsibilities:

- expose one provider for active source path and source actions;
- wrap scalar leaves;
- expose table-cell props without requiring table code to mutate DOM manually;
- provide keyboard-equivalent selection for scalar leaves and table cells.

The prop name should be exact. The historical public prop was `anchorLink`, but
the actual model is a source field link. The implemented name is `sourceLink`;
there should be no compatibility shim or lingering call sites.

### `components/json-form/object-fields.tsx`

Owns object rendering.

Responsibilities:

- disclosure state;
- object summary;
- static entries;
- dynamic entries from current value;
- recursive field rendering.

It should consume normalized schema nodes and path helpers. It should not expand
refs, encode values, or know about table behavior.

### `components/json-form/array-fields.tsx`

Owns array rendering choice.

Responsibilities:

- add/remove constraints;
- empty item creation;
- card mode;
- table mode dispatch;
- tuple item schema selection.

It should not own cell editing internals.

### `components/json-form/array-table.tsx`

Owns dense scalar object array editing.

Responsibilities:

- grid template and width;
- row rendering;
- editor activation;
- keyboard activation;
- scroll body selection;
- fixed-row virtualization;
- row-local value subscription strategy.

It should consume `JsonFormColumn[]` and `ScalarControl`. It should not contain
schema expansion, path encoding, or source model definitions.

### `components/json-form/disclosure.tsx`

Owns disclosure UI only.

Responsibilities:

- arrow state;
- title;
- summary;
- description tooltip;
- action slot.

This is small, but extracting it removes a repeated visual primitive from the
main composition file and gives object and array rendering the same vocabulary.

### `components/json-form/json-form.tsx`

Owns composition only.

Responsibilities:

- normalize schema once;
- provide form context;
- provide source link context;
- encode initial values when required;
- render root fields;
- decode submitted data.

It should not contain table event machinery, date parsing, path encoding, or
schema recursion helpers.

## Defects Blocking The Ideal

### 1. Schema Identity Can Reset Encoded Forms

Status: fixed in the implementation pass; encoded initial values are reset once
per mounted form, not every time the schema object identity changes.

Historical location:

```txt
components/json-form/json-form.tsx
  expandedSchema memoized from schema object identity
  encoded-path effect calls form.reset(...)
```

Problem:

Schemas that require path encoding can reset current form values whenever a
parent recreates the schema object. This is especially risky for inline schemas
and dynamic parent renders.

Ideal:

Encoding should happen through an explicit initialization path that is stable for
the mounted form, not through an effect tied to schema object identity. If schema
changes are supported, they should be treated as a deliberate schema replacement
with clear reset semantics.

Required tests:

- inline schema object rerender preserves dirty encoded-key edits;
- changing unrelated parent state does not call `form.reset`;
- deliberate schema replacement updates rendered fields without silently losing
  edited values unless the caller resets the form.

### 2. `JsonFormField` Does Not Normalize Like `JsonForm`

Status: fixed; `JsonFormField` now always normalizes through `expandRefs`.

Historical location:

```txt
components/json-form/json-form.tsx
  JsonFormField expands refs only when $ref/$defs/definitions are present
```

Problem:

`JsonFormField` is documented as the unit of composition, but standalone fields
can miss schema composition such as `allOf`.

Ideal:

`JsonFormField` should accept either raw schema or a normalized node. If it
accepts raw schema, it must normalize through the same path as `JsonForm`.

Required tests:

- standalone `JsonFormField` renders an `allOf` object;
- standalone `JsonFormField` renders `anyOf` nullable metadata;
- standalone `JsonFormField` handles local `$defs` with sibling overrides.

### 3. `allOf` Expansion Returns Before Recursive Sibling Expansion

Status: fixed in `schema-model.ts`; `allOf` branches merge before sibling
children are recursively normalized.

Historical location:

```txt
components/json-form/schema-utils.ts
  expandRefs returns immediately from allOf branch
```

Problem:

When a schema node contains `allOf` and sibling `properties`, `items`,
`additionalProperties`, or `patternProperties`, sibling nodes can avoid the later
recursive expansion pass.

Ideal:

Schema normalization should be a pipeline:

```txt
resolve ref
merge composition
normalize children
classify
```

No branch should skip child normalization.

Required tests:

- `allOf` plus sibling property refs expand fully;
- `allOf` plus sibling array item refs expand fully;
- `allOf` plus sibling additionalProperties refs expand fully.

### 4. Source Selection Is Not Fully Keyboard Equivalent

Status: fixed for scalar Enter selection without hijacking input Space, and
preserved for table-cell Enter/Space activation.

Historical location:

```txt
components/json-form/json-form.tsx
  SourceFieldLinkShell
  ArrayTable keyboard handlers
```

Problem:

Table cells support Enter/Space activation. Non-table scalar source shells rely
on click for persistent selection.

Ideal:

Every source-linked scalar field should expose the same interaction contract:

```txt
hover/focus previews
click selects
Enter selects
Space selects when focus is on the source shell
blur clears preview
```

Required tests:

- focused source-linked scalar field selects on Enter;
- focused source-linked scalar field selects on Space where appropriate;
- text input Space still types a space and does not hijack editing;
- table source-cell behavior remains unchanged.

### 5. Documentation Names The Wrong Hook

Status: fixed; docs now use `useSegmentedSourceFieldLink`.

Historical location:

```txt
content/docs/components/json-form.mdx
  useAnchoredSourceFieldLink
```

Problem:

Docs mention an old hook while the current source-link model exposes
`useSegmentedSourceFieldLink`.

Ideal:

Docs should use the same names as the shipped API. Architecture tests already
ban the old hook in several source-viewer paths; the docs should agree.

Required tests:

- docs text does not mention `useAnchoredSourceFieldLink`;
- docs text does mention `useSegmentedSourceFieldLink`.

## Final Implementation Sequence

### Phase 1: Extract Pure Schema And Path Logic

Move pure helpers out of `json-form.tsx`:

```txt
encodeFormSegment
decodeFormSegment
joinFormPath
joinSourcePath
schemaUsesEncodedPaths
encodeValueForForm
decodeValueFromForm
emptyArrayItemValue
arrayItemSchemaAt
canAppendArrayItem
canRemoveArrayItem
dynamic property helpers
```

Keep exported behavior unchanged. Add focused unit tests for the extracted
modules before changing component behavior.

Success condition:

```txt
json-form.tsx loses pure schema/path machinery.
All existing JsonForm tests pass.
New path-codec tests cover encoded keys and dirty-value preservation.
```

### Phase 2: Make Normalization Single-Path

Replace ad hoc `expandRefs` calls with one normalized schema model.

Success condition:

```txt
JsonForm and JsonFormField normalize identically.
allOf sibling recursion bugs are closed.
Schema utility tests describe normalization behavior, not implementation details.
```

### Phase 3: Extract Scalar Controls

Move scalar editing and date/time helpers into `scalar-control.tsx`.

Success condition:

```txt
ScalarControl receives kind, schema, value adapter, compact flag, and nullable flag.
It does not import object, array, source, or virtualization code.
JsonForm table and regular fields share the same scalar editor.
```

### Phase 4: Extract Source Link Adapter

Move source-link contexts, shell, and table-cell source helpers into
`source-link.tsx`.

Success condition:

```txt
Non-table and table source interactions share one vocabulary.
Keyboard selection is complete.
ArrayTable no longer manually owns active source DOM mutation if a declarative
cell prop can express the state without regressing hover performance.
```

If imperative DOM mutation is still required for table hover performance, it
must be isolated in `source-link.tsx` and named as a performance adapter.

### Phase 5: Extract Object, Array, And Table Renderers

Split rendering:

```txt
object-fields.tsx
array-fields.tsx
array-table.tsx
disclosure.tsx
virtual-list.tsx
```

Success condition:

```txt
json-form.tsx becomes a small composition root.
Each file has one owner concept.
No file needs a section divider comment to be readable.
```

### Phase 6: Rename `anchorLink` To `sourceLink`

Make the public API match the model.

Required call-site updates:

```txt
registry/new-york-v4/blocks/json-form-sources-block.tsx
registry/new-york-v4/blocks/sources-viewer-block.tsx
registry/new-york-v4/blocks/extract-viewer-block.tsx
tests/json-form.test.tsx
tests/sources.test.tsx
content/docs/components/json-form.mdx
public registry payloads after registry build
```

No compatibility shim. Update the call sites and tests in the same change.

## Testing Standard

The minimum proof after the blueprint is implemented:

```txt
pnpm exec vitest run \
  tests/json-form-schema-model.test.ts \
  tests/json-form-path-codec.test.ts \
  tests/json-form.test.tsx \
  tests/json-form-edge.test.tsx
```

Add:

```txt
tests/json-form-source-link.test.tsx
```

Run architecture/docs tests touched by naming changes:

```txt
pnpm exec vitest run tests/viewer-architecture.test.ts
```

Run performance profiles when table source-link or virtualization internals
change:

```txt
node scripts/profile-json-form-large-array.mjs
node scripts/profile-json-form-sources-interactions.mjs
```

If these profiles require a dev server, ask the user to start it. Do not start,
stop, or restart dev servers from this repository.

## Definition Of Done

The component reaches the platonic ideal when all of this is true:

```txt
json-form.tsx is a composition root, not the whole implementation.
Schema normalization is pure, single-path, and fully tested.
Path encoding is pure, single-owner, and cannot reset dirty values by accident.
JsonForm and JsonFormField have identical schema semantics.
Scalar controls are shared between regular fields and table cells.
Source linking is optional, keyboard-equivalent, and locally owned.
Array table code contains only table concerns.
Docs use the current public names.
Focused tests and performance scripts pass.
```

Nothing more is needed. Nothing less is enough.
