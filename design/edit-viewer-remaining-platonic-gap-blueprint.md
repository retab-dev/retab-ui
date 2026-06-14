# Edit Viewer Remaining Platonic Gap Blueprint

## Thesis

The edit viewer has crossed the important architectural threshold: it is no longer a closed monolith. It now has a provider, narrow hooks, named parts, and an easy API assembled from the same parts.

That is good design. It is not yet perfection.

Perfection for this component means the final shape feels inevitable:

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

The current implementation expresses that grammar, but some internal boundaries are still heavier than they need to be. The next cut should not add new abstractions. It should make the existing boundaries smaller, sharper, and more exact.

## Current Judgment

The current edit viewer is directionally correct.

The strong parts are:

- `EditViewer` is an assembled easy API, not the conceptual center.
- `EditViewerProvider` owns edit state.
- `ViewerRoot` owns viewer layout and sidebar state.
- `EditViewerHeader`, `EditViewerDocument`, and `EditViewerFields` are public named parts.
- `EditViewerFields` is content-only and does not render its own sidebar.
- `EditViewerDocument` delegates rendering to `EditViewerDocumentPane`.
- The old broad `useEditViewerController` was removed.
- The architecture is protected by render tests, anchored-document tests, typecheck, and focused architecture tests.

The remaining imperfection is not about the public grammar. The grammar is right. The remaining imperfection is mostly about internal precision.

## What Perfection Requires

The edit viewer should satisfy five tests:

1. A consumer can understand the public API in one glance.
2. A maintainer can locate each responsibility without following a long chain of derived state.
3. Every exported hook returns the smallest useful state for one visual part.
4. No data type and component name create avoidable ambiguity.
5. The easy API is visibly identical to the documented composed API.

The current implementation passes most of this. It falls short on internal density, naming exactness, and proof coverage.

## Current Remaining Issues

### 1. `EditViewerProvider` Is Coherent But Too Dense

The provider currently owns:

- result normalization
- option resolution
- field map creation
- located/unlocated field derivation
- field filtering
- field grouping
- filled count
- mode derivation
- uncontrolled mode state
- controlled mode reconciliation
- anchored item projection
- anchored-document provider composition
- selected-field synchronization
- selected-field validation
- field selection callbacks
- field hover callbacks
- PDF overlay rendering
- document target resolution
- public context assembly

This is coherent because all of those are edit-domain concerns. But the provider is doing too many transformations inline.

The ideal provider should read like a composition of named domain projections:

```ts
const edit = useEditViewerModel(input)
const anchors = useEditViewerAnchors(edit)
const selection = useEditViewerSelectionBridge(input, edit, anchors)
const document = useEditViewerDocumentTarget(input, edit)
const parts = useEditViewerParts(edit, selection, document)
```

That does not mean creating a clever architecture. It means extracting only the projections that already exist conceptually.

The provider should remain the public owner. The internal helpers should make it smaller, not introduce a second public architecture.

### 2. Component/Data Naming Is Slightly Ambiguous

There is both:

- `EditViewerDocument` component
- `EditViewerDocument` data type

TypeScript allows value and type exports with the same name, but the reader pays a small tax.

This is not catastrophic. It is not perfect.

The better naming split is:

```ts
type EditViewerDocumentSource = {
  name?: string
  type?: string
  size?: number
  url?: string
  data?: ArrayBuffer | Uint8Array
}
```

And:

```tsx
function EditViewerDocument(...)
```

This keeps the visible component name clean while making the data object more precise. The word `Source` also matches the fact that this object is an input document handle, not the rendered document part.

If that rename is too wide for the next cut, the minimum improvement is:

- keep the component named `EditViewerDocument`
- alias the imported type internally as `EditViewerDocumentSource`
- do not expose new ambiguous examples in docs

The ideal final state should rename the type.

### 3. Selection Semantics Need A Sharper Contract

The provider bridges edit fields into `AnchoredDocumentProvider`.

The current selection vocabulary is:

- `selectedFieldKey`
- `activeFieldKey`
- `selectField`
- `previewField`
- `clearFieldSelection`

This is mostly right. The weak point is that `activeFieldKey` is the anchored active item, which can mean selected-or-previewed depending on the anchored-document internals.

The ideal contract should define the terms explicitly:

- `selectedFieldKey`: committed selected field.
- `previewFieldKey`: transient hovered field, if the anchored provider exposes it.
- `activeFieldKey`: the visual highlight key used by overlays and field rows.

If `AnchoredDocumentProvider` only exposes active and selected, then edit viewer should document that:

- `activeFieldKey` is the display key.
- `selectedFieldKey` is the committed key.
- hover updates `activeFieldKey` but does not call `onSelectedFieldKeyChange`.

Tests should protect this:

- clicking a field commits `selectedFieldKey`.
- hovering a field previews without committing.
- leaving hover restores the committed visual key.
- invalid controlled `selectedFieldKey` clears selection once and does not loop.

Some of this is already tested. The exact contract should be written down in the provider types and docs.

### 4. Controlled Mode Semantics Need Exact Wording

Current behavior:

- valid controlled `mode` wins.
- invalid controlled `mode` falls back to the best available mode.
- fallback does not call `onModeChange`.

That is a good pragmatic behavior. It should become an explicit contract.

The ideal contract:

```ts
mode?: EditViewerMode | null
onModeChange?: (mode: EditViewerMode) => void
```

Rules:

- `undefined` means uncontrolled.
- `null` means caller requests no mode, but the viewer may still resolve a display mode if output exists.
- unavailable values are ignored for rendering and never echoed through `onModeChange`.
- `onModeChange` fires only for user-initiated mode changes.

The current `mode?: EditViewerMode` type may be too weak because the implementation already treats `null` as meaningful. The type should either accept `null` intentionally or the implementation should stop accepting it. The better final shape is to accept `null` explicitly because `selectedFieldKey` already uses that controlled-null pattern.

### 5. Document Target Resolution Should Be A Named Pure Model

The provider currently resolves:

- error state
- empty state
- source document
- preview document
- filled document

The target union is good:

```ts
type EditViewerDocumentTarget =
  | { kind: "error"; message: string }
  | { kind: "empty"; message: string }
  | { kind: "source"; document: EditViewerDocumentSource; showOverlay: false }
  | { kind: "preview"; document: EditViewerDocumentSource; showOverlay: true }
  | { kind: "filled"; document: EditViewerDocumentSource; showOverlay: false }
```

But this should live as a pure model function next to mode derivation, not at the bottom of the provider.

Move it to `edit-viewer-model.ts` or a small `edit-viewer-document-model.ts` if `edit-viewer-model.ts` becomes too broad.

The preferred cut:

- keep `normalizeEditViewerResult`, field filtering, and field grouping in `edit-viewer-model.ts`
- add `resolveEditViewerDocumentTarget` there
- test it in `edit-viewer-model.test.ts`

Do not create a new module unless the model file becomes genuinely hard to scan.

### 6. Field-Derived State Should Be A Single Projection

The provider currently computes many field projections separately:

- `fieldsByPage`
- `fieldByKey`
- `anchoredItems`
- `filledCount`
- `visibleFields`
- `fieldGroups`
- `locatedFields`
- `unlocatedFields`

These values are all deterministic projections of:

- normalized fields
- query
- filter

The ideal shape is one named projection:

```ts
type EditViewerFieldProjection = {
  fields: readonly EditViewerField[]
  fieldByKey: ReadonlyMap<string, EditViewerField>
  fieldsByPage: ReadonlyMap<number, readonly EditViewerField[]>
  anchoredItems: readonly AnchoredItem[]
  locatedFields: readonly EditViewerField[]
  unlocatedFields: readonly EditViewerField[]
  visibleFields: readonly EditViewerField[]
  fieldGroups: readonly EditViewerFieldGroup[]
  fieldCount: number
  visibleFieldCount: number
  filledCount: number
}
```

The provider should call:

```ts
const fieldProjection = React.useMemo(
  () => createEditViewerFieldProjection({ fields, query, filter }),
  [fields, query, filter]
)
```

This improves readability and reduces dependency-array noise.

It also makes the model testable without rendering React.

### 7. Anchor Projection Should Be Owned By Edit, Not Hidden In JSX

The current implementation correctly converts fields to anchored items before rendering `AnchoredDocumentProvider`.

The ideal boundary:

- edit fields own bbox semantics
- anchored document owns item navigation
- PDF viewer owns page coordinate rendering

Therefore `editFieldToAnchoredItem` should remain an edit-domain helper, but it should not be buried in the provider file if the provider stays large.

The final location can be:

- `edit-viewer-model.ts` if it stays small enough
- `edit-viewer-anchor-model.ts` if separating anchor projection makes the provider clearer

The helper name should be exact:

```ts
createEditViewerAnchoredItems(fields)
```

Avoid:

- `mapFields`
- `buildAnchors`
- `getItems`

The helper should encode the 1-based page and percentage conversion contract in one place.

### 8. The Public Hook Surface Is Good But Needs Discipline

The current public hooks are the right family:

- `useEditViewer`
- `useEditViewerHeader`
- `useEditViewerDocument`
- `useEditViewerFields`
- `useEditViewerSelection`

The rule should be:

- `useEditViewer` is the full escape hatch.
- named part hooks are narrow and stable.
- named parts should consume their matching hook.
- easy API should consume named parts, not broad controller internals.

Do not add:

- `useEditViewerSidebar`
- `useEditViewerSurface`
- `useEditViewerRoot`
- `useEditViewerToolbar` unless toolbar customization becomes a concrete need

The toolbar is part of the header. It should stay controlled by `useEditViewerHeader`.

### 9. `EditViewerFields` Should Stay Content-Only

This is a key success and must not regress.

Correct:

```tsx
<ViewerSidebar aria-label="Document fields">
  <EditViewerFields />
</ViewerSidebar>
```

Wrong:

```tsx
<EditViewerFieldsSidebar />
```

Wrong:

```tsx
<EditViewerFields>
  <ViewerSidebar />
</EditViewerFields>
```

The field list is content. Sidebar placement is viewer layout.

This should stay protected by architecture tests:

- `EditViewerFields` does not import `ViewerSidebar`.
- `EditViewerFields` does not render `aside`.
- `EditViewerFieldPanel` does not import edit context.
- easy `EditViewer` is the only place where default sidebar placement is assembled.

### 10. The Easy API Should Stay Boring

The easy API should remain exactly this kind of code:

```tsx
export function EditViewer({ className, ...providerProps }: EditViewerProps) {
  return (
    <EditViewerProvider {...providerProps}>
      <EditViewerRoot className={className} />
    </EditViewerProvider>
  )
}
```

And `EditViewerRoot` should remain a visible composition of public parts:

```tsx
<ViewerRoot>
  <EditViewerHeader />
  <ViewerBody>
    <ViewerSurface>
      <EditViewerDocument />
    </ViewerSurface>
    <ViewerSidebar>
      <EditViewerFields />
    </ViewerSidebar>
  </ViewerBody>
</ViewerRoot>
```

No hidden layout controller should return this tree.

No slot object should describe this tree.

No render props should be added for header/sidebar/document unless there is a concrete consumer with a real need.

The composed API already gives consumers that control.

## Proposed Final Internal Shape

The ideal file structure:

```txt
components/viewers/edit/
  edit-viewer.tsx
  edit-viewer-provider.tsx
  edit-viewer-header.tsx
  edit-viewer-document.tsx
  edit-viewer-fields.tsx
  edit-viewer-document-pane.tsx
  edit-viewer-field-panel.tsx
  edit-viewer-toolbar.tsx
  edit-viewer-overlays.tsx
  edit-viewer-model.ts
  edit-viewer-types.ts
  edit-viewer-field-style.ts
```

This is already close.

The main remaining question is whether to add one extra internal model file.

Default answer: no.

Only add:

```txt
edit-viewer-anchor-model.ts
```

if `edit-viewer-model.ts` becomes too broad after moving document target and field projection logic into it.

Do not create:

```txt
edit-viewer-state.ts
edit-viewer-controller.ts
edit-viewer-context.ts
edit-viewer-selectors.ts
edit-viewer-hooks.ts
```

Those names are generic and would dilute the current clarity.

## Proposed Final Types

### Input Document

Rename the data type from `EditViewerDocument` to:

```ts
export interface EditViewerDocumentSource {
  name?: string
  type?: string
  size?: number
  url?: string
  data?: ArrayBuffer | Uint8Array
}
```

Then:

```ts
export interface EditViewerProps {
  result: EditViewerInputResult | null
  sourceDocument?: EditViewerDocumentSource | null
  filledDocument?: EditViewerDocumentSource | null
  mode?: EditViewerMode | null
  onModeChange?: (mode: EditViewerMode) => void
  selectedFieldKey?: string | null
  onSelectedFieldKeyChange?: (key: string | null) => void
  status?: EditViewerStatus
  className?: string
  options?: EditViewerOptions
}
```

This removes the component/type name ambiguity.

### Field Projection

Add:

```ts
export type EditViewerFieldProjection = {
  fields: readonly EditViewerField[]
  fieldByKey: ReadonlyMap<string, EditViewerField>
  fieldsByPage: ReadonlyMap<number, readonly EditViewerField[]>
  anchoredItems: readonly AnchoredItem[]
  locatedFields: readonly EditViewerField[]
  unlocatedFields: readonly EditViewerField[]
  visibleFields: readonly EditViewerField[]
  fieldGroups: readonly EditViewerFieldGroup[]
  fieldCount: number
  visibleFieldCount: number
  filledCount: number
}
```

The one concern: `AnchoredItem` lives in the anchored-document package. If importing it into `edit-viewer-model.ts` makes the model too UI-aware, use a local projection type:

```ts
type EditViewerAnchorItem = {
  id: string
  anchor: PdfAreaAnchor | null
}
```

Then convert to `AnchoredItem` in the provider. But if `AnchoredItem` is already a pure data type, importing it is acceptable.

The principle is simple: avoid dragging React into model files.

### Document Target

Add:

```ts
export type EditViewerDocumentTarget =
  | { kind: "error"; message: string }
  | { kind: "empty"; message: string }
  | {
      kind: "source"
      document: EditViewerDocumentSource
      showOverlay: false
    }
  | {
      kind: "preview"
      document: EditViewerDocumentSource
      showOverlay: true
    }
  | {
      kind: "filled"
      document: EditViewerDocumentSource
      showOverlay: false
    }
```

This target should be pure model state, not provider-only state.

## Proposed Final Provider Shape

The provider should become shorter and more declarative:

```tsx
export function EditViewerProvider({
  result,
  sourceDocument = null,
  filledDocument = null,
  mode,
  onModeChange,
  selectedFieldKey,
  onSelectedFieldKeyChange,
  status = { state: "idle" },
  options,
  children,
}: EditViewerProviderProps) {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const target = usePdfAnchoredTarget(viewerRef)
  const resolvedOptions = React.useMemo(
    () => resolveEditViewerOptions(options),
    [options]
  )
  const normalizedResult = React.useMemo(
    () => normalizeEditViewerResult(result),
    [result]
  )
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<EditViewerFilter>("all")
  const fieldProjection = React.useMemo(
    () =>
      createEditViewerFieldProjection({
        fields: normalizedResult.fields,
        query,
        filter,
      }),
    [filter, normalizedResult.fields, query]
  )
  const modeState = useEditViewerModeState({
    fields: fieldProjection.fields,
    sourceDocument,
    filledDocument,
    options: resolvedOptions,
    mode,
    onModeChange,
  })
  const documentTarget = React.useMemo(
    () =>
      resolveEditViewerDocumentTarget({
        filledDocument,
        mode: modeState.mode,
        sourceDocument,
        status,
      }),
    [filledDocument, modeState.mode, sourceDocument, status]
  )

  return (
    <AnchoredDocumentProvider
      items={fieldProjection.anchoredItems}
      target={target}
      initialItemId={selectedFieldKey}
    >
      <EditViewerResolvedProvider ... />
    </AnchoredDocumentProvider>
  )
}
```

This is not about hiding complexity. It is about making the provider read in the same order as the domain:

1. normalize input
2. project fields
3. resolve modes
4. resolve document
5. bridge anchors
6. expose parts

## Provider Splitting Rule

Do not split the public provider.

There should be one edit provider:

```tsx
<EditViewerProvider>
```

Not:

```tsx
<EditViewerModelProvider>
  <EditViewerSelectionProvider>
    <EditViewerDocumentProvider>
```

Nested public providers would make the consumer API worse.

Internal helper hooks are fine if they are private and make the provider easier to read.

## Relationship To `AnchoredDocumentProvider`

`AnchoredDocumentProvider` should remain an internal dependency of `EditViewerProvider`.

Consumers should not need to write:

```tsx
<AnchoredDocumentProvider>
  <EditViewerProvider>
```

The edit viewer knows that edit fields can map to document anchors. That is domain behavior. It belongs inside `EditViewerProvider`.

However, `EditViewerProvider` should not leak anchored-document vocabulary into its public API.

Good public names:

- `selectedFieldKey`
- `activeFieldKey`
- `selectField`
- `previewField`

Bad public names:

- `selectedItemId`
- `activeItemId`
- `activateItem`
- `previewItem`

The provider is the translation boundary.

## Relationship To Viewer Primitives

`ViewerRoot` should not be inside `EditViewerProvider`.

The provider owns domain state. `ViewerRoot` owns layout and sidebar state.

Correct:

```tsx
<EditViewerProvider>
  <ViewerRoot>
    ...
  </ViewerRoot>
</EditViewerProvider>
```

Wrong:

```tsx
<ViewerRoot>
  <EditViewerProvider>
    ...
  </EditViewerProvider>
</ViewerRoot>
```

The wrong version makes edit-domain hooks unavailable to header/body decisions above the provider.

Also wrong:

```tsx
<EditViewerProvider>
  <EditViewerRoot>
```

There should be no public `EditViewerRoot`. The root is generic viewer infrastructure.

## Relationship To The Easy API

The easy API should keep using:

```tsx
<ViewerRoot bare data-edit-viewer-root defaultSidebarOpen>
```

This is acceptable because the easy API is the preassembled app-like version.

The composed API should use plain `ViewerRoot` unless the consumer wants `bare`.

The docs should show the composed API first, then the easy API second. This reinforces that the primitives are the conceptual model and the easy API is just a convenience.

## Accessibility Requirements

The final edit viewer should guarantee:

- the default sidebar has `aria-label="Document fields"`
- the sidebar trigger has an accessible label through `ViewerSidebarTrigger`
- field rows are buttons
- field rows expose selected state
- the mode toolbar uses tabs
- status text is readable by assistive tech
- empty and error states are text content, not only icons
- search input has a label
- filter buttons have accessible names

Current implementation covers much of this, but the final blueprint should require tests for the guarantees that are not already protected.

## Performance Requirements

The edit viewer can become expensive if every hover recomputes field groups or overlays.

The final shape should preserve these rules:

- field normalization only runs when `result` changes
- field projection only runs when normalized fields, query, or filter changes
- mode derivation only runs when documents, fields, or options change
- overlay rendering receives `fieldsByPage`, not all fields
- field rows do not parse bboxes
- document renderer does not know about field filtering

The provider can still re-render on selection changes. That is acceptable for current scale. Do not prematurely add a store or selector context unless profiling proves a problem.

If profiling later shows selection hover is expensive, the next step should be an anchored-document selector hook, not a custom edit-viewer store.

## Test Blueprint

### Model Tests

Add or strengthen tests for:

- duplicate field keys keep the first field in `fieldByKey`
- all fields remain in `fields`
- missing keys receive stable fallback keys
- invalid bboxes become unlocated fields
- valid bboxes produce page-grouped fields
- query filtering does not mutate normalized fields
- filter values produce expected visible fields
- document target resolves error before mode
- document target resolves filled/source/preview exactly
- unavailable mode falls back without firing `onModeChange`

### Render Tests

Keep and expand tests for:

- easy API renders header, document, and fields
- easy API omits sidebar and trigger when `fieldPanel` is false
- composed API renders the same visual pieces
- `EditViewerFields` is content-only
- controlled selected field clicks call `onSelectedFieldKeyChange`
- hover previews without committing controlled selection
- invalid controlled selected field clears once
- header hides when no modes exist
- error state still renders through the document part

### Architecture Tests

Keep invariants:

- `edit-viewer.tsx` composes public named parts
- `edit-viewer.tsx` does not import anchored-document hooks directly
- `edit-viewer-provider.tsx` may import anchored-document provider and hooks
- `edit-viewer-provider.tsx` does not import `ViewerRoot`, `ViewerSidebar`, or `ViewerSurface`
- `EditViewerFields` does not import `ViewerSidebar`
- `EditViewerDocument` does not import `ViewerSidebar`
- `EditViewerFieldPanel` does not import edit context
- `use-edit-viewer-controller.ts` does not exist

Add invariants:

- no exported type named `EditViewerDocument` once renamed to `EditViewerDocumentSource`
- docs show composed API before easy API
- docs do not teach `EditViewerRoot`

## Documentation Blueprint

The edit viewer docs should have this order:

1. Composed API
2. Easy API
3. Controlled mode
4. Controlled selection
5. Field panel disabled
6. Custom field panel
7. Data contract

The docs should not lead with the easy API if the component library wants to teach composition as the core philosophy.

The docs should explicitly say:

```txt
EditViewerProvider owns edit state.
ViewerRoot owns layout and sidebar state.
EditViewerFields is content-only.
```

That sentence is important because it prevents the old confusion from returning.

## Migration Blueprint

Because this repository prefers hard cutovers, do not keep duplicate names forever.

### Step 1: Pure Model Extraction

- Move `resolveEditViewerDocumentTarget` out of the provider.
- Add `createEditViewerFieldProjection`.
- Add direct model tests.
- Keep public API unchanged.

### Step 2: Naming Precision

- Rename data type `EditViewerDocument` to `EditViewerDocumentSource`.
- Update props, provider state, document pane, docs, and tests.
- Do not add a deprecated alias unless an external package release requires it.

### Step 3: Provider Compression

- Replace inline field projection logic with `createEditViewerFieldProjection`.
- Replace inline mode state logic with a small private `useEditViewerModeState` only if it makes the provider materially shorter.
- Keep one public provider.

### Step 4: Contract Tests

- Add tests for controlled `mode?: EditViewerMode | null`.
- Add tests for duplicate keys and invalid bboxes.
- Add tests proving hover does not commit selection.

### Step 5: Docs Finalization

- Reorder docs to teach composed API first.
- Add the data contract section.
- Keep examples short and exact.

## What Not To Do Next

Do not:

- introduce a generic form viewer abstraction
- add an `EditViewerSidebar`
- add a second provider
- add render props for every part
- expose anchored-document item names
- make `ViewerRoot` edit-aware
- touch file-system implementation
- add compatibility aliases for renamed types unless release constraints force it
- regenerate unrelated registry surfaces as part of this cut

The next improvement should be compression and precision, not expansion.

## Definition Of Done

The edit viewer reaches its next ideal state when:

- the public API has one provider, one easy component, and three named visual parts
- the easy component visibly composes the public parts
- the provider is shorter and reads in domain order
- field projection is a named pure model
- document target resolution is a named pure model
- the data document type no longer shares the component name
- selection and mode semantics are documented and tested
- docs teach composed API first
- focused edit tests pass
- typecheck passes
- edit architecture invariants pass
- no file-system files are touched

At that point, the edit viewer will be close to the platonic target.

Not because it has more architecture, but because it will have less accidental architecture.

