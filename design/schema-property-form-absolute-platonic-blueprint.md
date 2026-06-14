# Schema Property Form Absolute Platonic Blueprint

## Verdict

Not yet.

The component is close enough that the remaining imperfections are architectural
rather than behavioral. The user-facing shape is strong: object fields look like
schema-builder rows, enum chips share the compact visual primitive, drag grips
exist, description caret placement is fixed, and the focused verification matrix
passes.

The remaining gap is the kind that matters only when the code is read slowly:
some names and module boundaries still explain the implementation instead of
making it feel inevitable.

## Current Truth

These pieces are already in the right direction:

- `SchemaChipList` renders existing chips only.
- `SchemaChipAddRow` renders chip creation only.
- `ObjectPropertiesField` receives a completed object-properties field model.
- `useObjectPropertiesModel` owns object row identity, add-row state, row
  validation, row schema mutation, and nested row detail construction.
- `PropertySchemaDetailsField` is the recursive schema-details component.
- `renderPropertySchemaDetails` removes the old broad render callback.
- Architecture tests protect the deleted legacy files, primitive split, object
  field model shape, recursive names, and several forbidden old seams.

The system is excellent. It is not yet Flaubertian.

## Remaining Non-Ideal Surfaces

### 1. `PropertySchemaDetailsModel` Is Not One Kind Of Thing

`PropertySchemaDetailsModel` currently contains mostly ready-to-render field
models:

- `type?: PropertyTypeFieldModel`
- `enumValues?: PropertyEnumValuesFieldModel`
- `arrayItems?: PropertyArrayItemsFieldModel`

But `objectProperties` is different:

- `objectProperties?: PropertyObjectPropertiesSourceModel`

That means the type named `PropertySchemaDetailsModel` is partly a field model
and partly an adapter input. The code works, but the name is carrying a small
lie.

Target:

- Rename the current mixed structure to a name that admits what it is, such as
  `PropertySchemaDetailsPlan`.
- Introduce `PropertySchemaDetailsFieldModel` only if it can be made genuinely
  complete without violating React hook rules.
- Keep recursive object-property state inside a component or hook boundary,
  because each object branch owns local add-row state and row identity.

Preferred shape:

```ts
interface PropertySchemaDetailsPlan {
  type?: PropertyTypeFieldModel
  enumValues?: PropertyEnumValuesFieldModel
  objectProperties?: PropertyObjectPropertiesPlan
  arrayItems?: PropertyArrayItemsPlan
}
```

Rules:

- Do not pretend a recursive, stateful object branch is a static view model.
- Do not materialize a full recursive tree in one hook if that creates hook
  order hazards.
- Let the name describe the truth: a plan is pure schema-derived structure; a
  field model is complete render input.

Exit criteria:

- No type named `PropertySchemaDetailsModel` remains unless it is fully a view
  model.
- Object-properties adapter input is named `PropertyObjectPropertiesPlan`, not
  `SourceModel`.
- `PropertySchemaDetailsField` reads as a plan resolver plus a pure details
  content component.

### 2. Central Form Types Import Field-Local Object Models

`property-form/types.ts` imports:

```ts
ObjectPropertyAddRowModel
ObjectPropertyRowModel
```

from `fields/object-properties-model.ts`.

That inverts ownership. The central type file should not depend on a field-side
model hook module. The hook should consume shared contracts, not define the
contracts that central form state imports.

Target:

- Extract object-property contracts into a small ownership-neutral module:
  `fields/object-properties-types.ts` or
  `property-form/model/object-properties-view.ts`.
- Keep implementation hooks in `object-properties-model.ts`.
- Keep renderers in `object-properties-field.tsx` and
  `object-property-row.tsx`.

Rules:

- Shared contracts may import `PropertyTypeFieldModel` and
  `PropertySchemaDetailsPlan`.
- Shared contracts must not import React hooks, schema edit helpers, or UI
  components.
- `property-form/types.ts` must not import from a file whose primary export is a
  hook or JSX renderer.

Exit criteria:

- `property-form/types.ts` imports object-property contracts from a pure type
  module.
- `object-properties-model.ts` exports behavior, not central contracts.
- Architecture tests fail if `property-form/types.ts` imports from
  `fields/object-properties-model`.

### 3. The Details Component Is Still Both Resolver And Renderer

`PropertySchemaDetailsField` currently:

- renders type details
- renders enum details
- resolves object-properties plan into an object-properties field model
- renders array item recursion

That is acceptable, but the ideal shape separates the stateful branch resolver
from the stateless content renderer.

Target:

```tsx
export function PropertySchemaDetailsField({ plan }: Props) {
  const details = usePropertySchemaDetailsFieldModel(plan)
  return <PropertySchemaDetailsContent details={details} />
}
```

If a fully complete recursive field model is not hook-safe, use the narrower
split:

```tsx
export function PropertySchemaDetailsField({ plan }: Props) {
  return <PropertySchemaDetailsContent plan={plan} />
}

function PropertyObjectPropertiesPlanField({ plan }: Props) {
  const details = useObjectPropertiesModel(plan)
  return <ObjectPropertiesField details={details} />
}
```

Decision rule:

- Prefer the second shape if it keeps recursive hook ownership obvious.
- Prefer the first shape only if the hook count is stable and the resulting
  model is genuinely complete.

Exit criteria:

- The public recursive component receives `plan`, not `details`.
- Any stateful object branch resolver is named as a resolver, not as a pure
  renderer.
- The pure content function has no hook calls.

### 4. Add-Row Primitives Are Split By Visual Variant, Not By Contract

There are two add-row primitives:

- `SchemaAddRow`
- `SchemaChipAddRow`

They share a core concept:

- input label
- placeholder
- value
- change handler
- submit label
- submit handler
- disabled/editable gate
- empty-value prevention

They differ in:

- error rendering
- width and spacing
- focus-after-submit behavior
- chip-specific compactness

This is not duplication large enough to be harmful, but it is enough to ask
whether the primitive contract should be unified.

Target:

- Extract a shared `SchemaAddInputModel` only if it reduces both call sites
  without adding variant ceremony.
- Keep visual components separate if a unified component requires mode props
  such as `variant="chip" | "object"` and optional bags.

Preferred contract:

```ts
interface SchemaAddInputModel {
  error?: string | null
  focusAfterSubmit?: boolean
  inputLabel: string
  placeholder: string
  submitLabel: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}
```

Rules:

- Share the model before sharing the JSX.
- Do not make `SchemaAddRow` understand chips.
- Do not make `SchemaChipAddRow` understand object properties.
- If unification makes either component harder to read, stop at shared types.

Exit criteria:

- Add-row model naming is identical across enum chips and object properties.
- There is no duplicated local concept named `row`, `addRow`, and `model` for
  the same input packet in adjacent modules.
- Architecture tests protect either the deliberate split or the unified
  contract.

### 5. Enum Value Identity Is Still Positional In Property Form

Document enum entries have stable IDs. Property-form enum values use generated
IDs based on array index:

```ts
id: `enum-value-${index}`
```

This is fine for a simple array editor, but the ideal code makes the tradeoff
explicit.

Target:

- Keep positional IDs if enum values are not reorderable and React state does
  not attach per-chip identity.
- Add an architecture comment or test that documents why this differs from
  document enum entries.
- If enum chips ever gain reorder, focus restore, or per-chip local state,
  introduce stable enum item identity at the model layer.

Exit criteria:

- The property-form enum path either has stable IDs or has a clear invariant
  test proving positional IDs are safe.
- No future feature can accidentally add reorder on top of index identity
  without failing a test.

### 6. Naming Still Has A Few Transitional Words

Names that deserve one final pass:

- `PropertyObjectPropertiesSourceModel`
- `PropertySchemaDetailsModel`
- `rowSchemaDetails`
- `itemSchemaDetails`
- `renderPropertySchemaDetails`
- `details` props on components that receive a plan
- `row` props on add-row primitives

Target vocabulary:

- `plan`: pure schema-derived structure that may require stateful resolution.
- `details`: complete render input.
- `field`: UI component or UI model for one form field.
- `row`: an existing list item, not an add input.
- `addInput` or `addField`: the input packet for creating a new item.
- `renderer`: a tiny cycle-breaker only when a component import would cycle.

Rules:

- Rename only when the new name removes a layer lie.
- Make hard cutovers. No compatibility aliases.
- Freeze final names with AST-based architecture tests.

Exit criteria:

- The same concept has the same name across object properties, enum chips, and
  recursive schema details.
- No prop named `details` receives a plan.
- No prop named `row` receives an add-input model.

## Implementation Plan

1. Rename mixed recursive detail types.
   - `PropertySchemaDetailsModel` becomes `PropertySchemaDetailsPlan`.
   - `PropertyObjectPropertiesSourceModel` becomes
     `PropertyObjectPropertiesPlan`.
   - `PropertyArrayItemsFieldModel` becomes `PropertyArrayItemsPlan` if it only
     wraps child plans.

2. Extract object-properties contracts.
   - Move `ObjectPropertyRowModel`, `ObjectPropertyAddRowModel`, and related
     field model interfaces out of `object-properties-model.ts`.
   - Update `property-form/types.ts`, tests, and renderers to import from the
     pure contract module.

3. Split recursive details resolution from rendering.
   - Keep `PropertySchemaDetailsField` as the recursive public component.
   - Add a private content component with no hooks.
   - Keep object-properties resolution in a small branch component or hook whose
     name says it resolves a plan.

4. Normalize add-row contracts.
   - Decide whether `SchemaAddRow` and `SchemaChipAddRow` share only a model or
     a deeper primitive.
   - Rename add-row props from `row` to `addInput` or `addField` if the current
     name remains misleading.
   - Preserve the current compact enum chip visuals: `bg-muted`, `px-1`,
     `shadow-none`.

5. Document enum identity.
   - Either introduce stable property-form enum IDs or write an invariant test
     that positional IDs are safe because there is no reorder or per-chip local
     state.

6. Upgrade architecture tests.
   - Assert final interface names and prop names.
   - Assert `property-form/types.ts` has no dependency on hook/renderer files.
   - Assert no transitional names remain.
   - Assert recursive plans and render details do not collapse into one mixed
     type again.

7. Run verification.

## Verification Matrix

Run:

```bash
pnpm typecheck
pnpm vitest run tests/schema-builder-architecture.test.ts tests/schema-editor-context.test.tsx tests/property-form.test.tsx tests/schema-editor-render.test.tsx tests/schema-property-reorder.test.ts tests/schema-document-view-model.test.ts
pnpm eslint components/schema-editor/primitives/schema-add-row.tsx components/schema-editor/primitives/schema-chip-list.tsx components/schema-editor/primitives/schema-chip-add-row.tsx components/schema-editor/property-form/fields/enum-values-field.tsx components/schema-editor/property-form/fields/object-properties-field.tsx components/schema-editor/property-form/fields/object-properties-model.ts components/schema-editor/property-form/fields/object-property-row.tsx components/schema-editor/property-form/fields/object-property-row-identity.ts components/schema-editor/property-form/fields/property-schema-details-field.tsx components/schema-editor/property-form/fields/property-schema-details-renderer.tsx components/schema-editor/property-form/model/property-schema-details.ts components/schema-editor/property-form/property-form-controller.ts components/schema-editor/property-form/property-form-shell.tsx components/schema-editor/property-form/types.ts tests/schema-builder-architecture.test.ts tests/property-form.test.tsx tests/schema-property-reorder.test.ts e2e/schema-property-form.spec.ts
pnpm test:e2e -- e2e/schema-property-form.spec.ts
```

Audit:

```bash
rg -n "PropertySchemaDetailsModel|PropertyObjectPropertiesSourceModel|PropertyArrayItemsFieldModel" components/schema-editor/property-form tests/schema-builder-architecture.test.ts -S
rg -n "from .*/fields/object-properties-model" components/schema-editor/property-form/types.ts tests/schema-builder-architecture.test.ts -S
rg -n "renderSchemaDetails|renderPropertyDetails|rowDetails|itemDetails|schemaNodeDetails" components/schema-editor/property-form tests/schema-builder-architecture.test.ts -S
rg -n "row=\\{addRow\\}|row: SchemaChipAddRowModel" components/schema-editor -S
```

Expected audit result:

- no mixed `Model` names for recursive plans
- no central type import from object-properties hook modules
- no old recursive render callback names
- no add-input packet named `row`

## Non-Goals

- Do not redesign the visuals.
- Do not add schema features.
- Do not change schema mutation semantics.
- Do not introduce compatibility shims.
- Do not combine chip and object add rows through a variant prop unless the
  result is simpler at every call site.
- Do not kill or restart unrelated local processes.

## Completion Standard

The ideal is reached when this sentence is literally true:

> Pure schema code creates recursive plans; stateful branch adapters resolve
> plans into complete field models; renderers render only complete field models;
> primitives each own one visible interaction; shared contracts live in neutral
> modules; names reveal whether a value is a plan, field, row, or add input; and
> architecture tests make those boundaries hard to regress.

Until then, the component is excellent, but not perfect.
