# Schema Property Form Terminal Exactness Blueprint

## Objective

Answer the perfection question literally: the component and property form are
close, but not yet at the platonic ideal.

The remaining work is not visual polish or feature work. It is the final pass
that makes the system feel inevitable:

- one owner for each behavior
- one name for each concept
- one smallest useful prop surface per component
- no optional feature knowledge in reusable fields
- no schema mutation leaking into JSX
- no tests that pass while the architectural shape quietly drifts

## Current Baseline

The large problems are already solved.

- The property-form object builder now uses the same row language as the schema
  builder: grip affordance, inline name, inline description, row type control,
  delete action, keyboard reorder actions, drag reorder, and recursive details.
- `ObjectPropertiesField` is now mostly a connector: it builds an
  `ObjectPropertiesModel`, renders `ObjectPropertyRows`, and renders the add-row
  control.
- `ObjectPropertyRowModel` is view-ready. The row renderer no longer reaches
  into raw `schemaNode.description`, validation objects, or schema edit helpers.
- `SchemaRowReorderActions` is split out from `SchemaRowActions`.
- `SchemaTypeMenu` is no longer aware of object templates or lazy imports. It
  receives injected trailing content.
- The top-level property-form view model exposes explicit detail fields:
  `enumValues`, `objectProperties`, and `arrayItems`.
- Enum chips are shared through `SchemaChipList`, with the compact `bg-muted`,
  `px-1`, `shadow-none` badge contract.

This is strong architecture. The remaining gap is exactness.

## Remaining Non-Ideal Surfaces

### 1. `TypeField` Is Still Too Wide

`TypeField` accepts the pieces of `PropertyTypeFieldModel` as separate props:

- `schemaNode`
- `schemaContext`
- `fieldPath`
- `editable`
- `variant`
- `onChange`

That means every caller has to know the structure of a type field instead of
handing over the field model.

Target:

```ts
interface TypeFieldProps {
  field: PropertyTypeFieldModel
  variant?: SchemaTypeMenuVariant
}
```

Then every call site becomes:

```tsx
<TypeField field={fields.type} />
<TypeField field={row.typeField} variant="row" />
<TypeField field={details.type} />
```

Exit criteria:

- `TypeField` is the only place that destructures `PropertyTypeFieldModel` for
  rendering.
- Call sites do not pass `schemaNode`, `schemaContext`, `editable`, and
  `onChange` separately.
- Architecture tests assert the `TypeField` first-parameter keys are exactly
  `["field", "variant"]`.

### 2. Object Template Injection Should Move Out Of `TypeField`

`SchemaTypeMenu` is optional-feature agnostic, but `TypeField` still imports
`createObjectTemplateTypeTrailingContent`.

That is cleaner than the old primitive import, but not final: `TypeField` should
render a type field. It should not decide whether object templates exist.

Target:

```ts
interface PropertyTypeFieldModel {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  editable: boolean
  trailingContent?: SchemaTypeMenuTrailingContent
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}
```

The controller/detail factory, which already knows the schema context and
feature flags, should attach trailing content when object templates are enabled.

Rules:

- `TypeField` imports `SchemaTypeMenu`, not object-template modules.
- `createPropertyTypeMenu` may expose the command needed by the template
  submenu, but it should not lazy-import the submenu.
- Object-template lazy import stays only in
  `components/schema-editor/object-template-type-section.tsx`.

Exit criteria:

- `rg -n "object-template|ObjectTemplate" components/schema-editor/property-form/fields/type-field.tsx` returns no hits.
- `SchemaTypeMenu` and `TypeField` both remain optional-feature agnostic.
- Property-form and document-node adapters still support object templates.

### 3. Detail Naming Needs One Final Vocabulary

The code still has understandable but slightly broad names:

- `details`
- `schemaDetails`
- `propertyDetails`
- `row.details`
- `renderPropertyDetails`

The concepts are different enough to deserve exact names.

Target vocabulary:

- `schemaDetails`: recursive type-specific schema detail model.
- `objectProperties`: object-specific property collection model.
- `rowSchemaDetails`: recursive schema details for one object-property row.
- `renderSchemaDetails`: recursive renderer for any schema detail model.
- `details`: allowed only as a component prop when the component name already
  supplies the domain, such as `PropertySchemaDetailsField`.

Preferred changes:

- Rename `ObjectPropertyRowModel.details` to `schemaDetails`.
- Rename `renderPropertyDetails` to `renderSchemaDetails`.
- In `PropertyFormShell`, avoid reconstructing a local `schemaDetails` object
  if the view model can provide the exact detail model directly.

Exit criteria:

- No scope contains both `details` and `schemaDetails` unless it is translating
  between public and local names.
- Object row JSX reads `row.schemaDetails`.
- Recursive render props use `renderSchemaDetails`.

### 4. Reorder Naming Should Be Chosen, Then Frozen

Current naming is coherent:

- `reorder`
- `move`
- `moveUp`
- `moveDown`
- `position`
- `rowCount`

The only unresolved question is whether the noun should be `reorder` or
`order`.

Decision:

- Keep `reorder` unless a full rename makes every call site clearer.
- Do not rename only because `order` is shorter.
- If kept, encode that decision in the architecture test as the final contract,
  not as a temporary compromise.

Small tightening still worth considering:

```ts
interface ObjectPropertyRowReorderModel {
  canMoveDown: boolean
  canMoveUp: boolean
  moveTo: (targetIndex: number) => void
  moveDown: () => void
  moveUp: () => void
  moveDownLabel: string
  moveUpLabel: string
  position: number
  total: number
}
```

Decision rule:

- Rename `move` to `moveTo` only if drag code becomes clearer.
- Rename `rowCount` to `total` only if announcements and tests become clearer.
- Do not do partial naming churn.

Exit criteria:

- Exactly one noun is used for this command group.
- Architecture tests treat the chosen names as final.

### 5. `SchemaChipList` Should Become A True Chip Primitive

`SchemaChipList` is shared and visually correct, but its API is still shaped by
two concrete enum editors:

- it only accepts `string[]`
- it keys values by index through `getKey(index)`
- it owns both chips and the add-row input
- `focusInputAfterSubmit` and `showSubmitInput` are behavioral toggles rather
  than a small structural model

Target:

```ts
interface SchemaChipItem {
  id: string
  label: string
  value: string
  removeLabel: string
  inputLabel: string
}

interface SchemaChipListProps {
  editable: boolean
  items: SchemaChipItem[]
  addRow?: SchemaChipAddRowModel
  onRemove: (id: string) => void
  onReplace: (id: string, value: string) => void
}
```

Rules:

- Parsing and formatting stay in enum adapters, not the primitive.
- The chip primitive owns chip layout and chip editing only.
- The add-row input is represented by a model, not boolean switches.
- If document enum editing genuinely needs a different focus policy, that
  policy belongs in the add-row model.

Exit criteria:

- No `getKey(index)` API remains.
- No primitive-level `showSubmitInput` boolean remains.
- Property-form enum values and document enum values both use the same chip item
  shape.
- Existing compact badge styling remains unchanged.

### 6. Native Drag Should Be Declared Intentional

`schema-row-drag.ts` directly mutates DOM classes for drop indicators. For
native drag, that is probably the right choice: it is fast, isolated, and avoids
render churn during dragover.

The non-ideal part is not the imperative code itself. The non-ideal part is
that the architecture does not yet say this is intentional.

Target:

- Keep the imperative class mutation.
- Add one short comment at the mutation boundary explaining that dragover stays
  outside React state to avoid rerendering on every native drag event.
- Test the pure helpers:
  - `getSchemaRowDropPlacement`
  - `getSchemaRowDropClasses`
  - `getSchemaRowDropTargetIndex`

Exit criteria:

- No mixed model where some drop indicator state is React state and some is DOM
  mutation.
- Architecture tests allow the DOM mutation only inside `schema-row-drag.ts`.

### 7. Architecture Tests Need Precision, Not More Strings

The architecture tests are valuable, but some are still broad string checks.
There is also a visible path-construction smell around
`property-schema-details-field.tsx` where `repoRoot` is joined twice.

Target:

- Use AST helper checks for component parameter surfaces.
- Use import-boundary checks for optional feature ownership.
- Keep forbidden string checks only for named smells:
  - old compatibility names
  - optional feature imports in primitives
  - raw schema mutation in row JSX
  - duplicate detail capability surfaces
- Fix path construction so every tested file is actually read from the intended
  location.

Exit criteria:

- Tests fail because the architecture changed, not because formatting changed.
- Every architecture assertion protects a boundary named in this blueprint.

## Implementation Order

1. Tighten `TypeField` to accept `field` plus `variant`.
2. Move object-template trailing-content creation out of `TypeField` and into
   the property/document adapters that already know feature availability.
3. Rename recursive detail concepts once:
   `row.details` to `row.schemaDetails`, `renderPropertyDetails` to
   `renderSchemaDetails`.
4. Decide whether to keep `reorder/move/rowCount` or rename the whole set to a
   sharper final vocabulary. Do not split the decision.
5. Refactor `SchemaChipList` to item/add-row models and update both enum
   adapters.
6. Codify native drag imperativeness with a boundary comment and pure helper
   tests.
7. Replace fragile architecture assertions with parameter/import-boundary tests
   where practical.
8. Run the full verification matrix.

## Verification Matrix

Run:

```bash
pnpm typecheck
pnpm vitest run tests/schema-builder-architecture.test.ts tests/schema-editor-context.test.tsx tests/property-form.test.tsx tests/schema-editor-render.test.tsx tests/schema-property-reorder.test.ts
pnpm eslint components/schema-editor/primitives/schema-chip-list.tsx components/schema-editor/primitives/schema-row-actions.tsx components/schema-editor/primitives/schema-row-drag.ts components/schema-editor/primitives/schema-row-reorder-actions.tsx components/schema-editor/primitives/schema-type-menu.tsx components/schema-editor/property-form/fields/enum-values-field.tsx components/schema-editor/property-form/fields/object-properties-field.tsx components/schema-editor/property-form/fields/object-properties-model.ts components/schema-editor/property-form/fields/object-property-row.tsx components/schema-editor/property-form/fields/property-schema-details-field.tsx components/schema-editor/property-form/fields/type-field.tsx components/schema-editor/property-form/model/property-schema-details.ts components/schema-editor/property-form/property-form-controller.ts components/schema-editor/property-form/property-form-shell.tsx components/schema-editor/property-form/types.ts tests/schema-builder-architecture.test.ts tests/property-form.test.tsx tests/schema-property-reorder.test.ts e2e/schema-property-form.spec.ts
pnpm test:e2e -- e2e/schema-property-form.spec.ts
```

Audit:

```bash
rg -n "object-template|ObjectTemplate" components/schema-editor/property-form/fields/type-field.tsx components/schema-editor/primitives/schema-type-menu.tsx -S
rg -n "renderPropertyDetails|row\\.details|getKey\\(|showSubmitInput|focusInputAfterSubmit|schemaNode\\.description|row\\.schemaNode|PropertySchemaDetailsCapabilities|canEditPropertyType" components/schema-editor tests/schema-builder-architecture.test.ts -S
```

Expected audit result:

- no optional object-template knowledge in `TypeField` or `SchemaTypeMenu`
- no object-row raw schema reads in JSX
- no legacy detail capability names
- no old recursive detail renderer names
- no index-keyed chip-list API

## Completion Standard

The pass is complete when the whole system can be described without caveats:

> Property-form models build exact field models; field components render those
> models; schema-editor primitives own only generic row, type-menu, drag, and
> chip mechanics; optional features are injected only by adapters that know
> those features exist.

If any renderer still needs to know how to assemble its model, or any primitive
still needs a feature-specific branch, the component is excellent but not yet
platonic.
