# File Viewer Single Root Blueprint

## Position

`FileViewerProvider` should not be public.

The public API should have one way to create file viewer scope:

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
  <FileViewerContent />
</FileViewer>
```

The provider can still exist internally. It should not be a documented or
exported composition surface.

## Why

The current split is technically meaningful but aesthetically bad:

```tsx
<FileViewerProvider source={source}>
  ...
</FileViewerProvider>
```

means:

```txt
create file context/resource, but no viewer root/layout
```

while:

```tsx
<FileViewer source={source}>
  ...
</FileViewer>
```

means:

```txt
create file context/resource and the file viewer root/layout
```

That distinction is implementation language. It asks users to choose between
"context" and "root" when the component should expose one public concept:

```txt
this is a file viewer
```

Shadcn components usually make the public root the scope boundary:

```tsx
<Dialog>
  <DialogTrigger />
  <DialogContent />
</Dialog>
```

```tsx
<Tooltip>
  <TooltipTrigger />
  <TooltipContent />
</Tooltip>
```

```tsx
<Form {...form}>
  <FormField />
</Form>
```

Users do not normally choose between:

```tsx
<DialogProvider />
<DialogRoot />
```

for the same visible component.

The file viewer should follow that taste.

## The Single Rule

`FileViewer` is always the file viewer root.

It owns:

- file source;
- file descriptor;
- file resource;
- file controls registration;
- file metadata registration;
- underlying viewer/sidebar state;
- the root layout boundary.

It has one shorthand:

```tsx
<FileViewer source={source} />
```

which expands to the canonical default children:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>

  <FileViewerContent>
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerContent>
</FileViewer>
```

This is not a second architecture. It is just omitted children.

## Public Grammar

The only public grammar should be:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>

  <FileViewerContent>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerContent>
</FileViewer>
```

No public examples should show:

```tsx
<FileViewerProvider source={source}>
  ...
</FileViewerProvider>
```

No public examples should show:

```tsx
<FileViewerProvider>
  <ViewerRoot>
    ...
  </ViewerRoot>
</FileViewerProvider>
```

## Export Surface

### Keep Public

```ts
FileViewer
FileViewerHeader
FileViewerTitle
FileViewerMeta
FileViewerControls
FileViewerContent
FileViewerSidebar
FileViewerSidebarTrigger
FileViewerSurface
FileViewerDocument

useFileViewerResource
```

`useFileViewerResource` is acceptable only if a real renderer/provider needs a
narrow bridge to the active file resource. It must not expose the whole context.

### Make Private

```ts
FileViewerProvider
FileViewerContext
FileViewerContextValue
useFileViewerContext
useOptionalFileViewerResource
```

`useOptionalFileViewerResource` exists only so renderer providers can compose
with `FileViewer` internally. It should not be a public library hook.

### Remove Public Types

```ts
FileViewerProviderProps
```

The provider is not a public component, so its props are not public API.

## Internal Shape

The implementation can still be:

```tsx
function FileViewer(props) {
  return (
    <FileViewerProvider source={props.source}>
      <ViewerRoot ...>
        {props.children ?? <DefaultFileViewerChildren />}
      </ViewerRoot>
    </FileViewerProvider>
  )
}
```

But `FileViewerProvider` should be module-private.

The user sees one root:

```tsx
<FileViewer />
```

The code may use several internal providers:

```tsx
<FileViewerContext.Provider>
  <ViewerControlsRegistrationProvider>
    <ViewerRoot>
      ...
    </ViewerRoot>
  </ViewerControlsRegistrationProvider>
</FileViewerContext.Provider>
```

That internal layering is fine because it is not public grammar.

## Renderer Provider Interaction

`PdfViewerProvider` currently needs the active file resource when it is nested
inside `FileViewer`.

The clean public usage is:

```tsx
<FileViewer source={source}>
  <PdfViewerProvider>
    <FileViewerHeader />
    <FileViewerContent>
      <FileViewerSurface>
        <PdfViewerPages />
      </FileViewerSurface>
    </FileViewerContent>
  </PdfViewerProvider>
</FileViewer>
```

`PdfViewerProvider` should acquire its resource from the enclosing file viewer
through an internal bridge.

Standalone PDF usage can still exist:

```tsx
<PdfViewerProvider source={source}>
  <PdfViewerPages />
</PdfViewerProvider>
```

That is not a file viewer path. It is a PDF primitive path.

## Sources / OCR / Evidence Workspaces

If a larger workspace needs an inner file viewer, it should still use
`FileViewer`, not `FileViewerProvider`.

Correct:

```tsx
<ViewerRoot>
  <ViewerBody>
    <ViewerSurface>
      <FileViewer source={source} bare>
        <FileViewerHeader />
        <FileViewerContent>
          <FileViewerSurface>
            <PdfViewerPages />
          </FileViewerSurface>
        </FileViewerContent>
      </FileViewer>
    </ViewerSurface>

    <ViewerSidebar>
      <EvidenceFields />
    </ViewerSidebar>
  </ViewerBody>
</ViewerRoot>
```

Incorrect:

```tsx
<ViewerRoot>
  <ViewerBody>
    <ViewerSurface>
      <FileViewerProvider source={source}>
        <FileViewerHeader />
        <PdfViewerPages />
      </FileViewerProvider>
    </ViewerSurface>
  </ViewerBody>
</ViewerRoot>
```

The second shape hides that there is a nested file viewer. It is shorter, but
less honest.

## Tests To Add

### Public Export Test

Assert the public module does not export the provider:

```ts
expect(Object.keys(FileViewerModule)).not.toContain("FileViewerProvider")
expect(Object.keys(FileViewerModule)).not.toContain("FileViewerProviderProps")
expect(Object.keys(FileViewerModule)).not.toContain(
  "useOptionalFileViewerResource"
)
```

Assert the public module exports the single-root grammar:

```ts
expect(Object.keys(FileViewerModule)).toEqual(
  expect.arrayContaining([
    "FileViewer",
    "FileViewerHeader",
    "FileViewerTitle",
    "FileViewerMeta",
    "FileViewerControls",
    "FileViewerContent",
    "FileViewerSidebar",
    "FileViewerSidebarTrigger",
    "FileViewerSurface",
    "FileViewerDocument",
    "useFileViewerResource",
  ])
)
```

### Source Audit

Assert docs, blocks, and registry payloads do not contain:

```txt
<FileViewerProvider
export function FileViewerProvider
export type FileViewerProviderProps
```

The only acceptable occurrences should be inside `file-viewer.tsx` as private
implementation details:

```txt
function FileViewerProvider
type FileViewerProviderProps
```

### Composition Audit

Assert file-backed PDF examples use:

```tsx
<FileViewer source={source}>
  <PdfViewerProvider>
```

not:

```tsx
<FileViewerProvider source={source}>
```

and not:

```tsx
<PdfViewerProvider source={source}>
```

inside a file viewer.

## Migration Plan

### 1. Make Provider Private

In `file-viewer.tsx`:

- change `export type FileViewerProviderProps` to `type FileViewerProviderProps`;
- change `export function FileViewerProvider` to `function FileViewerProvider`;
- keep its implementation unchanged initially.

### 2. Remove Public Optional Hook

Change:

```ts
export function useOptionalFileViewerResource()
```

to either:

```ts
function useOptionalFileViewerResource()
```

or move it behind a private internal import if `PdfViewerProvider` lives in a
different module.

If cross-module access is required, use an explicit internal file:

```ts
file-viewer-internal.ts
```

but do not expose it from the registry item's documented public API.

### 3. Replace Remaining Provider Call Sites

Every current external call site should become `FileViewer`.

Before:

```tsx
<FileViewerProvider source={source}>
  <FileViewerHeader />
  <PdfViewerProvider>
    <PdfViewerPages />
  </PdfViewerProvider>
</FileViewerProvider>
```

After:

```tsx
<FileViewer source={source} bare>
  <PdfViewerProvider>
    <FileViewerHeader />
    <FileViewerContent>
      <FileViewerSurface>
        <PdfViewerPages />
      </FileViewerSurface>
    </FileViewerContent>
  </PdfViewerProvider>
</FileViewer>
```

### 4. Update Docs

Docs should say:

```txt
FileViewer is the provider.
```

Not:

```txt
FileViewerProvider is an advanced escape hatch.
```

There should be no escape hatch unless a real use case proves it.

### 5. Regenerate Registry

Regenerate:

```txt
file-viewer
pdf-viewer
pdf-thumbnails-block
split-viewer-block
partition-viewer-block
sources-viewer-block
```

and any block that previously imported `FileViewerProvider`.

### 6. Verify

Run:

```bash
pnpm typecheck
pnpm test -- tests/file-viewer.test.tsx tests/pdf-viewer.test.tsx tests/viewer-architecture.test.ts
```

Then run static audits:

```bash
rg "<FileViewerProvider|export function FileViewerProvider|export type FileViewerProviderProps" \
  content registry public/r components tests
```

The only allowed source occurrence is private implementation in
`registry/new-york-v4/ui/file-viewer.tsx`.

## Final Shape

The final design should be boring:

```tsx
<FileViewer source={source} />
```

or:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>
  <FileViewerContent>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerContent>
</FileViewer>
```

That is one public root, one public grammar, one way to do file viewer
composition.
