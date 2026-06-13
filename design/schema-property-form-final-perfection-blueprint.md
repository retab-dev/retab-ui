# Schema Property Form Final Perfection Blueprint

## Objective

Close the remaining gap between the completed schema property-form blueprint and
the literal platonic ideal:

- simplicity
- speed
- everything needed
- nothing more
- perfect modularization
- high-entropy code
- perfectly consistent variable names
- Flaubertian precision

This is not a feature pass. It is a final compression and exactness pass.

## Current State

The previous blueprint is complete.

Strengths now:

- Inline row editing is unified through `SchemaInlineText`,
  `SchemaInlineName`, and `SchemaInlineDescription`.
- Object field mechanics are separated from JSX in
  `object-properties-model.ts`.
- Type menu sections are shared, while object-template injection is outside
  primitives.
- Schema-editor mutability naming is canonical:
  - domain: `mode`
  - primitive: `editable`
  - native control: `disabled`
  - capability: `canEdit*`
- Architecture tests protect the main boundaries.
- Focused behavior tests and browser checks cover the core interaction paths.

Remaining non-ideal tension:

- `PropertyFormViewModel.fields.schemaNodeDetails` is still a polymorphic
  payload. It is practical, but not inevitable.
- `SchemaTypeMenuSection` still has a broad `custom` render escape hatch.
  It is clean, but more permissive than the current use case needs.
- Type menu naming is split across `schema-type-menu-model.tsx` and
  `property-form/fields/schema-type-menu-model.tsx`. The boundary is defensible,
  but the names are not maximally exact.
- Some schema-editor-adjacent integration surfaces, especially JSON table
  property-edit integration, still carry older naming patterns outside
  `components/schema-editor`.
- Browser verification exists as ad hoc execution evidence, not as a durable
  local verifier.
- Some architecture tests assert absence of strings but do not yet encode the
  positive shape as tightly as they could.

## Non-Negotiable Invariants

- No compatibility aliases or legacy prop names.
- No duplicate old/new APIs.
- No optional feature imports from primitives.
- No schema/domain knowledge inside primitives.
- No broad render escape hatch where a typed slot would express the exact need.
- No component accepts both `editable` and `disabled` unless it is an explicit
  adapter between primitive and native-control layers.
- No test-only selectors or implementation artifacts that leak into public API
  without becoming intentional component contracts.
- Every extracted module must have one obvious reason to exist.

## Target Shape

### 1. View Model Becomes Explicit

Replace the polymorphic `fields.schemaNodeDetails` payload with explicit detail
fields.

Target shape:

```ts
interface PropertyFormViewModel {
  fields: {
    name: PropertyNameFieldModel
    type: PropertyTypeFieldModel
    nullable: PropertyNullableFieldModel
    description: PropertyDescriptionFieldModel
    enumValues?: PropertyEnumValuesFieldModel
    objectProperties?: PropertyObjectPropertiesFieldModel
    arrayItems?: PropertyArrayItemsFieldModel
  }
}
```

Rules:

- Each detail model should carry only the props its renderer needs.
- `PropertyFormShell` should not inspect schema type to decide which renderer
  to use.
- `SchemaNodeField` should either disappear or become a tiny delegator with no
  domain decisions.
- Avoid creating one-file abstractions unless they remove real conditional
  complexity.

Exit criteria:

- No `schemaNodeDetails` name remains.
- Enum, object, and array detail rendering are explicit.
- Tests cover edit/read-only/description-only behavior for each detail kind.

### 2. Type Menu API Becomes Narrower

Replace `SchemaTypeMenuSection.kind === "custom"` with a typed optional slot.

Current tension:

- `custom` permits any render function.
- The only intended extension is an injected object-template submenu.

Target shape:

```ts
type SchemaTypeMenuSection =
  | { kind: "items"; ... }
  | { kind: "submenu"; ... }

interface SchemaTypeMenuProps {
  accessory?: (context: { editable: boolean }) => React.ReactNode
}
```

or, if stricter:

```ts
interface SchemaTypeMenuProps {
  objectTemplateSection?: SchemaTypeMenuInjectedSection
}
```

Decision rule:

- Prefer `accessory` if the primitive truly supports one generic trailing
  injection point.
- Prefer `objectTemplateSection` if object templates are the only real extension
  and the adapter should own the feature semantics.

Exit criteria:

- No `kind: "custom"` remains.
- `SchemaTypeMenu` remains optional-feature agnostic.
- Object-template lazy import still lives only in
  `object-template-type-section.tsx`.
- Architecture tests enforce the exact import boundary.

### 3. Type Menu Model Names Become Exact

Rename modules and exports so their responsibilities are obvious.

Candidate names:

- `schema-type-menu-model.tsx` -> `schema-type-menu-sections.tsx`
- `property-form/fields/schema-type-menu-model.tsx` ->
  `property-type-menu-model.ts`
- `createPropertyTypeMenuModel` -> `createPropertyTypeMenu`
- `createSchemaTypeMenuItems` -> `createPrimitiveTypeItems`
- `createDefinitionTypeSection` -> `createDefinitionTypeSubmenu`
- `createSchemaTypeMenuValue` -> `createTypeMenuValue`

Rules:

- Use one word for the same concept everywhere.
- Do not use `schema` in a name when the thing is purely UI-shaped.
- Do not use `model` if the module only builds menu sections.
- Do not use `field` when the thing is a row or menu adapter.

Exit criteria:

- File names and export names encode responsibility without surrounding context.
- Architecture tests refer to final names, not transitional names.
- No re-export compatibility path exists.

### 4. Integration Naming Sweep

Extend the canonical naming language across schema-editor integration points
that pass into property form or schema builder.

Scope:

- JSON table property editor entry points.
- Schema dialog entry points.
- Any wrapper whose primary job is to adapt a schema-editor mode.

Rules:

- Use `mode` for schema/property editing mode.
- Do not expose `editMode` from any schema-editor-adjacent public prop.
- Leave unrelated JSON-table cell internals alone unless they directly adapt
  schema/property editing.

Exit criteria:

- `rg "\beditMode\b" components/schema-editor components/json-table` returns no
  schema/property-edit integration hits.
- Architecture tests distinguish allowed unrelated JSON-table cell terminology
  from forbidden schema/property editing terminology.

### 5. Durable Browser Verifier

Move the ad hoc browser verification into a repeatable local script or e2e test.

Minimum coverage:

- property-form object editor row rendering
- schema-builder row rendering
- enum chip badge shape
- description click caret placement
- type menu open/select
- nested object add/rename/remove

Preferred target:

- `e2e/schema-property-form.spec.ts`

Rules:

- Use stable labels and `data-slot` contracts.
- Do not depend on broad body text.
- Assert caret placement with increasing click offsets and increasing
  `selectionStart`.
- Assert the enum chip shell has `bg-muted`, `px-1`, and `shadow-none`.
- Keep the test independent from unrelated docs pages where possible.

Exit criteria:

- The browser verifier runs with the local dev server.
- Failures point at one behavior, not a vague screenshot mismatch.
- Verification instructions are documented in the blueprint or test comments.

### 6. Architecture Tests Encode Positive Shape

Upgrade string-absence tests into shape tests where useful.

Targets:

- primitives import no adapter/domain paths
- old inline primitive files are absent
- `SchemaTypeMenu` has no lazy imports and no optional feature words
- object-property view uses `useObjectPropertiesModel`
- property form controller delegates validation and submit lifecycle
- property form view model exposes explicit detail models
- type menu has no generic custom render section

Rules:

- Keep architecture tests cheap and deterministic.
- Prefer AST-ish file structure checks only where string checks become too weak.
- Do not overfit tests to formatting or import order.

Exit criteria:

- The tests fail when a boundary regresses.
- The tests do not fail on harmless formatting changes.

## Implementation Order

1. Rename type-menu modules and exports while preserving behavior.
2. Replace `SchemaTypeMenuSection.custom` with the narrow injected slot.
3. Split `schemaNodeDetails` into explicit enum/object/array detail models.
4. Sweep schema/property integration naming outside `components/schema-editor`.
5. Add durable browser verifier.
6. Tighten architecture tests after the final shapes exist.
7. Run full focused verification.

## Verification

Required commands:

```bash
pnpm vitest run tests/schema-builder-architecture.test.ts tests/schema-editor-context.test.tsx tests/property-form.test.tsx tests/schema-editor-render.test.tsx
pnpm typecheck
pnpm eslint <touched schema/property/json-table integration files>
pnpm test:e2e -- e2e/schema-property-form.spec.ts
```

If `test:e2e` is too broad or the local server contract requires a different
command, record the exact command used in the final implementation note.

## Perfection Checklist

- Simplicity: every component has one job and one vocabulary.
- Speed: no avoidable state churn, no unstable row keys, no repeated schema
  derivation in hot render paths.
- Everything needed: edit, read-only, description-only, nested object, array,
  enum, nullable, definitions, templates, validation, reset, submit, and browser
  behavior are covered.
- Nothing more: no generic render escape hatches, no duplicate names, no
  transitional files, no unused props.
- Perfect modularization: primitives, section builders, domain adapters,
  property models, and shells do not leak responsibilities.
- High entropy code: no filler wrappers, no repeated low-value mapping code, no
  stringly conditional payloads where typed fields are clearer.
- Perfect names: the same concept has the same name at every boundary.
- Flaubertian precision: each prop, file, model, and test says exactly what it
  means and nothing else.
