# Schema Builder Architecture

This is the single architecture note for the schema-builder component.

## Standard

- Everything needed.
- Nothing more.
- One public component.
- One committed editing model.
- Stable ids for nodes, properties, definitions, and enum rows.
- Optional features outside the default bundle path.
- No compatibility aliases, fallback state models, or legacy providers.

## Public Contract

```ts
export interface SchemaBuilderProps {
  value: ExtendedJSONSchema7
  onValueChange: (schema: ExtendedJSONSchema7) => void
  className?: string
  readOnly?: boolean
  view?: "fields" | "json"
  onViewChange?: (view: "fields" | "json") => void
  features?: SchemaBuilderFeatures
}
```

Default optional features are disabled:

- `objectTemplates: false`
- `jsonMode: false`
- `importExport: false`

Definitions stay enabled because they are part of the field editor.

## State Model

There is one committed editing model:

```txt
ExtendedJSONSchema7
  -> fromJsonSchema
  -> SchemaDocument
  -> document operations
  -> toJsonSchema
  -> ExtendedJSONSchema7
```

JSON Schema is the public wire format. `SchemaDocument` is the editor model.

`SchemaDocument` owns:

- node ids
- property edge ids
- definition ids
- enum row ids
- explicit object property order
- refs by definition id
- nullable/type state
- unmodeled JSON Schema keywords in `rest`

## Module Boundaries

Core field editor:

```txt
schema-builder.tsx
use-schema-builder-state.ts
document-schema-editor.tsx
document-schema-node-editor.tsx
document-node-header.tsx
document-object-node-editor.tsx
document-property-row.tsx
document-array-node-editor.tsx
document-enum-node-editor.tsx
document/
property-form/
```

Optional features:

```txt
optional/
  json-mode/
  import-export/
  object-templates/
```

JSON-table integration lives outside schema-editor:

```txt
components/json-table/schema-property-operations.ts
```

## Forbidden

- `SchemaBuilderProvider`
- `useJsonSchema`
- `contexts/json-schema`
- `json-schema-builder.tsx`
- `json-schema-node-editor.tsx`
- `json-schema-builder-utils.ts`
- `legacy/legacy-json-tree-replacement.ts`
- `ItemTypeSelector`
- `DraftSchemaNodeField`
- `CreateDefinitionDialog`
- path or object-reference replacement inside the schema-builder core
- property operations addressed by child node id

## Guarantees

- `SchemaBuilder` is fully controlled.
- `useSchemaBuilderState` handles import, projection, validation, echo
  suppression, and emission.
- Property edge operations use `PropertyEntry.id`; child node ids are only for
  child node edits.
- Root metadata edits are document operations.
- Object templates, JSON mode, and import/export enter through optional lazy
  modules.
- Architecture tests guard the deleted compatibility surfaces and forbidden
  imports.

## Remaining Judgment Call

Recursive field rendering still receives projected JSON Schema nodes as its view
input, while all mutations go through `SchemaDocument` operations. That is an
intentional boundary for now: it preserves the mature field UI and keeps JSON
Schema projection contained to rendering, JSON mode, validation, and public
emission.
