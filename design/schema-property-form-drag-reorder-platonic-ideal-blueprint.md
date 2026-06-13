# Schema Property Form Drag Reorder Platonic Ideal Blueprint

## Objective

Take the completed `PropertyForm` object-property drag reorder implementation
from "works correctly" to the platonic ideal:

- simplicity
- speed
- everything needed
- nothing more
- perfect modularization
- high-entropy code
- perfectly consistent variable names
- Flaubertian precision

The current implementation fixes the fake grip problem. This blueprint closes
the remaining gap between functional pointer drag and an exact, complete,
accessible reorder system.

## Current State

The drag-reorder implementation now has the right broad architecture:

- `SchemaFieldRow` and `SchemaRowGrip` stay presentational.
- `schema-row-drag.ts` owns shared native row drag mechanics.
- Schema Builder adapts shared drag mechanics to `moveProperty`.
- `PropertyForm` adapts shared drag mechanics to a JSON Schema draft reorder.
- Editable property-form object rows are actually draggable.
- The docs page verifies `draggable="true"` and pointer grip affordance.
- Unit, architecture, typecheck, lint, and Playwright coverage exist.

This is good. It is not perfect.

## Remaining Non-Ideal Tension

### 1. Pointer Drag Exists, Keyboard Reorder Does Not

Native drag is not a complete reorder interaction.

Missing:

- keyboard move up
- keyboard move down
- clear disabled states at list boundaries
- screen-reader announcement of the new position
- a single action path shared by pointer and keyboard reorder

The current `actions.move(targetIndex)` is the right domain primitive. The UI
does not yet expose it accessibly.

### 2. Drag Activator Semantics Are Not Exact

The visible affordance is the grip, but the draggable DOM surface is the full row
shell.

This is acceptable, but not inevitable. The ideal should choose one precise
contract:

- Grip-only drag handle, where the handle is the actual activator.
- Whole-row drag, where the whole row visibly and semantically communicates that
  it can be dragged.

The current state mixes those signals: users see a grip, but the entire row can
initiate native drag.

### 3. Drop Placement Is Coarse

The current drop target index follows the existing Schema Builder behavior:

- if source is before target, drop after target
- if source is after target, drop before target

That keeps reordering deterministic, but it does not use pointer position inside
the target row. A perfect reorder interaction should place before or after based
on the pointer crossing the target row midpoint.

### 4. Move Math Exists In More Than One Shape

`moveObjectProperty` reorders schema property entries.
`movePropertyName` reorders property names so the model can preserve pending
local input.

The duplication is small, but it is not Flaubertian. There should be one generic
ordered-list move helper with one name and one set of clamping semantics.

### 5. Native Drag Preview Is Generic

The drag preview currently shows a simple floating label. That is fast and
simple, but not ideal.

The ideal preview should be:

- stable
- cheap
- recognizably row-shaped
- not a second implementation of row layout
- not visually noisy

If a row-shaped preview would require duplicating layout, keep the label preview.
The ideal is not maximal decoration; it is exact utility.

### 6. Touch Support Is Undefined

HTML native drag is inconsistent on touch devices. If `PropertyForm` is expected
to be production-editable on touch, the ideal cannot rely on native drag alone.

This does not automatically mean adding a large DnD library. It means making an
explicit product decision:

- pointer drag is desktop-only and keyboard reorder is the accessible fallback;
  or
- implement pointer/touch drag through a small unified interaction controller;
  or
- use a proven library only if it reduces net complexity.

## Non-Negotiable Invariants

- Do not move the document model into `PropertyForm`.
- Do not make `SchemaRowGrip` own domain behavior.
- Do not create two reorder action paths for pointer and keyboard.
- Do not add keyboard controls that mutate schema order independently from
  `actions.move`.
- Do not make row drag helpers import document operations or property-form
  model modules.
- Do not hide reorder controls behind text instructions.
- Do not add decorative controls or duplicate visual affordances.
- Do not introduce a DnD library unless it removes more complexity than it adds.
- Do not preserve the full-row drag surface if the chosen ideal is grip-only
  activation.
- Do not preserve grip-only visual signaling if the chosen ideal is whole-row
  dragging.

## Target Shape

### 1. One Ordered Move Primitive

Add a generic helper for moving one item inside an ordered list.

Suggested module:

```txt
components/schema-editor/primitives/schema-order.ts
```

Suggested API:

```ts
export function moveOrderedItem<T>({
  items,
  sourceIndex,
  targetIndex,
}: {
  items: readonly T[]
  sourceIndex: number
  targetIndex: number
}): T[]
```

Rules:

- Return the original item order copied into a new array.
- If `sourceIndex` is invalid, return `items.slice()`.
- Clamp `targetIndex` after removing the source item.
- Preserve item object identity.
- Own the only clamping semantics for local reorders.

Then:

- `moveObjectProperty` uses `moveOrderedItem` over property entries.
- `movePropertyName` disappears and the model uses `moveOrderedItem`.
- Generic row drop resolution uses the same clamping convention where practical.

Exit criteria:

- No bespoke splice/clamp reorder math remains in property-form code.
- Tests cover invalid source, same index, negative target, and overlarge target.

### 2. Exact Drag Activation Contract

Choose one of two final contracts.

Preferred contract: grip-only drag handle.

Target shape:

```tsx
<SchemaFieldRow
  grip={
    <SchemaRowDragHandle
      label={`Reorder ${row.name}`}
      {...drag.getHandleProps(row)}
    />
  }
  ...
/>
```

That likely requires changing `SchemaFieldRow` from:

```ts
grip: SchemaRowGripMode
```

to:

```ts
grip: React.ReactNode
```

or adding a dedicated `dragHandle` slot.

Rules:

- The actual draggable element is the visible handle.
- The handle has an accessible name.
- The handle has pointer cursor.
- The row shell receives drop target handlers but does not start drag.
- The grip component remains presentational; the adapter owns event props.

Alternative contract: whole-row drag.

Rules:

- The row shell gets explicit draggable styling on hover/focus.
- The grip remains a visual hint, not the only apparent activator.
- Tests assert the row, not only the grip, is the draggable surface.

Do not leave the contract ambiguous.

### 3. Midpoint-Based Drop Placement

Change generic row drag target calculation from source-order-based placement to
pointer-position-based placement.

Suggested API:

```ts
function getSchemaRowDropPlacement(options: {
  targetRect: DOMRect
  clientY: number
}): "before" | "after"
```

Drop resolution should return:

```ts
{
  sourceRowId: string
  targetRowId: string
  placement: "before" | "after"
  targetIndex: number
}
```

Rules:

- Pointer in the top half of a row means before.
- Pointer in the bottom half means after.
- Moving a row down must account for source removal before insertion.
- Moving a row onto itself returns `null`.
- The visual drop indicator uses the same placement calculation as the final
  drop.

Exit criteria:

- Unit tests cover moving up/down with before/after placement.
- Playwright drag verifies visible order for both directions if feasible.

### 4. Keyboard Reorder Controls

Add keyboard reorder affordances for object rows.

Preferred UI:

- Icon button: move up
- Icon button: move down
- Buttons live in row actions next to delete.
- Buttons are hidden or disabled when reorder is unavailable.
- Buttons use `ArrowUp` / `ArrowDown` icons if present in `lucide-react`.

Accessible labels:

- `Move field {name} up`
- `Move field {name} down`

Behavior:

- Move up calls `row.actions.move(currentIndex - 1)`.
- Move down calls `row.actions.move(currentIndex + 1)`.
- First row cannot move up.
- Last row cannot move down.
- After move, focus remains on the moved row's relevant control when possible.
- Announce: `{name} moved to position {position} of {count}`.

The announcement should be a small reusable live-region primitive or a
field-local live region. Do not add a global dependency unless one already
exists.

Exit criteria:

- Keyboard-only users can reorder every object property.
- Pointer drag and keyboard controls use the same model action.
- Tests verify boundary disabled states and committed schema order.

### 5. Row Reorder Model Becomes Explicit

Extend `ObjectPropertyRowModel` with explicit reorder state instead of forcing
the view to infer from array position.

Target shape:

```ts
interface ObjectPropertyRowReorderModel {
  canMoveUp: boolean
  canMoveDown: boolean
  position: number
  rowCount: number
  moveUp(): void
  moveDown(): void
  move(targetIndex: number): void
}
```

Then:

```ts
row.reorder.move(targetIndex)
row.reorder.moveUp()
row.reorder.moveDown()
```

Rules:

- Use `reorder`, not `drag`, for domain operations.
- Drag adapters consume `row.reorder.move`.
- Keyboard buttons consume `row.reorder.moveUp` / `moveDown`.
- The view does not compute row boundaries.

Exit criteria:

- `ObjectPropertiesField` does not calculate movement indexes.
- `object-properties-drag.ts` does not know about property names.
- All reorder vocabulary is `row`, `reorder`, `position`, `targetIndex`.

### 6. Generic Row Drag Helper Becomes Mechanically Pure

`schema-row-drag.ts` should own browser mechanics, but its API should be as
small as possible.

Ideal responsibilities:

- begin drag with id and label
- calculate and apply drop placement
- clear drop indicator
- resolve source id and target insertion index

Non-responsibilities:

- property names
- schema nodes
- document ids
- row rendering
- keyboard reorder
- model mutation

Exit criteria:

- Primitive architecture test proves no imports from document or property-form.
- Generic helper tests cover all placement math.
- The helper exposes no extra types that only one adapter uses.

## Testing Plan

### Unit Tests

Add or extend tests for:

- `moveOrderedItem`
- `moveObjectProperty` using `moveOrderedItem`
- midpoint placement before/after
- moving up and down with source-removal index adjustment
- same-row drop returns `null`
- invalid source id returns `null`

### Component Tests

Add `PropertyForm` tests for:

- move-up button disabled on first row
- move-down button disabled on last row
- clicking move up commits reordered schema
- clicking move down commits reordered schema
- pointer drag and keyboard reorder preserve `required`
- pending add-row input survives keyboard reorder
- focus remains usable after a keyboard move

### E2E Tests

Extend `e2e/schema-property-form.spec.ts`:

- verify the chosen drag activator contract
- drag before and after using pointer placement
- reorder with keyboard controls
- save and verify order survives rerender

Extend Schema Builder E2E if the shared drag helper changes placement behavior.

### Architecture Tests

Add assertions:

- no bespoke splice/clamp move logic in property-form fields
- `moveOrderedItem` is used by draft reorder helpers
- primitive drag helper imports no document/property-form modules
- property-form drag adapter mutates nothing directly
- row view consumes `row.reorder`, not raw move math

## Migration Sequence

### Step 1. Add Generic Move Helper

Implement `moveOrderedItem` and migrate `moveObjectProperty` plus model name
ordering to it.

Exit criteria:

- Existing drag behavior unchanged.
- Unit tests prove move semantics.

### Step 2. Make Row Reorder Model Explicit

Replace `row.actions.move` with `row.reorder`.

Exit criteria:

- Drag adapter calls `row.reorder.move`.
- View gets boundary state from the model.
- Existing tests pass.

### Step 3. Add Keyboard Reorder

Add row action controls and live announcement.

Exit criteria:

- Keyboard reorder works without pointer drag.
- Tests prove boundary disabled states and committed schema order.

### Step 4. Finalize Drag Activator Contract

Choose grip-only or whole-row drag and make code, UI, and tests match that
contract exactly.

Exit criteria:

- No ambiguous affordance remains.
- E2E asserts the chosen contract.

### Step 5. Upgrade Drop Placement

Move from source-order placement to midpoint placement if the interaction should
support precise before/after drops.

Exit criteria:

- Drag indicator and final drop use the same placement.
- Tests cover both directions and both placements.

## Completion Criteria

The component reaches the platonic ideal when all are true:

- Pointer users can reorder object fields precisely.
- Keyboard users can reorder object fields completely.
- Screen-reader users receive clear move feedback.
- The visible drag affordance matches the actual drag activator.
- There is one local ordered-move helper and one clamping rule.
- Pointer and keyboard reorder share the same domain action.
- PropertyForm stays a local JSON Schema draft editor.
- Schema Builder stays a document-model editor.
- Shared primitives stay model-agnostic.
- Tests prove behavior at model, component, E2E, architecture, typecheck, and
  lint levels.
- No unused abstractions, compatibility shims, duplicate paths, or vague naming
  remain.

## Deliberate Non-Goals

- Do not redesign the entire property form.
- Do not change Schema Builder persistence semantics.
- Do not introduce animated drag polish before accessibility and exactness.
- Do not add touch drag unless the product requirement is explicit.
- Do not make the blueprint depend on a specific DnD library.
