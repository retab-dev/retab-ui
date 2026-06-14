# Email Viewer Remaining Perfection Blueprint

## Verdict

The current email viewer has reached the right architecture, not perfection.

The center is correct:

```txt
EmailViewerProvider     MIME/domain state
  ViewerRoot            spatial viewer state
    EmailHeader         message header projection
    ViewerBody
      ViewerSurface
        EmailContent    file leaf or nested email viewer
      ViewerSidebar
        EmailPartsSidebar
```

Do not restart the design. The provider is not a dead end. The remaining work
is compression, exactness, coverage, and visual proof.

## What Is Already Right

The important boundaries are now right:

- Email is a MIME-domain viewer.
- `FileViewer` is a leaf renderer.
- `ViewerRoot` owns spatial layout and sidebar state.
- `EmailViewerProvider` owns email-domain state.
- React components render prepared models.
- MIME tree construction, scoping, header derivation, sidebar derivation, content
  derivation, and CID policy live outside JSX.
- Nested `message/*` parts render as bounded nested email viewers.
- Parent message scope does not leak nested-message children into the parent
  sidebar.
- The sidebar is product-shaped: `Body` and `Attachments`.
- Inline CID resources are hidden from attachments.
- Blob-backed CID URLs are revoked.
- Public exports are named exports, not compound dot properties.

That is the architecture to keep.

## Why It Is Not Perfect

Perfection means:

- fewer concepts
- stronger names
- fewer booleans
- no duplicated classification
- no uncertain MIME behavior
- no UI behavior verified only indirectly
- no unrelated failing gates in the repo

The current implementation has the right shape but still contains pragmatic
rough edges.

## Remaining Gap 1: Role And Booleans Are Duplicated

Current node shape has both `role` and derived booleans:

```ts
role: MimePartRole
isMultipart: boolean
isMessage: boolean
isRenderable: boolean
isAttachment: boolean
isInlineResource: boolean
```

This is useful, but not maximally compressed. It leaves two possible sources of
semantic truth:

- `role`
- booleans

The perfect version keeps exactly one primary semantic field and derives the
convenience predicates from it.

Candidate final shape:

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
  isRenderable: boolean
}

export type MimePartNode = {
  part: MimePart
  path: MimePartPath
  depth: number
  parent: MimePartNode | null
  children: readonly MimePartNode[]
  facts: MimePartFacts
}
```

Then helpers provide readable predicates:

```ts
isMessageNode(node)
isInlineResourceNode(node)
isRenderableNode(node)
```

This is more exact because every classification flows from `facts`.

Do not make this change until the tests are strong enough to catch every role
transition.

## Remaining Gap 2: Tree Building Reparents Nodes

Current tree construction builds children with `parent: null`, then reparents
them.

That is correct but aesthetically imperfect.

The perfect version builds immutable nodes in one conceptual pass without a
visible repair phase.

The difficulty is circular parent references. The clean options are:

1. Keep parent references and accept the reparenting pass.
2. Remove parent references and use path/root lookups.
3. Store `parentPath` instead of `parent`.

The perfect choice is probably `parentPath`, not object parent:

```ts
export type MimePartNode = {
  part: MimePart
  path: MimePartPath
  parentPath: MimePartPath | null
  children: readonly MimePartNode[]
  facts: MimePartFacts
}
```

Why:

- paths are already the stable identity
- JSON-like tree stays acyclic
- no reparenting pass
- easier model snapshots
- easier test assertions

Cost:

- `getInlineResourceScope()` needs root/path lookup or ancestor path traversal.

This is not urgent. It is a purity improvement.

## Remaining Gap 3: MIME Policy Is Still Too Small

The current viewer handles the normal important cases:

- `multipart/mixed`
- `multipart/alternative`
- `multipart/related`
- `text/html`
- `text/plain`
- attachments
- inline CID resources
- nested `message/rfc822`

Perfection requires explicit policy for more MIME realities:

- `multipart/signed`
- `multipart/encrypted`
- `message/delivery-status`
- `message/disposition-notification`
- `text/calendar`
- `application/ics`
- `application/pkcs7-mime`
- `application/pgp-encrypted`
- `application/octet-stream` with filename
- inline images with filename but no content id
- parts with `Content-Location`
- parts with `Content-Disposition: inline; filename=...`
- malformed or missing MIME types
- duplicate or missing headers

The perfect design does not need to render all of these richly. It does need
one explicit decision for each:

```ts
export type MimePreviewPolicy =
  | { kind: "preview"; category?: FileCategory }
  | { kind: "nested-message" }
  | { kind: "attachment" }
  | { kind: "security-envelope"; label: string }
  | { kind: "unsupported"; reason: string }
```

Then obscure parts become intentional UI, not accidental fallthrough.

## Remaining Gap 4: Body Selection Needs A Named Policy Object

Current body selection works, but the policy is spread through helpers such as
`getMessageScopeBodyNode()` and `findDefaultDisplayNode()`.

The perfect version names the policy:

```ts
export type EmailBodySelectionPolicy = {
  preferredMimeTypes: readonly string[]
  includeInlineBodyParts: boolean
  includeAttachments: boolean
}

const DEFAULT_EMAIL_BODY_SELECTION_POLICY = {
  preferredMimeTypes: ["text/html", "text/plain", "text/markdown"],
  includeInlineBodyParts: true,
  includeAttachments: false,
} satisfies EmailBodySelectionPolicy
```

But this should not become a public prop yet.

The point is not configurability. The point is to make the default policy a
single named value that tests can target.

## Remaining Gap 5: Sidebar Projection Needs More Exact Item Kinds

Current sidebar sections are right, but sidebar items are still generic:

```ts
EmailSidebarItem
```

The perfect model distinguishes row purpose:

```ts
export type EmailSidebarItem = EmailBodySidebarItem | EmailAttachmentSidebarItem

export type EmailBodySidebarItem = {
  kind: "body"
  node: MimePartNode
  title: "Body"
  description: string
  thumbnail: EmailSidebarThumbnailModel
  isSelected: boolean
}

export type EmailAttachmentSidebarItem = {
  kind: "attachment"
  node: MimePartNode
  title: string
  description: string
  thumbnail: EmailSidebarThumbnailModel
  isSelected: boolean
}
```

This removes implicit meaning from section membership. A body item says it is a
body item.

## Remaining Gap 6: CID Resources Need Content-Location Support

CID is not the only inline reference pattern.

Some emails use:

```html
<img src="logo.png" />
<img src="./logo.png" />
<img src="https://example.invalid/logo.png" />
```

with MIME headers like:

```txt
Content-Location: logo.png
```

The perfect inline resource scope supports:

```ts
export type EmailInlineResourceKey =
  | { kind: "content-id"; value: string }
  | { kind: "content-location"; value: string }
```

Then HTML rewriting has two stages:

- replace `cid:` URLs by content id
- replace relative URLs by content location when scoped to `multipart/related`

This should be added only with tests. URL rewriting is security-sensitive.

## Remaining Gap 7: Source Rewriting Needs Stable Identity

Current HTML source rewriting changes text when CID resources materialize.

The perfect source identity includes:

- original source identity
- selected node path
- inline resource keys
- inline resource URL generation identity

Example:

```ts
identityKey: `${source.identityKey ?? node.path.join("/")}:inline:${inlineResourceHash}`
```

This avoids cache ambiguity in renderers that memoize by source identity.

Do not overbuild the hash. A deterministic joined key is enough.

## Remaining Gap 8: Public Controlled Selection Should Be Documented More

The implementation supports:

- uncontrolled selection
- controlled `selectedPath`
- `selectedPath={null}` fallback
- invalid path fallback without callback
- normalized callback paths

The docs mention the props but do not explain these semantics sharply enough.

The perfect docs add:

```md
### Controlled Selection

- `undefined` means uncontrolled.
- `null` clears external selection and renders the default body.
- invalid paths fall back to the default body and do not emit callbacks.
- callbacks receive normalized MIME paths.
```

This is cheap and should be done.

## Remaining Gap 9: Visual Proof Is Missing

Current tests prove behavior, not visual exactness.

Perfection for this component requires browser screenshots for:

- default email with body and attachments
- selected HTML attachment uses full surface width
- nested message selected
- mobile/narrow layout
- sidebar closed and reopened by trigger

Use Playwright or the existing browser verification flow.

Assertions should include:

- no duplicate attachment header
- sidebar has no gray slab
- thumbnails are square
- row left alignment is consistent
- body/attachments sections are visible
- nested viewer is bare
- no text overlap at narrow widths

This is the largest remaining confidence gap.

## Remaining Gap 10: Repo-Wide Gates Are Not Clean

Email-specific checks pass, but perfection is not compatible with unrelated
red gates.

Known unrelated failures from the current audit:

- `pnpm typecheck --pretty false` fails in `tests/segment-surfaces.test.tsx`
  because test handles still reference `scrollToPageArea`.
- `node scripts/verify-registry-file-paths.mjs` fails on unrelated missing or
  untracked registry references, including source-evidence/edit/layout entries.

These are not email design flaws, but they prevent claiming repository-level
perfection.

Do not fix them inside an email task unless explicitly asked. Track them as
system cleanup.

## Remaining Gap 11: More MIME Fixtures

The current tests are good but still synthetic.

The perfect suite includes fixture messages for:

- simple plain text email
- simple HTML email
- HTML with CID image
- HTML with text alternative
- mixed email with PDF/CSV/XLSX attachments
- forwarded `message/rfc822`
- nested forwarded message chain
- signed email
- encrypted email placeholder
- calendar invite
- delivery status notification
- malformed missing ids
- duplicate sibling ids
- inline attachment with filename

Each fixture should prove both:

- derived model shape
- rendered UI behavior

## Remaining Gap 12: Header Model Needs Better Address Semantics

Current header model stores display strings:

```ts
from: string | null
to: string | null
```

That is fine for rendering, but imperfect as a domain model.

Perfect model:

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

Rendering can still join addresses. The model stops losing structure.

This only matters if callers need rich header display or inspection. It is a
quality upgrade, not an architectural blocker.

## Remaining Gap 13: Error And Unsupported States Need Names

Current empty content is:

```ts
{ kind: "empty", message: string }
```

Perfect model:

```ts
export type EmailContentEmptyReason =
  | "no-previewable-body"
  | "unsupported-part"
  | "missing-source"
  | "nested-depth-exceeded"
  | "security-envelope"

export type EmailContentEmpty = {
  kind: "empty"
  reason: EmailContentEmptyReason
  node: MimePartNode
  message: string
}
```

This gives tests and future UI a stable state machine instead of matching copy.

## Remaining Gap 14: The Sidebar Count Is Semantically Weak

Current sidebar has:

```ts
itemCount: number
```

That count includes body plus attachments.

The header copy says `N items`, which is okay but not exact. A mail UI usually
cares about attachments separately.

Better:

```ts
export type EmailSidebarModel = {
  bodyCount: number
  attachmentCount: number
  sections: readonly EmailSidebarSection[]
}
```

Then UI can say:

```txt
4 attachments
```

or avoid the count entirely.

This is visual polish but worth doing.

## Remaining Gap 15: Internal Helpers Need More Consistent Names

Current naming is good enough, not perfect.

Better naming rules:

- Use `Mime` for raw/normalized MIME tree concepts.
- Use `Email` for viewer projections.
- Use `Part` only when a function accepts raw `MimePart`.
- Use `Node` only when a function accepts `MimePartNode`.
- Use `Scope` only for current-message boundaries.

Examples:

```txt
getMessageScopeBodyNode      -> selectMimeScopeBodyNode
findDefaultDisplayNode       -> selectDefaultPreviewNode
isSidebarAttachmentNode      -> isEmailAttachmentSidebarNode
sidebarMeta                  -> describeEmailSidebarNode
sidebarThumbnail             -> deriveEmailSidebarThumbnail
nestedMessageFromNode        -> deriveNestedEmailMessage
resolveDisplaySource         -> resolveEmailPreviewSource
```

Do this only once, after the model is stable. Renaming during active design
creates churn.

## Remaining Gap 16: The Easy API Internals Are Slightly Noisy

Current public API is clean, but internals need:

```ts
EmailViewerProviderInternal
EmailViewerInternal
```

This is acceptable because recursion depth is private. It is not beautiful.

Possible perfect shape:

```ts
function EmailViewerRootProvider(props: EmailViewerProviderInternalProps)
function EmailViewerFrame(props: EmailViewerInternalProps)
```

But the current names are clear. Do not rename unless the file is already being
edited for deeper model work.

## Priority Order

Do next:

1. Document controlled selection semantics.
2. Add empty reason enum.
3. Add richer MIME fixtures.
4. Add browser visual verification.
5. Add content-location inline resource support.
6. Add named body selection policy.
7. Split sidebar item `kind`.
8. Improve source identity for rewritten HTML.
9. Decide whether to collapse `role` and booleans into `facts`.
10. Decide whether parent references should become `parentPath`.

Do not do next:

- redesign provider structure
- fold email into file viewer
- touch file-system viewer
- add an email-specific sidebar provider
- expose MIME policy props prematurely
- build a MIME debugger UI as the default sidebar

## Final Target

The perfect email viewer has this property:

```txt
Given any normalized MIME message, the model can explain exactly:

- what the message header is
- what the current message scope is
- what the preferred body is
- what attachments are visible
- what inline resources are available
- what selected content means
- why unsupported content is unsupported
- whether nested rendering is allowed
```

And React only renders those answers.

That is the remaining path from "good architecture" to "Flaubertian
perfection."
