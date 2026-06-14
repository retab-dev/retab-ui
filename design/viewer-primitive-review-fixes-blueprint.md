# Viewer Primitive Review Fixes Blueprint

## Purpose

This blueprint describes the exact fixes for three issues found in the generic
viewer primitive:

1. `ViewerSidebar` can render a caller-provided `id` while registering a
   different generated id with `ViewerRoot`.
2. Collapsed sidebar accessibility props can be overridden by caller props.
3. Sidebar width has two competing customization paths, which can desynchronize
   the rendered sidebar width from the collapse offset.

The goal is to make the primitive mechanically correct without expanding its
domain responsibility. The viewer primitive should remain a spatial layout and
sidebar-control primitive only.

## Current Primitive Boundary

The canonical implementation is:

```txt
registry/new-york-v4/ui/viewer.tsx
```

The app export is a passthrough:

```txt
components/ui/viewer.tsx
```

The public primitive set is intentionally small:

```txt
ViewerRoot
ViewerHeader
ViewerBody
ViewerSidebar
ViewerSurface
ViewerSidebarTrigger
useViewerSidebar
useOptionalViewerSidebar
```

This should not change.

The primitive should continue to avoid:

- domain labels like `viewerPurpose` or `viewerRole`;
- PDF, file-system, email, split, extract, or parse-specific concepts;
- slot-object APIs;
- app-shell sidebar state;
- compatibility shims.

The fixes below are contract hardening only.

## Issue 1: Sidebar Id Registration Can Diverge From DOM Id

### Current Behavior

`ViewerSidebar` creates an internal id:

```tsx
const sidebarId = `${reactId}-viewer-sidebar`
```

It registers that id with the root:

```tsx
return sidebar.registerSidebar({
  id: sidebarId,
  ...
})
```

It also renders that id:

```tsx
<aside id={sidebarId} ... {...props} />
```

Because `props` are spread after `id`, a caller can override the actual DOM id:

```tsx
<ViewerSidebar id="pages" />
```

That creates this effective DOM:

```tsx
<aside id="pages" />
```

But the root registration still stores the generated id, so
`ViewerSidebarTrigger` renders:

```tsx
<button aria-controls=":r0:-viewer-sidebar" />
```

The result is an invalid accessibility relationship. The trigger points to an
element id that does not exist.

### Why This Matters

This is not cosmetic. `aria-controls` is the public control relationship between
the trigger and the collapsible region. If it points to a missing id:

- assistive technology cannot reliably associate the trigger with the sidebar;
- tests that pass without custom ids do not cover real user composition;
- consumers cannot safely provide stable ids for integration or styling;
- nested viewers become harder to inspect because generated ids differ from
  visible DOM ids.

### Desired Contract

`ViewerSidebar` must have one resolved sidebar id.

That id must be used for:

- the DOM `id` attribute;
- sidebar registration;
- `ViewerSidebarTrigger` `aria-controls`;
- all tests asserting the trigger/sidebar relationship.

A caller-provided `id` should be accepted and become the canonical sidebar id.
If no id is provided, the generated id remains canonical.

### Implementation Plan

Change `ViewerSidebar` prop handling to extract `id` before the rest props:

```tsx
export function ViewerSidebar({
  className,
  side = "left",
  collapsible: collapsibleProp,
  width = VIEWER_SIDEBAR_WIDTH,
  style,
  id: idProp,
  ...props
}: ViewerSidebarProps) {
  const reactId = React.useId()
  const generatedSidebarId = `${reactId}-viewer-sidebar`
  const sidebarId = idProp ?? generatedSidebarId
  ...
}
```

Then continue using `sidebarId` in registration:

```tsx
return sidebar.registerSidebar({
  collapsible,
  element,
  id: sidebarId,
  instanceId,
  side,
  width,
})
```

And render it explicitly:

```tsx
<aside
  id={sidebarId}
  ...
  {...props}
/>
```

The important point is that `id` is no longer present inside `props`, so the
rendered id cannot diverge after registration.

### Dependency Details

The registration effect already depends on `sidebarId`:

```tsx
}, [collapsible, instanceId, side, sidebar, sidebarId, width])
```

That dependency remains correct.

If a caller changes `id` between renders, the old registration will clean up and
the new registration will replace it. That is acceptable. It preserves the
single-primary-sidebar invariant.

### Test Plan

Add a test to `tests/viewer.test.tsx`:

```tsx
it("uses a caller-provided sidebar id for trigger aria-controls", async () => {
  render(
    <ViewerRoot>
      <ViewerSidebarTrigger data-testid="trigger" />
      <ViewerBody>
        <ViewerSidebar id="pages-sidebar" data-testid="sidebar">
          Pages
        </ViewerSidebar>
        <ViewerSurface>Document</ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  )

  await waitFor(() => {
    expect(screen.getByTestId("trigger").getAttribute("aria-controls")).toBe(
      "pages-sidebar"
    )
  })
  expect(screen.getByTestId("sidebar").id).toBe("pages-sidebar")
})
```

This test should fail before the fix and pass after it.

### Acceptance Criteria

- A custom `id` on `ViewerSidebar` is reflected in the DOM.
- `ViewerSidebarTrigger` points `aria-controls` to that same id.
- Generated ids still work when no id is provided.
- Nested viewer sidebar ids remain isolated.
- No public API additions are introduced.

## Issue 2: Collapsed Accessibility Props Can Be Overridden

### Current Behavior

When a sidebar is collapsed, `ViewerSidebar` computes:

```tsx
const hiddenProps = isCollapsed
  ? ({
      "aria-hidden": true,
      inert: true,
    } as React.HTMLAttributes<HTMLElement>)
  : {}
```

It then renders:

```tsx
<aside
  ...
  {...hiddenProps}
  {...props}
/>
```

Because caller props are spread after `hiddenProps`, a caller can override the
collapsed semantics:

```tsx
<ViewerSidebar aria-hidden={false} inert={false} />
```

When collapsed, that can produce:

```tsx
<aside aria-hidden="false" inert={false} />
```

The visual state says the sidebar is closed, but the accessibility tree can
still expose it.

### Why This Matters

Collapsed sidebars are visually unavailable and use pointer-event blocking and
translation/margin offsets. Their interactive descendants must not be reachable
while collapsed.

If caller props can undo `aria-hidden` or `inert`, the primitive stops owning
the collapse contract. Consumers then need to know and preserve internal
accessibility details, which is the opposite of a primitive.

### Desired Contract

When `ViewerSidebar` is collapsed:

- `aria-hidden` must be true;
- `inert` must be present;
- caller props must not override those two enforced states.

When `ViewerSidebar` is expanded:

- caller-provided `aria-hidden` should be preserved if they explicitly pass it;
- caller-provided `inert` should be preserved if they explicitly pass it;
- the primitive should not force either prop.

This gives the primitive hard ownership of collapsed state while preserving
normal HTML flexibility when expanded.

### Implementation Plan

Keep `hiddenProps` as the enforced collapsed-state object.

Move the spread order so caller props are applied first and enforced hidden
props are applied after:

```tsx
<aside
  ref={sidebarRef}
  id={sidebarId}
  data-slot="viewer-sidebar"
  data-collapsible={collapsible}
  data-side={side}
  data-viewer-sidebar-mode={mode}
  data-viewer-sidebar-open={open ? "true" : "false"}
  data-viewer-sidebar-state={state}
  className={cn(...)}
  style={resolvedStyle}
  {...props}
  {...hiddenProps}
/>
```

After Issue 1, `props` will no longer include `id`, so moving `props` earlier
does not risk overriding the resolved id.

Do not move `className` behind `props`. `className` has already been extracted,
so it is not present in `props`.

Do not move `style` behind `props`. `style` has already been extracted, so it is
not present in `props`.

### Inert Typing Detail

The current cast is acceptable:

```tsx
as React.HTMLAttributes<HTMLElement>
```

If TypeScript accepts `inert` directly in this repo's React DOM types, the cast
can remain or be narrowed. Do not add a custom global type just for this unless
the compiler requires it.

### Test Plan

Add a collapsed override regression test:

```tsx
it("enforces collapsed sidebar accessibility props over caller props", () => {
  render(
    <ViewerRoot>
      <ViewerBody>
        <ViewerSidebar
          aria-hidden={false}
          inert={false}
          data-testid="sidebar"
        >
          Sidebar
        </ViewerSidebar>
        <ViewerSurface>Surface</ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  )

  const sidebar = screen.getByTestId("sidebar")

  expect(sidebar.getAttribute("data-viewer-sidebar-state")).toBe("collapsed")
  expect(sidebar.getAttribute("aria-hidden")).toBe("true")
  expect(sidebar.hasAttribute("inert")).toBe(true)
})
```

Add an expanded preservation test:

```tsx
it("preserves caller accessibility props when the sidebar is expanded", () => {
  render(
    <ViewerRoot defaultSidebarOpen>
      <ViewerBody>
        <ViewerSidebar
          aria-hidden="false"
          data-testid="sidebar"
        >
          Sidebar
        </ViewerSidebar>
        <ViewerSurface>Surface</ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  )

  expect(screen.getByTestId("sidebar").getAttribute("aria-hidden")).toBe(
    "false"
  )
})
```

The second test is intentionally about not over-owning the expanded state. If
the team decides consumers should never pass `aria-hidden` to a visible sidebar,
skip that test and document the stricter contract instead.

### Acceptance Criteria

- A collapsed sidebar always renders `aria-hidden="true"`.
- A collapsed sidebar always renders `inert`.
- Caller props cannot undo collapsed accessibility semantics.
- Expanded sidebars are not forced hidden.
- Existing overlay, inline, and trigger tests still pass.

## Issue 3: Width Can Desynchronize From Collapse Offset

### Current Behavior

`ViewerSidebar` has a `width` prop:

```tsx
width?: string
```

That width is registered with `ViewerRoot`:

```tsx
return sidebar.registerSidebar({
  width,
  ...
})
```

`ViewerRoot` writes the registered width into a CSS variable:

```tsx
style={{
  "--viewer-sidebar-width": sidebarWidth,
  ...style,
}}
```

`ViewerSidebar` uses that variable:

```tsx
"w-(--viewer-sidebar-width)"
"-ml-(--viewer-sidebar-width)"
"-mr-(--viewer-sidebar-width)"
```

The problem is that callers can also customize width through other paths:

```tsx
<ViewerSidebar className="w-36" />
<ViewerSidebar style={{ width: 144 }} />
```

Those paths change the visible width, but the collapse offset still uses
`--viewer-sidebar-width`.

Example:

```tsx
<ViewerSidebar className="w-36" />
```

If `--viewer-sidebar-width` remains `10rem`, the sidebar can render at `9rem`
while the inline collapsed margin is `-10rem`, leaving layout drift.

### Why This Matters

The primitive owns both sidebar width and collapse mechanics. Width and collapse
offset must come from the same source or the layout becomes non-deterministic.

The risk is highest in inline mode:

- left sidebars use negative left margin;
- right sidebars use negative right margin;
- mismatched width and margin creates visible gaps or clipped remnants;
- user-provided width classes may pass visual review while failing responsive
  collapse behavior.

### Desired Contract

There should be one canonical way to set sidebar width.

The preferred canonical API is the existing `width` prop:

```tsx
<ViewerSidebar width="9rem" />
<ViewerSidebar width="min(22rem, 85vw)" />
```

The primitive should make width and collapse offset share the same CSS variable.

Width-specific `className` and `style.width` should not be the supported API for
sidebar sizing. Generic `className` remains supported for borders, flex child
layout, background, and domain content styling.

### Implementation Option A: Enforce The Width Prop And Document It

This is the recommended fix because it is simple and matches the current API.

Keep this root style:

```tsx
style={{
  "--viewer-sidebar-width": sidebarWidth,
  ...style,
}}
```

Keep this sidebar class:

```tsx
"w-(--viewer-sidebar-width)"
```

Then update tests and docs so examples do not use width utility classes on
`ViewerSidebar`.

The one known test usage is:

```tsx
<ViewerSidebar className="w-36">
```

Change it to:

```tsx
<ViewerSidebar width="9rem">
```

Add a regression test that confirms `width` drives the root variable:

```tsx
it("uses the sidebar width prop for width and collapse offset", async () => {
  render(
    <ViewerRoot data-testid="root">
      <ViewerBody>
        <ViewerSidebar width="14rem">Sidebar</ViewerSidebar>
        <ViewerSurface>Surface</ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  )

  await waitFor(() => {
    expect(screen.getByTestId("root").style.getPropertyValue(
      "--viewer-sidebar-width"
    )).toBe("14rem")
  })
})
```

This verifies the registration path. It does not prove CSS layout in jsdom, but
it locks the primitive's source of truth.

### Implementation Option B: Put The CSS Variable On The Sidebar Element

This makes `ViewerSidebar` more locally self-contained:

```tsx
const resolvedStyle = {
  "--viewer-sidebar-width": width,
  ...style,
} as React.CSSProperties
```

Then render:

```tsx
<aside
  style={resolvedStyle}
  ...
/>
```

The root can still store width for context, but the sidebar's own width and
negative margins are locally guaranteed to use its own prop.

However, this option has one tradeoff: `ViewerRoot` currently needs the width
for its CSS variable before and after registration. Keeping the variable on the
root gives a single root-level state that can be inspected and used by nested
styling. Moving it to the sidebar is not wrong, but it changes where the layout
token lives.

### Implementation Option C: Try To Detect Width Classes

Do not do this.

Detecting Tailwind width utility classes inside `className` is brittle and
unnecessary:

- `w-36`, `w-[14rem]`, `basis-*`, `min-w-*`, and responsive variants all exist;
- `tailwind-merge` can change which class wins;
- style objects can still override CSS;
- the primitive should not parse class strings.

The correct fix is a single documented sizing API.

### Recommended Width Fix

Use Option A now.

The code is already close. The remaining work is:

1. Treat `width` as the supported public sizing API.
2. Remove width utility examples from tests/docs.
3. Add a regression test that the `width` prop updates
   `--viewer-sidebar-width`.
4. Add an architecture/docs guard if desired.

### Optional Development Guard

If the team wants a stronger failure mode during development, add a warning for
obvious width overrides:

```tsx
if (process.env.NODE_ENV !== "production") {
  if (typeof className === "string" && /\bw-/.test(className)) {
    console.warn(
      "Use ViewerSidebar width instead of width utility classes so collapse math stays aligned."
    )
  }
}
```

This is not recommended for the first fix. It adds runtime noise and a brittle
regex. Prefer documentation and tests unless this keeps recurring.

### Test Plan

Update the PDF resource-sharing test:

```tsx
<ViewerSidebar width="9rem">
  <PdfViewerThumbnails resource={resource} />
</ViewerSidebar>
```

Add a direct primitive test:

```tsx
it("keeps the sidebar width prop as the collapse width token", async () => {
  render(
    <ViewerRoot data-testid="root">
      <ViewerBody>
        <ViewerSidebar width="14rem">Sidebar</ViewerSidebar>
        <ViewerSurface>Surface</ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  )

  await waitFor(() => {
    expect(screen.getByTestId("root").style.getPropertyValue(
      "--viewer-sidebar-width"
    )).toBe("14rem")
  })
})
```

Add a docs assertion in `tests/viewer-architecture.test.ts` only if this pattern
continues to recur. A simple source grep can forbid `ViewerSidebar className`
with a width class in public docs and registry examples, but it may be too
coarse for tests.

### Acceptance Criteria

- Public examples use `width`, not `className` width utilities, for sidebar
  sizing.
- The registered sidebar width updates the root CSS variable.
- Collapse classes and visible width use the same token.
- Existing custom borders and layout classes remain supported.
- No width parsing or compatibility adapter is added.

## Combined Code Shape

The final `ViewerSidebar` shape should look like this:

```tsx
export function ViewerSidebar({
  className,
  side = "left",
  collapsible: collapsibleProp,
  width = VIEWER_SIDEBAR_WIDTH,
  style,
  id: idProp,
  ...props
}: ViewerSidebarProps) {
  const sidebar = useOptionalViewerSidebarInternal()
  const publicSidebar = sidebar?.publicSidebar
  const reactId = React.useId()
  const instanceId = `${reactId}-viewer-sidebar-instance`
  const generatedSidebarId = `${reactId}-viewer-sidebar`
  const sidebarId = idProp ?? generatedSidebarId
  const sidebarRef = React.useRef<HTMLElement | null>(null)
  const collapsible = collapsibleProp ?? (sidebar ? "offcanvas" : "none")
  const open = collapsible === "none" ? true : (publicSidebar?.open ?? true)
  const state: ViewerSidebarState = open ? "expanded" : "collapsed"
  const mode = publicSidebar?.mode ?? "inline"
  const isCollapsed = collapsible !== "none" && !open

  ...

  const hiddenProps = isCollapsed
    ? ({
        "aria-hidden": true,
        inert: true,
      } as React.HTMLAttributes<HTMLElement>)
    : {}

  return (
    <aside
      ref={sidebarRef}
      id={sidebarId}
      data-slot="viewer-sidebar"
      data-collapsible={collapsible}
      data-side={side}
      data-viewer-sidebar-mode={mode}
      data-viewer-sidebar-open={open ? "true" : "false"}
      data-viewer-sidebar-state={state}
      className={cn(
        "z-30 min-h-0 w-(--viewer-sidebar-width) flex-shrink-0 overflow-hidden bg-background",
        "transition-none data-[viewer-sidebar-transitions=ready]:transition-[translate,margin-left,margin-right,border-color] data-[viewer-sidebar-transitions=ready]:duration-200 data-[viewer-sidebar-transitions=ready]:ease-out",
        ...
        className
      )}
      style={style}
      {...props}
      {...hiddenProps}
    />
  )
}
```

If Option B is chosen for width locality, replace `style={style}` with:

```tsx
style={
  {
    "--viewer-sidebar-width": width,
    ...style,
  } as React.CSSProperties
}
```

But do not implement Option B and root-only width ownership at the same time
without a clear reason. Two variable writers create a different ambiguity.

## Complete Patch Checklist

1. Update `ViewerSidebar` in `registry/new-york-v4/ui/viewer.tsx`.
2. Extract `id: idProp` from props.
3. Rename generated id to `generatedSidebarId`.
4. Resolve `sidebarId = idProp ?? generatedSidebarId`.
5. Use `sidebarId` for both registration and DOM render.
6. Spread `props` before `hiddenProps`.
7. Keep `hiddenProps` after `props`.
8. Keep `className` merged through `cn`.
9. Keep `style` explicit.
10. Update the PDF test usage from `className="w-36"` to `width="9rem"`.
11. Add custom id regression test.
12. Add collapsed accessibility override regression test.
13. Add width token regression test.
14. Run the focused viewer tests.
15. Run any affected PDF/file-system tests if nearby examples changed.

## Verification Commands

Use Vitest for these files. `bun test` does not honor the jsdom environment
pragma in the same way for this suite.

```bash
bunx vitest run tests/viewer.test.tsx tests/viewer-architecture.test.ts
```

If the PDF test fixture is changed:

```bash
bunx vitest run tests/pdf-viewer.test.tsx
```

If public registry payloads are regenerated by a later implementation, also run
the registry alignment tests:

```bash
bunx vitest run tests/viewer-architecture.test.ts
```

## Non-Goals

Do not add:

- new viewer primitives;
- domain-specific sidebar props;
- compatibility aliases for old width behavior;
- className parsing for width utilities;
- support for multiple primary sidebars in one `ViewerRoot`;
- modal focus trapping for overlay sidebars.

Overlay sidebars currently close on outside pointer down and Escape, but they do
not trap focus. That is an intentional existing behavior covered by tests and
is outside this fix.

## Final Expected State

After the fixes:

- `ViewerSidebar` has one canonical id.
- `ViewerSidebarTrigger` always controls the actual sidebar element.
- Collapsed sidebars cannot be exposed accidentally through caller props.
- Sidebar sizing has one intended public API: `width`.
- Width and collapse offset remain mechanically aligned.
- The primitive remains generic, small, and domain-free.
