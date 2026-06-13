# Schema Property Form Reorder Platonic Ideal Audit Blueprint

## Objective

Bring the property-form object-property reorder implementation from "strong" to
the closest practical version of the platonic ideal:

- simple
- fast
- complete
- nothing extra
- perfectly modular
- high entropy
- consistent names
- exact enough that future readers do not need context archaeology

This is not a feature expansion. It is a final correctness and compression pass
over the current reorder architecture.

## Current Verdict

No, the component has not reached the platonic ideal yet.

The architecture is materially better than the original version:

- `SchemaRowActions` no longer owns reorder.
- `SchemaRowReorderActions` isolates move up/down buttons.
- `ObjectPropertiesField` coordinates the list.
- `ObjectPropertyRow` renders one row.
- focus restoration uses stable reorder data attributes instead of user-facing
  aria-label text.
- drag reorder and keyboard reorder share `row.reorder`.
- architecture tests protect the hard cutover away from `order` and
  `moveTo`.

But the implementation currently violates the ideal in one direct way: the row
model and row renderer do not agree on the details field name.

```ts
// model
rowDetails: PropertySchemaDetailsModel

// renderer
renderPropertyDetails(row.details)
```

That is not a philosophical imperfection. It is a type contract failure.

## Non-Negotiable Fix

Choose one name for recursive row details and use it everywhere.

Preferred name:

```ts
rowDetails
```

Reason:

- `details` already means the whole property form `details` model elsewhere.
- `rowDetails` states that this is the nested details model for an object row.
- it avoids ambiguous local text like `details.details`.
- it matches the ownership boundary introduced by
  `createObjectPropertyRowDetails`.

Required change:

```tsx
{renderPropertyDetails(row.rowDetails)}
```

Required guard:

```ts
expect(modelContent.includes("rowDetails: PropertySchemaDetailsModel")).toBe(true)
expect(rowContent.includes("renderPropertyDetails(row.rowDetails)")).toBe(true)
expect(rowContent.includes("renderPropertyDetails(row.details)")).toBe(false)
```

## Ideal Target Shape

### 1. Model Owns Data And Commands

`useObjectPropertiesModel` owns all schema mutation decisions:

- add object property
- rename object property
- remove object property
- replace nested property schema
- move object property
- preserve local add-row draft across local row edits
- create stable row ids
- create row field models

The renderer receives reduced field models. It should not reconstruct labels,
validation, schema contexts, or mutation commands.

Ideal row model:

```ts
export interface ObjectPropertyRowModel {
  id: string
  name: string
  rowDetails: PropertySchemaDetailsModel
  nameField: ObjectPropertyNameFieldModel
  descriptionField: ObjectPropertyDescriptionFieldModel
  reorder: ObjectPropertyRowReorderModel
  typeField: ObjectPropertyTypeFieldModel
  deleteAction: ObjectPropertyDeleteActionModel
}
```

Do not reintroduce:

- `row.details`
- `row.schemaNode`
- `row.actions`
- `row.validation`
- `row.type`
- `row.order`
- `moveTo`

### 2. List Component Owns List Coordination

`ObjectPropertiesField` should own exactly:

- call `useObjectPropertiesModel`
- call `useObjectPropertiesRowDrag`
- call `useObjectPropertyReorderFocus`
- own reorder live-region text
- map rows to `ObjectPropertyRow`
- render `SchemaAddRow`

It should not render row internals.

It should not import:

- `SchemaFieldRow`
- `SchemaInlineName`
- `SchemaInlineDescription`
- `SchemaRowActions`
- `SchemaRowReorderActions`
- `TypeField`

### 3. Row Component Owns One Row

`ObjectPropertyRow` should own exactly:

- row shell attributes
- whole-row drag affordance classes
- `SchemaFieldRow` composition
- name field rendering
- description field rendering
- reorder button wiring
- delete action rendering
- type field rendering
- nested `rowDetails` rendering

It should not own:

- model creation
- row list mapping
- add-row rendering
- live-region state
- focus restoration state
- drag adapter state

Forbidden in `object-property-row.tsx`:

```txt
ObjectPropertyRows
ObjectPropertiesModel
useObjectPropertiesRowDrag
useObjectPropertyReorderFocus
row.details
row.order
```

### 4. Reorder Actions Stay Primitive

`SchemaRowReorderActions` should remain model-agnostic.

Current API is acceptable:

```ts
interface SchemaRowReorderActionsProps {
  canMoveDown: boolean
  canMoveUp: boolean
  moveDownLabel: string
  moveUpLabel: string
  onMoveDown: () => void
  onMoveUp: () => void
  moveDownAttributes?: React.ButtonHTMLAttributes<HTMLButtonElement>
  moveUpAttributes?: React.ButtonHTMLAttributes<HTMLButtonElement>
}
```

The `moveUpAttributes` and `moveDownAttributes` props are a small leak, but they
are justified because they keep focus identity out of the primitive while still
allowing stable DOM identity.

Do not move focus-specific terms into this primitive.

### 5. Focus Identity Uses Data, Not Copy

`object-properties-reorder-focus.ts` should remain the only place that knows the
focus restoration query.

Keep:

```txt
data-schema-row-reorder-row-id
data-schema-row-reorder-direction
```

Do not reintroduce:

```txt
aria-label lookup
data-schema-row-order-row-id
pendingReorderFocusLabelRef
```

### 6. Whole-Row Drag Is The Chosen Contract

The current contract should remain explicit:

- the row shell is draggable
- the row shell has `cursor-grab`
- the grip is a visual affordance
- keyboard reorder buttons provide non-pointer reorder

Do not drift to a half-contract where the grip looks draggable but only a hidden
or narrow target starts drag.

## Test Plan

Run after the naming fix:

```bash
bunx vitest run tests/schema-property-reorder.test.ts tests/property-form.test.tsx tests/schema-builder-architecture.test.ts
bun run typecheck
bunx eslint components/schema-editor/primitives/schema-row-actions.tsx components/schema-editor/primitives/schema-row-reorder-actions.tsx components/schema-editor/property-form/fields/object-properties-field.tsx components/schema-editor/property-form/fields/object-property-row.tsx components/schema-editor/property-form/fields/object-properties-reorder-focus.ts components/schema-editor/property-form/fields/object-properties-drag.ts components/schema-editor/property-form/fields/object-properties-model.ts tests/schema-builder-architecture.test.ts tests/property-form.test.tsx e2e/schema-property-form.spec.ts
```

Run browser/E2E only after the source scan is clean:

```bash
bunx playwright test e2e/schema-property-form.spec.ts
```

If using the local docs app for manual verification, start it only after the
source files are clean:

```bash
pnpm dev
```

Then verify:

- object rows are `draggable="true"`
- object rows have `cursor-grab`
- reorder buttons have `data-schema-row-reorder-row-id`
- reorder buttons have `data-schema-row-reorder-direction`
- no buttons have `data-schema-row-order-row-id`

## Architecture Guard Updates

Add or keep architecture checks that prove the final state:

```ts
expect(modelContent.includes("rowDetails: PropertySchemaDetailsModel")).toBe(true)
expect(rowContent.includes("renderPropertyDetails(row.rowDetails)")).toBe(true)
expect(rowContent.includes("renderPropertyDetails(row.details)")).toBe(false)
expect(rowContent.includes("export function ObjectPropertyRows")).toBe(false)
expect(rowContent.includes("useObjectPropertiesRowDrag")).toBe(false)
expect(viewContent.includes("useObjectPropertiesRowDrag")).toBe(true)
expect(viewContent.includes("ObjectPropertyRows")).toBe(false)
expect(focusContent.includes("aria-label")).toBe(false)
```

## Completion Criteria

This blueprint is complete only when:

- `ObjectPropertyRowModel` and `ObjectPropertyRow` use the same recursive
  details name.
- `bun run typecheck` has no property-form row error.
- no live code contains `ObjectPropertyRows`, `row.order`, `moveTo`, or
  `data-schema-row-order`.
- focused property-form tests pass.
- architecture tests protect the final module boundaries.
- the component can be explained in one sentence:

`ObjectPropertiesField coordinates object property rows; ObjectPropertyRow renders one row; the model owns schema mutation; primitives render generic row controls.`
