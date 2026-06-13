# Schema Property Form Terminal Platonic Blueprint

## Objective

Move the schema builder object rows and property-form object builder from
"excellent and consistent" to the closest practical version of the platonic
ideal:

- simple
- fast
- complete
- minimal
- perfectly modular
- high entropy
- consistently named
- exact enough that the boundaries feel inevitable

This is not a feature pass. It is a final responsibility-compression pass. The
goal is to remove the last avoidable surface area, not add another abstraction
layer.

## Current State

The component is now good:

- The property-form object builder visually and behaviorally matches the schema
  builder row system.
- Object rows use shared row primitives, row grips, enum chips, row actions, and
  reorder helpers.
- `ObjectPropertiesField` receives one coherent `details` object instead of a
  loose bag of low-level inputs.
- Recursive object-row details are behind `createObjectPropertyRowDetails`.
- Detail-layer access is `PropertySchemaDetailAccess`, not a duplicate
  `canEdit*` capability surface.
- Type editability is owned by the object-properties model.
- Tests cover architecture, property-form behavior, reorder helpers, and the
  user-facing property-form route.

Remaining non-ideal density:

- `ObjectPropertiesField` still owns too many responsibilities:
  - builds the object-properties model
  - wires drag behavior
  - renders object rows
  - restores reorder focus
  - announces reorder movement
  - adapts row details into recursive rendering
- `ObjectPropertyRowModel` is useful but not minimal. It mixes durable row data,
  editable field models, reorder command state, schema context, and raw schema
  node access.
- `SchemaRowActions` is doing delete, details, and reorder rendering directly.
  It is still compact, but its prop shape has become a small command grammar.
- `schema-row-drag.ts` still mutates DOM classes directly. This may be
  acceptable for native drag, but it is the least elegant part of the row system.
- Naming is close, not perfect. `details`, `propertyDetails`, `rowDetails`,
  `schemaDetails`, and `objectProperties` are all understandable, but not yet
  obviously final.
- Architecture tests are useful but still rely on string assertions for several
  module boundaries.

## Non-Negotiable Invariants

- Do not reintroduce legacy adapters, compatibility aliases, or dual APIs.
- Do not split schema builder and property-form row behavior again.
- Do not move schema semantics into primitives.
- Do not make primitives import property-form, document-editor, schema-provider,
  object-template, or JSON-table code.
- Do not add render-prop escape hatches beyond the recursive detail renderer
  that is already necessary.
- Do not add abstractions that merely rename existing parameters.
- Do not remove accessibility behavior: grips, keyboard reorder controls, live
  announcements, focus restoration, labels, and disabled states must stay.
- Do not weaken tests to make refactoring easier.

## Target Shape

### 1. Extract A Shared Object Row Interaction Shell

`ObjectPropertiesField` should stop owning row-level interaction machinery.

Introduce a narrow primitive or property-form-local component that owns:

- root row ref needed for focus restoration
- reorder live-region announcement
- drag props
- row wrapper attributes
- keyboard reorder focus restoration

Candidate name:

```ts
ObjectPropertyRows
```

or, if useful outside property form:

```ts
SchemaReorderableRows
```

Decision rule:

- Use `ObjectPropertyRows` if it still knows about object property names,
  property-form row IDs, or nested detail placement.
- Use `SchemaReorderableRows` only if the API is schema/domain agnostic and can
  be consumed by document rows without translation.

Preferred first target:

```tsx
function ObjectPropertyRows({
  editable,
  rows,
  renderRow,
}: {
  editable: boolean
  rows: ObjectPropertyRowModel[]
  renderRow: (row: ObjectPropertyRowModel) => React.ReactNode
})
```

This makes `ObjectPropertiesField` read as:

```tsx
const model = useObjectPropertiesModel(details)

return (
  <ObjectPropertyRows
    editable={model.editable}
    rows={model.rows}
    renderRow={(row) => (
      <>
        <SchemaFieldRow ... />
        {renderPropertyDetails(row.details)}
      </>
    )}
  />
)
```

But do not implement this shape blindly. If the render callback causes the same
opacity as the current component, prefer a dedicated `ObjectPropertyRow`.

Exit criteria:

- `ObjectPropertiesField` has no `useLayoutEffect`.
- `ObjectPropertiesField` has no drag hook import.
- `ObjectPropertiesField` has no live-region state.
- The component reads as model creation plus object-row rendering only.

### 2. Compress The Object Properties Model Output

The current model returns:

```ts
{
  addRow,
  rows,
}
```

The view still reaches into `details.editable` separately. The model should own
the final interaction state it expects the view to use.

Target:

```ts
interface ObjectPropertiesModel {
  addRow: ObjectPropertyAddRowModel
  editable: boolean
  rows: ObjectPropertyRowModel[]
}
```

Then every row-level consumer reads from the model, not from the original
details object.

Exit criteria:

- `ObjectPropertiesField` passes `model.editable` to row shell and add-row UI.
- The hook input stays domain-oriented.
- The hook output is the single source of view-ready object-properties state.

### 3. Split Row Data From Row Commands If It Reduces Noise

`ObjectPropertyRowModel` currently contains:

- identity: `id`, `name`
- schema: `schemaNode`, `schemaContext`, `details`
- validation: `validation.name`
- editable type model: `type`
- commands: `actions`
- reorder: `reorder`

This is coherent, but dense.

Consider this target only if it makes call sites clearer:

```ts
interface ObjectPropertyRowModel {
  id: string
  name: string
  description: string
  details: PropertySchemaDetailsModel
  fieldPath?: string
  nameField: ObjectPropertyNameFieldModel
  typeField: PropertyTypeFieldModel
  actions: ObjectPropertyRowActionsModel
}
```

Potential gains:

- `ObjectPropertiesField` stops knowing that description lives on
  `row.schemaNode.description`.
- `TypeField` receives `row.typeField` or a destructured equivalent.
- Naming aligns with UI concepts: name field, description field, type field,
  actions.

Decision rule:

- Do this only if it removes raw schema-node reads from the renderer.
- Keep the current row model if the new names simply wrap the same amount of
  information.

Exit criteria if adopted:

- `ObjectPropertiesField` does not read `row.schemaNode.description`.
- Raw schema node mutation remains in the model, not JSX.
- Row field naming is parallel: `nameField`, `descriptionField`, `typeField`.

### 4. Make Reorder Naming Inevitable

Current names:

- `reorder`
- `move`
- `moveUp`
- `moveDown`
- `position`
- `rowCount`

This is readable. The remaining question is whether `reorder` should be named
for the command group or the UI affordance.

Candidate final shape:

```ts
interface ObjectPropertyRowOrderModel {
  canMoveDown: boolean
  canMoveUp: boolean
  moveTo: (index: number) => void
  moveDown: () => void
  moveUp: () => void
  position: number
  total: number
}
```

Why:

- `moveTo` is more precise than `move`.
- `total` is shorter and pairs with `position`.
- `order` is a simpler noun than `reorder` once the object is a stable row
  field.

Decision rule:

- Rename only if every call site becomes clearer.
- Avoid renaming churn if `reorder` remains the more obvious UI concept.

Exit criteria:

- One noun is used everywhere for the same concept.
- Architecture tests enforce the chosen row-order field name.

### 5. Decide Whether `SchemaRowActions` Should Delegate Reorder Buttons

`SchemaRowActions` currently renders delete, details, and reorder buttons.

Potential split:

```tsx
<SchemaRowOrderActions order={row.order} />
<SchemaRowActions delete=... details=... />
```

This would reduce prop grammar in `SchemaRowActions`, but risks creating more
components than the UI needs.

Decision rule:

- Split only if `SchemaRowActions` becomes easier to scan at both call sites.
- Do not split merely because the component has three branches.

Exit criteria if split:

- Reorder button labels and disabled states live in one small component.
- `SchemaRowActions` no longer imports arrow icons.
- Call sites do not become visually noisier.

### 6. Keep Or Replace Imperative Drag Class Mutation Deliberately

`schema-row-drag.ts` mutates DOM classes for drop indicators. Native drag makes
this pragmatic, but it is not aesthetically perfect.

Possible alternatives:

1. Keep imperative classes:
   - Small.
   - Fast.
   - Works with native drag.
   - Already isolated.

2. Move indicator into React state:
   - More declarative.
   - More render churn.
   - More props through row wrappers.

3. Create a tiny row-drag controller hook:
   - Exposes `dragging`, `dropIndicatorByRowId`, and handlers.
   - Lets rows render indicator classes normally.
   - More code, but better ownership.

Decision rule:

- Keep imperative mutation unless React state removes more code than it adds.
- If kept, add one architecture comment or test that makes the isolation
  intentional.

Exit criteria:

- Drag indicator code is either fully isolated and intentionally imperative, or
  fully declarative.
- No mixed model where some drop state is React state and some is DOM mutation.

### 7. Tighten Detail Naming Once

Current detail-related names are close:

- `details`
- `propertyDetails`
- `rowDetails`
- `schemaDetails`
- `objectProperties`

Target vocabulary:

- `schemaDetails`: the full recursive type-specific detail model.
- `objectProperties`: the object-specific detail model.
- `rowDetails`: recursive schema details for one object property row.
- `details`: acceptable only as a component prop when the component type names
  the domain.

Rules:

- `PropertySchemaDetailsField` should receive `details`.
- `ObjectPropertiesField` should receive `details` only if its type is
  `PropertyObjectPropertiesFieldModel`.
- Helpers should use `rowDetails` when building nested row detail models.
- Tests should avoid introducing obsolete names except as deliberate forbidden
  string guards.

Exit criteria:

- No function has both `details` and `schemaDetails` in the same scope unless it
  is translating between them.
- No call site uses a generic name where the containing component does not make
  the domain obvious.

### 8. Improve Architecture Tests Without Overfitting

Keep tests that prevent regression:

- primitive isolation
- optional-feature agnosticism
- object field prop surface
- row recursive detail helper boundary
- row order ownership
- enum chip compact visual contract

Prefer stronger checks:

- AST prop-surface checks for component parameters.
- Import-boundary checks.
- Behavior tests for row order and focus.

Use string checks only when they guard a named architectural smell.

Exit criteria:

- New tests fail for meaningful boundary regressions.
- Tests do not fail because whitespace or JSX ordering changed.
- Forbidden-string tests concatenate obsolete names when possible so searches do
  not report false positives.

## Implementation Order

1. Read the current object-properties field, model, drag helper, row actions, and
   architecture tests.
2. Extract object-row interaction ownership only if it removes code from
   `ObjectPropertiesField` without creating an opaque render layer.
3. Add `editable` to the object-properties model output.
4. Decide whether to rename `reorder` to `order` and `move` to `moveTo`.
5. Move raw row description editing out of JSX if a `descriptionField` model
   makes the row model clearer.
6. Reassess `SchemaRowActions`; split reorder actions only if the call sites get
   cleaner.
7. Either preserve imperative drag mutation deliberately or replace it fully.
8. Tighten detail naming.
9. Update architecture tests around the final API surfaces.
10. Run the full verification matrix.

## Verification Matrix

Run:

```bash
pnpm typecheck
pnpm vitest run tests/schema-builder-architecture.test.ts tests/schema-editor-context.test.tsx tests/property-form.test.tsx tests/schema-editor-render.test.tsx tests/schema-property-reorder.test.ts
pnpm eslint components/schema-editor/primitives/schema-row-actions.tsx components/schema-editor/primitives/schema-row-drag.ts components/schema-editor/property-form/fields/object-properties-field.tsx components/schema-editor/property-form/fields/object-properties-model.ts components/schema-editor/property-form/fields/object-property-row-details.ts components/schema-editor/property-form/fields/object-properties-drag.ts components/schema-editor/property-form/fields/property-schema-details-field.tsx components/schema-editor/property-form/model/property-schema-details.ts components/schema-editor/property-form/property-form-controller.ts components/schema-editor/property-form/types.ts tests/schema-builder-architecture.test.ts tests/property-form.test.tsx tests/schema-property-reorder.test.ts e2e/schema-property-form.spec.ts
pnpm test:e2e -- e2e/schema-property-form.spec.ts
```

Audit:

```bash
rg -n "PropertySchemaDetailsCapabilities|objectProperties\\.capabilities|canEditPropertyType|renderPropertyEditor|console\\.log" components/schema-editor/property-form components/schema-editor/primitives tests/schema-builder-architecture.test.ts tests/property-form.test.tsx e2e/schema-property-form.spec.ts -S
rg -n "schemaNode\\.description|row\\.schemaNode|row\\.reorder|row\\.order|moveTo|move\\(" components/schema-editor/property-form/fields tests/schema-builder-architecture.test.ts -S
```

## Completion Standard

This pass is complete only when the remaining shape can be described in one
sentence:

> Schema-detail factories build recursive detail models; object-properties
> models own schema mutation and row state; object-row components render
> view-ready row fields through schema-editor primitives.

If the code still needs a paragraph to explain where object-row behavior lives,
the pass is not finished.
