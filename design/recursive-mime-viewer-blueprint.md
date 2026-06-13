# Recursive MIME Viewer Blueprint

## Objective

Replace the current flat `EmailViewer` mental model with a recursive MIME
viewer model while preserving the existing viewer architecture.

The goal is not to make `FileViewer` understand email. The goal is to make
email a compound document viewer that:

- represents MIME as a tree;
- renders file-like MIME leaves through `FileViewer`;
- renders multipart and forwarded-message nodes recursively;
- uses `ViewerShell` for document composition;
- uses embedded sidebar primitives for MIME part navigation;
- treats headers as document-attached chrome, like segment legends;
- avoids custom one-off email layout that does not match the rest of the
  viewer library.

## Current Diagnosis

The current `EmailViewer` is structurally useful but semantically flat.

It accepts:

```ts
type EmailViewerMessage = {
  id?: string
  subject?: string | null
  from?: string | null
  to?: string | readonly string[] | null
  sentAt?: string | Date | null
  htmlBody?: string | null
  textBody?: string | null
  attachments?: readonly EmailViewerAttachment[]
}
```

That describes "one synthesized body plus a flat attachment list." It does not
describe MIME. Real email is recursive:

```txt
multipart/mixed
  multipart/alternative
    text/plain
    multipart/related
      text/html
      image/png; Content-ID=<logo>
  application/pdf; attachment
  message/rfc822; attachment
    multipart/mixed
      text/html
      application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

The current selection model is also flat:

```ts
type Selection = { kind: "body" } | { kind: "attachment"; attachmentId: string }
```

A recursive MIME viewer needs selection by MIME part identity or path, not by
"body versus attachment."

## Architecture Conclusion

The existing component abstractions are good enough for the viewer composition.
The current email data structure is not.

Keep:

- `ViewerShell` as the frame for compound viewer layout.
- `Sidebar` and `EmbeddedSidebarProvider` as the visual/navigation primitive
  family.
- `FileViewer` as the leaf renderer for file-like parts.
- concrete viewers such as `PdfViewer` as format-specific renderers with their
  own internal slots and controls.

Change:

- Replace the flat email contract with a MIME tree contract.
- Replace attachment-id selection with part-path selection.
- Replace the current global email header placement with document-attached MIME
  header strips.
- Replace "attachment sidebar" as the only navigation concept with a recursive
  MIME part sidebar.

Do not:

- Make `FileViewer` recursive.
- Add email-specific behavior to `FileViewer`.
- Force all viewer formats into one universal provider.
- Treat every sidebar-shaped surface as the same data model.

## Data Model

Introduce a recursive MIME tree.

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
```

`source` exists only on renderable leaves. Multipart nodes and message nodes
usually have `children`.

Do not encode HTML and text body as special top-level fields. They are MIME
parts:

```ts
{
  id: "1.2",
  mimeType: "text/html",
  source: {
    kind: "text",
    text: "<p>Hello</p>",
    fileName: "message.html",
    mimeType: "text/html",
    identityKey: "email:abc:part:1.2"
  }
}
```

## Derived Model

The viewer should derive a normalized tree from `MimeMessage`.

```ts
export type MimePartNode = {
  part: MimePart
  path: readonly string[]
  depth: number
  parent: MimePartNode | null
  children: readonly MimePartNode[]
  isMultipart: boolean
  isMessage: boolean
  isRenderable: boolean
  isAttachment: boolean
  isInlineResource: boolean
}
```

Important derived concepts:

- `isMultipart`: `mimeType` starts with `multipart/`.
- `isMessage`: `mimeType` is `message/rfc822` or another message container.
- `isRenderable`: `source` exists and the part is not only an inline CID
  resource.
- `isAttachment`: `disposition === "attachment"` or file-like part that should
  appear in navigation.
- `isInlineResource`: `contentId` exists and the part is referenced from a
  related HTML body.

Selection should use a stable path:

```ts
export type MimePartPath = readonly string[]

export type MimeViewerState = {
  selectedPath: MimePartPath
}
```

The path can be based on MIME part ids. It should not depend on array indexes
unless the parser cannot supply stable ids.

## Body Candidate Selection

MIME has display semantics, not just tree semantics.

For a selected multipart node, the viewer should choose a default renderable
descendant:

1. For `multipart/alternative`, prefer `text/html`, then `text/plain`, then the
   first renderable child.
2. For `multipart/related`, prefer the root body part, usually HTML, and build a
   CID map from related inline resources.
3. For `multipart/mixed`, prefer the first displayable body descendant and keep
   attachments in navigation.
4. For `message/rfc822`, render a nested MIME viewer surface.

This selection is a projection, not a mutation of the tree.

```ts
export type MimeDisplayPart = {
  node: MimePartNode
  source: ViewerSource
  category?: FileCategory
  inlineResourceUrls?: ReadonlyMap<string, string>
}
```

## CID Resource Handling

CID resources are not ordinary attachments when they are used by a related HTML
body.

Rules:

- Inline CID parts should remain in the MIME tree but can be visually grouped
  under the body or hidden behind an "Inline resources" disclosure.
- Blob/text CID parts may need object URLs.
- Object URLs must be scoped to the selected body projection and revoked on
  change or unmount.
- CID replacement should happen before handing HTML to `FileViewer`.
- Email HTML must still route through the existing sandboxed HTML viewer path.

## Component Shape

### Public Entry

```tsx
<MimeViewer message={message} />
```

Email can be a named alias if the library wants product language:

```tsx
<EmailViewer message={message} />
```

But internally, it should be a MIME viewer.

### Proposed Components

```txt
mime-viewer.tsx
  public component and shell composition

mime-viewer-types.ts
  MimeMessage, MimePart, MimePartNode, MimePartPath

mime-viewer-model.ts
  tree normalization, path lookup, body candidate selection, CID helpers

mime-viewer-sidebar.tsx
  recursive MIME part navigation built from Sidebar primitives

mime-viewer-header.tsx
  message and selected-part header strips

mime-viewer-content.tsx
  renders selected node: FileViewer leaf or nested MimeViewer section

mime-viewer-cid.ts
  object URL lifecycle and HTML cid replacement
```

## Composition

The outer viewer should look like the rest of the viewer library:

```tsx
<ViewerShell
  slots={{
    top: <MimeMessageHeader message={message} selectedNode={selectedNode} />,
    right: (
      <MimePartSidebar
        root={rootNode}
        selectedPath={selectedPath}
        onSelectPath={setSelectedPath}
      />
    ),
  }}
>
  <MimeViewerContent node={selectedNode} />
</ViewerShell>
```

The selected content can have its own part header:

```tsx
<div className="flex h-full min-h-0 flex-col">
  <MimePartHeader node={selectedNode} />
  <FileViewer source={display.source} as={display.category} bare />
</div>
```

This matches the desired visual hierarchy:

```txt
Email / MIME shell
  top strip: message-level header
  right rail: recursive MIME / attachments sidebar
  content:
    part-level header
    selected file/body viewer
```

The message-level header should behave like `SegmentLegend`: document-attached
chrome, not an app page header and not hidden inside `FileViewer`.

## Recursion Policy

Only MIME containers recurse.

Leaf formats do not recurse:

- PDF -> `FileViewer`
- image -> `FileViewer`
- DOCX -> `FileViewer`
- XLSX -> `FileViewer`
- HTML body -> `FileViewer` after CID rewrite
- text body -> `FileViewer`

Recursive containers:

- `multipart/*`
- `message/rfc822`
- possibly `message/global`

For nested `message/rfc822`, use a nested MIME viewer body, but avoid nested
outer borders by default:

```tsx
<MimeViewer message={nestedMessage} bare />
```

Nested surfaces should visually read as a forwarded message, not a full app
inside an app.

## Sidebar Semantics

The sidebar should represent the MIME tree, not just attachments.

Rows can include:

- message body candidates;
- multipart groups;
- related inline resources;
- regular attachments;
- nested messages;
- unsupported parts.

The sidebar should use `Sidebar` primitives for row grammar, but its domain
model should stay MIME-specific.

```ts
export type MimePartSidebarProps = {
  root: MimePartNode
  selectedPath: MimePartPath
  onSelectPath: (path: MimePartPath) => void
  showInlineResources?: boolean
  className?: string
}
```

Do not overload `AttachmentSidebar` to become a MIME tree. It can remain useful
for flat attachment navigation in simpler compound viewers. A MIME tree sidebar
is a sibling domain component, not a variant of `AttachmentSidebar`.

## Header Semantics

There should be two header levels.

Message header:

- subject;
- sender and recipients;
- sent date;
- selected part summary if useful.

Part header:

- file name or MIME label;
- MIME type;
- disposition;
- size;
- content id;
- download/open action when applicable.

The part header belongs above the selected `FileViewer`, not in the sidebar and
not in the `FileViewer` toolbar. It describes the MIME part, while the inner
viewer toolbar describes format-specific actions.

Example:

```txt
Message: Contract packet ready for review
From Mina -> Avery · Jun 13, 2026

Selected part: spacex-prospectus.pdf
application/pdf · attachment · 12.4 MB

[PDF viewer toolbar]
[PDF document]
```

## Relationship To FileViewer

`FileViewer` remains a leaf renderer.

It may optionally accept shell slots in the future, but MIME recursion should
not depend on that. A MIME viewer can already compose:

```tsx
<ViewerShell>
  <FileViewer source={selectedLeaf.source} bare />
</ViewerShell>
```

Do not add:

```tsx
<FileViewer source={emailSource} />
```

unless `emailSource` is a simple RFC822 file preview route. That would render a
file, not expose the structured MIME tree.

## Controlled And Uncontrolled State

The MIME viewer should support both.

```ts
export type MimeViewerProps = {
  message: MimeMessage
  selectedPath?: MimePartPath
  defaultSelectedPath?: MimePartPath
  onSelectedPathChange?: (path: MimePartPath, node: MimePartNode) => void
  className?: string
  bare?: boolean
}
```

Default selection should choose the best body candidate from the root.

When the message changes, selection should reset if the selected path no longer
exists.

## Accessibility

- Sidebar rows should be buttons or tree items with clear labels.
- Nested MIME groups need expanded/collapsed semantics if collapsible.
- The selected part row should use `aria-current="page"` or equivalent.
- The part header should be connected to the content region with an accessible
  label.
- Inline resources hidden from the default sidebar must not become unreachable
  if they are meaningful attachments.

## Testing Plan

Unit tests:

- normalize a simple flat message;
- normalize nested `multipart/alternative`;
- normalize `multipart/related` with CID resources;
- select preferred body part;
- replace CID URLs;
- keep `Content-Disposition: attachment` CID files out of inline replacement;
- find node by selected path;
- reset invalid selected path.

Component tests:

- render HTML body through `FileViewer`;
- render text fallback;
- show recursive sidebar rows;
- select attachment leaf and render it through `FileViewer`;
- select nested `message/rfc822` and render nested MIME content;
- show message header and part header at the correct levels;
- do not show app-shell sidebar behavior inside the viewer;
- revoke object URLs for inline resources.

Regression tests:

- existing flat email fixture can be represented as a MIME tree;
- inline logo does not appear as a regular attachment by default;
- attachment with `Content-ID` and `disposition: attachment` remains selectable;
- unsupported parts show a stable unsupported state.

## Migration

Avoid a compatibility shim in the final public API.

Short-term internal migration can provide a helper only for demos/tests:

```ts
function flatEmailMessageToMimeMessage(
  input: LegacyEmailViewerMessage
): MimeMessage
```

Do not export this as the preferred user-facing contract. The public contract
should be the MIME tree.

Existing docs should move from "HTML body plus attachments" to "recursive MIME
parts." The usage example should still be small, but it should show `root`.

## Decision

The current viewer abstractions are sufficient for recursive MIME composition:

- `ViewerShell` handles the compound layout.
- `Sidebar` handles embedded navigation grammar.
- `FileViewer` handles leaf rendering.
- concrete viewers keep format-specific controls.

The missing abstraction is a MIME tree model and MIME-specific domain
components.

Implement `MimeViewer` as a domain viewer above `FileViewer`, not as a new
format inside `FileViewer` and not as a global provider that tries to make every
file format recursive.
