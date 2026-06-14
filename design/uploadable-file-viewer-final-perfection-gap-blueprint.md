# File Intake Viewer Platonic Rename Blueprint

## Scope

This blueprint covers the final gap after implementing the current uploadable viewer pass:

- `UploadableFileViewerModel`
- semantic file-intake action names
- narrow slot hooks
- selected-file summary derivation
- viewer-specific rejection state
- controlled, disabled, rejection, and thumbnail tests

It makes the final naming decision: the component should become `FileIntakeViewer`.

The architecture is no longer the problem. The last gap is vocabulary precision and surface-area exactness.

## Current Judgment

We have reached a good design.

We have not reached perfection.

The component now has the right structural shape:

```tsx
<FileIntakeViewerProvider>
  <FileIntakeViewerRoot>
    <FileIntakeViewerHeader />
    <ViewerBody>
      <FileIntakeViewerSidebar />
      <FileIntakeViewerSurface />
    </ViewerBody>
  </FileIntakeViewerRoot>
</FileIntakeViewerProvider>
```

The right ownership boundaries are in place:

- Dropzone owns browser file intake.
- File intake viewer owns local-file-to-viewer-source adaptation.
- `FileViewer` owns rendering.
- Viewer primitives own layout.

The remaining imperfection is not composition. It is final API exactness.

## Remaining Questions

There are no longer two open questions. The naming question is decided.

The component should be named:

```ts
FileIntakeViewer
```

That name says:

```txt
browser File intake + viewer rendering
```

The current name says:

```txt
a file viewer for files that could be uploaded
```

That is close, but not perfect.

Because this library is optimizing for exact component boundaries, precision wins. `FileIntakeViewer` is the public name.

The remaining question is only whether `openFileDialog` and `canOpenFileDialog` deserve to exist. They do not, unless proven by a real call site.

The current model/action shape includes:

```ts
canOpenFileDialog: boolean
openFileDialog: () => void
```

The named parts currently do not need these directly. They use semantic prop getters:

```ts
getUploadButtonProps
getReplaceButtonProps
getEmptySurfaceProps
```

Those prop getters already preserve native input behavior, disabled state, event merging, focus state, keyboard behavior, and accessibility attributes.

By the "everything needed, nothing more" standard, unused commands are suspicious.

## Naming Decision

Hard-cut rename:

```ts
FileIntakeViewerProvider
FileIntakeViewerRoot
FileIntakeViewerHeader
FileIntakeViewerSidebar
FileIntakeViewerSurface
FileIntakeViewerModel
FileIntakeViewerActions
FileIntakeViewerRejection
FileIntakeSummary
```

The preassembled easy wrapper should be named:

```ts
FileIntakeViewer
```

The named parts should use the same prefix.

Do not keep the old uploadable names as aliases.

Do not keep `DropzoneUploaderViewer` as the conceptual public component. If a block wrapper still needs a legacy file name for registry reasons, that file should export the new `FileIntakeViewer` component API. The code users compose should say `FileIntakeViewer`.

The vocabulary rule is:

```txt
intake = browser File selection and drag/drop
upload = transport to a remote destination
viewer = rendering an existing source
```

This gives the system clean nouns:

- `Dropzone`: headless browser file intake primitive
- `FileIntakeViewer`: composed local-file intake plus viewer surface
- `FileUploader`: visual file queue/intake UI, not transport unless explicitly wired
- `FileViewer`: source renderer

## Action Surface Audit

The final action surface should be judged by this rule:

```txt
Expose prop getters for rendered affordances.
Expose commands only when custom parts need command-only behavior.
```

Current action shape:

```ts
export type FileIntakeViewerActions = {
  clearFile: () => void
  openFileDialog: () => void
  getRootDropProps: UseDropzoneReturn["getRootProps"]
  getFileInputProps: UseDropzoneReturn["getInputProps"]
  getUploadButtonProps: UseDropzoneReturn["getButtonProps"]
  getReplaceButtonProps: UseDropzoneReturn["getButtonProps"]
  getEmptySurfaceProps: UseDropzoneReturn["getTriggerProps"]
}
```

`clearFile` is justified because the header clear button calls it directly.

The prop getters are justified because they preserve accessibility and event composition for rendered affordances.

`openFileDialog` is not currently justified by named parts.

### Option A: Remove `openFileDialog`

Final action shape:

```ts
export type FileIntakeViewerActions = {
  clearFile: () => void
  getRootDropProps: UseDropzoneReturn["getRootProps"]
  getFileInputProps: UseDropzoneReturn["getInputProps"]
  getUploadButtonProps: UseDropzoneReturn["getButtonProps"]
  getReplaceButtonProps: UseDropzoneReturn["getButtonProps"]
  getEmptySurfaceProps: UseDropzoneReturn["getTriggerProps"]
}
```

This is the stricter "nothing more" version.

### Option B: Keep `openFileDialog`

Keep it only if there is a real custom composition use case:

```tsx
function CustomToolbarButton() {
  const { actions } = useFileIntakeViewer()

  return <MenuItem onSelect={actions.openFileDialog}>Choose file</MenuItem>
}
```

This is useful when the trigger is not a button-like DOM node that can receive a getter.

But if that use case is not present in the codebase, it is speculative.

## Model Surface Audit

Current model shape includes:

```ts
canOpenFileDialog: boolean
```

No named part currently needs it.

Disabled state is already carried by the prop getters:

- upload button is disabled
- replace button is disabled
- empty surface receives disabled trigger semantics
- root drop target ignores drops
- hidden input is disabled

`canOpenFileDialog` should only stay if custom parts need to branch without rendering a getter-backed trigger.

Otherwise it should be removed.

## Recommended Final Cut

Rename the component family to `FileIntakeViewer`.

Remove:

```ts
openFileDialog
canOpenFileDialog
```

Rationale:

- the architecture is already right
- the action getter names are already semantic
- the named parts do not need command-only opening
- fewer exported capabilities means a tighter component
- the name becomes exact: the component performs intake, not upload

## Final Target Shape

```ts
export type FileIntakeViewerModel = {
  canClear: boolean
  hasFile: boolean
  isDragging: boolean
  rejection: FileIntakeViewerRejection | null
  selectedFile: DropzoneFileItem | null
  selectedFileSummary: FileIntakeSummary | null
  viewerSource: BlobViewerSource | null
}
```

```ts
export type FileIntakeViewerActions = {
  clearFile: () => void
  getRootDropProps: UseDropzoneReturn["getRootProps"]
  getFileInputProps: UseDropzoneReturn["getInputProps"]
  getUploadButtonProps: UseDropzoneReturn["getButtonProps"]
  getReplaceButtonProps: UseDropzoneReturn["getButtonProps"]
  getEmptySurfaceProps: UseDropzoneReturn["getTriggerProps"]
}
```

No `openFileDialog`.

No `canOpenFileDialog`.

No `UploadableFileViewer*`.

No compatibility aliases.

## Tests

Architecture tests should assert:

- `FileIntakeViewerProvider`
- `FileIntakeViewerRoot`
- `FileIntakeViewerHeader`
- `FileIntakeViewerSidebar`
- `FileIntakeViewerSurface`
- `FileIntakeViewerModel`
- `FileIntakeViewerActions`
- `FileIntakeSummary`
- `FileIntakeViewerRejection`
- `openFileDialog: () => void` is not in `FileIntakeViewerActions`
- `canOpenFileDialog` is not in `FileIntakeViewerModel`
- no `UploadableFileViewer`
- no `DropzoneUploaderViewer` public component
- semantic prop getters remain present
- named slot hooks still expose only needed fields

Behavior tests do not need new coverage if existing tests still prove:

- upload button opens through getter
- replace button opens through getter
- empty surface opens through getter
- disabled state disables trigger affordances

## Non-Goals

Do not preserve uploadable aliases.

Do not preserve `DropzoneUploaderViewer` as the public component name.

Do not change registry item names unless the registry can absorb that hard cut cleanly in the same pass. Registry item filenames may lag component names only if the exported API is already `FileIntakeViewer`.

Do not overhaul docs headings in this pass beyond names required by the component hard cut.

Do not remove the semantic prop getters.

Do not make custom consumers import `useDropzone`.

Do not add slot objects or render props.

## Completion Criteria

This final gap is closed when:

- `UploadableFileViewer*` is hard-renamed to `FileIntakeViewer*`
- `UploadableFileSummary` is hard-renamed to `FileIntakeSummary`
- `UploadableFileViewerRejection` is hard-renamed to `FileIntakeViewerRejection`
- `DropzoneUploaderViewer` is removed as a public component name
- `openFileDialog` is removed from file-intake viewer actions
- `canOpenFileDialog` is removed from file-intake viewer model
- all named parts still work
- focused dropzone behavior tests pass
- file-intake viewer architecture tests pass
- TypeScript passes
- targeted `dropzone-block` registry item builds

At that point, the component is close enough to the platonic ideal that remaining discussion should be about global docs and examples, not local architecture or component naming.
