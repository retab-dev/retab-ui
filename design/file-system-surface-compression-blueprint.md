# File System Surface Compression Blueprint

## Purpose

`file-system-provider.tsx` is now clean wiring.

That was the right previous step. The provider no longer reads like a hidden
controller. It wires:

- source resolution;
- open-preview source lifecycle;
- kernel runtime;
- browser projection;
- preview projection;
- renderers;
- context.

The remaining problem is different.

The component surface is still large. A reader still has to hold too many
concepts under one name:

```txt
FileSystem
  items
  title
  className
  path / defaultPath / onPathChange
  view / defaultView / onViewChange
  query / defaultQuery / onQueryChange
  selectedPath / defaultSelectedPath / onSelectionChange
  loadChildren
  resolveSource
  onFileOpen
  renderFileActions
  renderMetadata
```

This is not bad because the props are wrong. Most of them are necessary.

It is not yet platonic because the flat surface makes different concerns look
equally central. `items`, `loadChildren`, `resolveSource`, `query`,
`selectedPath`, and `renderMetadata` all sit at the same altitude even though
they belong to different parts of the product.

The next improvement is surface compression:

```txt
same behavior
same viewer primitive boundary
fewer top-level concepts
more exact module entry points
no provider nesting
no compatibility layer
```

## Judgment

Do not improve this by adding another provider.

Do not improve this by hiding the component behind a generic shell.

Do not improve this by making `Viewer` aware of file-system concerns.

The right move is to make the large surface indexed:

```txt
FileSystemData
  items, loadChildren

FileSystemState
  path, view, query, selection

FileSystemSources
  resolveSource, onFileOpen, preview/open tasks

FileSystemRenderers
  renderFileActions, renderMetadata

FileSystemChrome
  title, className
```

The surface remains complete, but the reader no longer has to parse one flat
prop bag as if every prop belonged to the same axis.

This is an API and module-boundary pass, not a lifecycle rewrite.

## Current Shape

Current public props:

```ts
export type FileSystemProps = {
  items: FileSystemItem[]
  title?: string
  className?: string
  defaultPath?: string
  path?: string
  onPathChange?: (path: string) => void
  defaultView?: FileSystemView
  view?: FileSystemView
  onViewChange?: (view: FileSystemView) => void
  defaultQuery?: Partial<FileSystemQueryState>
  query?: FileSystemQueryState
  onQueryChange?: (query: FileSystemQueryState) => void
  selectedPath?: string | null
  defaultSelectedPath?: string | null
  onSelectionChange?: (item: FileSystemItem | null) => void
  loadChildren?: (...) => Promise<FileSystemLoadChildrenResult>
  resolveSource?: (...) => Promise<ViewerSource | null>
  onFileOpen?: (file: FileSystemFileItem, source: ViewerSource | null) => void
  renderFileActions?: (file: FileSystemFileItem) => React.ReactNode
  renderMetadata?: (item: FileSystemItem) => React.ReactNode
}
```

Current provider wiring:

```ts
const source = useFileSystemSourceController(...)
const openPreview = useFileSystemOpenPreviewController(...)
const kernel = useFileSystemKernelRuntime(...)
const browser = selectFileSystemBrowserState(...)
const preview = selectFileSystemPreviewState(...)
```

This is clean, but the naming still exposes one large conceptual product.

## Target Mental Model

The ideal file-system component should read as five crisp surfaces:

```txt
data
  what exists and how children load

state
  where the browser is, what is selected, how it is filtered and sorted

sources
  how files become ViewerSource objects, and what happens when opened

renderers
  custom leaf UI

chrome
  title, outer className
```

The internal modules should mirror that:

```txt
file-system-data.ts
  data props and data normalization contract

file-system-controlled-state.ts
  controlled/default state props

file-system-sources.ts
  source props, source controller, preview/open task wiring

file-system-renderers.ts
  renderer props and renderer context shape

file-system-provider.tsx
  still only wires the products together
```

This is not more abstraction. It is a table of contents.

## Public API Target

The next public API should be grouped:

```ts
export type FileSystemProps = {
  data: FileSystemDataOptions
  state?: FileSystemControlledState
  defaultState?: FileSystemDefaultState
  sources?: FileSystemSourceOptions
  renderers?: FileSystemRendererOptions
  chrome?: FileSystemChromeOptions
}
```

Types:

```ts
export type FileSystemDataOptions = {
  items: FileSystemItem[]
  loadChildren?: FileSystemLoadChildren
}

export type FileSystemControlledState = {
  path?: string
  view?: FileSystemView
  query?: FileSystemQueryState
  selectedPath?: string | null
  onPathChange?: (path: string) => void
  onViewChange?: (view: FileSystemView) => void
  onQueryChange?: (query: FileSystemQueryState) => void
  onSelectionChange?: (item: FileSystemItem | null) => void
}

export type FileSystemDefaultState = {
  path?: string
  view?: FileSystemView
  query?: Partial<FileSystemQueryState>
  selectedPath?: string | null
}

export type FileSystemSourceOptions = {
  resolveSource?: FileSystemResolveSource
  onFileOpen?: (file: FileSystemFileItem, source: ViewerSource | null) => void
}

export type FileSystemRendererOptions = {
  fileActions?: (file: FileSystemFileItem) => React.ReactNode
  metadata?: (item: FileSystemItem) => React.ReactNode
}

export type FileSystemChromeOptions = {
  title?: string
  className?: string
}
```

Usage:

```tsx
<FileSystem
  data={{
    items,
    loadChildren,
  }}
  defaultState={{
    path: "reports/",
    view: "list",
  }}
  sources={{
    resolveSource,
    onFileOpen,
  }}
  renderers={{
    fileActions: renderFileActions,
    metadata: renderMetadata,
  }}
  chrome={{
    title: "Files",
  }}
/>
```

The easy API stays easy because most users only need:

```tsx
<FileSystem data={{ items }} />
```

## Why This Is Better

The grouped surface makes intent immediate:

```txt
data.items
  canonical input

data.loadChildren
  data loading extension

state.path
  controlled browser path

defaultState.path
  uncontrolled initial browser path

sources.resolveSource
  file-to-viewer-source resolution

renderers.metadata
  custom visual metadata

chrome.title
  display title
```

The current flat surface makes this harder:

```txt
items
loadChildren
path
defaultPath
resolveSource
renderMetadata
title
```

The names are individually clear, but the grouping is missing.

## Hard Cutover Rule

Do not support both API shapes.

This repo's design principle is hard cutover. The final implementation should
not contain:

- `legacyProps`;
- `normalizeFileSystemProps`;
- support for both `items` and `data.items`;
- deprecation aliases;
- runtime warnings;
- old prop names preserved for compatibility.

If this blueprint is implemented, update every call site and every doc example.

The implementation should have one public grammar.

## Provider Target

The provider should become even more obviously indexed:

```ts
export function FileSystemProvider({
  children,
  data,
  defaultState,
  state,
  sources,
  renderers,
  chrome,
}: FileSystemProviderProps) {
  const fileSources = useFileSystemSources({
    items: data.items,
    resolveSource: sources?.resolveSource,
    onFileOpen: sources?.onFileOpen,
  })

  const kernel = useFileSystemKernelRuntime({
    data,
    state,
    defaultState,
    onFileCommand: fileSources.open,
  })

  const browser = useFileSystemBrowserProjection(kernel)
  const preview = useFileSystemPreviewProjection({
    kernel,
    resolveFileSource: fileSources.resolveFileSource,
  })

  const value = useFileSystemContextValue({
    browser,
    preview,
    openPreview: fileSources.openPreview,
    renderers,
    title: chrome?.title ?? "Files",
  })

  return <FileSystemContext.Provider value={value}>{children}</FileSystemContext.Provider>
}
```

This is still one provider.

It is cleaner because the provider names the four product surfaces instead of
accepting one large destructured prop list.

## Internal Module Plan

### 1. `file-system-data.ts`

Own:

- `FileSystemDataOptions`;
- `FileSystemLoadChildren`;
- `FileSystemLoadChildrenArgs`;
- `FileSystemLoadChildrenResult`;
- item normalization contract if it ever leaves `file-system-index.ts`.

Do not own:

- query;
- selection;
- view;
- source resolution;
- renderers.

### 2. `file-system-controlled-state.ts`

Own:

- `FileSystemControlledState`;
- `FileSystemDefaultState`;
- conversion into kernel runtime props.

It should not own the reducer. It only names the public controlled-state
contract.

Good:

```ts
export function createFileSystemKernelRuntimeStateProps({
  state,
  defaultState,
}: {
  state?: FileSystemControlledState
  defaultState?: FileSystemDefaultState
}): FileSystemKernelRuntimeStateProps
```

Bad:

```ts
export function useFileSystemControlledState(...)
```

The kernel already owns the runtime state. Do not add another state hook.

### 3. `file-system-sources.ts`

Own:

- `FileSystemSourceOptions`;
- `FileSystemResolveSource`;
- `useFileSystemSources`;
- source controller;
- preview task binding;
- open-preview task binding.

Current files can remain separate internally:

```txt
file-system-source-controller.ts
file-system-preview-source-task.ts
file-system-open-source-task.ts
file-system-sources.ts
```

The new file is the product index, not a replacement for the small tasks.

### 4. `file-system-renderers.ts`

Own:

- `FileSystemRendererOptions`;
- context renderer shape.

Rename the public keys:

```txt
renderFileActions -> renderers.fileActions
renderMetadata -> renderers.metadata
```

Inside context:

```ts
export type FileSystemRenderers = {
  fileActions?: FileSystemRendererOptions["fileActions"]
  metadata?: FileSystemRendererOptions["metadata"]
}
```

Do not keep both old and new names.

### 5. `file-system-chrome.ts`

Own:

- `FileSystemChromeOptions`;
- default title;
- optional outer className.

This is intentionally small. If it feels silly after implementation, keep the
type in `file-system-types.ts` and do not create the file. The goal is concept
compression, not file count.

## Easy API Target

`FileSystem` should remain a preassembled viewer composition:

```tsx
export function FileSystem({
  data,
  state,
  defaultState,
  sources,
  renderers,
  chrome,
}: FileSystemProps) {
  return (
    <FileSystemProvider
      data={data}
      state={state}
      defaultState={defaultState}
      sources={sources}
      renderers={renderers}
      chrome={chrome}
    >
      <ViewerRoot data-viewer="file-system" bare defaultSidebarOpen>
        <ViewerHeader>
          <FileSystemHeader />
        </ViewerHeader>
        <ViewerBody>
          <ViewerSidebar aria-label="Files">
            <FileSystemBrowser />
          </ViewerSidebar>
          <ViewerSurface>
            <FileSystemPreview />
          </ViewerSurface>
        </ViewerBody>
        <FileSystemOpenPreview />
      </ViewerRoot>
    </FileSystemProvider>
  )
}
```

`Viewer` stays unchanged.

## Named-Part API Target

Composed usage should also use grouped props:

```tsx
<FileSystemProvider
  data={{ items, loadChildren }}
  sources={{ resolveSource }}
  defaultState={{ path: "reports/" }}
>
  <ViewerRoot>
    <ViewerHeader>
      <FileSystemHeader />
    </ViewerHeader>
    <ViewerBody>
      <ViewerSidebar>
        <FileSystemBrowser />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemPreview />
      </ViewerSurface>
    </ViewerBody>
    <FileSystemOpenPreview />
  </ViewerRoot>
</FileSystemProvider>
```

This preserves the shadcn-like composition model while shrinking the mental
surface of the provider.

## What Not To Do

Do not do this:

```tsx
<FileSystemDataProvider>
  <FileSystemStateProvider>
    <FileSystemSourceProvider>
      ...
    </FileSystemSourceProvider>
  </FileSystemStateProvider>
</FileSystemDataProvider>
```

That makes the component look more modular while increasing usage cost.

Do not do this:

```tsx
<FileSystemProvider config={{ ...everything }} />
```

That hides the prop list without adding meaning.

Do not do this:

```tsx
<ViewerRoot fileSystem={...}>
```

That pollutes the viewer primitive.

Do not do this:

```ts
type FileSystemOptions = FileSystemDataOptions &
  FileSystemControlledState &
  FileSystemSourceOptions &
  FileSystemRendererOptions
```

That recreates the flat surface under a new name.

## Naming Rules

Use these exact concepts:

```txt
data
state
defaultState
sources
renderers
chrome
```

Do not use:

```txt
options
config
model
controller
behavior
features
slots
shell
```

Reason:

- `data` is concrete;
- `state` is the controlled external state;
- `defaultState` is the uncontrolled initial state;
- `sources` are file-to-viewer-source lifecycles;
- `renderers` are consumer-rendered UI;
- `chrome` is the outer display frame.

## Migration Plan

### Phase 1: Introduce Grouped Types Only

Add:

```txt
file-system-data.ts
file-system-controlled-state.ts
file-system-sources.ts
file-system-renderers.ts
```

Move or re-export type definitions from `file-system-types.ts` only if the move
reduces clarity. Do not move types just to satisfy the blueprint.

The first proof is that `FileSystemProps` becomes grouped and easier to read.

### Phase 2: Hard-Cut Public Props

Replace flat props with grouped props:

```txt
items -> data.items
loadChildren -> data.loadChildren
path -> state.path
view -> state.view
query -> state.query
selectedPath -> state.selectedPath
defaultPath -> defaultState.path
defaultView -> defaultState.view
defaultQuery -> defaultState.query
defaultSelectedPath -> defaultState.selectedPath
resolveSource -> sources.resolveSource
onFileOpen -> sources.onFileOpen
renderFileActions -> renderers.fileActions
renderMetadata -> renderers.metadata
title -> chrome.title
className -> chrome.className
```

Update all call sites in:

- registry blocks;
- docs;
- tests;
- demos;
- generated registry output.

Do not keep old props.

### Phase 3: Compress Provider Wiring

Replace the long destructuring in `FileSystemProvider` with grouped inputs.

Target:

```ts
const source = useFileSystemSourceController({
  items: data.items,
  resolveSource: sources?.resolveSource,
})

const kernel = useFileSystemKernelRuntime({
  items: data.items,
  loadChildren: data.loadChildren,
  defaultPath: defaultState?.path,
  defaultView: defaultState?.view,
  defaultQuery: defaultState?.query,
  defaultSelectedPath: defaultState?.selectedPath,
  path: state?.path,
  view: state?.view,
  query: state?.query,
  selectedPath: state?.selectedPath,
  onPathChange: state?.onPathChange,
  onViewChange: state?.onViewChange,
  onQueryChange: state?.onQueryChange,
  onSelectionChange: state?.onSelectionChange,
})
```

This is still explicit. Do not build a clever mapper unless repetition becomes
materially harmful.

### Phase 4: Make Source Wiring A Product Module

Create:

```ts
export function useFileSystemSources({
  items,
  sources,
}: {
  items: FileSystemItem[]
  sources?: FileSystemSourceOptions
})
```

Return:

```ts
{
  resolveFileSource,
  openPreview,
}
```

This removes source lifecycle details from the provider without hiding them in
a generic controller.

### Phase 5: Architecture Tests

Add assertions:

- `FileSystemProps` contains `data: FileSystemDataOptions`;
- `FileSystemProps` contains `state?: FileSystemControlledState`;
- `FileSystemProps` contains `defaultState?: FileSystemDefaultState`;
- `FileSystemProps` contains `sources?: FileSystemSourceOptions`;
- `FileSystemProps` contains `renderers?: FileSystemRendererOptions`;
- `FileSystemProps` contains `chrome?: FileSystemChromeOptions`;
- `FileSystemProps` does not contain top-level `items:`;
- `FileSystemProps` does not contain top-level `defaultPath:`;
- `FileSystemProps` does not contain top-level `resolveSource:`;
- `FileSystemProvider` destructures grouped props, not every leaf prop;
- docs teach grouped usage.

### Phase 6: Registry Build

Run:

```bash
bun run registry:build
```

Then scan generated output for old public props.

## Test Plan

Run:

```bash
bunx vitest run tests/file-system-kernel.test.ts tests/file-system.test.tsx tests/file-system-pierre-input.test.ts tests/file-system-pierre-lifecycle.test.ts
bunx vitest run tests/viewer-architecture.test.ts -t "file-system"
bunx tsc --noEmit --pretty false
bun run registry:build
```

Scans:

```bash
rg "<FileSystem[^>]*(items=|defaultPath=|path=|resolveSource=|renderMetadata=|renderFileActions=)" registry components content tests
rg "<FileSystemProvider[^>]*(items=|defaultPath=|path=|resolveSource=|renderMetadata=|renderFileActions=)" registry components content tests
rg "defaultPath\\?|resolveSource\\?|renderMetadata\\?|renderFileActions\\?" registry/new-york-v4/ui/file-system-types.ts
```

Expected:

- no easy API call site uses flat file-system props;
- no provider call site uses flat file-system props;
- old flat public prop names do not remain in `FileSystemProps`;
- internal kernel runtime may still use leaf names because it is not the public
  API.

## Acceptance Criteria

The pass is complete when:

- `FileSystemProps` has six top-level concepts or fewer;
- `FileSystemProviderProps` uses the same grouped grammar;
- `FileSystem` remains the easy preassembled composition;
- named parts still compose through one `FileSystemProvider`;
- no additional provider is introduced;
- no `Viewer` primitive changes are required;
- no old flat public prop aliases remain;
- source lifecycle remains split between preview and open tasks;
- kernel/runtime behavior remains unchanged;
- all file-system tests pass;
- registry output is rebuilt;
- architecture tests enforce the grouped grammar.

## Risk Assessment

### Risk: Nested Props Hurt Simple Usage

Mitigation:

The simple case remains one line:

```tsx
<FileSystem data={{ items }} />
```

This is acceptable because the component has crossed the threshold where flat
props are no longer simpler.

### Risk: Grouped Props Become A Dumping Ground

Mitigation:

Each group must have a coherent noun:

- `data` gets only item loading;
- `state` gets only controlled state and callbacks;
- `defaultState` gets only initial uncontrolled state;
- `sources` gets only file-to-source and open callbacks;
- `renderers` gets only custom render functions;
- `chrome` gets only display frame props.

If a future prop does not clearly fit, pause and name the missing concept.

### Risk: Implementation Adds Mappers Everywhere

Mitigation:

Prefer explicit wiring over generic prop normalization.

Good:

```ts
defaultPath: defaultState?.path
```

Bad:

```ts
...normalizeFileSystemStateProps(state, defaultState)
```

The goal is reader compression, not cleverness.

### Risk: Public API Churn

Mitigation:

This is an intentional hard cutover. Do not preserve the old shape. Update
docs, examples, tests, and registry entries in the same change.

## Final Judgment

The state-machine pass made the internals correct.

This pass makes the public and module surface proportionate.

The platonic `FileSystem` should not be tiny. It is a real file explorer with
preview, lazy loading, source resolution, and list memory. But its surface
should be indexed so precisely that a reader knows where to look immediately.

The target sentence:

```txt
FileSystem has one provider, one kernel, two source tasks, one list-memory
policy, and a public API grouped by data, state, sources, renderers, and chrome.
```

When that sentence is true in code, the component is not smaller by pretending.
It is smaller because the right boundaries are visible.
