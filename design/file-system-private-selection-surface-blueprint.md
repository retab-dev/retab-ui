# File System Private Selection Surface Blueprint

## Verdict

Kill `FileSystemSelectionSurface` as a public and conceptual component.

Keep `<FileSystem />` as an opinionated easy preset.

Inline the default selected-file rendering privately inside the easy preset.

The ideal boundary becomes:

```txt
FileSystemProvider owns browsing state.
FileSystemBrowser renders browsing.
FileSystemSelection exposes selected source state.
FileViewer renders sources.
Viewer primitives own layout.
```

There should be no named public component whose job is “file-system selected
document surface.” That noun belongs to the caller.

## Why

`FileSystemSelectionSurface` is useful, but it weakens the architecture.

The new file-system model says the file system is not a viewer. It is a browser
and source selector. `FileSystemSelectionSurface` reintroduces a selected-file
rendering concept inside the file-system family. It is not as bad as the old
`FileSystemPreview`, but it still makes the boundary less exact.

The sharper model is:

```tsx
<FileSystemSelection>
  {({ sourceState }) =>
    sourceState.status === "ready" ? (
      <FileViewer source={sourceState.source} />
    ) : null
  }
</FileSystemSelection>
```

That says exactly what is happening:

- file-system produced a selected source state;
- caller chose what to render;
- `FileViewer` rendered the source.

No extra file-system surface noun is needed.

## What Stays

`<FileSystem />` stays.

The easy preset is still valuable because component libraries need a complete
first-run experience:

```tsx
<FileSystem
  items={items}
  loadChildren={loadChildren}
  resolveSource={resolveSource}
/>
```

That component may render a default right-hand selected-file panel internally.
This is a preset implementation detail, not a public architectural part.

The important distinction:

```txt
Good:
  FileSystem internally renders a private default selected area.

Bad:
  FileSystem exports FileSystemSelectionSurface and teaches callers to use it.
```

## Public API

The public file-system surface should be:

```txt
FileSystem
FileSystemProvider
useFileSystem

FileSystemHeader
FileSystemBrowser
FileSystemSelection
FileSystemOpenPreview

useFileSystemHeader
useFileSystemBrowser
useFileSystemSelection
useFileSystemSelectedItem
useFileSystemSelectedSource
```

Do not export:

```txt
FileSystemPreview
FileSystemSelectionSurface
FileSystemSelectedFileSurface
FileSystemSurface
FileSystemViewer*
```

`FileSystemSelection` is the only public bridge between browsing and rendering.

## Easy Preset Shape

`FileSystem` can remain a full product preset:

```tsx
export function FileSystem({ className, ...providerProps }: FileSystemProps) {
  return (
    <FileSystemProvider {...providerProps}>
      <div data-slot="file-system">
        <ViewerRoot data-viewer="file-system" bare defaultOpen>
          <ViewerHeader>
            <FileSystemHeader />
          </ViewerHeader>
          <ViewerBody>
            <ViewerSidebar aria-label="Files">
              <FileSystemBrowser />
            </ViewerSidebar>
            <ViewerSurface>
              <FileSystemSelection>
                {(selection) => (
                  <FileSystemDefaultSelectionContent selection={selection} />
                )}
              </FileSystemSelection>
            </ViewerSurface>
          </ViewerBody>
          <FileSystemOpenPreview />
        </ViewerRoot>
      </div>
    </FileSystemProvider>
  )
}
```

`FileSystemDefaultSelectionContent` is private to `file-system.tsx` or another
non-exported internal file. It is not listed in `file-system.tsx` exports. It is
not documented as a composition primitive.

## Private Default Content

The private default renderer owns only preset UI states:

```tsx
function FileSystemDefaultSelectionContent({
  selection,
}: {
  selection: FileSystemSelectionRenderState
}) {
  const { entry, renderFileActions, renderMetadata, retry, sourceState } =
    selection

  if (!entry) return <DefaultEmptySelection />
  if (entry.kind === "folder") {
    return (
      <DefaultFolderSelection
        entry={entry}
        renderMetadata={renderMetadata}
      />
    )
  }
  if (sourceState.status === "loading") return <DefaultSelectionLoading />
  if (sourceState.status === "error") {
    return <DefaultSelectionError error={sourceState.error} onRetry={retry} />
  }
  if (sourceState.status === "unavailable") {
    return <DefaultSelectionUnavailable />
  }
  if (sourceState.status !== "ready") return null

  return (
    <DefaultSelectedFileFrame
      entry={entry}
      renderFileActions={renderFileActions}
      renderMetadata={renderMetadata}
    >
      <FileViewer source={sourceState.source} bare className="size-full" />
    </DefaultSelectedFileFrame>
  )
}
```

This function is allowed to use `FileViewer` because it belongs to the easy
preset. It does not change the primitive model because it is not part of the
composed API.

## Composed API

Custom layouts should write the selected side explicitly:

```tsx
<FileSystemProvider
  items={items}
  loadChildren={loadChildren}
  resolveSource={resolveSource}
>
  <ViewerRoot>
    <FileSystemHeader />
    <ViewerBody>
      <ViewerSidebar>
        <FileSystemBrowser />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemSelection>
          {({ entry, retry, sourceState }) => {
            if (!entry) return <EmptyState />
            if (entry.kind === "folder") return <FolderInspector entry={entry} />
            if (sourceState.status === "loading") return <LoadingState />
            if (sourceState.status === "error") {
              return <ErrorState error={sourceState.error} onRetry={retry} />
            }
            if (sourceState.status !== "ready") return <UnavailableState />

            return <FileViewer source={sourceState.source} bare />
          }}
        </FileSystemSelection>
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileSystemProvider>
```

That is more verbose than a default surface, but it is honest composition.

## File Layout

Preferred file organization:

```txt
file-system.tsx
  public exports
  FileSystem easy preset
  private default selected content, if small enough

file-system-parts.tsx
  public named parts
  FileSystemHeader
  FileSystemBrowser
  FileSystemSelection
  hooks

file-system-selection-source-task.ts
  selected source lifecycle

file-system-default-selection-content.tsx
  optional private implementation detail if file-system.tsx gets too large
```

If `file-system-default-selection-content.tsx` exists, it must not be exported
from `file-system.tsx`, documented as public API, or presented as a primitive.
It is only the easy preset body.

## Naming

Use precise names:

```txt
FileSystemSelection
  public bridge from selected entry to source state

FileSystemDefaultSelectionContent
  private preset renderer

sourceState
  resolved source lifecycle state

entry
  normalized selected file-system entry

source
  ready ViewerSource
```

Avoid:

```txt
preview
surface
viewer
selectedFilePanel
selectionSurface
```

Those names blur ownership.

## Documentation Rules

Docs should teach `FileSystemSelection`, not the private renderer.

Good docs:

```tsx
<FileSystemSelection>
  {({ sourceState }) =>
    sourceState.status === "ready" ? (
      <FileViewer source={sourceState.source} bare />
    ) : null
  }
</FileSystemSelection>
```

Bad docs:

```tsx
<FileSystemSelectionSurface />
```

The default `<FileSystem />` page may say:

> The easy preset renders a default selected-file area. Use
> `FileSystemSelection` when you want to own that area.

It should not name the private default component.

## Registry Rules

The `file-system` registry item should include private implementation files
needed by `<FileSystem />`, but only `file-system.tsx` should export the public
API.

Architecture tests should enforce:

```txt
file-system.tsx does not export FileSystemSelectionSurface
file-system.tsx exports FileSystemSelection
docs do not mention FileSystemSelectionSurface
registry contains no public target named file-system-preview.tsx if that file
only exists for the old public surface
FileSystem easy preset still renders a selected source with FileViewer
```

If a private default renderer file exists, tests should allow the file to
import `FileViewer`, but should ensure `file-system-parts.tsx` does not.

## Migration Plan

1. Move the implementation of `FileSystemSelectionSurface` into a private
   `FileSystemDefaultSelectionContent` component.
2. Use that private component inside `<FileSystem />`.
3. Remove `FileSystemSelectionSurface` exports.
4. Delete or privatize `file-system-preview.tsx`.
5. Update docs to show `FileSystemSelection` plus caller-rendered `FileViewer`.
6. Update architecture tests to reject public preview/surface names.
7. Rebuild `public/r/file-system.json`.
8. Run file-system tests, architecture filter, registry preflight, payload
   alignment, and TypeScript.

## Acceptance Criteria

The design is acceptable when:

- `<FileSystem />` still works as a complete easy preset.
- composed usage has no default surface component.
- public docs teach `FileSystemSelection`.
- `FileSystemSelectionSurface` no longer appears in public exports or docs.
- `file-system-parts.tsx` does not import `FileViewer`.
- only the easy preset's private renderer imports `FileViewer`.
- the main `file-system` registry item remains Pierre-free.
- source resolution and open-preview behavior still pass existing stale-result
  and abort tests.

## Final Shape

The final model is:

```txt
Easy preset:
  FileSystem -> private default selected content -> FileViewer

Composed primitive:
  FileSystemSelection -> caller content -> FileViewer

Forbidden public concept:
  FileSystemSelectionSurface
```

This preserves ergonomics without compromising the conceptual boundary.
