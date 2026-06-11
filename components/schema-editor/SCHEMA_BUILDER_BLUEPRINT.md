# Schema Builder Blueprint

This is the target design for a clean Schema Builder component. The goal is a
small public component with one state model, one mutation path, and no demo-only
or dashboard-only concepts leaking into the registry API.

## North Star

`SchemaBuilder` should be a controlled JSON Schema field.

```tsx
<SchemaBuilder value={schema} onValueChange={setSchema} />
```

Everything inside the component can be richer than JSON Schema, but the public
contract stays plain Draft 7 JSON Schema. Consumers should not know about editor
contexts, document ids, recursive node editors, validation runners, or template
internals.

## Public API

```ts
export interface SchemaBuilderProps {
  value: ExtendedJSONSchema7
  onValueChange: (schema: ExtendedJSONSchema7) => void
  className?: string
  readOnly?: boolean
  mode?: "fields" | "json"
  onModeChange?: (mode: "fields" | "json") => void
  features?: SchemaBuilderFeatures
}

export interface SchemaBuilderFeatures {
  definitions?: boolean
  objectTemplates?: boolean
  jsonMode?: boolean
  importExport?: boolean
}
```

Defaults should be conservative:

- `definitions: true`
- `objectTemplates: false`
- `jsonMode: false`
- `importExport: false`

The default registry component should be lightweight. Heavier dashboard features
should be opt-in.

## Internal State Model

There should be exactly one internal source of truth: `SchemaDocument`.

JSON Schema should only appear at the boundary:

1. Import: `value -> fromJsonSchema(value) -> SchemaDocument`
2. Edit: `SchemaDocument -> operations -> SchemaDocument`
3. Emit: `SchemaDocument -> toJsonSchema(doc) -> onValueChange(schema)`

The component should not keep a parallel editable JSON Schema state. If a child
needs to update the schema, it dispatches a document operation.

## Core Hook

The core bridge should be a hook, not a legacy React context wrapper.

```ts
function useSchemaBuilderState({
  value,
  onValueChange,
}: {
  value: ExtendedJSONSchema7
  onValueChange: (schema: ExtendedJSONSchema7) => void
}) {
  return {
    doc,
    schema,
    validation,
    dispatch,
  }
}
```

Rules:

- Import external `value` only when it is genuinely external, not the component's
  own emitted echo.
- Keep refs synchronized in effects or event handlers, never during render.
- All edits go through `dispatch(operation)`.
- `dispatch` must emit exactly one schema per committed edit.
- Validation derives from the projected schema and does not mutate state during
  render.

## Render Tree

The ideal render tree is shallow and explicit:

```txt
SchemaBuilder
  SchemaBuilderShell
    SchemaToolbar
    ValidationBanner
    FieldsEditor
      ObjectNodeEditor
      ArrayNodeEditor
      ScalarNodeEditor
      EnumNodeEditor
      DefinitionEditor
    JsonModeEditor
```

Each node editor receives:

```ts
{
  nodeId: string
  doc: SchemaDocument
  dispatch: SchemaDispatch
  readOnly: boolean
  features: ResolvedSchemaBuilderFeatures
}
```

Node editors should not receive both `node` and `setJsonSchema`. They should
derive their node by id and dispatch document operations by id.

## Mutation Model

All mutation should live in `components/schema-editor/document/operations.ts`.

Preferred operations:

- `renameProperty(doc, propertyEntryId, name)`
- `moveProperty(doc, propertyEntryId, targetIndex)`
- `addProperty(doc, objectNodeId, draft?)`
- `removeProperty(doc, propertyEntryId)`
- `setNodeType(doc, nodeId, type)`
- `setNodeNullable(doc, nodeId, nullable)`
- `setNodeMetadata(doc, nodeId, metadata)`
- `addEnumValue(doc, nodeId, value?)`
- `setEnumValue(doc, nodeId, index, value)`
- `removeEnumValue(doc, nodeId, index)`
- `addDefinition(doc, definition)`
- `renameDefinition(doc, definitionEntryId, name)`
- `removeDefinition(doc, definitionEntryId)`
- `setRefTarget(doc, nodeId, definitionEntryId)`

UI components should not manually crawl JSON Schema objects to mutate nested
fields. That is the main purity boundary.

## Feature Boundaries

### Definitions

Definitions are core if `$ref` is core. They should remain in the base editor,
but reference integrity must be id-based internally and name-based only on
export.

### Object Templates

Object templates are useful, but they are not core. They should be behind
`features.objectTemplates`.

The template data should not be imported by the default bundle. Load it only when
the menu opens or when the feature is enabled.

### JSON Mode

JSON mode should be an optional editor mode, not a hidden prop that renders a
plain textarea by surprise.

If Monaco is not shipped, docs should call it JSON mode, not Monaco mode. If
Monaco is shipped, it should be dynamically imported behind `features.jsonMode`.

### Import, Export, Copy

These are product actions, not essential field-editing behavior. They belong
behind `features.importExport` or in a dashboard wrapper.

## File Layout

Target layout:

```txt
components/schema-editor/
  schema-builder.tsx
  use-schema-builder-state.ts
  schema-builder-types.ts
  validation.ts
  document/
    convert.ts
    derive.ts
    id.ts
    operations.ts
    types.ts
  nodes/
    object-node-editor.tsx
    array-node-editor.tsx
    scalar-node-editor.tsx
    enum-node-editor.tsx
    definition-editor.tsx
  templates/
    load-object-templates.ts
    object-template-menu.tsx
```

Registry entry:

```txt
registry/new-york-v4/ui/schema-builder.tsx
```

The registry entry should be a thin re-export or wrapper around
`components/schema-editor/schema-builder.tsx`. It should not own editor logic.

## Validation

Validation should be pure from the component's perspective:

```ts
const validation = useMemo(() => validateProjectedSchema(schema), [schema])
```

Validation should report:

- `is_valid`
- `errors`
- `property_count`
- `is_property_limit_exceeded`

It should not rely on hidden singleton error state from AJV after a separate
`validate` call unless that is wrapped into one pure helper.

## Performance

Minimum expectations:

- Stable ids for React keys.
- No path-string based remounting.
- No full schema deep clone for local node edits except at import/export
  boundaries.
- Lazy-load templates and JSON editor.
- Keep validation debounced or deferred for very large schemas.
- Avoid recursively stringifying the full schema on every render. Use explicit
  external-change tracking where possible.

## Accessibility

The editor should be usable without hover-only affordances.

Requirements:

- Every icon button has an accessible name.
- Drag handles have keyboard alternatives or explicit move actions.
- Dialogs trap focus and restore focus.
- Inline edits commit on Enter and blur, cancel on Escape.
- Required, nullable, and type state are exposed in labels or control names.

## Tests

The core should have three test layers:

1. Document operation tests: pure operations and conversion round trips.
2. Hook tests: controlled value import, echo suppression, dispatch emission.
3. Component tests: add, rename, reorder, enum edit, definition rename, ref edit,
   validation display, read-only mode.

Regression tests should cover:

- Definition rename updates exported `$ref`.
- Unknown JSON Schema keywords round trip.
- Nullable fields stay nullable after type changes.
- Property order survives reorder.
- No duplicate emits for one user edit.
- Public `SchemaBuilder` is the component used in docs demos.

## Migration Plan

1. Create `use-schema-builder-state` on top of the existing Document model.
2. Convert `SchemaNodeEditor` to receive `{ nodeId, doc, dispatch }`.
3. Remove `setJsonSchema` and JSON-object fallback mutation paths from node
   editors.
4. Move top-level import/export/copy actions into an optional toolbar feature.
5. Put object templates behind `features.objectTemplates` and lazy loading.
6. Replace `JsonSchemaEditorProvider` usage in docs and demos with
   `SchemaBuilder`.
7. Migrate `PropertyForm` and json-table consumers away from the legacy context.
8. Delete `contexts/json-schema.tsx` after the last consumer is migrated.

## Definition Of Done

The implementation is clean when:

- The public docs show only `SchemaBuilder`.
- The registry component has no lint warnings in isolation.
- The default bundle does not include template data or JSON-mode editor code.
- There is no render-time ref mutation.
- There is no manual JSON Schema tree crawling in UI components.
- All editor mutations are document operations.
- The old provider/context stack is gone.
- Focused schema-builder tests cover the public wrapper, not just internals.
