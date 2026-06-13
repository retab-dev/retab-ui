# Schema Property Form Remaining Platonic Gap Blueprint

## Objective

Close the remaining gap between the current schema/property-form architecture and
the platonic ideal:

- simplicity
- speed
- everything needed
- nothing more
- perfect modularization
- high-entropy code
- perfectly consistent variable names
- Flaubertian precision

This is not a feature pass. The UI is functionally good. The remaining work is
API inevitability, naming compression, and responsibility exactness.

## Current State

The current implementation has crossed the important architectural threshold:

- `SchemaTypeMenu` is optional-feature agnostic.
- Object-template menu loading is injected from adapters through
  `object-template-type-section.tsx`.
- The old polymorphic `fields.schemaNodeDetails` model is gone.
- The old recursive `SchemaNodeField` is gone.
- Property-form object rows reuse the schema-builder row, inline text, grip,
  row-action, add-row, and type-menu primitives.
- Enum chips share the schema-builder chip primitive.
- Architecture tests guard the main boundaries.
- `e2e/schema-property-form.spec.ts` verifies object rows, grips, enum chip
  shape, caret placement, type menu selection, and nested object editing.

This is a strong shape. It is not yet perfect.

## Remaining Non-Ideal Tension

### 1. Recursive Detail Modeling Is Split Across Model And Renderer

`createPropertySchemaDetails` creates the first detail model, but
`PropertySchemaDetailsField` creates child detail models while rendering nested
object properties.

That means the renderer still owns a small piece of schema-detail construction.
It is not dramatic, but it breaks the ideal:

- models should model
- renderers should render
- recursion should live in one layer

The target is a fully recursive property schema detail view model produced before
rendering.

### 2. Mutability Vocabulary Is Better But Still Not Minimal

The intended vocabulary is:

- `mode`: schema/property editing mode
- `canEdit*`: domain capability
- `editable`: primitive interaction state
- `disabled`: native control state

The current implementation follows this mostly well, but some call sites still
translate similar concepts more than once.

The most obvious tension:

- `PropertyObjectPropertiesFieldModel.canEditPropertyType`
- `PropertyObjectPropertiesFieldModel.capabilities.canEditType`

These represent the same conceptual permission at two levels. That duplication
is survivable, but not inevitable.

### 3. Type Menu Variant Names Still Translate

`TypeField` exposes:

```ts
variant?: "outline" | "compact"
```

`SchemaTypeMenu` consumes:

```ts
variant: "form" | "row"
```

That mapping is small, but it creates avoidable vocabulary drift. One concept is
being named twice.

The ideal is a single variant language, probably:

- `form`
- `row`

because those describe placement, not styling.

### 4. The Menu Injection Slot Name Is Broad

`SchemaTypeMenuAccessory` is architecturally clean because primitives no longer
know about object templates.

The remaining question is precision:

- `accessory` is generic.
- The actual slot means “trailing menu content after ordinary sections.”

If more injected menu content is plausible, `accessory` is fine. If not, a more
exact name like `trailingContent` or `trailingSection` may be better.

The decision should be based on the real primitive contract, not taste.

### 5. The E2E Enum Chip Assertion Is Class-Based

The Playwright verifier currently protects the exact visual regression:

- `bg-muted`
- `px-1`
- `shadow-none`

That is useful, but it tests styling by Tailwind class names. The ideal contract
would make the chip shell a named component or slot whose visual shape can be
guarded through a semantic selector plus minimal style assertions.

Do not over-engineer this. Only change it if there is a clean component contract
already emerging.

## Non-Negotiable Invariants

- No legacy adapters.
- No compatibility aliases.
- No broad fallback paths.
- No duplicate old/new APIs.
- No primitive imports from schema-editor adapters, property form, document
  editor, optional features, or JSON table.
- No optional-feature words inside `SchemaTypeMenu`.
- No component accepts both `editable` and `disabled` unless it explicitly
  bridges primitive state into a native control.
- No renderer performs schema analysis if a view model can provide the answer.
- No new abstraction unless it removes a real branch, duplicate concept, or
  naming translation.
- No public prop named with a styling metaphor when a placement/domain name is
  available.

## Target Shape

### 1. Make Schema Details Fully Model-Driven

Move recursive detail creation out of `PropertySchemaDetailsField`.

Target model shape:

```ts
interface PropertyObjectPropertyRowDetailsModel {
  propertyName: string
  details: PropertySchemaDetailsModel
}

interface PropertyObjectPropertiesFieldModel {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  mode: PropertyFormMode
  disabled: boolean
  properties: PropertyObjectPropertyRowDetailsModel[]
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}
```

This exact interface is illustrative, not mandatory. The invariant is mandatory:
`PropertySchemaDetailsField` must render a passed detail model without calling
`createPropertySchemaDetails`.

Exit criteria:

- `PropertySchemaDetailsField` imports no detail model factory.
- Recursive object/array details are present in the view model before render.
- The controller/model layer owns all schema-node inspection.
- Existing object add/rename/remove behavior remains unchanged.

### 2. Collapse Duplicate Capability Surfaces

Remove duplicated permission concepts from object-property detail models.

Candidate end state:

```ts
interface PropertySchemaDetailsCapabilities {
  type: boolean
  enumValues: boolean
  objectProperties: boolean
  arrayItems: boolean
}
```

or keep the existing `canEdit*` names if they remain clearer:

```ts
type PropertySchemaDetailsCapabilities = Pick<
  PropertyCapabilities,
  "canEditType" | "canEditEnumValues" | "canEditNestedObject" | "canEditArrayItems"
>
```

Rules:

- One permission appears once in a model.
- The same concept has the same name everywhere.
- Renderers receive only the final primitive state they need.

Exit criteria:

- No object-properties model carries both `canEditPropertyType` and
  `capabilities.canEditType`.
- Type editability is computed once per row/detail.
- Tests cover read-only and description-only behavior for nested object rows.

### 3. Use One Type Menu Variant Vocabulary

Unify `TypeField` and `SchemaTypeMenu` variants.

Preferred target:

```ts
type SchemaTypeMenuVariant = "form" | "row"

interface TypeFieldProps {
  variant?: SchemaTypeMenuVariant
}
```

Rules:

- No `"outline"`/`"compact"` translation layer if those only mean
  `"form"`/`"row"`.
- Variant names describe placement and behavior, not incidental styling.
- Call sites should read naturally:
  - property form top-level type: `variant="form"` or omitted
  - schema/object row type: `variant="row"`

Exit criteria:

- `rg '"compact"|"outline"' components/schema-editor/property-form
  components/schema-editor` has no type-menu variant hits.
- `TypeField` passes the variant directly to `SchemaTypeMenu`.
- Existing visual output is unchanged.

### 4. Decide And Tighten The Menu Injection Slot Name

Audit `SchemaTypeMenuAccessory`.

Decision path:

- Keep `accessory` if the primitive truly offers a generic trailing render slot.
- Rename to `trailingContent` if the slot is simply content appended after
  sections.
- Rename to `trailingSection` if it must behave like menu section content.

Rules:

- The name should describe the primitive contract, not the current feature.
- Do not use `objectTemplate*` in the primitive.
- Do not restore `custom`.

Exit criteria:

- The chosen slot name reads correctly in both document-node and property-form
  adapters.
- Architecture tests enforce no optional-feature import or object-template word
  in primitives.
- The lazy object-template import still exists only in
  `object-template-type-section.tsx`.

### 5. Make Enum Chip Contract Semantic If It Falls Out Naturally

If the chip shell has become a meaningful primitive contract, make it explicit.

Possible target:

```tsx
<div data-slot="schema-chip" ...>
```

Rules:

- Do this only if it removes test brittleness or improves component readability.
- Do not add selectors only for tests.
- If a slot is added, it is a real public primitive contract.

Exit criteria:

- E2E can select the enum chip shell semantically.
- Style assertions remain minimal and intentional.
- `SchemaChipList` API does not grow unless a real caller needs it.

### 6. Strengthen Architecture Tests Around The Final Shape

Add guards that encode positive architecture, not just absence of old names.

Required guards:

- `PropertySchemaDetailsField` does not import `createPropertySchemaDetails`.
- Recursive schema detail creation lives in the model/controller layer.
- Type menu variant vocabulary is unified.
- No duplicate `canEditPropertyType` plus `canEditType` capability surface.
- `SchemaTypeMenu` has only primitive section kinds and one typed trailing slot.
- Object-template menu import exists in exactly one adapter file.

Rules:

- Keep tests cheap.
- Avoid brittle import-order or formatting checks.
- Prefer checking ownership boundaries over checking implementation trivia.

## Execution Plan

1. Inspect current model/render boundaries:
   - `property-schema-details.ts`
   - `property-schema-details-field.tsx`
   - `object-properties-field.tsx`
   - `object-properties-model.ts`
   - `property-form-controller.ts`

2. Move recursive detail creation into the model layer:
   - extend object row/detail models as needed
   - keep object row mechanics in `object-properties-model.ts`
   - keep schema detail decisions in `property-schema-details.ts`
   - keep JSX rendering in `property-schema-details-field.tsx`

3. Collapse capability duplication:
   - remove `canEditPropertyType` or remove the broader capability passthrough
   - choose the smaller model surface
   - update object row type-field editability from the chosen single source

4. Normalize type menu variant names:
   - rename `TypeField` variants to `form`/`row`
   - update all call sites
   - remove translation logic

5. Re-evaluate the menu injection slot:
   - keep or rename `SchemaTypeMenuAccessory`
   - update document/property adapters consistently
   - keep primitive optional-feature agnostic

6. Optionally add a semantic chip slot:
   - only if it improves the primitive contract
   - update Playwright selector if added

7. Tighten architecture tests:
   - add positive shape checks
   - keep old-name absence guards where they catch real regressions

8. Run full verification.

## Verification

Required:

```bash
pnpm typecheck
pnpm vitest run tests/schema-builder-architecture.test.ts tests/schema-editor-context.test.tsx tests/property-form.test.tsx tests/schema-editor-render.test.tsx
pnpm eslint components/schema-editor/primitives/schema-type-menu.tsx components/schema-editor/schema-type-menu-sections.tsx components/schema-editor/object-template-type-section.tsx components/schema-editor/document-node-type-menu.tsx components/schema-editor/property-form/fields/type-field.tsx components/schema-editor/property-form/fields/property-type-menu-model.ts components/schema-editor/property-form/types.ts components/schema-editor/property-form/model/property-schema-details.ts components/schema-editor/property-form/fields/property-schema-details-field.tsx components/schema-editor/property-form/property-form-shell.tsx components/schema-editor/property-form/property-form-controller.ts tests/schema-builder-architecture.test.ts e2e/schema-property-form.spec.ts
pnpm test:e2e -- e2e/schema-property-form.spec.ts
```

Search audits:

```bash
rg 'schemaNodeDetails|SchemaNodeField|kind:\s*"custom"|section.kind === "custom"|createPropertyTypeMenuModel|createSchemaTypeMenuItems|createSchemaTypeMenuValue|createDefinitionTypeSection' components/schema-editor tests/schema-builder-architecture.test.ts e2e/schema-property-form.spec.ts
rg '"compact"|"outline"|canEditPropertyType|SchemaTypeMenuAccessory|accessory' components/schema-editor tests/schema-builder-architecture.test.ts
```

The first search should return no live implementation hits. The second search is
an audit list; every remaining hit must be either intentionally kept or removed.

## Completion Standard

This pass is complete only when:

- renderers render only view models
- schema detail recursion is model-owned
- type menu variant names are unified
- duplicated capability concepts are gone
- primitive optional-feature agnosticism remains intact
- browser verifier still passes
- architecture tests make the final shape hard to regress

The result should feel smaller, not merely more abstract.
