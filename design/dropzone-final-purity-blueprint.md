# Dropzone Final Purity Blueprint

## Goal

Make the dropzone primitive small enough, precise enough, and neutral enough
that there is no remaining confusion between behavior, presentation, and
product policy.

The current implementation is a strong v2. This blueprint targets the last
impurities:

- headless validation still returns English UI copy
- byte formatting still lives in the primitive core
- wrapper components may still be excess surface
- trigger helpers are correct but slightly forked
- uncontrolled file transitions can be made more mathematically exact
- the block lab proves breadth, but not minimality

The target is not more features. The target is less ambiguity.

## Current State

The current boundary is correct:

```txt
dropzone-core.ts
  accept parsing, matching, validation, byte formatting

dropzone.tsx
  useDropzone, prop getters, state, root/input/trigger wrappers

file-uploader.tsx
  default Retab visual uploader, FileThumbnail composition
```

The current public API is also mostly correct:

- `lastIntake`
- `fileRejections`
- `onIntake`
- `resetIntake`
- `reset`
- `getButtonProps`
- parsed accept rules

The remaining problem is not capability. It is purity.

## Ideal

The primitive should be purely mechanical.

It should know:

- files entered the browser file-intake surface
- some files were accepted
- some files were rejected
- these are the rejection reasons and facts
- these props make the browser interactions correct

It should not know:

- English copy
- byte display formatting
- iconography
- thumbnail presentation
- upload progress
- product-specific error wording
- whether a visual uploader should show a badge, toast, row, or inline message

## Public Rejection Model

Remove `message` from `DropzoneFileRejection`.

Current:

```ts
type DropzoneFileRejection = {
  file: File
  reason: "file-invalid-type" | "file-too-large" | "too-many-files"
  message: string
}
```

Target:

```ts
type DropzoneFileRejection =
  | {
      file: File
      reason: "file-invalid-type"
      acceptRules: DropzoneAcceptRule[]
    }
  | {
      file: File
      reason: "file-too-large"
      maxSize: number
    }
  | {
      file: File
      reason: "too-many-files"
      maxFiles: number
    }
```

Why:

- The primitive reports facts.
- The visual layer writes copy.
- Tests assert behavior, not wording.
- Consumers can localize or customize errors without fighting the primitive.

## Rejection Copy

Move rejection copy into `file-uploader`.

```ts
function getFileUploaderRejectionMessage(
  rejection: DropzoneFileRejection
): string
```

Default messages can stay exactly as they are, but they should live in the
visual composition:

```txt
file-invalid-type -> This file type is not supported here.
file-too-large    -> File must be {size} or smaller.
too-many-files    -> Only one file can be selected.
too-many-files    -> Only {maxFiles} files can be selected.
```

The block lab can either reuse this helper or define local copy. The primitive
must not export it.

## Byte Formatting

Move `formatDropzoneBytes` out of `dropzone-core`.

Preferred target:

```txt
registry/new-york-v4/ui/file-size-format.ts
  formatFileSize(bytes: number): string
```

Why:

- Byte formatting is presentation, not file intake.
- File size formatting is useful outside dropzone.
- `dropzone-core` should only contain accept parsing and validation.

Migration:

1. Add `file-size-format.ts`.
2. Update `file-uploader`, `dropzone-block`, demos, and docs to import
   `formatFileSize`.
3. Remove `formatDropzoneBytes` from `dropzone` exports.
4. Update registry dependencies so `file-uploader` and `dropzone-block` include
   the formatter when needed.

No compatibility alias.

## Core Module

After this pass, `dropzone-core.ts` should export only:

```ts
DropzoneAcceptRule
DropzoneFileRejection
DropzoneIntake
parseDropzoneAccept
matchesDropzoneAccept
validateDropzoneFile
validateDropzoneFiles
```

It should not export:

- UI messages
- byte formatting
- file ID creation
- React types
- DOM event helpers

## Component Wrappers

Audit whether these still earn their existence:

```ts
DropzoneRoot
DropzoneInput
DropzoneTrigger
useDropzoneContext
```

Decision rule:

- Keep wrappers only if docs and tests demonstrate a meaningful reduction in
  repeated code.
- Remove wrappers if all serious examples use `useDropzone` directly.

If kept, make them symmetrical:

```tsx
<DropzoneRoot>
  <DropzoneInput />
  <DropzoneTrigger />
</DropzoneRoot>
```

Question:

Should there also be a native button wrapper?

```tsx
<DropzoneButton />
```

Do not add it unless the wrapper API survives the audit. A complete wrapper
family is better than a partial one, but no wrapper family may be better than
both.

## Trigger API

The current split is:

```ts
getTriggerProps()
getButtonProps()
```

This is explicit and works. The final audit should decide whether it is the
least surprising API.

Options:

### Option A: Keep Both

```tsx
<div {...dropzone.getTriggerProps()} />
<button {...dropzone.getButtonProps()} />
```

Pros:

- exact semantics
- no flags
- easy tests

Cons:

- two helpers for one concept

### Option B: Single Getter With Element Kind

```tsx
<button {...dropzone.getTriggerProps({ triggerElement: "button" })} />
```

Pros:

- one concept

Cons:

- worse name
- easier to misuse
- adds API ceremony

Default recommendation: keep both helpers. Perfection does not always mean one
function.

## State Transition Exactness

Make uncontrolled file transitions functional.

Current risk:

- `commitFiles` closes over the rendered `files` value.
- This is fine in ordinary usage.
- It is not the strongest possible state model.

Target:

```ts
function createNextDropzoneFiles({
  files,
  acceptedFiles,
  multiple,
}: {
  files: DropzoneFileItem[]
  acceptedFiles: File[]
  multiple: boolean
}): DropzoneFileItem[]
```

Then use a functional state update in uncontrolled mode:

```ts
setUncontrolledFiles((files) => {
  const nextFiles = createNextDropzoneFiles(...)
  onFilesChange?.(nextFiles)
  return nextFiles
})
```

Controlled mode still computes from controlled `files`, but uncontrolled mode
no longer depends on a stale render closure.

Rules:

- `onFilesChange` must still fire exactly once per stored-list transition.
- `onFilesAccepted` still receives accepted raw files.
- `onIntake` still fires for every intake attempt.
- `lastIntake` updates before or with the stored-list transition; tests should
  not rely on React batching details.

## Naming

Keep these names:

- `files`
- `incomingFiles`
- `acceptedFiles`
- `fileRejections`
- `lastIntake`
- `acceptRules`
- `isDragging`
- `isFocused`
- `isDisabled`
- `hasFiles`
- `hasRejections`

Avoid introducing:

- `error`
- `message`
- `rejectedFiles`
- `items`
- `currentFiles`
- `payload`
- `result`

Names should tell the domain truth without requiring comments.

## File Uploader

`FileUploader` remains the default composition. It may own:

- icon cluster
- title
- description
- browse label
- dragging label
- file grid
- remove buttons
- rejection message copy
- file size formatting

It must not own:

- upload transport
- persistence
- progress
- retry
- folder traversal
- custom rendering framework

If consumers want custom file rendering, they should use `useDropzone`
directly.

## Block Lab

The block lab should prove the primitive with less noise.

Keep examples that prove distinct behavior:

- default `FileUploader`
- non-button trigger
- native button trigger
- controlled queue
- validation-only `onIntake`
- custom `FileThumbnail` grid
- disabled state

Remove or compress examples that differ only by copy or icon.

The lab should make the primitive contract obvious at a glance.

## Tests

Primitive tests:

- rejection objects contain structured facts and no `message`
- invalid type rejection includes `acceptRules`
- too-large rejection includes `maxSize`
- too-many-files rejection includes `maxFiles`
- `formatDropzoneBytes` is not exported from `dropzone`
- `dropzone-core` exports no presentation helpers
- uncontrolled rapid consecutive intakes use functional transitions
- controlled mode still computes from controlled `files`
- `onIntake`, `onFilesAccepted`, `onFilesRejected`, and `onFilesChange` fire
  exactly when specified
- wrapper components are tested only if they survive the audit

File uploader tests:

- visual rejection copy is rendered from structured rejections
- file size text comes from `formatFileSize`
- file grid remains inside the upload area
- no custom render props exist

Registry tests:

- `dropzone` has no visual dependencies
- `dropzone` does not contain user-facing rejection copy
- `dropzone` does not export byte formatting
- `file-uploader` owns rejection copy
- generated registry includes any new formatter dependency where needed

Browser checks:

- `/docs/components/dropzone` no longer documents `formatDropzoneBytes`
- `/docs/components/file-uploader` still renders the default uploader
- `/blocks` still renders every remaining lab variant
- no console errors

## Migration Plan

1. Change `DropzoneFileRejection` to a discriminated union with structured
   facts.
2. Move rejection messages into `file-uploader`.
3. Add `formatFileSize` outside `dropzone-core`.
4. Remove `formatDropzoneBytes` from `dropzone` exports and docs.
5. Update file uploader, block lab, demos, and tests.
6. Audit wrapper component usage.
7. Keep or remove wrappers as a hard cutover.
8. Tighten uncontrolled state transitions with functional updates.
9. Reduce the block lab to distinct primitive proofs.
10. Rebuild and validate registry output.

No shims. No old names. No compatibility layer.

## Non-Goals

- upload transport
- upload progress
- upload queue orchestration
- resumable uploads
- server persistence
- localization framework
- folder traversal
- drag sorting

Those belong above the primitive.

## Success Criteria

The final pass is complete when:

- `dropzone-core` contains only file-intake facts and pure validation.
- no English UI message exists in `dropzone` or `dropzone-core`.
- no byte display formatter is exported by `dropzone`.
- rejection objects are structured enough for any visual layer to write copy.
- state transitions are exact under rapid uncontrolled intakes.
- every public export has a documented reason to exist.
- wrapper components are either removed or proven by examples and tests.
- the block lab proves distinct primitive behaviors without repeated visual
  noise.
- tests enforce the boundary more strongly than prose.
- reading the primitive feels mechanical, inevitable, and complete.
