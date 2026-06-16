# Viewer Controls Rename Blueprint

## Position

`control` is the right word.

The viewer system should stop using `toolbar` as the name for the shared
document control strip. A toolbar is a visual implementation detail. A control
is the semantic thing the component exposes: page navigation, zoom, rotate,
fullscreen, download, copy, wrap, and other operations that manipulate the
current view or file.

The target vocabulary is:

```txt
title     what is this?
meta      what passive facts describe it?
controls  how do I operate it?
```

The file header anatomy stays:

```tsx
<FileHeader>
  <ViewerSidebarTrigger />
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

`ViewerSidebarTrigger` remains separate because it controls viewer layout. It is
not a file control.

## Problem

The current implementation has the right public file header word:

```tsx
<FileHeaderControls />
```

But internally it still renders and registers through `ViewerToolbar`:

```tsx
<ViewerToolbar />
ViewerToolbarState
ViewerToolbarRegistrationProvider
useViewerToolbarRegistration
ViewerToolbarSkeleton
```

That is not perfectly consistent. It asks the reader to translate between two
words for one concept.

```txt
FileHeaderControls -> ViewerToolbar
```

The ideal system should read without translation:

```txt
FileHeaderControls -> ViewerControls
```

## Target Names

Hard rename:

```txt
viewer-toolbar.tsx                  -> viewer-controls.tsx
viewer-toolbar registry item        -> viewer-controls

ViewerToolbar                       -> ViewerControls
ViewerToolbarProps                  -> ViewerControlsProps
ViewerToolbarState                  -> ViewerControlsState
ViewerToolbarPosition               -> ViewerControlPosition
ViewerToolbarZoom                   -> ViewerZoomControl
ViewerToolbarRotate                 -> ViewerRotateControl
ViewerToolbarRegistration           -> ViewerControlsRegistration
ViewerToolbarRegistrationProvider   -> ViewerControlsRegistrationProvider
useViewerToolbarRegistration        -> useViewerControlsRegistration
ViewerToolbarSkeleton               -> ViewerControlsSkeleton
ViewerToolbarSkeletonProps          -> ViewerControlsSkeletonProps
ViewerToolbarButton                 -> ViewerControlButton
ViewerToolbarSeparator              -> ViewerControlSeparator
formatViewerToolbarPosition         -> formatViewerControlPosition
VIEWER_TOOLBAR_HEIGHT_PX            -> VIEWER_CONTROLS_HEIGHT_PX
```

Use plural for the main component:

```tsx
<ViewerControls />
```

because it renders a group.

Use singular only for one actual control:

```tsx
<ViewerControlButton />
```

## Naming Rules

### Good

```txt
FileHeaderControls
ViewerControls
ViewerControlsState
ViewerControlsRegistrationProvider
useViewerControlsRegistration
ViewerControlsSkeleton
ViewerControlButton
ViewerControlSeparator
ViewerZoomControl
ViewerRotateControl
ViewerControlPosition
```

### Bad

```txt
FileHeaderToolbar
ViewerToolbar
ViewerToolbarState
useViewerToolbarRegistration
ToolbarState
toolbarState
toolbarDownloadActions
```

### Allowed Temporarily During The Cut

Nothing.

This should be a hard rename. No aliases, no compatibility wrappers, no
deprecated exports.

The project guideline is explicit: no backward-compatible fallback paths for
this kind of design cleanup.

## Component Boundary

`FileHeaderControls` is the file-header slot.

`ViewerControls` is the reusable generic control strip.

That distinction is important:

```txt
FileHeaderControls
  owns header placement, file fallback downloads, and file-provider context

ViewerControls
  owns the generic visual/control grammar for position, zoom, rotate, download,
  loading, and extra controls
```

`FileHeaderControls` should remain the public file viewer component:

```tsx
export function FileHeaderControls(props: FileHeaderControlsProps) {
  return <ViewerControls {...normalizedControls} />
}
```

`ViewerControls` should remain domain-neutral:

```tsx
<ViewerControls
  position={position}
  zoom={zoom}
  rotate={rotate}
  downloads={downloads}
  extra={extra}
/>
```

It must not know about:

- files;
- PDF;
- split;
- partition;
- OCR;
- email;
- extraction sources;
- file systems.

## Registration Model

The registration channel should also use `controls`.

Target:

```ts
export type ViewerControlsState = {
  position?: ViewerControlPosition | null
  zoom?: ViewerZoomControl | null
  rotate?: ViewerRotateControl | null
  downloads?: ViewerDownloadAction[]
  extra?: React.ReactNode
}

type ViewerControlsRegistration = (state: ViewerControlsState | null) => void
```

Provider:

```tsx
<ViewerControlsRegistrationProvider onControlsChange={setControlsState}>
  {children}
</ViewerControlsRegistrationProvider>
```

Hook:

```ts
const registerControls = useViewerControlsRegistration()
```

Renderer registration:

```ts
React.useEffect(() => {
  registerControls?.({
    position,
    zoom,
    rotate,
    downloads,
  })

  return () => registerControls?.(null)
}, [registerControls, position, zoom, rotate, downloads])
```

Avoid `onToolbarStateChange`, `toolbarState`, and `registerToolbar`.

Use:

```txt
controlsState
setControlsState
onControlsChange
registerControls
```

## Public Props

Do not rename renderer props such as:

```ts
toolbar?: boolean
```

in this cut unless every viewer can be renamed coherently.

Those props are public file-type viewer toggles and have wider blast radius.
They can remain as a visual compatibility word for now, or become a separate
future cut:

```txt
toolbar?: boolean -> controls?: boolean
```

This blueprint is about the shared primitive and its registration model.

## Files To Rename

Rename both local and registry copies:

```txt
components/ui/viewer-toolbar.tsx
registry/new-york-v4/ui/viewer-toolbar.tsx
```

to:

```txt
components/ui/viewer-controls.tsx
registry/new-york-v4/ui/viewer-controls.tsx
```

Update registry metadata:

```txt
viewer-toolbar -> viewer-controls
@ui/viewer-toolbar.tsx -> @ui/viewer-controls.tsx
```

Update all registry dependencies from:

```json
"viewer-toolbar"
```

to:

```json
"viewer-controls"
```

## Import Updates

Update every import of the shared primitive:

```ts
import { ViewerToolbar } from "@/components/ui/viewer-toolbar"
```

to:

```ts
import { ViewerControls } from "@/components/ui/viewer-controls"
```

Apply the same rule to:

- PDF viewer content and states;
- DOCX viewer content;
- image viewer content/chrome;
- PPTX viewer;
- XLSX viewer session/chrome;
- CSV viewer chrome;
- code viewer chrome;
- text viewer chrome;
- markdown document viewer;
- file viewer;
- tests;
- public registry payloads after rebuild.

## Type Updates

Every `Toolbar` type in the shared primitive should become `Controls`.

Examples:

```ts
ViewerToolbarProps -> ViewerControlsProps
ViewerToolbarState -> ViewerControlsState
ViewerToolbarZoom -> ViewerZoomControl
ViewerToolbarRotate -> ViewerRotateControl
```

But viewer-specific components need judgment.

This cut should rename shared primitive wrappers where they are thin wrappers
around the shared control strip:

```txt
PdfViewerToolbar       -> PdfViewerControls
CsvViewerToolbar       -> CsvViewerControls
TextViewerToolbar      -> TextViewerControls
CodeViewerToolbar      -> CodeViewerControls
```

Only do this if all call sites can move cleanly in the same commit.

If a viewer-specific component is public and documented, either:

1. rename it everywhere with no alias; or
2. leave viewer-specific toolbar names for a second explicit cut.

The stricter platonic answer is to rename them now.

## Data Slot Updates

Data slots should follow the semantic name:

```txt
data-slot="viewer-toolbar"          -> data-slot="viewer-controls"
data-slot="viewer-toolbar-skeleton" -> data-slot="viewer-controls-skeleton"
```

This affects tests and CSS selectors if any exist.

## Constants

Rename:

```ts
VIEWER_TOOLBAR_HEIGHT_PX
```

to:

```ts
VIEWER_CONTROLS_HEIGHT_PX
```

This is not cosmetic. It is used in layout math, so the name should match the
thing being measured.

## Docs

Documentation should say `controls`, not `toolbar`, when discussing the shared
viewer primitive or file header.

Good:

```txt
The controls expose zoom, rotate, page position, and download.
```

Bad:

```txt
The toolbar exposes zoom, rotate, page position, and download.
```

Public prop tables with `toolbar?: boolean` can stay until the prop itself is
renamed. Do not lie in docs: if the prop is still named `toolbar`, document it
as `toolbar`.

## Architecture Tests

Update the architecture invariant:

```txt
keeps document viewer controls on the shared ViewerControls primitive
```

Required assertions:

- registry item `viewer-controls` exists;
- registry item `viewer-toolbar` does not exist;
- no source imports `viewer-toolbar`;
- no shared source exports `ViewerToolbar`;
- `file-viewer` depends on `viewer-controls`;
- every document viewer control wrapper imports `ViewerControls`;
- public registry payloads match source after `pnpm registry:build`.

Negative assertions:

```ts
expect(source).not.toContain("ViewerToolbar")
expect(source).not.toContain("viewer-toolbar")
expect(source).not.toContain("toolbarState")
expect(source).not.toContain("registerToolbar")
```

Scope those negatives to the shared primitive and file-header system if the
public `toolbar?: boolean` props remain.

## Migration Steps

1. Rename files:
   - `components/ui/viewer-toolbar.tsx`
   - `registry/new-york-v4/ui/viewer-toolbar.tsx`

2. Rename exports inside both files.

3. Rename imports and identifiers across registry and local component copies.

4. Rename file viewer control state:

   ```txt
   toolbarState -> controlsState
   setToolbarState -> setControlsState
   handleToolbarStateChange -> handleControlsChange
   ```

5. Rename PDF registration:

   ```txt
   useViewerToolbarRegistration -> useViewerControlsRegistration
   onToolbarStateChange -> registerControls
   toolbarState -> controlsState
   ```

6. Rename registry item:

   ```txt
   viewer-toolbar -> viewer-controls
   ```

7. Update architecture tests.

8. Run registry build:

   ```bash
   pnpm registry:build
   ```

9. Verify:

   ```bash
   pnpm exec tsc --noEmit --pretty false
   pnpm exec vitest run tests/file-viewer.test.tsx tests/pdf-viewer.test.tsx tests/viewer-architecture.test.ts tests/segment-surfaces.test.tsx --reporter=dot
   git diff --check
   ```

## Non-Goals

Do not redesign `FileHeader`.

Do not merge `ViewerSidebarTrigger` into `FileHeaderControls`.

Do not touch file-system internals.

Do not introduce compatibility aliases.

Do not create a generic `FileHeaderActions`.

Do not rename domain actions where the word truly means a state transition or
command list unrelated to visible controls.

## Acceptance Criteria

The implementation is done when:

- `ViewerToolbar` no longer exists;
- `viewer-toolbar.tsx` no longer exists;
- the registry item is `viewer-controls`;
- `FileHeaderControls` renders `ViewerControls`;
- renderer registration uses `controls` naming;
- tests protect against reintroducing shared `toolbar` vocabulary;
- generated registry payloads are synchronized;
- docs teach `controls` as the shared vocabulary;
- public file header anatomy remains:

```tsx
<FileHeader>
  <ViewerSidebarTrigger />
  <FileHeaderTitle />
  <FileHeaderMeta />
  <FileHeaderControls />
</FileHeader>
```

At that point the language is exact:

```txt
FileHeaderControls = file header slot
ViewerControls     = shared viewer control strip
controlsState      = active renderer controls
```

No translation layer remains.
