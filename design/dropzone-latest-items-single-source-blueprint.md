# Dropzone Latest-Items Single-Source Blueprint

## Purpose

This blueprint resolves the last named gap in the dropzone primitive: the file
state has **two "latest items" read paths** and a stability optimization that
partly defeats itself. The trigger getter and the file-commit core are now at
the ideal in every other respect; this is the remaining seam.

It is correctness-sensitive — it sits on the controlled/uncontrolled boundary
and on rapid same-tick intake — so it is written as a decision, not a reflex
edit.

## Standard

```txt
Simplicity
Speed
Everything needed
Nothing more
Perfect modularization
High-entropy code
Perfectly consistent variable names
Flaubertian precision
shadcn-grade taste
```

The target: one coherent story for "what are the latest committed items," read
the same way everywhere, with getter identities that are stable with respect to
file state.

## The Seam

Today the hook reads "latest items" two different ways.

```tsx
const currentItems = files ?? uncontrolledItems
const itemsRef = React.useRef(currentItems)

React.useEffect(() => {
  itemsRef.current = currentItems
}, [currentItems])

const commitFileTransition = React.useCallback(
  (transition: (items: DropzoneFileItem[]) => DropzoneFileItem[]) => {
    if (isControlled) {
      onFilesChange?.(transition(files ?? []))   // path 1: the prop, directly
      return
    }
    const nextItems = transition(itemsRef.current) // path 2: the ref
    itemsRef.current = nextItems
    setUncontrolledItems(() => nextItems)
    onFilesChange?.(nextItems)
  },
  [files, isControlled, onFilesChange]             // <- files dep
)
```

And `commitFiles` reads the ref for the validation count, in both modes:

```tsx
const baseItems = multiple ? itemsRef.current : []
// …currentCount: baseItems.length
```

Two problems against the standard:

1. **Two read paths.** Controlled transitions read `files` directly; everything
   else reads `itemsRef.current`. Same concept, two sources. A reader must hold
   both in their head.

2. **The optimization is self-defeating.** The ref exists so the getters stay
   stable across file changes. But `commitFileTransition` lists `files` in its
   deps, so in controlled mode its identity — and therefore `commitFiles`,
   `getRootProps`, and `getInputProps` — is recreated on **every** controlled
   file change. The churn the ref was meant to prevent happens anyway.

## What Is Actually Load-Bearing

Before changing anything, name what must not regress:

- **Rapid same-tick uncontrolled intake.** Two drops in one tick must append,
  not overwrite. This works today *because* `itemsRef.current` is updated
  **synchronously** inside the transition — not because of functional setState
  (the code passes `() => nextItems`, a constant updater that ignores its
  argument). The synchronous ref write is the batching mechanism. Guarded by
  *"uses functional uncontrolled transitions for rapid consecutive intake."*

- **The validation count.** `commitFiles` needs `baseItems.length` *before*
  validating, to compute `too-many-files` rejections. This is read outside any
  setState updater, so it cannot come from a functional update — it needs a
  synchronously-current value. This is the real reason the ref exists.

- **Controlled parents own the truth.** In controlled mode the hook reports a
  requested transition via `onFilesChange`; it does not own state. A parent that
  ignores `onFilesChange` is broken usage, today and after.

Any fix must keep the synchronous-current read for the count and the same-tick
append, while collapsing to one read path and stabilizing identity.

## Options

### A — One ref as the single source (recommended)

Make `itemsRef` the sole answer to "latest committed items": mirrored from the
source of truth by the effect, and updated eagerly on internal commits so
same-tick reads see what they just produced. Read it everywhere. Drop `files`
from the transition's deps.

```tsx
const currentItems = files ?? uncontrolledItems

// itemsRef is the single source of "latest committed items": the effect mirrors
// the source of truth into it after every render, and internal commits update
// it eagerly so consecutive same-tick intakes read the value they just produced.
const itemsRef = React.useRef(currentItems)
React.useEffect(() => {
  itemsRef.current = currentItems
}, [currentItems])

const commitFileTransition = React.useCallback(
  (transition: (items: DropzoneFileItem[]) => DropzoneFileItem[]) => {
    const nextItems = transition(itemsRef.current)
    itemsRef.current = nextItems
    if (!isControlled) setUncontrolledItems(nextItems)
    onFilesChange?.(nextItems)
  },
  [isControlled, onFilesChange]
)
```

- **One read path.** Every transition and the validation count read
  `itemsRef.current`. In controlled mode the effect has already mirrored `files`
  into it, so the value is identical to reading the prop — but now there is one
  source, not two.
- **Identity stabilized w.r.t. file state.** `files` leaves the deps.
  `isControlled` stays, but it is constant for the hook's lifetime in all
  supported usage (switching controlledness is a React anti-pattern), so the
  callback identity is stable in practice — and still self-corrects if a
  consumer does flip it. `getRootProps`/`getInputProps` now churn only on
  *config* changes (`accept`, `maxFiles`, `disabled`, …), which is correct:
  their behavior genuinely changed.
- **Eager write + effect reconcile.** Uncontrolled: eager write then setState;
  the effect re-mirrors the identical value (no-op). Controlled: eager
  (optimistic) write then `onFilesChange`; the parent re-renders with new
  `files` and the effect reconciles — confirming or correcting the optimism.
- Also drops the odd `setUncontrolledItems(() => nextItems)` constant-updater
  for a plain `setUncontrolledItems(nextItems)`, since the ref — not the
  updater — is what carries same-tick correctness.

Cost: the mental model "the ref is the latest items; the effect mirrors the
source of truth, internal commits update it eagerly" must be stated as an
invariant (below). That is one sentence, and it is the *whole* story — which is
the point.

### B — Drop the ref; read `currentItems`, accept churn

Remove the ref and the effect; read `currentItems` in the transition and add it
to deps. Simplest by line count, but:

- Getter identities churn on every file change (worse than today).
- Breaks the validation count under rapid intake: the second same-tick commit
  validates against a stale `currentItems` (state has not re-rendered), so
  `currentCount` is wrong and rejections are miscomputed. Moving validation into
  a functional updater would fix the count but puts side effects
  (`setLastIntake`, `onIntake`) inside an updater — a worse violation.

Rejected: trades a naming seam for a correctness regression.

### C — `useEffectEvent` / latest-callback

Stabilize via React's `useEffectEvent` or a userland latest-ref-of-callback.
Reasonable for callback stability, but `useEffectEvent` is not a stable API and
this primitive is distributed verbatim through the shadcn registry — it must be
portable. Rejected for the core; see the optional follow-up below.

### D — Reducer

Model items as `useReducer`; transitions read current state with no ref and a
stable `dispatch`. But controlled mode (parent owns state) fits a reducer
poorly, and intake produces side data (`lastIntake`) and needs the pre-commit
count — neither lives cleanly in a pure reducer. More machinery than the problem
warrants. Rejected.

## Recommendation

**Option A.** It is the only option that yields a single read path *and* stable
identity *and* preserves the two load-bearing behaviors, with no net machinery
added (it removes a dep and a constant-updater; it adds one comment).

## Invariant (to encode in a comment)

```txt
itemsRef.current is the latest committed items.
- The effect mirrors the source of truth (files ?? uncontrolledItems) into it
  after every render.
- Internal commits update it eagerly, so consecutive same-tick intakes — and the
  pre-validation count in commitFiles — read the value they just produced.
- Controlled parents own the truth: the eager write is optimistic and is
  reconciled by the effect on the parent's next render.
```

## Blast Radius

```txt
registry/new-york-v4/ui/dropzone.tsx
  - collapse commitFileTransition to a single itemsRef read path
  - drop `files` from its deps; keep [isControlled, onFilesChange]
  - setUncontrolledItems(nextItems) instead of the () => nextItems updater
  - add the invariant comment on itemsRef

public/r/*.json   regenerate via `pnpm registry:build`; never hand-edit
```

No public API change. No consumer change. `UseDropzoneProps`/`UseDropzoneReturn`
are untouched.

## Tests

Existing guards that must stay green:

```txt
- "uses functional uncontrolled transitions for rapid consecutive intake"
  (same-tick append still works via the synchronous ref write)
- "keeps controlled files controlled and reports the requested transition"
- "emits max-file transitions from controlled state without mutating rendered files"
- "applies maxFiles against existing selected count"
```

New guards this change earns:

```txt
- getRootProps / getInputProps / getTriggerProps keep a STABLE identity across a
  controlled files change (only config changes may alter it). Render with a
  changing `files` prop, capture the getter references across renders, assert
  Object.is equality. This is the regression guard for the whole point of the ref.
- controlled rapid same-tick intake validates against the latest count (drop two
  files in one tick under maxFiles and assert the second is rejected
  too-many-files, not silently accepted against a stale count).
```

## Acceptance

```txt
"latest items" is read exactly one way (itemsRef.current) everywhere
commitFileTransition no longer depends on files
getter identities are stable across file-state changes; vary only with config
rapid same-tick intake (controlled and uncontrolled) is correct, count included
the ref's contract is one stated invariant, not folklore
no public API or consumer change; registry regenerated
```

## Optional Follow-Up (separate decision)

`onFilesChange` and `onIntake` are consumer callbacks; if passed inline they
churn getter identity regardless of this change. A latest-ref wrapper for them
would make identity depend on *nothing but config*. That is a real further step
toward "stable by construction," but it subtly changes which callback closure
fires and is a distinct concern from the items-read seam. Decide it on its own,
after A lands.

## What This Buys

```txt
two read paths -> one
a self-defeating dep -> removed; identity stable across file state
a constant-updater wart -> a plain setState
the ref's purpose -> one invariant a reader can hold whole
```

After A, the file-commit core tells a single story, and the primitive — trigger
and state alike — is at the standard.
