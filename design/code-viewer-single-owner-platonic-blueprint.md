# Code Viewer Single-Owner Platonic Blueprint

## Purpose

The Code Viewer is correct on the axis it was last hardened: there is no DOM
co-ownership crash. `code-viewer-dom-ownership-platonic-blueprint.md` fixed the
`removeChild` defect by handing the entire virtual row subtree to an imperative
projector — "React owns the shell, the projector owns row children, no subtree
is shared."

That invariant — **one owner per subtree** — is right. The choice of owner is
wrong.

Every visual change since then has been disproportionately hard: making the
gutter opaque, making it full-height, making a highlight band read as one
continuous block, keeping the column pinned across horizontal scroll. None of
these are hard problems. They are hard *here* because the row subtree is owned by
hand-written DOM code that lives outside React and outside the design system.

This blueprint specifies the version of the component that keeps the
single-owner invariant but makes **React the owner**, via a virtualizer — and in
doing so dissolves the styling, gutter, and scroll-geometry problems instead of
working around them.

The goal is the same as every Code Viewer blueprint:

- simplicity;
- speed;
- everything needed;
- nothing more;
- perfect modularization;
- high-entropy code;
- perfectly consistent names;
- Flaubertian exactness.

This is not a feature document. It changes who owns the rows and how the layout
is declared. The public API (`CodeViewer`, `CodeViewerHandle`,
`CodeDocumentSource`, `highlight`, `scrollToLineRange`) does not change.

## Current Shape

```text
code-viewer.tsx
  public component, client-first fallback policy

code-viewer-content.tsx
  text read, bounds, zoom, controls, refs, imperative handle, composition;
  owns the scheduler and hands the projector its inputs

code-viewer-viewport.tsx
  scroll area, total-size sizing, empty <pre> row host; the fixed gutter "rail"

code-viewer-projector.ts          <-- the imperative engine
  virtual range math, private row cache, createElement rows, insert/remove,
  per-row className strings, per-row inline-style patching, token DOM

code-viewer-projection-scheduler.ts
  rAF-throttled re-projection driven by a raw scroll listener + ResizeObserver

code-viewer-syntax.ts
  Prism language detection, token flattening, per-line token cache,
  CODE_VIEWER_SYNTAX_STYLE (injected global <style>)

code-viewer-scale.ts / code-viewer-virtualization.ts / code-viewer-types.ts
  constants, virtual-line math, public types
```

React renders an empty `<pre>`. The projector fills it imperatively on a rAF
loop. The two never share a node — the contract holds — but the cost of that
contract is the subject of this document.

## Root Cause (Reframed)

The `removeChild` crash had two contributing facts:

1. React and imperative code wrote to the **same** `<pre>` children.
2. The fix could be reached by removing *either* writer.

The prior blueprint removed the React writer. This blueprint removes the
imperative writer. Both satisfy "one owner per subtree." Only one of them keeps
the rows inside React, Tailwind, and the token system — which is where every
subsequent change actually needs them.

Because the rows live in imperative DOM, four independent costs follow. Each is a
real difficulty I hit, and each is downstream of the same decision.

### Cost 1 — Styling has four competing sources of truth

To change how one line looks, the truth is spread across:

- imperative `className` **strings** assembled in the projector;
- imperative inline styles set per row (`setStyleValue(... "background-color")`);
- a runtime-injected global `<style>` (`CODE_VIEWER_SYNTAX_STYLE`);
- Tailwind classes that the design system assumes it owns.

There is no element that *is* "a highlighted line." An injected stylesheet rule
silently lost a specificity/order fight with Tailwind, because the relationship
between a runtime `<style>` and the build-time stylesheet is undefined. The
component has no single styling seam.

### Cost 2 — Tailwind cannot see runtime-built classes

Tailwind generates CSS from class literals found in source. Classes concatenated
at projection time are not reliably generated, and arbitrary values
(`bg-[color-mix(...)]`) are brittle. The architecture therefore *pushes work off*
the design system onto inline styles and injected CSS — the two most fragile
paths. The design system is present but unreachable from where the pixels are
decided.

### Cost 3 — There is no gutter; there are N sticky spans imitating one

The line-number column is not an element. It is one `position: sticky` span
baked into every row. So every property a column should own — full height, one
opaque fill, one divider, staying pinned across the *entire* horizontal scroll, a
highlight tint — must be re-derived per row, and then separately faked for the
empty region below the last line (the "rail"). The column is an emergent
illusion assembled from many parts that must be kept in sync. The visibly weak,
uneven divider is that illusion showing its seams.

### Cost 4 — The scroll geometry is emergent, not declared

The horizontally scrollable width is not a real content box. It is whatever the
absolutely-positioned rows happen to overflow to. Consequences:

- The scroll container is **narrower than its content**, so `sticky left: 0`
  un-pins after one viewport width — the literal reason a sticky gutter rail
  cannot work and had to be moved outside the scroll container.
- Because content slides under a sticky gutter, the gutter must paint an
  **opaque mask**. The masking requirement exists only to cover for a layout
  that never declared its own width. A layout with a real content box and a real
  gutter column has nothing to mask.

### Secondary — a design-token gap that compounds Cost 1

`--muted`, `--accent`, `--border` in `globals.css` are alpha-based
(`--alpha(black / N%)`), i.e. translucent. There is no opaque "muted surface"
token. So the natural `bg-muted/30` gutter cannot mask anything, and the only
opaque route is `color-mix(... var(--foreground) ... var(--background) ...)`.
This is a real gap and is called out again under **Design Tokens** below.

## Platonic Ideal

One sentence:

> **React owns every node. The layout is declared, not emergent. Styling has one
> seam. The gutter is a first-class column. Virtualization bounds work; it does
> not bound architecture.**

Expanded into the invariants this component must satisfy:

1. **Single owner.** Every DOM node under the viewer is created and updated by
   React. No `document.createElement`, no imperative `replaceChildren`, no
   private row cache, no rAF projection loop.
2. **Single source of truth per derived value.** Visible range, total height,
   content width, line height, and highlight range are each computed once and
   flow down as props/state.
3. **Declared geometry.** The scrollable content box has an explicit width (the
   longest rendered line) and an explicit height (total virtual size). Nothing
   about scrolling is inferred from overflow side-effects.
4. **One styling seam.** Every visual decision is a Tailwind class or a CSS
   variable on a React element, keyed by `data-*` state. No injected global
   stylesheet for structure; the token-color stylesheet is the single allowed
   exception and is generated, not hand-injected (see **Syntax**).
5. **First-class gutter.** The line-number column is one element with one
   background, one divider, and one behavior. Full height and opacity are
   properties of that element, not emergent from rows.
6. **Design-system native.** A theme can restyle the viewer by overriding tokens
   and the documented `data-slot` hooks, with no knowledge of internals.

These do not weaken the single-owner rule from the DOM-ownership blueprint. They
satisfy it by choosing React as the owner, which is the choice that keeps the
other six properties reachable.

## Performance: the question the projector answers, re-asked

The projector exists to avoid React reconciliation for large files (the demo log
is 6001 lines). The honest analysis:

- **Virtualization already bounds the DOM** to the visible window plus overscan —
  on the order of 40–80 rows, never 6001. That bound is independent of who
  writes the rows.
- **Reconciling ~60 rows per scroll frame is cheap.** React's per-row cost at
  that count is well under a frame budget; the expensive parts (tokenization,
  measurement) are cached and identical in either model.
- The projector is therefore optimizing the reconciliation of a few dozen rows —
  a non-bottleneck — and paying for it with the entire styling and layout
  integration. The trade is inverted.

This blueprint does not assume; it requires a measurement gate (see **Definition
of Done**). The target is parity within frame budget on the 6001-line sample at
100% and at maximum zoom, on the same hardware, before the projector is deleted.
If a real bottleneck appears, the answer is a narrower, still-React-owned
optimization (e.g. `content-visibility: auto` on rows, memoized row components,
a coarser overscan), not a return to imperative ownership.

## Target Architecture

```text
code-viewer.tsx
  public component; client-first mount policy; forwards ref

code-viewer-content.tsx
  text read + bounds; viewer state (zoom); controls registration;
  imperative handle (scrollToLineRange, getViewportElement); composition only

code-viewer-surface.tsx              (replaces viewport + projector + scheduler)
  the scroll container; declared geometry; the two panes; scroll sync;
  renders <CodeGutter/> and <CodeLines/>

code-viewer-gutter.tsx
  the first-class line-number column: one element, virtualized number stack

code-viewer-lines.tsx
  the virtualized code rows; each row renders tokens via React

code-viewer-row.tsx
  one memoized row: line number cell is NOT here (gutter owns it); just tokens

use-code-virtual-window.ts           (replaces code-viewer-virtualization math + scheduler)
  React hook: scrollTop/height -> { startIndex, endIndex, offsetTop, totalSize }

code-viewer-syntax.ts                (kept, minus the injected <style> for structure)
  Prism detection, token flattening, per-line token cache, token-color CSS

code-viewer-scale.ts / code-viewer-types.ts
  constants and public types (unchanged surface)
```

Deleted: `code-viewer-projector.ts`, `code-viewer-projection-scheduler.ts`, and
the structural half of the injected stylesheet. The imperative engine and its
rAF loop are gone; their responsibilities become a hook and React components.

### The two-pane layout (the heart of the change)

The layout is two panes inside one frame:

```text
┌ surface (relative, the frame's flex-1 child) ───────────────┐
│ ┌ gutter pane ─┐ ┌ code pane (the scroll container) ───────┐│
│ │ sticky-left  │ │ overflow:auto, both axes                ││
│ │ fixed width  │ │  ┌ sizer: height=totalSize,            ┐││
│ │ full height  │ │  │        width=maxLineWidth           │││
│ │ opaque       │ │  │  ┌ window: translateY(offsetTop) ┐  │││
│ │ one divider  │ │  │  │  row, row, row (visible only) │  │││
│ │ number stack │ │  │  └───────────────────────────────┘  │││
│ │ (translateY) │ │  └─────────────────────────────────────┘││
│ └──────────────┘ └─────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

Two designs are viable; this blueprint chooses **A** and documents **B**.

**Design A — split panes, single vertical source (chosen).**
The code pane is the only scroll container. The gutter pane does not scroll; its
number stack is translated by `--code-scroll-y`, a CSS variable written from the
code pane's `scrollTop` on scroll. Horizontal scroll affects only the code pane.

- Full-height gutter: the gutter pane is `h-full` of the surface — a real column,
  not a rail. Trivially true.
- Opaque gutter: one `bg-*` on one element. Trivially true.
- Nothing slides under the gutter: the gutter is a separate pane to the left; the
  code never enters its box. **No masking, ever.**
- Pinned across full horizontal scroll: the gutter is outside the horizontal
  scroller, so "pinned" is not even a concept that can fail.
- The only sync is one CSS-variable write per scroll frame — a presentational
  transform, not DOM ownership. React still owns every node.

**Design B — single scroll container, sticky gutter column.**
One `overflow:auto` element; a CSS grid `grid-template-columns: max-content 1fr`
or a sticky-left gutter column; the sizer declares `width = maxLineWidth` so the
container's content box is real and `sticky left:0` holds across the entire
scroll range (the failure in the current model was *only* because absolute rows
never declared that width). This is simpler to reason about for selection and
find-in-page (one flow), but reintroduces the "code slides under sticky gutter →
opaque mask" requirement. Acceptable, but A is cleaner: it removes masking
entirely.

Decision: **A**, unless the selection/find requirements (below) make a single
flow strictly necessary — in which case **B**, with the masking handled by one
opaque column class, not per-row.

### Declared geometry

Two measured numbers own all of scrolling:

- `totalSize = lineCount * lineHeight + 2 * blockPadding` — the sizer height; the
  vertical scroll range. Already computed by `getCodeVirtualTotalSize`.
- `maxLineWidth` — the widest rendered line, in px. The sizer width; the
  horizontal scroll range. Measured, not emergent.

`maxLineWidth` is computed from the longest line by character count as a fast
proxy, then refined by measuring that line once in the active font/zoom with a
hidden sizer (or a canvas `measureText`). It is memoized on
`(longestLine, fontScale)`. This replaces "let absolute rows overflow and hope"
with one declared value, and it is what makes Design B's sticky gutter hold and
Design A's horizontal scrollbar correct.

### The gutter as a first-class element (`code-viewer-gutter.tsx`)

```text
CodeGutter
  width:  var(--code-gutter-width)         // = ch(maxDigits) + padding, one source
  height: 100% (Design A) | grid column (Design B)
  background: opaque surface token (see Design Tokens)
  border-right: one divider
  contains a translateY number stack mirroring the same virtual window as lines
```

The gutter renders the *same* `startIndex..endIndex` window as the code lines,
translated by the same `offsetTop`. One window computation, two consumers. A
highlighted line number is the gutter row carrying `data-highlighted`; the left
accent stripe is a `box-shadow`/`border-l` on that element — declared once, in
the gutter, in CSS.

### The code lines (`code-viewer-lines.tsx`, `code-viewer-row.tsx`)

```text
CodeLines
  position: relative; height: totalSize; width: maxLineWidth
  <div translateY(offsetTop)>            // the window
    {visible.map(i => <CodeRow key={i} ...) }

CodeRow (React.memo)
  data-line-number, data-highlighted
  white-space: pre; tokens as <span className={tokenClass(kind)}>
  background tint when highlighted (the band) — one Tailwind class
```

Rows are keyed by absolute line index, memoized on `(text, syntaxIdentity,
isHighlighted, fontScale)`. The window translates as a block; rows mount/unmount
at the edges. This is ordinary React virtualization — the pattern the CSV viewer
should converge toward as well (see **Codebase Consistency**).

### Scroll sync and the virtual window (`use-code-virtual-window.ts`)

A hook replaces both the math module's call sites and the rAF scheduler:

```text
useCodeVirtualWindow({ scrollRef, lineCount, lineHeight, overscan })
  -> { startIndex, endIndex, offsetTop, totalSize, scrollY }
  subscribes to the code pane's scroll (passive) + ResizeObserver
  updates state in a rAF-coalesced way (React state, not DOM writes)
  also writes --code-scroll-y for the gutter (Design A)
```

The scroll listener still exists — virtualization needs scroll position — but it
now sets **state and one CSS variable**, not DOM children. The difference is the
whole point: scroll drives a derived window, React renders it.

## Concrete Interfaces

These are the exact shapes to build to. Types are illustrative, not final, but
the boundaries are: each module has one responsibility, one owner, and props that
are all derived single-source values.

### `code-viewer-surface.tsx`

```tsx
export function CodeViewerSurface({
  textLines,
  syntax,
  geometry,          // CodeGeometry: { lineHeight, gutterWidth, maxLineWidth }
  highlightRange,    // NormalizedTextLineRange | null
  overscan,
  viewportRef,       // forwarded to the code pane (scroll container)
}: CodeViewerSurfaceProps) {
  const codePaneRef = useMergedRef(viewportRef, localRef)
  const window = useCodeVirtualWindow({
    scrollRef: codePaneRef,
    lineCount: textLines.length,
    lineHeight: geometry.lineHeight,
    overscan,
  })

  return (
    <div data-slot="code-viewer-surface" className="relative flex min-h-0 flex-1">
      <CodeGutter
        window={window}
        lineCount={textLines.length}
        geometry={geometry}
        highlightRange={highlightRange}
      />
      <div
        ref={codePaneRef}
        data-slot="code-viewer-pane"
        className="relative min-h-0 flex-1 overflow-auto"
        onCopy={handleCopyFromSource}      // copy yields source, not window
      >
        <CodeLines
          window={window}
          textLines={textLines}
          syntax={syntax}
          geometry={geometry}
          highlightRange={highlightRange}
        />
      </div>
    </div>
  )
}
```

The surface owns nothing imperative except the one scroll → CSS-var write inside
`useCodeVirtualWindow`. It does not measure, tokenize, or cache.

### `use-code-virtual-window.ts`

```ts
export function useCodeVirtualWindow({
  scrollRef, lineCount, lineHeight, overscan,
}: UseCodeVirtualWindowArgs): CodeVirtualWindow {
  const [win, setWin] = React.useState<CodeVirtualWindow>(INITIAL_WINDOW)

  React.useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const compute = () => {
      raf = 0
      const next = codeVirtualWindow({
        scrollTop: el.scrollTop,
        viewportHeight: el.clientHeight || INITIAL_VIEWPORT_HEIGHT,
        lineCount, lineHeight, overscan,
      })
      // one presentational write for the gutter's vertical sync (Design A)
      el.style.setProperty("--code-scroll-y", `${el.scrollTop}px`)
      setWin(prev => (windowEquals(prev, next) ? prev : next))
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(compute) }
    compute()
    el.addEventListener("scroll", schedule, { passive: true })
    const ro = new ResizeObserver(schedule); ro.observe(el)
    return () => { el.removeEventListener("scroll", schedule); ro.disconnect()
                   if (raf) cancelAnimationFrame(raf) }
  }, [scrollRef, lineCount, lineHeight, overscan])

  return win
}
```

`windowEquals` short-circuits identical windows so scroll within a line does not
re-render. `codeVirtualWindow` is the pure function extracted from today's
`getCodeVirtualLines` — same math, no DOM.

### `code-viewer-gutter.tsx`

```tsx
export function CodeGutter({ window, lineCount, geometry, highlightRange }) {
  return (
    <div
      data-slot="code-viewer-gutter"
      aria-hidden
      className="relative h-full shrink-0 select-none border-r bg-surface-muted"
      style={{ width: geometry.gutterWidth }}
    >
      {/* number stack translated by the same offset; in Design A it also reads
          --code-scroll-y so it mirrors the pane without its own scroll. */}
      <div
        className="absolute inset-x-0 top-0 will-change-transform"
        style={{ transform: `translateY(calc(${window.offsetTop}px - var(--code-scroll-y, 0px)))` }}
      >
        {range(window.startIndex, window.endIndex).map(i => (
          <div
            key={i}
            data-line-number={i + 1}
            data-highlighted={isInRange(i + 1, highlightRange) || undefined}
            className="px-2 pr-3 text-right text-muted-foreground/60
                       data-highlighted:text-foreground/75
                       data-highlighted:shadow-[inset_2px_0_0_0_var(--primary)]"
            style={{ height: geometry.lineHeight }}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  )
}
```

Full height, opacity, divider, highlight accent — all properties of one element,
all in class literals Tailwind can see. There is no rail and nothing to mask.

### `code-viewer-lines.tsx` / `code-viewer-row.tsx`

```tsx
export function CodeLines({ window, textLines, syntax, geometry, highlightRange }) {
  return (
    <div
      data-slot="code-viewer-lines"
      className="relative"
      style={{ height: geometry.totalSize, width: geometry.maxLineWidth }}
    >
      <div style={{ transform: `translateY(${window.offsetTop}px)` }}>
        {range(window.startIndex, window.endIndex).map(i => (
          <CodeRow
            key={i}
            text={textLines[i] ?? ""}
            tokens={syntax.getLineTokens(textLines[i] ?? "")}
            highlighted={isInRange(i + 1, highlightRange)}
            lineHeight={geometry.lineHeight}
            lineNumber={i + 1}
          />
        ))}
      </div>
    </div>
  )
}

const CodeRow = React.memo(function CodeRow({ text, tokens, highlighted, lineHeight, lineNumber }) {
  return (
    <div
      data-slot="code-viewer-row"
      data-line-number={lineNumber}
      data-highlighted={highlighted || undefined}
      className="whitespace-pre pr-4 pl-2 data-highlighted:bg-[color-mix(in_oklab,var(--foreground)_8%,var(--background))]"
      style={{ height: lineHeight }}
    >
      {tokens
        ? tokens.map((t, k) => <span key={k} className={tokenKindClass(t.kind)}>{t.text}</span>)
        : text || " "}
    </div>
  )
})
```

`maxLineWidth` on `CodeLines` is the declared horizontal geometry; the row's band
is one class. (If the band class proves awkward as a Tailwind arbitrary value,
the token gap fix promotes it to `bg-surface-highlight` — see **Design Tokens**.)

## Scroll Sync, Precisely (Design A)

The gutter does not scroll. It mirrors the pane with a transform composed of two
terms:

```text
gutter translateY = window.offsetTop - currentScrollTop
```

- `window.offsetTop` is the top of the virtual window in content space (a
  multiple of `lineHeight`, updated only when the window changes).
- `currentScrollTop` is live, written as `--code-scroll-y` every scroll frame.

Subtracting the live scroll from the window offset keeps the gutter numbers
locked to their code rows without giving the gutter its own scrollbar. The only
per-frame work is one `setProperty` — no React render unless the *window* index
range changes. This is the precise mechanism that makes the gutter full-height,
non-scrolling, and perfectly aligned, with zero masking.

A subtlety: the `--code-scroll-y` write and the `setWin` happen in the same rAF,
so the gutter transform and the rendered window never disagree by more than one
frame; `will-change-transform` keeps it on the compositor.

## Edge Cases (each has one defined answer)

- **Empty file / zero lines.** `totalSize = 2 * blockPadding`; window is empty;
  gutter shows no numbers; the pane shows the surface background. No special case
  in row code.
- **Single line.** Window = one row; gutter width = `ch(1) + padding`; everything
  else identical.
- **Trailing newline.** `splitTextLines` already defines whether a trailing
  newline yields a final empty line; the viewer renders whatever it returns —
  unchanged.
- **Very long single line.** `maxLineWidth` reflects it; the pane scrolls
  horizontally; the gutter is unaffected (separate pane). This is the case the
  current model handles worst and the declared-width model handles for free.
- **Tabs and wide Unicode.** `white-space: pre` plus the font's own advance
  widths; `maxLineWidth` is measured on the rendered longest line, so tabs/wide
  glyphs are included. No tab-to-space assumption.
- **Fractional zoom / subpixel line height.** `lineHeight` may be fractional;
  rows use it verbatim for `height` and `translateY`, so cumulative offset stays
  exact (no rounding drift across 6000 lines). Number and code rows share the
  same `lineHeight`, so they cannot drift relative to each other.
- **Window smaller than overscan near edges.** `codeVirtualWindow` clamps
  `startIndex >= 0` and `endIndex <= lineCount`; no negative or overflow indices.
- **maxLines / maxBytes truncation.** Unchanged: `resolvedTextViewerBounds` caps
  the text before it reaches the surface; `lineCount` is the capped count.

## Naming

The blueprints demand consistent names; this rearchitecture standardizes them:

- `CodeViewerSurface` (not "viewport" — it is more than a scroll area now).
- `CodeGutter`, `CodeLines`, `CodeRow` — the three rendered parts.
- `useCodeVirtualWindow` returning `CodeVirtualWindow` — "window" is the visible
  slice; "range" stays reserved for `TextLineRange`/highlight.
- `CodeGeometry` — the declared `{ lineHeight, gutterWidth, maxLineWidth,
  totalSize }`.
- `data-slot` values: `code-viewer-surface | -pane | -gutter | -lines | -row`,
  plus `data-line-number` and `data-highlighted` — the full theming/test surface.
- `cv-token-*` token color classes — unchanged, the one legacy name worth
  keeping because it is already a documented theming contract.

## Performance Budget

Concrete gates, measured on the 6001-line sample (`/samples/server.log` or the
demo builder) on the reference machine:

- **Initial mount → first paint of rows:** ≤ 1 frame of work beyond the existing
  skeleton swap.
- **Scroll (sustained, wheel + drag):** main-thread work per frame ≤ the
  projector's current cost, and no dropped frames at 60Hz; only the window-range
  change triggers a React render (a few dozen `CodeRow`s, memoized).
- **Zoom in/out:** one relayout + one `maxLineWidth` remeasure; reading anchor
  preserved; ≤ 2 frames.
- **Tokenization:** unchanged (per-line cache); never on the scroll path for
  already-seen lines.

If any gate fails, escalate within the React-owned model in this order:
`React.memo` tightening → `content-visibility: auto` on rows → coarser overscan →
windowed `CodeRow` recycling via stable keys. Returning to imperative ownership
is explicitly out of scope.

## Invariant Tests

The rearchitecture is "done" only with these green (most are new, a few replace
projector tests):

1. **Window parity.** `useCodeVirtualWindow` yields the same visible indices and
   `offsetTop` as the old range math for a matrix of `(scrollTop, viewportH,
   lineHeight)`.
2. **Gutter/line alignment.** Under scripted fast scroll and at three zoom
   levels, the first visible `data-line-number` equals the first visible
   `data-slot=code-viewer-row`'s number.
3. **Single owner.** A test asserts no node under `code-viewer-surface` is created
   outside React (no `createElement` in the module graph; lint rule or import
   check).
4. **Highlight continuity.** For a multi-line `highlight`, every row in range
   carries `data-highlighted` and there is exactly one accent edge (no per-row
   internal borders).
5. **Declared geometry.** The pane's `scrollWidth` equals `maxLineWidth` and
   `scrollHeight` equals `totalSize` at a given zoom.
6. **Copy fidelity.** Select-All + `copy` writes `resource` text exactly,
   independent of the scrolled window.
7. **No injected structural CSS.** The only runtime stylesheet contains
   `cv-token-*` rules and nothing structural.
8. **Hydration.** Server markup has no rows; client mount adds them; no
   hydration warning, no `removeChild`.

## Syntax (kept, with one subtraction)

The tokenizer is sound and stays exactly as designed by
`code-viewer-modular-language-support-blueprint.md`:

- `createCodeSyntax(resource) -> { identity, getLineTokens }`;
- per-line token cache;
- `LANGUAGE_BY_EXTENSION` / `LANGUAGE_BY_MIME` as the single seam; consumers add
  a Prism import + a row;
- per-line tokenization (the documented trade for cheapness).

Two changes:

1. **Tokens render as React.** `getLineTokens(line)` returns leaves; `CodeRow`
   maps them to `<span className={cn("cv-token", tokenKindClass(kind))}>`. No
   `createDocumentFragment`, no imperative span creation.
2. **Token colors stay in a stylesheet, but it is the *only* stylesheet, and it
   is for color, not structure.** Keep `CODE_VIEWER_SYNTAX_STYLE` for the
   `cv-token-*` color rules (token kinds are open-ended and theme-overridable via
   CSS variables — a legitimate stylesheet job). Remove everything structural
   (gutter, highlight, rail) from it; those move to component classes. Inject it
   once at module scope (a real `<style>` in the tree, not an imperative
   `getElementById` patch) so it participates in normal cascade ordering.

## Highlight model

A highlight is a declared range, normalized once, that flows to two consumers:

```text
highlightRange = normalizeTextLineRange(highlight, lineCount)  // already exists
CodeRow:    data-highlighted when index in range -> band class (one Tailwind class)
GutterRow:  data-highlighted when index in range -> number color + left accent
```

The band is continuous because adjacent rows share one background class over one
declared surface — no per-row ring, no internal borders. The left accent is one
stripe on the gutter column edge, declared in one place. "Make the highlight
tasteful" becomes editing one class, visible immediately, scanned by Tailwind.

## Zoom, addressing, refs (unchanged behavior, simpler mechanics)

- **Zoom** sets `fontScale`; `lineHeight` and `maxLineWidth` derive from it; the
  reading-anchor preservation in `code-viewer-content.tsx` is unchanged in
  behavior (capture line+offset, restore after relayout) but reads from React
  state rather than the projector.
- **`scrollToLineRange(range, options)`** scrolls the code pane to
  `blockPadding + (line-1) * lineHeight`. It must work for unmounted lines:
  because geometry is declared (totalSize is real), scrolling to an offset is
  valid even when the target row is outside the window; the window recomputes on
  the resulting scroll. Identical guarantee to today, fewer moving parts.
- **`CodeViewerHandle`** (`scrollToLineRange`, `getViewportElement`) is preserved
  verbatim. `getViewportElement` returns the code pane.

## SSR / hydration policy

The crash class is avoided structurally, not by ownership handoff:

- Server renders the frame, the controls, and an **empty, keyed code surface**
  (or the existing skeleton). It renders **no rows**.
- The virtual window is a client-only effect (it needs `scrollTop`/`clientHeight`
  and `ResizeObserver`). Until it runs, the surface shows skeleton/empty.
- Because React owns the rows on the client and the server rendered no rows,
  there is never a node owned by two writers. The `removeChild` sequence is
  impossible — there is no second writer at all.
- Keep `suppressHydrationWarning` off; there is nothing to suppress once both
  sides agree the surface starts empty.

This is *strictly stronger* than the projector's contract: the projector avoids
co-ownership by discipline (a documented list of "may / may not"); this avoids it
by construction (there is only one writer in the codebase).

## Accessibility

A code viewer is a read-only document with addressable lines:

- The code pane is `role="group"`/`aria-label` (file name + line count), or a
  `<pre>` with `tabindex=0` for keyboard scroll.
- Each row is `role="row"`-equivalent only if we expose table semantics; the
  simpler ideal is a `<pre>` content model with `data-line-number` on rows and an
  `aria-rowcount` reflecting the full file (not the window). Document one choice;
  do not ship both.
- Line numbers are `aria-hidden` (decorative); the addressable unit is the line
  text. This matches the current gutter intent and is now expressible because the
  gutter is a real element.

## Selection, copy, and find-in-page (a real platonic requirement)

Virtualization breaks three native behaviors; the platonic viewer must decide
each explicitly rather than inherit today's accidental behavior:

1. **Copy / Select-All.** Selecting across the document and copying must yield the
   *source text*, not the windowed DOM. Solution: intercept `copy` on the surface
   and, when the selection spans the viewer, write `resource` text (already in
   memory, already bounded) to the clipboard. Cheap, exact, window-independent.
2. **Browser find (Ctrl/Cmd-F).** Native find cannot match unmounted lines. The
   honest options are (a) accept the limitation (most virtualized code views do),
   or (b) provide an in-component find that searches `textLines` and
   `scrollToLineRange`s hits. The platonic answer is (a) for v1 with a documented
   note, and a defined extension point for (b) — not silence.
3. **Drag-selection across the window edge.** Works within Design B (one flow)
   naturally; in Design A the gutter is non-selectable (`user-select: none`,
   already the case) and code selection is within the code pane. Document that
   selection is scoped to the code pane.

These are not new problems — the projector has the same constraints — but a
platonic component states its contract. None of them block the rearchitecture;
they are design decisions the rearchitecture finally lets us make in one place.

## Design Tokens

Two token facts, surfaced so the component stops working around them:

1. `--muted`, `--accent`, `--border` are alpha-based (translucent). They cannot
   serve as a masking surface.
2. The viewer needs **one opaque "code surface" shade** for the gutter (and, in
   Design B, the masked column).

Two acceptable resolutions, in order of preference:

- **Add an opaque surface token** (e.g. `--surface-muted`) to `globals.css`,
  light + dark, and use `bg-surface-muted`. This fixes the gap for every
  component, not just this one.
- **Mix locally** with `color-mix(in oklab, var(--foreground) 3%,
  var(--background))` as a documented component constant. Acceptable, but it
  encodes a token the design system should own.

The gutter shade, divider color, highlight band, and accent are then the only
color decisions, each a single token reference on a single element.

## Codebase Consistency

This is not a one-off. The CSV viewer carries the same motif — a hand-rolled
imperative "patcher" layered under TanStack Virtual — and the same documented
failure family (the "settle gap": patcher/React DOM desync where the reconciler
skips unchanged values). The lesson generalizes:

> An imperative DOM layer beneath React buys throughput it rarely needs and pays
> in desync bugs and design-system exile.

The Code Viewer is the most extreme instance and the right place to establish the
pattern: **virtualize the window, render the window in React.** If the Code Viewer
lands within frame budget — and it will, at a few dozen rows — the same approach
retires the CSV patcher next.

## Types

Public types are unchanged: `CodeViewerProps`, `CodeViewerHandle`,
`CodeDocumentSource`, `CodeLineRange`/`TextLineRange`. New internal types:

```ts
type CodeVirtualWindow = {
  startIndex: number      // first visible line index (0-based), with overscan
  endIndex: number        // exclusive
  offsetTop: number       // translateY for the window block, px
  totalSize: number       // sizer height, px
}

type CodeGeometry = {
  lineHeight: number
  gutterWidth: string     // single source: ch(maxDigits) + padding
  maxLineWidth: number    // single source: measured longest line, px
}
```

Both are derived, single-source, and passed down. Nothing reads scroll geometry
off the DOM except the one hook that owns it.

## Migration Plan

Incremental, behind the unchanged public API; each step ships and is verifiable.

1. **Introduce `use-code-virtual-window.ts`** returning the same window the
   projector computes. Drive it from the existing viewport ref. No render change
   yet; assert parity of `{startIndex, endIndex, offsetTop, totalSize}` against
   the projector's range in a test.
2. **Build `CodeLines` + `CodeRow`** rendering the window in React, mounted into
   a *second, hidden* surface in dev, and snapshot-compare token output and row
   transforms against the projector. (Proves rendering parity before switching.)
3. **Build `CodeGutter`** as a real column; implement Design A scroll sync via
   `--code-scroll-y`; verify number/line alignment under zoom and fast scroll.
4. **Switch `code-viewer-surface.tsx`** to render `CodeGutter` + `CodeLines`;
   delete the empty `<pre>` host, the rail, and the projector wiring from
   content/viewport. Keep the projector files in the tree, unreferenced, for one
   commit.
5. **Move structural CSS out of `CODE_VIEWER_SYNTAX_STYLE`** into component
   classes; keep only `cv-token-*` colors; inject the stylesheet declaratively.
6. **Resolve the token gap** (`--surface-muted` or the documented `color-mix`).
7. **Implement copy-uses-source and document find/selection contract.**
8. **Measurement gate** (see Definition of Done). If green, **delete**
   `code-viewer-projector.ts`, `code-viewer-projection-scheduler.ts`, and the
   structural stylesheet. Rebuild the registry item.
9. **Registry + docs.** The `renderers/code` page gains nothing new in the
   public API; the "Languages" and behavior sections are unchanged. The component
   source shown under "View Code" is now React rows.

Each step is reversible until step 8.

## What We Delete

- `code-viewer-projector.ts` (imperative rows, row cache, range math copies).
- `code-viewer-projection-scheduler.ts` (rAF projection loop).
- The structural half of `CODE_VIEWER_SYNTAX_STYLE` (gutter/highlight/rail CSS).
- The gutter "rail" hack and the opaque-per-row-gutter masking workaround
  (Design A removes the need entirely).
- `suppressHydrationWarning` on the row host (no longer relevant).

## What We Keep

- The public API and `CodeViewerHandle` semantics.
- The text-resource read, bounds, zoom anchor preservation, controls
  registration in `code-viewer-content.tsx`.
- The Prism tokenizer, per-line cache, and the language seam.
- `cv-token-*` color tokens and theme overridability.
- The virtual-size math (`getCodeVirtualTotalSize`, line metrics), now consumed
  by the hook.

## Risks and Mitigations

- **Reconciliation cost at large files.** Mitigation: `React.memo` rows keyed by
  absolute index; memoize on content+highlight+scale; coarse overscan; the
  measurement gate blocks the switch if budget is missed; `content-visibility:
  auto` is the first escalation, still React-owned.
- **`maxLineWidth` measurement jitter under zoom.** Mitigation: measure once per
  `(longestLine, fontScale)`; use `ch`-based proxy first paint, refine in a
  layout effect; never per-scroll.
- **Gutter/line vertical drift in Design A.** Mitigation: one window, one
  `offsetTop`, one `--code-scroll-y`; both panes read the same values; a test
  asserts the first visible number equals the first visible line under fast
  scroll and zoom.
- **Selection/copy regressions.** Mitigation: the explicit copy-from-source
  handler; documented selection scope; a test for Select-All → copy equals
  `resource` text.
- **Horizontal scrollbar correctness.** Mitigation: declared `maxLineWidth`
  sizer; a test that the code pane's `scrollWidth` matches the longest line at a
  given zoom.

## Open Decisions

1. **Design A vs B.** Default A (no masking, cleanest gutter). Choose B only if a
   single selection flow across gutter+code is a hard product requirement.
2. **Accessibility model.** `<pre>` + `data-line-number` (simpler) vs table
   semantics (richer). Pick one; this blueprint leans `<pre>`.
3. **Find-in-page.** Document the native limitation for v1; decide later whether
   to ship an in-component find. Define the extension point now.
4. **Token gap.** Add `--surface-muted` globally (preferred) vs local
   `color-mix`. A global token is the platonic fix.

## Definition of Done

- React owns every node under the viewer; `code-viewer-projector.ts` and
  `code-viewer-projection-scheduler.ts` are deleted.
- The gutter is one element: full height, opaque, one divider, one highlight
  treatment — changeable by editing one component, scanned by Tailwind.
- Horizontal and vertical scroll geometry are each one declared number; no
  sticky un-pinning, no masking in Design A.
- The highlight band is continuous with a single accent, defined in one place.
- Styling has one seam (component classes + tokens); the only stylesheet is the
  `cv-token-*` colors, injected declaratively.
- Select-All → copy yields the source text; selection/find contract documented.
- Measurement gate passed: scroll, zoom, and initial render of the 6001-line
  sample are within frame budget at 100% and max zoom, at parity with the
  projector — verified before deletion.
- Registry item rebuilt; the `renderers/code` page renders the React
  implementation with no public API change.
- A theme can restyle the gutter, divider, band, and tokens via tokens and
  `data-slot` hooks with zero knowledge of internals.

The result is the platonic Code Viewer: a virtualized, syntax-highlighted,
addressable read-only document where virtualization bounds the work and React
owns the result — and where the next visual change is one class, not an
expedition across four layers.
