# Schema Property Form Terminal Component Ideal Blueprint

## Verdict

Not yet.

The component is now shippable, modular, and well tested, but the remaining
gap is aesthetic and architectural exactness rather than missing behavior. This
blueprint targets the last layer: naming, recursive ownership, enum identity,
and architecture tests that prove boundaries without brittle source-string
assertions.

## Non-Negotiable Invariants

- No visual changes unless a simplification exposes an existing inconsistency.
- No feature expansion.
- No compatibility aliases or legacy wrappers.
- No recursive module cycle.
- No schema value polluted with local UI identity.
- No mutation helper imported by read-only state or view modules.
- No broad edits outside `components/schema-editor/property-form`,
  schema-editor primitives used by it, and focused tests.

## Current Remaining Imperfections

### 1. Recursive Rendering Is Correct But Still Not Inevitable

`PropertySchemaPlanField` owns recursive rendering and injects
`renderSchemaPlan` through the object-properties branch. This broke the import
cycle, but the render prop is still a visible architectural accommodation.

The problem is not the render prop itself. The problem is that recursion,
branch rendering, and field dispatch are all expressed by one component.

Target state:

- A single recursive renderer owns only recursion.
- Branch components receive already-rendered recursive children where possible.
- Object property rows remain display-only and do not know the concrete
  recursive component.
- The cycle stays broken by composition, not by helper modules.

Preferred shape:

```tsx
<SchemaDetailsRenderer plan={plan}>
  {(childPlan) => <SchemaDetailsRenderer plan={childPlan} />}
</SchemaDetailsRenderer>
```

Only adopt this if it makes the API smaller than the current
`renderSchemaPlan` path. If it merely renames the same idea, leave the current
shape alone.

Exit criteria:

- There is exactly one recursive component.
- Row modules do not import the recursive component.
- Object branch modules do not know about concrete recursive field names.
- The public prop name is inevitable: either `children` or `renderPlan`, not a
  domain-specific workaround name.

### 2. Plan Naming Still Has Too Many Near-Synonyms

The current vocabulary is close but not perfect:

- `PropertySchemaDetailsPlan`
- `PropertySchemaDetailPlan`
- `detail`
- `field`
- `plan`
- `details`

The intent is good: `field` means ready-to-render model, `plan` means unresolved
recursive/stateful branch. But `details` is soft. It describes UI content, not
the layer.

Target vocabulary:

- `SchemaPlan`: recursive packet.
- `SchemaPlanItem`: discriminated item inside the packet.
- `field`: complete render input.
- `branch`: unresolved recursive or stateful plan.

Candidate final names:

```ts
interface PropertySchemaPlan {
  items: PropertySchemaPlanItem[]
}

type PropertySchemaPlanItem =
  | PropertyTypePlanItem
  | PropertyEnumPlanItem
  | PropertyObjectPlanItem
  | PropertyArrayPlanItem
```

Rules:

- Do not rename if the new names create churn without reducing ambiguity.
- If renamed, make a hard cutover and update every call site.
- Do not keep `Details` aliases.
- `field` must only mean render-ready.
- `plan` or `branch` must only mean unresolved recursive/stateful work.

Exit criteria:

- One canonical name for the recursive schema packet.
- One canonical name for packet entries.
- No `DetailsField` or `DetailsModel` vocabulary remains.
- Architecture tests enforce the vocabulary.

### 3. Object Properties Are Modular, But State Is Still A Mixed Hook

`useObjectPropertiesState` is coherent, but it owns add-input state,
validation, property-name selection, and row identity. That is acceptable. The
ideal version separates pure derivation from React state so the hook becomes a
thin adapter.

Target modules:

```text
object-property-selectors.ts
object-property-add-input.ts
object-property-row-identity.ts
object-properties-state.ts
object-properties-operations.ts
object-properties-rows.ts
object-properties-model.ts
```

Ownership:

- selectors: read-only schema inspection.
- add-input: pure validation and add-input model creation.
- row identity: stable row IDs and local identity transitions.
- state hook: React state only.
- operations: schema writes only.
- rows: view model creation only.
- model: coordinator only.

Exit criteria:

- `useObjectPropertiesState` has no validation policy inline.
- `useObjectPropertiesState` has no schema mutation imports.
- `object-properties-model.ts` remains a short coordinator.
- Pure helpers have direct unit tests where behavior is non-trivial.

### 4. Enum Identity Is Stable Locally, Not Intrinsic

Enum chips now have local stable IDs and behavior tests. That is enough for the
current UI. It is not the platonic identity model because the underlying schema
enum remains an array of raw JSON values.

There are two valid final positions.

Position A: UI-local identity is the ideal.

- JSON Schema enum values stay raw.
- Identity exists only for rendering, focus, and local chip transitions.
- Tests prove identity is never emitted through `onChange`.

Position B: internal draft identity is the ideal.

- The editor uses an internal draft list of `{ id, value }`.
- The serializer emits raw JSON Schema enum values.
- Parsing and serialization are the only translation boundary.

Decision rule:

- Choose Position A unless enum chips need reorder, per-chip validation state,
  async validation, animation continuity, or duplicate-value editing.
- Choose Position B only when a real feature requires intrinsic draft identity.

Exit criteria for Position A:

- `useEnumValueIdentity` is documented by tests as local-only.
- Duplicate enum values keep distinct local chip IDs.
- Add/remove/replace/reset behavior stays covered.
- No identity reaches schema values.

Exit criteria for Position B:

- A draft enum item type exists in one module.
- Serialization strips IDs.
- Duplicate values are naturally supported.
- All enum field tests assert raw schema output.

### 5. Architecture Tests Should Prove Boundaries Structurally

Current architecture tests still rely on several source-string checks. They are
useful, but not beautiful. The ideal test suite has a small import graph helper
and targeted AST-ish helpers for exported interfaces.

Target helper:

```ts
expectImportGraph({
  root: "components/schema-editor/property-form",
}).toHaveNoCycle()

expectModule("fields/object-properties-state.ts")
  .not.toImport("model/object-property-edits.ts")
```

Rules:

- Keep direct behavior tests for runtime behavior.
- Use import-graph tests for module boundaries.
- Use type/interface extraction only for public contracts.
- Avoid broad string assertions for incidental implementation names.

Exit criteria:

- The recursive cycle is tested by import graph traversal.
- State-to-edits dependency is tested by import graph traversal.
- Deleted wrapper files are tested by filesystem existence.
- Enum identity is tested behaviorally, not only architecturally.

## Implementation Order

1. Build or extract a tiny import graph test helper.
2. Replace brittle architecture assertions for the already-fixed cycles and
   selector boundaries with structural assertions.
3. Decide whether the recursive renderer API should stay as `renderSchemaPlan`
   or compress to a more inevitable `children`/`renderPlan` shape.
4. Tighten recursive plan names only if the resulting vocabulary is strictly
   smaller and clearer.
5. Extract pure add-input derivation from `useObjectPropertiesState` if it
   reduces the hook without adding ceremony.
6. Add duplicate-value enum identity behavior tests before any enum identity
   redesign.

## Stop Conditions

Stop if a proposed change only renames the current shape without reducing:

- number of concepts,
- number of imports,
- number of public props,
- number of responsibilities per module, or
- ambiguity in names.

The goal is not motion. The goal is less code with sharper boundaries.

## Final Definition Of Done

- The component has no import cycles.
- The recursive API is the smallest API that expresses recursion.
- Object-property state, operations, selectors, rows, and view models each have
  one reason to change.
- Enum identity behavior is proven across duplicate, add, remove, replace, and
  reset cases.
- Architecture tests assert dependency boundaries structurally.
- Names make illegal states sound awkward and correct states sound obvious.
