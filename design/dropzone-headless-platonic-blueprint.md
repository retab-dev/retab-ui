# Dropzone Headless Platonic Blueprint

## Goal

Turn `dropzone` into the smallest complete file-intake primitive in the
registry.

The target is not a better upload card. The target is a behavior primitive that
can power any upload surface:

- full file uploader
- compact toolbar attachment
- table cell attachment
- comparison pair
- required document slots
- validation-only target
- routed inbox
- thumbnail grid
- pinboard canvas

The visual `FileUploader` should remain one composition on top of the primitive,
not the primitive itself.

## Current Verdict

The architecture is right, but the component has not reached the platonic ideal.

What is correct:

- `dropzone` is headless.
- `file-uploader` owns visual upload UI.
- `file-thumbnail` owns preview rendering.
- `dropzone-core` owns pure accept parsing, matching, and validation.
- Rejections are structured facts, not English messages.
- Drag/drop and file input selection share one commit path.
- The blocks tab proves the primitive composes into many different surfaces.

What still needs pressure:

- The public callback surface may be slightly too wide.
- `lastIntake` is accurate but not obviously beautiful.
- `getTriggerProps` and `getButtonProps` are explicit, but they create two ways
  to say "open file dialog".
- Component wrappers may be secondary API surface that few consumers need.
- The docs need to teach the headless model before showing the styled uploader.
- The block examples prove breadth; they do not prove minimality.

## First Principles

The browser owns file selection.

The primitive owns file-intake mechanics:

- drag state
- file input wiring
- keyboard activation
- disabled behavior
- accept matching
- max size validation
- max file validation
- controlled and uncontrolled selected file state
- last intake result
- callback dispatch

The consumer owns everything else:

- layout
- copy
- thumbnails
- icons
- file size formatting
- progress
- upload transport
- persistence
- routing
- analytics
- localization
- destructive actions

If a concern is visual, product-specific, or transport-specific, it does not
belong in `dropzone`.

## Layer Model

```txt
dropzone-core.ts
  Pure file validation:
  parse accept strings, match files, return structured intake facts.

dropzone.tsx
  Headless React behavior:
  useDropzone, prop getters, internal state, optional wrappers.

file-thumbnail.tsx
  File preview rendering:
  PDF/image/document/table/audio visual representation.

file-uploader.tsx
  Retab visual composition:
  upload area, titles, descriptions, file grid, rejection copy.

dropzone-block.tsx
  Lab surfaces:
  examples that prove the primitive is not biased toward one UI.
```

## Non-Goals

`dropzone` must not include:

- thumbnail rendering
- upload progress
- network upload code
- retry/cancel upload transport
- English rejection messages
- byte display formatting
- icons
- cards
- toasts
- tables
- product copy
- file preview policy

Those belong in compositions.

## Target Public API

The hook should remain the primary API.

```ts
type DropzoneFileItem = {
  id: string
  file: File
}

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
  fileRejections: DropzoneFileRejection[]
  isDragging: boolean
  isFocused: boolean
  isDisabled: boolean
  clearFiles: () => void
  resetIntake: () => void
  reset: () => void
  removeFile: (fileId: string) => void
  openFileDialog: () => void
  getRootProps: <T extends HTMLElement>(
    props?: React.HTMLAttributes<T>
  ) => React.HTMLAttributes<T>
  getInputProps: (
    props?: React.InputHTMLAttributes<HTMLInputElement>
  ) => React.InputHTMLAttributes<HTMLInputElement>
  getTriggerProps: <T extends HTMLElement>(
    props?: React.HTMLAttributes<T>
  ) => React.HTMLAttributes<T>
  getButtonProps: (
    props?: React.ButtonHTMLAttributes<HTMLButtonElement>
  ) => React.ButtonHTMLAttributes<HTMLButtonElement>
}
```

This is the likely final shape, with one open question: whether
`onFilesAccepted` and `onFilesRejected` are still worth keeping as convenience
callbacks. They are useful, but they overlap with `onIntake`.

## Callback Purity

Preferred final callback model:

```ts
onFilesChange(files)
onIntake(intake)
```

Why:

- `onFilesChange` describes selected state.
- `onIntake` describes one browser intake attempt.
- Consumers can derive accepted and rejected side effects from `onIntake`.
- The primitive has fewer callback ordering rules to document.

Keep `onFilesAccepted` and `onFilesRejected` only if examples prove they remove
real code without making the mental model fuzzier.

## Naming Audit

Names that feel correct:

- `DropzoneFileItem`
- `DropzoneFileRejection`
- `DropzoneIntake`
- `fileRejections`
- `resetIntake`
- `clearFiles`
- `openFileDialog`
- `getRootProps`
- `getInputProps`
- `getButtonProps`

Names to reconsider:

- `lastIntake`

`lastIntake` is precise because it says the value is not complete history. The
downside is that it feels slightly temporal and mechanical. Alternatives:

```ts
lastIntake
intake
intakeResult
lastResult
```

Current recommendation: keep `lastIntake`. It is the least ambiguous.

## Trigger Contract

The primitive needs two trigger paths:

```tsx
<div {...dropzone.getTriggerProps()} />
<button {...dropzone.getButtonProps()} />
```

Why both exist:

- A non-button trigger needs `role="button"`, `tabIndex`, and keyboard handling.
- A real button already has native semantics and should not receive redundant
  ARIA role behavior.
- Whole cards, canvases, cells, and empty states need non-button triggers.
- Toolbars and compact actions need native buttons.

This split is acceptable if the docs explain it clearly.

## Wrapper Audit

Current wrappers:

```tsx
<DropzoneRoot>
  <DropzoneInput />
  <DropzoneTrigger />
</DropzoneRoot>
```

Question: do wrappers earn their place?

Keep them only if they satisfy at least one condition:

- They make simple docs materially clearer.
- They reduce repeated boilerplate in real examples.
- They preserve accessibility for users who do not want to call prop getters.

Remove or de-emphasize them if serious examples overwhelmingly use
`useDropzone` directly.

The hook must remain canonical either way.

## Validation Contract

`dropzone-core` should stay pure and framework-free.

It should export:

```ts
parseDropzoneAccept
matchesDropzoneAccept
validateDropzoneFile
validateDropzoneFiles
```

Rules:

- Empty `accept` accepts all files.
- `.pdf` matches by lowercased filename extension.
- `image/*` matches by MIME prefix.
- `application/pdf` matches exact MIME type.
- Empty accept tokens are ignored.
- Rejections contain facts only.
- Validation does not format strings.
- Validation does not create file IDs.

## State Contract

Controlled mode:

- `files` prop is the source of truth.
- The primitive never mutates internal selected file state.
- `onFilesChange` receives the proposed next list.
- `lastIntake`, drag state, and focus state remain internal.

Uncontrolled mode:

- `defaultFiles` initializes selected file state once.
- Accepted intake appends to selected files when `multiple` allows it.
- `clearFiles` clears selected files only.
- `resetIntake` clears last intake only.
- `reset` clears selected files and last intake.

Shared rules:

- Disabled intake is a no-op.
- Non-file drags do not activate drag state.
- Input value is cleared after intake so selecting the same file again works.
- `maxFiles` limits the resulting selected list, not only the incoming batch.

## Composition Proofs

The blocks tab should keep examples that pressure different capabilities:

- Default `FileUploader`: visual composition.
- Non-button trigger: custom ARIA trigger.
- Native button trigger: native button semantics.
- Controlled queue: parent-owned file state.
- Validation only: `onIntake` without stored files.
- Thumbnail grid: custom display with `FileThumbnail`.
- Media transcript queue: domain-specific queue.
- Avatar image slot: single replaceable file.
- Spreadsheet mapper: single file with derived UI.
- Evidence timeline: ordered visual mapping.
- Comparison pair: multiple independent dropzones.
- Intake router: one dropzone with derived file lanes.
- Required packet: checklist slot dropzones.
- Pinboard drop surface: whole-canvas trigger.
- Disabled state: no-op behavior.

If an example does not prove a different primitive capability, remove it.

## FileUploader Boundary

`FileUploader` should be boring and useful.

It owns:

- upload area layout
- default title and description
- browse button copy
- file grid
- `FileThumbnail` composition
- remove button
- formatted file sizes
- human rejection messages

It should not own:

- alternate workflow-specific layouts
- upload transport
- advanced queue state
- global file routing
- every possible customization slot

If consumers need a substantially different layout, they should use
`useDropzone` directly.

## Implementation Plan

1. Audit callbacks.
   - Count real usages of `onFilesAccepted` and `onFilesRejected`.
   - Remove them if `onIntake` makes them redundant.

2. Audit wrappers.
   - Check docs and examples.
   - Decide whether wrapper components are canonical, secondary, or removed.

3. Tighten docs.
   - Lead with `useDropzone`.
   - Explain root, input, non-button trigger, and button trigger.
   - Show `FileUploader` as a composition, not as the primitive.

4. Keep `dropzone-core` pure.
   - No formatting.
   - No messages.
   - No React.
   - No DOM.

5. Keep examples ruthless.
   - Preserve examples that prove different semantics.
   - Delete examples that only change styling.

6. Expand tests around contracts.
   - Controlled transitions.
   - `onIntake` ordering.
   - non-file drag behavior.
   - native button versus non-button trigger semantics.
   - structured rejections.
   - registry dependency split.

## Acceptance Criteria

The component reaches the intended shape when:

- The primitive has no visual dependencies.
- The primitive exports no user-facing copy.
- The primitive exports no display formatting.
- Every public callback has a distinct purpose.
- Every public state field has a precise name.
- Trigger semantics are documented and tested.
- `FileUploader` can be deleted without breaking `dropzone`.
- `dropzone` can be installed without `file-thumbnail`.
- The blocks tab can build many uploader surfaces without primitive changes.
- The docs make it obvious when to use `useDropzone` versus `FileUploader`.

## Final Standard

The platonic `dropzone` is not impressive because it does many things.

It is impressive because it does one thing exactly:

```txt
normalize browser file intake into structured React state and props
```

Everything else should compose around it.
