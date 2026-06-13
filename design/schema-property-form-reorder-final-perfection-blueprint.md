# Schema Property Form Reorder Final Perfection Blueprint

## Objective

Close the remaining gap between the current property-form reorder implementation
and the literal platonic ideal:

- simplicity
- speed
- everything needed
- nothing more
- perfect modularization
- high-entropy code
- perfectly consistent variable names
- Flaubertian precision

This is not a feature expansion. Drag reorder and keyboard reorder already work.
This blueprint is a final compression pass: remove remaining ambiguity, isolate
responsibilities exactly, and leave the smallest inevitable API.

## Current State

The current implementation is strong:

- Object-property rows are draggable on the property-form docs page.
- The visible row and grip use the same `grab` affordance.
- Drop placement is midpoint-based.
- Reorder math is centralized through `moveOrderedItem`.
- `ObjectPropertyRowModel` exposes `row.reorder`.
- Pointer drag and keyboard controls call the same row reorder path.
- Keyboard controls expose move up/down buttons with boundary disabled states.
- Reorder announcements use a polite live region.
- Focus restoration after keyboard reorder is covered by E2E.
- Unit, component, architecture, typecheck, lint, Playwright, and browser checks
  cover the main behavior.

That is good. It is not yet perfect.

## Remaining Non-Ideal Tension

### 1. Row Actions Own Too Many Concepts

`SchemaRowActions` now owns:

- details
- delete
- reorder up
- reorder down

This is compact, but it is not maximally precise. Reorder is a coherent action
cluster with its own boundary state, labels, and focus behavior. Delete and
details are different concepts.

The current module is still readable. The ideal module boundary is sharper.

### 2. Focus Restoration Uses Label-Based DOM Lookup

`ObjectPropertiesField` restores focus by storing an aria-label string, then
querying for a matching button after render.

That works, but it is not inevitable:

- labels are user-facing copy, not identity
- focus behavior lives in the view instead of a reorder-specific helper
- the DOM query is small but imprecise

The ideal has stable action identity and a named focus policy.

### 3. ObjectPropertiesField Still Orchestrates Too Much

`ObjectPropertiesField` currently coordinates:

- model creation
- drag props
- row rendering
- action wiring
- keyboard reorder announcements
- focus restoration
- nested details rendering
- add-row rendering

The component is not bloated, but it is not perfectly compressed. The ideal
separates row rendering from list-level coordination without adding decorative
abstractions.

### 4. Native HTML Drag Is The Weakest Mechanical Layer

Native HTML drag keeps the implementation small. It also creates hard edges:

- jsdom cannot fully represent drop geometry or data transfer behavior
- touch behavior is undefined
- browser-native drag APIs are awkward to test
- drag start/drop semantics are less composable than pointer events

This does not automatically justify a drag library. It does require an explicit
decision: native drag is accepted as the desktop pointer mechanism, or it is
replaced by a smaller pointer-based reorder controller.

### 5. Component Tests Cannot Prove Drop Reorder

The current component test verifies drag affordance and indicator wiring. The
actual drop reorder is proven by:

- primitive unit tests
- model tests
- Playwright browser tests

That is a legitimate testing pyramid. It is not perfect. A perfect component
boundary would allow the adapter to be tested without relying on browser-native
drag quirks.

### 6. Whole-Row Drag Contract Is Chosen But Not Named

The implementation chose whole-row dragging:

- the row shell is draggable
- the row shell uses `cursor-grab`
- the grip is a visual hint, not the sole activator

This is now consistent in behavior. It should be explicit in names and tests so
future work does not drift back toward grip-only assumptions.

## Non-Negotiable Invariants

- No legacy adapters.
- No compatibility aliases.
- No duplicate reorder paths.
- No schema/domain imports inside primitives.
- No row action string used as internal identity.
- No renderer-owned schema mutation.
- No drag helper that knows property names, schema nodes, or document nodes.
- No new abstraction unless it removes a real branch, responsibility overlap,
  or naming mismatch.
- No touch/pointer rewrite unless it reduces net complexity or becomes a
  product requirement.
- No accessibility regression for keyboard or screen-reader users.
- No full-row drag ambiguity: the row is the activator and the grip is a visual
  hint, unless the implementation intentionally switches to grip-only.

## Target Shape

### 1. Extract A Row Reorder Actions Primitive

Create a small primitive for reorder buttons.

Candidate module:

```txt
components/schema-editor/primitives/schema-row-reorder-actions.tsx
```

Candidate API:

```ts
interface SchemaRowReorderActionsProps {
  canMoveDown: boolean
  canMoveUp: boolean
  moveDownLabel: string
  moveUpLabel: string
  onMoveDown: () => void
  onMoveUp: () => void
}
```

Then `SchemaRowActions` either composes it or stops owning reorder entirely.

Preferred final shape:

```tsx
<SchemaRowReorderActions ... />
<SchemaRowActions ... />
```

Rules:

- `SchemaRowReorderActions` owns only move up/down buttons.
- `SchemaRowActions` owns delete/details only.
- Both remain primitive-level, model-agnostic components.
- Button size, variant, icon choices, and disabled states are defined once.
- No row/property/domain vocabulary enters the primitive.

Exit criteria:

- `SchemaRowActions` has no reorder prop.
- Reorder buttons live in one named primitive.
- Architecture tests prove primitives import no property-form or document code.

### 2. Replace Label-Based Focus With Stable Reorder Action Identity

Introduce a stable internal focus target that is not user-facing copy.

Candidate type:

```ts
type ObjectPropertyReorderDirection = "up" | "down"

interface ObjectPropertyReorderFocusTarget {
  rowId: string
  direction: ObjectPropertyReorderDirection
}
```

Candidate view contract:

```ts
data-schema-row-reorder-row-id={row.id}
data-schema-row-reorder-direction="up"
```

Rules:

- User-facing labels remain for accessibility.
- Internal focus restoration uses row id plus direction.
- Focus restoration lives in a named helper or hook.
- The helper is local to object-property rows unless another real consumer
  exists.

Candidate helper:

```txt
components/schema-editor/property-form/fields/object-properties-reorder-focus.ts
```

Exit criteria:

- No focus restoration query depends on aria-label text.
- Tests still verify focus remains usable after keyboard move.
- Labels can change without breaking focus behavior.

### 3. Split Row Rendering From List Coordination

Extract an object-property row component only if it removes real orchestration
from `ObjectPropertiesField`.

Candidate module:

```txt
components/schema-editor/property-form/fields/object-property-row.tsx
```

Candidate API:

```ts
interface ObjectPropertyRowProps {
  editable: boolean
  row: ObjectPropertyRowModel
  dragProps: React.HTMLAttributes<HTMLDivElement>
  reorderFocus: ObjectPropertyReorderFocusController
  renderPropertyDetails: (details: PropertySchemaDetailsModel) => React.ReactNode
}
```

Rules:

- The list component owns list-level state:
  - model
  - drag adapter
  - live announcement
  - focus controller
  - add row
- The row component owns row JSX:
  - shell
  - inline name
  - inline description
  - type selector
  - row actions
  - nested details
- Do not extract if the new component merely passes through twenty props.
- Prefer passing `row` as one model over destructuring the same concept across
  multiple props.

Exit criteria:

- `ObjectPropertiesField` reads as list coordination.
- `ObjectPropertyRow` reads as row rendering.
- No domain mutation moves into JSX.
- Existing tests remain behaviorally unchanged.

### 4. Name The Whole-Row Drag Contract

Make the chosen contract explicit in code and tests.

Candidate naming:

```ts
useObjectPropertiesRowDrag
getRowDragProps
```

Avoid names that imply a grip-only contract:

- `getGripDragProps`
- `handleDrag`
- `dragHandle`

Rules:

- The row shell is the only drag activator.
- `SchemaRowGrip` remains presentational.
- E2E asserts row `draggable="true"` and row cursor `grab`.
- Grip cursor can remain `grab` as a visual hint, but tests should not imply it
  is the only activator.

Exit criteria:

- No implementation or test names imply grip-only activation.
- The docs page behavior matches the code vocabulary.
- The blueprint decision is encoded in architecture/E2E tests.

### 5. Decide Whether Native Drag Is Final

Make an explicit product/engineering decision.

Option A: Keep native HTML drag.

Use this if:

- desktop pointer support is sufficient
- keyboard reorder is the accessibility and touch fallback
- Playwright E2E is accepted as the source of truth for real drag behavior

Required cleanup:

- Keep jsdom component tests focused on affordance/adapter wiring.
- Keep primitive tests focused on pure placement and target-index math.
- Document that native drag is not expected to be unit-testable end to end.

Option B: Replace native drag with pointer reorder.

Use this only if:

- touch drag is required
- native drag causes real browser inconsistencies
- the resulting controller is smaller or clearer than the current native helper

Candidate module:

```txt
components/schema-editor/primitives/schema-row-pointer-reorder.ts
```

Rules for Option B:

- Pointer controller owns pointer capture, active row, target row, placement,
  and cancel/commit.
- It remains model-agnostic.
- It does not duplicate keyboard reorder.
- It must not introduce animation or decorative drag polish before correctness.

Exit criteria:

- The decision is documented in this blueprint or a follow-up architecture note.
- Tests align with the chosen mechanical layer.
- No half-native, half-pointer implementation exists.

### 6. Tighten Tests Around Final Contracts

Tests should protect the exact final shape without overspecifying incidental
implementation.

Add or adjust architecture tests:

- `SchemaRowActions` does not own reorder props if reorder actions are extracted.
- Reorder focus does not query by aria-label.
- Object-property row rendering is separate from list coordination if extracted.
- Drag contract names use `row`, not `grip`, for activator props.

Add or adjust component tests:

- keyboard reorder preserves pending add-row input
- keyboard reorder preserves required semantics
- focus restoration uses the moved row's action after rerender
- drag affordance applies to row shell

Keep E2E tests:

- row is draggable
- row cursor is `grab`
- grip is visible
- pointer drag reorders in the browser
- keyboard reorder works and announces position
- saved order survives rerender

Do not force jsdom to prove native drop reorder. That is false precision.

## Migration Sequence

### Step 1. Extract Reorder Actions

Move move-up/move-down buttons into `SchemaRowReorderActions`.

Exit criteria:

- `SchemaRowActions` no longer accepts `reorder`.
- Visual output is unchanged.
- Component and E2E tests still pass.

### Step 2. Replace Focus String Lookup

Introduce stable reorder focus target identity.

Exit criteria:

- No focus query uses aria-label.
- Labels remain unchanged.
- Focus E2E still passes.

### Step 3. Compress ObjectPropertiesField

Extract `ObjectPropertyRow` only if the result is smaller and clearer.

Exit criteria:

- List orchestration and row rendering have separate files.
- The prop surface is smaller than the removed inline JSX complexity.
- No new generic abstraction is introduced.

### Step 4. Lock The Whole-Row Drag Vocabulary

Rename any ambiguous test/helper wording.

Exit criteria:

- Names consistently say row drag.
- Tests assert the row as the activator.
- Grip remains presentational.

### Step 5. Decide Native Versus Pointer Drag

Make the mechanical decision explicit.

Exit criteria:

- If native stays, tests are organized around native limitations.
- If pointer replaces native, native DnD helper is deleted in one cutover.
- No compatibility shim remains.

## Completion Criteria

The reorder system reaches the platonic ideal when all are true:

- Reorder actions are a named primitive with one responsibility.
- `SchemaRowActions` no longer mixes delete/details/reorder semantics.
- Focus restoration uses stable row/action identity, not user-facing text.
- `ObjectPropertiesField` coordinates the list and does not read like a row
  renderer.
- Row rendering, list coordination, drag mechanics, reorder domain actions, and
  accessibility feedback each have one precise owner.
- The whole-row drag contract is encoded in names, code, and tests.
- Native drag is either explicitly accepted or replaced by one pointer reorder
  controller.
- Pointer, keyboard, and screen-reader paths remain complete.
- No duplicate reorder math, no compatibility paths, no speculative options, no
  vague names remain.

## Deliberate Non-Goals

- Do not redesign the entire property form.
- Do not add drag animation polish.
- Do not add touch drag unless the product decision chooses pointer reorder.
- Do not introduce a DnD library as a default move.
- Do not split files just to make files smaller.
- Do not remove Playwright coverage for real browser drag.
