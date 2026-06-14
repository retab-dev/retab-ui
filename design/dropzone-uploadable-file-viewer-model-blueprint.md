# Dropzone Uploadable File Viewer Model Blueprint

## Scope

This blueprint covers the dropzone-based file viewer composition:

- `registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx`
- `registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx`
- `registry/new-york-v4/ui/dropzone.tsx`
- `registry/new-york-v4/ui/dropzone-core.ts`
- `registry/new-york-v4/ui/file-viewer.tsx`

It does not cover file browsing, file-system state, upload transport, backend persistence, or object-store manifests.

## Current Position

The current architecture is directionally good.

The important pipeline is already correct:

```txt
browser file intake
  -> DropzoneFileItem
  -> BlobViewerSource
  -> FileViewer
```

The separation of responsibilities is mostly right:

- `useDropzone` owns browser intake mechanics.
- `dropzone-core` owns validation facts.
- `DropzoneUploaderViewer` owns composition.
- `UploadableFileViewerProvider` adapts selected local file state into a viewer source.
- `FileViewer` owns file routing and rendering.
- `ViewerRoot`, `ViewerBody`, `ViewerSidebar`, and `ViewerSurface` own layout.

This is closer to the desired component-library shape than the email viewer because the domain boundary is simple: one selected local file becomes one `ViewerSource`.

## Current Data Shape

The current provider context is:

```ts
type UploadableFileViewerContextValue = {
  dropzone: UseDropzoneReturn
  selectedFile: DropzoneFileItem | undefined
  viewerSource: BlobViewerSource | null
}
```

This works, but it is not the final shape.

The problem is not that `UseDropzoneReturn` exists. It should exist. The problem is that the uploadable viewer makes the full dropzone controller the central context object. Every slot can reach the entire intake machine, even when it only needs a small command or one state field.

That leaks the implementation mechanism into the composed viewer.

## Existing Strengths To Preserve

The current component has several decisions worth keeping.

### It Does Not Make FileViewer Own Intake

`FileViewer` receives a `ViewerSource`. It does not receive a `File`, does not open native file dialogs, and does not know about drag/drop.

This is correct.

The browser `File` belongs to local intake. The viewer source belongs to file rendering. The adapter between them belongs to the composed uploadable viewer.

### It Uses Viewer Primitives For Layout

The uploadable viewer already composes:

- `ViewerRoot`
- `ViewerHeader`
- `ViewerBody`
- `ViewerSidebar`
- `ViewerSurface`

This is the right grammar. The uploadable viewer should not invent a second frame component, second sidebar primitive, or local split-pane implementation.

### It Keeps Dropzone Headless

`useDropzone` does not render thumbnails, selected-file cards, file-viewer chrome, progress rows, or transport state.

That is exactly the correct headless primitive boundary.

### It Uses One Selected File

The composed viewer intentionally uses:

```ts
maxFiles: 1
multiple: false
```

That makes the viewer semantics clear. This component is not a queue. It is a one-file local preview surface.

Multiple-file upload belongs to a queue or file intake workflow, not this specific viewer.

## Existing Issues

### Raw Dropzone Leakage

The central issue is raw controller leakage:

```ts
dropzone: UseDropzoneReturn
```

Once this appears in context, every slot can call every Dropzone command. That weakens the slot boundaries.

For example:

- the header can call `resetIntake`, even though it should only clear or replace the selected file
- the sidebar can call `getRootProps`, even though it should not own root drag/drop behavior
- the surface can inspect selected-file metadata instead of just receiving `viewerSource`

The code may not currently abuse that power, but the type shape allows abuse.

### Context Is Mechanism-First

The current context says:

```txt
Here is Dropzone.
Here is a selected file.
Here is a viewer source.
```

The better context says:

```txt
Here is the uploadable-viewer model.
Here are the uploadable-viewer actions.
```

That difference matters because the latter names the composed component's domain, while the former names its implementation dependency.

### Slot Names Are Not Perfect

`UploadableFileViewerSummary` is implemented as `ViewerSidebar`.

`Summary` is content-oriented. `Sidebar` is structural.

Since the whole viewer system is converging on primitive composition, slot names should mirror the primitive role whenever possible.

The ideal slot name is `UploadableFileViewerSidebar`.

### Rejection State Is Present But Not Modeled For The Viewer

`Dropzone` exposes `lastIntake`.

The uploadable viewer currently does not surface a viewer-specific rejection state. If the UI wants to render rejection messages later, it will be tempting to pass raw `lastIntake` everywhere through `dropzone`.

The better path is to include `lastIntake` or a derived rejection slice in `UploadableFileViewerModel`.

### Trigger Placement Is Implicit

There are multiple trigger surfaces:

- header upload/replace button
- sidebar empty-state button
- surface empty-state trigger

This is good UX, but the data shape should make it explicit that these are all intake triggers using the same underlying input.

Every trigger should use `getButtonProps` or `getTriggerProps` from the action slice, not directly from raw Dropzone.

## Desired Mental Model

Dropzone is the intake primitive.

Uploadable file viewer is a composed viewer.

FileViewer is the renderer.

They should not collapse into each other.

The uploadable viewer should expose a small viewer-specific model, not raw dropzone state:

```txt
useDropzone()
  -> createUploadableFileViewerModel(dropzone.files)
  -> createUploadableFileViewerActions(dropzone)
  -> slot hooks
```

## Ideal Data Structures

### Intake Item

Keep `DropzoneFileItem` as the Dropzone-owned selected-file state:

```ts
type DropzoneFileItem = {
  id: string
  file: File
}
```

This is enough for Dropzone. It should not know about `ViewerSource`, thumbnails, upload progress, or renderer categories.

### Viewer Source Adapter

The local `File` to `BlobViewerSource` adapter should be a tiny pure function:

```ts
function uploadableFileToViewerSource(
  fileItem: DropzoneFileItem
): BlobViewerSource {
  return blobSource(fileItem.file, {
    fileName: fileItem.file.name,
    identityKey: fileItem.id,
    mimeType: fileItem.file.type || undefined,
  })
}
```

This function gives the system an explicit name for the boundary:

```txt
browser File -> viewer source
```

It should be colocated with the uploadable viewer, not with Dropzone and not with FileViewer.

The `identityKey` must use `fileItem.id`, not only name/size/lastModified, because selecting the same physical file again should still be able to force a fresh viewer identity when Dropzone creates a new item id.

### Uploadable Viewer Model

The composed viewer should derive a narrow model:

```ts
type UploadableFileViewerModel = {
  selectedFile: DropzoneFileItem | null
  viewerSource: BlobViewerSource | null
  isDragging: boolean
  hasFile: boolean
  canClear: boolean
  lastIntake: DropzoneIntake
}
```

This model is a view model, not a persistence model.

It exists because the uploadable viewer has repeated slots that need the same derived facts:

- header needs selected file name and clear/replace affordance
- sidebar needs selected file card or no-file state
- surface needs `viewerSource` or empty drop target
- root needs drag state for visual feedback

The model may include `lastIntake` because rejection state is a selected-file-viewer concern once the component chooses to render rejection feedback. But it should not expose the entire `UseDropzoneReturn`.

### Derived File Metadata

If more than one slot needs file display metadata, derive it once:

```ts
type UploadableFileSummary = {
  name: string
  size: number
  formattedSize: string
  mimeType: string | null
}
```

Then the model can include:

```ts
fileSummary: UploadableFileSummary | null
```

This avoids every visual slot repeating:

```ts
selectedFile.file.name
selectedFile.file.size
selectedFile.file.type || "Unknown type"
```

However, do this only if duplication actually appears across slots. The first version can keep `selectedFile` and let the sidebar card format it.

### Uploadable Viewer Actions

Actions should be narrower than `UseDropzoneReturn`:

```ts
type UploadableFileViewerActions = {
  clearFile: () => void
  openFileDialog: () => void
  getRootProps: UseDropzoneReturn["getRootProps"]
  getInputProps: UseDropzoneReturn["getInputProps"]
  getButtonProps: UseDropzoneReturn["getButtonProps"]
  getTriggerProps: UseDropzoneReturn["getTriggerProps"]
}
```

The action object can still delegate to Dropzone internally, but consumers should not receive unrelated commands like `removeFile`, `reset`, or `resetIntake` unless the composed viewer actually supports those concepts.

For a one-file viewer, `removeFile(fileId)` is not the right public command. The correct domain command is `clearFile()`.

`openFileDialog()` is acceptable because the domain command is still clear and useful for custom triggers. It should not replace prop getters for accessible button/trigger behavior, but it is a valid escape hatch for composed slots.

### Rejection Summary

If the viewer renders rejection UI, prefer a derived summary:

```ts
type UploadableFileViewerRejection = {
  fileName: string
  reason: DropzoneFileRejection["reason"]
  message: string
}
```

The raw `DropzoneFileRejection` remains useful for advanced consumers, but the default visual component benefits from a small display model.

Keep the source of truth factual:

```txt
dropzone-core -> rejection facts
uploadable viewer -> optional display copy
```

Do not move rejection copy into `dropzone-core`.

### Context Value

The provider context should become:

```ts
type UploadableFileViewerContextValue = {
  model: UploadableFileViewerModel
  actions: UploadableFileViewerActions
}
```

This makes the provider read like a small state machine instead of a Dropzone pass-through.

## Slot Hooks

Keep the current named slot hooks, but make them return precise slices.

### Root Hook

```ts
type UploadableFileViewerRootState = {
  isDragging: boolean
  getRootProps: UploadableFileViewerActions["getRootProps"]
  getInputProps: UploadableFileViewerActions["getInputProps"]
}
```

The root needs drag state and hidden input/root props.

It does not need selected file details.

### Header Hook

```ts
type UploadableFileViewerHeaderState = {
  selectedFile: DropzoneFileItem | null
  clearFile: () => void
  getButtonProps: UploadableFileViewerActions["getButtonProps"]
}
```

The header needs:

- selected filename
- clear command
- upload/replace button props

It does not need `viewerSource`.

### Sidebar Hook

```ts
type UploadableFileViewerSidebarState = {
  selectedFile: DropzoneFileItem | null
  getButtonProps: UploadableFileViewerActions["getButtonProps"]
}
```

The sidebar needs selected file metadata and an upload button for the empty state.

It does not need root props or intake details.

### Surface Hook

```ts
type UploadableFileViewerSurfaceState = {
  viewerSource: BlobViewerSource | null
  getTriggerProps: UploadableFileViewerActions["getTriggerProps"]
}
```

The surface needs a renderable source or a clickable empty drop target.

It does not need `selectedFile`, except indirectly through `viewerSource`.

## Composition Shape

The public easy API should stay simple:

```tsx
export function DropzoneUploaderViewer({
  className,
  renderViewer,
}: DropzoneUploaderViewerProps) {
  return (
    <UploadableFileViewerProvider>
      <UploadableFileViewerRoot className={className}>
        <UploadableFileViewerHeader />
        <ViewerBody className="flex-col md:flex-row">
          <UploadableFileViewerSidebar />
          <UploadableFileViewerSurface renderViewer={renderViewer} />
        </ViewerBody>
      </UploadableFileViewerRoot>
    </UploadableFileViewerProvider>
  )
}
```

The names should match viewer primitives:

- `UploadableFileViewerRoot`
- `UploadableFileViewerHeader`
- `UploadableFileViewerSidebar`
- `UploadableFileViewerSurface`

`Summary` is less precise than `Sidebar`. It describes content rather than placement. Since this slot is implemented with `ViewerSidebar`, `Sidebar` is the better name.

## Provider Implementation

The provider should still create the Dropzone controller:

```ts
const dropzone = useDropzone({
  accept,
  maxFiles: 1,
  multiple: false,
})
```

Then derive the model:

```ts
const selectedFile = dropzone.files[0] ?? null

const viewerSource = React.useMemo(() => {
  if (!selectedFile) return null
  return blobSource(selectedFile.file, {
    fileName: selectedFile.file.name,
    identityKey: selectedFile.id,
    mimeType: selectedFile.file.type || undefined,
  })
}, [selectedFile])

const model = React.useMemo(
  () => ({
    selectedFile,
    viewerSource,
    isDragging: dropzone.isDragging,
    hasFile: selectedFile !== null,
    canClear: selectedFile !== null && !dropzone.isDisabled,
  }),
  [dropzone.isDragging, dropzone.isDisabled, selectedFile, viewerSource]
)
```

Then derive actions:

```ts
const actions = React.useMemo(
  () => ({
    clearFile: dropzone.clearFiles,
    getRootProps: dropzone.getRootProps,
    getInputProps: dropzone.getInputProps,
    getButtonProps: dropzone.getButtonProps,
    getTriggerProps: dropzone.getTriggerProps,
  }),
  [
    dropzone.clearFiles,
    dropzone.getRootProps,
    dropzone.getInputProps,
    dropzone.getButtonProps,
    dropzone.getTriggerProps,
  ]
)
```

The context exposes only `{ model, actions }`.

## Provider Props

The provider should expose only intake configuration and selected-file control.

Recommended props:

```ts
type UploadableFileViewerProviderProps = {
  accept?: string
  disabled?: boolean
  files?: DropzoneFileItem[]
  defaultFiles?: DropzoneFileItem[]
  maxSize?: number
  onFilesChange?: (files: DropzoneFileItem[]) => void
  onIntake?: (intake: DropzoneIntake) => void
  children: React.ReactNode
}
```

Do not expose:

```ts
multiple?: boolean
maxFiles?: number
```

This composed viewer is a one-file preview surface. It should always call:

```ts
useDropzone({
  accept,
  disabled,
  files,
  defaultFiles,
  maxFiles: 1,
  maxSize,
  multiple: false,
  onFilesChange,
  onIntake,
})
```

If someone needs multiple files, they need a queue viewer, not this component.

## Easy API Props

The easy API should be small:

```ts
type DropzoneUploaderViewerProps = {
  accept?: string
  className?: string
  disabled?: boolean
  maxSize?: number
  renderViewer?: (source: BlobViewerSource) => React.ReactNode
  onFilesChange?: (files: DropzoneFileItem[]) => void
  onIntake?: (intake: DropzoneIntake) => void
}
```

Do not add:

```ts
onUpload
uploadUrl
progress
status
```

Those belong to a transport workflow, not the local preview viewer.

## Why This Is Better

The current structure asks every slot to understand Dropzone.

The ideal structure asks every slot to understand uploadable-viewer state.

That is the important distinction.

The composed viewer should be able to change its intake primitive later without rewriting every slot. It should also be easy to audit what each slot can do.

The data shape should say:

- root can react to drag state
- header can clear or replace
- sidebar can show selected file
- surface can render selected source or trigger intake

It should not say:

- every slot has arbitrary access to the full file-intake machine

## Rendering Rules

### Root

`UploadableFileViewerRoot` should render `ViewerRoot`.

It should call `getRootProps` at the root wrapper level that owns drag/drop behavior, and it should render the hidden file input exactly once.

The current provider wraps children in:

```tsx
<section {...dropzone.getRootProps({ className: "contents" })}>
  <input {...dropzone.getInputProps({ className: "hidden" })} />
  {children}
</section>
```

This works, but the ideal placement is debatable.

Preferred final shape:

```tsx
<section {...getRootProps({ className: "contents" })}>
  <input {...getInputProps({ className: "hidden" })} />
  <ViewerRoot>...</ViewerRoot>
</section>
```

Keep the root props outside `ViewerRoot` unless we want `ViewerRoot` itself to become the drop target. The current wrapper is acceptable because Dropzone is behavior, not layout.

There are two acceptable root placements.

Option A: provider owns the drop root wrapper.

```tsx
<UploadableFileViewerContext.Provider value={value}>
  <section {...actions.getRootProps({ className: "contents" })}>
    <input {...actions.getInputProps({ className: "hidden" })} />
    {children}
  </section>
</UploadableFileViewerContext.Provider>
```

Option B: root component owns the drop root wrapper.

```tsx
export function UploadableFileViewerRoot({ children, className }) {
  const { isDragging, getRootProps, getInputProps } =
    useUploadableFileViewerRoot()

  return (
    <section {...getRootProps({ className: "contents" })}>
      <input {...getInputProps({ className: "hidden" })} />
      <ViewerRoot
        bare
        defaultSidebarOpen
        className={cn(
          "min-h-[30rem] rounded-lg border bg-background",
          isDragging && "border-foreground/40 bg-accent/35",
          className
        )}
      >
        {children}
      </ViewerRoot>
    </section>
  )
}
```

Option B is more explicit because the hidden input lives with the root slot that owns intake behavior. Option A is slightly harder to misuse because every child is automatically inside the drop root.

Preferred final answer: Option B, as long as architecture tests guarantee that the input is rendered exactly once.

### Header

The header should not know `dropzone`.

It should know:

- selected file name
- `clearFile`
- upload/replace button props

The header should render:

- sidebar trigger
- title
- selected filename subtitle when present
- clear button when `canClear`
- upload/replace button

The header should not render rejection messages. Rejections belong near the surface or sidebar empty state where the user attempted intake.

### Sidebar

The sidebar should remain a real `ViewerSidebar`.

The selected-file card belongs here because it is contextual metadata for the currently rendered file.

The card should remain visual-only. It should not own selection state.

Recommended sidebar states:

```txt
selected file
  -> thumbnail
  -> filename
  -> formatted size
  -> MIME type or "Unknown type"

no file
  -> short empty copy
  -> upload button
```

The sidebar should not render `FileViewer`.

The sidebar should not call `blobSource`.

### Surface

The surface should remain a real `ViewerSurface`.

When a source exists:

```tsx
renderViewer ? (
  renderViewer(viewerSource)
) : (
  <FileViewer source={viewerSource} bare />
)
```

When no source exists:

```tsx
<UploadableFileViewerEmptyState getTriggerProps={getTriggerProps} />
```

The empty state is not a Dropzone. It is one trigger surface connected to the provider actions.

The surface should own the largest intake target when no file is selected. It is the obvious place to click or drop.

Once a file exists, the surface should stop behaving like a trigger and should render the file viewer. Replacement should move to header/sidebar buttons so users do not accidentally replace while interacting with the file viewer.

This avoids nested pointer conflicts between `FileViewer` internals and drop triggers.

### Empty State

The empty state should accept only the exact trigger getter it needs:

```ts
function UploadableFileViewerEmptyState({
  getTriggerProps,
}: {
  getTriggerProps: UploadableFileViewerActions["getTriggerProps"]
}) {
  return <div {...getTriggerProps(...)} />
}
```

It should not receive `dropzone`.

### File Card

The file card should receive a display file or summary:

```ts
function UploadableFileViewerFileCard({ file }: { file: DropzoneFileItem }) {}
```

It should not receive actions. Removal belongs to header or a clearly named card action prop:

```ts
onClear?: () => void
```

Avoid implicit access through context inside small leaf components.

## Naming

Use one noun consistently:

- `UploadableFileViewer`

Avoid mixing:

- `DropzoneUploaderViewer`
- `UploadableFileViewer`
- `Uploader + viewer`
- `Summary`

The public block can still be named `DropzoneUploaderViewer` because it is a registry example, but internals should consistently use `UploadableFileViewer`.

The visible title should also avoid "Uploader + viewer" if we want polish. Better:

- `File preview`
- `Upload preview`
- `Local file preview`

The title should name the user task, not the implementation composition.

Recommended final names:

```ts
UploadableFileViewerProvider
UploadableFileViewerRoot
UploadableFileViewerHeader
UploadableFileViewerSidebar
UploadableFileViewerSurface
useUploadableFileViewerRoot
useUploadableFileViewerHeader
useUploadableFileViewerSidebar
useUploadableFileViewerSurface
```

## Controlled State

The first ideal version can remain internally controlled.

But the data model should not block controlled usage later.

Future controlled props should mirror Dropzone, not invent a second file state shape:

```ts
type UploadableFileViewerProviderProps = {
  accept?: string
  files?: DropzoneFileItem[]
  defaultFiles?: DropzoneFileItem[]
  onFilesChange?: (files: DropzoneFileItem[]) => void
  children: React.ReactNode
}
```

This should pass directly to `useDropzone`.

Do not add upload transport props here. Upload is a separate workflow.

Controlled usage should behave exactly like Dropzone:

- if `files` is supplied, the provider is controlled
- `defaultFiles` only seeds uncontrolled state
- `onFilesChange` fires for every accepted transition
- rejected intake does not change `files`
- clearing emits `[]`

The viewer model should not store its own selected file state. It derives from Dropzone state.

## Rejection State

The current uploadable viewer does not visibly render rejections.

That is acceptable for the first composed viewer, but the model should make room for it without exposing full Dropzone:

```ts
type UploadableFileViewerModel = {
  selectedFile: DropzoneFileItem | null
  viewerSource: BlobViewerSource | null
  isDragging: boolean
  hasFile: boolean
  canClear: boolean
  lastIntake: DropzoneIntake
}
```

If the viewer renders rejection copy, it should derive copy in the visual layer, because `DropzoneFileRejection` intentionally stores facts, not strings.

Recommended default rendering:

```txt
file-invalid-type
  -> "This file type is not supported."

file-too-large
  -> "This file is larger than the allowed limit."

too-many-files
  -> "Only one file can be selected."
```

The exact copy can be more specific, but it should remain in the visual uploadable viewer layer.

The rejection UI should clear when:

- a valid file is selected
- user explicitly clears/reset intake, if that action is exposed

Do not clear rejection state merely because the user hovers or opens the file dialog.

## Accessibility

The composed viewer should preserve Dropzone's accessibility rules.

### Hidden Input

There must be exactly one file input.

The input must be visually hidden, not display-block visible.

Every trigger must open that same input.

### Button vs Non-Button Triggers

Use `getButtonProps` for real `<button>` elements.

Use `getTriggerProps` for non-button elements.

Do not put `role="button"` on a native button.

Do not use `getTriggerProps` on a button.

### Drag State

The root should expose drag state visually, but it should not trap focus.

Drag styling should not be the only indication of accepted/rejected files.

### Sidebar Trigger

`ViewerSidebarTrigger` belongs in the header. It toggles the selected-file sidebar, not the file picker.

Do not conflate:

- sidebar trigger
- upload trigger

They are separate actions.

### Empty Surface

The empty surface trigger needs:

- keyboard activation
- focus ring
- clear copy
- no nested interactive children that steal click/key events

## Performance

The provider should memoize the `BlobViewerSource`.

The dependency should be the selected `DropzoneFileItem`, not every render of the full Dropzone object.

Good:

```ts
const selectedFile = dropzone.files[0] ?? null
const viewerSource = React.useMemo(
  () => (selectedFile ? uploadableFileToViewerSource(selectedFile) : null),
  [selectedFile]
)
```

Avoid:

```ts
React.useMemo(..., [dropzone])
```

`FileViewer` already lazy-loads format-specific renderers, so the uploadable viewer should not eagerly import format-specific viewers.

Do not inspect file bytes in the uploadable viewer. Let `FileViewer` and the format-specific viewers own parsing.

## Error Boundaries

The uploadable viewer should not wrap `FileViewer` in another file-rendering error boundary unless it adds uploadable-viewer-specific recovery.

`FileViewer` already owns file-rendering fallback/error behavior.

The uploadable viewer can render intake rejection errors, but render errors belong to `FileViewer`.

## Styling Rules

The uploadable viewer should not introduce a card inside a card.

Recommended frame:

```txt
ViewerRoot
  ViewerHeader
  ViewerBody
    ViewerSidebar
    ViewerSurface
```

The sidebar file card can be a small bordered/content block because it is an individual repeated/detail item, not a nested page section.

The empty surface can use a dashed drop target. Once a file is selected, remove that dashed target so the file viewer takes the full surface.

## Relationship To File Uploader

`FileUploader` is the polished intake component.

`UploadableFileViewer` is intake plus preview.

They share Dropzone but should not share state by default.

Do not make `FileUploader` import `FileViewer`.

Do not make `UploadableFileViewer` import `FileUploader` unless it intentionally reuses only a visual leaf such as a file tile. Even then, prefer a smaller shared file-card primitive if duplication becomes real.

## Relationship To FileViewer

`FileViewer` remains lower-level than `UploadableFileViewer`.

`UploadableFileViewer` can accept `renderViewer` because custom consumers may want:

```tsx
renderViewer={(source) => <FileViewer source={source} bare isolateStyles />}
```

or a domain-specific preview.

But default rendering should stay:

```tsx
<FileViewer source={viewerSource} bare className="size-full min-h-0" />
```

Do not pass upload metadata into `FileViewer`.

## Relationship To Viewer Primitives

`UploadableFileViewerProvider` is a domain provider.

`ViewerRoot` is the spatial provider for sidebar state.

This is not too many providers because they own different state:

```txt
UploadableFileViewerProvider
  owns selected local file and intake actions

ViewerRoot
  owns sidebar open/closed state and spatial layout
```

Do not create an `UploadableFileViewerSidebarProvider`.

Do not create a separate sidebar toggle provider. `ViewerRoot` already owns that.

## Non-Goals

Do not make `FileViewer` accept `File`.

`FileViewer` should keep accepting `ViewerSource`.

The adapter from `File` to `BlobViewerSource` belongs in the uploadable viewer provider because the selected browser file is a local intake concern.

Do not make Dropzone know about `FileViewer`.

Dropzone should stay headless and generic.

Do not add upload progress to this component.

The component is uploadable in the browser-intake sense. Transport progress belongs to an upload workflow component.

Do not support a file list in this component.

Do not support selected-file tabs.

Do not support persistent uploaded URLs.

Do not support remote file browsing.

Do not add MIME sniffing here.

## Tests To Lock The Shape

Add or keep architecture tests for:

- `DropzoneUploaderViewer` composes provider, root, header, `ViewerBody`, sidebar, and surface in that order.
- `UploadableFileViewerProvider` is the only place that calls `useDropzone`.
- `UploadableFileViewerProvider` is the only place that calls `blobSource`.
- `UploadableFileViewerContent` or `UploadableFileViewerSurface` renders `FileViewer`.
- Slot hooks do not return raw `UseDropzoneReturn`.
- Slot components do not call `useDropzone`.
- The wrapper does not introduce a second layout frame around `ViewerRoot`.
- `UploadableFileViewerSidebar` renders `ViewerSidebar`.
- `UploadableFileViewerSurface` renders `ViewerSurface`.
- `UploadableFileViewerRoot` renders exactly one file input.
- `FileViewer` is only imported by the surface part, not the provider.
- `blobSource` is only imported by the model/provider part.

Behavior tests should cover:

- uploading a file produces a `BlobViewerSource`
- the source identity key changes when a new selected file replaces the previous one
- clear removes the source and returns to empty state
- empty state trigger opens the file dialog
- header upload/replace button uses native button props
- dragging over the root changes root drag styling
- invalid files produce `lastIntake.fileRejections` without changing the selected source
- pressing Enter/Space on the empty surface trigger opens the file dialog
- clearing a selected file removes the `FileViewer`
- replacing with a second file updates the rendered source identity
- dropping more than one file keeps only one accepted file and records rejections according to Dropzone rules
- disabled state prevents file dialog opening and clearing

## Architecture Invariants

These should be machine-testable:

```txt
useDropzone appears only in UploadableFileViewerProvider.
blobSource appears only in the uploadable viewer model/provider file.
FileViewer appears only in UploadableFileViewerSurface.
UploadableFileViewerContextValue does not contain UseDropzoneReturn.
Slot hooks do not return UseDropzoneReturn.
UploadableFileViewerSidebar contains ViewerSidebar.
UploadableFileViewerSurface contains ViewerSurface.
Dropzone core does not import viewer-source or file-viewer.
FileViewer does not import dropzone.
```

## Implementation Sketch

The ideal implementation can stay in one parts file at first.

```ts
type UploadableFileViewerContextValue = {
  model: UploadableFileViewerModel
  actions: UploadableFileViewerActions
}

function useUploadableFileViewerContext() {
  const context = React.useContext(UploadableFileViewerContext)
  if (!context) {
    throw new Error(
      "useUploadableFileViewer must be used within UploadableFileViewerProvider."
    )
  }
  return context
}
```

Provider:

```tsx
export function UploadableFileViewerProvider(props) {
  const dropzone = useDropzone({
    accept: props.accept ?? DEFAULT_UPLOADABLE_VIEWER_ACCEPT,
    disabled: props.disabled,
    files: props.files,
    defaultFiles: props.defaultFiles,
    maxFiles: 1,
    maxSize: props.maxSize,
    multiple: false,
    onFilesChange: props.onFilesChange,
    onIntake: props.onIntake,
  })

  const selectedFile = dropzone.files[0] ?? null
  const viewerSource = React.useMemo(
    () => (selectedFile ? uploadableFileToViewerSource(selectedFile) : null),
    [selectedFile]
  )

  const model = React.useMemo(
    () => ({
      selectedFile,
      viewerSource,
      isDragging: dropzone.isDragging,
      hasFile: selectedFile !== null,
      canClear: selectedFile !== null && !dropzone.isDisabled,
      lastIntake: dropzone.lastIntake,
    }),
    [
      dropzone.isDragging,
      dropzone.isDisabled,
      dropzone.lastIntake,
      selectedFile,
      viewerSource,
    ]
  )

  const actions = React.useMemo(
    () => ({
      clearFile: dropzone.clearFiles,
      openFileDialog: dropzone.openFileDialog,
      getRootProps: dropzone.getRootProps,
      getInputProps: dropzone.getInputProps,
      getButtonProps: dropzone.getButtonProps,
      getTriggerProps: dropzone.getTriggerProps,
    }),
    [
      dropzone.clearFiles,
      dropzone.openFileDialog,
      dropzone.getRootProps,
      dropzone.getInputProps,
      dropzone.getButtonProps,
      dropzone.getTriggerProps,
    ]
  )

  const value = React.useMemo(() => ({ model, actions }), [model, actions])

  return (
    <UploadableFileViewerContext.Provider value={value}>
      {props.children}
    </UploadableFileViewerContext.Provider>
  )
}
```

Root:

```tsx
export function UploadableFileViewerRoot({ children, className }) {
  const { isDragging, getRootProps, getInputProps } =
    useUploadableFileViewerRoot()

  return (
    <section {...getRootProps({ className: "contents" })}>
      <input {...getInputProps({ className: "hidden" })} />
      <ViewerRoot
        bare
        defaultSidebarOpen
        className={cn(
          "min-h-[30rem] rounded-lg border bg-background text-foreground",
          isDragging && "border-foreground/40 bg-accent/35",
          className
        )}
      >
        {children}
      </ViewerRoot>
    </section>
  )
}
```

Surface:

```tsx
export function UploadableFileViewerSurface({ renderViewer }) {
  const { viewerSource, getTriggerProps } = useUploadableFileViewerSurface()

  return (
    <ViewerSurface className="min-h-[24rem]">
      {viewerSource ? (
        renderViewer ? (
          renderViewer(viewerSource)
        ) : (
          <FileViewer
            source={viewerSource}
            bare
            className="size-full min-h-0"
          />
        )
      ) : (
        <UploadableFileViewerEmptyState getTriggerProps={getTriggerProps} />
      )}
    </ViewerSurface>
  )
}
```

## Migration Plan

1. Rename `UploadableFileViewerSummary` to `UploadableFileViewerSidebar`.
2. Rename `UploadableFileViewerContent` to `UploadableFileViewerSurface`.
3. Introduce `UploadableFileViewerModel`.
4. Introduce `UploadableFileViewerActions`.
5. Change context from `{ dropzone, selectedFile, viewerSource }` to `{ model, actions }`.
6. Update slot hooks to return exact slices.
7. Update the easy API composition to use `Sidebar` and `Surface` names.
8. Add architecture tests preventing raw `UseDropzoneReturn` leakage from slot hooks.
9. Keep `useDropzone` and `FileViewer` APIs unchanged.

## Cutover Checklist

- Public easy block still works with no props.
- Accepted file types remain unchanged.
- Drag-over visual state still appears on the root frame.
- Header still has sidebar trigger, title, clear button, and upload/replace button.
- Sidebar still shows thumbnail, name, size, and MIME type.
- Empty surface still opens the file picker.
- Default surface still renders `FileViewer`.
- Custom `renderViewer` still receives a `BlobViewerSource`.
- Rejection behavior remains fact-based and does not change selected source.
- No file-system or remote-browse code is touched.

## Final Judgment

The current dropzone-based file viewer is structurally sound.

It has the right primitive composition and the right source pipeline.

The remaining imperfection is that it leaks the raw Dropzone controller through the uploadable viewer context. The fix is not a larger provider system. The fix is a smaller model:

```txt
Dropzone state in
UploadableFileViewerModel out
ViewerSource to FileViewer
```

That gives us simplicity, speed, complete behavior, and no unnecessary coupling.
