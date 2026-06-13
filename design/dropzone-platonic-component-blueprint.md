# Dropzone Platonic Component Blueprint

## Verdict

No, the dropzone is not yet perfect.

It has the correct architecture: a headless primitive, a visual uploader, and
separate thumbnail rendering. The remaining work is not feature work. It is API
purification: fewer names, fewer concepts, tighter docs, and examples that prove
the primitive without teaching accidental patterns.

The goal is not to make dropzone impressive. The goal is to make it inevitable.

## Goal

Build the smallest complete file-intake primitive for React.

The primitive should answer one question:

```txt
How do browser files enter React state?
```

Everything else is composition.

## Layer Contract

```txt
dropzone-core
  Pure validation.
  No React. No DOM. No copy. No formatting.

dropzone
  Headless React file-intake behavior.
  Owns drag state, file input wiring, validation flow, selected-file state,
  disabled behavior, and prop getters.

file-thumbnail
  Visual file representation.
  Owns previews, document/image/table/media fallbacks, and preview policy.

file-uploader
  Retab upload UI.
  Owns copy, layout, thumbnails, rejection messages, browse button, and file
  queue display.

dropzone blocks
  Proof lab.
  Shows that one primitive supports many surfaces without primitive changes.
```

If a concern crosses layers, it should be treated as a design bug until proven
otherwise.

## Non-Goals

Dropzone must not own:

- thumbnails
- upload transport
- upload progress
- retry/cancel network behavior
- file viewer behavior
- file size display
- English rejection messages
- icons
- cards
- product copy
- toasts
- persistence
- analytics
- localization

Those concerns belong above the primitive.

## Public API Target

The hook remains the primitive.

```ts
type DropzoneFileItem = {
  id: string
  file: File
}

type DropzoneIntake = {
  acceptedFiles: File[]
  fileRejections: DropzoneFileRejection[]
}

type UseDropzoneProps = {
  accept?: string
  disabled?: boolean
  files?: DropzoneFileItem[]
  defaultFiles?: DropzoneFileItem[]
  maxFiles?: number
  maxSize?: number
  multiple?: boolean
  onFilesChange?: (files: DropzoneFileItem[]) => void
  onIntake?: (intake: DropzoneIntake) => void
}

type UseDropzoneReturn = {
  files: DropzoneFileItem[]
  lastIntake: DropzoneIntake
  isDragging: boolean
  isFocused: boolean
  isDisabled: boolean
  clearFiles: () => void
  removeFile: (fileId: string) => void
  reset: () => void
  resetIntake: () => void
  openFileDialog: () => void
  getRootProps: <T extends HTMLElement>(props?: RootProps<T>) => RootProps<T>
  getInputProps: (props?: InputProps) => InputProps
  getTriggerProps: <T extends HTMLElement>(
    props?: TriggerProps<T>
  ) => TriggerProps<T>
  getButtonProps: (props?: ButtonProps) => ButtonProps
}
```

This shape is close to final. The last audit is naming and getter ergonomics,
not capability.

## Naming Decisions

### `files`

`files` is short and idiomatic, but slightly ambiguous. It means selected files,
not the last browser attempt.

Final decision for now: keep `files`.

Reason:

- `selectedFiles` is clearer but heavier everywhere.
- Controlled React components commonly use short state names.
- The contrast with `lastIntake.acceptedFiles` is teachable.

If the docs repeatedly need to explain this, rename to `selectedFiles`.

### `lastIntake`

`lastIntake` is not the prettiest name, but it is honest.

It means:

- this is the latest file selection/drop attempt
- it can contain accepted and rejected files
- it is not persistent selected state
- it is not upload state

Final decision for now: keep `lastIntake`.

Reject:

- `result`: too vague
- `intake`: hides the temporal model
- `errors`: loses accepted files
- `rejections`: hides successful attempts

### `onFilesChange`

Keep.

It is the selected-state callback. It is not an upload callback and not an intake
callback.

### `onIntake`

Keep.

It is the event callback for one browser file-intake attempt. It replaces the
need for separate accepted/rejected callbacks.

## Getter Decisions

### `getRootProps`

Keep.

The root is the drop target and drag-state owner.

### `getInputProps`

Keep.

The file input is the browser contract. It should remain explicit.

### `getTriggerProps`

Keep.

This powers non-button triggers: cards, rows, canvas regions, thumbnails, and
empty states.

### `getButtonProps`

Keep for now.

It is API surface, but it makes native button semantics explicit. Removing it
would make users put button semantics through a generic trigger helper, which is
less precise.

The docs must make the rule simple:

```txt
Use getButtonProps for a real button.
Use getTriggerProps for anything else that opens the file dialog.
```

## What To Remove

Remove or avoid:

- component wrappers around the primitive unless real misuse proves they are
  needed
- duplicated return aliases like top-level `fileRejections`
- English messages in core or hook code
- visual state variants in the primitive
- upload terminology in primitive names
- example-only helper props leaking into the primitive
- callbacks that can be derived from `onIntake`

Every exported name should survive the question:

```txt
Does this name describe browser file intake, selected file state, or DOM wiring?
```

If not, it does not belong.

## What To Keep

Keep:

- controlled and uncontrolled selected files
- structured rejection facts
- accept string ergonomics
- max file count
- max byte size
- drag-depth tracking
- nested drag correctness
- disabled behavior
- event composition with `defaultPrevented`
- input value clearing for same-file reselection
- explicit reset of selected files and intake result

These are not luxuries. They are the behavior substrate.

## FileUploader Contract

`FileUploader` should be the canonical styled composition.

It should own:

- title
- description
- browse button copy
- selected-file grid
- thumbnails
- rejection copy
- empty state
- layout density

It should not own:

- validation rules beyond passing primitive props
- file identity policy
- drag event correctness
- selected-file state mechanics

`FileUploader` is allowed to be opinionated. `dropzone` is not.

## Showcase Contract

The dropzone block should prove breadth without bloating the primitive.

Required examples:

- default `FileUploader`
- non-button trigger
- native button trigger
- controlled queue
- validation-only target
- thumbnail grid
- uploader plus viewer
- avatar/image slot
- spreadsheet mapper
- media transcript queue
- comparison pair
- intake router
- required packet slots
- pinboard surface
- disabled state

The examples should be split by concept:

```txt
dropzone-block.tsx
  layout only

dropzone-trigger-examples.tsx
  trigger, button, controlled, validation, disabled

dropzone-file-examples.tsx
  thumbnails and file-type-specific compositions

dropzone-workflow-examples.tsx
  product workflows built from the same primitive

dropzone-example-shared.tsx
  local showcase helpers only
```

This modularization is good because it mirrors the abstraction:

- primitive behavior
- file display
- workflow composition
- page layout

## Test Contract

The primitive is only done when tests prove the browser contract, not just the
happy path.

Required tests:

- accept parsing for MIME, wildcard MIME, and extensions
- structured rejection facts
- max size rejection
- max files against existing selected files
- controlled state does not mutate internally
- uncontrolled rapid consecutive intake uses functional transitions
- drag depth handles nested drag enter/leave
- non-file drags do not activate file state
- dragover marks file operations as copy
- input change clears value for same-file reselection
- external handlers can prevent default primitive behavior
- disabled blocks dialog, intake, drag state, and focus state
- native button and non-button trigger semantics both work
- `FileUploader` renders visual copy outside primitive
- registry item packages every split block file

If a bug appears in product code, add a primitive-level test unless the bug is
purely visual.

## Documentation Contract

Docs should teach this order:

1. Browser file intake is not upload.
2. `useDropzone` gives state, callbacks, and props.
3. `files` are selected state.
4. `lastIntake` is the latest attempt.
5. Rejection messages are visual-layer work.
6. `FileUploader` is one styled composition.
7. The block examples show how far the primitive stretches.

Do not lead with the pretty uploader. Lead with the mental model.

## Migration Plan

### Phase 1: Freeze Capability

Do not add dropzone features until the API audit is complete.

Allowed changes:

- naming cleanup
- docs
- examples
- tests
- deletion of redundant aliases

### Phase 2: Audit Public Names

Review every exported type, prop, return field, and helper.

For each name, decide:

- keep
- rename
- hide
- delete

No compatibility alias should remain unless there is a real migration need.

### Phase 3: Tighten Examples

Keep the breadth, but remove examples that repeat the same proof.

Each example should demonstrate one distinct primitive capability:

- trigger semantics
- controlled state
- validation-only intake
- single-slot replacement
- multiple-file grid
- derived workflow lanes
- whole-surface trigger
- disabled state

### Phase 4: Rewrite Docs

Rewrite docs around the headless contract, then show `FileUploader` as a
composition.

### Phase 5: Final Test Pass

Add tests for any final naming or alias deletion. The registry split test should
stay strict.

## Perfection Checklist

The component reaches the platonic ideal when all of this is true:

- A user can explain the primitive in one sentence.
- No exported name needs an apology.
- No visual concern exists in `dropzone` or `dropzone-core`.
- No upload transport concern exists in `dropzone`.
- Every callback has a distinct temporal meaning.
- Every returned value is either state, action, or prop wiring.
- The styled uploader can be deleted without damaging the primitive.
- The block examples can be rearranged without changing primitive code.
- Tests cover failed attempts as carefully as successful attempts.
- Docs make misuse feel unnatural.

## Final Standard

The final dropzone should feel boring.

Not minimal in the sense of missing behavior. Minimal in the sense that every
remaining part is load-bearing.

The Flaubertian version is:

```txt
useDropzone turns browser file intake into selected files, an intake result,
and the props needed to wire a drop target, file input, and trigger.
```

Nothing more. Nothing less.
