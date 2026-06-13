# Schema Editor Primitive Perfection Blueprint

## Context

The schema-editor primitive layer now gives the schema builder and property form
one shared visual language for rows, grips, inline metadata, actions, add rows,
chips, and type menus.

The remaining issue is not broad duplication. It is precision:

- `SchemaTypeMenu` still lazy-imports the optional object-template submenu.
- Primitive props still expose a few adapter-shaped details instead of the
  smallest stable UI contract.
- Some primitive names describe implementation mechanics rather than the
  concept each component owns.

The next pass should make the primitive layer completely model-agnostic and
feature-agnostic.

## Goal

Make `components/schema-editor/primitives/` a pure interaction and presentation
layer:

- no optional feature imports
- no document-model imports
- no property-form imports
- no feature-flag interpretation
- no schema mutation semantics
- no duplicated menu option definitions across adapters

Adapters should assemble domain-specific menus, labels, commands, and mutation
callbacks. Primitives should render those contracts exactly.

## Non-Goals

- Do not change JSON Schema output semantics.
- Do not redesign the visual treatment.
- Do not move property form state into the schema builder document model.
- Do not introduce compatibility shims.
- Do not keep old prop names around after the cutover.

## Target Boundary

### Current Leak

`SchemaTypeMenu` owns this optional feature dependency:

```tsx
const LazyObjectTemplateSubmenu = React.lazy(() =>
  import(
    "@/components/schema-editor/optional/object-templates/object-template-menu"
  ).then((module) => ({
    default: module.ObjectTemplateSubmenu,
  }))
)
```

That makes the primitive layer aware of a feature module. Even though the import
is lazy, it is still the wrong boundary. A primitive should not know that object
templates exist.

### Desired Boundary

`SchemaTypeMenu` should accept menu sections from adapters:

```tsx
<SchemaTypeMenu
  variant="row"
  value={value}
  editable={editable}
  sections={sections}
  onSelect={handleSelect}
/>
```

Object templates become just another adapter-owned section:

```tsx
const sections = [
  primitiveTypeSection,
  definitionSection,
  objectTemplatesEnabled
    ? {
        id: "object-templates",
        render: ({ close }) => (
          <React.Suspense fallback={null}>
            <LazyObjectTemplateSubmenu
              onSelectTemplate={(templateName) => {
                onSelectObjectTemplate(templateName)
                close()
              }}
            />
          </React.Suspense>
        ),
      }
    : null,
].filter(Boolean)
```

The lazy import remains in:

- `document-node-type-menu.tsx`
- `property-form/fields/type-field.tsx`

The primitive receives already-assembled renderable content.

## `SchemaTypeMenu` API

Replace the current domain-shaped props:

```tsx
defs
definitionsEnabled
definitionCreateLabel
localType
objectTemplatesEnabled
onCreateDefinition
onSelectDefinition
onSelectObjectTemplate
onSelectType
```

with a smaller UI-shaped contract:

```ts
type SchemaTypeMenuValue = {
  id: string
  label: string
  icon: React.ReactNode
}

type SchemaTypeMenuItem = {
  id: string
  label: string
  icon?: React.ReactNode
  closeOnSelect?: boolean
  onSelect: () => void
}

type SchemaTypeMenuSection =
  | {
      id: string
      kind: "items"
      items: SchemaTypeMenuItem[]
    }
  | {
      id: string
      kind: "submenu"
      label: string
      icon?: React.ReactNode
      items: SchemaTypeMenuItem[]
    }
  | {
      id: string
      kind: "custom"
      render: (context: { editable: boolean }) => React.ReactNode
    }

type SchemaTypeMenuProps = {
  ariaLabel?: string
  editable: boolean
  value: SchemaTypeMenuValue
  variant: "row" | "form"
  sections: SchemaTypeMenuSection[]
}
```

The primitive owns:

- trigger geometry
- row/form variants
- disabled trigger state
- stale-open-menu no-op behavior when `editable` flips false
- dropdown and submenu chrome
- item spacing and icon alignment

The adapters own:

- which type options exist
- definition labels and decoded reference names
- object-template section rendering
- command dispatch
- JSON Schema mutation
- feature flags

## Adapter Helpers

To avoid duplicating type labels and option lists in both adapters, create one
non-component helper module:

```txt
components/schema-editor/primitives/schema-type-options.ts
```

It can export stable UI metadata:

```ts
export type SchemaTypeOptionId =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "enum"
  | "object"
  | "array"
  | "date"
  | "time"
  | "datetime"

export const schemaTypeOptions: SchemaTypeOption[] = [...]
export function schemaTypeLabel(type: string, refName?: string): string
export function schemaTypeIcon(type: string, refName?: string): React.ReactNode
```

This module may know about type icons and labels. It must not know about
definitions, object templates, feature flags, dispatch, or schema mutation.

Both adapters consume this helper to build `SchemaTypeMenuValue` and sections.

## Primitive Naming Cleanup

The primitive names are mostly right. Tighten the remaining surfaces around
concepts, not implementation.

### Keep

- `SchemaFieldRow`
- `SchemaRowGrip`
- `SchemaRowActions`
- `SchemaAddRow`
- `SchemaChipList`
- `SchemaTypeMenu`

### Tighten

`SchemaInlineName`

The component is really a field-name control, not a generic inline-name editor.
Rename to:

```txt
SchemaFieldName
```

Target props:

```ts
type SchemaFieldNameProps = {
  value: string
  editable: boolean
  reference?: {
    label: string
    onReveal: () => void
  }
  validate?: (value: string) => string | null
  onCommit: (value: string) => void
}
```

Remove `siblingValues` from the primitive. Sibling validation belongs in the
adapter-provided `validate` callback.

`SchemaInlineDescription`

Rename to:

```txt
SchemaFieldDescription
```

Target props:

```ts
type SchemaFieldDescriptionProps = {
  value: string
  editable: boolean
  placeholder?: string
  onOpenDetails?: () => void
  onCommit: (value: string) => void
}
```

Avoid passing `editMode` into primitives. `editMode` is an adapter/domain word.
The primitive only needs `editable` and optional `onOpenDetails`.

`SchemaAddRow`

Make labels explicit and remove default ambiguity:

```ts
type SchemaAddRowProps = {
  value: string
  error?: string | null
  disabled?: boolean
  inputLabel: string
  placeholder: string
  submitLabel: string
  className?: string
  onChange: (value: string) => void
  onSubmit: () => void
}
```

Use `onSubmit`, not `onAdd`, because the component owns a small form-like
interaction. Adapters can still name their local functions `addProperty`.

`SchemaChipList`

Separate input parsing from list rendering. The primitive should edit strings;
adapters should parse typed enum values on add/replace.

Target props:

```ts
type SchemaChipListProps = {
  values: string[]
  editable: boolean
  pendingValue: string
  placeholder: string
  submitLabel: string
  focusInputAfterSubmit?: boolean
  getKey: (index: number) => string
  onPendingValueChange: (value: string) => void
  onSubmitPendingValue: () => void
  onReplaceValue: (index: number, value: string) => void
  onRemoveValue: (index: number) => void
}
```

This removes generic `T`, `formatValue`, and `parseInput` from the primitive.
Typed values are adapter responsibility. The primitive displays editable text.

## Cutover Plan

1. Create `schema-type-options.ts`.
2. Change `SchemaTypeMenu` to accept `value` and `sections`.
3. Move `LazyObjectTemplateSubmenu` into `document-node-type-menu.tsx`.
4. Move a second `LazyObjectTemplateSubmenu` into
   `property-form/fields/type-field.tsx`, or share an adapter-only helper if the
   duplication becomes meaningful.
5. Update the document type-menu adapter to build primitive type, definition,
   and object-template sections.
6. Update the property-form type-field adapter to build the same section shape
   while keeping property-form mutation guards.
7. Rename `SchemaInlineName` to `SchemaFieldName` and remove `siblingValues`.
8. Rename `SchemaInlineDescription` to `SchemaFieldDescription` and replace
   `editMode` with `editable`.
9. Tighten `SchemaAddRow` labels and `onSubmit`.
10. Tighten `SchemaChipList` to string-only presentation and move parse/format
    into adapters.
11. Delete old filenames instead of leaving re-export shims.
12. Update all call sites in one cutover.

## Architecture Tests

Add or extend tests to enforce the boundary:

- no file under `components/schema-editor/primitives/` imports from
  `components/schema-editor/optional/`
- no file under `components/schema-editor/primitives/` imports from
  `components/schema-editor/property-form/`
- no file under `components/schema-editor/primitives/` imports from
  `components/schema-editor/document/`
- `schema-type-menu.tsx` does not contain `React.lazy`
- object-template submenu is loaded only in adapters
- primitive type menu accepts custom sections without knowing their source

The existing architecture test should fail if any optional feature import leaks
back into the primitive layer.

## Verification

Run focused checks:

```bash
pnpm typecheck
pnpm vitest run \
  tests/property-form.test.tsx \
  tests/schema-builder-architecture.test.ts \
  tests/schema-editor-render.test.tsx \
  tests/schema-property-add-row.test.tsx
pnpm exec eslint \
  components/schema-editor/primitives/*.tsx \
  components/schema-editor/document-node-type-menu.tsx \
  components/schema-editor/property-form/fields/type-field.tsx \
  components/schema-editor/document-node-name-control.tsx \
  components/schema-editor/document-node-description-control.tsx \
  components/schema-editor/property-form/fields/object-properties-field.tsx \
  components/schema-editor/property-form/fields/enum-values-field.tsx
```

After the unrelated docs compile error is fixed, verify:

```txt
http://localhost:3100/docs/components/property-form
```

Check that:

- object-builder rows still show the grip affordance
- row type menus and form type menus still match visually
- enum chips retain add, edit, remove, and focus behavior
- stale-open type menus remain inert after type editing becomes disabled
- no browser console errors are introduced by this surface

## Definition Of Done

The pass is complete when:

- `SchemaTypeMenu` has no optional-feature import and no `React.lazy`
- primitives expose UI concepts, not feature flags or mutation concepts
- document and property-form adapters are thin but explicit
- all old primitive names are deleted, not re-exported
- architecture tests enforce the new boundary
- focused behavior tests pass
- browser verification confirms the property-form object builder still matches
  the schema-builder row language
