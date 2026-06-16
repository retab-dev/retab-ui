# File Viewer Terminal Platonic Gap Blueprint

## Verdict

`FileViewer` is now pointed in the right direction, but it has not reached the
platonic ideal.

The public API is much cleaner than before:

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
  <FileViewerBody>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

The remaining problem is not conceptual direction. The remaining problem is
finish quality.

The provider is no longer a public concept. That was the important cut.
Now the work is subtraction, naming precision, and module boundary exactness.

## Ideal Shape

The final public grammar should feel inevitable:

```tsx
<FileViewer source={source}>
  <FileViewerHeader>
    <FileViewerSidebarTrigger />
    <FileViewerTitle />
    <FileViewerMeta />
    <FileViewerControls />
  </FileViewerHeader>

  <FileViewerBody>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

The easy API remains only omitted children:

```tsx
<FileViewer source={source} />
```

It expands to the same anatomy. It is not a second path.

## What Is Already Right

### `FileViewer` Is The Public Root

This is the correct direction.

Users should not choose between:

```tsx
<FileViewerProvider />
<FileViewer />
```

There is one public scope boundary:

```tsx
<FileViewer />
```

That aligns with shadcn taste. The public root is both the scope and the
composition boundary.

### Provider Machinery Is Demoted

`FileViewerProvider` can exist internally. It should not appear in:

- docs;
- blocks;
- public examples;
- public imports;
- public tests except architecture tests that assert its privacy.

This is acceptable because every serious compound component has internal
context. The issue was never the existence of context. The issue was exposing
context setup as a parallel user grammar.

### PDF Reuse Is Correct

`PdfViewerProvider` may consume the active file resource internally when it is
inside `FileViewer`.

This is a renderer-level bridge, not a second public file-viewer composition
path.

The public user should think:

```tsx
<FileViewer source={pdf}>...</FileViewer>
```

not:

```tsx
<FileViewerProvider source={pdf}>
  <PdfViewerProvider>...</PdfViewerProvider>
</FileViewerProvider>
```

## Implemented Cuts

### 1. `FileViewerContent` Became `FileViewerBody`

Previous:

```tsx
<FileViewerContent>
  <FileViewerSurface>
    <FileViewerDocument />
  </FileViewerSurface>
</FileViewerContent>
```

Problem:

`Content` could mean the rendered file content. But this component is actually
the layout body that contains sidebar and surface.

Current:

```tsx
<FileViewerBody>
  <FileViewerSidebar />
  <FileViewerSurface>
    <FileViewerDocument />
  </FileViewerSurface>
</FileViewerBody>
```

This mirrors the primitive:

```tsx
<ViewerBody />
```

and removes semantic ambiguity.

There should be no `FileViewerContent` compatibility alias.

### 2. Routing Moved Out Of `file-viewer.tsx`

Previous `file-viewer.tsx` owned:

- public anatomy;
- public prop types;
- narrow internal state hooks;
- default composition;
- lazy renderer imports;
- file category routing;
- unsupported fallback routing;
- leaf controls/download behavior;
- renderer prop adaptation.

This is coherent, but not Flaubertian. The file is readable, but the boundaries
are not yet exact.

Target split:

```txt
file-viewer.tsx
  public anatomy and default composition only

file-viewer-internal.tsx
  private provider, context, resource state, descriptor signal

file-viewer-document.tsx
  FileViewerDocument and document renderer lifecycle

file-viewer-route.tsx
  category-to-renderer dispatch

file-viewer-hooks.ts
  private narrow hooks used by anatomy/document
```

Only split where the split removes real conceptual load. Do not create tiny
files for aesthetics alone.

The minimum valuable extraction is:

```txt
file-viewer-route.tsx
```

because renderer dispatch is not anatomy.

### 3. The Internal Module Is Still Shipped

Because this is a shadcn registry component, internal files are still shipped as
copy-paste source.

That is not fatal, but it means privacy is enforced by:

- filename;
- absence from public exports;
- docs discipline;
- architecture tests.

It is not invisible in the package boundary sense.

Ideal discipline:

```txt
public:
  file-viewer.tsx

shipped internal:
  file-viewer-internal.tsx
  file-viewer-route.tsx
```

Internal modules must never be documented as import targets.

Tests should assert that public docs and blocks never import:

```ts
file - viewer - internal
```

### 4. The Public Hook Surface Is Still Slightly Delicate

Keep:

```ts
useFileViewerResource()
```

But its purpose must stay narrow:

```txt
give renderer-level code the active file resource
```

It must not grow into:

```ts
useFileViewer()
useFileViewerState()
useFileViewerContext()
useFileViewerControls()
```

The public component API should be composition-first, not hook-first.

Internal named parts can use private hooks. Public users should almost never
need hooks.

### 5. Default Composition Must Stay Identical To Manual Composition

This invariant matters:

```tsx
<FileViewer source={source} />
```

must be equivalent to:

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
  <FileViewerBody>
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

No hidden behavior should exist only in the shorthand path.

The default path can choose `leafControls={false}` internally to avoid duplicate
controls, but that behavior must be framed as an implementation detail of the
same composition, not a separate viewer mode.

### 6. Controls Registration Is Right, But Should Stay Invisible

The toolbar/control registration system is directionally correct:

- document renderers own document-specific state;
- header controls render in the file header;
- `FileViewer` coordinates the registration.

The risk is exposing too much machinery.

Public users should see:

```tsx
<FileViewerControls />
```

Renderer authors may use internal registration primitives.

Docs should not explain the control bus unless documenting renderer
implementation internals.

### 7. Naming Must Be Absolute

Use one word per concept:

```txt
FileViewer         root/scope
FileViewerHeader   top chrome
FileViewerBody     layout body
FileViewerSidebar  optional side region
FileViewerSurface  main visual region
FileViewerDocument rendered file document
FileViewerControls header controls
FileViewerTitle    file display name
FileViewerMeta     compact file/page/type metadata
```

Avoid mixing:

```txt
content/body
document/content
toolbar/controls
file/header
viewer/root
```

unless the distinction is real and visible.

## Final Public Export Surface

The ideal public exports are:

```ts
FileViewer
FileViewerHeader
FileViewerTitle
FileViewerMeta
FileViewerControls
FileViewerBody
FileViewerSidebar
FileViewerSidebarTrigger
FileViewerSurface
FileViewerDocument

useFileViewerResource
```

Public types:

```ts
FileViewerProps
FileViewerHeaderProps
FileViewerTitleProps
FileViewerMetaProps
FileViewerControlsProps
FileViewerBodyProps
FileViewerSidebarProps
FileViewerSidebarTriggerProps
FileViewerSurfaceProps
FileViewerDocumentProps
```

No public exports:

```ts
FileViewerProvider
FileViewerProviderProps
FileViewerContext
FileViewerContextValue
useFileViewerContext
useOptionalFileViewerResource
useFileViewer
useFileViewerHeader
useFileViewerDocument
```

## Implementation Plan

### Step 1: Rename Content To Body

Make a hard cutover:

```txt
FileViewerContent -> FileViewerBody
FileViewerContentProps -> FileViewerBodyProps
data-slot="file-viewer-content" -> data-slot="file-viewer-body"
```

Update:

- registry source;
- blocks;
- docs;
- tests;
- public registry payloads.

Do not keep aliases.

### Step 2: Extract File Routing

Move renderer dispatch out of `file-viewer.tsx`.

Target:

```tsx
// file-viewer-route.tsx
export function FileViewerRoute(props: FileViewerRouteProps) {
  ...
}
```

Keep this module internal. It exists to keep the public anatomy file exact.

### Step 3: Keep Document Lifecycle Separate From Routing

`FileViewerDocument` should own:

- fallback;
- suspense;
- error boundary;
- descriptor reset;
- stale cleanup;
- leaf controls/download flags.

`FileViewerRoute` should own only:

- category detection;
- renderer selection;
- renderer prop adaptation.

This keeps lifecycle and routing from bleeding together.

### Step 4: Tighten Architecture Tests

Tests should assert:

- `FileViewerProvider` is not exported by `file-viewer.tsx`;
- `useOptionalFileViewerResource` is not exported by `file-viewer.tsx`;
- docs and blocks never import `file-viewer-internal`;
- docs and blocks use `FileViewerBody`, not `FileViewerContent`;
- the public registry item ships internal files but does not document them;
- default composition and manual composition share the same routing behavior.

### Step 5: Update Documentation To One Canonical Grammar

Docs should teach the canonical anatomy first:

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
  <FileViewerBody>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

Then show:

```tsx
<FileViewer source={source} />
```

as shorthand only.

No provider examples.

No internal hook examples.

## Non-Goals

Do not touch file-system viewer behavior in this pass.

Do not redesign PDF state.

Do not invent a generic `DocumentViewer`.

Do not add compatibility aliases.

Do not add new public hooks.

Do not make renderer registration a documented user-facing API unless a
separate renderer-author guide explicitly needs it.

## Perfection Test

The component reaches the next plateau when a user can understand the whole
public model from this alone:

```tsx
<FileViewer source={source}>
  <FileViewerHeader />
  <FileViewerBody>
    <FileViewerSidebar />
    <FileViewerSurface>
      <FileViewerDocument />
    </FileViewerSurface>
  </FileViewerBody>
</FileViewer>
```

And the implementation has this mental model:

```txt
FileViewer
  owns file scope and root layout

FileViewerHeader
  renders title, meta, controls

FileViewerBody
  arranges sidebar and surface

FileViewerDocument
  renders the active file through the right renderer

internal provider
  creates descriptor/resource/control state

internal route
  maps file category to renderer
```

If another concept is needed to explain normal usage, the API is still too
large.

If another public component is needed to create file scope, the API has
regressed.

If `file-viewer.tsx` still reads as a router, a provider, a renderer, and an
anatomy file at once, the implementation is still below the platonic ideal.
