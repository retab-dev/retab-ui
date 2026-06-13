# Email Viewer Sidebar Blueprint

## Objective

Build an email viewer that feels native to the existing viewer system instead
of becoming a one-off composition. The viewer must render an email body,
resolve inline Content-ID files, and expose regular attachments in the existing
sidebar visual language.

The core product behavior is possible with the codebase as it stands. The
platonic version needs one architectural decision: either compose the email
viewer at the wrapper level with the current `Sidebar` primitive, or first
generalize `FileViewer` so every routed file viewer can accept side rails.

This blueprint recommends the wrapper-level version first, with a clean upgrade
path to a shared viewer shell later.

## Current Situation

There are three different sidebar-shaped systems in the repo:

- `registry/new-york-v4/ui/sidebar.tsx`
  - The general app/sidebar primitive.
  - Exposes `SidebarProvider`, `Sidebar`, `SidebarHeader`,
    `SidebarContent`, `SidebarGroup`, `SidebarMenu`,
    `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuBadge`,
    `SidebarSeparator`, and related pieces.
  - This is the correct primitive family for an attachment list.

- `registry/new-york-v4/ui/segment-sidebar.tsx`
  - A domain-specific list surface for `Segment[]`.
  - It assumes page ranges, color swatches, confidence, current page, and
    segment hover/preview state.
  - This is not the right primitive for email attachments.

- Viewer rail slots
  - `PdfViewer` accepts `slots.left`, `slots.right`, `slots.top`,
    `slots.bottom`, and `slots.overlay`.
  - `PptxViewer` and image viewer types also point toward slot-based viewer
    chrome.
  - `FileViewer` does not currently expose generic slots, so the email viewer
    cannot mount a sidebar inside `FileViewer` itself without extending the
    router.

The mistake to avoid is building a custom `<aside>` with custom button rows.
That duplicates the sidebar language and bypasses the primitive the rest of the
app already uses.

## Abstraction Stress Test

The email viewer is a good stress test because it is not a new file renderer.
It is a compound viewer. It asks whether the codebase can compose existing
primitives into a higher-order document experience without inventing parallel
systems.

It touches six abstraction boundaries at once:

- file routing
- body rendering
- unsafe HTML isolation
- thumbnail generation
- sidebar navigation
- registry/docs packaging

The current abstractions mostly pass the test, but not perfectly.

### What Holds Up

`FileViewer` is a strong routing abstraction.

It already knows how to take a `ViewerSource`, infer or accept a category, and
delegate to the right concrete viewer. Email body rendering and attachment
previewing should not need new renderers. The same body/attachment distinction
can be represented as different `ViewerSource` values.

`FileThumbnail` is also correctly shaped.

An attachment sidebar should not know how to render a PDF page, spreadsheet
sheet, image, HTML file, or text preview. It should ask `FileThumbnail` for a
thumbnail and let that system own thumbnail policy, loading, cache behavior,
and unsupported formats.

The general `Sidebar` primitive is reusable enough for attachment navigation.

It owns menu shape, selected styling, focus behavior, scroll containment, and
sidebar tokens. That means email attachments can look like the rest of the app
without a custom list system.

The HTML viewer isolation boundary is the right security boundary.

Email HTML is hostile. The email viewer should not become another HTML
renderer. Its job is to transform `cid:` references, then hand the body to the
existing HTML viewer route.

### What Does Not Hold Up Yet

`FileViewer` is a router, but not yet a compound-viewer host.

It can render one selected file well. It cannot currently accept a right rail,
left rail, header slot, or overlay in a format-neutral way. `PdfViewer` has
slots, and other viewers are moving in that direction, but the universal router
does not expose that composition model.

That gap is exactly why the first implementation drifted into an outer custom
layout. The email viewer needed a body preview plus attachment navigation, and
there was no canonical generic viewer shell to receive that sidebar.

The sidebar primitive is app-shell biased.

The menu pieces are good, but `SidebarProvider` and collapsible `Sidebar` carry
global assumptions: fixed desktop positioning, mobile sheet behavior, cookie
persistence, and keyboard toggles. Those are correct for docs navigation. They
are not automatically correct for an embedded viewer inside a card, registry
demo, modal, or split pane.

The safe embedded use is therefore `collapsible="none"` plus local layout. That
works, but it reveals a missing mode: container-scoped sidebars.

`SegmentSidebar` is named generically enough to tempt misuse.

It is a good primitive for segmentation, but not for arbitrary sidebars. Email
attachments expose the naming hazard: "sidebar" alone is not the abstraction;
the model behind it is. A segment sidebar is page-range navigation over
`Segment[]`. An attachment sidebar is file navigation over `ViewerSource[]`.
They should share visual primitives, not data models.

The viewer chrome is not fully centralized.

Some viewers own their own chrome. `ResourceDocShell` covers text-like routes.
`PdfViewer` has its own toolbar, rails, and slots. `PptxViewer` has related
slot concepts. `FileViewer` coordinates routing and error boundaries but does
not unify shell composition. This is acceptable today, but email exposes the
cost: compound viewers need a stable shell boundary.

### The Real Abstraction Question

The question is not "can we build an email viewer?"

The question is:

Can a caller compose several existing document primitives into a new document
experience without crossing private boundaries or recreating visual systems?

The answer today is:

- yes for rendering files
- yes for thumbnails
- yes for static sidebar menu rows
- yes for HTML isolation
- partially for compound viewer layout
- not yet for embedded/collapsible sidebars

That means the codebase is close, but email reveals two missing primitives:

- a container-scoped sidebar mode
- a shared viewer shell or `FileViewer` slot API

The wrapper-level email viewer is therefore not just a product component. It is
also an abstraction probe. If it can be implemented with only email-specific
model logic and no custom visual system, the existing abstractions are healthy.
If it requires copied sidebars, copied chrome, custom thumbnails, or direct HTML
rendering, those abstractions are leaking.

### Design Pressure From Email

Email applies pressure that ordinary single-file viewers do not:

- The primary preview is not necessarily a source file; it is a synthesized
  body source.
- Inline resources are files but not attachments.
- Attachments are files but not part of the body.
- Selection changes the preview source without changing the email.
- The sidebar is not document structure; it is a related-file navigator.
- The body may be HTML, text, or absent.
- One message can contain many different file formats.

That pressure clarifies the right module ownership:

- Email owns message normalization and body/attachment semantics.
- Viewer resource utilities own source identity and download metadata.
- `FileViewer` owns selected file rendering.
- `FileThumbnail` owns attachment previews.
- `Sidebar` owns navigation list behavior and styling.
- HTML viewer owns unsafe body isolation.

Any implementation that violates those ownership lines is probably papering
over a weak abstraction.

## Feasibility

The design is possible.

The minimal viable architecture is:

- Email viewer owns email-specific state and normalization.
- Email body and selected attachment both render through `FileViewer`.
- Inline attachments are converted into local object URLs and used only by the
  HTML body.
- Non-inline attachments are rendered as items in the existing `Sidebar`
  primitive.
- Selection state chooses between "message body" and one attachment.

This version requires no changes to the sidebar primitive and no changes to
`FileViewer`. It is a wrapper composition.

The ideal architecture is:

- Introduce a generic viewer shell or extend `FileViewer` with slots.
- Email viewer passes the attachment sidebar as a right rail.
- All file formats get consistent rails, toolbar placement, borders,
  loading/error surfaces, and mobile behavior.

That ideal version is better long-term, but it is larger because `FileViewer`
routes across many viewers and would need a consistent contract for formats
that do and do not currently support slots.

## Non-Goals

- Do not force attachments into `SegmentSidebar`.
- Do not create a second sidebar system.
- Do not make email parsing part of the component. The component should receive
  a normalized message object.
- Do not implement an email client. No reply, forward, labels, thread list,
  mailbox state, or remote fetching.
- Do not attempt to fully emulate every email client rendering quirk.
- Do not inline arbitrary attachment previews into the email body unless they
  are true Content-ID inline resources.
- Do not add a broad compatibility layer for old props. Make the data model
  correct once.

## Data Model

The email viewer should accept a normalized message, not raw MIME.

The message needs:

- stable id
- subject
- from
- to, cc, bcc as address lists
- sent timestamp
- html body
- text body
- attachments

Each attachment needs:

- stable id
- source compatible with `ViewerSource`
- display filename, derived from source when not explicit
- MIME type, derived from source when not explicit
- size when known
- content id when present
- disposition when present
- explicit inline override when needed

Inline attachment classification should be deterministic:

- Inline when `isInline` is true.
- Inline when `contentDisposition` is `inline`.
- Inline when a `contentId` exists and disposition is not explicitly
  `attachment`.
- Not inline when `contentDisposition` is `attachment`.

This is intentionally stricter than "has image MIME type". Many image files are
regular attachments, and many inline resources are not user-facing attachments.

## Body Rendering

Body priority:

1. Use `htmlBody` when it exists and is not blank.
2. Use `textBody` when no HTML body exists.
3. Render an empty-state body when neither exists.

HTML body should render through the existing HTML route in `FileViewer`.

Text fallback should render through the existing text route in `FileViewer`.

The email viewer should not implement its own HTML iframe or text scroller. The
only email-specific transformation should be Content-ID URL rewriting before
the HTML source is handed to `FileViewer`.

## Content-ID Resolution

Content-ID rewriting is the email-specific core.

The component should build a map from normalized Content-ID to object URL:

- Strip surrounding angle brackets.
- Preserve the raw value as an alternate key.
- Support `cid:logo@example.com`.
- Support `cid:<logo@example.com>`.
- URL-decode the CID path where possible.
- Avoid throwing on malformed encoding.

When generating object URLs:

- Only create object URLs for inline attachments that are backed by `Blob`,
  `File`, or another local binary payload.
- Revoke object URLs when attachments change or the component unmounts.
- URL sources can be used directly when they are trusted and already accessible
  to the browser.

If an inline CID cannot be resolved, leave the original `cid:` reference in the
HTML. The HTML viewer should still load the body; broken images are acceptable
and more honest than silently removing content.

The rewritten HTML source should get a stable identity key derived from:

- message id when present
- body format
- body content hash or reference key
- inline attachment identity keys

This prevents stale iframe/render state when the selected email changes.

## Attachment Sidebar

The attachment sidebar should be built from the general `Sidebar` primitive:

- `SidebarProvider`
- `Sidebar side="right" collapsible="none"`
- `SidebarHeader`
- `SidebarContent`
- `SidebarGroup`
- `SidebarGroupLabel`
- `SidebarGroupContent`
- `SidebarMenu`
- `SidebarMenuItem`
- `SidebarMenuButton`
- `SidebarMenuBadge` where useful
- `SidebarSeparator` where useful

`collapsible="none"` is the safe initial choice because current collapsible
sidebar behavior is app-shell oriented:

- desktop sidebar uses fixed viewport positioning
- mobile sidebar uses sheet behavior
- state can persist through a global cookie
- keyboard toggle is global

Those are correct for docs navigation but risky inside an embedded viewer.

The email viewer can still control sidebar visibility itself at the wrapper
level if needed, but that should be a separate viewer-local toggle rather than
using app-shell collapse behavior prematurely.

## Sidebar Item Shape

The sidebar should contain one item for the message body and one item per
non-inline attachment.

The message body item should show:

- mail/body icon
- label such as "Message body"
- body format badge: HTML or text

Each attachment item should show:

- thumbnail from `FileThumbnail`
- filename
- format or MIME summary
- size when known
- selected state via `SidebarMenuButton isActive`

The row should use the sidebar menu button for interaction, not a raw button.
If thumbnail-rich rows exceed the default menu row height, use the primitive
with a deliberate class override while keeping data attributes and active
state.

This gives the email viewer the same focus, hover, selected, disabled, and
collapsed-state semantics as other sidebar surfaces.

## Viewer Layout

The immediate layout should be:

- Outer email viewer shell with fixed height or parent-controlled height.
- Left/main pane contains:
  - email metadata header
  - `FileViewer` rendering the selected body or attachment
- Right pane contains the `Sidebar` attachment list.

The outer shell should own only layout. It should not restyle `FileViewer`
internals.

The preview pane should pass `bare` to `FileViewer` and place it in a stable
bordered surface if the surrounding shell does not already provide the border.

The attachment sidebar should use the sidebar background tokens, not a custom
card palette.

## Header

The email header should be small and functional:

- subject
- sender
- recipients
- timestamp
- selected preview label when useful
- optional attachment count

It should not compete with the file viewer toolbar. Keep it as email metadata,
not a second document toolbar.

For long addresses:

- truncate safely
- allow wrapping in the metadata row where it improves readability
- keep the subject single-line unless the container is wide enough

## Selection State

Selection state should be small:

- body selected
- selected attachment id

When attachments change:

- keep body selection if body is selected
- keep selected attachment if it still exists
- otherwise fall back to body

Do not store the selected attachment object. Store the id and derive the object
from the current attachment array.

The selected item should be reflected with:

- `isActive` on `SidebarMenuButton`
- `aria-current="page"` or equivalent active semantics if the primitive does
  not already set it
- visible selected styling from the sidebar primitive

## Inline Versus Attachment Separation

Inline attachments and sidebar attachments must be separate lists.

Inline attachments:

- used for Content-ID resolution
- hidden from the normal attachment list by default
- not independently selectable unless product requirements later ask for a raw
  source/debug list

Sidebar attachments:

- every attachment not classified as inline
- independently selectable
- rendered through `FileViewer`

This matches real email semantics: inline resources are part of the body; true
attachments are separate files.

## Empty States

No body:

- main pane shows an empty body file preview or simple viewer-owned empty state
- sidebar still works if attachments exist

No attachments:

- sidebar can show a compact empty state inside `SidebarContent`
- body remains selected
- if the sidebar would be pure empty chrome, consider hiding it only when the
  product surface benefits from the extra width

Broken attachment:

- `FileViewer` should own the preview error state
- sidebar row remains selectable
- no custom email-level error unless source normalization fails

Broken inline CID:

- HTML body still renders
- missing inline resource appears as a broken image or absent resource inside
  the HTML viewer

## Security

Email HTML is hostile input.

The email viewer must rely on the existing HTML viewer isolation path rather
than rendering HTML directly with React. The email component should never use
`dangerouslySetInnerHTML` for the body.

CID rewriting must not introduce script execution. It should only replace URL
values in `cid:` references with object URLs or trusted URLs. It should not
parse and mutate arbitrary HTML using regular expressions for anything beyond
the narrow `cid:` URL replacement. If replacement becomes more complex, use a
browser `DOMParser` and serialize the document.

Remote images are a product decision:

- Allowing them matches normal HTML behavior but leaks requests.
- Blocking them requires HTML viewer support for resource policy.

That decision belongs in the HTML viewer or a viewer resource policy, not in an
email-specific ad hoc sanitizer.

## Accessibility

The sidebar must be keyboard navigable through the sidebar menu primitive.

Required behavior:

- Tab reaches the selected item and other selectable rows.
- Enter/Space selects a row.
- Active item is programmatically exposed.
- Thumbnail images are decorative unless they add meaningful content.
- Filename text is available even when truncated visually.
- Attachment count is text, not icon-only.

The main preview should update without stealing focus. Selecting an attachment
should not jump focus into the preview unless explicitly requested.

## Responsive Behavior

Initial behavior:

- Desktop: main pane plus right sidebar.
- Tablet/mobile: stack sidebar below the preview or use a viewer-local drawer.

Avoid current `Sidebar` mobile sheet behavior for embedded viewer v1 unless the
component deliberately wants an app-level drawer. The existing primitive's
mobile mode is global enough that it may feel wrong inside docs previews or
cards.

A future embedded sidebar mode could support:

- container-relative positioning
- no cookie persistence
- no global keyboard shortcut
- local mobile drawer
- local rail toggle

That is a sidebar primitive enhancement, not email-specific code.

## Registry Dependencies

The email viewer registry item should depend on:

- `utils`
- `sidebar`
- `button` only if directly used outside sidebar primitives
- `file-size-format`
- `file-thumbnail`
- `file-viewer`

If `SidebarMenuButton` covers all row interactions, direct `button`
dependency may be unnecessary except for a viewer-local sidebar toggle.

The public wrapper should remain:

- `components/ui/email-viewer.tsx`

The implementation should live in:

- `registry/new-york-v4/ui/email-viewer.tsx`

The demo fixture should live outside the registry implementation:

- `components/email-viewer-demo.tsx`

## Recommended Component Boundaries

Keep one file initially, but with clear internal functions:

- `EmailViewer`
  - owns state and high-level composition

- `EmailHeader`
  - displays metadata only

- `EmailAttachmentSidebar`
  - maps normalized body/attachment rows into `Sidebar` primitives

- `EmailAttachmentRow`
  - one attachment row using `SidebarMenuItem` and `SidebarMenuButton`

- `createEmailBodySource`
  - returns a `ViewerSource` and category for body preview

- `useInlineAttachmentUrls`
  - creates/revokes object URLs

- `isInlineAttachment`
  - encodes the disposition/content-id rule

- `normalizeContentId`
  - stable Content-ID key normalization

If the file grows beyond this, split only the pure model helpers first. Do not
extract visual subcomponents prematurely unless they are reused.

## Ideal Future Primitive

The more durable architecture is a shared `ViewerShell`.

It would own:

- outer rounded/border/background shell
- optional header
- optional toolbar
- left/right rails
- top/bottom slots
- overlay slot
- loading and error placement conventions

Then `FileViewer` could expose:

- `slots`
- `railToggle`
- `defaultRailsOpen`
- maybe `chrome` controls

Email viewer would become:

- body/attachment source resolver
- right rail content provider
- selected source router

This would align email with `PdfViewer` slot composition and prevent every
future compound viewer from inventing its own shell.

Do not start here unless the goal is explicitly to standardize viewer chrome
across formats. It is the right end state, but it touches more files.

## Implementation Plan

### Phase 1: Correct the Existing Email Viewer

Replace the custom attachment `<aside>` with `Sidebar` primitives.

Keep the same behavior:

- body selected by default
- HTML body preferred
- text fallback
- inline CIDs resolved
- non-inline attachments selectable

Remove bespoke sidebar row styling that duplicates active/hover/focus behavior.

### Phase 2: Tighten the Data Model

Make attachment classification explicit and testable.

Add tests for:

- explicit inline attachment
- disposition inline
- content id without attachment disposition
- explicit attachment disposition with content id
- no HTML body falls back to text
- selected missing attachment falls back to body

### Phase 3: Browser Verification

Use the fake email fixture to verify:

- body is selected by default
- inline logo renders from a rewritten resource
- raw `cid:` does not remain in rendered HTML when matching inline resource
  exists
- regular attachments appear in the sidebar
- selecting PDF/CSV/XLSX/HTML attachment updates the preview
- keyboard selection works in sidebar rows
- mobile width remains usable

### Phase 4: Registry And Docs

Update registry dependencies to include `sidebar`.

Docs should explain:

- HTML body first
- text fallback
- CID inline resource handling
- non-inline attachment sidebar
- that raw MIME parsing is caller-owned

The docs demo should use the fake email fixture and show at least:

- one CID inline image
- one PDF attachment
- one spreadsheet/table attachment
- one HTML or text attachment

### Phase 5: Optional Viewer Shell Work

Only after the wrapper-level email viewer feels correct, decide whether to
generalize `FileViewer`.

Acceptance for this phase:

- `FileViewer` can receive right/left slots without breaking existing routed
  viewers.
- Formats that cannot use slots still render consistently.
- PDF-specific rail behavior remains intact.
- No global sidebar behavior leaks into embedded viewers.

## Testing Matrix

Unit tests:

- `isInlineAttachment` classification
- Content-ID normalization and matching
- body source creation for HTML
- body source creation for text fallback
- selected attachment derivation

Component tests:

- renders subject and metadata
- renders body item and attachment rows via sidebar primitives
- marks active row
- selecting an attachment calls `FileViewer` with that source
- changing attachments removes invalid selection
- no attachments empty state

Integration/browser tests:

- docs demo loads
- viewer preview demo loads
- sidebar keyboard interaction works
- iframe or HTML viewer receives rewritten body
- attachment preview remains independent from body rendering

Type checks:

- `EmailViewerMessage` accepts readonly arrays
- attachment sources remain standard `ViewerSource`
- registry build includes `sidebar`

## Acceptance Criteria

The email viewer is done when:

- It does not contain a custom sidebar surface.
- Attachment navigation is built from `components/ui/sidebar`.
- `SegmentSidebar` is not used.
- HTML body renders through `FileViewer`.
- Text fallback renders through `FileViewer`.
- Inline CID files appear in the body and not in the attachment sidebar.
- Non-inline attachments appear in the sidebar and can be previewed
  independently.
- Selection state is minimal and id-based.
- The fake email fixture covers inline and non-inline attachment behavior.
- Tests cover classification, fallback, selection, and rendering route.
- Docs and registry name `email-viewer` consistently.

## Risk Assessment

Low risk:

- Replacing custom sidebar markup with `Sidebar` primitives.
- Keeping wrapper-level layout around `FileViewer`.
- Testing attachment classification.

Medium risk:

- CID rewriting edge cases.
- Object URL lifecycle bugs.
- Mobile embedded sidebar behavior.

High risk:

- Extending `FileViewer` slots across all routed formats without a broader
  viewer shell plan.
- Using global collapsible sidebar behavior inside an embedded viewer.
- Sanitizing or rewriting arbitrary email HTML outside the existing HTML viewer
  isolation model.

## Final Recommendation

Yes, the design is possible.

The immediate correct version is not a custom email-specific sidebar and not
`SegmentSidebar`. It is an email viewer composed from `FileViewer` plus the
general `Sidebar` primitive, with email-specific logic limited to body source
selection, Content-ID resolution, and attachment classification.

The later ideal version is a shared viewer shell or `FileViewer` slot API. That
would make email one instance of a broader compound-viewer pattern, but it
should follow the corrected wrapper implementation rather than block it.
