# Viewer Gap 03: Email Viewer Public Hooks

## Question

Should `useEmailViewer()` remain public if narrow hooks already exist?

The answer should mirror the FileViewer direction: public hooks should expose
the smallest coherent slice. Whole-context hooks should be private unless the
whole context is itself the public primitive.

## Current State

Good:

- `EmailViewerProvider` owns one MIME message and selected MIME part state.
- `EmailHeader`, `EmailPartsSidebar`, and `EmailContent` are named parts.
- `useEmailHeader`, `useEmailPartsSidebar`, and `useEmailContent` exist.
- `EmailViewerFrame` exposes the same composition as the easy API.

Bad:

- `useEmailViewer()` exposes the full context.
- Narrow hooks call through the public whole-context hook.
- Future consumers may couple to full `model` and `selectPart`.
- Nested messages recursively create nested `ViewerRoot`s, which may be correct
  but is not yet a deliberate public contract.

## Ideal Hook Surface

Public:

```ts
useEmailHeader(): EmailHeaderModel

useEmailPartsSidebar(): {
  sidebar: EmailSidebarModel
  selectPart: (node: MimePartNode) => void
}

useEmailContent(): EmailContentModel

useEmailSelection(): {
  selectedPath: MimePartPath
  selectedNode: MimePartNode
  selectPart: (node: MimePartNode) => void
}
```

Private:

```ts
useEmailViewerContext(): EmailViewerContextValue
```

Avoid:

```ts
useEmailViewer(): EmailViewerContextValue
```

unless it returns a deliberately small public state object.

## Public State Option

If `useEmailViewer` must remain public, make it narrow:

```ts
type EmailViewerState = {
  header: EmailHeaderModel
  content: EmailContentModel
  sidebar: EmailSidebarModel
}

function useEmailViewer(): EmailViewerState
```

Then private internals still use:

```ts
function useEmailViewerContext(): EmailViewerContextValue
```

This preserves symmetry with FileViewer:

```txt
useFileViewer          -> public file state
useFileViewerHeader    -> header state
useFileViewerContent   -> content state
private context hook   -> full implementation state
```

## Nested Message Decision

Nested messages currently render by recursively mounting `EmailViewerInternal`
with `bare`.

That gives nested messages full email behavior:

```txt
header
sidebar
selection
content
attachments
```

This is powerful but visually heavy.

There are two acceptable contracts:

### Option A: Nested Messages Are Full Embedded Emails

Keep the recursive viewer.

Document it:

```txt
message/rfc822 parts render as complete nested email viewers, using bare
ViewerRoot chrome.
```

This is correct if nested attachments should be navigable.

### Option B: Nested Messages Are Message Content

Render a nested message as content:

```tsx
<NestedEmailContent message={message} />
```

It can show a compact message header and body without a second sidebar.

This is correct if the outer sidebar owns all part navigation.

## Recommended Direction

Do the hook cleanup first. Defer nested message redesign until there is visual
pressure or a failing use case.

Implementation order:

1. Rename the current full hook to private `useEmailViewerContext`.
2. Reintroduce `useEmailViewer` as a narrow public state hook, or remove it from
   exports if no public consumer needs it.
3. Update narrow hooks to call the private context directly.
4. Add guard tests that public named parts do not depend on a full public hook.
5. Document nested message behavior explicitly.

## Success Criteria

- No exported hook leaks mutable full context by accident.
- Header/sidebar/content hooks expose only what their parts need.
- Tests prove the public hook surface.
- `EmailViewerFrame` remains the visible easy API composition.
- Nested message behavior is explicitly chosen or explicitly deferred.

## Failure Signals

- Consumer examples destructure `model` from `useEmailViewer`.
- Narrow hooks become aliases for a large public context.
- Nested message behavior changes while hook cleanup is being attempted.
- Email-specific state leaks into generic viewer primitives.

