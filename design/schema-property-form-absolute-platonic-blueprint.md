# Schema Property Form Absolute Platonic Blueprint

## Objective

Close the gap between the verified practical ideal and the literal ideal:

- simplicity
- speed
- everything needed
- nothing more
- perfect modularization
- high-entropy code
- perfectly consistent variable names
- Flaubertian precision

The previous final-gap blueprint is complete. This blueprint is narrower and
more demanding: it targets the few places where the code is correct but still
requires a small explanation.

## Current State

The property form is excellent.

- `TypeField` is a pure renderer over `PropertyTypeFieldModel`.
- Property type menu construction is separated from object-template injection.
- `PropertyFormViewModel.fields.schemaDetails` is the single top-level detail
  field.
- Recursive detail names are exact:
  `schemaDetails`, `rowSchemaDetails`, and `itemSchemaDetails`.
- `editable` and `disabled` are mostly separated by layer.
- `SchemaChipList` is item-model driven and shared.
- Object row identity is isolated in `object-property-row-identity.ts`.
- Architecture tests protect the main API shapes and deleted names.
- Typecheck, focused tests, lint, and e2e verification pass.

The remaining non-ideal surfaces:

- `PropertyObjectPropertiesFieldModel` still carries raw schema-domain inputs:
  `schemaNode`, `schemaContext`, `access`, and `onChange`.
- `ObjectPropertiesField` is both a model adapter and a renderer.
- Recursive object-row details are rendered through a callback:
  `renderSchemaDetails`.
- `SchemaChipList` owns both chip-list rendering and optional add-row rendering.
- Some model names still describe implementation shape instead of inevitable
  ownership boundaries.

These are not bugs. They are the last visible seams.

## Non-Negotiable Invariants

- No compatibility aliases, fallback APIs, or dual old/new surfaces.
- No schema mutation in JSX.
- No raw schema-domain inputs in pure renderers.
- No optional-feature imports from primitives.
- No render-prop escape hatch unless there is no clearer recursive ownership
  boundary.
- No list identity based on indexes.
- No model factory receives `disabled` unless it builds a native-control field.
- No one-file abstraction unless the name and boundary remove real local
  complexity.
- No test weakening.
- No visual regression of object rows, enum chips, grips, type menus, or
  description caret placement.

## Target Shape

### 1. Make Object Properties A Complete View Model

`PropertyObjectPropertiesFieldModel` should no longer be a schema-domain
construction packet.

Current shape:

```ts
interface PropertyObjectPropertiesFieldModel {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  mode: PropertyFormMode
  access: PropertySchemaDetailAccess
  editable: boolean
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}
```

Target shape:

```ts
interface PropertyObjectPropertiesFieldModel {
  addRow: ObjectPropertyAddRowModel
  editable: boolean
  rows: ObjectPropertyRowModel[]
}
```

Rules:

- Schema reads, schema writes, row IDs, row validation, and row detail creation
  belong in the object-properties model hook.
- `ObjectPropertiesField` receives `details: PropertyObjectPropertiesFieldModel`
  and renders only.
- The renderer must not call `useObjectPropertiesModel`.
- The renderer must not receive `schemaNode`, `schemaContext`, `access`,
  `mode`, or `onChange`.

Expected ownership:

- `createPropertySchemaDetails` decides whether object properties should exist.
- A hook or model builder near the recursive details renderer creates the object
  properties view model.
- `ObjectPropertiesField` renders object property rows and the add-row control.

Exit criteria:

- `interfaceProperties(PropertyObjectPropertiesFieldModel)` returns
  `["addRow", "editable", "rows"]`.
- `ObjectPropertiesField` imports no schema edit helpers and no model hook.
- `rg -n "schemaNode|schemaContext|access|mode|onChange" components/schema-editor/property-form/fields/object-properties-field.tsx`
  has no hits except native event prop names if unavoidable.

### 2. Remove The Recursive Render Callback

`renderSchemaDetails` is the last broad escape hatch.

Current shape:

```tsx
<ObjectPropertiesField
  details={objectProperties}
  renderSchemaDetails={(schemaDetails) => (
    <PropertySchemaDetailsField details={schemaDetails} />
  )}
/>
```

Target:

```tsx
<ObjectPropertiesField details={objectProperties} />
```

Rules:

- Object property row rendering should know that `row.rowSchemaDetails` is
  rendered by the schema-details renderer, not by an arbitrary callback.
- Avoid a direct import cycle. If needed, extract the recursive renderer into a
  tiny private helper module with one responsibility:
  `renderPropertySchemaDetails`.
- Do not generalize this into an app-wide slot or render-prop system.

Acceptable target:

```tsx
export function PropertySchemaDetailsField({ details }: Props) {
  return <PropertySchemaDetailsContent details={details} />
}

function PropertySchemaDetailsContent({ details }: Props) {
  ...
}
```

or:

```tsx
export function renderPropertySchemaDetails(details: PropertySchemaDetailsModel) {
  return <PropertySchemaDetailsField details={details} />
}
```

Decision rule:

- Prefer a component if JSX remains clearer.
- Prefer a function only if it removes an import cycle without creating a public
  renderer API.

Exit criteria:

- No `renderSchemaDetails` prop remains.
- No `renderPropertyDetails` compatibility name appears.
- Object row JSX renders `row.rowSchemaDetails` through the single recursive
  schema-details renderer.

### 3. Split `SchemaChipList` And `SchemaChipAddRow`

`SchemaChipList` is generic and correct, but it still owns two concepts:

- displaying and editing existing chips
- displaying the add-row input

The absolute shape separates them.

Target:

```tsx
<SchemaChipList
  editable={editable}
  items={items}
  onRemove={onRemove}
  onReplace={onReplace}
/>
{addRow && <SchemaChipAddRow editable={editable} row={addRow} />}
```

Target interfaces:

```ts
export interface SchemaChipListProps {
  editable: boolean
  items: SchemaChipItem[]
  onRemove: (id: string) => void
  onReplace: (id: string, value: string) => void
}

export interface SchemaChipAddRowProps {
  editable: boolean
  row: SchemaChipAddRowModel
}
```

Rules:

- `SchemaChipList` never knows about submitting new values.
- `SchemaChipAddRow` never knows about existing chips.
- Keep the compact chip contract unchanged:
  `bg-muted`, `px-1`, `shadow-none`.
- Keep add-row focus-after-submit behavior in the add-row component, not in enum
  adapters.

Exit criteria:

- `SchemaChipListProps` keys are
  `["editable", "items", "onRemove", "onReplace"]`.
- `SchemaChipAddRowProps` keys are `["editable", "row"]`.
- Property-form enum values and document enum values share both primitives where
  applicable.
- E2E chip visual assertions still pass.

### 4. Tighten Field Model Names

The current names are good. Absolute precision asks whether each name describes
what the thing is, not where it happens to be used.

Keep:

- `PropertyTypeFieldModel`
- `PropertySchemaDetailsModel`
- `PropertyObjectPropertiesFieldModel`
- `ObjectPropertyRowModel`
- `ObjectPropertyRowIdentity`

Review:

- `PropertySchemaDetailAccess`
- `PropertyFormSchemaContext`
- `PropertyDraftOperation`

Target vocabulary:

- `access`: whether a detail kind is available in this recursive context.
- `context`: stable schema environment, not mutable state.
- `operation`: reducer event, not UI command.
- `command`: external app-level side effect, such as create definition or
  install template.

Rules:

- Rename only if the new name removes ambiguity everywhere.
- Do not chase prettier nouns.
- If a name is already exact after review, freeze it with architecture tests.

Exit criteria:

- Architecture tests explicitly preserve final names.
- No scope uses two names for the same concept.
- No name contains a layer lie, such as a domain object pretending to be a pure
  view model.

### 5. Make Architecture Tests Prove The Absolute Shape

The existing tests already protect many boundaries. Extend them to prove the
last three exact shapes.

Add positive-shape tests for:

- `PropertyObjectPropertiesFieldModel`
- `ObjectPropertiesField` prop surface
- absence of `renderSchemaDetails`
- `SchemaChipListProps`
- `SchemaChipAddRowProps`
- final detail/access/context naming

Keep smell guards for:

- `rowDetails`
- `itemDetails`
- `schemaNodeDetails`
- `renderPropertyDetails`
- old chip add-row props inside `SchemaChipList`
- schema-domain construction inside pure renderers

Rules:

- Split forbidden strings inside tests so audit commands do not flag the test
  file itself.
- Prefer AST-based interface and prop assertions over broad string searches
  when the shape is concrete.

Exit criteria:

- A wrong prop name fails a shape test.
- A resurrected old name fails a smell guard.
- A raw schema-domain prop in a pure renderer fails a boundary test.

## Implementation Order

1. Extract object-properties model creation above `ObjectPropertiesField`.
2. Convert `PropertyObjectPropertiesFieldModel` into `{ addRow, editable, rows }`.
3. Make `ObjectPropertiesField` a pure renderer.
4. Remove the `renderSchemaDetails` prop and route recursion through one
   schema-details renderer.
5. Split `SchemaChipAddRow` out of `SchemaChipList`.
6. Review and freeze final naming.
7. Upgrade architecture tests to prove the absolute shape.
8. Run the verification matrix.

## Verification Matrix

Run:

```bash
pnpm typecheck
pnpm vitest run tests/schema-builder-architecture.test.ts tests/schema-editor-context.test.tsx tests/property-form.test.tsx tests/schema-editor-render.test.tsx tests/schema-property-reorder.test.ts tests/schema-document-view-model.test.ts
pnpm eslint components/schema-editor/primitives/schema-chip-list.tsx components/schema-editor/property-form/fields/enum-values-field.tsx components/schema-editor/property-form/fields/object-properties-field.tsx components/schema-editor/property-form/fields/object-properties-model.ts components/schema-editor/property-form/fields/object-property-row.tsx components/schema-editor/property-form/fields/object-property-row-identity.ts components/schema-editor/property-form/fields/property-schema-details-field.tsx components/schema-editor/property-form/model/property-schema-details.ts components/schema-editor/property-form/property-form-controller.ts components/schema-editor/property-form/property-form-shell.tsx components/schema-editor/property-form/types.ts tests/schema-builder-architecture.test.ts tests/property-form.test.tsx tests/schema-property-reorder.test.ts e2e/schema-property-form.spec.ts
pnpm test:e2e -- e2e/schema-property-form.spec.ts
```

Audit:

```bash
rg -n "renderSchemaDetails|renderPropertyDetails|rowDetails|itemDetails|schemaNodeDetails" components/schema-editor/property-form tests/schema-builder-architecture.test.ts -S
rg -n "schemaNode|schemaContext|access|mode|onChange" components/schema-editor/property-form/fields/object-properties-field.tsx -S
rg -n "addRow\\?:|SchemaChipAddRow" components/schema-editor/primitives/schema-chip-list.tsx -S
```

Expected audit result:

- no recursive render callback
- no old detail names
- no schema-domain construction props in `ObjectPropertiesField`
- no add-row API inside `SchemaChipListProps`

## Completion Standard

The absolute ideal is reached when this sentence is true without explanation:

> The controller and model hooks own schema-domain construction; every field
> component renders a complete view model; recursive schema details render
> through one exact renderer; schema primitives each own one generic UI concept;
> names reveal layer and responsibility immediately; architecture tests protect
> those boundaries as positive API shapes.

If `ObjectPropertiesField` still receives schema-domain inputs, if object-row
details still require a render callback, or if `SchemaChipList` still owns the
add-row control, the system remains excellent but not absolute.
