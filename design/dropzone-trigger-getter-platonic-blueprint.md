# Dropzone Trigger Getter Platonic Blueprint

## Purpose

This blueprint resolves one open question in the dropzone primitive: whether the
trigger surface should be one getter or two.

The current primitive exposes four getters:

```txt
getRootProps      the drop surface
getInputProps     the file input
getTriggerProps   a non-button opener (div / span / custom)
getButtonProps    a native-button opener
```

`getButtonProps` and `getTriggerProps` are both correct. They are not both
necessary. This document argues the platonic ideal is **three getters**, with
the native/non-native distinction demoted from a second function to a single
boolean on one function.

It supersedes the "keep both" recommendation in
`dropzone-final-platonic-perfection-blueprint.md` §3. That blueprint left the
decision behind explicit merge criteria. Those criteria are now met. The
reasoning is below.

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

This is a no-backward-compat exercise. The target is the shape the primitive
would have if it were written once, correctly, with nothing carried for history.

## The Reduction

A trigger is one thing: *an element that, on activation, opens the file dialog.*
Activation means click, keyboard, focusability, and a disabled story.

A native `<button>` receives all four from the platform. A `<div>` receives
none. So the entire `button` / `non-button` split encodes exactly **one bit**:
*does the host element already carry button semantics?*

It is less than one bit of behavior. Test each emitted prop on the wrong host:

```txt
role="button"   on <button>   redundant, harmless
tabIndex={0}    on <button>   redundant, harmless
aria-disabled   beside native disabled   div reads aria, button reads native; no conflict
onKeyDown       on <button>   DOUBLE-FIRES with native Space/Enter activation
```

Only the keyboard polyfill genuinely conflicts. The whole divergence collapses
to one rule:

```txt
on a native button: omit the keyboard polyfill, swap aria-disabled for the real
disabled attribute. everything else is universal.
```

One branch. Four keys. Nothing else differs.

## Engaging the Prior Decision

`dropzone-final-platonic-perfection-blueprint.md` §3 kept both getters because
"a native button and a non-button trigger are meaningfully different."

They are meaningfully different in **DOM output**. They are identical in **role
and intent** — both emit `data-slot="dropzone-trigger"`, both open the dialog,
both are *the opener*. The primitive already declares them the same concept.

The merge criteria from that blueprint:

```txt
merge if the two helpers feel like API clutter        -> they do: one concept, two names
merge if docs need too much explanation               -> the split needs a paragraph; the bit needs a clause
merge if the implementation can infer native safely   -> it cannot infer, but it does not need to: the
                                                          consumer supplies the one bit it alone knows
```

The explicit-fork benefit — "the semantic fork is visible" — is real but small,
and it is preserved by the parameter. `getTriggerProps({ native: true })` is
just as visible as a second function name, and it does not double the public
surface to say so.

## Target API

Three getters. Perfectly parallel — `get{Part}Props` for the three parts that
exist.

```tsx
getRootProps      // the drop surface
getInputProps     // the file input
getTriggerProps   // the opener; native-ness is its lone parameter
```

`getButtonProps` is deleted. It was never a part; it was a variant, which is why
it broke the symmetry. The variant becomes an argument.

### Type

```tsx
type DropzoneTriggerGetterProps<T extends HTMLElement> =
  React.HTMLAttributes<T> &
    Partial<DropzoneDataAttributes> & {
      /** The trigger is a real <button>; suppress the ARIA-button polyfill. */
      native?: boolean
    }
```

`DropzoneButtonGetterProps` is deleted. `UseDropzoneReturn.getButtonProps` is
deleted.

### Why `native: boolean`, not `as: "button"`

The domain has exactly two states. A boolean is the honest type for two states.

`as: "button" | "div" | "span" | …` admits values that produce identical output
(everything that is not `"button"` is the same branch). That is impossible-state
surface area — entropy in the bad sense. `native` names the one fact that
matters: the element already has native button semantics. The doc line writes
itself.

### Implementation

```tsx
const getTriggerProps = React.useCallback(
  <T extends HTMLElement>({
    native = false,
    ...props
  }: DropzoneTriggerGetterProps<T> = {}): DropzoneTriggerGetterProps<T> => ({
    ...props,
    "data-slot": props["data-slot"] ?? "dropzone-trigger",
    onClick: composeEventHandlers(props.onClick, openFileDialog),
    ...(native
      ? { disabled, type: "button" as const }
      : {
          role: "button",
          tabIndex: disabled ? -1 : (props.tabIndex ?? 0),
          "aria-disabled": disabled || props["aria-disabled"] || undefined,
          onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              openFileDialog()
            }
          }),
        }),
  }),
  [disabled, openFileDialog]
)
```

The spread of `native ? … : …` is the irreducible difference made literal. A
reader sees the entire button/non-button story in four lines.

`disabled` is enforced in exactly one place — `openFileDialog` already guards it
— and is *encoded* into the DOM two ways (native `disabled`, or
`aria-disabled` + `tabIndex={-1}`) depending on the bit. One guard, two
encodings, derived everywhere. There is no per-handler disabled check left to
drift.

## Movement II — The `isFocused` Cut (optional, independent)

This movement is separable and can ship later.

`isFocused` is React state that re-renders on every focus and blur to reproduce
`:focus-visible`, which the platform gives for free and gives *better*
(keyboard-only). It exists today only to set `data-focused` and to expose
`isFocused` on the return.

Platonic position: expose nothing the platform supplies free. Cut `isFocused`
state, `data-focused`, and the `onFocus` / `onBlur` handlers from the getters.
The trigger getter shrinks to `data-slot` + `onClick` + the native branch.

Restore it only when a consumer must *read* focus in JS to drive a sibling
element — when the platform genuinely cannot, not before. No current consumer
does; the dropzone examples style focus with rings, which `:focus-visible`
already covers.

If kept, it stays a single state pair set in one focus handler shared by the
getter — never duplicated across getters.

```txt
return surface after Movement I:    drop getButtonProps
return surface after Movement II:   also drop isFocused
```

## Blast Radius

No backward compat, so every call site moves with the API.

### Primitive

```txt
registry/new-york-v4/ui/dropzone.tsx
  - delete DropzoneButtonGetterProps
  - delete getButtonProps (callback + return field + type)
  - add `native` to DropzoneTriggerGetterProps and the getTriggerProps branch
  - (Movement II) delete isFocused / data-focused / focus handlers
```

### Consumers that used getButtonProps → getTriggerProps({ native: true })

```txt
registry/new-york-v4/blocks/dropzone-native-button-queue.tsx
registry/new-york-v4/blocks/dropzone-controlled-queue.tsx
registry/new-york-v4/blocks/dropzone-custom-thumbnail-grid.tsx
registry/new-york-v4/blocks/dropzone-media-transcript-queue.tsx
registry/new-york-v4/blocks/dropzone-spreadsheet-import-card.tsx
registry/new-york-v4/blocks/dropzone-comparison-pair-upload.tsx
registry/new-york-v4/blocks/dropzone-evidence-timeline.tsx
registry/new-york-v4/blocks/dropzone-intake-router.tsx
registry/new-york-v4/blocks/dropzone-pinboard-drop-surface.tsx
registry/new-york-v4/blocks/dropzone-uploader-viewer-parts.tsx
```

The rename is mechanical: `getButtonProps(p)` becomes
`getTriggerProps({ ...p, native: true })`. A button trigger keeps `type="button"`
and real `disabled` because the native branch supplies them.

### Consumers already on getTriggerProps (non-native) — no change

```txt
registry/new-york-v4/blocks/dropzone-non-button-trigger.tsx
registry/new-york-v4/blocks/dropzone-validation-only.tsx
registry/new-york-v4/blocks/dropzone-avatar-image-slot.tsx
registry/new-york-v4/blocks/dropzone-disabled-dropzone.tsx
registry/new-york-v4/blocks/dropzone-required-packet-slots.tsx
components/dropzone-demo.tsx          (root-as-trigger composition)
```

### Re-audit

```txt
registry/new-york-v4/ui/file-uploader.tsx   uses getTriggerProps; confirm its
                                            trigger element type, set native iff
                                            it is a real <button>
```

### Docs

```txt
content/docs/components/dropzone.mdx
  - Mental Model: replace the getButtonProps / getTriggerProps pair with a
    single line: getTriggerProps is the opener; pass `native` for a real button
  - Trigger Patterns: rewrite the intro paragraph; the examples already render
    through <ComponentPreview>, so only block source changes flow through
  - API Reference: delete the getButtonProps row; annotate getTriggerProps with
    the `native` option
```

### Generated, do not hand-edit

```txt
public/r/*.json   regenerate via the registry build; never edit by hand
```

## Tests

```txt
tests/dropzone.test.tsx
  - native trigger receives type="button" and native disabled; no role/tabIndex;
    no manual keydown (Space/Enter handled once, by the platform)
  - non-native trigger receives role="button", tabIndex=0, aria-disabled, and
    opens on Enter and Space
  - disabled non-native trigger: tabIndex=-1, openFileDialog is a no-op
  - getTriggerProps composes a consumer onClick/onKeyDown and respects
    defaultPrevented
  - (Movement II) assert no data-focused is emitted; remove isFocused assertions

tests/viewer-architecture.test.ts
  - drop getButtonProps from the public-surface guard; assert getButtonProps is
    NOT exported (the deletion is load-bearing, so guard it)
```

## Acceptance

```txt
the primitive exposes exactly three getters
a native button trigger carries no redundant role/tabIndex and no double keyboard
a non-button trigger is fully accessible: role, focus, Enter, Space
disabled is enforced in one place and encoded per host
getButtonProps and DropzoneButtonGetterProps no longer exist anywhere
docs explain the trigger in one clause, not one paragraph
(Movement II) focus state is owned by the platform unless a consumer must read it
```

## What This Buys

```txt
four getters -> three
two trigger functions -> one with a boolean
one impossible-state-free parameter instead of a string union
disabled in one guard, two honest encodings
the entire button/non-button story readable in four lines
names that line up: getRootProps, getInputProps, getTriggerProps
```

The implementation should feel obvious after reading it. A maintainer should not
have to ask why one concept — the opener — needed two functions. After this, it
does not.
