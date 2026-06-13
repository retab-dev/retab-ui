# Ghostty-Style Compressed Tab Layout Blueprint

## Purpose

The current XLSX sheet tab implementation is still built around a web-style
horizontal scroller. Adding absolute stack ribs on top of that scroller does not
reproduce Ghostty. It only decorates the wrong model.

Ghostty feels good because the visible tabs are not a normal overflow row. On
macOS, AppKit lays out the actual native `NSTabButton` views inside an
`NSTabBar`. Under pressure, the tab buttons themselves compress, clip, and
prioritize the selected tab. The overflow cue is not a separate overlay. It is
the visible result of real tab geometry.

This blueprint defines the replacement Retab model:

- a fixed tabbar viewport;
- a virtual scroll position;
- a deterministic layout function that turns sheets into visible tab rects;
- actual compressed tab elements at the edges;
- animated rect transitions;
- wheel, keyboard, click, and reveal behavior driven by the same geometry.

## Non-Goals

- Do not add decorative overlays that pretend to be hidden tabs.
- Do not keep the flex row as the visual source of truth.
- Do not add arrow buttons.
- Do not expose a visible scrollbar.
- Do not use fades as the primary overflow signal.
- Do not introduce a motion dependency until the layout model is correct.

## Source Of Truth

The tab strip should have one source of truth:

```ts
interface TabLayoutState {
  activeIndex: number
  viewportWidth: number
  scrollAnchor: number
  sheetCount: number
}
```

From that state, derive:

```ts
interface TabRect {
  index: number
  kind: "full" | "compressed"
  x: number
  width: number
  opacity: number
  zIndex: number
  isActive: boolean
  isClickable: boolean
}
```

The DOM should render these rects directly. No hidden flex row should determine
the visual layout.

## Architecture

### Current Incorrect Shape

```txt
tablist
  scroller overflow-x-auto
    flex min-w-max track
      full-width tab
      full-width tab
      full-width tab
  absolute left/right stack decorations
```

This is fundamentally a browser scroller. It can be made smoother, but it cannot
feel like AppKit because all tabs retain their full row identity and the edge
stack is fake.

### Target Shape

```txt
tablist fixed viewport
  positioned tab layer
    compressed real tab
    compressed real tab
    full active/near tab
    full near tab
    compressed real tab
  hidden semantic tabs, only if needed for accessibility fallback
```

Every visible piece is a real tab representation. If the right edge shows four
thin tab slices, those are four rendered tab rects in the layout result, not an
overlay.

## Layout Constants

Start with conservative values. Tune visually after implementation.

```ts
const TABBAR_HEIGHT = 36
const TAB_HEIGHT = 28
const TAB_RADIUS = 8

const ACTIVE_WIDTH = 190
const FULL_WIDTH = 148
const MIN_FULL_WIDTH = 118
const COMPRESSED_WIDTH = 18
const COMPRESSED_STEP = 12
const EDGE_INSET = 6
const TAB_GAP = 2

const MAX_LEFT_COMPRESSED = 4
const MAX_RIGHT_COMPRESSED = 4
const NEAR_TAB_COUNT_EACH_SIDE = 2
```

Important: these are **layout** constants, not decoration constants.

## Layout Algorithm

### Inputs

```ts
interface ResolveCompressedTabsInput {
  activeIndex: number
  scrollAnchor: number
  sheetCount: number
  viewportWidth: number
}
```

`scrollAnchor` is the approximate center of the current visible logical range.
It replaces `scrollLeft` as the primary state.

Wheel input adjusts `scrollAnchor`.
Keyboard/click input changes `activeIndex` and then reveals that active index.

### Step 1: Choose The Focus Window

The active tab must be inside the readable group.

```ts
const centerIndex = clamp(
  Math.round(scrollAnchor),
  0,
  sheetCount - 1
)

const focusIndex = clampIntoRange(activeIndex, centerIndex - 2, centerIndex + 2)
```

In practice, make `activeIndex` the primary anchor after selection. The user
should never select a tab and see it become a sliver.

### Step 2: Reserve Edge Compression Space

If there are hidden tabs to the left, reserve space for real compressed tab
rects.

```ts
const leftHiddenCount = firstReadableIndex
const rightHiddenCount = sheetCount - 1 - lastReadableIndex

const leftCompressedCount = Math.min(MAX_LEFT_COMPRESSED, leftHiddenCount)
const rightCompressedCount = Math.min(MAX_RIGHT_COMPRESSED, rightHiddenCount)

const leftReserve =
  leftCompressedCount === 0
    ? 0
    : COMPRESSED_WIDTH + (leftCompressedCount - 1) * COMPRESSED_STEP

const rightReserve =
  rightCompressedCount === 0
    ? 0
    : COMPRESSED_WIDTH + (rightCompressedCount - 1) * COMPRESSED_STEP
```

The reserve belongs to real compressed tabs.

### Step 3: Allocate Readable Tabs

Available readable space:

```ts
const readableLeft = EDGE_INSET + leftReserve
const readableRight = viewportWidth - EDGE_INSET - rightReserve
const readableWidth = readableRight - readableLeft
```

The active tab gets first claim:

```ts
activeWidth = Math.min(ACTIVE_WIDTH, readableWidth)
```

Then add neighboring tabs by proximity:

1. active tab;
2. one right neighbor;
3. one left neighbor;
4. second right neighbor;
5. second left neighbor;
6. continue only if width remains.

Each readable neighbor gets `FULL_WIDTH`, shrinking toward `MIN_FULL_WIDTH`
when necessary.

Do not squeeze all tabs equally. AppKit does not read as equal-width Excel tabs.
It reads as selected tab plus local context plus compressed overflow.

### Step 4: Place Readable Tabs

The selected tab should remain stable under small scroll deltas. A good default:

- if active tab is first: align left;
- if active tab is last: align right;
- otherwise place active tab around 35%-45% of the readable region, depending
  on available left/right context.

Example:

```ts
const activeTargetX = clamp(
  readableLeft + readableWidth * 0.38 - activeWidth / 2,
  readableLeft,
  readableRight - activeWidth
)
```

Then place left neighbors from `activeTargetX` backward and right neighbors from
`activeTargetX + activeWidth` forward.

### Step 5: Add Compressed Left Tabs

Compressed left tabs are the last hidden tabs before the readable group. They
must be real tab rects.

Example if the readable group starts at index 8:

```txt
compressed left rects represent indices 4, 5, 6, 7
```

Place them in increasing x order, partially overlapped:

```ts
for each compressed tab:
  x = EDGE_INSET + i * COMPRESSED_STEP
  width = COMPRESSED_WIDTH
```

Higher index should paint above lower index, because it is closer to the
readable group.

### Step 6: Add Compressed Right Tabs

Compressed right tabs are the first hidden tabs after the readable group.

Example if the readable group ends at index 12:

```txt
compressed right rects represent indices 13, 14, 15, 16
```

Place them from right to left:

```ts
for each compressed tab:
  x = viewportWidth - EDGE_INSET - COMPRESSED_WIDTH - i * COMPRESSED_STEP
  width = COMPRESSED_WIDTH
```

Lower index should paint above higher index, because it is closer to the
readable group.

## Visual Rules

### Readable Tab

Readable tabs should look like tabs, not pills floating in space.

Inactive readable tab:

- transparent or muted background;
- no full border box unless hovered;
- text visible and truncated;
- subtle separator line where tabs meet.

Active tab:

- stronger background;
- border or highlight;
- slightly raised visual weight;
- highest z-index among readable tabs.

### Compressed Tab

Compressed tabs should still be tab elements.

They should render:

- same height as tabs;
- narrow width;
- rounded outer side only when at the outermost edge;
- separator/border line visible;
- no text;
- optionally a tiny fill gradient from active/inactive tab background.

They should not render as generic vertical lines. They should read as compressed
tab bodies.

### Continuous Track

There should be a native tabbar bed behind everything:

- one rounded rect background;
- slightly darker/lighter than page background;
- clips all tab bodies;
- no separate card inside a card.

## Interaction Model

### Click

Clicking a readable tab:

1. sets `activeIndex`;
2. recalculates layout anchored around that tab;
3. animates rects.

Clicking a compressed tab:

1. sets `activeIndex` to that compressed tab index;
2. jumps/reveals enough to make it readable;
3. animates from compressed rect to readable rect.

This is important. Compressed tabs are real targets when large enough. If a
compressed tab is too narrow for a good hit target, wrap its hit area in an
invisible, still-local button region. Do not add arrows.

### Wheel

Wheel should adjust `scrollAnchor`, not DOM `scrollLeft`.

```ts
const deltaTabs = dominantWheelDelta / WHEEL_PIXELS_PER_TAB
setScrollAnchor((value) => clamp(value + deltaTabs, 0, sheetCount - 1))
```

Recommended:

```ts
const WHEEL_PIXELS_PER_TAB = 140
```

Use fractional anchors so trackpad scrolling feels continuous. The layout can
interpolate widths and positions from fractional progress later, but the first
version can round to the nearest anchor.

At boundaries:

- if already at the first logical tab and wheel left/up, do not prevent default;
- if already at the last logical tab and wheel right/down, do not prevent
  default;
- otherwise prevent default and move the virtual tab range.

### Keyboard

Keyboard changes `activeIndex`.

- ArrowLeft: previous tab, wrap at start.
- ArrowRight: next tab, wrap at end.
- Home: first tab.
- End: last tab.

After changing active index, call the reveal function:

```ts
scrollAnchor = resolveAnchorForActiveIndex(activeIndex)
```

### Reveal Rules

If selected tab is compressed or outside the readable group:

- make it readable;
- keep one to two neighbors if possible;
- keep compressed tabs on the side that still has hidden tabs.

If selected tab is already readable:

- do not recenter aggressively;
- only adjust if it is at the edge and would become clipped.

This avoids the "carousel" feel.

## Animation Strategy

### Start Without A Dependency

Do not add `react-motion` yet. The repo currently has no motion dependency.
The correct first step is dependency-free FLIP.

### FLIP Model

Store the previous rect map:

```ts
const previousRectsRef = useRef<Map<number, DOMRectLike>>(new Map())
```

After layout changes:

1. compute next rects;
2. for each tab, compare previous and next;
3. apply an inverse transform;
4. let CSS transition transform/width back to zero/new width.

CSS:

```css
transition-property: transform, width, opacity, background-color, border-color;
transition-duration: 160ms;
transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
```

Respect reduced motion:

```ts
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches
```

If reduced motion is true, skip transform transitions.

### When To Add Motion

Add a motion library only if the dependency-free layout still has poor feel
after:

- real compressed tab geometry exists;
- active reveal is stable;
- wheel anchor movement is fractional;
- rect transitions use FLIP;
- reduced motion is supported.

If a dependency becomes justified, prefer a maintained spring library already
compatible with React 19. Do not pick `react-motion` by default; it is old and
would be a strange new dependency for this repo.

## Accessibility

The visual compressed layout should still expose a tablist.

Each rendered tab rect should be a button with:

```tsx
role="tab"
aria-selected={isActive}
tabIndex={isActive ? 0 : -1}
title={sheet.name}
aria-label={sheet.name}
```

Compressed tabs should remain accessible by keyboard through ArrowLeft/Right
even if their visible width is tiny.

If a compressed visual tab has a hit area wider than its visible body, the hit
area must still be local to the compressed tab and must not look like an arrow
control.

## Data Model

Recommended extracted helper:

```ts
export interface XlsxTabLayoutRect {
  index: number
  kind: "readable" | "compressed"
  side: "left" | "right" | null
  x: number
  width: number
  zIndex: number
  opacity: number
}

export function resolveXlsxTabLayout(input: {
  activeIndex: number
  sheetCount: number
  viewportWidth: number
  scrollAnchor: number
}): XlsxTabLayoutRect[] {
  // Pure, deterministic geometry.
}
```

Keep this function pure so tests can cover the native-feel rules without
depending on jsdom layout hacks.

## Component Shape

```tsx
<div role="tablist" data-slot="xlsx-viewer-tabs">
  <div ref={viewportRef} data-slot="xlsx-viewer-tabs-viewport">
    <div data-slot="xlsx-viewer-tabs-track">
      {rects.map((rect) => (
        <button
          role="tab"
          style={{
            transform: `translateX(${rect.x}px)`,
            width: rect.width,
            zIndex: rect.zIndex,
          }}
        />
      ))}
    </div>
  </div>
</div>
```

The track is not `min-w-max`.
The viewport is not visually scrolling.
The rects are the layout.

## Test Plan

### Pure Layout Tests

Add tests for `resolveXlsxTabLayout`.

Cases:

1. Few sheets fit: all sheets readable, no compressed tabs.
2. Many sheets at start: active first tab readable, right compressed tabs
   present, no left compressed tabs.
3. Many sheets in middle: left compressed, active readable, right compressed.
4. Many sheets at end: left compressed, last active readable, no right
   compressed.
5. Active tab clicked from right compressed region becomes readable.
6. Active tab clicked from left compressed region becomes readable.
7. Very narrow viewport still renders active tab readable and at least one
   compressed cue if hidden tabs exist.
8. Layout never produces negative x or width.
9. Layout never exceeds viewport bounds.
10. Z-index makes active tab paint above neighbors.

### Component Tests

Keep current interaction tests, but update assertions:

- no `overflow-x-auto` as visual source of truth;
- rendered tabs have absolute/transform geometry;
- wheel changes virtual anchor;
- compressed tabs are real tab buttons;
- ArrowRight/ArrowLeft reveal selected tabs;
- Home/End clamp to edges with compressed cues on the opposite side.

### Browser Verification

Use the XLSX docs route.

Required screenshots/measurements:

- desktop start;
- desktop middle after trackpad/horizontal wheel;
- desktop last tab after End;
- mobile start;
- mobile middle.

Assertions:

- selected tab has larger width than inactive readable tabs;
- compressed tabs are real tab elements with tiny widths;
- no decorative overlay slots exist;
- no page horizontal overflow;
- no overlap between tab text and compressed edge bodies;
- wheel does not scroll the page while the tabbar can move.

## Migration Plan

### Phase 1: Revert Overlay Approach

Remove:

- `XlsxSheetTabStack`;
- `data-left-stack-ribs`;
- `data-right-stack-ribs`;
- absolute edge stack overlays;
- dependency on visual `scrollLeft` for rendering.

Keep temporarily:

- keyboard selection logic;
- selection callback;
- ResizeObserver viewport measurement.

### Phase 2: Add Pure Layout Helper

Create:

```txt
registry/new-york-v4/ui/xlsx-sheet-tabs-layout.ts
```

or keep it in the same file initially if the component remains small.

Given the complexity, a separate pure helper is better.

### Phase 3: Render Positioned Real Tabs

Replace flex row with positioned tabs.

Each tab button receives:

- `position: absolute`;
- `left: 0`;
- `transform: translateX(x)`;
- explicit `width`;
- explicit `height`.

Use `overflow: hidden` on the viewport.

### Phase 4: Wire Virtual Wheel Anchor

Replace `scrollTabsBy` with `moveTabAnchorByWheel`.

State:

```ts
const [scrollAnchor, setScrollAnchor] = useState(activeSheetIndex)
```

When active changes externally, reveal it:

```ts
setScrollAnchor(resolveAnchorForActiveIndex(...))
```

### Phase 5: Add FLIP

Only after the static compressed layout feels right, add rect animation.

Do not animate early. Animation hides layout mistakes and makes debugging
harder.

### Phase 6: Registry Sync And Verification

After implementation:

```sh
pnpm exec vitest run tests/xlsx-components.test.tsx
pnpm exec eslint registry/new-york-v4/ui/xlsx-sheet-tabs.tsx tests/xlsx-components.test.tsx
pnpm exec tsc --noEmit
```

Then sync:

```sh
node -e "const fs=require('fs'); const source=fs.readFileSync('registry/new-york-v4/ui/xlsx-sheet-tabs.tsx','utf8'); const path='public/r/xlsx-viewer.json'; const json=JSON.parse(fs.readFileSync(path,'utf8')); const file=json.files.find((entry)=>entry.path==='registry/new-york-v4/ui/xlsx-sheet-tabs.tsx'); if(!file) throw new Error('xlsx-sheet-tabs entry not found'); file.content=source; fs.writeFileSync(path, JSON.stringify(json, null, 2)+'\n');"
```

## Acceptance Criteria

The implementation is acceptable when:

- the edge stack is made of actual compressed tab elements;
- there are no fake overlay ribs;
- selected tab priority is visible and stable;
- neighboring tabs provide context without equal-width Excel crowding;
- wheel movement changes the compressed layout smoothly;
- keyboard selection never leaves the active tab compressed;
- first and last tabs clamp naturally;
- the layout still works on mobile widths;
- reduced motion is respected;
- tests cover the pure geometry rules.

## Key Principle

Do not animate the wrong layout.

First make the tab geometry real. Then animate it.
