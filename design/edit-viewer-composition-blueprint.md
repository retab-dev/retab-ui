# Edit Viewer Composition Blueprint

## Thesis

The edit viewer has a good domain model and a mostly correct visual composition, but it is not yet a shadcn-grade composed viewer.

The data structure should stay centered on edit fields, documents, modes, and anchored selections. The component API should change from a closed `EditViewer` monolith into named provider/parts that compose with `ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSurface`, and `ViewerSidebar`.

The ideal direction is:

```tsx
<EditViewerProvider
  result={result}
  sourceDocument={source}
  filledDocument={filled}
>
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

The easy API can still exist, but it should be an assembled composition of the same primitives, not the conceptual center.

## Current Shape

The current edit viewer has these strengths:

- `EditViewerInputResult` is normalized into `EditViewerResult`.
- `EditViewerField` is compact and expressive: `key`, `description`, `type`, `value`, optional `bbox`, optional field rendering metadata.
- `EditViewerMode` is a small union: `source | preview | filled`.
- Available modes are derived from actual documents, fields, and options.
- Field location is already modeled through `bbox`, then converted into `AnchoredItem`.
- The visual hierarchy already uses viewer primitives: `ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSurface`, and `ViewerSidebar`.
- The field panel is content-only. It does not own viewer placement.

The current weaknesses are structural:

- `EditViewer` owns too much: provider creation, viewer shell, header, toolbar, document pane, sidebar, field panel, overlays, and controlled-selection syncing.
- `AnchoredDocumentProvider` is internal, so advanced consumers cannot compose around anchored selection directly.
- `useEditViewerController` returns one broad controller object instead of smaller part states.
- `EditViewerContent` is doing both layout and state synchronization.
- There is no public `EditViewerProvider`, `useEditViewer`, `EditViewerHeader`, `EditViewerDocument`, or `EditViewerFields` part API.
- The easy API is the only API, which makes the component harder to bend without forking.

## Design Standard

The edit viewer should satisfy the same standard as the viewer primitives:

- One concept gets one name.
- Domain state and spatial layout do not share a provider.
- Content panels do not own sidebar placement.
- The assembled easy API is written in terms of the public parts.
- The public parts are useful individually.
- Internal controllers exist only where they make part state smaller and clearer.
- No slot-object API.
- No hidden file-system dependency.
- No local duplicated viewer shell.

The edit viewer is a domain viewer. It should compose the generic viewer primitives. It should not become another generic primitive, and it should not teach `ViewerRoot` about edit fields, bboxes, documents, modes, or anchors.

## Current Responsibility Map

Today the responsibilities are mostly correct, but they are packed into too few modules:

| Current module                  | Current responsibility                                                 | Judgment                                      |
| ------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| `edit-viewer-types.ts`          | Domain input/output types                                              | Good                                          |
| `edit-viewer-model.ts`          | Normalization, mode derivation, filtering, grouping                    | Good                                          |
| `use-edit-viewer-controller.ts` | Derived state, mode state, field UI state, refs                        | Good ingredients, too broad                   |
| `edit-viewer.tsx`               | Provider, layout, header, document, sidebar, controlled selection sync | Too much                                      |
| `edit-viewer-document-pane.tsx` | Document rendering by mode                                             | Good, should become public part               |
| `edit-viewer-field-panel.tsx`   | Field panel content                                                    | Good, but should receive derived field groups |
| `edit-viewer-overlays.tsx`      | PDF field overlays                                                     | Good                                          |
| `edit-viewer-toolbar.tsx`       | Mode toolbar and status summary                                        | Good                                          |

The core problem is not bad code. The problem is that the top-level component is the only composition boundary.

## Non-Goals

Do not do these:

- Do not redesign `ViewerRoot`.
- Do not add `EditViewerSidebar`.
- Do not add `EditViewerSurface`.
- Do not make `ViewerRoot` understand edit modes.
- Do not move `AnchoredDocumentProvider` into viewer primitives.
- Do not add a generic "document workflow viewer" abstraction yet.
- Do not change the field input schema unless a real Retab output contract requires it.
- Do not touch file-system implementation.

The target is narrower: expose the edit viewer as a shadcn-style composed viewer.

## Hard Cutover Policy

This repository should not keep a legacy edit-viewer architecture alongside the new one.

When this blueprint is implemented:

- Replace the closed internal `EditViewerContent` composition.
- Update all edit-viewer call sites to the new exports.
- Do not keep compatibility wrappers beyond the easy `EditViewer` API itself.
- Do not preserve `useEditViewerController` as a public API.
- Do not add deprecated aliases.
- Do not introduce a parallel "new edit viewer" component.

The easy `EditViewer` is not a compatibility shim. It is the canonical assembled API.

## Ideal Boundaries

### Domain Input

The external domain input should remain simple:

```ts
type EditViewerProps = {
  result: EditViewerInputResult | null
  sourceDocument?: EditViewerDocument | null
  filledDocument?: EditViewerDocument | null
  mode?: EditViewerMode
  onModeChange?: (mode: EditViewerMode) => void
  selectedFieldKey?: string | null
  onSelectedFieldKeyChange?: (key: string | null) => void
  status?: EditViewerStatus
  className?: string
  options?: EditViewerOptions
}
```

This shape is already good. It should not grow layout props, slot props, or sidebar props.

### Normalized Domain State

The provider should normalize inputs once and expose a stable domain state:

```ts
type EditViewerState = {
  status: EditViewerStatus
  result: EditViewerResult
  fields: readonly EditViewerField[]
  fieldByKey: ReadonlyMap<string, EditViewerField>
  fieldsByPage: ReadonlyMap<number, readonly EditViewerField[]>
  filledCount: number
  hasOutput: boolean
}
```

This state is domain state, not layout state.

The normalized state should be immutable from the perspective of consumers. Arrays and maps can be new when inputs change, but parts should not mutate them.

Key detail: `fieldByKey` must have a defined duplicate-key policy. The current code overwrites by insertion order because it uses a `Map`. The ideal policy should be explicit:

- If a key exists, keep the first field for `fieldByKey`.
- Preserve all fields in `fields`.
- Generate stable fallback keys only for missing keys.
- Optionally expose duplicate detection later, but do not add UI until needed.

This avoids surprising selection jumps when duplicate keys appear.

### BBox Contract

The `bbox` contract should be documented and tested because it is the bridge between edit data and document anchoring.

`bbox` means:

- `page` is 1-based.
- `left`, `top`, `width`, and `height` are normalized page-relative values.
- `left` and `top` are clamped to `[0, 1]`.
- `width` and `height` must be positive.
- `width` and `height` are clamped so the box cannot extend past the page.
- invalid boxes become unlocated fields, not errors.

The provider should never expose malformed located fields through `fieldsByPage`.

The conversion to `AnchoredItem` should remain:

```ts
anchor: field.bbox
  ? {
      kind: "pdf-area",
      pageNumber: field.bbox.page,
      left: field.bbox.left * 100,
      top: field.bbox.top * 100,
      width: field.bbox.width * 100,
      height: field.bbox.height * 100,
    }
  : null
```

This percentage conversion belongs in one helper, not inline in the layout component.

### Mode State

Mode state should be its own explicit slice:

```ts
type EditViewerModeState = {
  mode: EditViewerMode | null
  modes: readonly EditViewerMode[]
  setMode: (mode: EditViewerMode) => void
}
```

Names should be consistent:

- `mode`, not `activeMode`
- `modes`, not `availableModes`
- `setMode`, not `changeMode`

The word `active` should be reserved for anchored hover/selection behavior, where it currently has meaning.

Mode state should follow these rules:

- If `mode` prop is controlled and valid, use it.
- If `mode` prop is controlled and invalid, fall back to the best available mode without calling `onModeChange`.
- If uncontrolled current mode becomes unavailable, fall back internally.
- If no modes are available, expose `mode: null`.
- `setMode` should no-op for unavailable modes.
- `setMode` should call `onModeChange` only for valid mode changes.

The fallback order should stay `filled`, then `preview`, then `source`, because users usually care about completed output first, then overlay preview, then raw source.

Mode availability should be precise:

| Mode      | Available when                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| `source`  | `sourceDocument` exists                                                                                      |
| `preview` | source exists, source is PDF-previewable, preview option is enabled, at least one valid located field exists |
| `filled`  | `filledDocument` exists and filled output option is enabled                                                  |

`fieldPanel` should not affect mode availability. It only affects whether the field sidebar appears.

### Field Panel State

Search and filter belong to the field panel, but they are still edit-viewer domain interaction state:

```ts
type EditViewerFieldsState = {
  fields: readonly EditViewerField[]
  visibleFields: readonly EditViewerField[]
  fieldGroups: readonly EditViewerFieldGroup[]
  filledCount: number
  fieldCount: number
  query: string
  setQuery: (query: string) => void
  filter: EditViewerFilter
  setFilter: (filter: EditViewerFilter) => void
}
```

`EditViewerFieldPanel` should not call `filterEditViewerFields` and `groupEditViewerFieldsByPage` internally if the provider can derive this once. The panel should render a state object, not recompute the model.

The field state should also expose enough metadata to let parts render empty states without recomputing:

```ts
type EditViewerFieldsState = {
  fields: readonly EditViewerField[]
  visibleFields: readonly EditViewerField[]
  fieldGroups: readonly EditViewerFieldGroup[]
  locatedFields: readonly EditViewerField[]
  unlocatedFields: readonly EditViewerField[]
  filledCount: number
  fieldCount: number
  visibleFieldCount: number
  query: string
  setQuery: (query: string) => void
  filter: EditViewerFilter
  setFilter: (filter: EditViewerFilter) => void
  canSearch: boolean
  canFilter: boolean
}
```

`canSearch` and `canFilter` come from resolved options. They avoid passing `resolvedOptions` into every render part.

### Anchored Selection State

Anchored selection is a first-class dependency, not an implementation detail.

The provider should own `AnchoredDocumentProvider`, because edit fields become anchored document items. But the edit viewer should expose the useful selected/effective state through edit-specific names:

```ts
type EditViewerSelectionState = {
  selectedFieldKey: string | null
  activeFieldKey: string | null
  selectField: (fieldKey: string) => void
  previewField: (fieldKey: string | null) => void
}
```

The current concepts are good:

- `selectedItemId` maps to persistent selected field.
- `activeItemId` maps to hovered or selected effective field.
- `previewItem` maps to hover/focus preview.
- `activateItem` maps to click/select.

But those names are anchored-document names. The edit viewer parts should speak edit-viewer language.

Selection state needs one more command:

```ts
type EditViewerSelectionState = {
  selectedFieldKey: string | null
  activeFieldKey: string | null
  selectField: (fieldKey: string) => void
  clearFieldSelection: () => void
  previewField: (fieldKey: string | null) => void
}
```

The field panel and overlay should call `selectField`. Empty states or escape handling can call `clearFieldSelection`.

The provider should guarantee that `selectedFieldKey` is either `null` or a key present in `fieldByKey`.

### Document State

The document pane should receive an explicit document state:

```ts
type EditViewerDocumentState = {
  mode: EditViewerMode | null
  sourceDocument: EditViewerDocument | null
  filledDocument: EditViewerDocument | null
  viewerRef: React.RefObject<PdfViewerHandle | null>
  renderPageOverlay: (props: PageOverlayProps) => React.ReactNode
}
```

This lets `EditViewerDocument` be a small part that only chooses between source, preview, filled, empty, and error states.

The document state should also expose a resolved display target:

```ts
type EditViewerDocumentTarget =
  | { kind: "error"; message: string }
  | { kind: "empty"; message: string }
  | { kind: "source"; document: EditViewerDocument; showOverlay: false }
  | { kind: "preview"; document: EditViewerDocument; showOverlay: true }
  | { kind: "filled"; document: EditViewerDocument; showOverlay: false }
```

Then `EditViewerDocument` can be nearly declarative:

```tsx
const { target } = useEditViewerDocument()

if (target.kind === "error")
  return <EditViewerErrorState message={target.message} />
if (target.kind === "empty") return <NoDocumentState message={target.message} />
if (target.kind === "preview") return <EditViewerPdfDocument target={target} />
return <EditViewerFileDocument target={target} />
```

This removes mode branching from layout and makes missing-document behavior testable without rendering the full viewer.

### Document Source Contract

`EditViewerDocument` supports documents with either:

- `src`
- `buffer`

The conversion to viewer source should stay local to document rendering, not spread into the provider.

Rules:

- Prefer `src` when present.
- Use `buffer` only when `src` is absent.
- Preserve `mimeType`.
- Preserve `filename`, defaulting to `"document"`.
- Use a stable `identityKey` for `ArrayBuffer` sources.
- Do not recreate object URLs on every render.
- Do not leak object URLs.

The existing `WeakMap<ArrayBuffer, string>` identity strategy is good and should be retained.

The provider can expose `EditViewerDocument`, but the document part should own the conversion to `ViewerSource`, because that is render-resource behavior.

## Full Context Shape

The provider context should be explicit and grouped:

```ts
type EditViewerContextValue = {
  state: EditViewerState
  mode: EditViewerModeState
  fields: EditViewerFieldsState
  selection: EditViewerSelectionState
  document: EditViewerDocumentState
  options: Required<EditViewerOptions>
}
```

Each public hook returns a slice:

```ts
function useEditViewer(): EditViewerContextValue
function useEditViewerHeader(): EditViewerHeaderState
function useEditViewerDocument(): EditViewerDocumentState
function useEditViewerFields(): EditViewerFieldsState & EditViewerSelectionState
function useEditViewerSelection(): EditViewerSelectionState
```

The hooks should not return the raw anchored-document context. They should translate anchored mechanics into edit terms.

## Derived Header State

The header does not need the whole context. It needs this:

```ts
type EditViewerHeaderState = {
  mode: EditViewerMode | null
  modes: readonly EditViewerMode[]
  setMode: (mode: EditViewerMode) => void
  filledCount: number
  fieldCount: number
  status: Exclude<EditViewerStatus, { state: "idle" }> | null
  hasFieldPanel: boolean
}
```

`hasFieldPanel` comes from options. `EditViewerHeader` can use it to decide whether to render `ViewerSidebarTrigger` by default.

## Derived Fields State

`useEditViewerFields()` should be the only hook needed by `EditViewerFields`:

```ts
type EditViewerFieldsPartState = EditViewerFieldsState &
  EditViewerSelectionState
```

The panel should render:

- header title
- filled count
- search input when `canSearch`
- filter controls when `canFilter`
- grouped rows
- no-match state

It should not know how visible fields are computed.

## Derived Document State

`useEditViewerDocument()` should provide:

```ts
type EditViewerDocumentState = {
  target: EditViewerDocumentTarget
  mode: EditViewerMode | null
  viewerRef: React.RefObject<PdfViewerHandle | null>
  renderPageOverlay: (props: PageOverlayProps) => React.ReactNode
}
```

This state is enough for a document part and nothing else.

## Public Parts

The public API should be named exports, not namespace dot syntax:

```ts
export function EditViewerProvider(props: EditViewerProviderProps)
export function useEditViewerDocument(): EditViewerDocumentState
export function useEditViewerFields(): EditViewerFieldsState

export function EditViewer(props: EditViewerProps)
export function EditViewerHeader(props: EditViewerHeaderProps)
export function EditViewerDocument(props: EditViewerDocumentProps)
export function EditViewerFields(props: EditViewerFieldsProps)
export function EditViewerToolbar(props: EditViewerToolbarProps)
```

Header, layout, busy, empty, and selection wiring are implementation selectors,
not public component-library hooks. They should stay private or live behind an
explicitly internal module when files must remain split.

The provider props should include the same domain props as `EditViewer`, except `className`:

```ts
type EditViewerProviderProps = Omit<EditViewerProps, "className"> & {
  children: React.ReactNode
}
```

`EditViewer` should be a thin shell:

```ts
type EditViewerProps = EditViewerProviderInput & {
  className?: string
}
```

This keeps a single domain prop contract.

The composed easy API becomes:

```tsx
export function EditViewer(props: EditViewerProps) {
  return (
    <EditViewerProvider {...props}>
      <ViewerRoot bare defaultSidebarOpen>
        <EditViewerHeader />
        <ViewerBody>
          <ViewerSurface>
            <EditViewerDocument />
          </ViewerSurface>
          <ViewerSidebar
            aria-label="Document fields"
            side="right"
            width="320px"
          >
            <EditViewerFields />
          </ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>
    </EditViewerProvider>
  )
}
```

That is the right relationship: easy API equals assembled parts.

## Canonical Composition

The canonical easy composition should be written exactly once and used by the block/demo:

```tsx
<EditViewerProvider {...providerProps}>
  <ViewerRoot
    bare
    data-edit-viewer-root
    defaultSidebarOpen
    className={cn("h-full w-full flex-1 bg-background", className)}
  >
    <EditViewerBusyOverlay />
    <EditViewerEmptyState />
    <EditViewerHeader />
    <ViewerBody className="flex-col md:flex-row">
      <ViewerSurface className="relative">
        <EditViewerDocument />
      </ViewerSurface>
      <ViewerSidebar
        aria-label="Document fields"
        side="right"
        width="320px"
        className="max-h-[42%] min-h-[220px] border-t bg-background md:max-h-none md:max-w-[50%] md:border-t-0 md:border-l"
      >
        <EditViewerFields />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EditViewerProvider>
```

The conditional display of busy/empty/header/sidebar should be owned by parts, not scattered in the shell:

- `EditViewerBusyOverlay` renders `null` unless status is detecting/filling.
- `EditViewerEmptyState` renders `null` when output exists.
- `EditViewerHeader` renders `null` when there are no modes.
- `EditViewerFields` renders its own empty/no-match state.
- The easy API can omit `ViewerSidebar` entirely when `fieldPanel` is disabled.

## Provider Responsibility

`EditViewerProvider` should own:

- result normalization
- option resolution
- available mode derivation
- controlled/uncontrolled mode state
- controlled/uncontrolled selected field sync
- query/filter state
- field grouping
- field-to-anchor conversion
- `AnchoredDocumentProvider`
- PDF anchored target setup
- page overlay callback

`EditViewerProvider` should not own:

- `ViewerRoot`
- `ViewerHeader`
- `ViewerBody`
- `ViewerSurface`
- `ViewerSidebar`
- exact sidebar width
- exact layout class names

The provider owns domain state. The viewer primitives own spatial layout.

## Provider Internal Flow

The provider should have a clear pipeline:

1. Resolve options.
2. Normalize result.
3. Build `fields`, `fieldByKey`, `filledCount`.
4. Build located field groups.
5. Derive available modes.
6. Resolve controlled/uncontrolled mode.
7. Derive field query/filter state.
8. Derive visible fields and visible groups.
9. Convert fields to `AnchoredItem[]`.
10. Create PDF anchored target from `viewerRef`.
11. Render `AnchoredDocumentProvider`.
12. Translate anchored state into edit selection state.
13. Build document target and page overlay.
14. Memoize context slices.

The provider should not perform layout rendering beyond wrapping `children`.

Lifecycle details:

- `viewerRef` must remain stable for the provider lifetime.
- `usePdfAnchoredTarget(viewerRef)` must be created in the provider layer that owns `AnchoredDocumentProvider`.
- Page overlay callbacks must not change on every hover unless the active field actually changes.
- Controlled `selectedFieldKey` must be reconciled after field normalization, before exposing selection state.
- When fields change and the selected key disappears, selection becomes `null`.
- When mode disappears, fallback mode is resolved immediately.

## Provider Skeleton

The intended provider should look structurally like this:

```tsx
export function EditViewerProvider({
  result,
  sourceDocument,
  filledDocument,
  mode,
  onModeChange,
  selectedFieldKey,
  onSelectedFieldKeyChange,
  status = { state: "idle" },
  options,
  children,
}: EditViewerProviderProps) {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const resolvedOptions = React.useMemo(() => resolveEditViewerOptions(options), [options])
  const editResult = React.useMemo(() => normalizeEditViewerResult(result), [result])
  const fields = editResult.fields
  const fieldByKey = React.useMemo(() => createFieldMap(fields), [fields])
  const anchoredItems = React.useMemo(() => fields.map(editFieldToAnchoredItem), [fields])
  const target = usePdfAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider
      items={anchoredItems}
      target={target}
      initialItemId={selectedFieldKey}
    >
      <EditViewerResolvedProvider ...>
        {children}
      </EditViewerResolvedProvider>
    </AnchoredDocumentProvider>
  )
}
```

The actual anchored state must be read inside the `AnchoredDocumentProvider`, so an inner provider component is still justified:

```tsx
function EditViewerResolvedProvider(props: EditViewerResolvedProviderProps) {
  const anchored = useAnchoredDocument()
  const value = useResolvedEditViewerContext(props, anchored)

  return (
    <EditViewerContext.Provider value={value}>
      {props.children}
    </EditViewerContext.Provider>
  )
}
```

This is not unnecessary indirection. It is the correct consequence of needing anchored context to build edit context.

## Overlay Layer Contract

The overlay layer is part of the document surface, not the sidebar.

Rules:

- Render overlays only for PDF preview mode.
- Render overlays only for the current page.
- Overlay buttons must be `pointer-events-auto`.
- Overlay boxes use normalized bbox coordinates converted to percentages.
- Overlay labels include field key, field type, and filled/empty state.
- Active overlay state follows `activeFieldKey`.
- Selecting an overlay calls `selectField`.
- Hovering or focusing an overlay calls `previewField`.
- Unlocated fields never render overlay buttons.

The overlay should remain prop-driven so it can be tested without the provider.

## Component Responsibility

### `EditViewerHeader`

Owns the header content:

- sidebar trigger
- toolbar
- mode selector
- field count
- filled count
- status badge

It should accept simple layout hooks:

```ts
type EditViewerHeaderProps = React.ComponentProps<typeof ViewerHeader> & {
  showSidebarTrigger?: boolean
}
```

It should use `ViewerHeader` internally, because it is a domain header for this composed viewer.

It should not render when no modes exist:

```tsx
export function EditViewerHeader({
  showSidebarTrigger = true,
  className,
  ...props
}: EditViewerHeaderProps) {
  const header = useEditViewerHeader()
  if (header.modes.length === 0) return null

  return (
    <ViewerHeader className={cn("bg-background", className)} {...props}>
      <div className="flex min-w-0 items-center gap-2 px-2">
        {showSidebarTrigger && header.hasFieldPanel ? <ViewerSidebarTrigger /> : null}
        <EditViewerToolbar ... />
      </div>
    </ViewerHeader>
  )
}
```

### `EditViewerToolbar`

This is already close to ideal. It should receive `mode`, `modes`, `setMode`, `filledCount`, `fieldCount`, and `status`.

The current `onModeChange` naming is fine at the prop boundary, but inside the provider the state setter should be `setMode`.

Toolbar props should be purely presentational:

```ts
type EditViewerToolbarProps = React.ComponentProps<"div"> & {
  mode: EditViewerMode | null
  modes: readonly EditViewerMode[]
  onModeChange: (mode: EditViewerMode) => void
  filledCount: number
  fieldCount: number
  status: Exclude<EditViewerStatus, { state: "idle" }> | null
}
```

The toolbar should not call `useEditViewer` directly. `EditViewerHeader` can wire it to context. Keeping the toolbar prop-driven makes it easy to test and reuse.

### `EditViewerDocument`

Owns the display of the selected mode:

- error state
- filled document renderer
- source document renderer
- PDF preview with overlays
- non-PDF file preview
- empty states

It should not know about sidebar state or field panel state.

It should accept a `className`, but no mode/document props by default:

```ts
type EditViewerDocumentProps = React.ComponentProps<"div">
```

The document part reads from context. Advanced consumers who want a custom document renderer can use `useEditViewerDocument()`.

### `EditViewerFields`

Owns the field panel content:

- search
- filters
- grouped rows
- hover preview
- selected field activation

It should not own `ViewerSidebar`.

This mirrors the source/OCR/email direction: domain list components are content; `ViewerSidebar` is the placement primitive.

It should accept:

```ts
type EditViewerFieldsProps = React.ComponentProps<"div">
```

No `fields`, `query`, `filter`, or callback props are needed for the context-driven part. The lower-level prop-driven `EditViewerFieldPanel` may remain internal or exported separately as a pure content renderer.

## Pure Render Components

The ideal architecture keeps pure render components available internally:

- `EditViewerToolbar` stays prop-driven.
- `EditViewerFieldPanel` can stay prop-driven.
- `EditFieldOverlayLayer` stays prop-driven.
- `EditViewerDocumentRenderer` can stay prop-driven if useful.

The public named parts are context-driven. The internal render components are prop-driven. That split gives both composability and testability.

## Block And Registry Integration

The edit viewer block should remain simple:

```tsx
export function EditViewerBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <EditViewer result={{ fields }} sourceDocument={sourceDocument} />
    </div>
  )
}
```

The block should not demonstrate the full composed API unless the docs page specifically wants to teach composition. Blocks should showcase usable defaults.

Registry/docs integration must update:

- `registry/new-york-v4/blocks/edit-viewer-block.tsx`
- `content/docs/components/edit-viewer.mdx`
- any component index/meta entries if exports move
- generated `public/r/*` registry payloads after implementation

The blueprint does not require touching unrelated registry blocks.

## Data Structure Judgment

### Keep

Keep these as-is or nearly as-is:

- `EditViewerMode = "source" | "preview" | "filled"`
- `EditViewerStatus`
- `EditViewerOptions`
- `EditViewerDocument`
- `EditViewerInputResult`
- `EditViewerResult`
- `EditViewerField`
- `EditViewerInputField`
- `normalizeEditViewerResult`
- `deriveEditViewerModes`
- `resolveEditViewerMode`
- `filterEditViewerFields`
- `groupEditViewerFieldsByPage`
- `groupLocatedEditViewerFieldsByPage`

These are clear, useful, and small.

### Rename Internally

Use tighter internal names:

| Current             | Ideal                    | Reason                                        |
| ------------------- | ------------------------ | --------------------------------------------- |
| `availableModes`    | `modes`                  | Shorter, no loss of meaning inside mode state |
| `activeMode`        | `mode`                   | Mode is selected mode, not hover state        |
| `changeMode`        | `setMode`                | Setter vocabulary                             |
| `effectiveFieldKey` | `activeFieldKey`         | Aligns with anchored active item              |
| `selectedFieldKey`  | `selectedFieldKey`       | Keep                                          |
| `previewItem`       | `previewField`           | Domain language                               |
| `activateItem`      | `selectField`            | Domain language                               |
| `resolvedOptions`   | `options` inside context | Already resolved                              |

Do not rename public props like `onModeChange`; those are idiomatic React event prop names.

### Change

Change the controller shape.

Current:

```ts
const controller = useEditViewerController(...)
controller.activeMode
controller.availableModes
controller.changeMode
controller.fields
controller.fieldsByPage
controller.query
controller.filter
controller.resolvedOptions
```

Ideal:

```ts
const edit = useEditViewer()
edit.mode.mode
edit.mode.modes
edit.mode.setMode
edit.fields.visibleFields
edit.fields.fieldGroups
edit.selection.selectedFieldKey
edit.selection.activeFieldKey
edit.document.renderPageOverlay
```

The reason is not abstraction for abstraction's sake. It is because the parts naturally consume different slices. The header does not need `fieldsByPage`; the document does not need `query`; the field panel does not need `filledDocument`.

### Remove As A Public Concept

`useEditViewerController` should not be the public hook. It can either disappear or become an internal helper called by the provider.

The public concept should be `useEditViewer` plus part-specific hooks. "Controller" is too broad for the component-library API. It sounds like a private implementation detail.

## Relationship To Viewer Primitives

Edit viewer should be a composed viewer, not a new primitive.

`ViewerRoot` remains the primitive provider for spatial sidebar behavior. `EditViewerProvider` is a domain provider for edit state.

This is acceptable provider nesting:

```tsx
<EditViewerProvider>
  <ViewerRoot>...</ViewerRoot>
</EditViewerProvider>
```

The providers are not redundant because they own different concerns:

- `EditViewerProvider`: fields, modes, documents, anchors, selection.
- `ViewerRoot`: sidebar open state, mode, width registration, trigger scoping.

Do not merge them.

The only nesting that should be visible in user code is:

```tsx
<EditViewerProvider>
  <ViewerRoot>...</ViewerRoot>
</EditViewerProvider>
```

There should not be:

```tsx
<ViewerRoot>
  <EditViewerProvider>...</EditViewerProvider>
</ViewerRoot>
```

The edit provider must wrap the parts that need edit context, including document and fields. `ViewerRoot` should stay inside because it is layout and may be swapped by advanced users if they only want the edit domain state.

## Relationship To Anchored Document

`AnchoredDocumentProvider` is not a viewer provider. It is a targeting and selection provider.

It should remain inside `EditViewerProvider`, because edit fields are anchored items. Consumers should not need to manually wrap `AnchoredDocumentProvider` for the default edit viewer experience.

But the edit viewer should not leak anchored-document names into its public parts. It should translate:

- `activeItemId` -> `activeFieldKey`
- `selectedItemId` -> `selectedFieldKey`
- `previewItem` -> `previewField`
- `activateItem` -> `selectField`

## Controlled State

Controlled selection should be resolved in the provider, not in the render component.

Current issue:

- `EditViewerContent` runs an effect to sync `selectedFieldKey` into anchored selection.
- This puts controlled state reconciliation in a layout component.

Ideal:

- `EditViewerProvider` accepts `selectedFieldKey` and `onSelectedFieldKeyChange`.
- It validates the key against `fieldByKey`.
- It passes the resolved initial/current item id to `AnchoredDocumentProvider`.
- It exposes `selection.selectedFieldKey`.

The layout component should not care whether selection is controlled.

## Controlled Mode

Controlled mode should follow the same principle:

- The provider accepts `mode` and `onModeChange`.
- The provider exposes resolved `mode`.
- The provider owns uncontrolled fallback mode.
- The header/toolbar simply call `setMode`.

When the controlled `mode` is invalid, the provider should display the fallback mode but should not emit `onModeChange`. Controlled props are source of truth; emitting a correction would create surprising parent updates.

## Status Semantics

`EditViewerStatus` is good, but rendering should be centralized:

```ts
type EditViewerStatus =
  | { state: "idle" }
  | { state: "detecting"; message?: string }
  | { state: "filling"; message?: string }
  | { state: "error"; message: string }
```

Rules:

- `detecting` and `filling` render a non-blocking busy overlay on top of whatever content exists.
- `error` should make `EditViewerDocument` render an error state.
- `error` may still leave the field panel visible if fields exist.
- `idle` renders no status badge.
- Header status badge should receive `null` for idle.

This means status is not a layout state. It is a domain state consumed by header, busy overlay, and document.

## Empty State Semantics

The provider should expose:

```ts
hasOutput: boolean
```

`hasOutput` is true when:

- status is error, or
- at least one mode exists, or
- at least one field exists.

The easy API can render an empty state when `hasOutput` is false. The part API should allow consumers to decide whether to render an empty state.

Add a part:

```ts
export function EditViewerEmptyState(props: React.ComponentProps<"div">)
```

It reads `hasOutput` and renders `null` when output exists.

Add a part:

```ts
export function EditViewerBusyOverlay()
```

It reads status and renders `null` unless detecting/filling.

## Open Questions

### Should `EditViewerProvider` Render `AnchoredDocumentProvider`?

Yes.

The edit domain requires anchor conversion. Asking consumers to wrap both providers would be too much ceremony and would expose an internal dependency.

### Should `EditViewerHeader` Include `ViewerSidebarTrigger`?

Default: yes.

But it should support `showSidebarTrigger={false}` or a small `start` slot if the design system already uses that pattern elsewhere.

Do not add a broad slots object.

A narrow `start` or `actions` prop can be acceptable only if there is a current design need:

```ts
type EditViewerHeaderProps = React.ComponentProps<typeof ViewerHeader> & {
  showSidebarTrigger?: boolean
  start?: React.ReactNode
  actions?: React.ReactNode
}
```

But the first implementation should probably avoid `start` and `actions`. Add them only when a real consumer needs them.

### Should `EditViewerFields` Include Its Own Header?

Yes.

The field panel header, search, and filters are content grammar. They belong inside the sidebar, not in the global viewer header.

### Should `EditViewerDocument` Render `FileViewer`?

Yes.

Edit viewer is a composed viewer. It can use `PdfViewer` for PDF preview overlays and `FileViewer` for source/filled document fallback. That is exactly the right dependency direction.

### Should The Field Panel Be A Sidebar Trigger Owner?

No.

The field panel is content. The header owns the default trigger. Consumers can place `ViewerSidebarTrigger` anywhere inside `ViewerRoot`.

### Should Search/Filter Be Controlled?

Not initially.

Search and filter are interaction state local to the edit provider. Add controlled `query` or `filter` props only if real product workflows need external synchronization.

### Should Field Selection Auto-Switch To Preview Mode?

No by default.

Selecting a field should anchor/scroll/highlight the field in whatever mode is active. If the mode is `filled`, the selected field may not have an overlay. That is acceptable. Auto-switching would be surprising and would couple field selection to mode management.

If needed later, expose a userland behavior:

```tsx
const { selection, mode } = useEditViewer()
```

Consumers can call `mode.setMode("preview")` on selection.

### Should Unlocated Fields Be Selectable?

Yes.

Unlocated fields should be selectable in the field panel. Selection should update selected state but should not attempt to scroll to an anchor. The anchored item has `anchor: null`.

### Should Preview Mode Exist Without Located Fields?

No.

Preview mode only makes sense when at least one field has a valid bbox and the source document can be previewed as PDF.

### Should Filled Mode Require Fields?

No.

If a filled document exists, filled mode is valid even if no fields are present.

## Accessibility

The edit viewer should preserve these accessibility properties:

- `ViewerSidebar` receives `aria-label="Document fields"` from the composition.
- `EditViewerFields` does not render an additional `aside`.
- Field rows are buttons.
- Field rows expose selected state with `aria-current` or `aria-selected`.
- Overlay buttons have descriptive labels including key, type, and value/empty state.
- Search input has an accessible label.
- Filter buttons use `aria-pressed`.
- Mode controls use a proper tab/segmented-control pattern from existing toolbar implementation.
- Busy overlay should use appropriate live text if it communicates status changes.
- Error state should be readable without relying on color.

Keyboard expectations:

- Tab reaches header controls, document controls, field panel controls.
- Sidebar collapse uses `ViewerSidebarTrigger`, not custom edit logic.
- Field row Enter/Space selects field.
- Overlay button Enter/Space selects field.
- Escape behavior, if implemented, should belong to `ViewerRoot` for sidebar overlay, not edit viewer.

## Performance

The expensive derived data should be memoized in the provider:

- normalized result
- field map
- located fields by page
- field groups
- visible fields
- anchored items
- document target
- overlay render callback

Rendering risks:

- `renderPageOverlay` must be stable unless fields, mode, or active selection changes.
- `fieldsByPage` should not be rebuilt on every hover.
- `fieldGroups` should not be rebuilt on every hover.
- `EditViewerFieldRow` can remain simple; virtualization is not needed unless field counts are very high.
- PDF overlay rendering should only render fields for the current page.

If field counts exceed a few thousand, field panel virtualization can be added later inside `EditViewerFields` without changing provider shape.

## Error Handling

The provider/model should tolerate:

- `result: null`
- `fields: null`
- missing field key
- duplicate field key
- invalid bbox
- missing source document
- missing filled document
- controlled selected key that no longer exists
- controlled mode that is unavailable
- non-PDF source document in preview mode
- document with neither `src` nor `buffer`

Each condition should map to a deterministic state, not an exception.

Exceptions should be reserved for programmer errors:

- `useEditViewer` outside `EditViewerProvider`
- part hooks outside `EditViewerProvider`

## File Layout

The final module layout should be:

```txt
components/viewers/edit/
  edit-viewer.tsx                 # easy assembled API
  edit-viewer-provider.tsx        # provider, context, hooks
  edit-viewer-header.tsx          # context-driven header part
  edit-viewer-document.tsx        # context-driven document part
  edit-viewer-fields.tsx          # context-driven fields part
  edit-viewer-field-panel.tsx     # pure render panel, maybe internal
  edit-viewer-toolbar.tsx         # pure render toolbar
  edit-viewer-overlays.tsx        # pure render overlays
  edit-viewer-states.tsx          # empty/error/busy/status components
  edit-viewer-model.ts            # pure model functions
  edit-viewer-types.ts            # public domain types
  edit-viewer-field-style.ts      # visual constants
```

`edit-viewer.tsx` should become short. It should import the provider and named parts, then assemble them.

## Export Surface

The package should export:

```ts
export {
  EditViewer,
  EditViewerProvider,
  useEditViewer,
  useEditViewerHeader,
  useEditViewerDocument,
  useEditViewerFields,
  useEditViewerSelection,
  EditViewerHeader,
  EditViewerDocument,
  EditViewerFields,
  EditViewerToolbar,
}

export type {
  EditViewerDocument,
  EditViewerField,
  EditViewerInputField,
  EditViewerInputResult,
  EditViewerMode,
  EditViewerOptions,
  EditViewerProps,
  EditViewerProviderProps,
  EditViewerResult,
  EditViewerStatus,
}
```

Avoid exporting internal target/context types unless needed by advanced consumers. If exported, keep them stable and documented.

## Import Direction Rules

Final import direction should be:

```txt
edit-viewer.tsx
  -> edit-viewer-provider
  -> edit-viewer-header
  -> edit-viewer-document
  -> edit-viewer-fields
  -> viewer primitives

edit-viewer-provider.tsx
  -> anchored-document-viewer
  -> pdf-anchor-target
  -> edit-viewer-model
  -> edit-viewer-types

edit-viewer-document.tsx
  -> pdf-viewer
  -> file-viewer
  -> edit-viewer-states

edit-viewer-fields.tsx
  -> edit-viewer-field-panel

edit-viewer-field-panel.tsx
  -> scroll-area
  -> edit-viewer-field-style
```

Forbidden import direction:

- provider imports `ViewerRoot`
- fields part imports `ViewerSidebar`
- document part imports `ViewerRoot`
- toolbar imports provider context
- model imports React
- types import React

This keeps the module graph crisp.

## Implementation Plan

### Step 1: Extract Provider Without Behavior Change

- Move controller logic into `EditViewerProvider`.
- Keep `EditViewer` rendering identical.
- Keep `EditViewerFieldPanel`, `EditViewerDocumentPane`, toolbar, overlays unchanged.
- Add `useEditViewer`.
- Do not change visual layout.

### Step 2: Add Part Hooks

- Add `useEditViewerHeader`.
- Add `useEditViewerDocument`.
- Add `useEditViewerFields`.
- Add `useEditViewerSelection`.
- Ensure each hook returns a narrow slice.

### Step 3: Add Context-Driven Parts

- Add `EditViewerHeader`.
- Add `EditViewerDocument`.
- Add `EditViewerFields`.
- Add `EditViewerBusyOverlay`.
- Add `EditViewerEmptyState` if useful.

### Step 4: Rewrite Easy API As Composition

Rewrite `EditViewer` so it is visibly the canonical composition.

The easy API should no longer contain:

- direct `useAnchoredDocument`
- controlled-selection sync effect
- direct overlay callback construction
- direct field panel prop plumbing

### Step 5: Tighten Tests

- Keep existing render tests passing.
- Add part API render tests.
- Add architecture tests for composition boundaries.
- Add controlled selection tests.
- Add no-sidebar/file-system import invariant.

### Step 6: Update Docs

Update edit viewer docs to show both:

- easy API
- composed API

The composed API should appear first if this component library wants to teach primitives first.

### Step 7: Regenerate Registry

After code changes:

- run the registry build
- validate registry file paths
- confirm the edit-viewer block payload includes the correct dependencies
- confirm removed internal files are not still listed
- confirm new part files are listed when they are public registry dependencies

This is part of the implementation, not an optional cleanup.

## Migration Risk

Risk is moderate but contained.

Low-risk parts:

- model functions
- domain types
- toolbar
- overlay rendering
- field panel rendering

Higher-risk parts:

- controlled `selectedFieldKey` sync
- anchored document provider placement
- PDF target/ref wiring
- mode fallback behavior

Mitigation:

- Extract provider first without visual changes.
- Keep old tests green after each step.
- Add focused tests before removing `EditViewerContent`.

## Visual Regression Checks

Run at least these visual/manual checks:

- default easy API with source-only document
- preview mode with overlays
- filled mode with filled document
- field panel disabled
- search no-match state
- no fields and no documents
- error status
- detecting/filling status overlay
- selected field from sidebar scrolls/highlights source PDF
- selected field from overlay updates sidebar selection
- narrow viewport with sidebar as bottom/top stacked rail
- desktop viewport with right sidebar rail

The expected visual hierarchy remains:

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

## Tests Needed

### Model Tests

Already good, but should explicitly cover:

- duplicate field keys behavior
- controlled mode fallback when requested mode disappears
- selected field key becoming invalid after result changes
- fields with invalid bboxes excluded from `fieldsByPage`
- query/filter derivation in provider-level fields state

### Render Tests

Add tests for the composed parts:

- `EditViewerProvider + EditViewerHeader` renders mode controls and counts.
- `EditViewerProvider + EditViewerDocument` renders source, preview, filled, empty, and error states.
- `EditViewerProvider + ViewerSidebar + EditViewerFields` renders grouped fields.
- `EditViewerFields` does not render `ViewerSidebar`.
- `EditViewerDocument` does not render `ViewerRoot`.
- The easy `EditViewer` uses `ViewerRoot`, `ViewerHeader`, `ViewerBody`, `ViewerSurface`, and `ViewerSidebar`.
- `options.fieldPanel = false` renders no sidebar and no default sidebar trigger.
- `selectedFieldKey` selects a valid field.
- invalid controlled `selectedFieldKey` clears selection and calls `onSelectedFieldKeyChange(null)`.
- selecting a sidebar row calls `onSelectedFieldKeyChange(fieldKey)`.
- selecting an overlay calls `onSelectedFieldKeyChange(fieldKey)`.
- hover/focus updates active field without committing selection.
- unlocated field selection does not crash or attempt page scroll.
- preview mode with non-PDF source renders the correct empty state.

### E2E Tests

Add one browser-level smoke test if this viewer is part of public blocks:

- open the edit-viewer block
- assert the header, document, and field sidebar render
- click a field row and assert an overlay becomes active
- toggle the sidebar with `ViewerSidebarTrigger`
- type in search and assert rows filter
- switch modes when filled output is available

This catches integration issues that model/render tests cannot see, especially PDF target wiring.

### Architecture Tests

Add source-level invariants:

- `EditViewer` easy API is composed from exported parts.
- `EditViewerProvider` does not import `ViewerRoot`.
- `EditViewerFields` does not import `ViewerSidebar`.
- `EditViewerDocument` may import `PdfViewer` and `FileViewer`.
- `EditViewerHeader` may import `ViewerHeader` and `ViewerSidebarTrigger`.
- No file-system imports.

Architecture tests should also check:

- `edit-viewer.tsx` imports `EditViewerProvider`.
- `edit-viewer.tsx` imports `EditViewerHeader`, `EditViewerDocument`, and `EditViewerFields`.
- `edit-viewer-provider.tsx` imports `AnchoredDocumentProvider`.
- `edit-viewer-provider.tsx` does not import `ViewerRoot`.
- `edit-viewer-fields.tsx` does not import `ViewerSidebar`.
- `edit-viewer-document.tsx` does not import `ViewerRoot`.
- `edit-viewer-header.tsx` may import `ViewerHeader` and `ViewerSidebarTrigger`.
- No `useAnchoredDocument` call exists in `edit-viewer.tsx`.

## Acceptance Criteria

Implementation is acceptable only when:

- The easy API still works with the existing block.
- The composed API can recreate the easy API.
- `EditViewerProvider` can be used without rendering `ViewerRoot`.
- `EditViewerFields` can be placed inside any `ViewerSidebar`.
- `EditViewerDocument` can be placed inside any `ViewerSurface`.
- No part except `EditViewerHeader` imports `ViewerSidebarTrigger`.
- No part except the easy API imports both provider and viewer layout primitives.
- Controlled mode and controlled selection work.
- Field panel disabled mode creates no dead trigger.
- PDF overlay selection and sidebar selection stay in sync.
- Existing edit-viewer model tests pass.
- New composed-part tests pass.
- Architecture tests enforce the boundary.

## Documentation Shape

The docs should explain:

```tsx
<EditViewer result={result} sourceDocument={sourceDocument} />
```

as the easy path, then show:

```tsx
<EditViewerProvider result={result} sourceDocument={sourceDocument}>
  <ViewerRoot bare defaultSidebarOpen>
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

The docs should explicitly say:

- `EditViewerProvider` owns edit state.
- `ViewerRoot` owns sidebar state.
- `EditViewerFields` is content-only.
- Use `ViewerSidebarTrigger` anywhere inside `ViewerRoot` to toggle the field sidebar.
- Use `useEditViewerDocument` for custom document rendering.
- Use `useEditViewerFields` for custom field panels.

## Things This Blueprint Intentionally Leaves Alone

These are outside this cut:

- editing field values inline
- writing modified PDFs
- schema editor integration
- OCR/source bbox viewer unification
- file-system viewer
- generic workflow viewer abstraction
- virtualized field list
- collaborative selection
- persisted search/filter state

They may become future work, but none is needed to make the edit viewer composition correct.

## Final Checklist

The design is done when:

- The easy API is a thin canonical composition.
- Every public part is useful by itself.
- No layout component performs controlled state reconciliation.
- `EditViewerProvider` does not render `ViewerRoot`.
- `EditViewerFields` does not render `ViewerSidebar`.
- `EditViewerDocument` does not render `ViewerRoot`.
- Anchored selection is translated into edit field language.
- Tests cover easy API and composed API.
- Docs teach the composed API.
- There are no file-system references.

## Final Ideal

The final edit viewer should feel like this:

```tsx
<EditViewerProvider
  result={result}
  sourceDocument={sourceDocument}
  filledDocument={filledDocument}
>
  <ViewerRoot bare defaultSidebarOpen>
    <EditViewerHeader />
    <ViewerBody>
      <ViewerSurface>
        <EditViewerDocument />
      </ViewerSurface>
      <ViewerSidebar aria-label="Document fields" side="right" width="320px">
        <EditViewerFields />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EditViewerProvider>
```

This is the platonic boundary:

- Edit provider owns edit meaning.
- Viewer primitives own spatial structure.
- Anchored document owns anchor mechanics.
- Document part owns rendering.
- Field part owns field list content.
- The easy API is just the canonical composition.

Nothing more is needed.
