# Schema Editor Primitive Layer Blueprint

## Context

The property form object builder now shares some schema-builder row pieces, but
the modularization is still shallow. It shares layout and a few inline controls,
while the deeper interaction language remains split across the schema builder
and property form.

The missing grip affordance exposes the problem. In the schema builder, an object
field row is not just a layout of name, description, actions, and type. It is a
full field-row system:

- a stable left affordance column
- row identity
- editable inline metadata
- compact type selection
- hover-revealed actions
- nested payload rhythm
- add-row rhythm
- chip/list editing for enum-like values

The next step should be a deeper primitive layer that both schema-builder and
property-form adapters consume.

## Goal

Create one shared schema-editor interaction language for rows, type menus, add
rows, enum chips, and nested bodies, while keeping schema-builder document-model
mutations separate from property-form JSON-schema draft mutations.

The shared layer should own presentation and local micro-interactions. It should
not own schema document dispatch, property-form reducers, JSON Schema projection,
or persistence semantics.

## Non-Goals

- Do not migrate `PropertyForm` onto the schema-builder document model.
- Do not introduce compatibility shims or legacy adapters.
- Do not add decorative grip icons without an explicit affordance mode.
- Do not duplicate row, chip, or type-menu layout between schema builder and
  property form.
- Do not change JSON Schema output semantics.

## Proposed Module Shape

Use a single primitive namespace, for example:

```txt
components/schema-editor/primitives/
  schema-field-row.tsx
  schema-row-grip.tsx
  schema-inline-name.tsx
  schema-inline-description.tsx
  schema-row-actions.tsx
  schema-type-menu.tsx
  schema-add-row.tsx
  schema-chip-list.tsx
  schema-chip-input.tsx
```

The current `components/schema-editor/field-row/` files can either move into
this namespace or be expanded in place and renamed later. The important part is
that the primitive layer becomes the canonical owner of schema-editor interaction
chrome.

## Primitive Responsibilities

### `SchemaFieldRow`

Owns the row contract:

- left affordance column
- grip alignment
- row min height
- hover background
- name/description/type alignment
- action visibility rhythm
- responsive wrapping
- nested body placement
- disabled and read-only visual states

Candidate API:

```tsx
<SchemaFieldRow
  depth={1}
  grip="drag" | "static" | "empty"
  name={nameControl}
  description={descriptionControl}
  actions={rowActions}
  type={typeMenu}
>
  {nestedBody}
</SchemaFieldRow>
```

The `grip` mode is important:

- `drag`: visible grip with drag handlers.
- `static`: visible grip affordance without drag behavior.
- `empty`: reserves the same width but renders no icon.

Property form object fields can start with `static`. Schema builder rows use
`drag`. Read-only rows can use `empty` or `static`, depending on the desired
scan rhythm.

### `SchemaRowGrip`

Owns the six-dot affordance and its states:

- hidden or muted by default if needed
- visible on hover for draggable rows
- always visible for static row identity if desired
- cursor and ARIA behavior based on mode

Candidate API:

```tsx
<SchemaRowGrip
  mode="drag" | "static" | "empty"
  draggable={isEditable}
  onDragStart={...}
/>
```

This avoids every adapter recreating the `GripVertical` spacing and hover color.

### `SchemaInlineName`

Owns inline name editing:

- static text display
- click to edit
- Enter commits
- blur commits
- Escape cancels
- inline validation message
- optional reference reveal affordance

It should receive a validator rather than importing a specific model:

```tsx
<SchemaInlineName
  value={propertyName}
  editable={isEditable}
  validate={validateName}
  onCommit={renameProperty}
/>
```

The schema builder and property form can pass the same `validateName` logic but
different commit callbacks.

### `SchemaInlineDescription`

Owns inline description editing:

- muted static text
- `Add description` placeholder
- click to edit
- Enter/blur commits
- Escape cancels
- tooltip for non-empty long descriptions

Both schema-builder rows and property-form object rows should use the same
control.

### `SchemaRowActions`

Owns field action icon behavior:

- delete
- edit/view metadata
- hidden-until-hover behavior
- disabled states
- accessible labels

It should not know whether metadata opens `NodeDialog`, `PropertyForm`, or
another surface.

### `SchemaTypeMenu`

Collapse the duplicated type-menu language into one primitive with variants:

```tsx
<SchemaTypeMenu
  variant="row" | "form"
  value={typeDescriptor}
  disabled={disabled}
  definitions={definitions}
  definitionsEnabled={features.definitions}
  objectTemplatesEnabled={features.objectTemplates}
  onSelectType={...}
  onSelectDefinition={...}
  onCreateDefinition={...}
  onSelectObjectTemplate={...}
/>
```

The row variant should match the schema-builder compact type menu. The form
variant should match the full-width property-form data-type selector. These are
presentation variants of the same type menu, not separate conceptual controls.

Adapters remain responsible for translating selected menu items into their own
mutation model.

### `SchemaAddRow`

Owns add-row layout and validation display:

- indentation and left border rhythm
- input width
- placeholder
- Add button
- disabled state
- validation message
- Enter behavior

Candidate API:

```tsx
<SchemaAddRow
  depth={1}
  placeholder="New property name"
  value={draftName}
  error={nameError}
  disabled={disabled}
  onChange={setDraftName}
  onAdd={addProperty}
/>
```

The schema builder and property form should stop maintaining separate add-row
geometry.

### `SchemaChipList`

Enum values should be a shared chip/list primitive. The current property form
chip UI should become a schema-editor primitive, so future schema-builder enum
surfaces use the exact same chip language.

Candidate API:

```tsx
<SchemaChipList
  values={values}
  disabled={disabled}
  placeholder="New choice"
  addLabel="Add"
  formatValue={formatEnumValueInput}
  parseInput={parseEnumValueInput}
  validateInput={validateEnumInput}
  onAdd={addValue}
  onRemove={removeValue}
  onReplace={replaceValue}
/>
```

This primitive should own:

- chip shape
- remove affordance
- input and Add button alignment
- Enter behavior
- invalid input display
- keyboard-safe remove/edit interactions

`EnumValuesField` should become a schema-specific adapter around
`SchemaChipList`.

## Adapter Boundaries

### Schema Builder Adapter

The schema-builder adapter keeps:

- document ids
- dispatch
- document-model property edges
- drag/drop reorder handlers
- definitions reveal behavior
- object template installation into the document model
- node dialog metadata editing

It feeds the primitive layer with values and callbacks.

### Property Form Adapter

The property-form adapter keeps:

- local `ExtendedJSONSchema7` draft edits
- object property add/rename/remove/replace
- required array preservation
- order preservation
- prototype-key-safe object operations
- property-form capabilities
- command bridge for definitions/templates

It feeds the same primitive layer with values and callbacks.

## Desired Structure

```txt
schema-editor/primitives
  no schema document dispatch
  no property-form reducer
  no JSON Schema projection
  no persistence

schema builder adapter
  document model in
  schema primitives out
  dispatch callbacks

property form adapter
  JSON Schema draft in
  schema primitives out
  draft callbacks
```

## Migration Plan

1. Promote the current shared row files into a primitive namespace.
2. Add `SchemaRowGrip` and make both schema-builder rows and property-form
   object rows consume it.
3. Replace the schema-builder header row and property-form object row with
   `SchemaFieldRow`.
4. Replace both add-property controls with `SchemaAddRow`.
5. Extract the enum chips from `EnumValuesField` into `SchemaChipList`.
6. Replace `DocumentNodeTypeMenu` and `TypeField` internals with
   `SchemaTypeMenu` variants.
7. Keep the existing wrapper component names during migration so public imports
   and tests move incrementally.
8. Once both adapters consume primitives, remove duplicate layout classes from
   adapter files.

## Verification Plan

Run focused checks after each migration step:

```bash
pnpm typecheck
pnpm vitest run tests/property-form.test.tsx tests/schema-builder-architecture.test.ts
pnpm exec eslint components/schema-editor tests/property-form.test.tsx
```

Visually verify:

- `/docs/components/schema-builder`
- `/docs/components/property-form`

Specific visual checks:

- object field rows have the same grip column
- hover actions reveal consistently
- nested object indentation matches
- add-row spacing matches
- type menus align and label the same values
- enum chips match across every enum editing surface

## Acceptance Criteria

- Property-form object rows and schema-builder object rows share one row
  primitive.
- Both surfaces render the same grip affordance language.
- Both surfaces use one type-menu primitive with variants.
- Enum chips are rendered by one chip-list primitive.
- Add-property rows are rendered by one add-row primitive.
- Schema-builder and property-form state models remain separate.
- Existing property-form model guarantees remain intact: order preservation,
  required preservation, nested edits, and prototype-key-safe field names.
