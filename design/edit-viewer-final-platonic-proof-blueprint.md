# Edit Viewer Final Platonic Proof Blueprint

## Thesis

The edit viewer has reached a strong architecture. It is no longer a closed custom component, and it no longer has the worst naming ambiguity. The current shape is good enough to build on.

It is not yet perfect.

The next step should not be another conceptual rewrite. The next step should be a proof pass: remove the remaining subtle impurities, prove the runtime behavior visually, and make the internal boundaries exact enough that future contributors cannot reintroduce accidental architecture.

This blueprint also takes a position on the larger viewer-system questions raised by edit/source/OCR/email/PDF convergence:

- Do not create a deeper `EvidenceViewer` substrate yet.
- Keep `AnchoredDocumentProvider` as a primitive dependency, not a domain adapter.
- Unify registry/source harder as a packaging correctness problem, not an edit-viewer abstraction.
- Make every composed viewer follow the same provider/root/body/surface/sidebar grammar.

The deeper shared abstraction is spatial and interactional, not semantic. The semantic shape belongs to the domain viewer.

Perfection here means:

- the public API is obvious
- the provider is readable in one pass
- pure model code is truly pure
- anchored-document vocabulary is contained
- docs teach the correct mental model first
- tests prove the contracts that matter
- visual behavior is verified after the refactor

## Current State

The current good shape is:

```tsx
<EditViewerProvider result={result} sourceDocument={source} filledDocument={filled}>
  <ViewerRoot>
    <EditViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <EditViewerDocument />
      </ViewerSurface>
      <ViewerSidebar aria-label="Document fields" side="right">
        <EditViewerFields />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EditViewerProvider>
```

The easy API correctly assembles the same parts:

```tsx
<EditViewer result={result} sourceDocument={source} filledDocument={filled} />
```

The implementation already has:

- one public provider
- one easy component
- three named visual parts
- pure model functions for field projection and document target resolution
- explicit `EditViewerDocumentSource`
- controlled `mode?: EditViewerMode | null`
- content-only field panel
- focused model/render/architecture tests

This is shadcn-grade. The remaining gap is about exactness.

## Larger Viewer-System Position

The edit viewer sits near several adjacent viewers:

- sources / extraction evidence
- OCR evidence
- layout blocks
- email MIME parts
- PDF thumbnails
- split viewers

They overlap, but they do not all share the same semantic domain.

The right shared layer is not a new mega-domain called `EvidenceViewer`. The right shared layer is a small set of viewer primitives plus anchored-document interaction primitives.

### Do Not Create `EvidenceViewer` Yet

Edit, sources, OCR, and layout blocks all share this pattern:

```txt
domain items -> document anchors -> side panel selection -> document highlight/scroll
```

That similarity is real.

But it is not yet enough to justify:

```tsx
<EvidenceViewerProvider>
```

The risk is a vague substrate that knows too much:

- edit fields
- source citations
- OCR words
- extraction values
- confidence
- MIME parts
- thumbnails
- document pages
- nested documents

That would become a semantic dumping ground. It would reduce visible duplication while increasing conceptual coupling.

The correct move is:

- keep `AnchoredDocumentProvider` generic
- let each domain viewer map its own objects into anchored items
- keep each domain panel named after its real domain
- wait for multiple mature implementations before extracting a semantic substrate

If a deeper substrate is ever justified, it should be extracted from proven repetition across edit, sources, OCR, and layout blocks. It should not include email or PDF thumbnails by default.

### Anchored Document Is A Primitive Dependency

`AnchoredDocumentProvider` should stay primitive.

It owns:

- item ids
- anchors
- selected item
- active/preview item
- scroll-to-anchor behavior
- viewport targeting

It should not own:

- edit field values
- OCR text hierarchy
- source citation labels
- MIME part roles
- PDF thumbnail selection
- extraction schemas

The domain viewer provider is the adapter:

```txt
EditViewerProvider maps fields -> anchored items.
SourcesViewerProvider maps sources -> anchored items.
OcrViewerProvider maps OCR blocks -> anchored items.
LayoutBlocksProvider maps blocks -> anchored items.
```

The anchored primitive should expose neutral item vocabulary internally. Each domain provider should translate that into domain vocabulary before exposing public hooks.

Good public edit names:

- `selectedFieldKey`
- `activeFieldKey`
- `selectField`
- `previewField`

Bad public edit names:

- `selectedItemId`
- `activeItemId`
- `activateItem`
- `previewItem`

The provider is the vocabulary boundary.

### Registry/Source Should Be Unified Harder

Registry drift is a distribution correctness problem. It should not be solved by changing edit-viewer architecture.

The ideal registry posture:

- one source of truth
- generated registry payloads
- generated public payloads
- tests that fail on drift
- no manual duplicate implementation universe

If registry files are product artifacts, they must be exact. But registry exactness is orthogonal to whether edit viewer needs another abstraction.

Do not hide registry drift by adding compatibility components. Fix the generation/source-of-truth path.

### All Composed Viewers Should Share Grammar

Every composed viewer should follow the same spatial grammar:

```tsx
<DomainViewerProvider>
  <ViewerRoot>
    <DomainViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <DomainViewerDocument />
      </ViewerSurface>
      <ViewerSidebar>
        <DomainViewerSidebarContent />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</DomainViewerProvider>
```

This does not mean all viewers get fake symmetric names.

Use domain names:

- `EditViewerFields`
- `EmailPartsSidebar`
- `PdfThumbnails`
- `SourcesPanel`
- `OcrBlocksPanel`

The grammar is shared. The nouns remain precise.

### Shared vs Domain-Owned

Shared:

- `ViewerRoot`
- `ViewerHeader`
- `ViewerBody`
- `ViewerSurface`
- `ViewerSidebar`
- `ViewerSidebarTrigger`
- anchored selection/preview/scrolling
- document viewport targeting

Domain-owned:

- edit fields
- source citations
- OCR blocks/words/lines
- MIME parts
- thumbnails
- extraction values
- headers
- side-panel row models
- document target resolution

This is the central architectural stance:

```txt
Shared abstraction is spatial and interactional.
Semantic state is domain-owned.
```

## Remaining Imperfections

### 1. The Model Imports `AnchoredItem`

`edit-viewer-model.ts` currently imports `AnchoredItem` from the anchored-document primitive.

That is acceptable, but not ideal.

The model layer should be domain-pure. It should understand edit fields and bbox projection, but it should not import a viewer primitive type. The provider should be the translation point between edit domain data and anchored-document primitives.

Current conceptual leak:

```ts
createEditViewerAnchoredItems(fields): AnchoredItem[]
```

Ideal:

```ts
type EditViewerAnchorItem = {
  id: string
  anchor: EditViewerPdfAreaAnchor | null
}

createEditViewerAnchorItems(fields): EditViewerAnchorItem[]
```

Then the provider converts:

```ts
const anchoredItems = fieldProjection.anchorItems satisfies readonly AnchoredItem[]
```

or:

```ts
const anchoredItems = fieldProjection.anchorItems.map(editAnchorItemToAnchoredItem)
```

The key principle: model code emits edit-domain projection data; provider code adapts it to UI primitives.

### 2. The Provider Still Has A Dense Bridge

The provider is now readable, but `EditViewerResolvedProvider` still does a lot:

- reads `useAnchoredDocument`
- validates controlled selected field
- translates selected item ids into field keys
- creates selection callbacks
- creates overlay callback
- assembles state slices
- exposes context

This is coherent, but still dense.

The ideal is not multiple public providers. The ideal is one private bridge hook:

```ts
const selection = useEditViewerSelectionBridge({
  fieldByKey,
  selectedFieldKey,
  onSelectedFieldKeyChange,
})
```

That hook can still live in `edit-viewer-provider.tsx`. It should not become a public API.

The provider should read:

```ts
const selection = useEditViewerSelectionBridge(...)
const renderPageOverlay = useEditViewerPageOverlay(...)
const value = useEditViewerContextValue(...)
```

Only extract if the names remove real reading cost. Do not create a generic controller.

### 3. Visual Behavior Has Not Been Browser-Verified

The tests prove contracts, but they do not prove that the real UI still feels right.

The final proof needs browser verification across:

- desktop with filled output
- desktop with source/preview only
- sidebar open/closed
- field hover and click
- no source document
- error state
- mobile/narrow viewport

The verification should inspect:

- header height is stable
- sidebar trigger is visible when expected
- field rail width is usable
- field rows do not overflow
- source PDF fills the surface
- overlays align with page content
- hover highlight and selected highlight are visually distinguishable
- empty/error states are centered and readable

Automated unit tests are not enough for this final step.

### 4. Docs Are Correct But Still Sparse

The docs now teach the right order:

1. Composition
2. Easy API
3. Controlled mode
4. Controlled selection
5. Field panel disabled
6. Custom field panel
7. Data contract

That is good. The final docs should add a short import block and one explicit statement about the provider/root boundary:

```txt
Do not wrap EditViewerProvider inside ViewerRoot. The provider owns edit state;
ViewerRoot owns layout and sidebar state.
```

The docs should also make clear that `EditViewerFields` is content-only because that is the rule most likely to regress.

### 5. Accessibility Proof Is Still Indirect

Current tests cover some accessible names and state, but not the whole contract.

The final pass should explicitly test:

- default sidebar has `aria-label="Document fields"`
- sidebar trigger is absent when `fieldPanel: false`
- field rows are buttons
- selected field row exposes `aria-current="true"`
- mode control uses tabs
- detecting/filling state exposes `role="status"`
- error state exposes `role="alert"`
- search input is label-addressable
- filter buttons expose `aria-pressed`

Some of these already exist. The final pass should make the coverage intentional and grouped.

### 6. Type And Export Surface Needs A Public API Audit

The public edit viewer export surface should be small and exact:

```ts
EditViewer
EditViewerProvider
EditViewerHeader
EditViewerDocument
EditViewerFields
EditViewerToolbar
useEditViewer
useEditViewerHeader
useEditViewerDocument
useEditViewerFields
useEditViewerSelection
```

Public types should include:

```ts
EditViewerDocumentSource
EditViewerField
EditViewerInputField
EditViewerInputResult
EditViewerMode
EditViewerOptions
EditViewerProps
EditViewerResult
EditViewerStatus
EditViewerDocumentTarget
EditViewerContextValue
```

The final audit should check that no old type aliases or compatibility names remain.

Do not export:

- `EditViewerRoot`
- `EditViewerSidebar`
- `useEditViewerController`
- `EditViewerContent`
- `EditViewerAnchorItem` unless a real consumer needs it

### 7. Full System Drift Still Exists Outside Edit Viewer

Even if edit viewer is clean, the viewer system is not perfect while adjacent registry surfaces drift.

Known adjacent risks:

- email viewer registry composition still has naming drift
- public registry payloads can diverge from source
- split viewer docs may not teach composition first
- file-system has unrelated dirty work and should remain outside this effort unless explicitly owned

The edit viewer can be judged good independently, but the component library cannot be judged perfect until the whole viewer family follows the same grammar.

## Final Target Shape

### Model Layer

`edit-viewer-model.ts` should contain pure edit-domain logic:

- options resolution
- result normalization
- bbox normalization
- field filled/value display helpers
- mode derivation
- mode fallback resolution
- filtering
- grouping
- field projection
- document target resolution

It should not import React.

It should preferably not import anchored-document primitive types.

### Provider Layer

`edit-viewer-provider.tsx` should contain:

- `EditViewerProvider`
- public edit hooks
- private mode hook
- private selection bridge
- context assembly
- anchored-document provider nesting

It may import:

- `AnchoredDocumentProvider`
- `useAnchoredDocument`
- `usePdfAnchoredTarget`
- `EditFieldOverlayLayer`

It must not import:

- `ViewerRoot`
- `ViewerSidebar`
- `ViewerSurface`
- `ViewerBody`

### Part Layer

The parts should stay narrow:

- `EditViewerHeader` reads `useEditViewerHeader`
- `EditViewerDocument` reads `useEditViewerDocument`
- `EditViewerFields` reads `useEditViewerFields`

No part should recreate provider logic.

No part should own generic viewer layout except the easy API.

### Easy API

The easy API should remain boring:

```tsx
export function EditViewer({ className, ...providerProps }: EditViewerProps) {
  return (
    <EditViewerProvider {...providerProps}>
      <EditViewerRoot className={className} />
    </EditViewerProvider>
  )
}
```

`EditViewerRoot` may remain private. It should not be exported or documented.

## Implementation Plan

### Step 1: Remove Anchored Primitive Type From The Model

- Replace `AnchoredItem` import in `edit-viewer-model.ts`.
- Add local model types:

```ts
type EditViewerPdfAreaAnchor = {
  kind: "pdf-area"
  pageNumber: number
  left: number
  top: number
  width: number
  height: number
}

type EditViewerAnchorItem = {
  id: string
  anchor: EditViewerPdfAreaAnchor | null
}
```

- Rename `createEditViewerAnchoredItems` to `createEditViewerAnchorItems`.
- Convert to `AnchoredItem[]` in the provider.
- Update model and architecture tests.

### Step 2: Extract Private Selection Bridge

Inside `edit-viewer-provider.tsx`, extract:

```ts
function useEditViewerSelectionBridge(...)
```

It should return:

```ts
{
  selectedFieldKey,
  activeFieldKey,
  selectField,
  clearFieldSelection,
  previewField,
}
```

It may use anchored-document vocabulary internally. The returned object must only use edit vocabulary.

### Step 3: Extract Private Page Overlay Hook

Add:

```ts
function useEditViewerPageOverlay(...)
```

It should accept:

- `fieldsByPage`
- `mode`
- `activeFieldKey`
- `previewField`
- `selectField`

It should return:

```ts
(props: PageOverlayProps) => React.ReactNode
```

This reduces provider visual noise and keeps overlay creation explicit.

### Step 4: Strengthen Accessibility Tests

Add a focused test block in `tests/edit-viewer-render.test.tsx` for:

- sidebar label
- field row button semantics
- selected row `aria-current`
- filter `aria-pressed`
- status role
- alert role

Avoid brittle class assertions except where visual selected/hover behavior is the contract.

### Step 5: Add A Public API Architecture Test

Strengthen `tests/viewer-architecture.test.ts`:

- `edit-viewer.tsx` does not export `EditViewerRoot`
- `edit-viewer-types.ts` does not export `EditViewerDocument`
- `edit-viewer-model.ts` does not import `anchored-document-viewer`
- `edit-viewer-provider.tsx` is the only edit file importing `useAnchoredDocument`
- `EditViewerFields` does not import `ViewerSidebar`
- docs show `## Composition` before `## Easy API`
- docs do not contain `EditViewerRoot`

### Step 6: Browser Verification

Run a local viewer demo and verify:

- default filled output view
- source/preview view
- field panel open
- field panel disabled
- hover and click
- error state
- narrow viewport

Use screenshots as evidence if this is part of a PR.

## Tests And Gates

Minimum gates:

```bash
pnpm run typecheck --pretty false
pnpm exec vitest run tests/edit-viewer-model.test.ts tests/edit-viewer-render.test.tsx tests/anchored-document-viewer.test.tsx
pnpm exec vitest run tests/viewer-architecture.test.ts -t "edit viewer|anchored examples"
```

Useful broader gates:

```bash
pnpm exec vitest run tests/dropzone.test.tsx
pnpm exec vitest run tests/viewer-architecture.test.ts
```

Browser proof should be done if the UI changes visually.

## Non-Goals

Do not:

- rewrite the edit viewer again
- introduce `EvidenceViewerProvider`
- introduce a cross-domain semantic evidence substrate yet
- introduce a second provider
- introduce `EditViewerSidebar`
- export `EditViewerRoot`
- add render props for every part
- move edit behavior into `ViewerRoot`
- touch file-system unless explicitly requested
- solve email/split/registry drift as part of the edit-viewer final proof

## Definition Of Done

This final proof pass is complete when:

- model code has no React import
- model code has no anchored-document primitive import
- provider remains the only anchored-document bridge
- public API has no old controller/content/root exports
- docs teach composition before easy API
- docs include the provider/root/sidebar responsibility sentence
- accessibility contracts are directly tested
- focused edit tests pass
- typecheck passes
- edit architecture tests pass
- browser verification confirms the composed viewer still feels right

At that point, the edit viewer is close enough to the platonic target that further changes should require concrete product evidence, not abstract dissatisfaction.
