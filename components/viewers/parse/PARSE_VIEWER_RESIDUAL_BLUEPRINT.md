# Parse Viewer Residual Blueprint

This blueprint covers the remaining real imperfections in the page-markdown
viewer. Line-count budgets are intentionally excluded; correctness, naming,
dependency direction, and verifiable behavior are the standard.

## Goal

Reach a component shape where:

- sibling pane modules do not import from each other
- shared DOM helpers live in a neutral module
- generic modules use generic language
- the viewer can be visually verified once unrelated docs build errors are fixed

## Current Residual Issues

### 1. Pane Dependency Direction

`page-markdown-document-pane.tsx` imports `scrollViewportToPage` from
`page-markdown-pane.tsx`.

That is the wrong dependency direction. The document pane and markdown pane are
sibling modules. Shared DOM behavior should live below both.

Target:

```txt
page-markdown-pane.tsx
page-markdown-document-pane.tsx
  -> page-markdown-dom.ts
```

Create:

```ts
// page-markdown-dom.ts
export function scrollPageIntoView(root: HTMLElement | null, page: number): void
```

Then:

- `PageMarkdownPane` uses `scrollPageIntoView(viewportRef.current, page)`
- `PageMarkdownDocumentPane` uses `scrollPageIntoView(documentPaneRef.current, page)`
- `page-markdown-pane.tsx` no longer exports DOM helpers

### 2. Empty-State Language

`PageMarkdownEmptyState` currently says:

```txt
Parsing document...
```

That is too parse-specific for a generic page-markdown renderer. The primitive
should not assume how pages are produced.

Target copy:

```txt
Preparing document...
```

or expose an optional prop:

```ts
processingLabel?: string
```

Preferred implementation:

- `PageMarkdownViewer` accepts `processingLabel?: string`
- default is `Preparing document...`
- `ParseViewer` passes `Parsing document...`

This keeps the generic primitive generic while preserving parse-specific copy in
the parse adapter.

### 3. Empty-State Ownership

`PageMarkdownEmptyState` is correct as a separate module, but its props should
be explicit enough for the adapter to specialize text without changing the
primitive.

Target:

```ts
interface PageMarkdownEmptyStateProps {
  isProcessing: boolean
  processingLabel: string
}
```

No hidden parse vocabulary in the generic module.

### 4. Browser Verification

The docs route could not be visually verified because unrelated dirty-worktree
errors currently break the docs app.

Known blockers seen during the last attempt:

- missing `@/components/schema-editor/property-form/reducer`
- missing property-form field modules
- missing `@/registry/new-york-v4/lib/csv`
- file-viewer export mismatches around `lruGet` / `lruSet`

Once those are fixed, verify:

- desktop docs page at `/docs/viewers/parse-viewer`
- narrow split-pane toolbar
- Rendered/Text toggle
- zoom controls
- copy/download actions or compact menu
- source/markdown page sync

## Implementation Steps

1. Add `components/viewers/page-markdown/page-markdown-dom.ts`.
2. Move `scrollViewportToPage` into that file as `scrollPageIntoView`.
3. Update `page-markdown-pane.tsx` and `page-markdown-document-pane.tsx`.
4. Remove the helper export from `page-markdown-pane.tsx`.
5. Add `processingLabel?: string` to `PageMarkdownViewerProps`.
6. Pass `processingLabel` from `PageMarkdownViewer` to `PageMarkdownEmptyState`.
7. Set the generic default to `Preparing document...`.
8. Set `ParseViewer` to pass `Parsing document...`.
9. Add/adjust tests for the generic and parse-specific processing labels.
10. Add `page-markdown-dom.ts` to `registry.json`.
11. Rebuild registry output.
12. Run scoped lint, tests, and targeted typecheck scan.

## Tests To Add Or Update

Add a DOM-helper test:

```ts
scrollPageIntoView(root, 3)
```

Assert it calls `scrollIntoView` on `[data-page-number="3"]`.

Update render tests:

- `PageMarkdownViewer` processing state shows `Preparing document...`
- `ParseViewer` passes `Parsing document...` to the primitive

## Done Criteria

- No sibling pane imports another pane module.
- No parse-specific language remains in `components/viewers/page-markdown`.
- Shared DOM page scrolling is in `page-markdown-dom.ts`.
- Registry includes the new DOM helper file.
- Focused tests pass.
- Targeted typecheck scan has no parse/page-markdown output.
- Browser visual verification is performed after unrelated docs build blockers
  are resolved.
