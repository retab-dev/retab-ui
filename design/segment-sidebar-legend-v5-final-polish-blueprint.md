# Segment Sidebar / Legend V5 Final Polish Blueprint

## Purpose

This blueprint defines the final pass required before the segment sidebar,
legend, timeline, ribbon, and interaction system can reasonably be called
complete.

V4 made the implementation strong:

- shared `SegmentInteraction`
- highlighted vocabulary instead of active vocabulary
- controlled and uncontrolled interaction hooks share one construction path
- timeline page derivation is explicit
- overlap behavior is tested
- browser smoke check passes

V5 is smaller. It exists to remove the last places where wording, naming, or
diff hygiene still feels less than inevitable.

## Standard

The final component system should have:

- one vocabulary
- one interaction model
- one naming style
- exact callback language
- no historical terms
- no unnecessary lookup asymmetry
- no unrelated generated-diff noise caused by this work

If a line does not clarify behavior or reduce ambiguity, it should not be there.

## Remaining Imperfections

### Timeline Vocabulary

`PageTimeline` still has language that is correct but not perfectly aligned:

- `pageOwners` imported as `buildPageOwners`
- comments use "owns"
- comments use "raises"

The domain helper may remain named `pageOwners` in `segments.ts` if renaming it
would create churn outside this component. Inside `PageTimeline`, prefer neutral
segment-index language.

### Timeline Lookup Symmetry

`PageTimeline` builds `segmentByIndex`, but highlighted lookup still uses:

```ts
segments.find((segment) => segment.id === highlightedSegmentId)?.index
```

This is fine at runtime, but not perfectly symmetrical. Build a
`segmentIndexById` map once and use it for highlighted lookup.

### Sidebar Callback Wording

Sidebar docs still use looser language:

```md
Fired on click — e.g. to jump the document to the segment's first page.
```

The final wording should match the system contract:

```md
Fired when a segment is clicked, after shared selection is requested.
```

The component comment can still mention scrolling as an example, but the prop
table should describe the callback precisely.

### Registry Diff Hygiene

The current worktree has unrelated registry changes. V5 should avoid creating
additional registry formatting churn.

If registry generation rewrites `registry.json` or `public/r/registry.json`
broadly, normalize formatting back to the existing stable style while preserving
all parsed content. Do not revert unrelated parsed registry changes.

## Non-Goals

- Do not rename `Segment[]`.
- Do not rename public `SegmentInteraction` fields.
- Do not change visual design.
- Do not add component props.
- Do not change current-page behavior.
- Do not fix unrelated registry entries.
- Do not fix unrelated dirty worktree files.

## Implementation Plan

### 1. Clean Timeline Vocabulary

In `registry/new-york-v4/ui/page-timeline.tsx`:

- Rename the import alias:

```ts
import { pageOwners as buildPageSegmentIndexes } from "@/lib/segments"
```

- Rename local variables:

```ts
const segmentIndexesByPage = React.useMemo(
  () => buildPageSegmentIndexes(segments),
  [segments]
)
```

- Update comments:

From:

```ts
A horizontal strip of page cells colored by the segment that owns each page.
It ties the legend and sidebar to the document: hovering a cell raises its
segment...
```

To:

```ts
A horizontal strip of page cells colored by the segment mapped to each page.
It ties the legend and sidebar to the document: hovering a cell highlights its
segment...
```

Avoid "owner", "owns", "raises", and "active" in this file unless quoting an
external API.

### 2. Add Symmetric Highlight Lookup

In `PageTimeline`, build:

```ts
const segmentIndexById = React.useMemo(
  () => buildSegmentIndexById(segments),
  [segments]
)
```

Add:

```ts
function buildSegmentIndexById(segments: Segment[]): Map<string, number> {
  const map = new Map<string, number>()
  segments.forEach((segment) => map.set(segment.id, segment.index))
  return map
}
```

Replace `getHighlightedSegmentIndex` with:

```ts
function getHighlightedSegmentIndex({
  highlightedSegmentId,
  segmentIndexById,
}: {
  highlightedSegmentId: string | null
  segmentIndexById: Map<string, number>
}): number | undefined {
  return highlightedSegmentId
    ? segmentIndexById.get(highlightedSegmentId)
    : undefined
}
```

This matches the existing `segmentByIndex` lookup pattern.

### 3. Tighten Sidebar Docs

In `content/docs/components/sidebar.mdx`, update the `onSelect` row:

```md
| `onSelect` | `(segment: Segment) => void` | Fired when a segment is clicked, after shared selection is requested. |
```

If the source prop comment is too vague, update it too:

```ts
/** Fired when a segment surface is clicked, after shared selection is requested. */
onSelect?: (segment: Segment) => void
```

### 4. Rebuild Generated Registry Artifacts

Run:

```bash
./node_modules/.bin/shadcn build --output public/r
```

Then inspect:

```bash
git diff --stat -- registry.json public/r/registry.json
```

If the diff is broad formatting-only noise, normalize JSON formatting while
preserving parsed content:

```bash
node - <<'NODE'
const fs = require("fs")
for (const file of ["registry.json", "public/r/registry.json"]) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"))
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n")
}
NODE
```

Do not delete unrelated parsed registry entries.

## Tests

Existing tests should continue to pass. Add no new tests unless the refactor
changes behavior.

The current test suite already covers:

- highlighted resolution
- persistent selection
- caller-owned interaction
- controlled clearing
- empty timeline page click
- single page label
- overlapping page label
- overlapping primary selection
- no dimming for shared overlapping ownership
- ribbon selection
- shared document viewer selection

If any test name still uses old vocabulary, rename it.

## Verification

Run:

```bash
./node_modules/.bin/vitest run tests/segment-surfaces.test.tsx
./node_modules/.bin/eslint registry/new-york-v4/lib/segment-interaction.ts registry/new-york-v4/ui/use-segment-interaction.ts registry/new-york-v4/ui/segment-legend.tsx registry/new-york-v4/ui/segment-sidebar.tsx registry/new-york-v4/ui/page-timeline.tsx registry/new-york-v4/ui/page-ribbon.tsx registry/new-york-v4/ui/segmented-document-viewer.tsx tests/segment-surfaces.test.tsx
./node_modules/.bin/shadcn registry validate
./node_modules/.bin/tsc --noEmit --pretty false --incremental false 2>&1 | rg "(segment-interaction|use-segment-interaction|segment-legend|segment-sidebar|page-ribbon|page-timeline|segmented-document-viewer|segment-surfaces)"
rg -n "active|Active|data-active|isActive|resolveActive|owner|owners|owns|raises|onActivate|onSelectSegment|defaultSelectedId|onSelectedIdChange|selectedId\\?:" registry/new-york-v4/lib/segment-interaction.ts registry/new-york-v4/ui/use-segment-interaction.ts registry/new-york-v4/ui/segment-legend.tsx registry/new-york-v4/ui/segment-sidebar.tsx registry/new-york-v4/ui/page-timeline.tsx registry/new-york-v4/ui/page-ribbon.tsx registry/new-york-v4/ui/segmented-document-viewer.tsx tests/segment-surfaces.test.tsx content/docs/components/legend.mdx content/docs/components/sidebar.mdx public/r/segment-interaction.json public/r/use-segment-interaction.json public/r/segment-legend.json public/r/segment-sidebar.json public/r/page-timeline.json public/r/page-ribbon.json public/r/segmented-document-viewer.json
```

The final `rg` command should return no matches.

Browser smoke check:

- Start the docs app on an open port.
- Visit `/docs/components/legend`.
- Visit `/docs/components/sidebar`.
- Confirm:
  - docs pages render
  - segment surfaces contain `data-highlighted`
  - segment surfaces contain no scoped `data-active`
  - browser console has no errors

Stop the dev server after verification.

## Completion Criteria

V5 is complete when:

- `PageTimeline` has no owner/raise/active vocabulary
- highlighted lookup uses `segmentIndexById`
- sidebar callback wording matches the rest of the system
- generated segment artifacts match source
- validation passes
- browser smoke check passes
- registry JSON diffs contain no avoidable formatting-only churn introduced by
  this pass

At that point, any remaining imperfection is outside the segment sidebar/legend
component system rather than inside it.
