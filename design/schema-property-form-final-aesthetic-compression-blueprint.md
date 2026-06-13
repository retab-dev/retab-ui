# Schema Property Form Final Aesthetic Compression Blueprint

## Objective

Move the schema property form from excellent production architecture toward the
remaining taste-level edge of the platonic ideal:

- simplicity
- speed
- everything needed
- nothing more
- perfect modularization
- high-entropy code
- perfectly consistent variable names
- Flaubertian precision

This is a final aesthetic compression pass. The goal is not to add behavior. The
goal is to remove the last avoidable density and make the remaining boundaries
feel inevitable.

## Current State

The post-gap compression blueprint has been implemented.

Strong points now:

- `TypeField` receives one interaction prop: `editable`.
- `PropertyTypeFieldModel` exposes `editable`, not `mode` plus `disabled`.
- Object row type editability is model-owned.
- `ObjectPropertiesField` receives `editable` and bridges to native `disabled`
  only at native-control boundaries.
- Recursive schema-detail construction is not renderer-owned.
- `SchemaTypeMenu` remains optional-feature agnostic.
- Object-template lazy loading remains isolated to
  `object-template-type-section.tsx`.
- Enum chips have `data-slot="schema-chip"`.
- Architecture tests include structural checks for key field prop surfaces.
- Playwright covers the critical visual and interaction regressions.

Remaining non-ideal tension:

- `ObjectPropertiesField` still receives `mode`, `capabilities`, and
  `editable`.
- `useObjectPropertiesModel` owns row identity, add-row state, mutations,
  validation, type editability, and recursive detail creation.
- `PropertySchemaDetailsCapabilities` mirrors names from
  `PropertyCapabilities`; it is clear, but not compressed.
- `createPropertySchemaDetails` and `useObjectPropertiesModel` both participate
  in recursive detail construction.
- Architecture tests are stronger, but still mix structural checks with string
  checks.
- The enum chip e2e still asserts Tailwind classes directly, intentionally.

## Non-Negotiable Invariants

- No legacy adapters.
- No compatibility aliases.
- No duplicate old/new APIs.
- No primitive imports from schema-editor adapters, property form, document
  editor, optional features, or JSON table.
- No schema/domain knowledge inside primitives.
- No optional-feature words inside `SchemaTypeMenu`.
- No renderer computes schema semantics.
- No new abstraction unless it removes a real prop, duplicate concept, branch,
  or naming translation.
- No broad “custom render” escape hatch.
- No public API name based on implementation styling if a domain, behavior, or
  placement word is available.

## Target Shape

### 1. Compress Object Properties Field Props

`ObjectPropertiesField` currently receives:

```ts
{
  schemaNode
  schemaContext
  mode
  capabilities
  editable
  onChange
  renderPropertyDetails
}
```

This is defensible, but not obviously minimal.

Target principle:

- `ObjectPropertiesField` should receive the smallest object-property model
  input that it cannot derive locally.
- If `mode` and `capabilities` exist only to call `useObjectPropertiesModel`,
  consider wrapping them in a single model input object.
- If `ObjectPropertiesField` is only a view over a hook result, consider whether
  its public prop surface should be the hook input exactly, or whether it should
  receive a prebuilt model.

Candidate target:

```ts
interface ObjectPropertiesFieldModel {
  rows: ObjectPropertyRowModel[]
  addRow: ObjectPropertyAddRowModel
  editable: boolean
}

function ObjectPropertiesField({
  model,
  renderPropertyDetails,
}: {
  model: ObjectPropertiesFieldModel
  renderPropertyDetails: (details: PropertySchemaDetailsModel) => React.ReactNode
})
```

Alternative target:

```ts
function ObjectPropertiesField({
  details,
  renderPropertyDetails,
}: {
  details: PropertyObjectPropertiesFieldModel
  renderPropertyDetails: (details: PropertySchemaDetailsModel) => React.ReactNode
})
```

Decision rule:

- Prefer prebuilt `model` if it makes JSX purely presentational.
- Prefer `details` if it avoids a new abstraction and simply groups already
  coherent data.
- Do not create a wrapper object that only hides prop names without reducing
  responsibility.

Exit criteria:

- `ObjectPropertiesField` prop surface is smaller or demonstrably more
  inevitable.
- `ObjectPropertiesField` no longer exposes low-level model construction inputs
  if it does not need to.
- Architecture tests protect the chosen final prop surface.

### 2. Decide The Recursive Detail Ownership Boundary

Current recursive detail ownership:

- `createPropertySchemaDetails` owns top-level schema-detail decisions and array
  recursion.
- `useObjectPropertiesModel` owns object-row recursion because it owns stable row
  IDs and row contexts.

This may be the correct boundary. But it should be made explicit and, if
possible, cleaner.

Options:

1. Keep the split:
   - `createPropertySchemaDetails` handles schema type decisions.
   - `useObjectPropertiesModel` handles object property row identity/context and
     therefore child detail creation.

2. Extract a pure helper:
   - `createObjectPropertyRowDetails`
   - takes row schema/context/actions
   - returns the recursive `details`
   - leaves React state in `useObjectPropertiesModel`

3. Move all recursion into `createPropertySchemaDetails`:
   - only if stable row IDs and object row contexts can be passed cleanly
   - avoid this if it couples schema-detail creation to React row state.

Decision rule:

- Keep the split unless extraction removes cognitive load.
- Extract only if the helper has one sentence of responsibility.
- Do not move row identity into generic schema-detail code.

Exit criteria:

- The chosen boundary is clear from module names and imports.
- No module has ambiguous ownership of the same recursive decision.
- Architecture tests encode the boundary.

### 3. Revisit Capability Naming Compression

`PropertySchemaDetailsCapabilities` currently mirrors:

```ts
canEditType
canEditNestedObject
canEditArrayItems
canEditEnumValues
```

This is consistent and readable. It may still be more verbose than necessary
inside schema details.

Candidate compressed shape:

```ts
interface PropertySchemaDetailAccess {
  type: boolean
  object: boolean
  array: boolean
  enum: boolean
}
```

or:

```ts
interface PropertySchemaDetailAccess {
  type: boolean
  objectProperties: boolean
  arrayItems: boolean
  enumValues: boolean
}
```

Decision rule:

- Keep `canEdit*` if compression obscures domain meaning.
- Rename only if the shorter names remove repetition without ambiguity.
- Do not mix `canEdit*` and compressed names for the same layer.

Exit criteria:

- One capability vocabulary exists per layer.
- Detail/model code reads cleanly without repetitive domain prefixes.
- Tests protect the chosen names enough to prevent drift.

### 4. Tighten Architecture Tests Only Where They Earn Their Keep

The architecture tests now include AST checks for field prop surfaces. Do not
turn the file into a parser framework.

Possible improvements:

- Add a structural check for `SchemaTypeMenuSection` kinds.
- Add a structural check for `PropertyFormViewModel.fields`.
- Replace a fragile string check only if it has produced false positives or
  hides meaningful regressions.

Rules:

- Keep architecture tests fast.
- Prefer structural checks for API shape.
- Keep string checks for import-boundary and deleted-file guards.
- Do not test formatting.

Exit criteria:

- The most important public/internal prop surfaces are guarded structurally.
- Import and optional-feature boundaries remain guarded cheaply.
- Test maintenance burden does not increase meaningfully.

### 5. Keep Or Replace Enum Chip Class Assertions Deliberately

The enum chip test currently asserts:

- `data-slot="schema-chip"`
- `bg-muted`
- `px-1`
- `shadow-none`

This is explicit and catches the exact previous regression. It is class-based,
but defensible.

Decision rule:

- Keep class assertions if these classes are the visual contract.
- Replace with computed style only if it is equally precise and less brittle.
- Do not weaken this check into a broad screenshot or vague existence assertion.

Exit criteria:

- The e2e test still catches padding/shadow/background regressions.
- The test reads as intentional, not incidental.

## Execution Plan

1. Audit current object-properties surfaces:
   - `PropertyObjectPropertiesFieldModel`
   - `ObjectPropertiesField`
   - `useObjectPropertiesModel`
   - `PropertySchemaDetailsField`

2. Decide and implement the smallest object-properties field API:
   - prebuilt `model`
   - grouped `details`
   - or current API if it is genuinely clearest, with architecture guard

3. Decide recursive ownership:
   - keep the split and encode it
   - or extract `createObjectPropertyRowDetails` if it makes the model clearer

4. Revisit capability naming:
   - keep `canEdit*` if clearer
   - or compress to a detail-layer access object if it reduces repetition

5. Tighten architecture tests:
   - structural checks only where they protect real API shape
   - no broad parser framework

6. Keep or replace enum chip visual assertions:
   - preserve regression strength
   - document the decision if class assertions remain

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
rg 'mode=.*TypeField|disabled=.*TypeField|fields\.type\.mode|fields\.type\.disabled|type\.mode|type\.disabled|objectProperties\.disabled|disabled=\{objectProperties' components/schema-editor/property-form components/schema-editor/primitives tests/schema-builder-architecture.test.ts
```

Every live hit must be either intentionally retained, unrelated, or removed.

## Completion Standard

This pass is complete only when:

- object-properties field/model boundaries are either smaller or explicitly
  justified
- recursive detail ownership is unambiguous
- capability naming is either compressed or deliberately kept as clearer
- architecture tests protect the final surfaces without becoming brittle
- enum chip visual regression coverage remains strong
- the final diff reduces conceptual surface area

If the best answer is “do not split further,” the code and architecture tests
must make that answer defensible.
