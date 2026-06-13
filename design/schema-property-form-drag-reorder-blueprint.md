# Schema Property Form Drag Reorder Blueprint

## Objective

Make nested object properties inside `PropertyForm` reorderable by drag, with the
same interaction quality as Schema Builder rows, without coupling the local
property-form draft editor to the document editor's identity-bearing model.

The target is one honest architecture:

- shared row visuals
- shared row drag interaction mechanics
- separate persistence adapters for document rows and property-form draft rows
- no fake grip affordances
- no broad compatibility layer

## Current Diagnosis

`PropertyForm` nested object rows look like Schema Builder rows but do not share
the reorder behavior.

The form path:

- `ObjectPropertiesField` renders `SchemaFieldRow`.
- It passes `grip={disabled ? "empty" : "static"}`.
- `SchemaRowGrip` renders a visible static icon for `static`.
- `useObjectPropertiesModel` exposes add, rename, remove, and replace actions.
- There is no move action.
- Rows edit a plain `ExtendedJSONSchema7` draft whose object properties live in
  `schemaNode.properties`.

The Schema Builder path:

- `DocumentPropertyRow` wraps each rendered node in a `draggable` div.
- `useDocumentObjectNodeEditorController` owns drag start, drag over, leave, and
  drop.
- Drop dispatches `moveProperty`.
- The document model stores object children as ordered `PropertyEntry[]` with
  stable property ids.

The mismatch is therefore not in the grip component. The mismatch is that
`PropertyForm` has presentation rows but no reorder domain action or drag row
controller.

## Non-Negotiable Invariants

- Do not move the document model into `PropertyForm`.
- Do not make `SchemaRowGrip` own drag behavior.
- Do not add a visual drag affordance unless the row is actually draggable.
- Do not create compatibility props such as `staticButMaybeDrag`.
- Do not use property names as React keys once drag behavior depends on row
  identity.
- Do not rely on object insertion order accidentally; reorder helpers must
  explicitly rebuild `properties`.
- Preserve `required` semantics exactly.
- Preserve nested row reset stability across rename, add, remove, reorder, and
  type changes.
- Keep drag mechanics reusable without importing document-editor operations into
  property-form modules.

## Target Architecture

### 1. Keep Row Primitives Presentational

`SchemaFieldRow` and `SchemaRowGrip` remain visual primitives.

`SchemaRowGrip` continues to expose three exact modes:

- `drag`: real drag affordance
- `static`: visible non-draggable row handle
- `empty`: layout placeholder

The primitive does not receive row ids, drag callbacks, schema nodes, property
names, document ids, or drop state.

### 2. Extract A Generic Row Drag Controller

Create a schema-editor row drag helper that is independent of both persistence
models.

Suggested module:

```txt
components/schema-editor/primitives/schema-row-drag.ts
```

Suggested surface:

```ts
interface SchemaRowDragItem {
  id: string
  label: string
}

interface SchemaRowDragEvent {
  currentTarget: HTMLElement
  dataTransfer: DataTransfer
  preventDefault(): void
  stopPropagation(): void
}

interface SchemaRowDragState {
  draggedRowIdRef: React.RefObject<string | null>
}

function beginSchemaRowDrag(options: {
  event: React.DragEvent<HTMLElement>
  item: SchemaRowDragItem
  draggedRowIdRef: React.RefObject<string | null>
}): void

function updateSchemaRowDragTarget(options: {
  event: React.DragEvent<HTMLElement>
  rowIds: string[]
  targetRowId: string
  draggedRowIdRef: React.RefObject<string | null>
}): void

function leaveSchemaRowDragTarget(
  event: Pick<React.DragEvent<HTMLElement>, "currentTarget" | "stopPropagation">
): void

function resolveSchemaRowDrop(options: {
  event: React.DragEvent<HTMLElement>
  rowIds: string[]
  targetRowId: string
  draggedRowIdRef: React.RefObject<string | null>
}): { sourceRowId: string; targetIndex: number } | null
```

This module owns:

- native drag event setup
- `dataTransfer` payload
- drag preview creation
- drop indicator class application
- source/target index resolution

It does not own:

- schema mutation
- document dispatch
- property draft state
- validation
- row rendering

### 3. Make Document Drag Use The Generic Controller

Replace document-specific drag mechanics with the generic row drag controller,
while keeping document-specific persistence in
`useDocumentObjectNodeEditorController`.

Document adapter responsibilities:

- map `DocumentPropertyView.propertyId` to `SchemaRowDragItem.id`
- map `DocumentPropertyView.propertyName` to `SchemaRowDragItem.label`
- pass ordered `propertyIds`
- call `moveProperty(current, sourcePropertyId, objectNodeId, targetIndex)`

The existing `document-property-drag.ts` can either disappear or become a small
document adapter if there is a real reason to keep the filename. Prefer deleting
it after migration if the generic helper expresses the full interaction.

### 4. Add A Property-Form Reorder Domain Helper

Add a JSON Schema draft reorder helper next to the existing object property edit
helpers.

Suggested module location:

```txt
components/schema-editor/property-form/model/object-property-edits.ts
```

Suggested function:

```ts
function moveObjectProperty(options: {
  schemaNode: ExtendedJSONSchema7
  propertyName: string
  targetIndex: number
}): ExtendedJSONSchema7
```

Rules:

- Return the original `schemaNode` if the source property does not exist.
- Clamp `targetIndex` to the valid insertion range.
- Rebuild `properties` in the new order with `Object.defineProperty`, matching
  the existing prototype-safe write pattern.
- Preserve each property schema object by reference.
- Preserve `required` values and order unless a rename/remove operation changes
  names. Reorder is a property display/order operation, not a required-order
  operation.
- Preserve all other schema keywords by spreading `schemaNode`.

Required tests:

- moves first property to the end
- moves last property to the beginning
- clamps out-of-range target indexes
- returns original schema for missing source property
- preserves `required`
- preserves prototype-key property names such as `__proto__`

### 5. Extend The Property-Form Object Properties Model

Extend `ObjectPropertyRowModel.actions`:

```ts
actions: {
  rename(name: string): void
  remove(): void
  replaceSchemaNode(schemaNode: ExtendedJSONSchema7): void
  move(targetIndex: number): void
}
```

The model already maintains stable row ids by property name. Reorder should:

- leave `rowIdsByName` unchanged
- preserve pending add-row input as a local property edit
- call `onChange(moveObjectProperty(...))`
- use the current ordered `propertyNames` as the source of truth

The row ids remain local UI identities; the moved schema property is still
identified by property name when mutating the JSON Schema draft.

### 6. Add A Property-Form Drag Adapter

Add a small hook next to the object-properties field/model.

Suggested module:

```txt
components/schema-editor/property-form/fields/object-properties-drag.ts
```

Suggested surface:

```ts
function useObjectPropertiesDrag(options: {
  rows: ObjectPropertyRowModel[]
  disabled: boolean
}): {
  rowIds: string[]
  getRowDragProps(row: ObjectPropertyRowModel): {
    draggable: boolean
    onDragStart: React.DragEventHandler<HTMLDivElement>
    onDragOver: React.DragEventHandler<HTMLDivElement>
    onDragLeave: React.DragEventHandler<HTMLDivElement>
    onDrop: React.DragEventHandler<HTMLDivElement>
  }
}
```

Drop behavior:

- resolve `{ sourceRowId, targetIndex }`
- find the source row by row id
- call `sourceRow.actions.move(targetIndex)`

This hook is an adapter. It does not mutate schemas directly.

### 7. Wire ObjectPropertiesField Honestly

`ObjectPropertiesField` should wrap each `SchemaFieldRow` in a draggable row
shell when editable.

Target shape:

```tsx
const drag = useObjectPropertiesDrag({
  rows: model.rows,
  disabled,
})

{model.rows.map((row) => (
  <div
    key={row.id}
    className="ml-4 border-l border-border"
    data-property-form-row-id={row.id}
    data-property-form-property-name={row.name}
    {...drag.getRowDragProps(row)}
  >
    <SchemaFieldRow
      grip={disabled ? "empty" : "drag"}
      ...
    />
    {renderPropertyDetails(row.details)}
  </div>
))}
```

If dragging is disabled, the row must not be draggable and the grip must not
look draggable.

Do not attach drag props directly to `SchemaFieldRow` unless the primitive grows
a deliberate wrapper slot. The shell owns behavior; the row owns layout.

## Testing Plan

### Unit Tests

Add property-form model tests for `moveObjectProperty` and
`useObjectPropertiesModel`.

Assertions:

- object property key order changes after move
- required flags are preserved
- row ids are preserved across reorder
- pending add input is preserved across local reorder
- missing source property is a no-op
- duplicate/prototype-key behavior remains correct

### Interaction Tests

Add a focused component test around `PropertyForm`:

- render an object property with `street`, `city`, `zip`
- drag `zip` before `street`
- submit
- assert committed schema property order is `zip`, `street`, `city`

Use real drag events where the existing test stack supports them. If jsdom is
too weak for reliable native drag, keep domain tests in Vitest and cover browser
behavior in E2E.

### E2E Tests

Extend `e2e/schema-property-form.spec.ts`:

- open `/docs/components/property-form`
- verify editable object row grips have pointer affordance
- drag `city` before `street`
- verify visible order changes
- save
- verify the demo state keeps the new order after another edit that rerenders
  the form

Extend Schema Builder E2E or interaction coverage enough to prove the document
adapter still reorders after the generic drag extraction.

### Architecture Tests

Update `tests/schema-builder-architecture.test.ts`:

- primitives may export generic row drag helpers
- generic row drag helpers must not import property-form model modules
- generic row drag helpers must not import document model/operation modules
- property-form fields may import primitive drag helpers
- document editor controller may import primitive drag helpers

## Migration Sequence

### Step 1. Extract Drag Mechanics

Create the generic row drag helper and migrate document drag to it without
changing behavior.

Exit criteria:

- Schema Builder drag still works.
- Existing reorder tests pass.
- `document-property-drag.ts` is deleted or reduced to a thin adapter.

### Step 2. Add Draft Reorder Semantics

Add `moveObjectProperty` and model-level `actions.move`.

Exit criteria:

- Property-form model tests prove order, required preservation, and row id
  stability.
- No UI behavior changes yet.

### Step 3. Wire PropertyForm Drag

Add the property-form drag adapter and switch editable object rows from static
grips to drag grips.

Exit criteria:

- Docs page object rows are draggable.
- Non-editable/disabled modes still render empty or non-draggable grips.
- Nested object editing still works.
- Add, rename, delete, type change, and description edit still work after
  reorder.

### Step 4. Tighten Tests And Remove Dead Paths

Remove old drag-specific code that no longer has a distinct responsibility.

Exit criteria:

- No duplicate row drag implementations.
- No static grip appears on an editable row that is intended to reorder.
- No document model import appears in property-form files.
- No property-form model import appears in primitive drag files.

## Failure Modes To Avoid

- Dragging starts from the whole row but the grip is the only visible affordance.
  This is acceptable for native drag if the whole row is draggable, but the grip
  must visibly communicate the behavior.
- Reordering by deleting and re-adding property schemas in a way that loses
  non-enumerable prototype-safe keys.
- Reordering `required` along with `properties`. Required order is not the
  visible property order contract.
- Converting the property form into a document editor internally. That would
  solve drag at the cost of making the local draft form depend on global editor
  machinery.
- Adding a dnd library for this small native-DnD interaction unless native drag
  proves insufficient for keyboard/accessibility goals.

## Accessibility Follow-Up

Native drag alone is not a complete accessible reorder story.

After pointer drag works, add keyboard reorder controls if this component is
expected to be production-editable for keyboard users:

- move up
- move down
- announce new position
- disable impossible moves

These controls should reuse the same `actions.move` path and not introduce a
second reorder implementation.

## Final Shape

The final architecture should read like this:

- `SchemaFieldRow` renders a row.
- `SchemaRowGrip` renders an honest affordance.
- `schema-row-drag.ts` implements generic native row drag mechanics.
- `useDocumentObjectNodeEditorController` adapts generic drag to
  `moveProperty`.
- `useObjectPropertiesModel` adapts generic drag to `moveObjectProperty`.
- `ObjectPropertiesField` renders draggable rows when editable.

That is the smallest architecture that makes the components truly modularized:
shared presentation, shared interaction, separate domain mutation.
