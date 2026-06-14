# Uploadable File Viewer Remaining Perfection Blueprint

## Scope

This blueprint covers the final gap between the implemented uploadable file viewer and the ideal component:

- `registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx`
- `registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx`
- `registry/new-york-v4/ui/dropzone.tsx`
- `registry/new-york-v4/ui/dropzone-core.ts`
- `registry/new-york-v4/ui/file-viewer.tsx`

It does not cover file-system browsing, remote upload transport, object storage, backend persistence, file indexing, or file-system viewer state.

## Current Answer

We have not reached perfection.

We have reached a good design:

- the provider owns browser file intake state
- the root owns the drop target and hidden file input
- the header owns global file-viewer commands
- the sidebar owns selected-file context
- the surface owns empty state or rendered file content
- the easy wrapper composes the named parts
- `FileViewer` receives a `BlobViewerSource` and does not know about drag/drop

The architecture is directionally correct. The remaining work is not a full rebuild. It is a vocabulary and boundary sharpening pass.

## Current Shape

The current composition is:

```tsx
<UploadableFileViewerProvider>
  <UploadableFileViewerRoot>
    <UploadableFileViewerHeader />
    <ViewerBody>
      <UploadableFileViewerSidebar />
      <UploadableFileViewerSurface />
    </ViewerBody>
  </UploadableFileViewerRoot>
</UploadableFileViewerProvider>
```

The current provider model is:

```ts
export type UploadableFileViewerModel = {
  canClear: boolean
  hasFile: boolean
  isDragging: boolean
  lastIntake: DropzoneIntake
  selectedFile: DropzoneFileItem | null
  viewerSource: BlobViewerSource | null
}
```

The current action shape is:

```ts
export type UploadableFileViewerActions = {
  clearFile: () => void
  openFileDialog: () => void
  getRootProps: UseDropzoneReturn["getRootProps"]
  getInputProps: UseDropzoneReturn["getInputProps"]
  getButtonProps: UseDropzoneReturn["getButtonProps"]
  getTriggerProps: UseDropzoneReturn["getTriggerProps"]
}
```

This is good enough to use. It is not yet perfect.

## Core Invariant

The core invariant should be explicit:

```txt
At any moment, the uploadable file viewer represents zero or one local browser files.
If it represents one file, it may derive exactly one BlobViewerSource from it.
The viewer source is derived state, never independent state.
```

That means there should not be a state shape where `selectedFile` and `viewerSource` can be independently mutated.

The current implementation derives `viewerSource` from `selectedFile`, which is correct. The final design should preserve that property and make it impossible for a sidebar file card to show one file while the surface renders another.

## State Taxonomy

The component has four kinds of state. Mixing them is where the abstraction becomes muddy.

### Intake State

Owned by Dropzone:

- selected browser files
- drag active state
- accepted file constraints
- last intake result
- disabled state

This state is mechanical. It should stay in `useDropzone`.

### Viewer State

Derived by the uploadable viewer:

- `selectedFile`
- `selectedFileSummary`
- `viewerSource`
- `hasFile`
- `canClear`
- `canOpenFileDialog`
- `rejection`

This state is semantic. It describes what the uploadable viewer can render.

### Layout State

Owned by viewer primitives:

- sidebar open or closed
- sidebar width
- root/sidebar/surface layout attributes
- trigger registration

The uploadable viewer should not duplicate this state.

### Render State

Owned by `FileViewer` and its selected renderer:

- PDF page
- zoom
- text rendering mode
- CSV viewport
- image load status
- unsupported-file state

The uploadable viewer should not inspect or proxy this state. It hands off a source and gets out of the way.

## Dataflow

The ideal dataflow is:

```txt
native file input / drag event
  -> useDropzone
  -> DropzoneFileItem[]
  -> selected DropzoneFileItem | null
  -> UploadableFileSummary | null
  -> BlobViewerSource | null
  -> FileViewer
```

The final implementation should keep every transformation named:

```ts
const selectedFile = getSelectedUploadableFile(dropzone.files)
const selectedFileSummary = createUploadableFileSummary(selectedFile)
const viewerSource = createUploadableFileViewerSource(selectedFile)
const rejection = createUploadableFileViewerRejection(dropzone.lastIntake)
```

These helpers should be small and pure. They are valuable because they give the domain boundaries names.

The helpers should not live in Dropzone. Dropzone does not know that files will be viewed.

The helpers should not live in `FileViewer`. FileViewer does not know where sources came from.

They belong beside the composed uploadable viewer.

## What Is Already Right

### FileViewer Does Not Own Intake

`FileViewer` should render sources. It should not open a native file picker, parse drag events, validate browser `File` objects, or own dropzone state.

That boundary is correct and must stay.

```txt
Dropzone owns browser intake.
Uploadable viewer adapts intake into a viewer source.
FileViewer renders the source.
```

### Dropzone Stays Headless

`useDropzone` should stay a headless intake controller. It should not know about:

- viewer layout
- `ViewerRoot`
- `FileViewer`
- file thumbnails
- selected-file sidebars
- renderer categories
- upload transport

That boundary is also correct.

### Viewer Primitives Own Layout

The uploadable viewer correctly uses:

- `ViewerRoot`
- `ViewerHeader`
- `ViewerBody`
- `ViewerSidebar`
- `ViewerSurface`

It should not invent `UploadableFileViewerFrame`, a local sidebar primitive, or a second split-pane system.

### Named Parts Are Better Than Slot Bags

The named exports are correct:

```ts
UploadableFileViewerProvider
UploadableFileViewerRoot
UploadableFileViewerHeader
UploadableFileViewerSidebar
UploadableFileViewerSurface
```

This is closer to shadcn style than a large config object:

```tsx
<DropzoneUploaderViewer
  slots={{
    header,
    sidebar,
    surface,
  }}
/>
```

The library should prefer composable named parts over nested slot configuration.

### The Provider Is Useful, Not Decoration

The provider is justified because the same headless intake machine powers multiple spatial parts:

- root drop target
- hidden input
- header upload and replace actions
- sidebar empty upload action
- surface empty-state trigger
- selected-file display
- derived viewer source

Without a provider, one of two worse shapes appears:

```tsx
const dropzone = useDropzone()

return (
  <ViewerRoot {...dropzone.getRootProps()}>
    <UploadableFileViewerHeader dropzone={dropzone} />
    <UploadableFileViewerSidebar dropzone={dropzone} />
    <UploadableFileViewerSurface dropzone={dropzone} />
  </ViewerRoot>
)
```

or:

```tsx
<UploadableFileViewer header={...} sidebar={...} surface={...} />
```

The first leaks mechanics everywhere. The second hides composition in a config object. The provider plus named parts is the correct middle: shared state without slot bags.

## Remaining Imperfections

### The Action Vocabulary Still Leaks Dropzone

The biggest remaining imperfection is this:

```ts
getRootProps
getInputProps
getButtonProps
getTriggerProps
```

These names come from `useDropzone`, not from the uploadable viewer domain.

They are not catastrophic. They are practical, typed, and preserve accessibility wiring from the headless primitive. But they reveal the mechanism.

The uploadable viewer should eventually speak in its own vocabulary:

```ts
export type UploadableFileViewerActions = {
  clearFile: () => void
  openFileDialog: () => void
  getRootDropProps: UseDropzoneReturn["getRootProps"]
  getFileInputProps: UseDropzoneReturn["getInputProps"]
  getUploadButtonProps: UseDropzoneReturn["getButtonProps"]
  getEmptySurfaceProps: UseDropzoneReturn["getTriggerProps"]
}
```

This still delegates to Dropzone internally, but the public action names describe the uploadable viewer's parts.

The more radical version is:

```ts
export type UploadableFileViewerActions = {
  clearFile: () => void
  openFileDialog: () => void
}
```

and each part calls an internal provider-only hook for prop getters. That is purer, but less useful for custom composition. The better final design is probably the named getter version, not the minimal command-only version.

The sharper distinction:

```txt
Dropzone getter names describe implementation mechanics.
Uploadable viewer getter names describe rendered affordances.
```

So this is not ideal:

```ts
getButtonProps
```

because it answers "which Dropzone helper should I call?"

This is better:

```ts
getUploadButtonProps
getReplaceButtonProps
```

because it answers "which affordance am I rendering?"

The same implementation function may power both names internally, but the exported contract should not make consumers remember Dropzone vocabulary.

### The Component Name Is Accurate But Heavy

`UploadableFileViewer` is understandable. It is not beautiful.

It communicates:

- a file is involved
- it can be uploaded or selected locally
- it renders through a viewer

But this component does not actually upload. It performs local browser file intake and preview.

Possible names:

```txt
UploadableFileViewer
FileIntakeViewer
LocalFileViewer
FilePreviewDropzone
```

`FileIntakeViewer` is the cleanest conceptual name:

```txt
FileIntakeViewer = browser File intake + viewer rendering
```

But a rename should only happen if the whole library agrees that "intake" is the canonical word. Otherwise `UploadableFileViewer` is safer and more familiar.

The naming decision should be made once, by answering this question:

```txt
Is "intake" a public word in the component library?
```

If yes, the ideal names are:

```ts
FileIntakeViewer
FileIntakeViewerProvider
FileIntakeViewerRoot
FileIntakeViewerHeader
FileIntakeViewerSidebar
FileIntakeViewerSurface
```

If no, keep:

```ts
UploadableFileViewer
```

Do not rename only halfway. A mixed vocabulary like `UploadableFileViewerProvider` plus `FileIntakeViewerSurface` would be worse than the current heaviness.

### The Sidebar Is Not Yet An Inevitable Primitive

The sidebar currently renders:

- thumbnail
- file name
- file size
- MIME type
- no-file state
- upload button when empty

That is enough. It is not perfect.

The ideal sidebar would have a dedicated selected-file display model:

```ts
export type UploadableFileSummary = {
  fileName: string
  fileSizeLabel: string
  fileTypeLabel: string
  file: File
}
```

Then the sidebar would not reach through `selectedFile.file` repeatedly. It would consume a view-specific summary.

The current direct access is acceptable because only one part needs the metadata. If header, sidebar, and surface all start formatting the same facts, `UploadableFileSummary` should be introduced immediately.

The summary should intentionally be display-focused, not a second file model.

Good:

```ts
export type UploadableFileSummary = {
  file: File
  fileName: string
  fileSizeLabel: string
  fileTypeLabel: string
}
```

Bad:

```ts
export type UploadableFileSummary = {
  id: string
  name: string
  type: string
  extension: string
  category: "pdf" | "image" | "text" | "spreadsheet" | "unknown"
  icon: React.ReactNode
  thumbnail: React.ReactNode
  source: BlobViewerSource
}
```

The bad version starts rebuilding file routing, icon selection, and viewer source state inside the sidebar model. Those responsibilities already belong elsewhere.

### Rejection Rendering Is Not Finished

The model exposes:

```ts
lastIntake: DropzoneIntake
```

But the current uploadable viewer does not yet make rejection feedback feel native to the viewer.

The ideal model would include either:

```ts
rejectionMessage: string | null
```

or:

```ts
rejection: {
  title: string
  description: string
} | null
```

The key rule: UI parts should not parse raw intake results inline.

Raw `DropzoneIntake` belongs to Dropzone. Viewer-friendly rejection display belongs to the uploadable viewer model.

The rejection model should be derived from `lastIntake` with a pure function:

```ts
function createUploadableFileViewerRejection(
  intake: DropzoneIntake
): UploadableFileViewerRejection | null
```

It should return `null` when the last intake accepted a file or when there is no meaningful user-facing rejection to render.

It should return stable text for:

- unsupported type
- file too large
- too many files
- disabled intake
- empty drag/drop payload

The viewer should not render raw Dropzone error codes. Raw codes are for tests and internal logic. The viewer should render concise user-facing copy.

The rejection belongs in the surface because it is part of the empty-file experience. The header can stay quiet unless there is evidence users miss the rejection.

### Empty State And Sidebar Trigger Semantics Need Final Naming

The root, header, sidebar, and surface all need access to the same hidden file input.

Current implementation does this through prop getters. That is correct mechanically.

The final design should distinguish trigger roles:

```ts
getUploadButtonProps
getReplaceButtonProps
getEmptySurfaceProps
getRootDropProps
getFileInputProps
```

The important detail is that `Upload file` and `Replace` may share mechanics but not semantics. Naming them separately makes analytics, accessibility labels, and future disabled states clearer.

The final action getters should also let each part set its own accessible label while preserving Dropzone wiring:

```tsx
<button
  {...getReplaceButtonProps({
    "aria-label": selectedFileSummary
      ? `Replace ${selectedFileSummary.fileName}`
      : "Upload file",
  })}
/>
```

The getter should merge props exactly the same way Dropzone does. It must not erase caller-provided class names, labels, event handlers, or disabled state.

## Controlled And Uncontrolled Behavior

The uploadable viewer must preserve Dropzone controlled/uncontrolled behavior.

### Uncontrolled

```tsx
<DropzoneUploaderViewer />
```

The component owns selected-file state internally.

### Default File

```tsx
<DropzoneUploaderViewer defaultFiles={[fileItem]} />
```

The component starts with a selected file but may replace or clear it internally.

### Controlled

```tsx
<DropzoneUploaderViewer files={files} onFilesChange={setFiles} />
```

The component reflects `files` exactly. It must not silently mutate internal state in controlled mode.

The contract should be:

- clear calls `onFilesChange([])`
- replace calls `onFilesChange([nextFile])`
- rejected intake calls `onIntake(rejectedIntake)` and does not call `onFilesChange`
- accepted intake calls `onIntake(acceptedIntake)` and `onFilesChange(nextFiles)`

### Disabled

Disabled state should mean:

- root does not accept drops
- hidden input does not open
- upload and replace triggers are disabled
- clear is unavailable unless the library explicitly decides clearing is allowed while disabled
- visual state communicates disabled affordances

The current `canClear = selectedFile !== null && !dropzone.isDisabled` is the conservative choice. It should stay unless the design language says disabled means "cannot add files but can remove the current file."

## Accessibility Requirements

The component should preserve all accessibility behavior from Dropzone prop getters.

Root:

- receives root drop props
- should not become a nested interactive region if the surface also has a trigger
- should not steal focus from explicit buttons

Hidden input:

- must remain in the DOM
- must receive file input props from the intake primitive
- should be visually hidden, not conditionally removed

Header button:

- must be a real `<button>`
- must have a stable accessible label
- must show upload or replace text based on file presence

Surface empty state:

- may be keyboard reachable if it acts as an upload trigger
- must preserve focus-visible styles
- must not trap keyboard focus

Sidebar:

- must have an `aria-label`
- should not use the thumbnail as the only file identity
- file name must be rendered as text

Rejection:

- should be associated with the empty surface or placed in a status region
- should not only be expressed through color
- should use stable text for tests

## Final Target API

### Provider

```ts
export type UploadableFileViewerProviderProps = {
  accept?: string
  defaultFiles?: DropzoneFileItem[]
  disabled?: boolean
  files?: DropzoneFileItem[]
  maxSize?: number
  onFilesChange?: (files: DropzoneFileItem[]) => void
  onIntake?: (intake: DropzoneIntake) => void
  children: React.ReactNode
}
```

This should stay.

It lets the composed viewer be uncontrolled, controlled, disabled, restricted by file type, restricted by size, and observable from the outside.

### Model

Final ideal:

```ts
export type UploadableFileViewerModel = {
  canClear: boolean
  canOpenFileDialog: boolean
  hasFile: boolean
  isDragging: boolean
  selectedFile: DropzoneFileItem | null
  selectedFileSummary: UploadableFileSummary | null
  viewerSource: BlobViewerSource | null
  rejection: UploadableFileViewerRejection | null
}
```

Support types:

```ts
export type UploadableFileSummary = {
  file: File
  fileName: string
  fileSizeLabel: string
  fileTypeLabel: string
}
```

```ts
export type UploadableFileViewerRejection = {
  title: string
  description: string
}
```

This avoids spreading raw file formatting and raw rejection parsing into parts.

### Model Creation

The model should be created in one place:

```ts
function createUploadableFileViewerModel(
  dropzone: Pick<
    UseDropzoneReturn,
    "files" | "isDragging" | "isDisabled" | "lastIntake"
  >
): UploadableFileViewerModel
```

This function should be pure except for receiving `File` objects. It should not call hooks.

The provider should be a wiring layer:

```ts
const dropzone = useDropzone(...)
const model = React.useMemo(
  () => createUploadableFileViewerModel(dropzone),
  [dropzone.files, dropzone.isDragging, dropzone.isDisabled, dropzone.lastIntake]
)
```

That makes tests easier and keeps the provider from becoming a pile of derivation logic.

### Actions

Final ideal:

```ts
export type UploadableFileViewerActions = {
  clearFile: () => void
  openFileDialog: () => void
  getRootDropProps: UseDropzoneReturn["getRootProps"]
  getFileInputProps: UseDropzoneReturn["getInputProps"]
  getUploadButtonProps: UseDropzoneReturn["getButtonProps"]
  getReplaceButtonProps: UseDropzoneReturn["getButtonProps"]
  getEmptySurfaceProps: UseDropzoneReturn["getTriggerProps"]
}
```

This still admits that the component needs prop getters for accessibility-safe composition, but it renames those getters into the uploadable viewer domain.

### Slot Hooks

Each part should receive only what it needs.

```ts
export type UploadableFileViewerRootState = {
  getFileInputProps: UploadableFileViewerActions["getFileInputProps"]
  getRootDropProps: UploadableFileViewerActions["getRootDropProps"]
  isDragging: boolean
}
```

```ts
export type UploadableFileViewerHeaderState = {
  canClear: boolean
  clearFile: UploadableFileViewerActions["clearFile"]
  getReplaceButtonProps: UploadableFileViewerActions["getReplaceButtonProps"]
  getUploadButtonProps: UploadableFileViewerActions["getUploadButtonProps"]
  selectedFileSummary: UploadableFileSummary | null
}
```

```ts
export type UploadableFileViewerSidebarState = {
  getUploadButtonProps: UploadableFileViewerActions["getUploadButtonProps"]
  selectedFileSummary: UploadableFileSummary | null
}
```

```ts
export type UploadableFileViewerSurfaceState = {
  getEmptySurfaceProps: UploadableFileViewerActions["getEmptySurfaceProps"]
  rejection: UploadableFileViewerRejection | null
  viewerSource: BlobViewerSource | null
}
```

No slot hook should return `UseDropzoneReturn`.

No slot hook should return the whole `UploadableFileViewerModel`.

No slot hook should return the whole `UploadableFileViewerActions`.

### Hook Contract

The generic hook:

```ts
useUploadableFileViewer()
```

may return the full internal context for custom power users, but the named slot hooks should be the recommended API.

Architecture tests should enforce narrow named slot hooks, not necessarily forbid the internal hook from returning the complete model/actions object.

This mirrors the shadcn compromise:

```txt
The primitive is expressive.
The common named parts are constrained.
```

## File Source Identity

The source identity should continue to use `DropzoneFileItem.id`:

```ts
blobSource(fileItem.file, {
  fileName: fileItem.file.name,
  identityKey: fileItem.id,
  mimeType: fileItem.file.type || undefined,
})
```

Do not derive `identityKey` only from:

- file name
- file size
- MIME type
- `lastModified`

Those fields can repeat when the user selects the same file again. The item id gives the viewer a better chance to reset renderer-local state when a file is intentionally reselected.

## Visual Contract

The visual contract should remain quiet and structural.

Root:

- border
- background
- drag highlight
- no decorative effects

Header:

- sidebar trigger on the left
- label and current file name
- clear and upload/replace actions on the right

Sidebar:

- no gray panel background by default
- square thumbnail
- file name aligned with metadata
- no extra nesting cards

Surface:

- full available width
- no double viewer frame
- empty state only when no source exists
- file viewer rendered bare

This matters because the uploadable viewer is a composed tool, not a marketing block.

## Composition Target

The easy API remains:

```tsx
export function DropzoneUploaderViewer(props: DropzoneUploaderViewerProps) {
  return (
    <UploadableFileViewerProvider {...providerProps}>
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

The composable API remains:

```tsx
<UploadableFileViewerProvider>
  <UploadableFileViewerRoot>
    <CustomHeader />
    <ViewerBody>
      <CustomSidebar />
      <UploadableFileViewerSurface />
    </ViewerBody>
  </UploadableFileViewerRoot>
</UploadableFileViewerProvider>
```

The component should support both without adding a slot-object API.

## Non-Goals

Do not add upload transport.

Do not add remote URL state.

Do not add file-system browsing.

Do not add multi-file queue behavior.

Do not make `FileViewer` understand browser `File`.

Do not make Dropzone understand `ViewerSource`.

Do not create compatibility aliases for old part names.

Do not add `UploadableFileViewerSummary`.

Do not add `UploadableFileViewerContent`.

Do not make the provider also render `ViewerRoot`.

Do not make the easy wrapper the only supported API.

Do not expose a `slots` object.

Do not expose a `renderSidebar` prop until there is repeated evidence that named composition is insufficient.

Do not create a separate "dropzone viewer source" type.

## Perfection Criteria

The uploadable file viewer reaches its final shape when:

- no public slot hook exposes `UseDropzoneReturn`
- public action names belong to uploadable viewer semantics, not dropzone semantics
- selected-file metadata is derived once if more than one part needs it
- rejection display is modeled once and rendered consistently
- the easy wrapper and composable parts use the same provider and state
- `FileViewer` remains source-only
- `useDropzone` remains headless and viewer-agnostic
- there are no compatibility aliases for old names
- tests prove the actual rendered hierarchy:

```txt
Provider
  Root
    Header
    Body
      Sidebar
      Surface
```

Additional criteria:

- controlled mode is tested
- disabled mode is tested
- rejected intake is rendered through viewer-specific rejection state
- reselecting the same physical file can still refresh the viewer identity
- no part duplicates file size or MIME label formatting
- no part parses `DropzoneIntake` directly
- sidebar background stays visually neutral
- square thumbnail behavior is covered
- empty surface trigger is keyboard reachable
- custom composition can use the provider and slot hooks without importing `useDropzone`

## Test Matrix

### Behavior Tests

Add or preserve tests for:

- empty state renders with no file
- selecting a file renders sidebar metadata and surface viewer
- clear removes the source and returns to empty state
- replace swaps the selected file and updates source identity
- controlled files reflect external state
- `onFilesChange` receives accepted files
- `onIntake` receives accepted and rejected intakes
- disabled mode prevents upload, replace, and clear according to the chosen policy
- unsupported type shows a viewer rejection
- too-large file shows a viewer rejection

### Architecture Tests

Architecture tests should assert:

- no `UploadableFileViewerSummary`
- no `UploadableFileViewerContent`
- no slot hook returns `UseDropzoneReturn`
- wrapper composes Provider -> Root -> Header -> Body -> Sidebar -> Surface
- `FileViewer` still receives a `BlobViewerSource`
- Dropzone files do not import `FileViewer`
- FileViewer files do not import Dropzone

### Visual Regression Tests

If visual coverage exists, test:

- square thumbnail in the sidebar
- sidebar with no gray background
- no nested file viewer frame
- header alignment at mobile and desktop widths
- empty surface trigger layout

## Cutover Policy

This component should follow the library's hard-cut policy:

- rename old fields directly
- update all call sites
- update tests in the same change
- do not keep compatibility aliases
- do not export deprecated names
- do not support both old and new action getter names

This keeps the component library sharp. The cost is a larger single diff, but the result is a cleaner API.

## Implementation Plan

1. Add pure helpers for selected file, summary, viewer source, and rejection derivation.
2. Rename action getter fields from dropzone vocabulary to uploadable-viewer vocabulary.
3. Update root, header, sidebar, and surface hooks to expose only renamed fields.
4. Add `UploadableFileSummary` if duplicated file formatting appears in more than one part.
5. Add `UploadableFileViewerRejection` when the viewer renders rejection messages directly.
6. Keep `DropzoneUploaderViewer` as the preassembled easy API.
7. Keep all layout in `ViewerRoot`, `ViewerBody`, `ViewerSidebar`, and `ViewerSurface`.
8. Add architecture tests that forbid old part names and raw `UseDropzoneReturn` slot leakage.
9. Add behavior tests for controlled files, disabled state, rejection display, and empty-surface trigger behavior.
10. Add a visual or DOM test for square sidebar thumbnails and no nested frame.
11. Run typecheck, focused dropzone tests, focused architecture tests, and registry build if the registry tree is not blocked by unrelated files.

## Final Judgment After The Next Pass

After the next pass, perfection should be judged by whether a user can read the exported names and understand the component without knowing Dropzone exists.

The internal implementation can still use Dropzone. That is not impurity. Impurity would be making every consumer speak Dropzone.

The final API should make this sentence true:

```txt
UploadableFileViewer is a local file intake viewer composed from viewer primitives.
```

No extra sentence should be needed to explain why the provider exists, why the root owns the input, why the surface receives a viewer source, or why the sidebar does not own rendering.

## Judgment

The current implementation is good.

The provider direction is not a dead end.

The remaining problem is not architecture. It is precision:

- precise vocabulary
- precise slot contracts
- precise derived model fields
- precise rejection state

The next pass should be small and surgical. A full rewrite would be worse than the current imperfection.
