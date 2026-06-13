# Dropzone Final Platonic Perfection Blueprint

## Goal

Make `dropzone` feel inevitable.

The hard cutover already moved the component to the correct architecture:

```txt
dropzone-core -> pure validation facts
dropzone      -> headless browser file-intake behavior
file-uploader -> Retab visual upload composition
file-thumbnail -> preview rendering
```

This blueprint is not about adding capability. It is about removing every
remaining ambiguity until the public API is simple, fast, exact, and hard to
misread.

## Current Verdict

We are close, but not perfect.

What is now correct:

- `dropzone` has no visual dependencies.
- `dropzone` exports no display copy.
- `dropzone` exports no byte formatting.
- `dropzone-core` is pure and framework-free.
- Rejections are structured facts.
- `onFilesChange` is the selected-file state callback.
- `onIntake` is the intake-attempt callback.
- `FileUploader` owns the Retab upload UI.
- Blocks prove many composition shapes without primitive changes.

What still blocks the platonic ideal:

- `lastIntake` is precise but not beautiful.
- `fileRejections` duplicates `lastIntake.fileRejections` for convenience.
- `getTriggerProps` and `getButtonProps` are correct but split one concept.
- Public getter prop types are verbose.
- `DropzoneState` may be more type surface than real value.
- The docs explain the API, but they do not yet make the mental model
  inescapable.
- The block lab has breadth; it should now be edited for signal.

## Definition Of Perfection

The final component should satisfy this sentence:

```txt
Dropzone normalizes browser file intake into structured React state and props.
```

Everything in the API must serve that sentence directly.

The final component should not feel configurable. It should feel composable.

## Final Public Shape

The likely final shape is:

```ts
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
  fileRejections: DropzoneFileRejection[]
  isDragging: boolean
  isFocused: boolean
  isDisabled: boolean
  clearFiles: () => void
  resetIntake: () => void
  reset: () => void
  removeFile: (fileId: string) => void
  openFileDialog: () => void
  getRootProps: <T extends HTMLElement>(props?: RootProps<T>) => RootProps<T>
  getInputProps: (props?: InputProps) => InputProps
  getTriggerProps: <T extends HTMLElement>(
    props?: TriggerProps<T>
  ) => TriggerProps<T>
  getButtonProps: (props?: ButtonProps) => ButtonProps
}
```

But every line still needs one last audit.

## The Hard Questions

### 1. Should `fileRejections` Exist?

Current:

```ts
dropzone.lastIntake.fileRejections
dropzone.fileRejections
```

Argument to keep:

- `fileRejections` is the thing visual layers read most often.
- It avoids noisy access in every composition.
- It matches the blueprint's naming target.

Argument to remove:

- It duplicates state.
- `lastIntake.fileRejections` teaches the correct temporal model.
- Removing it makes the return smaller.

Decision rule:

Keep `fileRejections` only if docs use it as the ergonomic visual-layer field
and explain that it aliases the latest intake result.

If it causes confusion, remove it.

### 2. Is `lastIntake` The Final Name?

Current:

```ts
lastIntake
```

Alternatives:

```ts
intake
intakeResult
lastResult
intakeAttempt
```

`lastIntake` is not the prettiest name, but it is the most honest. It says:

- this is one attempt
- it is the latest attempt
- it is not selected-file state
- it is not upload state

Recommendation: keep `lastIntake`.

Flaubertian test:

If a new user reads only `files`, `lastIntake`, and `onIntake`, do they
understand the difference between selected files and attempted files? If yes,
the name earns its place.

### 3. Should Trigger APIs Merge?

Current:

```tsx
<div {...dropzone.getTriggerProps()} />
<button {...dropzone.getButtonProps()} />
```

Alternative:

```tsx
<div {...dropzone.getTriggerProps()} />
<button {...dropzone.getTriggerProps({ as: "button" })} />
```

Keep both if:

- the docs can explain the split in one paragraph
- tests prove semantic differences
- consumers do not repeatedly misuse `getTriggerProps` on buttons

Merge if:

- the two helpers feel like API clutter
- docs need too much explanation
- the implementation can infer native button semantics safely

Current recommendation: keep both.

Why:

- a native button and a non-button trigger are meaningfully different
- explicit helpers make the semantic fork visible
- no hidden detection is needed

### 4. Should Component Wrappers Exist?

Current decision: no wrapper family in the public primitive source.

Keep it that way unless there is a concrete example where wrappers materially
improve accessibility or reduce repeated code.

The hook is the primitive.

Do not add:

```tsx
<DropzoneRoot />
<DropzoneInput />
<DropzoneTrigger />
<DropzoneButton />
```

unless the hook API proves too error-prone in real docs.

### 5. Should `DropzoneState` Be Public?

Current:

```ts
export type DropzoneState = {
  files: DropzoneFileItem[]
  lastIntake: DropzoneIntake
  fileRejections: DropzoneFileRejection[]
  isDragging: boolean
  isFocused: boolean
  isDisabled: boolean
}
```

Argument to keep:

- It gives consumers a reusable state shape.
- `UseDropzoneReturn = DropzoneState & actions` is clean.

Argument to remove:

- It is one more exported concept.
- Consumers rarely need it directly.
- `UseDropzoneReturn` may be enough.

Decision rule:

Search for real external or internal uses. If no one imports `DropzoneState`,
delete it and inline the return type.

## Naming Standard

Every name must answer one question.

| Name                    | Question answered                       |
| ----------------------- | --------------------------------------- |
| `files`                 | What files are currently selected?      |
| `lastIntake`            | What happened in the latest attempt?    |
| `fileRejections`        | Which files failed the latest attempt?  |
| `onFilesChange`         | When did selected file state change?    |
| `onIntake`              | When did the user attempt file intake?  |
| `clearFiles`            | How do I clear selected files?          |
| `resetIntake`           | How do I clear the latest attempt?      |
| `reset`                 | How do I clear selected files + intake? |
| `removeFile`            | How do I remove one selected file?      |
| `openFileDialog`        | How do I open the browser picker?       |
| `getRootProps`          | What props make the drop root work?     |
| `getInputProps`         | What props make the file input work?    |
| `getTriggerProps`       | What props make a custom trigger work?  |
| `getButtonProps`        | What props make a button trigger work?  |
| `DropzoneFileItem`      | What is one selected file item?         |
| `DropzoneIntake`        | What is one intake result?              |
| `DropzoneFileRejection` | Why did one file fail intake?           |

If a name answers two questions, split it.

If two names answer the same question, delete one.

## Performance Standard

The primitive should be fast by construction:

- parse `accept` once with `useMemo`
- validate files in one linear pass
- avoid string formatting in validation
- avoid visual imports
- avoid derived React state when a computed value is enough
- avoid async work
- avoid upload transport
- avoid measuring DOM
- keep drag state as simple boolean plus depth ref

Performance target:

```txt
O(n) per intake attempt
O(1) idle render work beyond selected-file array references
```

The primitive should not optimize for huge file lists with virtualization. That
belongs in visual compositions.

## Documentation Standard

The docs should teach the mental model in this order:

1. A dropzone is not a rectangle.
2. It is a headless file-intake behavior primitive.
3. `files` is selected state.
4. `lastIntake` is the latest attempt.
5. `onFilesChange` is selected-state change.
6. `onIntake` is attempt reporting.
7. `getTriggerProps` is for custom elements.
8. `getButtonProps` is for real buttons.
9. `FileUploader` is the styled composition.

The first example should show a custom headless surface, not `FileUploader`.

The second example should show a native button trigger.

The third example should show validation-only `onIntake`.

## Block Lab Standard

The block lab should not be a gallery of styling.

Keep examples that prove a different primitive capability:

- controlled selected state
- uncontrolled selected state
- validation-only intake
- non-button trigger semantics
- native button trigger semantics
- multiple independent dropzones
- one dropzone with derived routing
- single replaceable slot
- whole-surface trigger
- disabled no-op behavior

Delete examples that only change:

- icon
- wording
- card styling
- spacing
- color

The lab should be a proof suite users can see.

## Tests Required For Perfection

Unit tests must prove:

- accept parsing handles extensions, exact MIME, wildcard MIME, and blanks
- validation returns structured facts only
- no rejection object contains `message`
- non-file drags do not set dragging
- file drags set and reset dragging
- input and drop share one commit path
- `multiple={false}` only intakes one file
- `maxFiles` limits the resulting list
- controlled files stay controlled
- uncontrolled files update synchronously across rapid intake
- `onIntake` fires for accepted, rejected, and mixed attempts
- `onFilesChange` fires only when selected files change
- `clearFiles` does not clear `lastIntake`
- `resetIntake` does not clear selected files
- `reset` clears both
- non-button trigger has button role and keyboard activation
- native button trigger does not receive redundant role
- disabled state blocks file dialog and intake

Registry tests must prove:

- `dropzone` has no dependencies
- `dropzone` has no registry dependencies
- `dropzone` does not import `lucide-react`
- `dropzone` does not import `FileThumbnail`
- `dropzone` does not import file-size formatting
- `dropzone-core` does not import React
- `dropzone-core` does not contain display messages
- `file-uploader` depends on `dropzone`, `file-thumbnail`,
  `file-size-format`, and `utils`

## Implementation Plan

1. Search all exports.
   - Identify public types that are not imported anywhere.
   - Delete any type that does not earn its place.

2. Decide `fileRejections`.
   - Keep only if docs use it deliberately.
   - Otherwise remove and force `lastIntake.fileRejections`.

3. Decide trigger split.
   - Keep both only if docs and tests make the semantic distinction clear.
   - Do not add polymorphic trigger flags unless the split proves harmful.

4. Tighten docs.
   - Rewrite the first examples around the mental model.
   - Add short explanations for `files` versus `lastIntake`.
   - Add a native button example.

5. Prune block examples.
   - Keep proof cases.
   - Remove decorative duplicates.

6. Expand tests to cover every contract listed above.

7. Run verification.
   - focused dropzone tests
   - dropzone-scoped TypeScript
   - registry build
   - registry validate
   - docs page smoke test
   - blocks page smoke test

## Acceptance Criteria

The component reaches the platonic ideal only when all of these are true:

- Every exported symbol has a documented reason to exist.
- Every public name maps to one concept.
- There are exactly two callbacks unless evidence proves otherwise:
  `onFilesChange` and `onIntake`.
- The primitive remains visually empty.
- The core remains pure.
- `FileUploader` can be removed without changing `dropzone`.
- The block lab can add new upload surfaces without changing `dropzone`.
- The docs make misuse unlikely.
- The tests prove behavior rather than implementation details.
- Generated registry output contains no stale API.
- Full app verification is either green or blocked only by unrelated,
  documented failures.

## Final Cut

The ideal component should feel almost disappointing:

```ts
const dropzone = useDropzone({
  accept,
  maxFiles,
  maxSize,
  files,
  onFilesChange,
  onIntake,
})
```

No magic.

No product policy.

No visual assumptions.

Just the browser's file-intake behavior made exact, typed, and composable.
