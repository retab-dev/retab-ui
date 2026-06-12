# Schema editor: the Document model

This module is the source-of-truth layer for the JSON Schema editor. It exists to
make editing **lossless** and **identity-stable** while keeping vanilla
`JSONSchema7` as the only I/O format.

## The core idea

> The editor's value is a **Document**, not a JSON Schema string.
> JSON Schema is a wire format — imported once, projected back out on demand.

This mirrors how rich-text editors work: ProseMirror/Slate don't make their state
an HTML string, because HTML can't represent a cursor, identity, or a transiently
invalid selection. JSON Schema has the same problem for a schema editor — it can't
represent a property's stable identity or a half-typed key. So we don't store it;
we store a Document and treat JSON Schema as a projection.

```
JSONSchema7  --fromJsonSchema (once)-->  SchemaDocument  --toJsonSchema (on change)-->  JSONSchema7
                                          (the useState)
```

## Why this avoids lossy round-trips

Lossiness comes from having two representations and a **non-total** translation
between them. The old editor parsed JSON Schema into view-models that didn't model
every keyword, so anything it didn't understand (`pattern`, `format`, `x-*`) was
dropped on the next write.

Here the translation is **total**: every keyword a node doesn't model
structurally is carried verbatim in `node.rest` and projected straight back out.
Editing always spreads the node (`{ ...node, description }`), so unknown keywords
ride along untouched.

## The four invariants

1. **Identity is intrinsic.** Every node has an `id`, minted once at creation or
   import, stable across renames/reorders/retypes, dead when the node is deleted.
   Never derived from a key or a path. This is why renaming a property key never
   remounts its input (the React key is the node id, not the property name).

2. **Order is explicit.** `properties` and `$defs` are ordered arrays of entries,
   not JS object maps — reordering is `arrayMove`, never dependent on key order.

3. **References are by id, not name.** A `$ref` resolves to a definition's `id` on
   import. Renaming a definition therefore cannot break a reference; the
   `#/$defs/Name` pointer is re-derived from the def's current name on export.
   (Verified: rename `Money` → `Amount` and the ref becomes `#/$defs/Amount`.)

4. **Transient-invalid lives in the Document, cleanup lives at the boundary.**
   Empty or duplicate property keys are valid mid-edit and held in the Document;
   `toJsonSchema` drops them. This is what lets the component be fully _controlled_
   over the Document — there's no private editing state to hide.

## What "controlled" means here

Because the Document is a total model, the component is fully controlled over it
(`value` / `onValueChange`), with the standard optional `defaultValue` wrapper.
The old controlled-vs-uncontrolled tension came from JSON Schema being too lossy
to round-trip per keystroke; over the Document, that tension is gone. Consumers
who want JSON Schema get it via a derived `onSchemaChange(toJsonSchema(doc))`.

## File map

| File                       | Responsibility                                                       |
| -------------------------- | -------------------------------------------------------------------- |
| `types.ts`                 | The Document model (`SchemaDocument`, `DocumentNode`, …).            |
| `id.ts`                    | Intrinsic id minting.                                                |
| `convert.ts`               | `fromJsonSchema` (total import) / `toJsonSchema` (projection).       |
| `array.ts`                 | Reference-preserving array mapping.                                  |
| `traversal.ts`             | Recursive child traversal, id lookup, and path lookup.               |
| `node-update.ts`           | Immutable node replacement and `rest` patching.                      |
| `node-metadata.ts`         | Title/description edits and bulk description removal.                |
| `json-node.ts`             | JSON Schema subtree read/replace/update bridge.                      |
| `node-selectors.ts`        | Effective-node, child-node, child-property, and item selectors.      |
| `property-operations.ts`   | Property-edge edits (`add`, `remove`, `rename`, `required`, `move`). |
| `type-operations.ts`       | Type, nullability, editor-type, and factory operations.              |
| `enum-operations.ts`       | Enum row edits.                                                      |
| `definition-operations.ts` | `$defs` and `$ref` edits.                                            |
| `derive.ts`                | Pure render-time projections (`getEffectiveKind`, `isNullable`).     |

## Known v1 simplifications

- Export normalizes key order (semantics preserved, not byte layout). `$defs`
  emits last. Original key order is recoverable later by stamping an order hint if
  byte-fidelity is ever required.
- Tuple `items` (array form), nested `$defs`, and `patternProperties` are carried
  in `rest` rather than modeled structurally — lossless, just not yet editable in
  the UI.
- Nullable is normalized to the `type: [..., "null"]` encoding on export, even if
  the source used `anyOf: [..., { type: "null" }]`.

## The layer above

- `use-schema-builder-state.ts` — the controlled hook that bridges the public
  vanilla-`JSONSchema7` surface to this Document (holds the Document as the
  truth; re-imports only on a genuine external change, not on its own echo).
- `schema-builder.tsx` — the editor UI: object tables, nested object/array/enum
  editors, nullable/required toggles, native-DnD reorder, and an editable `$defs`
  section with id-based `$ref`. A single `update` dispatcher is threaded through
  the tree (extend's lifted-state pattern), with the operations here doing the work.
- Wired into `registry/new-york-v4/ui/schema-builder.tsx` (`SchemaBuilder`) and the
  `RetabSchemaBuilderDemo`.

## Context Retirement

The old `contexts/json-schema.tsx` provider layer has been retired. Public
`SchemaBuilder` usage now enters through `useSchemaBuilderState`, while
document-backed editors receive explicit `doc` and `dispatch` props. Draft
property editing uses `PropertyForm` with local drafts and commit callbacks
instead of reaching into builder context.
