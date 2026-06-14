# Email Viewer Terminal Perfection Blueprint

## Verdict

The email viewer is now pointed in the right direction, but it has not reached
perfection.

The provider model is not a dead end. The mistake would be making the provider
the conceptual center. The conceptual center is the MIME message model. The
provider is only the React transport for that model.

The final design is:

```txt
EmailViewerMessage
  -> buildMimeTree()
  -> createMimeMessageScope()
  -> deriveEmailViewerModel()
  -> render named slots
```

The perfect email viewer is a recursive MIME-domain viewer that composes the
shared viewer primitives. It is not a file-system viewer, not a file-viewer
plugin, not a generic sidebar system, and not a mail-client abstraction.

## Non-Negotiable Boundary

File system is out of scope.

The file-system viewer may contain a file viewer. The email viewer may contain
a file viewer. That does not make email and file-system siblings at the data
model level.

Email owns:

- MIME tree normalization
- MIME part identity
- message scope
- body selection
- attachment projection
- inline resource materialization
- nested message recursion
- email header projection

Viewer primitives own:

- root frame
- header/body/surface/sidebar layout
- sidebar open state
- sidebar trigger placement
- spatial accessibility

File viewer owns:

- rendering a single previewable `ViewerSource`
- format-specific controls
- sandboxed HTML rendering
- PDF/image/text/CSV/XLSX/etc. display

Nothing else should leak between those domains.

## Final Public Shape

The easy API remains:

```tsx
<EmailViewer message={message} />
```

The composed API is:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot defaultSidebarOpen>
    <EmailHeader />
    <ViewerBody>
      <ViewerSurface>
        <EmailContent />
      </ViewerSurface>
      <ViewerSidebar side="right" aria-label="Email parts">
        <EmailPartsSidebar />
      </ViewerSidebar>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

The order inside `ViewerBody` is a layout decision. The semantic hierarchy is
not negotiable:

```txt
email domain provider
  viewer root
    email header
    viewer body
      viewer surface
        email content
      viewer sidebar
        email parts sidebar
```

The sidebar trigger belongs to `ViewerRoot` state and can be rendered anywhere
inside the root:

```tsx
<EmailHeader trailing={<ViewerSidebarTrigger />} />
```

or:

```tsx
<Toolbar>
  <ViewerSidebarTrigger />
</Toolbar>
```

Email should not expose its own `EmailSidebarProvider` or
`EmailSidebarTrigger`. The trigger toggles the viewer sidebar, not an email
sidebar.

## Export Style

Use separate named exports:

```ts
export {
  EmailViewer,
  EmailViewerProvider,
  EmailHeader,
  EmailPartsSidebar,
  EmailContent,
  useEmailViewer,
  useEmailHeader,
  useEmailPartsSidebar,
  useEmailContent,
}
```

Do not use compound dot exports:

```tsx
<EmailViewer.Root />
<EmailViewer.Header />
```

The shadcn lesson is composability, not necessarily compound namespaces. For
this library, named exports are clearer because viewer primitives are already
named components, and nesting several dot APIs would make usage harder to read.

## Final Input Contract

The email viewer receives a normalized MIME message:

```ts
export type MimePart = {
  id: string
  mimeType: string
  headers?: readonly MimeHeader[]
  fileName?: string | null
  disposition?: MimePartDisposition | null
  contentId?: string | null
  contentLocation?: string | null
  size?: number | null
  source?: ViewerSource
  children?: readonly MimePart[]
}

export type MimeMessage = {
  id?: string
  headers?: readonly MimeHeader[]
  subject?: string | null
  from?: string | readonly string[] | null
  to?: string | readonly string[] | null
  cc?: string | readonly string[] | null
  bcc?: string | readonly string[] | null
  sentAt?: string | Date | null
  root: MimePart
}
```

Do not reintroduce:

- `htmlBody`
- `textBody`
- `attachments`
- flat attachment selection
- synthesized body fields

Those fields are convenient, but they lie about the domain. MIME is recursive.
The input must preserve that recursion.

Raw `.eml` parsing remains upstream. The component does not parse raw email
bytes.

## Final Normalized Tree

The normalized tree should stay acyclic and path-addressable:

```ts
export type MimePartNode = {
  part: MimePart
  path: MimePartPath
  parentPath: MimePartPath | null
  depth: number
  children: readonly MimePartNode[]
  facts: MimePartFacts
}
```

This is the right shape.

The important improvement over the earlier design is that the node no longer
stores a direct `parent` object reference. `parentPath` is enough:

- it avoids circular model objects
- it keeps snapshots simple
- it makes tests clearer
- it removes the need for a reparenting pass
- it makes serialized debug output possible

Selection uses normalized MIME paths:

```ts
export type MimePartPath = readonly string[]
```

Rules:

- duplicate sibling ids get deterministic suffixes
- missing ids get deterministic fallbacks
- callbacks return normalized paths
- controlled paths consume normalized paths
- invalid controlled paths fall back without firing callbacks
- `selectedPath={null}` means clear external selection and render the default
  body

The path is not a visual index. It is the public identity of a MIME part.

## Final Facts Model

The final semantic field is `facts`.

```ts
export type MimePartKind =
  | "multipart"
  | "message"
  | "body"
  | "attachment"
  | "inline-resource"
  | "unsupported"

export type MimePartFacts = {
  kind: MimePartKind
  mimeType: string
  disposition: string | null
  contentId: string | null
  contentLocation: string | null
  isRenderable: boolean
  preview: MimePreviewPolicy
}
```

This is almost exact.

The only impurity is `isRenderable`. It is acceptable because renderability is
not a semantic kind. It answers whether a `ViewerSource` exists. Keep it only if
the tests enforce that all semantic classification flows from `kind` and
`preview`, not scattered booleans.

Do not bring back:

```ts
role
isMultipart
isMessage
isAttachment
isInlineResource
parent
```

Readable predicates are fine:

```ts
isMultipartNode(node)
isMessageNode(node)
isAttachmentNode(node)
isInlineResourceNode(node)
isRenderableNode(node)
```

Those predicates derive from `facts`; they do not create a second state model.

## Final Preview Policy

Every MIME part needs an explicit preview policy:

```ts
export type MimePreviewPolicy =
  | { kind: "preview"; category?: FileCategory }
  | { kind: "nested-message" }
  | { kind: "attachment"; category?: FileCategory }
  | { kind: "security-envelope"; label: string }
  | { kind: "unsupported"; reason: EmailContentEmptyReason }
```

This is the right compression point.

The viewer does not need rich UI for every obscure MIME type. It does need one
intentional answer for each part:

- render this part as body
- render this part as attachment
- render this part as a nested email viewer
- acknowledge this part as a security envelope
- show a named unsupported state

No JSX should rediscover this policy.

## Final Message Scope

Message scope is the boundary that prevents recursive MIME from becoming visual
noise.

```ts
export type MimeMessageScope = {
  message: EmailViewerMessage
  root: MimePartNode
  path: MimePartPath
  descendants: readonly MimePartNode[]
}
```

Rules:

- a scope starts at one message root
- the root is included in descendants
- nested `message/*` nodes appear as one attachment row in the parent scope
- children inside the nested message do not leak into the parent sidebar
- selecting a nested message creates a nested email viewer with a new scope

This is the right answer to recursivity.

## Final Sidebar Model

The sidebar is not a MIME debugger. It is a mail reading navigation surface.

The final sidebar has two sections:

```txt
Body
Attachments
```

The final model is:

```ts
export type EmailSidebarModel = {
  bodyCount: number
  attachmentCount: number
  sections: readonly EmailSidebarSection[]
}

export type EmailSidebarItem = EmailBodySidebarItem | EmailAttachmentSidebarItem
```

Body section rules:

- exactly one body item when any body or fallback root can be displayed
- title is `"Body"`
- item selects the model's preferred body node
- text/plain alternatives are not shown as separate attachment rows
- multipart containers are not shown as ordinary rows

Attachment section rules:

- explicit attachments are shown
- nested messages are shown as attachments
- renderable file-like inline parts with filenames can be shown when they are
  not inline resources
- CID and content-location resources are hidden from attachments
- structural multipart nodes are hidden

Visual rules:

- sidebar background is `bg-background`, not a gray slab
- thumbnail boxes are square
- row content is left aligned across body and attachments
- selected state is visible but quiet
- body and attachment rows use the same row geometry
- no duplicate attachment header appears above the file viewer

## Final Content Model

The content model has three states:

```ts
type EmailContentModel =
  | EmailContentFile
  | EmailContentNestedMessage
  | EmailContentEmpty
```

`EmailContentFile` renders:

```tsx
<FileViewer bare source={source} as={category} />
```

`EmailContentNestedMessage` renders:

```tsx
<EmailViewer bare message={nestedMessage} />
```

`EmailContentEmpty` renders a named reason:

```ts
export type EmailContentEmptyReason =
  | "no-previewable-body"
  | "unsupported-part"
  | "missing-source"
  | "nested-depth-exceeded"
  | "security-envelope"
```

The nested depth guard is required. Recursive MIME can be malicious or broken.

## Final Inline Resource Model

Inline resources are scoped, materialized, and rewritten before HTML reaches the
file viewer.

```ts
export type EmailInlineResourceKey =
  | { kind: "content-id"; value: string }
  | { kind: "content-location"; value: string }

export type EmailInlineResource = {
  node: MimePartNode
  keys: readonly EmailInlineResourceKey[]
}

export type EmailInlineResourceScope = {
  root: MimePartNode
  resources: readonly EmailInlineResource[]
}
```

Rules:

- collect resources from the nearest `multipart/related` scope
- support `Content-ID`
- support `Content-Location`
- rewrite `cid:` URLs
- rewrite relative `src` and `href` references by content location
- do not rewrite absolute URLs
- do not rewrite anchors
- do not rewrite `data:` URLs
- revoke blob URLs on scope change and unmount
- include inline resource identity in rewritten HTML source identity

This is security-sensitive. Tests must cover both positive rewrites and
non-rewrites.

## Final Header Model

The header is an email projection, not generic viewer chrome.

```ts
export type EmailAddress = {
  name: string | null
  address: string | null
  display: string
}

export type EmailHeaderModel = {
  subject: string
  from: readonly EmailAddress[]
  to: readonly EmailAddress[]
  cc: readonly EmailAddress[]
  bcc: readonly EmailAddress[]
  sentAt: string | null
}
```

Rendering can stay compact:

```txt
Subject
From ...
To ...
Date
```

But the model should not collapse structured addresses into strings too early.

The header is above the body/sidebar split. It is not inside the attachment
viewer and not repeated for each attachment.

## Provider Standard

The provider should expose one prepared state projection:

```ts
type EmailViewerContextValue = {
  model: EmailViewerModel
  selectPart: (node: MimePartNode) => void
}
```

Hooks read narrow projections:

```ts
useEmailViewer()
useEmailHeader()
useEmailPartsSidebar()
useEmailContent()
```

This is shadcn-compliant in spirit:

- a default component exists for simple use
- pieces are exported for composition
- state is available through context
- layout is expressed through primitive slots
- consumers can place the sidebar trigger where they need it

It should not copy shadcn mechanically. The email viewer is not a menu or a
sidebar library. It is a domain viewer that composes viewer primitives.

## Naming Standard

Use these prefixes consistently:

- `Mime` for raw or normalized MIME concepts
- `Email` for viewer projections
- `Part` when the function accepts raw `MimePart`
- `Node` when the function accepts `MimePartNode`
- `Scope` only for current-message boundaries

Good names:

```txt
buildMimeTree
findMimeNodeByPath
selectMimeScopeBodyNode
selectDefaultPreviewNode
createMimeMessageScope
deriveEmailHeaderModel
deriveEmailSidebarModel
deriveEmailContentModel
deriveEmailInlineResourceScope
resolveEmailPreviewSource
deriveNestedEmailMessage
```

Bad names:

```txt
getDisplay
sidebarMeta
contentThing
emailFile
partData
```

Every name should reveal whether it handles MIME domain data, email projection
data, or viewer rendering.

## Current State Assessment

Already good:

- recursive MIME input exists
- `EmailViewerProvider` and `ViewerRoot` have separate responsibilities
- named exports are used
- file viewer is a leaf renderer
- nested messages render recursively
- sidebar is body plus attachments
- inline CID resources are hidden from attachments
- content-location support exists
- node facts replaced role/boolean duplication
- `parentPath` replaced object parent references
- empty content has named reasons
- header addresses are structured
- controlled selection semantics are documented
- focused email tests cover the core model

Still not perfect:

- visual proof is not trustworthy while the app-wide Playwright route is
  blocked by unrelated compile failures
- the default body row is always present even when the message has no
  meaningful body, which may be too forgiving
- MIME policy is still incomplete for calendar/signed/delivery-status edge
  cases unless fixtures prove them
- address parsing is intentionally simple and not RFC-complete
- inline HTML rewriting uses string replacement, which is acceptable for now
  but not the platonic parser-level solution
- test fixtures are still synthetic and should include real MIME-shaped
  examples
- internal recursion names are clear but not beautiful
- registry payload sync must be proven after every email source change

## Final Verification Bar

Perfection requires all of these to pass:

```sh
pnpm exec vitest run tests/email-viewer.test.tsx
pnpm exec vitest run tests/viewer-architecture.test.ts -t email
pnpm typecheck --pretty false
pnpm exec playwright test e2e/email-viewer.spec.ts
```

And one registry check:

```txt
public/r/email-viewer.json content matches every source file it packages
```

The Playwright test must prove:

- default body with attachments
- selected HTML attachment uses the full viewer surface
- no duplicate attachment header
- sidebar has no gray slab
- thumbnails are square
- rows align left consistently
- trigger opens and closes the sidebar
- mobile layout remains usable
- nested message renders bare inside the surface
- no console errors

If unrelated app-wide compile failures block Playwright, do not claim email
viewer perfection. Say that the email-specific model is strong and the visual
gate is blocked.

## Final Cut Plan

1. Freeze the public email API:
   - `EmailViewer`
   - `EmailViewerProvider`
   - `EmailHeader`
   - `EmailPartsSidebar`
   - `EmailContent`
   - narrow hooks
   - MIME model exports

2. Finish MIME policy fixtures:
   - plain text
   - HTML
   - multipart alternative
   - multipart related with CID
   - multipart related with content location
   - mixed attachments
   - nested `message/rfc822`
   - signed placeholder
   - encrypted placeholder
   - calendar invite
   - delivery status
   - malformed ids
   - duplicate ids
   - inline filename attachment

3. Tighten empty states:
   - prove no-body messages render intentional empty UI
   - prove unsupported selected parts report stable reasons
   - decide whether the body section should disappear or show an empty row when
     no body exists

4. Prove visual behavior:
   - fix only email blockers
   - do not repair file-system/split/source failures inside this task
   - capture the default, attachment, nested, and mobile states

5. Sync the registry payload:
   - update `public/r/email-viewer.json`
   - verify packaged content equals source content

6. Delete obsolete email design notes only if the project wants one canonical
   blueprint. Until then, keep this file as the terminal target.

## Definition Of Perfection

The email viewer reaches perfection when this statement is true:

```txt
For any normalized MIME message, the email model can explain exactly:

- what the message header is
- what the current message scope is
- what the selected part is
- what the preferred body is
- what attachment rows exist
- what inline resources are available
- what selected content renders
- why unsupported content cannot render
- where recursion starts and stops
```

And React renders those answers without adding domain decisions.

The component is close. The architecture is right. The remaining work is not a
new abstraction; it is proof, MIME edge coverage, and final compression.
