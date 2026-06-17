# DataCell JSON Table Literal Platonic Gap Blueprint

## Verdict

Not literal perfection yet.

The JSON table is strong, measured, and architecturally coherent. It has passed
the current blueprint scope before, and the current audit confirms the important
runtime shape is much cleaner than the earlier gravity-center version.

But the literal platonic ideal is stricter than "good", "fast", or even
"blueprint-complete". Literal perfection requires every file, proof, name, and
document to feel inevitable. The current component is close, but not there.

## Current Evidence

Fresh audit evidence from the current tree:

- `pnpm test tests/json-table-architecture.test.ts` passes.
- `pnpm verify:json-table-performance` passes.
- `pnpm typecheck` passes.
- `PROFILE_SERVER_MODE=existing JSON_TABLE_PROFILE_WARMUP=1 pnpm verify:json-table-performance:fresh`
  passed while the profile server was reachable.
- `PROFILE_SERVER_MODE=existing pnpm verify:json-table-accessibility:fresh`
  could not be rerun in the final audit because the profile server on port
  `3100` went down.

Source evidence:

- `SingleFileVirtualizedTable` composes `useJsonTableRowPolicy` and
  `useJsonTableViewportModel`.
- `EditableJsonTableCell` is a renderer/router; its model hook owns the branch
  selection.
- `useSingleFileTableDocumentModel` owns document projection, primitive echo
  reconciliation, and persistence patch emission.
- The read-only row patcher is isolated and diagnosed.
- The profiler reports render counts, commits, rect reads, style/layout cost,
  mounted surface counts, focus, hover, and row patch diagnostics.

## Platonic Standard

The target is not more features. The target is exactness:

- simplicity: fewer concepts, not merely smaller files
- speed: fresh proof, not saved proof alone
- completeness: states, accessibility, errors, and profiler gates
- nothing extra: no stale blueprints, no obsolete wording, no broad harness code
  that obscures the component
- modularization: one coherent responsibility per module
- high entropy: every line explains something necessary
- naming: one word per concept, one concept per word
- Flaubertian finish: the file boundary, state shape, and command name are the
  right ones, not just acceptable ones

## Gap 1. Documentation Says Two Different Things

### Problem

`design/data-cell-json-table-current-platonic-gap-blueprint.md` now says:

- "Platonic for the scope of this blueprint."
- "Nothing in this blueprint remains unproven."

Later, the same document still says:

- "This is a serious architecture. It is not yet the final form."
- "`SingleFileVirtualizedTable` Is Still The Gravity Center."
- "Architecture Proof Is Still Partly Textual."

This is not just prose drift. It weakens the design record because a reader
cannot tell whether that blueprint is a completed implementation ledger or an
active gap list.

### Target

There should be one canonical current document for each role:

- completed implementation ledger
- active literal-perfection blueprint
- historical issue ledgers

No active document should contradict itself.

### Plan

1. Convert `data-cell-json-table-current-platonic-gap-blueprint.md` into a
   completed implementation ledger, or rename/archive it as historical.
2. Keep this file as the active literal perfection blueprint.
3. Update `components/json-table/ARCHITECTURE.md` so the document reading order
   distinguishes active guidance from completed history.
4. Remove or clearly mark older blueprints whose "current" claims no longer
   describe the current architecture.

### Acceptance

- No current JSON-table blueprint contains both a success verdict and active
  "not final" issue language.
- `ARCHITECTURE.md` has one clear active blueprint path.
- Architecture tests guard the document index without freezing stale prose.

## Gap 2. The Runtime Is Modular; The Proof Harness Is Not

### Problem

The runtime modules are now reasonably bounded. The proof harness is not:

- `scripts/profile-json-table-primitive-interactions.mjs` is about 2,880 lines.
- `tests/json-table-architecture.test.ts` is about 3,055 lines.
- The profiler mixes browser control, scenario scripting, assertion logic,
  trace summaries, style experiments, repeated-run summaries, and report
  writing in one file.
- The architecture test mixes deletion guards, import graph checks, command
  guards, prose guards, artifact checks, and module-contract checks in one
  file.

These files are valuable, but they are not platonic. They are proof gravity
centers.

### Target

The proof surface should be as modular as the runtime:

```txt
profiler/
  browser-session
  profile-targets
  scenario-runner
  scenario-definitions
  report-summary
  assertions

architecture tests/
  deleted-legacy-files
  import-boundaries
  command-contracts
  module-responsibility
  profiler-contract
```

### Plan

1. Split profiler helpers into small modules without changing output shape.
2. Keep `profile-json-table-primitive-interactions.mjs` as a thin CLI wrapper.
3. Split architecture tests by responsibility or introduce local helper
   functions that make each guard read as a contract.
4. Preserve command names, report schema, and budget compatibility.
5. Add `node --check` or direct unit tests for the extracted profiler modules.

### Acceptance

- The profiler CLI reads as orchestration, not implementation.
- Scenario definitions are data-shaped and reviewable.
- Architecture guards fail with responsibility-specific messages.
- Saved and fresh performance reports remain byte-compatible where expected.

## Gap 3. Read-Only Large Rows Still Have A Deliberate Fallback

### Problem

The read-only row patcher handles scalar/boolean rows and diagnoses large
object/array rows with `shape-mismatch`.

That is honest and measured, but not perfect. The component has two read-only
scroll stories:

- default scalar rows: patched directly
- large object/array rows: fallback to React path with a diagnosed reason

This may be the correct product decision, because object/array cells own popover
state and nested value semantics. It is still a conceptual wrinkle.

### Target

Choose one of two exact policies:

1. **Narrow Patch Policy**
   - The patcher is explicitly scalar/boolean-only.
   - Object/array fallback is expected, documented, and excluded from repeated
     editable latency proof.
   - The name says the truth: scalar read-only row patcher.

2. **Complete Read-Only Patch Policy**
   - Object/array cells expose a safe patch handle for display text and retained
     popover semantics.
   - No shape fallback occurs for the large read-only profile.
   - Tests prove nested popovers do not show stale values after a patched row
     jump.

### Plan

1. Decide whether object/array read-only cells must be patchable.
2. If no, rename the patcher and diagnostics around scalar-only truth.
3. If yes, add explicit object/array patch handles rather than mutating generic
   text nodes.
4. Add a browser scenario that opens a nested read-only object after a patched
   jump and verifies the nested value is current.

### Acceptance

- No one has to infer why `shape-mismatch` is acceptable.
- Either large read-only patch fallback is gone, or it is named as an explicit
  policy.
- The performance budget and architecture docs agree on that policy.

## Gap 4. `SingleFileVirtualizedTable` Is Better, But Still Dense

### Problem

`SingleFileVirtualizedTable` no longer owns raw virtualization or row patcher
details. It still owns:

- table shell layout
- header rendering
- body rendering
- header/body scroll sync
- edit-session wiring
- row key policy
- profiler mark
- row prop fanout

This may be acceptable. It is not effortless.

### Target

The file should read as:

```txt
options
edit session
row policy
viewport model
scroll sync
render
```

No reader should need to inspect header colSpan math while trying to understand
body virtualization.

### Plan

1. Extract only if it removes a real mixed responsibility:
   - `SingleFileTableHeader` can move to its own file if header math keeps
     obscuring the table shell.
   - `useJsonTableHeaderScrollSync` can exist if scroll sync grows or gains
     tests.
2. Do not extract wrapper components just to reduce line count.
3. Keep row rendering in this file unless row prop construction moves.

### Acceptance

- `SingleFileVirtualizedTable` has no direct DOM patcher or raw virtualizer
  import.
- Header math is either local and short or owned by a header module.
- The table file can be reviewed top-to-bottom without crossing more than one
  conceptual boundary per section.

## Gap 5. Naming Is Mostly Consistent, Not Perfect

### Problem

The main vocabulary is good:

- `sourceDocument`
- `projectionDocument`
- `projectedRows`
- `visibleColumns`
- `schemaVisibleColumns`
- `isJsonEditable`
- `rowPolicy`
- `viewportModel`

The remaining drift is subtle:

- `visibleColumns` and `schemaVisibleColumns` both appear near table boundaries.
- `projectionDocument` and `currentProjectionDocument` are close but not
  identical concepts.
- `fallbackTextDataCellProps` is legitimate code, but the word `fallback`
  reads like a compatibility path unless documented.
- `readOnly` appears in type literals while `isJsonEditable` appears in runtime
  booleans.

### Target

One glossary, enforced by tests where valuable.

### Plan

1. Add a glossary section to `ARCHITECTURE.md`.
2. Decide exact names for:
   - schema-derived visible columns
   - rendered column window
   - source document
   - projection document
   - confirmed document data
   - read-only row patch fallback
3. Rename only where the gain is obvious.
4. Add architecture guards only for high-risk ambiguous terms.

### Acceptance

- The same concept does not change names across adjacent modules.
- Any remaining `fallback` name is clearly a domain fallback, not a legacy
  compatibility shim.
- Tests reject old compatibility vocabulary without rejecting useful domain
  words.

## Gap 6. Fresh Proof Depends On A Manually Available Server

### Problem

Fresh browser proof is the right standard. In this repo, policy says not to
start a dev server automatically during ad hoc work. That means a final audit
can be blocked by an unavailable `localhost:3100` server.

This is a workflow imperfection, not a component bug, but the platonic proof
story should be reproducible.

### Target

There should be one clearly documented proof path for each environment:

- **Maintainer local full proof:** starts or uses a managed server.
- **Agent/repo-policy proof:** uses an existing server only and reports
  unreachable server as external-state failure.
- **CI proof:** runs with a controlled server and stable browser.

### Plan

1. Document the three proof modes in `ARCHITECTURE.md`.
2. Keep `PROFILE_SERVER_MODE=existing` examples for agent-safe audits.
3. Keep `PROFILE_SERVER_MODE=auto` in package scripts if CI/local maintainers
   own server lifecycle.
4. Make fresh accessibility failures print the same listener diagnostics as
   fresh performance failures.

### Acceptance

- A failed fresh gate says whether the component failed or the server was not
  reachable.
- Accessibility and performance fresh gates have symmetric diagnostics.
- The blueprint never claims current fresh accessibility proof when the server
  was unavailable.

## Work Order

1. Clean the document index and stale "current" prose.
2. Decide the read-only object/array row patch policy.
3. Add the naming glossary and resolve obvious vocabulary drift.
4. Split profiler internals behind stable report output.
5. Split architecture guards by responsibility.
6. Re-run:

   ```sh
   pnpm test:json-table
   pnpm verify:json-table-performance
   pnpm typecheck
   PROFILE_SERVER_MODE=existing JSON_TABLE_PROFILE_WARMUP=1 pnpm verify:json-table-performance:fresh
   PROFILE_SERVER_MODE=existing pnpm verify:json-table-accessibility:fresh
   PROFILE_SERVER_MODE=existing JSON_TABLE_PROFILE_WARMUP=1 JSON_TABLE_PROFILE_REPEAT=3 JSON_TABLE_PROFILE_TARGETS=large JSON_TABLE_PROFILE_SCENARIOS=open-enum,open-date,switch-dirty-cell,open-far-enum,open-far-date,commit-far-text pnpm verify:json-table-performance:fresh
   ```

## Final Acceptance

The JSON table reaches literal platonic status only when:

- the active blueprint set has no stale contradictions
- runtime modules are small because responsibilities are exact, not because code
  was mechanically split
- proof modules are also modular
- read-only row patch fallback is either removed or named as an intentional
  scalar-only policy
- fresh performance, repeated large performance, and fresh accessibility all
  pass against the current source tree
- the architecture document contains the current glossary and proof modes
- no line exists only to preserve history, compatibility, or explanation that
  should instead be encoded in a better boundary
