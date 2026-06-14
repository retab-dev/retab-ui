# Viewer Root Sidebar Remaining Platonic Gap Blueprint

## Objective

Inventory every meaningful gap between the current viewer/sidebar design and
the platonic ideal.

This is not a rewrite plan. It is a precision document. Its job is to make the
remaining imperfections explicit enough that the next implementation pass can
delete ambiguity instead of adding machinery.

The current design is good:

```txt
ViewerRoot owns spatial state.
ViewerSidebarTrigger toggles the nearest root.
ViewerSidebar is the one spatial sidebar primitive.
ViewerSurface is the primary content region.
Domain providers own semantic state.
FileViewer owns file rendering.
```

The current design is not perfect:

```txt
Some concepts are still duplicated.
Some invariants are still only cultural.
Some composed viewers still bend the grammar.
Some implementation details are correct but not beautiful.
Some tests enforce shape through brittle text checks.
```

The platonic target remains:

```txt
Simplicity.
Speed.
Everything needed.
Nothing more.
Perfect modularization.
High-entropy code.
Perfectly consistent names.
Flaubertian precision.
```

## Current Strengths To Preserve

Do not lose these.

### Viewer And FileViewer Are Correctly Separate

The distinction is still the center of the architecture:

```txt
Viewer = spatial grammar.
FileViewer = file semantics and renderer routing.
Domain viewers = workflows that compose both.
```

This should not be folded back together. Folding them would make simple file
rendering carry sidebar/layout concerns, and it would make domain viewers depend
on a file-router even when they are not fundamentally file routers.

### ViewerRoot As Sidebar Provider Is Correct

The provider is not the problem. Extra domain-specific sidebar providers are the
problem.

The shadcn lesson is:

```txt
One provider at the primitive root is useful.
One provider per feature is provider soup.
```

`ViewerRoot` is the right provider because sidebar visibility is spatial state,
not PDF, email, MIME, file-system, OCR, or extraction state.

### The Trigger Belongs To The Primitive

`ViewerSidebarTrigger` is the right primitive. It solves the concrete product
need:

```txt
A header button, toolbar button, or nested control can toggle the sidebar
without prop drilling.
```

Any replacement design must keep that property.

### One Sidebar Primitive Is The Right Law

The current system finally has one spatial primitive for:

```txt
PDF thumbnails
email parts
file-system tree
split rail
OCR sources
extraction sources
future sidebars
```

The child content can differ. The spatial mechanics should not.

## Issue 1: Sidebar Side Is Still Duplicated

### Current State

The canonical side declaration is on `ViewerSidebar`:

```tsx
<ViewerSidebar side="right" />
```

But the trigger can also receive a side:

```tsx
<ViewerSidebarTrigger side="right" />
```

The trigger side is currently visual only. It selects `PanelLeft` or
`PanelRight`. It does not control layout.

### Why This Is Not Platonic

The API asks the user to repeat information:

```txt
Sidebar is right.
Trigger icon is right.
```

Even if the second value is only visual, it creates the possibility of an
incoherent tree:

```tsx
<ViewerSidebarTrigger side="right" />

<ViewerBody>
  <ViewerSidebar side="left" />
  <ViewerSurface />
</ViewerBody>
```

The primitive then renders a right-panel icon for a left sidebar. That is not a
runtime bug, but it is a conceptual leak.

### Platonic Target

`ViewerSidebar` privately registers its side with `ViewerRoot`.

The default trigger reads the registered side:

```tsx
<ViewerSidebarTrigger />
```

and renders the correct icon.

The trigger should not need a public `side` prop for ordinary use.

### Acceptable Escape Hatch

If a user wants a custom icon, they pass children:

```tsx
<ViewerSidebarTrigger>
  <PanelRight />
</ViewerSidebarTrigger>
```

That is explicit visual override, not duplicated layout state.

### Required Tests

Add tests for:

```txt
left sidebar -> default trigger renders left icon semantics
right sidebar -> default trigger renders right icon semantics
custom trigger children override the icon
trigger without registered sidebar still works with a neutral fallback
```

## Issue 2: One Sidebar Per Root Is Cultural, Not Enforced

### Current State

The blueprint says there is one primary sidebar per `ViewerRoot`.

The implementation does not enforce it. A user can render:

```tsx
<ViewerRoot>
  <ViewerBody>
    <ViewerSidebar side="left" />
    <ViewerSurface />
    <ViewerSidebar side="right" />
  </ViewerBody>
</ViewerRoot>
```

Both sidebars will read the same open state. The trigger cannot express which
sidebar it controls. The shared `sidebarId` also becomes wrong because multiple
`aside` elements receive the same id.

### Why This Is Not Platonic

The most important invariant is not protected:

```txt
One root, one sidebar state machine, one primary sidebar.
```

The API currently permits an invalid structure that produces invalid DOM.

### Platonic Target

`ViewerSidebar` registers itself with `ViewerRoot` in development. A second
registered sidebar under the same root should throw a precise error:

```txt
ViewerRoot supports one primary ViewerSidebar. Use a nested ViewerRoot for a
complete nested viewer, or put secondary content inside ViewerSurface.
```

Production can either keep the first sidebar or avoid the throw, but development
must catch the bad tree.

### Required Tests

Add tests for:

```txt
one sidebar registers successfully
two sidebars under one root throw in development
nested ViewerRoot can each register one sidebar
aria-controls points to exactly one sidebar id
```

## Issue 3: Trigger Can Toggle A Missing Sidebar

### Current State

`ViewerRoot` always creates sidebar state. `ViewerSidebarTrigger` can exist even
when there is no `ViewerSidebar`.

This is useful for composition during development, but not ideal.

### Why This Is Not Platonic

The user can create a UI button that says "Toggle sidebar" and changes state
without visible effect.

That makes the primitive feel less exact:

```txt
The trigger exists, but the controlled thing may not.
```

### Platonic Target

`ViewerRoot` knows whether a sidebar has registered.

The trigger can then:

```txt
disable itself when no sidebar exists
throw in development when no sidebar exists
or expose a clear optional mode for intentionally lazy sidebars
```

The cleanest likely behavior:

```txt
Development: throw if trigger renders without a sidebar sibling somewhere under
the same root.
Production: render disabled with aria-disabled.
```

This needs care for conditional rendering. If a sidebar is loaded lazily, the
trigger should be able to wait for registration without false errors.

### Required Tests

Add tests for:

```txt
trigger with sidebar works
trigger without sidebar emits the intended development failure
conditional sidebar registration does not flicker broken state
```

## Issue 4: ViewerRoot Still Knows Too Little About Its Sidebar

### Current State

`ViewerRoot` owns:

```txt
open
state
mode
requestedMode
sidebarId
```

It does not own:

```txt
side
width
collapsible
registered/unregistered status
```

Those live inside `ViewerSidebar`.

### Why This Is Not Platonic

Some information is needed by more than one primitive:

```txt
side -> trigger icon and overlay placement
registered status -> trigger validity
id -> aria-controls relationship
width -> root CSS variable
```

Today, `side` is duplicated in the trigger, `width` is duplicated between root
default and sidebar style, and registration is absent.

### Platonic Target

`ViewerRoot` should own a private sidebar registration record:

```ts
type ViewerSidebarRegistration = {
  id: string
  side: "left" | "right"
  width: string
  collapsible: "offcanvas" | "none"
}
```

This should not become public API. It is internal coordination between spatial
parts.

### Non-Goal

Do not introduce public `ViewerSidebarProvider`, `ViewerSidebarContextProvider`,
`ViewerLeftSidebar`, or `ViewerRightSidebar`.

The registration is private glue, not a new concept for users.

## Issue 5: Controlled Open State Can Emit Redundant Changes

### Current State

`setOpen` computes `nextOpen` and calls `onSidebarOpenChange?.(nextOpen)`.

It does not bail when `nextOpen === previousOpen`.

### Why This Is Not Platonic

Controlled primitives should be quiet when state does not change.

Redundant events can cause:

```txt
extra parent renders
analytics duplicates
test flakiness
state loops in strict controlled setups
```

### Platonic Target

`setOpen` should return early when the value is unchanged:

```txt
if nextOpen === previousOpen, do nothing
```

This should apply equally to controlled and uncontrolled roots.

### Required Tests

Add tests for:

```txt
setOpen(true) when already true does not call onSidebarOpenChange
toggle still calls exactly once
disabled trigger does not call onSidebarOpenChange
preventDefault in onClick does not call onSidebarOpenChange
```

## Issue 6: Measurement Is Correct But Not Yet Beautiful

### Current State

`ViewerRoot` measures its own width with `ResizeObserver`.

In `auto` mode:

```txt
unmeasured -> overlay
width >= breakpoint -> inline
width < breakpoint -> overlay
```

This removed the narrow-container wrong-mode flash.

### Remaining Problems

#### No Hysteresis

At the breakpoint, small resize oscillations can flip:

```txt
767.9 -> overlay
768.1 -> inline
767.9 -> overlay
```

This could happen during font loading, scrollbar changes, or container
animation.

#### No CSS Container Query Path

This is a spatial styling problem. A CSS container query might express the
layout mode without React state, which could reduce rerenders and avoid JS
measurement.

The current JS path is pragmatic and works. It is not proven to be the fastest
or simplest possible path.

#### No Explicit No-ResizeObserver Semantics

If `ResizeObserver` is unavailable, `auto` stays at the unmeasured default:

```txt
overlay
```

That is safer than `inline`, but it is still implicit. The behavior should be
documented and tested.

### Platonic Target

The final measurement path should choose one of these deliberately:

```txt
JS measurement with hysteresis and tests.
CSS container-query driven mode with no React resize state.
```

The decision should be based on:

```txt
runtime cost
SSR behavior
testability
Tailwind/container-query support
ability to expose data attributes
```

### Required Tests

Add tests for:

```txt
unmeasured auto starts overlay
0px measurement is ignored
width below breakpoint gives overlay
width above breakpoint gives inline
ResizeObserver unavailable has documented behavior
mode does not thrash around the breakpoint, if hysteresis is added
```

## Issue 7: Overlay Sidebar Has No Dismissal Semantics

### Current State

An overlay sidebar can be opened and closed by trigger.

It does not provide:

```txt
Escape-to-close
outside click close
scrim/backdrop
focus return
focus containment
```

### Why This May Be A Real Issue

Overlay sidebars visually behave like temporary panels. Users may expect them to
dismiss like temporary panels.

However, these are not dialogs. Adding modal behavior would be wrong if it
blocks interaction with the document surface.

### Platonic Question

What is a viewer overlay sidebar?

Possible answer:

```txt
It is non-modal overlay navigation.
It should close on Escape.
It should close on outside pointer down.
It should not trap focus.
It should return focus to the trigger only when closed by keyboard.
```

That answer needs to be explicit.

### Required Tests

Add tests for:

```txt
Escape closes overlay sidebar
Escape does not close inline sidebar unless explicitly desired
outside click closes overlay sidebar, if adopted
focus returns to trigger after keyboard close, if adopted
focus is not trapped inside the sidebar
```

## Issue 8: Sidebar Accessibility Is Incomplete

### Current State

The collapsed sidebar receives:

```txt
aria-hidden
inert
```

The trigger receives:

```txt
aria-controls
aria-expanded
aria-label
```

This is good.

### Remaining Problems

The sidebar itself has no default accessible label or role semantics beyond
`aside`.

Different domains may need labels:

```txt
PDF thumbnails
Email parts
Files
Sources
Segments
```

If the primitive supplies a generic label, it may be wrong. If domains must
remember to label it, accessibility becomes inconsistent.

### Platonic Target

`ViewerSidebar` should accept and encourage:

```tsx
<ViewerSidebar aria-label="PDF pages" />
```

Every composed viewer should provide a domain label.

The primitive should not invent a domain label.

### Required Tests

Add tests for:

```txt
PDF thumbnail sidebar has an accessible label
email parts sidebar has an accessible label
file-system explorer sidebar has an accessible label
extraction/OCR sidebars have accessible labels
collapsed sidebars are not reachable by keyboard
```

## Issue 9: The Primitive Still Carries Styling Opinions

### Current State

`ViewerRoot` owns:

```txt
rounded-xl
border
bg-muted/30
bare
```

`ViewerHeader` owns:

```txt
border-b
bg-card
```

`ViewerSidebar` owns:

```txt
bg-background
shadow-lg in overlay
transition choices
```

### Why This Is Not Platonic

A primitive should express structure first. Styling is necessary in a component
library, but the boundary is still blurry:

```txt
Is ViewerRoot a layout primitive?
Or is it also the canonical framed viewer chrome?
```

The `bare` prop is the smell. It means the primitive has two styling modes:

```txt
framed viewer
embedded viewer
```

That may be acceptable, but it is not conceptually pure.

### Platonic Target

Choose one:

```txt
ViewerRoot is the styled canonical viewer frame.
Embedded use opts out with bare.
```

or:

```txt
ViewerRoot is structural only.
ViewerFrame or className supplies chrome.
```

The current design chose the first implicitly. The blueprint should make that
choice explicit or remove `bare`.

### Required Tests

Visual/browser tests should verify:

```txt
framed root appearance
bare root appearance
nested bare viewer inside email
no double borders in common compositions
```

## Issue 10: Width Ownership Is Split

### Current State

`ViewerRoot` sets:

```txt
--viewer-sidebar-width: 10rem
```

`ViewerSidebar` also sets:

```txt
--viewer-sidebar-width: width
```

Composed viewers pass widths:

```tsx
<ViewerSidebar width="19rem" />
<ViewerSidebar width="58%" />
```

### Why This Is Not Platonic

The width is a sidebar property, but root also sets the default CSS variable.
This works, but the ownership is not crisp.

`width="58%"` in file-system is especially suspicious. It means the sidebar is
not a navigation rail; it is the dominant content column.

### Platonic Target

`ViewerSidebar` owns sidebar width.

`ViewerRoot` should either:

```txt
not set --viewer-sidebar-width at all
```

or set only a fallback used before sidebar registration.

For file-system, decide whether the explorer is really a sidebar or whether the
file-system layout needs a different composition:

```tsx
<ViewerBody>
  <ViewerSidebar width="18rem">
    <FileSystemTree />
  </ViewerSidebar>
  <ViewerSurface>
    <FileViewer source={selectedSource} />
  </ViewerSurface>
</ViewerBody>
```

If the explorer is the primary pane and preview is optional, then file-system is
not using the viewer grammar perfectly.

## Issue 11: FileSystem Still Bends The Viewer Grammar

### Current State

`FileSystem` renders:

```tsx
<ViewerBody>
  <ViewerSidebar width="58%" className="flex min-w-0 flex-1 ...">
    <FileSystemExplorer />
  </ViewerSidebar>

  <ViewerSurface className="hidden ... lg:flex">
    <FileSystemSelectedFile />
  </ViewerSurface>
</ViewerBody>
```

On small layouts, the surface is hidden and the sidebar/explorer is the visible
experience.

### Why This Is Not Platonic

The viewer grammar says:

```txt
sidebar = auxiliary navigation/context
surface = primary content
```

The file-system currently says:

```txt
sidebar = primary file browser
surface = optional preview column
```

That is not necessarily wrong product behavior. It is conceptually different.

### Possible Final Designs

#### Option A: FileSystem Is A Viewer Workspace

Keep the current direction, but name it honestly:

```txt
FileSystem is a workspace where the explorer can be primary.
ViewerSidebar can hold primary navigation-heavy workspace content.
```

This weakens the purity of `ViewerSidebar`.

#### Option B: FileSystem Uses ViewerSidebar As A Real Sidebar

Make surface always the file preview/content area. The sidebar is the file tree.
On small screens, open sidebar overlays the preview.

This matches the final grammar.

#### Option C: FileSystem Uses A Different Split Primitive

If file-system is fundamentally a browser plus preview split, use a split
workspace primitive and embed `ViewerRoot` only for previewing files.

This preserves viewer purity but adds another primitive.

### Recommendation

Prefer Option B unless product evidence says file browsing itself is the primary
viewer surface.

The ideal tree should read:

```tsx
<FileSystemProvider>
  <ViewerRoot defaultSidebarOpen>
    <FileSystemHeader />
    <ViewerBody>
      <ViewerSidebar aria-label="Files">
        <FileSystemExplorer />
      </ViewerSidebar>
      <ViewerSurface>
        <FileSystemSelectedFile />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</FileSystemProvider>
```

No `width="58%"`. No surface hidden as the default tablet/mobile truth.

## Issue 12: Email Still Has Sidebar Inside Sidebar

### Current State

`EmailViewer` correctly uses:

```tsx
<ViewerSidebar side="right">
  <EmailViewerPartsList />
</ViewerSidebar>
```

But `EmailViewerPartsList` renders `MimePartSidebar`, which uses:

```tsx
<EmbeddedSidebarProvider>
  <Sidebar collapsible="none">
    ...
  </Sidebar>
</EmbeddedSidebarProvider>
```

### Why This Is Not Platonic

The user sees one sidebar, but the code has two sidebar systems:

```txt
ViewerSidebar = spatial sidebar.
shadcn Sidebar = internal list/menu styling container.
```

This is defensible if shadcn `Sidebar` is only being used for its menu
subcomponents. But `EmbeddedSidebarProvider` and `Sidebar` still carry sidebar
semantics, width variables, and nested provider state.

It is a conceptual echo of the problem we just solved.

### Platonic Target

Email parts should use list/menu primitives, not another sidebar provider.

Possible final shape:

```tsx
<ViewerSidebar side="right" aria-label="Email parts">
  <EmailPartsPanel>
    <EmailPartsSection title="Body" />
    <EmailPartsSection title="Attachments" />
  </EmailPartsPanel>
</ViewerSidebar>
```

If shadcn menu components are useful, extract the useful row styles without
embedding `SidebarProvider`.

### Required Tests

Architecture tests should assert:

```txt
email-viewer.tsx does not import EmbeddedSidebarProvider
email-viewer.tsx does not render Sidebar as a nested layout primitive
email still has Body and Attachments sections
email nested message still renders a nested bare EmailViewer
```

## Issue 13: Recursive Email Viewer Is Correct But Heavy

### Current State

Nested MIME messages render:

```tsx
<EmailViewer bare className="h-full" message={...} />
```

This creates a complete nested viewer with its own:

```txt
EmailViewerProvider
ViewerRoot
header
body
sidebar
surface
```

### Why This Is Mostly Correct

A nested message is a complete nested viewer. This satisfies the one-root law.

### Remaining Concern

The nested viewer may be too heavy for deeply recursive MIME trees.

Potential costs:

```txt
more ResizeObservers
more contexts
more sidebar state machines
more headers inside content
more complex keyboard navigation
```

### Platonic Target

Keep recursive full viewers for true `message/rfc822` parts, but ensure:

```txt
plain attachments do not create nested ViewerRoot
HTML body attachments do not create extra metadata headers
deep recursion has bounded rendering cost
nested viewer headers are visually subordinate
```

## Issue 14: FileSystem Pierre Bridge Is Correct But Not Elegant

### Current State

The file-system/Pierre integration is split into:

```txt
file-system-pierre-input.ts
file-system-pierre-model.ts
file-system-pierre-decoration.ts
```

This is a major improvement over a monolithic list view.

### Remaining Problems

The model hook still has several imperative bridge concerns:

```txt
inputOrderRef
modelRef
appliedStateRef
openPathsByCurrentPathRef
manual resetPaths
manual selection sync
manual retry expansion
custom sort comparator to preserve input order
```

Each part is justified. Together, they are dense and non-obvious.

### Why This Is Not Platonic

The ideal bridge would have one obvious invariant:

```txt
React state produces a Pierre input.
Pierre model resets exactly when that input identity changes.
Selection and expansion are synchronized once.
```

The current hook has that behavior, but the proof is spread across refs and
effects.

### Platonic Target

Compress the model hook around explicit concepts:

```txt
input identity
expansion snapshot
selection sync
lazy retry sync
order preservation
```

Possible internal shape:

```ts
type PierreModelSnapshot = {
  currentPath: string
  hasQuery: boolean
  inputRevision: string
  paths: readonly string[]
}
```

Then each helper can be named after the invariant it preserves:

```txt
rememberExpansionBeforeReset
resolveExpansionAfterReset
syncSelectedPath
expandRetriedFolder
```

### Required Tests

Already covered:

```txt
sort by size
sort by modified date
restore expansion after clearing search
keep collapsed folder collapsed after sorting
preserve expansion across decoration changes
lazy retry opens loaded folder
do not re-emit same-path selection after reset
```

Missing:

```txt
expansion snapshots are scoped by currentPath
changing currentPath does not leak open folders from prior path
query snapshots do not overwrite normal snapshots
selection scrolls after reset
folder retry expansion uses Pierre path, not app path
```

## Issue 15: Registry Build Depends On Git-Known New Files

### Current State

The shadcn registry build failed until new Pierre files were made git-known.

The implementation is fine after adding files, but the workflow exposed a
friction point:

```txt
New registry item files must be known to git before shadcn build can read them.
```

### Why This Is Not Platonic

The component library build pipeline should not make new-file discovery feel
mysterious.

### Platonic Target

Either:

```txt
document this in registry contributor notes
```

or:

```txt
adjust scripts to validate registry paths against the filesystem before shadcn
build, with a precise error that mentions untracked files if that is the cause
```

### Required Tests Or Checks

Add a script-level preflight:

```txt
for every registry file path:
  check fs.existsSync(path)
  check whether shadcn can resolve it
  print exact missing/untracked diagnostic
```

## Issue 16: Architecture Tests Are Too String-Based

### Current State

`tests/viewer-architecture.test.ts` checks composition by searching source text
in order.

This caught useful drift, but it is brittle:

```txt
formatting can break tests
renames can require test rewrites
false confidence if strings appear in comments
hard to express structural alternatives
```

### Why This Is Not Platonic

Architecture tests should verify architecture, not incidental text layout.

### Platonic Target

Use one of:

```txt
AST-based assertions for imports and JSX tree shape
runtime render tests for composed easy APIs
focused no-import-boundary tests for forbidden dependencies
```

Keep text tests only for simple forbidden vocabulary checks.

### Required Improvements

Convert high-value composition tests to AST:

```txt
EmailViewer easy API contains EmailViewerProvider > ViewerRoot > ViewerBody.
FileSystem easy API contains FileSystemProvider > ViewerRoot.
FileViewer does not import domain providers.
Viewer primitive does not import domain modules.
```

## Issue 17: Browser Verification Is Manual

### Current State

Representative browser checks were run manually:

```txt
/blocks#pdf-thumbnails
/docs/viewers/email-viewer
/docs/components/file-system
```

They verified:

```txt
no console errors
sidebar starts in overlay in narrow docs columns
trigger toggles aria-expanded
collapsed sidebar gets aria-hidden and inert
email has Body and Attachments sections
file-system has Pierre tree
```

### Why This Is Not Platonic

Manual browser checks are not durable.

The next regression could pass unit tests and fail visually.

### Platonic Target

Add Playwright coverage for:

```txt
PDF thumbnails block sidebar open/collapse
email viewer right sidebar open/collapse
file-system sidebar open/collapse
mobile/narrow docs column starts overlay
desktop/wide viewport starts inline
no obvious overlapping header/sidebar/surface text
```

These should be low-count smoke tests, not screenshot sprawl.

## Issue 18: PPTX Viewer Timing Failures Remain

### Current State

`tests/pptx-viewer.test.tsx` has six source-load timing failures unrelated to
the sidebar work.

### Why It Still Matters

The user asked about the component library reaching perfection. A file viewer
library with known failing PPTX timing tests is not perfect.

Even if unrelated to `ViewerRoot`, it belongs in the global quality inventory.

### Platonic Target

Either fix the timing behavior or delete/replace the tests if the timing API is
no longer a supported contract.

Do not leave failing tests as ambient noise. Ambient failing tests destroy the
meaning of verification.

## Issue 19: Naming Is Good But Not Yet Perfect

### Current Names

The primitive uses:

```txt
open
state
mode
requestedMode
sidebarMode
sidebarInlineBreakpoint
collapsible
side
width
bare
```

### Remaining Tension

`state` means expanded/collapsed.

`open` means boolean expanded/collapsed.

`mode` means inline/overlay.

`requestedMode` means auto/inline/overlay.

These are accurate but slightly dense. The public API is okay. The internal
context may be carrying more vocabulary than needed.

### Platonic Target

The same concept has one name everywhere:

```txt
open -> boolean visibility
state -> data attribute string derived from open
mode -> resolved layout mode
requestedMode -> root prop only, not necessarily context
side -> registered sidebar placement
```

Audit whether `requestedMode` belongs in public context. If no consumer uses it,
remove it.

## Issue 20: Data Attributes Are Duplicated

### Current State

`ViewerSidebar` emits:

```txt
data-state
data-viewer-sidebar-state
data-viewer-sidebar-open
data-viewer-sidebar-mode
data-side
data-collapsible
```

`ViewerRoot` and `ViewerBody` also emit sidebar state attributes.

### Why This May Be Too Much

Data attributes are useful for styling and tests, but duplicated state creates
surface area.

`data-state` and `data-viewer-sidebar-state` encode the same value.

### Platonic Target

Decide which attributes are public styling contract:

```txt
data-slot
data-viewer-sidebar-state
data-viewer-sidebar-mode
data-side
```

Remove duplicates unless a dependency requires them.

If `data-state` is kept for shadcn convention, document that it is an alias.

## Issue 21: The Transition Readiness Mechanism Is Clever

### Current State

`ViewerSidebar` waits two animation frames, then sets:

```txt
data-viewer-sidebar-transitions="ready"
```

This prevents first-paint transition jank without a React rerender.

### Why This Is Not Platonic

It is effective, but the mechanism is not obvious on first read.

It also repeats per sidebar instance. If nested viewers exist, each sidebar
manages its own readiness.

### Platonic Target

Keep the no-rerender property, but isolate the behavior:

```ts
useTransitionReadyAttribute(ref, "data-viewer-sidebar-transitions")
```

Only if this reduces complexity. Do not abstract for aesthetics alone.

### Required Tests

Add tests for:

```txt
transition attribute is not present on first render
transition attribute appears after animation frames
collapsed initial render does not animate in from offscreen
```

## Issue 22: No Public Guidance For Nested Viewers

### Current State

Nested `ViewerRoot` works naturally because React context scopes to the nearest
provider.

Email recursive MIME messages rely on this.

### Missing Documentation

The docs should explicitly state:

```txt
Nested ViewerRoot is correct only for a complete nested viewer.
Do not nest ViewerRoot just to get another toolbar or border.
The trigger always targets the nearest ViewerRoot.
```

### Required Examples

Add docs examples for:

```txt
email message/rfc822 nested viewer
attachment FileViewer without nested ViewerRoot
bad nested root anti-pattern
```

## Issue 23: No Hard Boundary Between Domain Provider And ViewerRoot

### Current State

The ideal tree is:

```tsx
<DomainProvider>
  <ViewerRoot>
    ...
  </ViewerRoot>
</DomainProvider>
```

This is used by email and file-system.

### Remaining Problem

Nothing prevents future code from doing:

```tsx
<ViewerRoot>
  <DomainProvider>
    ...
  </DomainProvider>
</ViewerRoot>
```

Sometimes that may work, but it inverts ownership:

```txt
spatial primitive contains semantic provider
```

### Platonic Target

Architecture tests should encode the preferred order for composed viewers:

```txt
DomainProvider before ViewerRoot.
ViewerRoot before ViewerHeader/ViewerBody.
ViewerBody before ViewerSidebar/ViewerSurface.
```

This is currently partially checked by string order. It should become structural.

## Issue 24: FileViewer Bare Mode And ViewerRoot Bare Mode Need A Joint Theory

### Current State

`EmailViewerSelectedPart` renders:

```tsx
<FileViewer bare />
```

Nested `EmailViewer` renders:

```tsx
<EmailViewer bare />
```

`ViewerRoot` also has:

```tsx
bare
```

### Why This Needs Sharpening

There are two kinds of bare:

```txt
spatial bare = no outer viewer frame
file bare = no file viewer chrome/frame
```

They are related but not identical.

### Platonic Target

Document and test:

```txt
ViewerRoot bare removes spatial frame.
FileViewer bare removes file-renderer chrome.
DomainViewer bare chooses whether its internal ViewerRoot is framed.
```

If the names remain the same, the distinction must be clear in docs.

If the distinction remains confusing, rename one of them before the API hardens.

## Issue 25: Sidebar Content Components Are Not Yet Uniform

### Current State

Different sidebars use different internal patterns:

```txt
PDF thumbnails: thumbnail rail/list
Email parts: nested shadcn Sidebar
File-system: Pierre tree
Extraction/OCR: source lists
Legend variants: static legend/sidebar content
```

This is acceptable, but the surrounding conventions should be uniform.

### Platonic Target

Every sidebar content component should answer the same questions:

```txt
What is the selected item?
How is active state rendered?
What keyboard navigation exists?
What label does the sidebar expose?
What empty state exists?
What loading state exists?
What error state exists?
What width does it request?
```

The primitive does not own those answers. The component library should still
enforce consistency.

## Priority Plan

### Pass 1: Purify The Primitive

Fix:

```txt
private sidebar registration
remove trigger side duplication
enforce one sidebar per root in development
handle trigger without sidebar
dedupe or document data attributes
avoid redundant onSidebarOpenChange emissions
```

This is the highest leverage pass.

### Pass 2: Fix Composed Viewer Grammar

Fix:

```txt
email nested shadcn sidebar provider
file-system sidebar-as-primary-pane ambiguity
sidebar aria labels across PDF/email/file-system/extraction/OCR
nested viewer documentation
bare mode documentation
```

This is the pass that makes the design feel coherent to users.

### Pass 3: Harden Behavior

Fix:

```txt
overlay dismissal semantics
measurement edge cases
transition readiness tests
controlled/uncontrolled event quietness
browser smoke tests
PPTX timing failures
```

This is the pass that makes verification mean something.

### Pass 4: Compress The FileSystem Pierre Bridge

Fix:

```txt
expansion snapshot naming
currentPath scoped expansion tests
query snapshot overwrite tests
selection scroll tests
retry expansion tests
model hook readability
```

Do this after the primitive is stable, because otherwise file-system may move
again.

## Final Judgment

We have a good architecture.

We have not reached the platonic ideal.

The remaining work is not invention. It is precision:

```txt
make implicit invariants explicit
make duplicated concepts single-source
make tests structural
make composed viewers obey the grammar without exceptions
make every name carry exactly one meaning
```

The dangerous next move would be adding features.

The correct next move is subtraction.

