# Dropzone Platonic Ideal Blueprint

## Goal

Refine the current `dropzone` primitive until the API is exact, minimal, fast,
and hard to misuse.

The first blueprint established the correct boundary:

```txt
dropzone      -> headless file-intake behavior
file-uploader -> Retab visual upload composition
```

This blueprint is the second pass. It removes remaining ambiguity, names state
precisely, tightens validation, and reduces public surface until each exported
line earns its place.

## Current Verdict

The current implementation has the right shape, but it is not yet the platonic
ideal.

What is correct:

- `dropzone` has no visual dependencies.
- `file-uploader` composes `dropzone` and `file-thumbnail`.
- Drag/drop and input selection share one commit path.
- Validation is exported and tested.
- The block lab proves multiple UI shapes can share one behavior primitive.

What is still imprecise:

- `acceptedFiles` and `rejectedFiles` sound like complete state, but they are
  the last intake result.
- `clearFiles()` clears stored files but leaves the last intake result alive.
- `getTriggerProps()` is tuned for `div` triggers and is not perfectly named or
  typed for native `button` triggers.
- The component wrapper layer may expose more API than the primitive needs.
- Accept parsing is repeated during validation instead of normalized once.
- The visual `FileUploader` has too many customization slots for a default
  composition.

## Ideal

A dropzone is a behavior primitive for file intake. It is not a component
shape.

It should answer these questions and no others:

- Is a file drag active?
- Is the intake disabled?
- Which files are currently selected?
- What happened in the last intake attempt?
- Which props make this root, input, and trigger behave correctly?

It should not answer:

- What does the uploader look like?
- How are thumbnails rendered?
- How is upload progress shown?
- How are files persisted?
- What copy appears on screen?

## Public API

### Types

Use names that state exactly what they mean.

```ts
type DropzoneFileItem = {
  id: string
  file: File
}

type DropzoneFileRejection = {
  file: File
  reason: "file-invalid-type" | "file-too-large" | "too-many-files"
  message: string
}

type DropzoneIntake = {
  acceptedFiles: File[]
  fileRejections: DropzoneFileRejection[]
}

type DropzoneState = {
  files: DropzoneFileItem[]
  lastIntake: DropzoneIntake
  isDragging: boolean
  isFocused: boolean
  isDisabled: boolean
  hasFiles: boolean
  hasRejections: boolean
}
```

`acceptedFiles` belongs inside `lastIntake`, where its scope is unambiguous.
`fileRejections` is better than `rejectedFiles` because the rejection is not a
file. It is a file plus a reason.

### Hook Props

```ts
type UseDropzoneProps = {
  accept?: string
  disabled?: boolean
  files?: DropzoneFileItem[]
  defaultFiles?: DropzoneFileItem[]
  maxFiles?: number
  maxSize?: number
  multiple?: boolean
  onFilesAccepted?: (files: File[]) => void
  onFilesChange?: (files: DropzoneFileItem[]) => void
  onFilesRejected?: (fileRejections: DropzoneFileRejection[]) => void
  onIntake?: (intake: DropzoneIntake) => void
}
```

`onIntake` is the precise callback for validation-only and analytics use cases.
It avoids forcing consumers to reconstruct the last attempt from separate
callbacks.

### Hook Return

```ts
type UseDropzoneReturn = DropzoneState & {
  clearFiles: () => void
  resetIntake: () => void
  reset: () => void
  openFileDialog: () => void
  removeFile: (fileId: string) => void
  getRootProps: <T extends HTMLElement>(
    props?: DropzoneRootProps<T>
  ) => DropzoneRootProps<T>
  getInputProps: (props?: DropzoneInputProps) => DropzoneInputProps
  getTriggerProps: <T extends HTMLElement>(
    props?: DropzoneTriggerProps<T>
  ) => DropzoneTriggerProps<T>
}
```

Semantics:

- `clearFiles()` clears only selected files.
- `resetIntake()` clears only the last intake result.
- `reset()` clears files and intake result.
- `removeFile()` removes a file and leaves the last intake result untouched.

This makes state transitions explicit instead of surprising.

## Component Surface

The hook is the primitive.

Keep component wrappers only if they remove repeated code without creating a
second conceptual API.

Preferred exported surface:

```ts
useDropzone
DropzoneRoot
DropzoneInput
DropzoneTrigger
useDropzoneContext
matchesDropzoneAccept
parseDropzoneAccept
validateDropzoneFile
validateDropzoneFiles
formatDropzoneBytes
```

Remove the `Dropzone` alias unless the docs prove it improves clarity. The
alias makes `Dropzone` sound like the visual upload area again, which is the
wrong mental model.

## Accept Parsing

Split accept parsing from accept matching.

```ts
type DropzoneAcceptRule =
  | { type: "extension"; value: string }
  | { type: "mime"; value: string }
  | { type: "mime-prefix"; value: string }

function parseDropzoneAccept(accept?: string): DropzoneAcceptRule[]
function matchesDropzoneAccept(
  file: File,
  accept: string | DropzoneAcceptRule[]
): boolean
```

Rules:

- Parse once in `useDropzone` with `useMemo`.
- Keep `matchesDropzoneAccept(file, acceptString)` for direct convenience.
- Lowercase extensions and MIME values once during parsing.
- Ignore empty tokens.
- Treat unknown tokens as non-matching rules, not runtime errors.

This is faster, clearer, and easier to test.

## State Machine

Use a tiny reducer if it reduces ambiguity. Do not add a reducer for ceremony.

The conceptual state transitions are:

```txt
idle
  -> file drag enters root
dragging
  -> drag leaves root depth
idle
  -> files dropped or selected
intake committed
  -> resetIntake
idle with files
  -> reset
idle empty
```

The reducer should own:

- selected file items in uncontrolled mode
- last intake result
- drag depth
- focus state

Controlled file state remains controlled:

- Never write internal file items when `files` is provided.
- Still write `lastIntake`, `isDragging`, and `isFocused` internally.
- `onFilesChange` is emitted for every accepted stored-list transition.

## File Intake Contract

One function should commit all incoming files:

```ts
commitFiles(files: FileList | File[]): DropzoneIntake
```

Rules:

- Disabled intake is a no-op.
- `multiple={false}` validates only the first incoming file.
- `maxFiles` limits the resulting selected file list.
- Input selection clears the input value after commit.
- Dropping non-file drags does not call `preventDefault`.
- `onIntake` fires for every file intake attempt, including all-rejected
  attempts.
- `onFilesAccepted` fires only when accepted incoming files exist.
- `onFilesRejected` fires only when rejections exist.
- `onFilesChange` fires only when stored selected files change.

## Trigger Contract

The trigger API must support both native buttons and non-button elements.

Options:

```ts
type DropzoneTriggerProps<T extends HTMLElement> = React.HTMLAttributes<T> & {
  asButton?: boolean
}
```

Rules:

- For non-button triggers, default to `role="button"` and `tabIndex=0`.
- For native buttons, consumers should be able to pass `asButton: true` so the
  primitive does not add redundant role semantics.
- Enter and Space activate non-button triggers.
- Native buttons rely on their native keyboard behavior.
- Disabled non-button triggers get `aria-disabled` and `tabIndex=-1`.
- Disabled native buttons should be allowed to receive `disabled`.

If `asButton` feels too awkward, expose separate helpers:

```ts
getTriggerProps()
getButtonProps()
```

Choose the version that reads best in the block lab.

## Data Attributes

Stable data attributes are part of the primitive contract.

Root:

```txt
data-slot="dropzone"
data-dragging
data-disabled
data-has-files
data-has-rejections
```

Input:

```txt
data-slot="dropzone-input"
```

Trigger:

```txt
data-slot="dropzone-trigger"
data-focused
data-disabled
```

Use empty string for present boolean attributes. Use `undefined` when absent.

## File Uploader Composition

`FileUploader` should become more opinionated, not more configurable.

Keep:

- `title`
- `description`
- `browseLabel`
- `draggingLabel`
- `acceptedFileTypes`
- `showFileList`

Question:

- `renderFileItem`
- `renderFileList`

These props are useful, but they may belong in a separate `FileUploaderRoot` or
not at all. If a consumer needs custom rendering, the primitive already makes
that simple. The default uploader should not become a rendering framework.

Decision rule:

- Keep `renderFileList` only if the docs show a real Retab use case.
- Remove `renderFileItem` unless it is used in production.

## Module Shape

Start with one file if the code stays readable. Split only along stable
responsibility boundaries.

Ideal final shape:

```txt
registry/new-york-v4/ui/dropzone.tsx
  public React hook/components

registry/new-york-v4/ui/dropzone-core.ts
  accept parsing, validation, file IDs, pure helpers

registry/new-york-v4/ui/file-uploader.tsx
  default visual uploader
```

Do not create `dropzone-state.ts` or `dropzone-events.ts` unless those modules
remove real complexity. More files are not better modularization by default.

## Naming Rules

Use one term per concept:

- `files`: selected `DropzoneFileItem[]`
- `incomingFiles`: raw files entering commit
- `acceptedFiles`: accepted raw files from one intake
- `fileRejections`: rejected raw files from one intake
- `nextFiles`: next selected file items
- `lastIntake`: the most recent intake result
- `acceptRules`: parsed accept rules
- `isDragging`: active file drag over the root
- `isFocused`: trigger focus state

Avoid:

- `rejectedFiles`
- `currentFiles`
- `nextItems`
- `acceptedItems`

Those names hide the exact domain object.

## Tests

Add or update tests before calling the hardening pass complete.

Primitive tests:

- `lastIntake` is updated after accepted, rejected, and mixed intakes.
- `clearFiles()` does not clear `lastIntake`.
- `resetIntake()` does not clear selected files.
- `reset()` clears both selected files and `lastIntake`.
- `onIntake` fires for all intake attempts.
- `parseDropzoneAccept` normalizes extensions, exact MIME, and MIME prefixes.
- `useDropzone` parses accept rules once per accept string.
- native button trigger does not receive redundant role semantics.
- non-button trigger receives keyboard activation semantics.
- disabled native and non-button triggers behave correctly.

Composition tests:

- `FileUploader` reads `lastIntake.fileRejections`.
- removing a file does not clear the last rejection message unless the design
  explicitly says it should.
- file list still renders inside the dropzone.
- `FileUploader` has no upload transport assumptions.

Block lab tests:

- each custom uploader uses `useDropzone` directly.
- the block includes native button and non-button trigger examples.
- validation-only target uses `onIntake`.

## Migration Plan

1. Introduce `lastIntake`, `fileRejections`, `resetIntake`, and `reset`.
2. Update `FileUploader` and blocks to read `lastIntake.fileRejections`.
3. Add `onIntake`.
4. Add `parseDropzoneAccept` and support parsed accept rules internally.
5. Tighten trigger semantics for native buttons.
6. Remove or justify the `Dropzone` alias.
7. Reassess `renderFileItem` and `renderFileList`.
8. Update docs after the API is final.
9. Rebuild and validate the registry.

No compatibility shims. Update call sites directly.

## Non-Goals

- Upload transport
- Progress tracking
- Retry logic
- Folder traversal
- Drag sorting
- File preview generation
- Server persistence
- Form integration beyond standard callbacks

Those are higher-level compositions.

## Success Criteria

The component reaches the platonic ideal when:

- Every public state name is exact.
- Every public method has one obvious semantic meaning.
- The primitive has no visual dependency or visual opinion.
- `FileUploader` is clearly one default composition, not the primitive.
- A consumer can build toolbar, table-cell, modal, validation-only, and grid
  uploaders without copying behavior.
- Accept parsing is normalized and tested.
- Trigger accessibility is correct for both native and non-native triggers.
- There is no exported alias or prop that exists only for convenience.
- The tests describe the contract better than prose can.
- Reading the file feels like reading the domain model, not implementation
  scaffolding.
