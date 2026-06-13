# Schema Property Form Platonic Final Gap Blueprint

## Objective

Move the schema property form and schema-builder primitives from excellent to
the practical platonic ideal:

- simplicity
- speed
- everything needed
- nothing more
- perfect modularization
- high-entropy code
- perfectly consistent variable names
- Flaubertian precision

This blueprint is a last-mile plan. It assumes the object builder, row grips,
shared enum chips, description caret placement, deterministic import IDs, and
basic primitive reuse are already in place.

## Current State

The system is strong.

- `ObjectPropertiesField` delegates row state and mutation to
  `useObjectPropertiesModel`.
- Object rows consume view-ready fields:
  `nameField`, `descriptionField`, `typeField`, `rowSchemaDetails`,
  `reorder`, and `deleteAction`.
- `SchemaChipList` is shared by property-form enum values and document enum
  editing.
- `SchemaTypeMenu` is optional-feature agnostic and accepts typed sections plus
  trailing content.
- `TypeField` accepts `{ field, variant }`, so call sites no longer assemble
  renderer internals.
- The property-form view model exposes explicit top-level detail slots:
  `enumValues`, `objectProperties`, and `arrayItems`.
- Architecture tests protect many deleted APIs and import boundaries.

The remaining gap is not visual. It is exactness: a few modules still expose
construction details, a few names still need surrounding context, and some tests
still protect smells more than they protect the positive shape.

## Non-Negotiable Invariants

- No compatibility aliases, fallback APIs, or old/new prop pairs.
- No optional-feature imports from schema-editor primitives.
- No schema mutation in JSX.
- No raw schema/domain inputs in pure renderers.
- No component receives both `editable` and `disabled` unless it is explicitly
  adapting a primitive to a native control.
- No index-keyed list identity for chips, rows, or imported properties.
- No broad render escape hatch unless recursive schema-detail rendering truly
  requires it.
- No weakening tests to make the refactor pass.
- No partial naming migration. Rename a concept once, everywhere.

## Target Shape

### 1. Make `TypeField` A Pure Renderer

`TypeField` currently receives a field model, then recreates the menu from
`schemaNode`, `schemaContext`, and `onChange`.

That means `PropertyTypeFieldModel` is not yet a true view model. It is a
construction packet.

Target:

```ts
interface PropertyTypeFieldModel {
  ariaLabel: string
  editable: boolean
  sections: SchemaTypeMenuSection[]
  trailingContent?: SchemaTypeMenuTrailingContent
  value: SchemaTypeMenuValue
}
```

Renderer:

```tsx
export function TypeField({
  field,
  variant = "form",
}: {
  field: PropertyTypeFieldModel
  variant?: SchemaTypeMenuVariant
}) {
  return <SchemaTypeMenu {...field} variant={variant} />
}
```

Rules:

- `TypeField` must not import `createPropertyTypeMenu`.
- `TypeField` must not know about schema nodes, contexts, definitions, object
  templates, metadata preservation, or callbacks.
- All menu construction belongs in property-form model factories or document
  adapters.
- `PropertyTypeFieldModel` should contain only what `SchemaTypeMenu` needs.

Exit criteria:

- `rg -n "schemaNode|schemaContext|onChange|createPropertyTypeMenu" components/schema-editor/property-form/fields/type-field.tsx`
  has no hits.
- `functionFirstParameterTypeProperties(TypeField)` remains
  `["field", "variant"]`.
- Architecture tests assert the exact `PropertyTypeFieldModel` interface shape.

### 2. Split Pure Type-Menu Construction From Optional Object Templates

`property-type-menu-model.ts` is doing two jobs:

- building the property type menu from schema/domain inputs
- attaching object-template trailing content

That is acceptable adapter code, but not inevitable. The cleaner shape is a
pure type-field factory plus a small optional-feature adapter.

Target modules:

- `property-type-field-model.ts`
  - builds `PropertyTypeFieldModel`
  - preserves title/description metadata
  - creates primitive and definition sections
  - contains no object-template imports
- `property-object-template-type-field.tsx`
  - creates the object-template trailing content
  - wires `installObjectTemplate`
  - calls the pure factory with `trailingContent`

Target API:

```ts
createPropertyTypeField({
  editable,
  schemaContext,
  schemaNode,
  trailingContent,
  onChange,
})
```

Rules:

- Object-template code is injected by the caller that knows
  `schemaContext.objectTemplatesEnabled`.
- The pure type-field model factory can be used without loading optional
  feature code.
- Do not create compatibility re-exports from old file names.

Exit criteria:

- `rg -n "object-template|ObjectTemplate" components/schema-editor/property-form/fields/property-type-field-model.ts components/schema-editor/property-form/fields/type-field.tsx components/schema-editor/primitives/schema-type-menu.tsx`
  has no hits.
- Only the object-template adapter imports
  `createObjectTemplateTypeTrailingContent`.
- Property-form object template e2e coverage still passes.

### 3. Collapse Top-Level Schema Details To One Exact Field

`PropertyFormViewModel.fields` currently has:

- `enumValues`
- `objectProperties`
- `arrayItems`

Then `PropertyFormShell` reconstructs a `schemaDetails` object so it can render
`PropertySchemaDetailsField`.

That is a small duplication of shape. The model already knows the recursive
schema-detail shape; the shell should not rebuild it.

Target:

```ts
interface PropertyFormViewModel {
  fields: {
    name: PropertyNameFieldModel
    type: PropertyTypeFieldModel
    nullable: PropertyNullableFieldModel
    description: PropertyDescriptionFieldModel
    schemaDetails?: PropertySchemaDetailsModel
  }
}
```

Rules:

- The controller decides whether details exist.
- `PropertyFormShell` renders `fields.schemaDetails` directly.
- `PropertySchemaDetailsModel` remains explicit internally:
  `type`, `enumValues`, `objectProperties`, `arrayItems`.
- Do not restore the old `schemaNodeDetails` name.

Exit criteria:

- No `const schemaDetails = { enumValues, objectProperties, arrayItems }`
  exists in shell JSX.
- No top-level `fields.enumValues`, `fields.objectProperties`, or
  `fields.arrayItems` remains.
- `PropertySchemaDetailsField` is the only recursive detail renderer.

### 4. Finish Detail Naming

Most naming is now exact. Two names still carry a little ambiguity:

- `PropertyArrayItemsFieldModel.itemDetails`
- `PropertySchemaDetailsField` prop name `details`

Target vocabulary:

- `schemaDetails`: recursive details for the current schema node.
- `rowSchemaDetails`: recursive details for an object-property row.
- `itemSchemaDetails`: recursive details for an array item.
- `renderSchemaDetails`: recursive renderer.

Preferred rename:

```ts
PropertyArrayItemsFieldModel.itemDetails -> itemSchemaDetails
```

Keep:

```tsx
<PropertySchemaDetailsField details={schemaDetails} />
```

The component name makes `details` unambiguous at the prop boundary.

Exit criteria:

- No `itemDetails` remains in property-form code or architecture tests.
- No `rowDetails`, `schemaNodeDetails`, or `renderPropertyDetails` remains.
- Any local variable named `details` lives inside a component whose name already
  supplies the domain.

### 5. Normalize `editable` And `disabled` At The Correct Layers

The current model layer still accepts `disabled` in places where the concept is
actually editability.

Target language:

- domain mode: `mode`
- capability booleans: `canEditName`, `canEditType`, etc.
- model and primitive booleans: `editable`
- native-control props: `disabled`

Rules:

- `createPropertySchemaDetails` receives `editable`, not `disabled`.
- `createPropertyTypeField` receives `editable`, not `disabled`.
- Field renderers that directly wrap native controls may still expose
  `disabled`.
- Adapters convert `editable` to native `disabled` at the last possible layer.

Exit criteria:

- No model factory input interface has a `disabled` property unless the factory
  builds a native-control field model.
- `TypeField` and `SchemaTypeMenu` speak only `editable`.
- Architecture tests distinguish allowed native-control `disabled` from
  forbidden domain/model-layer `disabled`.

### 6. Keep `SchemaChipList` Generic, But Finish Its Contract

`SchemaChipList` is close to ideal. Its current API is already item-based and
shared.

Remaining exactness:

- The primitive prop interface is not exported, so tests can inspect it only by
  source shape.
- The add-row model name is good, but the primitive owns both chip editing and
  add-row layout. That is acceptable only if the add row remains generic.

Target:

```ts
export interface SchemaChipListProps {
  addRow?: SchemaChipAddRow
  editable: boolean
  items: SchemaChipItem[]
  onRemove: (id: string) => void
  onReplace: (id: string, value: string) => void
}
```

Rules:

- The primitive never parses enum values.
- The primitive never receives indexes.
- The compact visual contract stays fixed:
  `bg-muted`, `px-1`, `shadow-none`.
- Export the props interface if architecture tests need to assert the shape
  without brittle parsing.

Exit criteria:

- No `values`, `getKey`, `showSubmitInput`, or
  `focusInputAfterSubmit` primitive API remains.
- Document enum editing and property-form enum editing both pass stable
  `SchemaChipItem[]`.
- Browser verification asserts the shared chip shape.

### 7. Make Object Row Identity A Named Responsibility

`useObjectPropertiesModel` handles row IDs correctly, but identity logic is
embedded beside row construction.

Target extraction:

- `object-property-row-identity.ts`
  - creates initial row IDs
  - creates next draft row IDs
  - renames row IDs
  - removes row IDs
  - preserves local add-row input across local property-order changes

Rules:

- Extract only if the resulting module has a coherent identity responsibility.
- Do not move row rendering or schema mutation into the identity module.
- Keep deterministic fallback IDs for external schema changes.

Exit criteria:

- `useObjectPropertiesModel` reads as: names, identity, operations, rows,
  add-row.
- Row identity tests cover add, rename, remove, reorder, and external reset.
- No JSX imports identity helpers.

### 8. Tighten Architecture Tests Around Positive Shape

The tests currently combine good shape assertions with string-smell guards.
Keep smell guards for deleted APIs, but encode the final APIs directly.

Upgrade targets:

- `PropertyTypeFieldModel` exact interface keys.
- `TypeField` as pure renderer.
- `createPropertyTypeField` input keys.
- `PropertyFormViewModel.fields` exact keys.
- `PropertyArrayItemsFieldModel.itemSchemaDetails`.
- `SchemaChipListProps` exact keys.
- Object-template import boundary.

Keep string guards for:

- old names: `rowDetails`, `itemDetails`, `schemaNodeDetails`
- deleted chip props: `getKey`, `showSubmitInput`, `focusInputAfterSubmit`
- forbidden optional-feature imports in primitives
- raw object-row schema mutation in JSX

Exit criteria:

- A wrong prop name fails a shape test.
- A forbidden legacy name fails a smell guard.
- Tests do not trip their own audit strings.

## Implementation Order

1. Convert `PropertyTypeFieldModel` into a complete UI model.
2. Make `TypeField` a pure `SchemaTypeMenu` renderer.
3. Split pure property type-field construction from object-template injection.
4. Collapse top-level schema details to `fields.schemaDetails`.
5. Rename `itemDetails` to `itemSchemaDetails`.
6. Normalize model factory inputs from `disabled` to `editable`.
7. Export and freeze `SchemaChipListProps`.
8. Extract object-row identity only if it makes `useObjectPropertiesModel`
   shorter and more obvious.
9. Replace brittle architecture checks with positive shape tests.
10. Run the full verification matrix.

## Verification Matrix

Run:

```bash
pnpm typecheck
pnpm vitest run tests/schema-builder-architecture.test.ts tests/schema-editor-context.test.tsx tests/property-form.test.tsx tests/schema-editor-render.test.tsx tests/schema-property-reorder.test.ts tests/schema-document-view-model.test.ts
pnpm eslint components/schema-editor/primitives/schema-chip-list.tsx components/schema-editor/primitives/schema-type-menu.tsx components/schema-editor/schema-type-menu-sections.tsx components/schema-editor/property-form/fields/enum-values-field.tsx components/schema-editor/property-form/fields/object-properties-field.tsx components/schema-editor/property-form/fields/object-properties-model.ts components/schema-editor/property-form/fields/object-property-row.tsx components/schema-editor/property-form/fields/property-schema-details-field.tsx components/schema-editor/property-form/fields/type-field.tsx components/schema-editor/property-form/model/property-schema-details.ts components/schema-editor/property-form/property-form-controller.ts components/schema-editor/property-form/property-form-shell.tsx components/schema-editor/property-form/types.ts tests/schema-builder-architecture.test.ts tests/property-form.test.tsx tests/schema-property-reorder.test.ts e2e/schema-property-form.spec.ts
pnpm test:e2e -- e2e/schema-property-form.spec.ts
```

Audit:

```bash
rg -n "object-template|ObjectTemplate" components/schema-editor/property-form/fields/type-field.tsx components/schema-editor/primitives/schema-type-menu.tsx -S
rg -n "schemaNode|schemaContext|onChange|createPropertyTypeMenu" components/schema-editor/property-form/fields/type-field.tsx -S
rg -n "renderPropertyDetails|row\\.details|rowDetails|itemDetails|schemaNodeDetails|getKey\\(|showSubmitInput|focusInputAfterSubmit|schemaNode\\.description|row\\.schemaNode|PropertySchemaDetailsCapabilities|canEditPropertyType" components/schema-editor tests/schema-builder-architecture.test.ts -S
```

Expected audit result:

- no optional object-template knowledge in `TypeField` or `SchemaTypeMenu`
- no schema/domain construction inputs in `TypeField`
- no raw object-row schema reads in JSX
- no old recursive-detail names
- no index-keyed chip-list API
- no legacy duplicate capability names

## Completion Standard

The component reaches the practical platonic ideal when this sentence is true
without footnotes:

> Property-form factories build complete field models; field renderers consume
> only those models; schema-editor primitives own only generic row, chip, drag,
> and type-menu mechanics; optional features are injected by explicit adapters;
> recursive details have one exact shape; mutability vocabulary reveals the
> layer immediately; tests protect the positive API shape and the visual
> interaction contract.

If a renderer still constructs its own model, if a model factory still exposes
domain construction details to JSX, or if the shell rebuilds a shape the
controller already knows, the system is excellent but not perfect.
