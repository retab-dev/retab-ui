# Dropzone Viewer Composition Blueprint

## Objective

Define where file intake belongs in the viewer architecture.

The goal is to let users drag, upload, replace, inspect, and render files
without making `FileViewer` responsible for acquisition, upload workflow, or
dropzone state.

## Position

Dropzone belongs to the orchestration layer around a viewer. It does not belong
inside `FileViewer`.

`FileViewer` should render a known source:

```tsx
<FileViewer source={source} bare />
```

An uploadable viewer should compose intake, shell, metadata, and rendering:

```tsx
<ViewerDropzoneRoot dropzone={dropzone}>
  <ViewerShell>
    <ViewerDropzoneInput dropzone={dropzone} />
    <ViewerHeader actions={<UploadOrReplaceButton dropzone={dropzone} />} />
    <ViewerBody>
      <ViewerSidebar>
        <SelectedFileSummary file={selectedFile} />
      </ViewerSidebar>
      <ViewerSurface>
        {source ? <FileViewer source={source} bare /> : <UploadEmptyState />}
      </ViewerSurface>
    </ViewerBody>
  </ViewerShell>
</ViewerDropzoneRoot>
```

The correct data flow is:

```txt
browser file intake
  -> useDropzone
  -> selected File
  -> viewer source
  -> FileViewer
```

Not:

```txt
FileViewer
  -> owns drop events
  -> owns file selection
  -> owns upload replacement
  -> owns selected-file sidebar
```

## Current State

The current implementation already has the right raw materials.

### Headless Intake

`useDropzone` in `registry/new-york-v4/ui/dropzone.tsx` is a headless file
intake primitive.

It owns:

- drag state;
- focus state;
- controlled and uncontrolled file lists;
- file validation;
- file dialog opening;
- `getRootProps`;
- `getInputProps`;
- `getTriggerProps`;
- `getButtonProps`.

It does not render product UI. That is correct.

### Opinionated Upload Surface

`FileUploader` in `registry/new-york-v4/ui/file-uploader.tsx` is the default
Retab upload surface.

It owns:

- upload prompt copy;
- accepted file type visuals;
- rejection message presentation;
- selected file list presentation;
- thumbnail composition.

It should remain useful as a standalone uploader, but it should not become the
viewer upload architecture.

### Existing Uploader Viewer Block

`DropzoneUploaderViewer` in
`registry/new-york-v4/blocks/dropzone-uploader-viewer.tsx` proves the desired
experience:

- the whole viewer frame accepts drag/drop;
- the header contains upload/replace actions;
- the sidebar summarizes the selected file;
- the main surface renders the selected file or an empty upload state.

The problem is only that it currently introduces its own local layout language:

```txt
UploaderViewerRoot
UploaderViewerFrame
UploaderViewerHeader
UploaderViewerSidebar
UploaderViewerMain
UploaderViewerEmptyState
```

Those should become a concrete block built from the shared viewer shell
grammar.

## Layering

### 1. Dropzone Primitive Layer

Keep:

```ts
useDropzone
```

This layer owns mechanics only.

It should not know:

- `FileViewer`;
- `ViewerShell`;
- thumbnails as a required concept;
- upload progress;
- server persistence;
- workflow semantics;
- product copy beyond accessibility defaults.

### 2. Viewer Shell Layer

Add or reuse generic viewer slots:

```tsx
<ViewerShell>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerShell>
```

This layer owns spatial structure.

It should not know:

- whether a file came from drag/drop;
- whether a file came from an email attachment;
- whether a file came from a file-system row;
- MIME semantics;
- upload validation.

### 3. Uploadable Viewer Block Layer

Introduce an opinionated block:

```tsx
<UploadableFileViewer />
```

or:

```tsx
<DropzoneFileViewer />
```

This layer composes:

- `useDropzone`;
- hidden input;
- full-shell drop root;
- upload/replace header action;
- selected file summary;
- empty upload state;
- source creation;
- `FileViewer`.

This is the easy path.

### 4. Product Workflow Layer

Workflow-specific uploaders compose the same primitives but own product policy.

Examples:

- comparison upload: original versus revision;
- packet upload: required slots;
- workflow intake router: documents, images, tables;
- evidence timeline;
- spreadsheet import;
- avatar image slot.

These should not be forced through `UploadableFileViewer` if their workflow is
not "one selected file becomes one viewer source."

## Canonical Composition

```tsx
function UploadableFileViewer({
  accept,
  className,
  renderViewer = (source) => <FileViewer source={source} bare />,
}: UploadableFileViewerProps) {
  const dropzone = useDropzone({
    accept,
    maxFiles: 1,
    multiple: false,
  })
  const selectedFile = dropzone.files[0]
  const source = selectedFile
    ? blobSource(selectedFile.file, {
        fileName: selectedFile.file.name,
        identityKey: selectedFile.id,
        mimeType: selectedFile.file.type || undefined,
      })
    : null

  return (
    <section {...dropzone.getRootProps({ className })}>
      <input {...dropzone.getInputProps({ className: "hidden" })} />

      <ViewerShell dragging={dropzone.isDragging}>
        <ViewerHeader
          title={selectedFile?.file.name ?? "Upload file"}
          actions={
            <Button {...dropzone.getButtonProps()}>
              {selectedFile ? "Replace" : "Upload"}
            </Button>
          }
        />
        <ViewerBody>
          <ViewerSidebar>
            {selectedFile ? (
              <ViewerFileSummary file={selectedFile.file} />
            ) : (
              <ViewerUploadSummary dropzone={dropzone} />
            )}
          </ViewerSidebar>
          <ViewerSurface>
            {source ? (
              renderViewer(source)
            ) : (
              <ViewerUploadEmptyState dropzone={dropzone} />
            )}
          </ViewerSurface>
        </ViewerBody>
      </ViewerShell>
    </section>
  )
}
```

This shape preserves the structural rule:

```tsx
<header />
<div className="flex">
  <sidebar />
  <viewer />
</div>
```

## Placement Rules

### Drop Root

The drop root should wrap the largest surface that should accept file drops.

For an uploadable viewer, that is usually the whole viewer shell:

```tsx
<section {...dropzone.getRootProps()}>
  <ViewerShell />
</section>
```

For a workflow with multiple independent upload slots, the drop root should wrap
each slot, not the whole viewer.

### Hidden Input

The input should live near the root of the composed upload surface:

```tsx
<input {...dropzone.getInputProps({ className: "hidden" })} />
```

It should not live inside `FileViewer`.

### Upload Trigger

Primary upload or replace actions belong in the compound viewer header.

Secondary upload affordances can live in the empty state or sidebar.

### Sidebar

The sidebar should show the selected-file projection:

- thumbnail;
- name;
- type;
- size;
- remove or replace affordance when useful.

It should not show raw dropzone internals such as `lastIntake` unless the
product explicitly needs an error or validation panel.

### Main Surface

The main surface should render one of two states:

```tsx
source ? <FileViewer source={source} bare /> : <UploadEmptyState />
```

The empty state can be a drop trigger. The rendered viewer should not be.

## Drag State

Drag state is shell chrome, not viewer content.

Use `dropzone.isDragging` to style the outer shell or overlay:

```tsx
<ViewerShell data-dragging={dropzone.isDragging ? "" : undefined}>
  ...
</ViewerShell>
```

Recommended visual treatment:

- subtle border emphasis;
- optional translucent overlay;
- no layout shift;
- no replacement of rendered document content while dragging.

Do not mount/unmount the viewer because a drag is active.

## Empty State

The empty state is a viewer surface state, not a separate page.

It should:

- fill the viewer surface;
- be keyboard reachable through `getTriggerProps`;
- explain accepted file categories briefly;
- expose a clear upload action;
- render validation errors from `lastIntake` when relevant.

It should not:

- duplicate the full `FileUploader` visual block by default;
- introduce a nested card inside the viewer surface;
- create a second shell.

## Relationship To `FileUploader`

`FileUploader` remains the standalone upload component.

Use it when the job is "collect files."

Do not use it as the default inside an uploadable viewer, because the viewer
already has:

- a header;
- a sidebar;
- a main surface;
- a selected-file summary;
- an empty state.

Embedding `FileUploader` wholesale inside the viewer creates double framing and
duplicate hierarchy.

Shared pieces should be extracted only when they are genuinely reusable:

- `ViewerFileSummary`;
- `ViewerUploadEmptyState`;
- `getDropzoneRejectionMessage`;
- thumbnail row/card primitives.

## Relationship To Email Attachments

Email attachments are not dropzone files.

They may resolve to the same `BlobViewerSource`, but their acquisition path is
different:

```txt
MIME attachment
  -> selected attachment part
  -> blob source
  -> FileViewer
```

Dropzone should not become the universal source abstraction. It is one source
producer among others.

The common abstraction is the viewer source, not the intake mechanism.

## Recommended Public Surface

Keep low-level:

```ts
useDropzone
```

Keep standalone:

```tsx
<FileUploader />
```

Add viewer block:

```tsx
<UploadableFileViewer />
```

Possible props:

```ts
type UploadableFileViewerProps = {
  accept?: string
  className?: string
  defaultFile?: File
  file?: DropzoneFileItem
  maxSize?: number
  onFileChange?: (file: DropzoneFileItem | null) => void
  renderViewer?: (source: BlobViewerSource) => React.ReactNode
}
```

Avoid props that leak internal layout:

- `showSidebar`;
- `showHeader`;
- `sidebarPosition`;
- `emptyStateClassName`;
- `viewerWrapperClassName`.

If consumers need different structure, they should compose `useDropzone` with
`ViewerShell` directly.

## Non-Goals

Do not make `FileViewer` accept:

```ts
uploadable
dropzone
onDrop
accept
maxFiles
```

Do not make `ViewerShell` own:

```ts
files
onFilesChange
accept
maxSize
```

Do not make `useDropzone` know:

```ts
source
viewer
thumbnailSidebar
```

## Decision Rule

When deciding where an upload feature belongs, ask:

1. Is this browser file-intake mechanics?
   - Put it in `useDropzone`.
2. Is this generic viewer layout?
   - Put it in `ViewerShell`.
3. Is this "one uploaded file becomes one rendered viewer"?
   - Put it in `UploadableFileViewer`.
4. Is this a product workflow with special routing or required slots?
   - Compose `useDropzone` and `ViewerShell` directly.
5. Is this format rendering?
   - Put it in `FileViewer` or the concrete renderer.

## Final Shape

The system should have one clean sentence:

> Dropzone produces files; viewer shell arranges the experience; `FileViewer`
> renders the selected source.

