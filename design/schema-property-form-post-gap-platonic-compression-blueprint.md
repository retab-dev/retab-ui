# Schema Property Form Post-Gap Platonic Compression Blueprint

## Objective

Compress the current schema/property-form implementation from “excellent” to the
closest practical form of the platonic ideal:

- simplicity
- speed
- everything needed
- nothing more
- perfect modularization
- high-entropy code
- perfectly consistent variable names
- Flaubertian precision

This pass is not about visible behavior. It is about making the component APIs
feel inevitable.

## Current State

The prior remaining-gap blueprint has been implemented.

What is now strong:

- `PropertySchemaDetailsField` renders view models and no longer creates nested
  detail models.
- Recursive detail creation lives in model/controller code.
- `canEditPropertyType` is gone.
- Object property details use one `PropertySchemaDetailsCapabilities` surface.
- `TypeField` and `SchemaTypeMenu` share `form` / `row` variant vocabulary.
- `SchemaTypeMenu` uses `trailingContent`, not a generic custom section.
- Object-template lazy loading remains outside primitives.
- Enum chips expose `data-slot="schema-chip"`.
- Architecture tests and Playwright tests guard the main boundaries.

Remaining non-ideal tension:

- Some field components still receive both domain/editing state and native
  control state.
- Some view models carry data that could be pre-reduced into final render props.
- `ObjectPropertiesField` is clean, but its prop surface still includes
  `mode`, `disabled`, `capabilities`, and `onChange`.
- `TypeField` still accepts `mode` and `disabled`, but internally only needs to
  know whether the menu is editable.
- `useObjectPropertiesModel` owns row mechanics and recursive schema-detail
  creation. That may be the right tradeoff, but it deserves an explicit
  boundary decision.
- Architecture tests are still mostly string-structure tests. They are cheap and
  useful, but not as precise as the ideal.
- The e2e enum chip test still asserts Tailwind class names.

## Non-Negotiable Invariants

- No legacy adapters.
- No compatibility aliases.
- No broad fallback paths.
- No duplicate old/new APIs.
- No primitive imports from schema-editor adapters, property form, document
  editor, optional features, or JSON table.
- No schema/domain knowledge inside primitives.
- No optional-feature words inside `SchemaTypeMenu`.
- No component receives both a high-level edit concept and a native `disabled`
  flag unless it is explicitly the adapter layer that bridges them.
- No renderer computes schema semantics.
- No new abstraction unless it removes a real prop, branch, duplicate concept,
  or naming translation.
- No public API names based on styling metaphors when a placement, behavior, or
  domain word is available.

## Target Shape

### 1. Collapse Field Editability Props

Audit every schema/property field component that receives `mode`, `disabled`,
`editable`, or `canEdit*`.

Target principle:

- Domain controllers/models decide what is allowed.
- Field renderers receive the final interaction state they actually need.
- Native controls receive `disabled`.
- Primitives receive `editable`.

Candidate change:

```ts
interface PropertyTypeFieldModel {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  editable: boolean
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}
```

Then:

```tsx
<TypeField editable={type.editable} ... />
```

instead of:

```tsx
<TypeField mode={type.mode} disabled={type.disabled} ... />
```

Rules:

- Do not pass `mode` into a renderer unless the renderer changes behavior based
  on which mode it is.
- Do not pass `disabled` into a renderer unless the renderer directly renders a
  native disabled control.
- Do not keep both `editable` and `disabled` for the same interaction state.
- Keep `mode` in controller/model layers where domain policy is resolved.

Exit criteria:

- `TypeField` receives one interaction prop, preferably `editable`.
- `PropertyTypeFieldModel` exposes one interaction prop.
- `PropertySchemaDetailsField` does not translate `mode` plus `disabled`.
- Architecture tests enforce the final prop surface.

### 2. Pre-Reduce Object Row Type Editability

`ObjectPropertiesField` currently computes row type editability from:

- `disabled`
- `capabilities.canEditType`
- `mode`

That calculation belongs in the model layer.

Target row model shape:

```ts
interface ObjectPropertyRowModel {
  id: string
  name: string
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  type: {
    editable: boolean
    onChange: (schemaNode: ExtendedJSONSchema7) => void
  }
  details: PropertySchemaDetailsModel
  ...
}
```

Rules:

- `ObjectPropertiesField` should not know `canEditType`.
- `ObjectPropertiesField` should not derive a child `readOnly` mode.
- If a row type menu is not editable, pass that final state directly.

Exit criteria:

- `ObjectPropertiesField` does not reference `capabilities.canEditType`.
- Row type editability is computed in `useObjectPropertiesModel`.
- Nested row behavior remains unchanged in editable, read-only, and
  description-only modes.

### 3. Decide Whether Object Row Mechanics And Detail Recursion Should Split

`useObjectPropertiesModel` now owns:

- row identity
- local add-row state
- object property mutation actions
- row validation
- recursive schema-detail creation

This may be acceptable because all five are part of “object property row model.”
But it is dense.

Decision rule:

- Keep it together if splitting would only move lines around.
- Split only if a new module has a single crisp reason, such as:
  - `createObjectPropertyRows`
  - `createObjectPropertyDetails`
  - `useObjectPropertyDraftRows`

Rules:

- Do not split because the file is long.
- Split only if the new boundary makes caller code smaller or removes duplicate
  knowledge.
- No module should need both React state hooks and schema recursion unless that
  combination is the clearest expression of the row model.

Exit criteria:

- Either keep the hook intact and document the boundary through an architecture
  test, or split it into an obviously better model/helper pair.
- No behavior changes.

### 4. Make Architecture Guards More Structural Where Worth It

The current architecture tests mostly use string checks. Keep them where they
are cheap and sufficient. Replace only the brittle ones with structural checks.

Potential targets:

- TypeScript AST check for `TypeField` props.
- TypeScript AST check that `SchemaTypeMenuSection` has only `items` and
  `submenu` kinds.
- TypeScript AST check that `PropertyFormViewModel.fields` has explicit detail
  fields and no polymorphic schema detail field.

Rules:

- Use structural checks only where string checks are now too weak.
- Do not introduce a heavy parser dependency if the repo already has TypeScript
  available.
- Keep architecture tests fast.
- Prefer one small helper inside the test file over a new test utility module.

Exit criteria:

- At least the `TypeField` prop surface is protected structurally or by a very
  narrow string check.
- Architecture tests still run quickly.
- The tests fail for real boundary regressions, not formatting.

### 5. Reduce Class-Based E2E Assertions If A Better Contract Exists

The enum chip verifier now selects `data-slot="schema-chip"`, but still checks:

- `bg-muted`
- `px-1`
- `shadow-none`

This is acceptable if those exact classes are the intended visual contract.

Improve only if there is a better semantic contract:

- a design-token class grouping
- a component variant
- a stable primitive slot plus computed style checks

Rules:

- Do not weaken the regression guard.
- Do not add test-only styling attributes.
- If class checks remain, document that those classes are the explicit visual
  regression contract for the chip shell.

Exit criteria:

- Either class assertions remain intentionally, or they are replaced by a more
  semantic but equally strong check.
- Playwright failures still point to one concrete visual regression.

## Execution Plan

1. Audit current prop surfaces:
   - `property-form/types.ts`
   - `fields/type-field.tsx`
   - `fields/object-properties-field.tsx`
   - `fields/object-properties-model.ts`
   - `fields/property-schema-details-field.tsx`
   - `property-form-controller.ts`

2. Collapse `TypeField` editability:
   - replace `mode` + `disabled` with final `editable`
   - update `PropertyTypeFieldModel`
   - update controller/model creation
   - update callers

3. Pre-reduce object row type editability:
   - compute row type `editable` in `useObjectPropertiesModel`
   - remove `capabilities.canEditType` checks from `ObjectPropertiesField`

4. Decide the object-properties model boundary:
   - keep intact if it remains the smallest coherent unit
   - split only if the new helper removes meaningful density

5. Tighten architecture tests:
   - guard final `TypeField` prop surface
   - guard no renderer receives redundant editability props
   - keep primitive optional-feature guards

6. Revisit enum chip e2e assertions:
   - either document class assertions as intentional
   - or replace them with an equally strong semantic check

7. Run verification and search audits.

## Verification

Required:

```bash
pnpm typecheck
pnpm vitest run tests/schema-builder-architecture.test.ts tests/schema-editor-context.test.tsx tests/property-form.test.tsx tests/schema-editor-render.test.tsx
pnpm eslint components/schema-editor/primitives/schema-type-menu.tsx components/schema-editor/primitives/schema-chip-list.tsx components/schema-editor/schema-type-menu-sections.tsx components/schema-editor/object-template-type-section.tsx components/schema-editor/document-node-type-menu.tsx components/schema-editor/property-form/fields/type-field.tsx components/schema-editor/property-form/fields/property-type-menu-model.ts components/schema-editor/property-form/fields/object-properties-field.tsx components/schema-editor/property-form/fields/object-properties-model.ts components/schema-editor/property-form/types.ts components/schema-editor/property-form/model/property-schema-details.ts components/schema-editor/property-form/fields/property-schema-details-field.tsx components/schema-editor/property-form/property-form-shell.tsx components/schema-editor/property-form/property-form-controller.ts tests/schema-builder-architecture.test.ts tests/property-form.test.tsx e2e/schema-property-form.spec.ts
pnpm test:e2e -- e2e/schema-property-form.spec.ts
```

Search audits:

```bash
rg 'schemaNodeDetails|SchemaNodeField|kind:\s*"custom"|section.kind === "custom"|canEditPropertyType|SchemaTypeMenuAccessory|createObjectTemplateTypeAccessory|renderPropertyEditor' components/schema-editor tests/schema-builder-architecture.test.ts e2e/schema-property-form.spec.ts
rg 'mode=.*TypeField|disabled=.*TypeField|capabilities\.canEditType|variant="compact"|variant="outline"' components/schema-editor/property-form components/schema-editor/primitives tests/schema-builder-architecture.test.ts
```

The first search should have no live implementation hits. The second search is
the main audit for this pass; every hit must be intentionally kept, unrelated,
or removed.

## Completion Standard

This pass is complete only when:

- field renderers receive the smallest sufficient interaction state
- `TypeField` no longer receives redundant editability inputs
- object row type editability is model-owned
- object-properties model boundaries are explicitly justified by code shape
- architecture tests guard the final prop surfaces
- browser verification still protects the user-visible regressions
- the final diff is smaller in concept, not just more abstract

The result should feel less configurable and more inevitable.
