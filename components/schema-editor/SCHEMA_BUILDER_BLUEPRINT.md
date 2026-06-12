# Schema Builder Platonic Blueprint

This is the contract for the schema-builder component at its ideal end state:
everything needed, nothing more, one state model, one render model, one
vocabulary, no historical scaffolding.

## Standard

- One public component: `SchemaBuilder`.
- One public entry and exit format: OpenAPI-compatible JSON Schema.
- One committed editing model: `SchemaDocument`.
- One recursive render model: `DocumentNodeView`.
- One mutation path: named document operations.
- One property-form API: `propertyDraft`, `schemaContext`,
  `onPropertyDraftChange`, `onCommitPropertyDraft`.
- Optional features are physically optional.
- JSON-table path editing lives outside `components/schema-editor`.
- Compatibility code does not exist in the core.
- Tests prove architecture, behavior, identity, accessibility, and the public
  boundary.

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

Forbidden public concepts:

- document ids
- property ids
- document operation objects
- template registries
- path mutation APIs
- uncontrolled `defaultValue`
- dashboard persistence callbacks
- compatibility aliases

## State Law

```txt
ExtendedJSONSchema7
  -> fromJsonSchema
  -> SchemaDocument
  -> DocumentNodeView
  -> document operations
  -> toJsonSchema
  -> ExtendedJSONSchema7
```

Rules:

- JSON Schema is public boundary data.
- `SchemaDocument` owns node ids, property ids, definition ids, enum row ids,
  nullable state, refs, required state, order, and unmodeled keyword `rest`.
- `DocumentNodeView` is the recursive render model.
- Recursive editors do not project JSON Schema for rendering.
- Render paths do not mutate state.
- Every committed edit emits at most one schema.
- External prop changes import only when they differ from the last emitted
  schema.

Allowed JSON Schema boundaries:

- public `value`
- public `onValueChange`
- top-level metadata editor
- JSON mode
- import/export
- validation
- JSON-table adapter
- property metadata dialog drafts

Forbidden JSON Schema boundaries:

- recursive editor props
- property row identity
- reorder logic
- add-property flow
- enum-row flow
- object-template application in the document editor

## Vocabulary Law

Use:

- `schema`: public OpenAPI-compatible JSON Schema.
- `projectedSchema`: JSON Schema derived from `SchemaDocument` at a named
  boundary.
- `doc`: `SchemaDocument`.
- `docNode`: raw `DocumentNode`.
- `nodeView`: `DocumentNodeView`.
- `nodeId`: `DocumentNode.id`.
- `property`: `DocumentPropertyView` or `PropertyEntry`, by layer.
- `propertyId`: property edge identity.
- `propertyName`: mutable display key.
- `definition`: definition entry/view.
- `definitionId`: definition identity.
- `draft`: editable property form payload at the public form boundary.
- `context`: property form context at the public form boundary.
- `schemaContext`: field-level context only inside schema-aware field models.
- `dispatch`: `SchemaDispatch`.

Forbidden executable vocabulary:

- `jsonSchema`
- `setJsonSchema`
- `applyDocOp`
- `propName`
- `childId` when the value identifies a property edge
- `replaceSchemaNodeByReference`
- `legacy-json-tree-replacement`
- legacy `draft=` / `context=` `PropertyForm` props
- legacy `onDraftChange` / `onCommit` `PropertyForm` callbacks
- compatibility aliases whose only job is old-name support

## Target Module Shape

```txt
components/schema-editor/
  schema-builder.tsx
  schema-builder-types.ts
  schema-editor-mode.ts
  use-schema-builder-state.ts
  schema-title.ts
  schema-required-policy.ts
  schema-validation.ts
  lib/configure-ajv.ts

  document/
    array.ts
    convert.ts
    definition-operations.ts
    derive.ts
    enum-operations.ts
    id.ts
    json-node.ts
    node-metadata.ts
    node-selectors.ts
    node-update.ts
    property-operations.ts
    traversal.ts
    type-operations.ts
    types.ts
    view-model.ts

  top-level-editor.tsx
  top-level-editor-controller.ts
  document-definitions-editor.tsx
  document-definitions-editor-controller.ts
  document-schema-editor-controller.ts
  document-schema-editor.tsx
  document-schema-node-editor.tsx
  document-node-header-controller.ts
  document-node-header.tsx
  document-node-reveal.ts
  document-object-node-editor-controller.ts
  document-object-node-editor.tsx
  document-property-drag.ts
  document-property-row.tsx
  document-property-add-row.tsx
  document-property-reorder.ts
  document-array-node-editor.tsx
  document-enum-node-editor.tsx

  property-form/
    property-form.tsx
    property-form-controller.ts
    property-form-shell.tsx
    property-form-footer.tsx
    reducer.ts
    types.ts
    validation.ts
    fields/
    model/

  optional/
    json-mode/
    import-export/
    object-templates/
```

Deleted forever:

- root `property-form-types.ts`
- root `property-form-reducer.ts`
- root `property-form-validation.ts`
- root `property-form.tsx`
- `property-form/index.ts`
- `document/index.ts`
- `document/operations.ts`
- `document/tree.ts`
- `json-schema-top-level-editor.tsx`
- `schema-property-operations.ts` inside `schema-editor`
- legacy context/provider files
- object-reference replacement helpers
- broad compatibility barrels

## Implemented Architecture

### Document View Model

`document/view-model.ts` owns recursive render derivation:

- `DocumentNodeView`
- `DocumentPropertyView`
- `DocumentDefinitionView`
- `getDocumentNodeView`
- `getSchemaDocumentView`

Recursive editors receive `nodeView`. Child editors map `nodeView.properties`,
`nodeView.items`, and `nodeView.enumEntries`. JSON Schema projection is not used
to choose recursive children or row identity.

### Property Edge Identity

Property rows are keyed by `propertyId`. Rename, required, remove, drag, drop,
and reorder dispatch property-edge operations by `propertyId`.

### Property Form Boundary

Core `PropertyForm` accepts only:

```tsx
<PropertyForm
  propertyDraft={propertyDraft}
  schemaContext={schemaContext}
  capabilities={capabilities}
  validation={validation}
  onPropertyDraftChange={setPropertyDraft}
  onCommitPropertyDraft={commitPropertyDraft}
  onCancel={close}
  onDelete={deleteProperty}
/>
```

No old prop aliases are part of the core component.

### Top-Level Editor Boundary

`TopLevelEditor` uses the same formatting and naming style as the surrounding
schema-builder modules. Local edit state uses `draftTitle`, `isTitleDirty`,
`draftDescription`, and `isDescriptionDirty`; icon-only buttons have accessible
names.

### JSON-Table Adapter Isolation

Path-string schema operations live in
`components/json-table/schema-property-operations.ts`. The schema-editor core
does not own those adapters.

## Proof Gate

Run:

```sh
bun x eslint components/schema-editor components/json-table/schema-property-operations.ts components/property-form-demo.tsx tests/schema-builder-architecture.test.ts tests/property-form.test.tsx tests/schema-document-view-model.test.ts
bun run test tests/schema-builder-architecture.test.ts tests/schema-document-view-model.test.ts tests/schema-editor-context.test.tsx tests/schema-editor-render.test.tsx tests/schema-document-bridge.test.ts tests/schema-document-edge.test.ts tests/schema-document-operations.test.ts tests/schema-document-fuzz.test.ts tests/property-form.test.tsx tests/schema-builder-public.test.tsx tests/schema-property-reorder.test.ts tests/schema-property-operations.test.ts tests/schema-property-add-row.test.tsx
bun x tsc --noEmit --pretty false --incremental false
git diff --check
curl -I --max-time 10 http://localhost:3100/docs/components/schema-builder
```

Required negative greps:

```sh
rg "applyDocOp|replaceSchemaNodeByReference|legacy-json-tree-replacement" components/schema-editor
rg "json-schema-top-level-editor|property-form-reducer|property-form-types|property-form-validation" components/schema-editor
rg "key=\\{propName\\}|key=\\{propertyName\\}|\\bpropName\\b" components/schema-editor
rg "draft=|context=|onDraftChange|onCommit=|PropertyFormLegacyProps|props\\.draft|props\\.context" components/schema-editor components/property-form-demo.tsx tests/property-form.test.tsx
rg "from\\s+[\"']@/components/schema-editor/document[\"']|document/operations|document/tree|lastExternalVersion" components/schema-editor tests
rg "as unknown as" components/schema-editor --glob '!components/schema-editor/lib/configure-ajv.ts'
rg "projectNode|getEffectiveNode|getEffectiveDocNode" components/schema-editor/document-schema-node-editor.tsx components/schema-editor/document-object-node-editor.tsx components/schema-editor/document-array-node-editor.tsx components/schema-editor/document-enum-node-editor.tsx
rg "document\\.|window\\.|setTimeout|requestAnimationFrame" components/schema-editor --glob '!components/schema-editor/document-node-reveal.ts' --glob '!components/schema-editor/document-property-drag.ts' --glob '!components/schema-editor/optional/import-export/import-export-menu-items.tsx'
```

Required architecture assertions:

- deleted compatibility files stay deleted
- recursive editors consume `DocumentNodeView`
- row identity is `propertyId`
- property form public boundary uses `propertyDraft`, `schemaContext`,
  `onPropertyDraftChange`, `onCommitPropertyDraft`
- top-level editor uses final naming and accessible icon buttons
- high-level editor views do not call `dispatch` directly
- DOM side effects stay confined to named browser helper modules
- high-level editor views stay below line budgets
- optional features are absent from default imports
- JSON-table path operations stay outside schema-editor
- object-template code has no JSON replacement fallback

## Final Judgment

The component is ideal only when every layer has one language:

- public boundary: OpenAPI-compatible JSON Schema
- committed state: `SchemaDocument`
- recursive rendering: `DocumentNodeView`
- property-form boundary: `propertyDraft` and `schemaContext`
- property identity: `propertyId`
