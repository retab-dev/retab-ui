# Schema Property Form Platonic Remaining Gap Blueprint

## Verdict

Not yet.

The crystalline pass removed the large imperfections. The remaining problems
are smaller but sharper:

- The recursive component import graph is still not ideal.
- Object-property selectors still live in an edits module.
- `PropertySchemaDetailsField` is now mostly a wrapper around
  `PropertySchemaPlanField`.
- Enum identity is architecturally guarded, but not behaviorally proven.

This blueprint targets only those four surfaces. No visual redesign, no schema
feature changes, no compatibility shims.

## Current Truth

The current recursive path is functionally clean:

```tsx
<PropertySchemaPlanField plan={row.schemaPlan} />
```

But the module graph still reads like:

```text
property-schema-plan-field
  -> object-properties-plan-field
  -> object-properties-field
  -> object-property-row
  -> property-schema-plan-field
```

That is a component-level cycle. It may run, but it is not crystalline.

The current object-property state module imports:

```ts
listObjectPropertyNames
```

from:

```text
property-form/model/object-property-edits.ts
```

That means read-only selection depends on a mutation-oriented module.

The current shell still renders:

```tsx
<PropertySchemaDetailsField plan={fields.schemaDetailsPlan} />
```

but `PropertySchemaDetailsField` only delegates to `PropertySchemaPlanField`.
The name now carries history more than purpose.

The current enum identity uses local stable IDs, but tests do not yet prove the
behavioral contract:

- IDs survive value replacement.
- IDs shift correctly after removal.
- IDs reset on external reset.
- IDs are not written into JSON Schema values.

## Non-Negotiable Invariants

- No recursive import cycle among schema-plan and object-property row modules.
- No selector import from a mutation/edit module.
- No wrapper component kept only for old naming comfort.
- No enum IDs persisted into schema values.
- No index-based chip ID in `EnumValuesField`.
- No broad migration outside `components/schema-editor/property-form`.
- No visual regression of object rows, enum chips, grips, type menus, or
  description caret behavior.

## Target Shape

### 1. Break The Recursive Component Import Cycle

The problem is not recursion itself. Recursive UI is correct. The problem is
that the row component imports the recursive plan component while the recursive
plan component imports the object-properties branch that eventually imports the
row component.

Target dependency direction:

```text
property-schema-plan-field
  -> object-properties-plan-field
  -> object-properties-field
  -> object-property-rows-shell

object-property-row
  receives nestedSchemaPlan as children or a component prop
```

Preferred shape:

```tsx
<ObjectPropertyRows
  details={details}
  renderSchemaPlan={(plan) => <PropertySchemaPlanField plan={plan} />}
/>
```

This looks like a render prop, which we previously avoided. Here it has a
specific purpose: break a concrete component import cycle at the list boundary,
not create a generic escape hatch.

Alternative shape:

```tsx
<ObjectPropertyRows details={details}>
  {(plan) => <PropertySchemaPlanField plan={plan} />}
</ObjectPropertyRows>
```

Decision rule:

- Prefer explicit `renderSchemaPlan` if it keeps row JSX clearer.
- Prefer function-as-children only if it avoids another prop that feels like an
  adapter leak.
- Do not reintroduce `renderPropertySchemaPlan` as a module-level helper.

Exit criteria:

- `object-property-row.tsx` does not import `property-schema-plan-field`.
- `property-schema-plan-field.tsx` may import `ObjectPropertiesPlanField`.
- `ObjectPropertiesPlanField` may import `ObjectPropertiesField`.
- `ObjectPropertiesField` may import `ObjectPropertyRows`.
- The cycle is broken by composition, not by a hidden renderer helper.
- Architecture tests walk imports or enforce direct forbidden imports.

### 2. Move Object-Property Selectors Out Of Edits

`object-property-edits.ts` should own writes. Selectors should live in a
read-only module.

Target module:

```text
property-form/model/object-property-selectors.ts
```

Target exports:

```ts
export function isSchemaNode(...)
export function listObjectPropertyNames(...)
```

Ownership:

- `object-property-selectors.ts`: read-only schema inspection.
- `object-property-edits.ts`: create, replace, rename, remove, move.
- `object-properties-state.ts`: may import selectors.
- `object-properties-rows.ts`: may import selectors if needed.
- `object-properties-operations.ts`: may import edits.

Rules:

- `object-property-edits.ts` may import selectors.
- Selectors must not import edits.
- State modules must not import edits.
- Row builders must not import edits unless they actually perform mutations.

Exit criteria:

- `object-properties-state.ts` has no import from `object-property-edits.ts`.
- `object-property-edits.ts` no longer defines `isSchemaNode` or
  `listObjectPropertyNames`.
- Architecture tests assert selector/edit dependency direction.

### 3. Rename Or Delete `PropertySchemaDetailsField`

After the crystalline pass, `PropertySchemaDetailsField` is just:

```tsx
return <PropertySchemaPlanField plan={plan} />
```

That can be either:

- deleted, with call sites using `PropertySchemaPlanField` directly, or
- renamed to the final public name if the wrapper is intentionally the public
  recursive field component.

Preferred target:

```tsx
<PropertySchemaPlanField plan={fields.schemaDetailsPlan} />
```

Rules:

- No wrapper whose only reason is historical naming.
- No `PropertySchemaDetailsField` if the data prop is named `plan`.
- If a public component name is needed, it should be
  `PropertySchemaPlanField`.

Exit criteria:

- `property-schema-details-field.tsx` is deleted.
- No import of `PropertySchemaDetailsField` remains.
- `property-form-shell.tsx` imports `PropertySchemaPlanField` directly.
- Architecture tests forbid the deleted wrapper.

### 4. Add Behavioral Tests For Enum Identity

Architecture tests prove the shape. They do not prove identity behavior.

Add focused behavior tests for `EnumValuesField` or the identity hook.

Required proofs:

1. Replace keeps the same chip ID.
2. Remove deletes only that chip ID and preserves the others.
3. Add creates a new ID without reusing a removed ID during the same local
   session.
4. Changing `resetKey` resets identity.
5. `onChange` receives only JSON Schema enum values, never identity metadata.

Preferred test level:

- Hook-level tests if they can prove identity directly without DOM noise.
- Component-level tests if the public contract is easier to observe through
  `SchemaChipList` items.

Rules:

- Do not test implementation refs directly if a public behavior can prove the
  contract.
- Do not add identity fields to schema values.
- Do not use snapshots.

Exit criteria:

- `tests/property-form.test.tsx` or a focused enum identity test proves the five
  required behaviors.
- Architecture tests still forbid positional IDs.
- A regression to index IDs fails at least one behavior test.

## Implementation Order

1. Extract `object-property-selectors.ts`.
2. Update edits, state, rows, and tests to import selectors from that module.
3. Delete `PropertySchemaDetailsField` and use `PropertySchemaPlanField`
   directly from shell call sites.
4. Break the recursive component cycle by passing schema-plan rendering through
   the object-property rows boundary.
5. Add enum identity behavior tests.
6. Upgrade architecture tests for selector/edit ownership, wrapper deletion,
   and cycle-breaking imports.
7. Run verification.

## Verification Matrix

Run:

```bash
pnpm typecheck
pnpm vitest run tests/schema-builder-architecture.test.ts tests/schema-editor-context.test.tsx tests/property-form.test.tsx tests/schema-editor-render.test.tsx tests/schema-property-reorder.test.ts tests/schema-document-view-model.test.ts
pnpm eslint components/schema-editor/property-form/fields/enum-value-identity.ts components/schema-editor/property-form/fields/enum-values-field.tsx components/schema-editor/property-form/fields/object-properties-field.tsx components/schema-editor/property-form/fields/object-properties-model.ts components/schema-editor/property-form/fields/object-properties-state.ts components/schema-editor/property-form/fields/object-properties-operations.ts components/schema-editor/property-form/fields/object-properties-rows.ts components/schema-editor/property-form/fields/object-property-row.tsx components/schema-editor/property-form/fields/object-property-row-details.ts components/schema-editor/property-form/fields/object-property-row-identity.ts components/schema-editor/property-form/fields/object-properties-plan-field.tsx components/schema-editor/property-form/fields/property-schema-plan-field.tsx components/schema-editor/property-form/model/object-property-edits.ts components/schema-editor/property-form/model/object-property-selectors.ts components/schema-editor/property-form/model/object-properties-view.ts components/schema-editor/property-form/model/property-schema-details.ts components/schema-editor/property-form/property-form-controller.ts components/schema-editor/property-form/property-form-shell.tsx components/schema-editor/property-form/types.ts tests/schema-builder-architecture.test.ts tests/property-form.test.tsx tests/schema-property-reorder.test.ts e2e/schema-property-form.spec.ts
pnpm test:e2e -- e2e/schema-property-form.spec.ts
```

Audit:

```bash
rg -n "PropertySchemaDetailsField|property-schema-details-field" components/schema-editor/property-form tests/schema-builder-architecture.test.ts -S
rg -n "property-schema-plan-field" components/schema-editor/property-form/fields/object-property-row.tsx -S
rg -n "listObjectPropertyNames|isSchemaNode" components/schema-editor/property-form/model/object-property-edits.ts -S
rg -n "object-property-edits" components/schema-editor/property-form/fields/object-properties-state.ts components/schema-editor/property-form/fields/object-properties-rows.ts -S
rg -n 'id: `enum-value-\\$\\{index\\}`|enum-value-\\$\\{index\\}' components/schema-editor/property-form tests/schema-builder-architecture.test.ts -S
```

Expected audit result:

- no stale details-field wrapper
- no row-to-plan-field direct import
- selectors absent from edit module
- state and rows do not import edits
- no positional enum chip IDs

## Completion Standard

The component reaches the next platonic threshold when this sentence is true:

> Recursive schema rendering is composed without an import cycle; selectors and
> edits live in separate modules with one-way dependency; the shell names and
> renders the recursive plan directly; enum identity is stable by behavior, not
> only by architecture; and tests prove each of those boundaries precisely.

Until then, it is excellent, but not perfect.
