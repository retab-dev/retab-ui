# Code Viewer Small-Scroll Blinking Blueprint

## Problem

Large scroll behavior improved after adopting Pierre-style worker-backed syntax
tokenization, but small scroll now feels visibly unstable. The symptom reads as
"virtualization blinking": rows appear to pop or repaint while the user scrolls
through nearby content.

This blueprint is read-only diagnosis plus an implementation plan. It should be
implemented in a separate pass.

## Verdict

The primary issue is probably not row virtualization speed. The stronger
culprit is broad syntax invalidation.

Worker token batches now arrive asynchronously while the user is still looking
at the same neighborhood of rows. Every successful token batch increments a
viewer-level syntax version, and that version is part of every mounted row's
content identity. A token update for a small set of lines can therefore make
the projector revisit content for the whole mounted window.

That behavior is technically correct, but visually too coarse.

Secondary contributor: the current overscan window is smaller and more
line-boundary-sensitive than Pierre's centered pixel window. If blinking still
exists for plain `.log`/`text/plain` files, the row window and scheduler should
be tuned next. If blinking mostly appears for `.json`, `.ts`, `.tsx`, or other
highlighted files, syntax invalidation should be fixed first.

## Implementation Status

Implemented in this pass:

- `CodeSyntax.getLineVersion(line)` as the per-line freshness boundary.
- Async worker and deferred main-thread token results now increment only the
  line whose token cache actually changed.
- Duplicate equivalent token results no longer trigger another line version or
  notification.
- The projector row content identity now uses
  `text + syntax.identity + syntax.getLineVersion(text)`.
- Batch-level `syntaxIdentity` can still force a projection pass, but it no
  longer makes every row content-stale.
- Tests now prove that a syntax notification without line version changes does
  no row content work, and that a changed line version rebuilds only that row.

Still conditional:

- Overscan calibration remains a follow-up only if plain `.log`/`text/plain`
  files still blink after this narrower syntax invalidation.
- Browser scrollbench was not run here because repository policy requires a
  user-started dev server.

## Evidence

### Retab Syntax Invalidation Path

`CodeViewerContent` stores one global syntax version:

- `registry/new-york-v4/ui/code-viewer-content.tsx`
- `syntaxVersion` is incremented by `onTokensChanged`
- `syntaxIdentity` becomes `${syntax.identity}\0${syntaxVersion}`

The projector uses that global syntax identity in every visible row:

- `registry/new-york-v4/ui/code-viewer-projector.ts`
- row content identity is `[text, input.syntaxIdentity].join("\0")`
- when content identity changes, `patchCodeRowContent()` runs
- highlighted rows rebuild token spans with `replaceChildren()`

The syntax provider batches worker results:

- `registry/new-york-v4/ui/code-viewer-syntax.ts`
- worker responses cache tokens for returned lines
- any successful response schedules one `onTokensChanged`

Net effect:

```txt
one worker batch returns tokens
  -> viewer syntaxVersion increments
  -> syntaxIdentity changes globally
  -> every mounted row contentIdentity changes
  -> visible window content is patched again
```

That creates visible repaint churn during small, continuous scroll because the
same visible rows stay on screen long enough to receive multiple syntax updates.

### Retab Window Shape

The current code window is fixed-line math:

- `CODE_VIEWER_OVERSCAN = 24`
- first visible line is `floor((scrollTop - paddingStart) / lineHeight)`
- window start is `firstVisibleLine - overscan`
- window end is `firstVisibleLine + visibleLineCount + overscan * 2`

At default `lineHeight = 20`, overscan is roughly `480px` before and after the
viewport. That is reasonable, but smaller than Pierre's default and it moves at
line-boundary granularity.

### Pierre Contrast

Pierre's virtualizer uses a centered pixel window:

- `createWindowFromScrollPosition()`
- `windowHeight = viewportHeight + overscrollSize * 2`
- default `overscrollSize = 1000`

Pierre's highlighter path also has narrower invalidation:

- `WorkerPoolManager.highlightFileAST()` avoids work if a matching cached
  result exists.
- queued and active work is coalesced by highlight key.
- worker results are cached by file/diff cache key before notifying renderers.
- `FileRenderer.onHighlightSuccess()` only triggers a render update if the
  file, highlighted state, or render options changed.

The important lesson is not to copy Pierre's full file/diff renderer. The
lesson is to make async syntax results invalidate the smallest surface that can
change.

## Desired Behavior

Small scroll should feel visually stable:

- no plain-to-highlight popping for already-highlighted rows
- no repeated token span rebuilds for rows whose tokens did not change
- no row removal/reinsertion while scrolling within buffered coverage
- no visible blank bands at the top or bottom of the viewport
- syntax can still appear progressively, but only on rows that actually
  received tokens

Plain text should remain immediately readable. Syntax highlighting should never
block scroll.

## Root Fix: Per-Line Syntax Freshness

Replace global syntax-version invalidation with per-line token freshness.

Current content identity:

```ts
const contentIdentity = [text, input.syntaxIdentity].join("\0")
```

Target content identity:

```ts
const contentIdentity = [
  text,
  input.syntax.identity,
  input.syntax.getLineVersion(text),
].join("\0")
```

The syntax provider should expose a stable language identity and a per-line
version:

```ts
type CodeSyntax = {
  identity: string
  destroy?: () => void
  getLineTokens(line: string): readonly CodeTokenLeaf[] | null
  getLineVersion(line: string): number
  preload?: () => Promise<void>
}
```

Rules:

- Unknown/plain syntax returns version `0`.
- Untokenized known-language lines return version `0`.
- When tokens arrive for a line, increment only that line's version.
- Repeated worker results with equivalent tokens should not increment the line.
- Over-limit and empty lines stay version `0`.
- The projector's global projection identity may still include
  `syntax.identity`, but not a batch counter.

This keeps projection cheap:

- rows whose line tokens did not change remain content-stable
- rows that just received tokens repaint once
- scroll window changes do not trigger unrelated token rebuilds

## Secondary Fix: Syntax Notifications Without React Repaint Pressure

Today token changes go through React state:

```txt
onTokensChanged -> setSyntaxVersion -> new project callback -> project()
```

After per-line versions exist, React does not need to own a monotonic syntax
counter. Prefer a direct projection scheduling path:

```ts
createCodeSyntax(resource, {
  onTokensChanged: scheduleProjection,
})
```

or keep state only as a bridge if the hook structure makes that necessary. The
important constraint is that the projector should read per-line versions from
the syntax provider and avoid global content invalidation.

## Optional Fix: Preserve Plain Text Node When Highlighting Arrives

`replaceChildren()` is correct but visually abrupt. After the per-line version
fix, it should only happen once per newly-highlighted row, which may be enough.

If the pop is still visible, add a same-frame replacement strategy:

- build highlighted fragment off-DOM
- replace only after the fragment is complete
- avoid clearing the content span before appending the fragment

Do not add animation or opacity fades. This is a code surface; decoration would
hide rather than solve the issue.

## Overscan Follow-Up

Only tune overscan after syntax invalidation is narrowed.

Measure:

- `text/plain` with no syntax
- `.json` with worker syntax
- `.ts` or `.tsx` with worker syntax

If `text/plain` still blinks:

- raise `CODE_VIEWER_OVERSCAN` from `24` to `36` or `48`
- consider pixel-based overscan to match Pierre's window semantics
- consider a centered line window instead of a first-visible-line anchored
  window

Do not blindly copy Pierre's `1000px` default. At Retab's default `20px`
line-height, that is roughly `50` lines above and below. It may be appropriate,
but it should be measured against DOM count, token requests, and p95 frame time.

## Rejected Fixes

### Do Not Disable Virtualization For Small Scroll

The row virtualizer is still the right shape. Turning it off would increase DOM
size and make large files worse.

### Do Not Move Tokenization Back To The Main Thread

Worker syntax improved large-scroll behavior and protects input responsiveness.
The issue is invalidation granularity, not worker usage.

### Do Not Add Variable-Height Measurement

The code viewer's fixed line-height contract is valuable. The blinking problem
does not require measured row geometry.

### Do Not Add Pierre's Full Item Renderer

Pierre solves mixed file/diff layouts with headers, annotations, wrapping, and
measured heights. Retab's code viewer only needs the narrow invalidation lesson.

## Implementation Plan

### Phase 1: Prove The Source Of Blink

Add or run a small-scroll comparison:

- `/scrollbench?viewer=text` with `fileName: scrollbench.log`
- same text but with `fileName: scrollbench.json`
- same text but with syntax mode forced to `main-thread` in a local experiment
- same text but with worker syntax disabled in a local experiment

Look at:

- mutation records
- added/removed elements
- text mutations
- token span rebuilds
- row removals/reuses
- visual capture if available

Expected if this diagnosis is correct:

- plain `.log` has low blinking
- syntax files have higher text/child mutations during small scroll
- row removal count is not the dominant signal

### Phase 2: Add Per-Line Syntax Versions

Update `CodeSyntax`:

- add `getLineVersion(line)`
- store a `Map<string, number>` next to `tokenCache`
- increment only for lines whose token cache changes
- keep `identity` as the language id, not a versioned identity

Update tests:

- cached lines keep the same version
- worker result increments only returned lines
- duplicate equivalent worker result does not increment again
- stale worker result does not increment
- destroy prevents version changes and notifications

### Phase 3: Narrow Projector Content Identity

Update row content identity:

```ts
const contentIdentity = [
  text,
  input.syntax.identity,
  input.syntax.getLineVersion(text),
].join("\0")
```

Update tests:

- syntax update for line A does not rebuild line B
- repeated syntax notification with no line version change is a no-op
- highlight/layout changes still do not rebuild token content
- plain rows stay stable

### Phase 4: Decouple Notification From Global React Version

Remove or neutralize `syntaxVersion` as a global content identity input.

Possible shape:

- keep `onTokensChanged` but make it call the projection scheduler directly
- if React state remains necessary, use it only to trigger projection, not row
  content identity

Acceptance:

- one worker batch does not force every mounted row to patch content
- code still highlights newly-tokenized visible rows
- no stale tokens after resource changes

### Phase 5: Overscan Calibration

Only after Phase 1-4:

- run scrollbench small scenario for plain and syntax files
- compare overscan `24`, `36`, `48`
- optionally compare first-visible anchored window vs centered window

Acceptance:

- no visible blanking
- mounted row count remains bounded
- p95 frame stays within budget
- mutation counts do not regress materially

## Test Plan

Unit tests:

- `CodeSyntax.getLineVersion()` starts at `0`
- worker tokens increment only matching line versions
- unchanged duplicate tokens do not increment
- stale worker responses do not increment
- projector content identity ignores unrelated line token updates
- same-window scroll remains a no-op
- cross-window scroll still reuses rows

Browser or scrollbench tests:

- small scroll plain text
- small scroll JSON
- small scroll TS/TSX
- large jump remains improved
- repeated run after token cache is warm

Manual visual check:

- slowly trackpad-scroll a 2,000+ line syntax file
- confirm rows do not visibly clear before recoloring
- confirm newly-entering rows may become highlighted once, without repeated
  blinking

## Acceptance Criteria

The fix is complete when:

- worker syntax remains enabled by default
- large-scroll behavior does not regress
- small-scroll syntax files do not rebuild the whole mounted window per worker
  batch
- plain text and syntax files both feel stable under small scroll
- projector metrics show content patches limited to lines whose token version
  changed or rows newly entering the window
- tests prove unrelated rows are not repatched after syntax updates

## Final Target

The final code viewer should keep Pierre's good separation of work:

- scroll projection remains synchronous and row-local
- syntax tokenization remains asynchronous and off-main-thread
- syntax completion invalidates only the lines whose rendered content changed
- overscan is measured, not guessed

The precise fix is not "more virtualization." It is smaller invalidation.
