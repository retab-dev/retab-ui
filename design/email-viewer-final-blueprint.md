# Email Viewer Final Blueprint

## Verdict

The email viewer should be a recursive MIME-domain viewer composed from the
shared viewer primitives.

It should not become a file-system concern. It should not make `FileViewer`
understand email. It should not invent a second sidebar system. It should not
render MIME semantics directly in JSX.

The perfect design is:

```tsx
<EmailViewerProvider message={message}>
  <ViewerRoot>
    <EmailHeader />
    <ViewerBody>
      <ViewerSidebar aria-label="Email parts">
        <EmailPartsSidebar />
      </ViewerSidebar>
      <ViewerSurface>
        <EmailContent />
      </ViewerSurface>
    </ViewerBody>
  </ViewerRoot>
</EmailViewerProvider>
```

The exact visual order can be left or right sidebar through `ViewerSidebar`.
The important hierarchy is invariant:

```txt
email domain provider
  viewer root
    email header
    viewer body
      parts sidebar
      content surface
```

The easy API is the preassembled form:

```tsx
<EmailViewer message={message} />
```

The composed API is for product layouts that need to place the header, trigger,
sidebar, or surface differently.

## Non-Goals

This blueprint does not redesign:

- file-system viewer
- file browser state
- source evidence viewer
- OCR viewer
- PDF viewer
- dropzone
- `FileViewer` internals
- raw `.eml` parsing

The email viewer receives a normalized MIME message. Parsing raw email bytes
belongs upstream.

## Design Standard

The email viewer is correct only if every MIME decision has one owner.

The data flow is:

```txt
EmailViewerMessage
  -> buildMimeTree()
  -> createMimeMessageScope()
  -> deriveEmailViewerModel()
  -> render prepared models
```

React components should render. They should not discover MIME meaning while
rendering.

The provider should expose one prepared state projection:

```ts
type EmailViewerContextValue = {
  model: EmailViewerModel
  selectPart: (node: MimePartNode) => void
}
```

Narrow hooks read projections from that model:

```ts
useEmailHeader(): EmailHeaderModel
useEmailPartsSidebar(): {
  sidebar: EmailSidebarModel
  selectPart: (node: MimePartNode) => void
}
useEmailContent(): EmailContentModel
```

No hook should expose raw partial state unless the caller is explicitly building
advanced email UI.

## Provider Count

Two providers are acceptable because they own different things:

- `EmailViewerProvider` owns email-domain state.
- `ViewerRoot` owns viewer layout state, including sidebar open/closed state.

There should not be an `EmailSidebarProvider`.

There should not be a standalone shadcn-style sidebar provider inside email.
`ViewerRoot` is the sidebar provider for viewer layouts. Email only supplies
sidebar content.

`FileViewer` may have internal viewer state when used standalone, but inside
email it is used as a leaf renderer with `bare`. It should not create another
spatial shell for an ordinary attachment.

Nested `EmailViewer` is different. A `message/rfc822` attachment is a complete
viewer domain, so it gets its own `EmailViewerProvider` and its own
`ViewerRoot`.

## Raw Input

Keep the raw input close to MIME.

```ts
export type MimePartDisposition = "inline" | "attachment" | string

export type MimeHeader = {
  name: string
  value: string
}

export type MimePart = {
  id: string
  mimeType: string
  headers?: readonly MimeHeader[]
  fileName?: string | null
  disposition?: MimePartDisposition | null
  contentId?: string | null
  size?: number | null
  source?: ViewerSource
  children?: readonly MimePart[]
}

export type MimeMessage = {
  id?: string
  headers?: readonly MimeHeader[]
  subject?: string | null
  from?: string | null
  to?: string | readonly string[] | null
  cc?: string | readonly string[] | null
  bcc?: string | readonly string[] | null
  sentAt?: string | Date | null
  root: MimePart
}

export type EmailViewerMessage = MimeMessage
```

Rules:

- Do not add top-level `htmlBody`, `textBody`, or `attachments`.
- Do not flatten email into a fake file list.
- Do not require parsed headers on every part.
- Do not require every part to have a source.
- Do not force callers to precompute body and attachment membership.

The component receives a MIME object, not a mail client abstraction.

## Stable Identity

Selection uses a MIME path.

```ts
export type MimePartPath = readonly string[]
```

The path must be normalized by the model.

Rules:

- If sibling ids are unique, preserve them.
- If sibling ids collide, derive stable internal siblings such as
  `duplicate`, `duplicate~2`, `duplicate~3`.
- If an id is empty, use a deterministic fallback such as `part-1`.
- Public callbacks return normalized paths.
- Controlled `selectedPath` consumes normalized paths.
- Two visible rows must never share one path.

The path is not an array index API. It is a stable identity projection.

## Normalized Tree

The normalized node is the semantic backbone.

```ts
export type MimePartRole =
  | "multipart"
  | "message"
  | "body"
  | "attachment"
  | "inline-resource"
  | "unknown"

export type MimePartNode = {
  part: MimePart
  path: MimePartPath
  depth: number
  parent: MimePartNode | null
  children: readonly MimePartNode[]
  role: MimePartRole
  mimeType: string
  disposition: string | null
  isMultipart: boolean
  isMessage: boolean
  isRenderable: boolean
  isAttachment: boolean
  isInlineResource: boolean
}
```

The booleans are useful facts. `role` is the model's semantic decision.

Role rules:

- `multipart`: `mimeType` starts with `multipart/`.
- `message`: `mimeType` is a supported nested message container.
- `inline-resource`: non-attachment part with `contentId` and `source`.
- `attachment`: explicit attachment, or renderable non-body file-like part.
- `body`: renderable `text/html`, `text/plain`, or another body candidate.
- `unknown`: structural or unsupported part that cannot preview directly.

The UI should not reproduce these rules.

## Message Scope

Message scope is the central abstraction.

```ts
export type MimeMessageScope = {
  message: EmailViewerMessage
  root: MimePartNode
  path: MimePartPath
  descendants: readonly MimePartNode[]
}
```

Rules:

- A scope starts at one message root.
- A scope includes its root.
- A parent scope stops before descending into nested `message/*` parts.
- A nested message starts a new scope.
- Parent sidebars show nested messages as one attachment row.
- Parent sidebars do not show the nested message's body or attachments.

Without scope, the sidebar leaks child-message parts into the parent message.
That is the core flaw to avoid.

## Viewer Model

The provider derives one full model.

```ts
export type EmailViewerModel = {
  message: EmailViewerMessage
  rootNode: MimePartNode
  scope: MimeMessageScope
  selectedPath: MimePartPath
  selectedNode: MimePartNode
  header: EmailHeaderModel
  sidebar: EmailSidebarModel
  content: EmailContentModel
}
```

Rules:

- `rootNode` is the normalized root.
- `scope` is the current message projection.
- `selectedPath` is always normalized.
- `selectedNode` is always a real node.
- `header`, `sidebar`, and `content` are derived, not hand-built in JSX.

The model is the component's source of truth.

## Header Model

Email header formatting is domain logic.

```ts
export type EmailHeaderModel = {
  subject: string
  from: string | null
  to: string | null
  cc: string | null
  bcc: string | null
  sentAt: string | null
}
```

Rules:

- Empty subject becomes `"(no subject)"`.
- Address arrays become display strings.
- Missing fields become `null`, not empty strings.
- Invalid dates become `null`.
- Nested message headers are derived from the nested message part.
- JSX renders `EmailHeaderModel`; it does not parse MIME headers.

The header is the viewer header. Attachments do not get a second card header in
the email surface.

## Sidebar Model

The sidebar is a product projection, not a raw MIME inspector.

```ts
export type EmailSidebarModel = {
  itemCount: number
  sections: readonly EmailSidebarSection[]
}

export type EmailSidebarSection = {
  id: "body" | "attachments"
  title: string
  items: readonly EmailSidebarItem[]
  emptyLabel?: string
}

export type EmailSidebarItem = {
  id: string
  node: MimePartNode
  path: MimePartPath
  title: string
  description: string
  thumbnail: EmailSidebarThumbnailModel
  isSelected: boolean
}

export type EmailSidebarThumbnailModel =
  | { kind: "file"; source: ViewerSource; aspectRatio: number }
  | { kind: "icon"; icon: "file" | "layers" | "mail" | "paperclip" }
```

Sidebar sections are:

```txt
Body
Attachments
```

Rules:

- Body section contains one preferred body row.
- Attachments section contains explicit attachments and nested messages.
- Inline CID resources are hidden.
- Structural multipart nodes are hidden.
- Alternative body duplicates are hidden by default.
- Empty attachments section renders a quiet empty label.
- Thumbnails are square.
- Sidebar background is not a separate gray slab.
- Text and thumbnails align on one left rhythm.

The sidebar can become more inspectable later, but the default email viewer
should be a reading and review surface, not a MIME debugger.

## Body Selection Policy

Body selection is deterministic.

For `multipart/alternative`:

1. prefer `text/html`
2. then `text/plain`
3. then first renderable non-inline descendant

For `multipart/related`:

1. prefer `text/html`
2. then `text/plain`
3. then first renderable non-inline descendant
4. scope CID resources to the related group

For `multipart/mixed`:

1. prefer the first displayable body descendant

For renderable leaves:

1. select the leaf

For `message/*`:

1. do not select a child in the parent viewer
2. produce nested-message content

Inline resources are never body candidates.

Attachments are never body candidates unless selected directly.

The default selected path is the preferred body path for the current message
scope.

## Attachment Policy

A node is an attachment row when:

- `disposition === "attachment"`
- it is a nested `message/*` part
- it is a renderable non-body file-like node in the current message scope

A node is not an attachment row when:

- it is a multipart structural node
- it is an inline CID resource
- it is the preferred body node
- it is an alternative body hidden by body policy
- it is inside a nested message owned by another scope

This gives the UI the expected mail-client projection without throwing away the
underlying MIME tree.

## Content Model

Selected content is a discriminated union.

```ts
export type EmailContentModel =
  | EmailContentFile
  | EmailContentNestedMessage
  | EmailContentEmpty

export type EmailContentFile = {
  kind: "file"
  node: MimePartNode
  file: EmailFilePayload
}

export type EmailContentNestedMessage = {
  kind: "nested-message"
  node: MimePartNode
  message: EmailViewerMessage
  maxNestedMessageDepth: number
  nestedMessageDepth: number
}

export type EmailContentEmpty = {
  kind: "empty"
  node: MimePartNode
  message: string
}

export type EmailFilePayload = {
  source: ViewerSource
  category?: FileCategory
}
```

Rules:

- Renderable leaf becomes `kind: "file"`.
- Multipart node resolves to its default display descendant.
- Nested message node becomes `kind: "nested-message"`.
- Unsupported node becomes `kind: "empty"`.
- File content receives only `EmailFilePayload`.
- Nested email content receives only `EmailViewerMessage`.

The rendering component is intentionally boring:

```tsx
function EmailContent() {
  const content = useEmailContent()

  if (content.kind === "nested-message") {
    return (
      <EmailViewer
        bare
        message={content.message}
        maxNestedMessageDepth={content.maxNestedMessageDepth}
        nestedMessageDepth={content.nestedMessageDepth}
      />
    )
  }

  if (content.kind === "empty") {
    return <EmailEmptyContent message={content.message} />
  }

  return (
    <FileViewer
      source={content.file.source}
      as={content.file.category}
      bare
      className="size-full min-h-0"
    />
  )
}
```

No MIME branching belongs in this component.

## Nested Messages

Nested messages are complete email viewers.

Rules:

- Parent sidebar shows the nested message as one attachment.
- Selecting it renders a nested `EmailViewer`.
- The nested viewer is `bare`.
- The nested viewer gets a new `EmailViewerProvider`.
- The nested viewer gets a new `ViewerRoot`.
- The nested viewer gets its own header, body selection, sidebar model, and
  content model.
- The nearest `ViewerSidebarTrigger` controls the nearest `ViewerRoot`.

Nested rendering must be bounded.

```ts
export type EmailViewerProps = {
  maxNestedMessageDepth?: number
}
```

Default:

```ts
const DEFAULT_MAX_NESTED_MESSAGE_DEPTH = 8
```

If exceeded:

```ts
{
  kind: "empty",
  message: "This nested message is too deeply nested to preview."
}
```

This keeps the recursive design honest.

## Inline CID Resources

Inline resources have a model layer and a runtime layer.

Model:

```ts
export type EmailInlineResourceScope = {
  root: MimePartNode
  resources: readonly MimePartNode[]
}
```

Runtime:

```ts
export function useEmailInlineResourceUrls(
  scope: EmailInlineResourceScope
): ReadonlyMap<string, string>
```

Rules:

- Scope is usually the nearest `multipart/related` ancestor.
- Only non-attachment nodes with `contentId` and `source` are resources.
- Content IDs are normalized by trimming angle brackets and lowercasing.
- HTML `cid:` URLs are replaced only when a matching resource exists.
- Missing CID references remain unchanged.
- URL sources use their URL directly.
- Text/blob sources become browser URLs.
- Blob object URLs are revoked on cleanup.

The hook owns object URL lifecycle. The model owns resource membership.

## Source Rewriting

CID replacement should produce a new source only when needed.

Rules:

- Only `text/html` sources are rewritten.
- Only text-like HTML source payloads are rewritten directly.
- The rewritten source keeps file metadata.
- The rewritten source gets a stable identity key tied to selected node path and
  inline resource scope.
- Non-HTML files pass through untouched.

`FileViewer` should never learn about `cid:`.

## Public Props

Use one prop shape for `EmailViewer` and `EmailViewerProvider`.

```ts
export type EmailViewerProps = {
  message: EmailViewerMessage
  selectedPath?: MimePartPath | null
  defaultSelectedPath?: MimePartPath
  onSelectedPathChange?: (path: MimePartPath, node: MimePartNode) => void
  maxNestedMessageDepth?: number
  className?: string
  bare?: boolean
}
```

Selection semantics:

- `selectedPath === undefined`: uncontrolled.
- `selectedPath === null`: controlled clear; fall back to default.
- invalid controlled path: fall back to default without firing callback.
- `defaultSelectedPath`: used only if it resolves to a node.
- `onSelectedPathChange`: called only for user selection.
- callback path is normalized.

The public API should not expose a separate `selectedAttachmentId`.

## FileViewer Boundary

`FileViewer` is a leaf renderer.

Email may pass:

- selected body source
- selected attachment source
- transformed HTML source with CID URLs rewritten
- category hint for text/html/markdown/plain text

Email must not pass:

- MIME tree
- MIME node
- email headers
- sidebar state
- attachment list
- message scope

The file renderer does not know the file came from an email.

## Viewer Primitive Boundary

The viewer primitives own spatial layout.

Email uses:

- `ViewerRoot`
- `ViewerHeader`
- `ViewerBody`
- `ViewerSurface`
- `ViewerSidebar`
- `ViewerSidebarTrigger`

Email does not wrap those primitives in another visual shell unless it is the
easy `EmailViewer` assembly.

`EmailHeader` renders inside `ViewerHeader`.

`EmailPartsSidebar` renders inside `ViewerSidebar`.

`EmailContent` renders inside `ViewerSurface`.

This is shadcn-compliant because the primitive is composable, and the easy API
is just the common assembly.

## Component Files

Final file ownership:

```txt
email-viewer-types.ts
  raw input types
  normalized tree types
  derived model types
  public prop types

email-viewer-model.ts
  tree normalization
  path normalization
  MIME classification
  message scope derivation
  header model derivation
  sidebar model derivation
  content model derivation
  nested message conversion
  CID string utilities

email-viewer-inline-resources.ts
  React hook for source-to-URL materialization
  object URL cleanup

email-viewer.tsx
  provider
  public hooks
  easy EmailViewer assembly
  EmailHeader
  EmailPartsSidebar
  EmailContent
```

Optional future split:

```txt
email-viewer-header.tsx
email-viewer-sidebar.tsx
email-viewer-content.tsx
```

Do not split early for symmetry. Split only when reading improves.

## Public Exports

Named exports should be separate, not dot-names.

Good:

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

Avoid:

```ts
EmailViewer.Root
EmailViewer.Header
EmailViewer.Sidebar
```

Separate named exports are clearer in this codebase, match existing imports
better, and avoid making `EmailViewer` look like a namespace object.

## Layout Rules

The default easy API should render:

```txt
outer email slot
  viewer root
    email header
    viewer body
      viewer surface
        email content
      viewer sidebar
        email parts sidebar
```

The composed API may reverse sidebar and surface.

Visual rules:

- no duplicated attachment header above selected file content
- no card inside card
- no gray sidebar slab
- square thumbnails
- consistent left alignment for icon and preview thumbnails
- one body section and one attachments section
- sidebar trigger can live in header or any component inside the same
  `ViewerRoot`
- selected attachment uses the full `ViewerSurface` width

The exact side of the sidebar is layout, not domain.

## Accessibility

Required behavior:

- Sidebar has an accessible label.
- Sidebar rows are buttons.
- Selected row exposes selected state.
- Header subject is meaningful text.
- Empty content is readable by assistive tech.
- Sidebar trigger has a label from the viewer primitive.
- Keyboard selection follows normal button behavior.

The email viewer should not invent a roving-tabindex list until the interaction
requires arrow-key navigation. Buttons are enough for the current UI.

## Performance

The expensive work is pure and memoized.

Rules:

- Build MIME tree with `useMemo(message.root)`.
- Derive default path with `useMemo(rootNode, defaultSelectedPath)`.
- Derive inline resource scope from selected node.
- Materialize inline URLs only for current content scope.
- Revoke object URLs promptly.
- Derive viewer model with stable inputs.
- Do not flatten the whole tree repeatedly in render.
- Do not render nested message trees until selected.

Large attachments should still be delegated to `FileViewer` lazy behavior.

## Error States

Required empty states:

- no previewable body
- unsupported selected MIME part
- invalid selected path fallback
- nested depth exceeded
- attachment source missing

The model should represent these as `EmailContentEmpty`.

Do not throw for ordinary malformed MIME. Throw only for hook misuse such as
calling `useEmailViewer()` outside the provider.

## Tests

Model tests:

- duplicate sibling ids normalize paths
- empty ids normalize paths
- `multipart/alternative` prefers HTML over plain text
- `multipart/related` scopes CID resources
- inline CID resources are excluded from sidebar
- parent scope does not include nested message children
- nested message produces nested content model
- nested depth budget produces empty content
- explicit attachments appear in attachment section
- structural multipart nodes do not appear in sidebar
- invalid selected/default paths fall back deterministically

Rendering tests:

- easy `EmailViewer` renders header, body, attachments
- composed API renders with `EmailViewerProvider`
- sidebar selection renders selected attachment through `FileViewer`
- selected attachment has no duplicate attachment header
- controlled `selectedPath` renders controlled content
- `selectedPath={null}` falls back to default body
- duplicate id callback returns normalized path
- nested message renders nested email viewer
- blob CID URL is revoked on unmount

Architecture tests:

- `email-viewer.tsx` imports model derivation instead of implementing it inline
- no `MimeDisplayPart`
- no local `getSidebarSections`
- no local `getBodyNode`
- no local MIME tree walker in React
- no shadcn sidebar provider inside email
- easy API contains `EmailViewerProvider`, `ViewerRoot`, `EmailHeader`,
  `ViewerBody`, `ViewerSurface`, `EmailContent`, `ViewerSidebar`,
  `EmailPartsSidebar`

Docs tests or docs review:

- installation snippet
- easy API snippet
- composed API snippet
- nested message explanation
- CID explanation
- props table

## Registry Rules

The email registry item should include:

```txt
registry/new-york-v4/ui/email-viewer.tsx
registry/new-york-v4/ui/email-viewer-types.ts
registry/new-york-v4/ui/email-viewer-model.ts
registry/new-york-v4/ui/email-viewer-inline-resources.ts
```

Do not rebuild unrelated registry payloads just to update email.

If the registry build tool cannot target one item, update only the email
payload or ask before broad regeneration.

## Migration Cut

No compatibility shim.

Remove:

- `MimeDisplayPart`
- `EmailViewerHeader` if it duplicates `EmailHeader`
- `EmailViewerPartsList` if it duplicates `EmailPartsSidebar`
- `useEmailViewerHeader`
- `useEmailViewerPartsList`
- `useEmailViewerSelectedPart`
- render-time `getBodyNode`
- render-time `getSidebarSections`
- render-time `walkCurrentMessageNodes`

Keep:

- `EmailViewer`
- `EmailViewerProvider`
- `EmailHeader`
- `EmailPartsSidebar`
- `EmailContent`
- `useEmailViewer`
- `useEmailHeader`
- `useEmailPartsSidebar`
- `useEmailContent`

Hard cutovers are preferred. The component library should expose the final
shape, not a permanent compatibility layer.

## Implementation Order

1. Move all exported types into `email-viewer-types.ts`.
2. Normalize MIME tree and paths in `email-viewer-model.ts`.
3. Add explicit `MimeMessageScope`.
4. Add header/sidebar/content/inline-resource models.
5. Add nested message conversion and recursion budget.
6. Move CID object URL lifecycle into `email-viewer-inline-resources.ts`.
7. Rewrite provider to expose `{ model, selectPart }`.
8. Rewrite hooks as narrow projections.
9. Rewrite `EmailHeader`, `EmailPartsSidebar`, and `EmailContent` to render
   models only.
10. Update docs and registry item.
11. Add model, render, and architecture tests.
12. Remove stale exports and names.

## Final Acceptance Criteria

The design is complete when:

- Email can render a normal HTML email.
- Email can render plain text fallback.
- Email can render `multipart/alternative`.
- Email can render `multipart/related` with CID images.
- Email can render regular attachments.
- Email can render nested `message/rfc822`.
- Parent and nested sidebars are scoped correctly.
- Sidebar has exactly body and attachments sections by default.
- Selected attachment takes the full surface.
- No duplicate attachment header appears.
- Inline object URLs are cleaned up.
- Selection is controllable.
- Duplicate MIME ids do not collide.
- The React file contains no MIME derivation policy.
- The model file is testable without React.
- `FileViewer` remains a leaf renderer.
- The file-system viewer remains untouched.

## Final Position

The provider idea is not a dead end if it is one domain provider.

The dead end would be provider proliferation:

```txt
EmailProvider
  EmailSidebarProvider
    FileViewerProvider
      SidebarProvider
```

The correct shape is:

```txt
EmailViewerProvider     domain state
  ViewerRoot            spatial state
    EmailHeader         header projection
    ViewerBody
      ViewerSidebar     spatial sidebar slot
        EmailPartsSidebar
      ViewerSurface
        EmailContent
```

That is simple, expressive, recursive, and shadcn-grade.

It gives product code the small easy API and gives advanced code the composed
parts. It keeps MIME intelligence in the model. It keeps layout intelligence in
viewer primitives. It keeps file rendering in `FileViewer`.

That is the final blueprint.
