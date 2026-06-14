# Schema Property Form Crystalline Final Gap Blueprint

## Verdict

Not yet.

The current property form is strong and verified, but four surfaces still keep
it from the platonic ideal:

- `PropertySchemaDetailsPlan` is honest, but still mixes ready field models with
  stateful branch plans.
- `useObjectPropertiesModel` is coherent, but dense.
- `renderPropertySchemaPlan` is a small cycle-breaker, but aesthetically weak.
- Property-form enum identity is positional by invariant, not intrinsically
  stable.

This blueprint is deliberately narrow. It should not reopen solved visual,
schema-builder, enum-chip, grip, description-caret, or object-row reuse work.

## Principles

- One name, one layer.
- One module, one reason to change.
- One hook, one state family.
- One recursive renderer, no helper function that exists only to dodge an
  import cycle.
- Every list item has stable identity before it needs focus, reorder, local
  state, or animation.
- No compatibility aliases.
- No broad refactors outside schema property form.

## Current Shape

The current recursive plan shape is:

```ts
interface PropertySchemaDetailsPlan {
  type?: PropertyTypeFieldModel
  enumValues?: PropertyEnumValuesFieldModel
  objectProperties?: PropertyObjectPropertiesPlan
  arrayItems?: PropertyArrayItemsPlan
}
```

This is truthful but not crystalline:

- `type` and `enumValues` are already complete field models.
- `objectProperties` is a stateful construction plan.
- `arrayItems` is a wrapper around another recursive plan.

The current object-property hook owns:

- add-input state
- pending name validation
- row identity
- schema read/write operations
- row schema context construction
- row field model construction
- row reorder commands
- nested schema plan construction

That is all legitimate ownership, but the hook is a dense knot.

The current row renderer imports:

```ts
renderPropertySchemaPlan(row.schemaPlan)
```

That helper is small and practical. It is also a visible seam.

The current property-form enum identity is:

```ts
id: `enum-value-${index}`
```

Architecture tests make that safe by forbidding reorder and per-chip row state,
but the identity itself is not stable.

## Target Shape

### 1. Separate Recursive Plans From Complete Field Models

Do not keep one object that is half plan and half field model.

Target:

```ts
type PropertySchemaDetailPlan =
  | PropertyTypeDetailPlan
  | PropertyEnumDetailPlan
  | PropertyObjectPropertiesDetailPlan
  | PropertyArrayItemsDetailPlan

interface PropertySchemaDetailsPlan {
  details: PropertySchemaDetailPlan[]
}
```

Where:

```ts
interface PropertyTypeDetailPlan {
  kind: "type"
  field: PropertyTypeFieldModel
}

interface PropertyEnumDetailPlan {
  kind: "enumValues"
  field: PropertyEnumValuesFieldModel
}

interface PropertyObjectPropertiesDetailPlan {
  kind: "objectProperties"
  plan: PropertyObjectPropertiesPlan
}

interface PropertyArrayItemsDetailPlan {
  kind: "arrayItems"
  itemPlan: PropertySchemaDetailsPlan
}
```

Why this is better:

- The recursive plan is a sequence of concrete detail variants.
- `field` means complete render input.
- `plan` means stateful or recursive resolution still has to happen.
- Rendering order becomes data, not property-order convention.
- Adding a new detail kind requires one discriminated union case.

Rules:

- Do not use optional object properties for mutually absent detail kinds.
- Do not name complete field models as plans.
- Do not name unresolved stateful branches as details.
- Keep `PropertySchemaDetailsPlan` as the top-level recursive packet, but make
  its inside structurally precise.

Exit criteria:

- `PropertySchemaDetailsPlan` has one property: `details`.
- Each detail item has a `kind`.
- Complete field variants carry `field`.
- Stateful branch variants carry `plan`.
- Architecture tests assert the union names and forbid the old optional shape.

### 2. Split `useObjectPropertiesModel` Into State, Operations, And Rows

`useObjectPropertiesModel` should become a coordinator, not the place where all
object-property knowledge lives.

Target modules:

- `object-properties-state.ts`
- `object-properties-operations.ts`
- `object-properties-rows.ts`
- `object-properties-model.ts`

Suggested ownership:

```ts
useObjectPropertiesState(plan)
```

Owns:

- pending add-input value
- reset behavior
- row identity
- derived property names
- add-input model

```ts
createObjectPropertyOperations(plan, identity)
```

Owns:

- replace property schema
- rename property
- remove property
- move property
- add property

```ts
createObjectPropertyRows(input)
```

Owns:

- row schema context
- row field models
- row reorder models
- nested row schema plans

`useObjectPropertiesModel` should read like:

```ts
export function useObjectPropertiesModel(plan: PropertyObjectPropertiesPlan) {
  const state = useObjectPropertiesState(plan)
  const operations = createObjectPropertyOperations({ plan, state })
  const rows = createObjectPropertyRows({ plan, state, operations })

  return {
    addInput: state.addInput,
    editable: plan.editable,
    rows,
  }
}
```

Rules:

- Only `object-properties-state.ts` may call React hooks.
- Only `object-properties-operations.ts` may import object-property edit helpers.
- Only `object-properties-rows.ts` may call
  `createObjectPropertyRowSchemaPlan`.
- The coordinator may wire modules together, but should not construct rows
  inline.
- Keep all object-property contracts in
  `property-form/model/object-properties-view.ts`.

Exit criteria:

- `object-properties-model.ts` is under 80 lines.
- It has no direct imports from `object-property-edits.ts`.
- It has no inline `propertyNames.flatMap`.
- It has no inline row schema context construction.
- Architecture tests assert the hook, operation, and row-builder module
  boundaries.

### 3. Delete `renderPropertySchemaPlan`

The renderer helper exists only to avoid a direct component import cycle. The
ideal shape removes the cycle instead.

Target:

- Move recursive schema-plan rendering into a module that does not import row
  components.
- Let object rows render a component directly:

```tsx
<PropertySchemaPlanField plan={row.schemaPlan} />
```

Potential module shape:

- `property-schema-plan-field.tsx`
- `property-schema-plan-content.tsx`
- `object-properties-plan-field.tsx`

The key is that the row should import a component, not a function whose only
purpose is hiding JSX.

Rules:

- No `renderPropertySchemaPlan` helper.
- No `property-schema-plan-renderer.tsx`.
- No direct import cycle.
- The recursive component must still receive `plan`.
- Object-properties plan resolution must remain a clearly named component or
  hook boundary.

Exit criteria:

- `rg -n "renderPropertySchemaPlan|property-schema-plan-renderer"` has no hits.
- Object row JSX contains `<PropertySchemaPlanField plan={row.schemaPlan} />`.
- Architecture tests prove no render helper is reintroduced.

### 4. Give Property-Form Enum Values Stable Identity

Positional enum identity is safe today only because tests forbid reorder and
per-chip local state. The ideal is stronger: identity should be intrinsic.

Target:

- Introduce a small enum-value identity hook:

```ts
useEnumValueIdentity({
  resetKey,
  values,
})
```

It should provide:

- stable IDs for current enum positions
- preservation across local replacement
- reset on external schema reset
- no schema shape changes

Possible model:

```ts
interface EnumValueItemModel {
  id: string
  inputLabel: string
  removeLabel: string
  value: string
}
```

Rules:

- Do not write IDs into JSON Schema enum values.
- Do not use array index as React key or chip ID.
- Do not preserve identity across an external reset.
- Keep property-form enum identity simpler than object-property identity unless
  actual reorder support is added.
- Remove the architecture test that defends positional IDs; replace it with one
  that forbids index IDs.

Exit criteria:

- No `id: \`enum-value-${index}\`` in `enum-values-field.tsx`.
- Enum chips use stable local IDs.
- Focus and editing behavior remains unchanged.
- Architecture tests fail if positional IDs return.

## Implementation Order

1. Convert `PropertySchemaDetailsPlan` to a discriminated detail list.
2. Update `createPropertySchemaDetailsPlan` to push detail variants in render
   order.
3. Update `PropertySchemaDetailsField` to switch on `detail.kind`.
4. Replace `renderPropertySchemaPlan` with a real recursive component import.
5. Split object-property model logic into state, operations, and row builders.
6. Add property-form enum value identity.
7. Upgrade architecture tests to freeze all new boundaries.
8. Run verification.

## Verification Matrix

Run:

```bash
pnpm typecheck
pnpm vitest run tests/schema-builder-architecture.test.ts tests/schema-editor-context.test.tsx tests/property-form.test.tsx tests/schema-editor-render.test.tsx tests/schema-property-reorder.test.ts tests/schema-document-view-model.test.ts
pnpm eslint components/schema-editor/primitives/schema-add-input-model.ts components/schema-editor/primitives/schema-add-row.tsx components/schema-editor/primitives/schema-chip-list.tsx components/schema-editor/primitives/schema-chip-add-row.tsx components/schema-editor/document-enum-node-editor.tsx components/schema-editor/property-form/fields/enum-values-field.tsx components/schema-editor/property-form/fields/object-properties-field.tsx components/schema-editor/property-form/fields/object-properties-model.ts components/schema-editor/property-form/fields/object-properties-state.ts components/schema-editor/property-form/fields/object-properties-operations.ts components/schema-editor/property-form/fields/object-properties-rows.ts components/schema-editor/property-form/fields/object-property-row.tsx components/schema-editor/property-form/fields/object-property-row-details.ts components/schema-editor/property-form/fields/object-property-row-identity.ts components/schema-editor/property-form/fields/property-schema-details-field.tsx components/schema-editor/property-form/model/object-properties-view.ts components/schema-editor/property-form/model/property-schema-details.ts components/schema-editor/property-form/property-form-controller.ts components/schema-editor/property-form/property-form-shell.tsx components/schema-editor/property-form/types.ts tests/schema-builder-architecture.test.ts tests/property-form.test.tsx tests/schema-property-reorder.test.ts e2e/schema-property-form.spec.ts
pnpm test:e2e -- e2e/schema-property-form.spec.ts
```

Audit:

```bash
rg -n "renderPropertySchemaPlan|property-schema-plan-renderer" components/schema-editor/property-form tests/schema-builder-architecture.test.ts -S
rg -n "id: `enum-value-\\$\\{index\\}`|enum-value-\\$\\{index\\}" components/schema-editor/property-form tests/schema-builder-architecture.test.ts -S
rg -n "propertyNames\\.flatMap|createObjectPropertySchema|renameObjectProperty|removeObjectProperty|moveObjectProperty|replaceObjectProperty" components/schema-editor/property-form/fields/object-properties-model.ts -S
rg -n "type\\?: PropertyTypeFieldModel|enumValues\\?: PropertyEnumValuesFieldModel|objectProperties\\?: PropertyObjectPropertiesPlan|arrayItems\\?: PropertyArrayItemsPlan" components/schema-editor/property-form/types.ts tests/schema-builder-architecture.test.ts -S
```

Expected audit result:

- no recursive render helper
- no positional enum chip IDs
- no object-property edit helpers or row construction inside the coordinator
- no optional mixed recursive detail shape

## Completion Standard

This component reaches the next ideal when this sentence is true:

> Recursive schema detail plans are ordered discriminated variants; complete
> field models and unresolved stateful plans are never stored under the same
> structural convention; object-property state, operations, and row construction
> each have one module; recursive rows render a real component rather than a
> cycle-breaking helper; enum chips have stable local identity; and architecture
> tests make all of those boundaries hard to regress.

Until then, the property form remains excellent, but not crystalline.
