# Viewer Primitive Sharp Edges Blueprint

## Scope

This blueprint is only about the generic `Viewer` primitive:

- `ViewerRoot`
- `ViewerHeader`
- `ViewerBody`
- `ViewerSidebar`
- `ViewerSurface`
- `ViewerSidebarTrigger`
- `useViewerSidebar`
- `useOptionalViewerSidebar`

It does not cover email, file-system, source blocks, OCR blocks, PDF rendering, or any file-viewer-specific behavior.

## Position

The current primitive direction is right: `ViewerRoot` should be the owner of sidebar state, sidebar registration, responsive mode, overlay dismissal, and trigger scoping. `ViewerSidebar` should register its physical facts with the root. `ViewerSidebarTrigger` should be movable anywhere under the same root and should infer the sidebar side/id from root state.

The remaining work should be small and surgical. The primitive should not gain a second provider, domain-specific purpose props, or a slot registry. The goal is to make the current shape exact.

## Shadcn Lessons

The useful shadcn lesson is not “copy every subcomponent.” It is “make the primitive anatomy explicit, keep public hooks small, and only add named parts when repetition proves the part.”

From `Sidebar`:

- The provider owns open state and exposes a tiny hook: state, open, setters, responsive mode, and toggle.
- Width is a CSS variable concern, not a domain prop concern.
- Triggers are movable because they read context, not because callers pass structural props.
- `SidebarHeader`, `SidebarContent`, `SidebarFooter`, groups, menus, and rails exist because application sidebars repeat those internal structures.

From `Dialog`:

- Overlay behavior is accessibility behavior, not just styling.
- Trigger/content composition is explicit.
- The inert background is part of the semantic contract.

From `Tabs`:

- The primitive owns state and orientation.
- The public anatomy is minimal: root, list, trigger, content.
- Visual variants belong on the narrowest component that needs them.

From `Field`:

- Semantic grouping is separated from individual controls.
- `FieldSet` and `FieldLegend` exist only when there is a real grouped semantic need.
- Layout and validation state mostly travel through semantic elements and `data-slot`/`data-*`, not through another provider.
- Variants belong on the component that directly changes layout, not on a distant root.

Applied to `Viewer`: keep the public anatomy at `Root/Header/Body/Sidebar/Surface/Trigger`. Do not add `ViewerSidebarHeader`, `ViewerSidebarContent`, `ViewerSidebarFooter`, or `ViewerSidebarRail` until repeated viewer sidebars prove those parts are inevitable.

## Second Shadcn Pass

Looking at `Sidebar`, `Field`, `Dialog`, and `Tabs` together adds four sharper rules.

### 1. State Provider Only Where State Is Real

`SidebarProvider` exists because app sidebars need shared open state, mobile state, persistence, and a global shortcut. `Field` has no provider because grouping, labels, descriptions, and errors are semantic/layout concerns. `Tabs` and `Dialog` delegate state to their underlying primitives.

`ViewerRoot` already has real viewer state: sidebar openness, responsive mode, registration, trigger focus return, overlay dismissal, and nested-root isolation. That means `ViewerRoot` should remain the only viewer sidebar provider.

Do not introduce:

- `ViewerSidebarProvider`
- `ViewerLayoutProvider`
- `ViewerPartsProvider`
- a generic slot registry

### 2. `data-slot` Is Public Anatomy, `data-viewer-*` Is State

Shadcn is consistent about this split:

- `data-slot` names the component part.
- `data-state`, `data-side`, `data-orientation`, and similar attributes expose styling state.
- Domain meaning is not encoded into the primitive.

Viewer should follow the same split:

- `data-slot="viewer-root" | "viewer-header" | "viewer-body" | "viewer-sidebar" | "viewer-surface" | "viewer-sidebar-trigger"`
- `data-viewer-sidebar-mode`
- `data-viewer-sidebar-open`
- `data-viewer-sidebar-state`
- `data-side`
- `data-collapsible`

Do not add primitive attributes like:

- `data-viewer-kind="email"`
- `data-viewer-sidebar-purpose="attachments"`
- `data-viewer-surface-file-type="pdf"`

Those belong in domain components above the primitive.

### 3. Add Polymorphism Sparingly

Shadcn uses `render`/`asChild` when a part often needs a different element without losing primitive behavior: dialog trigger, sidebar menu buttons, group actions. It does not make every wrapper polymorphic by default.

Viewer should not add broad `asChild` or `render` support to every layout part. `ViewerSidebarTrigger` can inherit the existing `Button` render behavior because trigger substitution is common. `ViewerRoot`, `ViewerBody`, `ViewerSidebar`, and `ViewerSurface` should remain simple structural elements until a concrete semantic conflict appears.

If a semantic conflict appears later, prefer the smallest fix:

- `ViewerSurface` may become polymorphic if consumers repeatedly need `main`, `section`, or a router-owned element.
- Do not make every viewer part polymorphic just because one part needs it.

### 4. Aliases Are For Familiar API Compatibility, Not Conceptual Expansion

Shadcn exports aliases such as `TabsTrigger`/`TabsTab` and `DialogContent`/`DialogPopup` to match familiar ecosystem names while keeping one implementation.

Viewer should not add aliases yet. The names are already plain and local:

- `ViewerRoot`
- `ViewerHeader`
- `ViewerBody`
- `ViewerSidebar`
- `ViewerSurface`
- `ViewerSidebarTrigger`

Aliases like `ViewerContent`, `ViewerPanel`, `ViewerMain`, or `ViewerAside` would create vocabulary drift without adding capability.

## 1. Fix Trigger Disabled Semantics

### Problem

`ViewerSidebarTrigger` computes an internal disabled state that includes all reasons the trigger cannot toggle:

- caller `disabled`
- caller `loading`
- caller `aria-disabled`
- no registered sidebar
- registered sidebar is not toggleable

But the rendered button should use that computed state, not only the caller-provided `disabled` prop.

If a root has no toggleable sidebar, the trigger must not remain a focusable no-op control.

### Target

`ViewerSidebarTrigger` should render:

```tsx
disabled = { isDisabled }
```

The click guard should remain, because it protects custom event paths and preserves explicit `preventDefault` behavior. But DOM disabled semantics should be real.

### Acceptance Criteria

- A trigger without a registered sidebar is disabled.
- A trigger for `collapsible="none"` is disabled.
- A loading trigger is disabled.
- A caller-disabled trigger is disabled.
- Disabled triggers do not toggle.
- Disabled triggers do not expose misleading `aria-controls` when no sidebar exists.

## 2. Decide Whether First Render Must Be Deterministic

### Problem

`ViewerRoot` learns sidebar facts from `ViewerSidebar` registration:

- `id`
- `side`
- `width`
- `collapsible`

Before registration, the root uses fallback values. This can create a small first-render mismatch:

- right sidebars briefly look like left sidebars to the trigger state
- custom widths are known only after registration
- generated ids are fallback ids until registration

This is mostly harmless in client-rendered usage, but it is not perfect for SSR, hydration, and first-paint determinism.

### Option A: Keep The Current API

Do nothing. Accept registration-time correction.

This keeps the primitive smaller and avoids adding props that most users never need.

### Option B: Add Root Defaults

Allow `ViewerRoot` to declare sidebar defaults before the sidebar registers:

```tsx
<ViewerRoot
  defaultSidebarSide="right"
  defaultSidebarWidth="19rem"
>
```

These are not control props. They are first-render hints that are superseded by the actual registered `ViewerSidebar`.

### Recommendation

Do not add these props yet.

The primitive is better if it avoids speculative API. Only add root defaults if we observe a real first-paint bug in SSR, visual tests, or hydration behavior.

### Acceptance Criteria If We Do Nothing

- The registration correction is covered by tests.
- A right sidebar trigger eventually reports `data-side="right"`.
- Custom sidebar width is reflected on root after registration.
- No public API is added just to solve an unobserved first-paint problem.

### Acceptance Criteria If We Add Defaults Later

- Defaults are named as defaults, not controlled state.
- Defaults never override a registered sidebar.
- Defaults do not create a second source of truth.
- `ViewerSidebar` remains the authoritative physical sidebar declaration.

## 3. Tighten Public Versus Private Sidebar State

### Problem

`ViewerSidebarContextValue` currently mixes consumer state with implementation details. Public consumers need to know whether the sidebar is open, whether it can toggle, what mode it is in, and how to toggle it. They do not necessarily need the DOM id.

`sidebarId` is useful for `ViewerSidebarTrigger`, but it is more naturally part of the private registration context.

### Target Public Context

The public hook should expose the smallest useful state:

```ts
type ViewerSidebarContextValue = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (value: boolean | ((open: boolean) => boolean)) => void
  toggleSidebar: () => void
  canToggleSidebar: boolean
  mode: "inline" | "overlay"
}
```

Private registration state can keep:

```ts
type ViewerSidebarRegistrationContextValue = {
  hasSidebar: boolean
  sidebarId: string
  sidebarSide: "left" | "right"
  sidebarState: ViewerSidebarContextValue
  registerSidebar: (registration: ViewerSidebarRegistration) => () => void
  rootId: string
  setLastTriggerElement: (element: HTMLElement | null) => void
}
```

### Recommendation

Make this change only if it does not force churn in existing consumers. The conceptual boundary is cleaner, but it is less urgent than disabled semantics.

### Acceptance Criteria

- `useViewerSidebar()` no longer exposes implementation-only ids.
- `ViewerSidebarTrigger` still has access to `aria-controls` through private root registration state.
- External consumers can still build custom toggles from `open`, `state`, `mode`, `canToggleSidebar`, `setOpen`, and `toggleSidebar`.
- No domain-specific fields are added.

## 4. Lock The Primitive With Invariant Tests

### Problem

The primitive is now subtle enough that small regressions are easy:

- trigger can become focusable in invalid states
- triggers can accidentally take a public `side` prop again
- nested roots can cross-toggle
- non-collapsible sidebars can report collapsed state
- root can accidentally support multiple primary sidebars

These are primitive invariants, not component-specific behavior.

### Required Tests

Add focused tests for:

1. **No Sidebar**
   - `ViewerSidebarTrigger` is disabled.
   - It has no `aria-controls`.
   - It has no `aria-expanded`.
   - Clicking does nothing.

2. **Non-Collapsible Sidebar**
   - `ViewerSidebar collapsible="none"` reports open/expanded.
   - `useViewerSidebar()` reports open/expanded.
   - `canToggleSidebar` is false.
   - Trigger is disabled.

3. **Right Sidebar Inference**
   - `ViewerSidebar side="right"` causes trigger state/icon side to infer right from registration.
   - No `side` prop is needed on `ViewerSidebarTrigger`.

4. **Nested Root Isolation**
   - A trigger in an inner root toggles only the inner sidebar.
   - A trigger in an outer root toggles only the outer sidebar.
   - `aria-controls` points to the nearest root sidebar.

5. **Single Primary Sidebar**
   - One root can register exactly one `ViewerSidebar`.
   - A second sibling `ViewerSidebar` throws.
   - A nested `ViewerRoot` may register its own sidebar independently.

6. **Overlay Accessibility**
   - Collapsed overlay sidebars are inert.
   - Collapsed overlay sidebars are `aria-hidden`.
   - Escape closes an open overlay sidebar and returns focus to the trigger.
   - Open overlay behavior is explicitly classified as either modal or non-modal.
   - If modal, the surface behind the sidebar is inert while the overlay sidebar is open.
   - If non-modal, the primitive must not pretend to be a dialog and must document that focus can remain in the surface.

7. **Public API Cleanliness**
   - `ViewerSidebarTrigger` has no `side` prop.
   - `ViewerRoot` is the only sidebar provider.
   - No `ViewerSidebarProvider` is exported.

### Acceptance Criteria

- Tests describe primitive invariants, not email/PDF/source behavior.
- Tests do not depend on file-system or file-viewer components.
- Failing tests point directly to primitive regressions.

## Execution Order

1. Fix trigger `disabled={isDisabled}`.
2. Add or update invariant tests for disabled/no-sidebar/non-collapsible behavior.
3. Classify overlay sidebar behavior as modal or non-modal, then test that contract.
4. Decide whether to remove `sidebarId` from the public hook. If this causes churn, defer it.
5. Do not add first-render root defaults unless visual/hydration evidence proves they are needed.

## Additions Rejected After Shadcn Review

### Do Not Add A ViewerSidebarProvider

Shadcn `SidebarProvider` is necessary because app sidebars are global layout systems. `ViewerRoot` already is the correct scoped provider for viewer sidebars. Adding `ViewerSidebarProvider` would create two ownership centers.

### Do Not Add Sidebar Subparts Yet

`SidebarHeader`, `SidebarContent`, and `SidebarFooter` are right for app navigation sidebars. Viewer sidebars currently host heterogeneous content: thumbnails, MIME parts, source fields, OCR blocks, and domain-specific controls. Generic subparts would either be unused or would force those domains into a false common shape.

If repeated sidebar anatomy appears later, add it from evidence. The bar is:

- the part appears in at least three viewer domains
- the part has the same semantic responsibility in each domain
- the part reduces userland code without hiding domain meaning

Until then, domain sidebars should own their internal sections, labels, rows, and previews.

### Do Not Add A Default Keyboard Shortcut

Shadcn app sidebar uses a global shortcut because it is the application navigation rail. Viewer roots can be nested and repeated. A default global shortcut would be ambiguous. If keyboard shortcuts are ever added, they should be opt-in and scoped to the focused viewer root.

### Do Not Add Root-Level Variants For Domain Layouts

`TabsList variant="underline"` is good because the visual variant belongs exactly to the list. `Field orientation="horizontal"` is good because orientation changes one field's layout. Viewer should use the same discipline.

Do not put domain variants on `ViewerRoot`:

- no `variant="email"`
- no `layout="pdf-thumbnails"`
- no `sidebarKind="attachments"`

If a visual option belongs to one primitive part, put it on that part. If it belongs to a domain, put it on the domain component.

### Do Not Add Broad Render Props Yet

Shadcn uses polymorphism where it is necessary for composition. Viewer should not make structural parts polymorphic until a real consumer proves the need. The current structural elements are clearer and easier to test.

## Non-Goals

- No new provider.
- No domain-purpose props.
- No `ViewerSidebarTrigger side`.
- No slot registry.
- No default global keyboard shortcut.
- No sidebar header/content/footer/rail subparts yet.
- No root-level domain variants.
- No broad `asChild`/`render` polymorphism across structural parts.
- No API aliases until there is real naming pressure.
- No file-system changes.
- No email model changes.
- No file-viewer changes.
