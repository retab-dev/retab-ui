# Viewer Primitive Remaining Ideal Gaps Blueprint

## Purpose

This blueprint covers viewer primitive improvements not covered by
`design/viewer-primitive-review-fixes-blueprint.md`.

That other blueprint already owns:

1. custom `ViewerSidebar` id registration;
2. collapsed accessibility prop precedence;
3. sidebar width source-of-truth fixes.

Do not duplicate those changes here. This document is for the remaining gap
between the current primitive and the platonic ideal: exact contract, exact
naming, exact lifecycle behavior, and exact guardrails.

## Current High-Level Verdict

The primitive shape is right:

```tsx
<ViewerRoot>
  <ViewerHeader />
  <ViewerBody>
    <ViewerSidebar />
    <ViewerSurface />
  </ViewerBody>
</ViewerRoot>
```

The primitive should stay generic. It should own spatial layout and sidebar
control only. It should not learn domain concepts such as pages, files,
attachments, fields, parse results, source maps, or document anchors.

The remaining work is not feature expansion. It is contract tightening.

## Gap 1: Standalone `ViewerSidebar` Behavior Is Ambiguous

### Current Behavior

`ViewerSidebar` uses the optional internal context:

```tsx
const sidebar = useOptionalViewerSidebarInternal()
```

When no `ViewerRoot` exists, it still renders:

```tsx
const collapsible = collapsibleProp ?? (sidebar ? "offcanvas" : "none")
const open = collapsible === "none" ? true : (publicSidebar?.open ?? true)
const mode = publicSidebar?.mode ?? "inline"
```

This implies standalone rendering is supported. But the component is otherwise
designed as a root-registered spatial rail, and its sizing/collapse classes
depend on viewer-owned coordination.

### Why This Matters

A primitive should not have an accidental half-supported mode. Either:

- `ViewerSidebar` is valid only inside `ViewerRoot`; or
- standalone `ViewerSidebar` is a deliberate non-collapsible `aside` primitive
  with complete layout behavior.

The current optional path makes readers ask whether standalone sidebars are
part of the public API, test convenience, or leftover permissiveness.

### Preferred Contract

Make `ViewerSidebar` a strict viewer primitive that must be rendered inside
`ViewerRoot`.

The viewer grammar becomes exact:

```txt
ViewerRoot owns viewer sidebar context.
ViewerSidebar registers with ViewerRoot.
ViewerSidebarTrigger controls the registered ViewerSidebar.
```

If a plain `aside` is needed outside a viewer, use a normal `aside` or a domain
component. Do not make `ViewerSidebar` carry that extra meaning.

### Implementation Plan

Replace the optional internal hook in `ViewerSidebar` with the strict internal
hook:

```tsx
const sidebar = useViewerSidebarInternal()
const publicSidebar = sidebar.publicSidebar
```

Then remove fallback logic that exists only for standalone rendering:

```tsx
const collapsible = collapsibleProp ?? "offcanvas"
const open = collapsible === "none" ? true : publicSidebar.open
const mode = publicSidebar.mode
```

Keep `collapsible="none"` as an explicit in-root escape hatch for sidebars that
should never collapse.

### Test Plan

Add a strictness test:

```tsx
it("throws when ViewerSidebar is rendered outside ViewerRoot", () => {
  expect(() => render(<ViewerSidebar />)).toThrow(
    "ViewerSidebar must be used within a ViewerRoot."
  )
})
```

Use a specific error message for `ViewerSidebar`; do not reuse the
`useViewerSidebar` message if that makes failures less precise.

### Acceptance Criteria

- `ViewerSidebar` has no standalone fallback behavior.
- Every rendered `ViewerSidebar` has a root registration attempt.
- `collapsible="none"` remains supported inside `ViewerRoot`.
- Existing composed viewers continue to render one `ViewerSidebar` inside one
  `ViewerRoot`.

## Gap 2: Internal Naming Is Clear But Not Perfect

### Current Behavior

The file uses several names for nearby concepts:

```txt
sidebar
publicSidebar
sidebarContext
sidebarInternalContext
registeredSidebar
registeredSidebarRef
```

These are understandable, but they force careful reading because `sidebar`
sometimes means internal context, sometimes the public context, and sometimes
the registered DOM rail.

### Why This Matters

This primitive is small enough that naming can be exact. The code should make
the ownership layers visible without mental translation.

### Desired Naming

Use names that encode the layer:

```txt
sidebarStateContext
sidebarRegistrationContext
registeredSidebar
registeredSidebarRef
```

Inside `ViewerSidebar`:

```txt
registrationContext
sidebarState
```

Inside `ViewerSidebarTrigger`:

```txt
registrationContext
sidebarState
```

The public exported hook names can stay:

```txt
useViewerSidebar
useOptionalViewerSidebar
```

The internal hooks are private, so rename them freely if it improves clarity.

### Implementation Plan

Rename private symbols only:

- `ViewerSidebarContext` to `ViewerSidebarStateContext`;
- `ViewerSidebarInternalContext` to `ViewerSidebarRegistrationContext`;
- `publicSidebar` to `sidebarState` inside internal context values;
- local `sidebar` variables that hold internal context to
  `registrationContext`.

Do not change the exported API.

### Test Plan

The existing architecture test that checks public hook shape should continue to
pass after updating the private context names it intentionally asserts.

Add no runtime behavior tests for naming. This is readability hardening.

### Acceptance Criteria

- The code distinguishes state context from registration context by name.
- No exported API is renamed.
- Architecture tests still lock the public primitive set.

## Gap 3: Auto Mode Has A First-Measurement Layout Shift

### Current Behavior

`sidebarMode="auto"` initializes with no width:

```tsx
resolveSidebarMode({
  requestedMode: sidebarMode,
  width: null,
  inlineBreakpoint: sidebarInlineBreakpoint,
})
```

When width is `null`, auto mode resolves to overlay. After layout measurement,
wide roots switch to inline.

### Why This Matters

The default is hydration-safe, but wide viewers can render overlay first and
then become inline after measurement. The sidebar delays transition readiness
by two animation frames, which protects the sidebar animation, but the surface
layout can still change once mode resolves.

This is probably acceptable, but it should be an explicit design choice. A
platonic primitive should not have implicit first-paint behavior.

### Desired Contract

Document and test the first-measurement behavior:

- auto mode is overlay until root width is measured;
- first nonzero measurement resolves the actual mode;
- zero-width measurements are ignored;
- transition classes stay disabled until after initial layout settles.

If first-paint layout shift becomes unacceptable in real UI, add an explicit
root data state:

```txt
data-viewer-sidebar-measured="false|true"
```

Then composed viewers can decide whether to hide, reserve, or skeletonize the
sidebar before measurement.

Do not add the data attribute unless a real consumer needs it.

### Test Plan

The existing tests already cover measurement, zero-width handling, hysteresis,
and transition delay. Add one targeted test only if behavior changes:

```tsx
it("starts auto mode in overlay before the first nonzero measurement", () => {
  ...
})
```

### Acceptance Criteria

- The initial auto-mode fallback is documented as intentional.
- No accidental transition animation occurs during first measurement.
- No new API is added unless a composed viewer needs pre-measurement rendering
  control.

## Gap 4: Trigger Disabled Semantics Need An Explicit Contract

### Current Behavior

When no sidebar is registered, `ViewerSidebarTrigger` computes disabled state:

```tsx
const isDisabled = Boolean(
  disabled || loading || isAriaDisabled(ariaDisabled) || !canToggleSidebar
)
```

But it passes:

```tsx
disabled={disabled}
aria-disabled={isDisabled ? true : ariaDisabled}
```

So a trigger with no registered sidebar is aria-disabled but not physically
disabled. The click handler blocks interaction manually.

### Why This Matters

This may be intentional: a temporarily inactive trigger can become active after
a conditional sidebar registers without changing button disabled mechanics. But
it is not obvious from the code alone.

The primitive should decide whether "no sidebar yet" means:

- physically disabled button; or
- focusable inactive control with `aria-disabled`.

Both can be valid. The current implementation chooses the second.

### Desired Contract

Keep the current behavior, but document it:

```txt
ViewerSidebarTrigger remains focusable when a sidebar has not registered yet.
It advertises aria-disabled and suppresses activation until registration.
```

This is useful for conditional compositions where the sidebar appears after
data loading.

### Test Plan

The existing tests cover no-sidebar activation suppression and later
registration activation. Add one assertion if desired:

```tsx
expect(trigger).not.toBeDisabled()
expect(trigger.getAttribute("aria-disabled")).toBe("true")
```

### Acceptance Criteria

- The no-sidebar trigger behavior is documented.
- Tests distinguish `aria-disabled` from the native `disabled` attribute.
- No composed viewer relies on a no-sidebar trigger for a permanent control.

## Gap 5: Error Messages Should Name The Exact Primitive

### Current Behavior

The strict hook error says:

```tsx
throw new Error("useViewerSidebar must be used within a ViewerRoot.")
```

The internal hook uses the same message, even when the failing component is
`ViewerSidebarTrigger`.

If `ViewerSidebar` becomes strict, reusing this message there would be even less
precise.

### Desired Contract

Each user-facing composition error should name the component or hook that
actually failed:

```txt
useViewerSidebar must be used within a ViewerRoot.
ViewerSidebar must be used within a ViewerRoot.
ViewerSidebarTrigger must be used within a ViewerRoot.
```

### Implementation Plan

Keep `useViewerSidebar()` as-is for the public hook.

For private consumers, either:

1. add a helper that accepts the consumer name:

```tsx
function useViewerSidebarRegistrationContext(consumer: string) {
  const context = React.useContext(ViewerSidebarRegistrationContext)
  if (!context) {
    throw new Error(`${consumer} must be used within a ViewerRoot.`)
  }
  return context
}
```

2. or keep separate small hooks for `ViewerSidebar` and
   `ViewerSidebarTrigger`.

Option 1 is simpler if both components need the same internal context.

### Test Plan

Update the existing outside-root trigger test to expect the precise trigger
message.

If `ViewerSidebar` becomes strict, add the outside-root sidebar test from Gap 1.

### Acceptance Criteria

- Public hook failures still name `useViewerSidebar`.
- Component composition failures name the component.
- Errors remain short and actionable.

## Gap 6: Structural Data Attributes Need A Single Documented Surface

### Current Behavior

The primitive exposes several attributes:

```txt
data-slot
data-viewer-root-id
data-viewer-sidebar-mode
data-viewer-sidebar-open
data-viewer-sidebar-state
data-viewer-sidebar-trigger
data-collapsible
data-side
```

Some are public styling/test hooks. Some are internal coordination details.
The current boundary is not fully explicit.

### Why This Matters

Data attributes become API in a component library. If consumers style against
an internal coordination attribute, changing it later becomes harder.

### Desired Contract

Classify attributes into two groups.

Public structural attributes:

```txt
data-slot
data-viewer-sidebar-mode
data-viewer-sidebar-open
data-viewer-sidebar-state
data-collapsible
data-side
```

Internal coordination attributes:

```txt
data-viewer-root-id
data-viewer-sidebar-trigger
data-viewer-sidebar-transitions
```

Public docs should mention only the structural attributes. Internal attributes
can remain tested where necessary, but should not be advertised for user
styling.

### Implementation Plan

Update docs language in `content/docs/components/sidebar.mdx` to avoid implying
that every `data-viewer-sidebar-*` attribute is a public styling contract.

Suggested wording:

```txt
Viewer primitives expose `data-slot` and sidebar state attributes for local
styling. Root ids, trigger markers, and transition readiness attributes are
internal coordination details.
```

### Test Plan

No behavior test needed. Existing tests can continue to inspect internal
attributes when verifying primitive mechanics.

### Acceptance Criteria

- Docs distinguish public structural attributes from internal coordination
  attributes.
- No domain docs recommend styling against internal coordination attributes.

## Gap 7: The Primitive Needs A No-New-Concepts Guardrail

### Current Behavior

Architecture tests already prevent many removed concepts:

```txt
ViewerShell
ViewerSlots
ViewerDocumentSurface
ViewerSidebarPurpose
ViewerSurfaceRole
viewerPurpose
viewerRole
```

This is good. The remaining risk is future "helpful" props that smuggle domain
or composition concepts back into the primitive.

### Desired Contract

The primitive may add only:

- generic spatial layout state;
- generic sidebar control state;
- generic accessibility state;
- generic measurement state.

It may not add:

- domain identifiers;
- render props for domain regions;
- slot-object APIs;
- file/document/source/anchor concepts;
- app-shell sidebar concepts.

### Implementation Plan

Extend the architecture test with a short forbidden prop/symbol list if any new
leak appears during future work. Do not overfit it now.

Candidates to guard if they appear:

```txt
purpose
role
rail
panel
document
source
anchor
toolbar
thumbnail
field
file
page
attachment
```

Use precise patterns only. Do not ban ordinary words that appear in comments or
tests unless they represent API.

### Acceptance Criteria

- The public primitive set remains unchanged.
- No new domain or slot concepts appear in `viewer.tsx`.
- Compound viewers continue to own named domain parts.

## Recommended Execution Order

1. Finish `design/viewer-primitive-review-fixes-blueprint.md`.
2. Decide strict vs supported standalone `ViewerSidebar`.
3. Make error messages precise.
4. Rename private context variables for state vs registration clarity.
5. Document trigger disabled semantics and data-attribute boundaries.
6. Reassess auto-mode first-measurement behavior only if visual verification
   shows a real first-paint problem.

## Verification

Run:

```bash
bunx vitest run tests/viewer.test.tsx tests/viewer-architecture.test.ts
```

If strict `ViewerSidebar` behavior is implemented, also run focused composed
viewer tests that render custom sidebars:

```bash
bunx vitest run tests/pdf-viewer.test.tsx tests/docx-viewer.test.tsx tests/image-viewer.test.tsx tests/file-system.test.tsx
```

## Non-Goals

- Do not add domain sidebar variants.
- Do not add a slot-object API.
- Do not add app-shell sidebar integration.
- Do not make `ViewerRoot` aware of PDF, email, file-system, split, parse, or
  anchored-document state.
- Do not solve first-paint measurement with a new API unless a real composed
  viewer requires it.
