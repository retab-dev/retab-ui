# Schema Property Form Platonic Final Gap Blueprint

## Objective

Move the schema component system from excellent to the practical platonic ideal:

- simplicity
- speed
- everything needed
- nothing more
- perfect modularization
- high-entropy code
- perfectly consistent variable names
- Flaubertian precision

The previous terminal blueprint finished the object-row compression. This
blueprint is narrower: it targets the final surfaces that still require
explanation.

## Current State

The property-form object builder is now strong.

- `ObjectPropertiesField` creates the model, renders `ObjectPropertyRows`, and
  renders the add-row control.
- `ObjectPropertyRows` owns drag, focus restoration, live reorder
  announcements, and row rendering.
- `ObjectPropertyRowModel` exposes view-ready fields:
  `nameField`, `descriptionField`, `typeField`, `deleteAction`, `reorder`, and
  `rowDetails`.
- Raw schema mutation is in the model layer, not row JSX.
- `SchemaRowReorderActions` owns reorder buttons.
- Native drag DOM mutation is isolated and intentional.
- Type-menu primitives do not import object-template code.
- Enum chip styling is compact and shared.
- Tests and e2e coverage verify object rows, reorder, enum chips, description
  caret placement, and type-menu behavior.

This is not yet perfect because a few APIs still expose too much construction
detail to their callers.

## Non-Negotiable Invariants

- No compatibility shims, old prop names, or dual APIs.
- No primitive imports from property form, document editor, object templates,
  JSON table, or schema-provider code.
- No schema mutation in JSX.
- No render-prop escape hatch except the recursive schema-detail renderer.
- No optional feature branches inside generic fields or primitives.
- No weakening tests to make the refactor pass.
- No visual regression of object rows, enum chips, grips, or description caret
  placement.
- No partial naming migration. Rename a concept once, everywhere, or leave it
  alone.

## Target Shape

### 1. Collapse `TypeField` To A Field-Model Renderer

`TypeField` still accepts individual pieces of a type field:

- `schemaNode`
- `schemaContext`
- `fieldPath`
- `editable`
- `onChange`
- `variant`

That is too much API. Callers already have a field model. The renderer should
receive that model.

Target:

```ts
interface TypeFieldProps {
  field: PropertyTypeFieldModel
  variant?: SchemaTypeMenuVariant
}
```

Usage:

```tsx
<TypeField field={fields.type} />
<TypeField field={row.typeField} variant="row" />
<TypeField field={details.type} />
```

Rules:

- `TypeField` is the only renderer that destructures
  `PropertyTypeFieldModel`.
- Call sites do not pass `schemaNode`, `schemaContext`, `editable`, or
  `onChange` separately.
- `fieldPath` remains model data if the menu label needs it.

Exit criteria:

- `functionFirstParameterTypeProperties(TypeField)` returns
  `["field", "variant"]`.
- `rg -n "<TypeField[\\s\\S]*schemaNode=|schemaContext=|editable=|onChange=" components/schema-editor/property-form` has no relevant hits.
- Typecheck and property-form tests pass.

### 2. Move Object-Template Injection Out Of `TypeField`

`SchemaTypeMenu` is clean, but `TypeField` still imports
`createObjectTemplateTypeTrailingContent`. That makes a generic field aware of
an optional feature.

Target:

```ts
interface PropertyTypeFieldModel {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  fieldPath?: string
  editable: boolean
  trailingContent?: SchemaTypeMenuTrailingContent
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}
```

Ownership:

- `TypeField` passes `field.trailingContent` to `SchemaTypeMenu`.
- Property-form model factories attach object-template trailing content only
  when `schemaContext.objectTemplatesEnabled` is true.
- Document-node adapters keep their current adapter-level injection.
- `createPropertyTypeMenu` may keep the command function for selecting an
  object template, but it must not import the lazy submenu.

Exit criteria:

- `TypeField` has no `object-template` or `ObjectTemplate` import or symbol.
- `SchemaTypeMenu` remains optional-feature agnostic.
- `object-template-type-section.tsx` remains the only lazy import boundary for
  the object-template menu.
- E2E still installs an object template from the property type menu.

### 3. Make Schema Detail Naming Final

Current vocabulary is close but not exact:

- `details`
- `schemaDetails`
- `rowDetails`
- `renderSchemaDetails`

The only weak name is `rowDetails`. It says where the model lives, not what it
is.

Target vocabulary:

- `schemaDetails`: recursive type-specific details for the current schema node.
- `objectProperties`: object-specific property collection details.
- `rowSchemaDetails`: recursive details for one object-property row.
- `renderSchemaDetails`: recursive renderer.
- `details`: allowed only when the component name supplies the domain, such as
  `PropertySchemaDetailsField`.

Preferred rename:

```ts
ObjectPropertyRowModel.rowDetails -> rowSchemaDetails
```

Rules:

- Do not rename `PropertySchemaDetailsField`'s `details` prop. The component
  name makes the domain unambiguous.
- Do not invent separate names for array item details unless the array model
  grows beyond one recursive details model.

Exit criteria:

- Object row JSX reads `row.rowSchemaDetails`.
- No `row.details`, `rowDetails`, or `renderPropertyDetails` remains in
  property-form fields or architecture tests.
- No scope contains both `details` and `schemaDetails` unless it is explicitly
  translating between public prop names and local model names.

### 4. Freeze Reorder Vocabulary

The current reorder vocabulary is coherent:

- `reorder`
- `move`
- `moveUp`
- `moveDown`
- `position`
- `rowCount`

Do not chase a prettier noun unless the whole API gets clearer.

Decision:

- Keep `reorder` as the final field name.
- Keep `move` unless `moveTo` removes ambiguity in every call site.
- Keep `rowCount` unless `total` improves announcements and tests.

Exit criteria:

- Architecture tests explicitly treat `reorder` as final.
- No `ObjectPropertyRowOrderModel` compatibility name exists.
- No mixed `order` and `reorder` vocabulary in object-property rows.

### 5. Refactor `SchemaChipList` Into A True Primitive

`SchemaChipList` is visually correct, but its props still leak enum-editor
assumptions:

- `values: string[]`
- `getKey(index)`
- `showSubmitInput`
- `focusInputAfterSubmit`

Target:

```ts
interface SchemaChipItem {
  id: string
  value: string
  inputLabel: string
  removeLabel: string
}

interface SchemaChipAddRow {
  inputLabel: string
  placeholder: string
  submitLabel: string
  value: string
  focusAfterSubmit?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}

interface SchemaChipListProps {
  editable: boolean
  items: SchemaChipItem[]
  addRow?: SchemaChipAddRow
  onRemove: (id: string) => void
  onReplace: (id: string, value: string) => void
}
```

Rules:

- Parsing and formatting stay in enum adapters.
- The primitive owns chip layout, inline chip editing, and optional add-row UI.
- The primitive does not know about enum indexes.
- The compact visual contract stays unchanged:
  `bg-muted`, `px-1`, `shadow-none`.

Exit criteria:

- No `getKey(index)` API remains.
- No `showSubmitInput` prop remains.
- No primitive-level `focusInputAfterSubmit` prop remains.
- Property-form enum values and document enum values both build
  `SchemaChipItem[]`.
- E2E enum chip assertions still pass.

### 6. Fix The Hydration Mismatch Around Schema-Builder Property IDs

The e2e run passed but emitted a React hydration mismatch where schema-builder
property IDs differed between server and client.

This is not part of the object-builder refactor, but perfection cannot leave a
known mismatch in the same component family.

Target:

- Property row IDs must be deterministic across SSR and hydration.
- IDs should derive from stable schema paths or schema node identity, not a
  client-only counter that advances differently on the server and client.
- Drag and focus behavior must continue to use stable IDs.

Exit criteria:

- `pnpm test:e2e -- e2e/schema-property-form.spec.ts` emits no hydration
  mismatch for schema-builder property IDs.
- Reorder, focus restoration, and row selection still pass.
- Architecture tests document the stable-ID source.

### 7. Upgrade Architecture Tests From String Guards Where Worth It

String guards are acceptable for known smells, but exact APIs deserve shape
tests.

Upgrade targets:

- `TypeField` prop surface.
- `ObjectPropertiesField` prop surface.
- `SchemaChipList` prop surface.
- Import boundaries:
  - primitives do not import feature code
  - `TypeField` does not import object-template code
  - object-row JSX does not import schema edit helpers

Keep string guards for:

- deleted compatibility names
- optional feature imports in primitives
- raw schema mutation in row JSX
- forbidden old detail names

Exit criteria:

- Tests fail because a boundary changed, not because formatting changed.
- Forbidden-string tests concatenate forbidden names when the test file itself
  would otherwise trip audit searches.

## Implementation Order

1. Collapse `TypeField` to `{ field, variant }`.
2. Move object-template trailing-content ownership out of `TypeField`.
3. Rename `rowDetails` to `rowSchemaDetails`.
4. Freeze and document reorder vocabulary in architecture tests.
5. Refactor `SchemaChipList` to item/add-row models.
6. Fix deterministic schema-builder property IDs and remove the hydration
   warning.
7. Replace brittle architecture assertions with prop-surface and import-boundary
   checks where practical.
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
rg -n "renderPropertyDetails|row\\.details|rowDetails|getKey\\(|showSubmitInput|focusInputAfterSubmit|schemaNode\\.description|row\\.schemaNode|PropertySchemaDetailsCapabilities|canEditPropertyType" components/schema-editor tests/schema-builder-architecture.test.ts -S
```

Expected audit result:

- no optional object-template knowledge in `TypeField` or `SchemaTypeMenu`
- no raw object-row schema reads in JSX
- no old recursive detail renderer names
- no index-keyed chip-list API
- no legacy duplicate capability names

## Completion Standard

The component reaches the practical platonic ideal when this sentence is true
without footnotes:

> Property-form factories build exact field models; field renderers consume
> those models directly; schema-editor primitives own only generic row, chip,
> drag, and type-menu mechanics; optional features are injected by adapters; row
> IDs are deterministic across SSR and hydration; tests protect the exact shape.

If a caller still assembles renderer internals, if a generic field still imports
optional feature code, or if a known hydration warning remains, the system is
excellent but not perfect.
