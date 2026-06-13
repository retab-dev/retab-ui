# Schema Property Form Platonic Ideal Blueprint

## Objective

Bring the property form and shared schema-editor primitives to the highest standard:
simple, fast, complete, modular, densely meaningful, consistently named, and free of accidental complexity.

This is not a styling pass. It is a state-boundary, API, naming, and interaction pass.

## Current State

The system is good but not perfect.

Strengths:

- `PropertyForm` already has a controller/view-model/shell split.
- Shared schema primitives exist and are reused across the document schema builder and the property form.
- `SchemaTypeMenu` is optional-feature agnostic; object templates are injected by adapters.
- Focused tests cover important nested object, enum, type, validation, and description workflows.

Remaining gaps:

- The same mutability concept is named several ways: `mode`, `editMode`, `disabled`, `editable`, `isEditable`, and capability booleans.
- `ObjectPropertiesField` owns too much: row identity, reset preservation, nested context construction, add-row state, field operations, and rendering.
- Inline field primitives are not symmetric: descriptions are native inputs from the start, names still swap display text to input.
- `TypeField` is a dense adapter: it builds sections, mutates types, preserves metadata, dispatches commands, handles definitions, and injects object templates.
- Accessibility is good enough for tests but not ideal for repeated inline controls.
- Browser interaction verification is not yet a dependable part of the workflow.

## Non-Negotiable Invariants

- No optional-feature imports from `components/schema-editor/primitives`.
- No legacy adapters, compatibility shims, re-export indirection, or duplicate old/new APIs.
- One concept gets one name everywhere.
- Primitives accept UI-shaped inputs and callbacks only. They do not know schema models, document nodes, property drafts, capabilities, definitions, or object templates.
- Property-form adapters translate schema/domain state into primitive props.
- Tests enforce architecture boundaries, not only behavior.
- The final page must be browser-verified for the core interaction path.

## Target Shape

### 1. Canonical Mutability Language

Pick one language and apply it everywhere:

- Domain-level: `mode: "editable" | "descriptionOnly" | "readOnly"`.
- Capability-level: `canEditName`, `canEditType`, `canEditDescription`, etc.
- UI primitive-level: `editable: boolean`.
- Native control-level: `disabled: boolean`.

Rules:

- Components that render native controls may receive `disabled`.
- Schema primitives receive `editable`, not `disabled`.
- Property-form fields receive `disabled` only when they directly wrap a native form control.
- Adapters may derive `editable` from `mode` or capabilities, but primitives do not receive `mode`.
- Remove stale names like `isEditable` in adapter props when `editable` is sufficient.

Expected outcome:

- Reading any prop tells you which layer you are in.
- No component accepts both `editable` and `disabled` unless it explicitly bridges primitive and native control layers.

### 2. Inline Field Primitive Unification

Create one coherent inline editing story for row fields.

Target primitives:

- `SchemaInlineText`
- `SchemaInlineDescription`
- `SchemaInlineName`

Preferred shape:

- `SchemaInlineText` owns the native input behavior:
  - value mirroring while unfocused
  - commit on blur
  - Enter commit
  - Escape revert
  - native click caret placement
  - disabled/read-only rendering
  - accessible label
- `SchemaInlineName` composes `SchemaInlineText` and adds:
  - validation
  - reference reveal affordance
  - name-specific typography
- `SchemaInlineDescription` composes `SchemaInlineText` and adds:
  - muted typography
  - placeholder
  - optional details/open behavior in read-only mode

Hard cutover:

- Do not keep both old `SchemaFieldName`/`SchemaFieldDescription` behavior and new inline primitives.
- Rename call sites in one pass.
- Update architecture tests to assert old files or old APIs do not remain.

Why:

- Name and description currently solve similar inline-editing problems differently.
- Native inputs before click are the correct caret model for text fields.
- Commit/revert behavior should be one implementation, not repeated.

### 3. Object Properties Field Decomposition

Split `ObjectPropertiesField` into model and view.

Target modules:

- `object-properties-model.ts`
  - property name listing
  - stable row IDs
  - reset key construction
  - pending add-name state rules
  - operation wrappers for add, rename, remove, replace
- `object-properties-field.tsx`
  - renders rows only
  - maps model rows to primitives
  - owns no mutation mechanics beyond event wiring

Expected row model:

```ts
interface ObjectPropertyRowModel {
  id: string
  name: string
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  validation: {
    name: (value: string) => string | null
  }
  actions: {
    rename: (name: string) => void
    remove: () => void
    replaceSchemaNode: (schemaNode: ExtendedJSONSchema7) => void
  }
}
```

Do not expose implementation details like `draftPropertyIdsByName` to the rendering component.

Why:

- The current field is correct but too dense.
- State preservation is domain logic, not JSX logic.

### 4. Type Field Adapter Compression

Keep `SchemaTypeMenu` primitive agnostic, but make `TypeField` smaller.

Extract:

- `schema-type-menu-model.ts`
  - computes current `SchemaTypeMenuValue`
  - builds primitive type items
  - builds definition submenu items
  - applies metadata preservation
  - returns command handlers
- `object-template-type-section.tsx`
  - owns the lazy object-template submenu injection

Target `TypeField` responsibility:

- call the model hook/helper
- append optional adapter sections
- render `SchemaTypeMenu`

Why:

- `TypeField` is an adapter, but it is doing too many adapter jobs.
- The type menu model is reusable between document rows and property-form rows.

### 5. Property Form View Model Tightening

Refine `PropertyFormViewModel` so it is less nested and more explicit.

Questions to resolve:

- Should `fields.schemaNodeDetails` be split into `enumValues`, `objectProperties`, and `arrayItems` instead of a polymorphic nested payload?
- Should validation normalization live beside capability resolution rather than inside the controller?
- Should submit state be its own small hook?

Likely target:

- `usePropertyFormState`
- `usePropertyFormValidation`
- `usePropertyFormSubmit`
- `buildPropertyFormViewModel`

Constraint:

- Do not create abstractions just to split files.
- Extract only if each module has one coherent responsibility and removes real complexity from the controller.

### 6. Accessibility Pass

Every repeated row control needs a stable accessible name.

Check:

- inline name input
- inline description input
- enum chip input
- enum remove button
- object field add input
- type trigger
- row action buttons
- nullable switch

Expected:

- No repeated anonymous textboxes in schema rows.
- Inputs include row/property context in their accessible label where practical.
- Icon buttons have precise labels.
- Disabled/read-only states stay inspectable when needed.

### 7. Visual Interaction Verification

The final verification must include real browser checks for:

- property-form object editor row rendering
- schema-builder row rendering
- enum chip badge shape
- description click caret placement
- type menu open/select
- nested object add/rename/remove

Use `data-slot` selectors where possible:

- `schema-field-row`
- `schema-chip-list`
- `schema-chip-input`
- `schema-add-row`

If the in-app browser transport is unavailable, use a documented fallback and record what could not be verified.

## Implementation Phases

### Phase 1: Naming Audit

- Inventory all schema/property-form props named `mode`, `editMode`, `editable`, `isEditable`, and `disabled`.
- Decide the canonical layer-specific names.
- Update props and call sites in one hard cutover.
- Add architecture tests for forbidden names in primitives and adapters where appropriate.

Exit criteria:

- Primitives use `editable`.
- Native form fields use `disabled`.
- Domain components use `mode`.
- No component uses both names without being an explicit bridge.

### Phase 2: Inline Field Primitive

- Introduce the single inline text primitive.
- Rebuild name and description on top of it.
- Preserve current UX:
  - description caret lands where clicked
  - name validation remains inline
  - Escape reverts
  - Enter commits
  - blur commits
- Delete old divergent implementations.

Exit criteria:

- One implementation owns inline text commit/revert behavior.
- Tests cover description caret architecture and name validation.

### Phase 3: Object Properties Model

- Extract object row identity and reset logic from JSX.
- Return row models and add-row model from a model helper/hook.
- Keep visual output unchanged.
- Add unit tests for row ID preservation and reset behavior without rendering the whole form.

Exit criteria:

- `object-properties-field.tsx` is primarily render code.
- Reset/preservation behavior has direct tests.

### Phase 4: Type Field Model

- Extract type menu model construction.
- Keep object-template submenu injected from adapter code.
- Share the pure model between document and property-form type adapters where it actually reduces duplication.

Exit criteria:

- `SchemaTypeMenu` remains primitive-only.
- `TypeField` is short and obvious.
- Architecture tests enforce no optional imports in primitives.

### Phase 5: View Model Compression

- Review `PropertyFormViewModel` shape after the earlier extractions.
- Split validation/capability/submit logic only if it materially simplifies the controller.
- Avoid speculative hooks.

Exit criteria:

- Controller reads as a composition of domain decisions, not a bag of incidental state.

### Phase 6: Verification

Run:

- `pnpm vitest run tests/property-form.test.tsx tests/schema-editor-render.test.tsx tests/schema-builder-architecture.test.ts`
- targeted ESLint for touched schema/property files
- `pnpm typecheck` if unrelated dirty-tree errors are cleared
- browser verification of the core property-form and schema-builder interactions

## Perfection Checklist

- Simplicity: each module has one obvious reason to exist.
- Speed: no extra renders from unstable row keys, no expensive schema derivations in hot render paths without memoization.
- Everything needed: edit, read-only, description-only, nested object, array, enum, nullable, definitions, templates, validation, reset, and submit states are covered.
- Nothing more: no unused props, duplicate APIs, legacy files, or compatibility paths.
- Perfect modularization: primitives, adapters, models, and shells do not leak responsibilities into each other.
- High entropy code: no filler wrappers, no low-value state duplication, no stringly reset mechanics in JSX.
- Consistent names: one concept, one name, layer by layer.
- Flaubertian precision: prop names, state names, labels, tests, and file boundaries are exact.

