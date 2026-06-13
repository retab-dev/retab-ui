# DataCell Pretext Caret Blueprint

## Goal

Make first-click text editing in `DataCell` feel native without mounting text
inputs for every visible table cell.

The user should be able to click a text cell and have the caret land at the
visual text position they clicked. The interaction should preserve the current
fast trompe-l'oeil architecture:

- Resting cells are cheap display surfaces.
- The real text input mounts only when editing starts.
- The first pointer gesture still carries precise caret intent.
- `DataCell` owns text editing mechanics.
- `json-table` owns table state, edit sessions, and JSON commits.

## Current Problem

The current text path is not native caret placement.

1. The user presses on a table cell.
2. `EditableJsonTableCell` starts an edit session on `pointerdown`.
3. React replaces the display cell with a text input.
4. `DataCellTextControl` focuses the new input.
5. `DataCellTextControl` estimates the caret index from the pointer x position.

The current estimate treats text as evenly spaced:

```ts
ratio = (clientX - contentLeft) / contentWidth
selectionIndex = Math.round(ratio * value.length)
```

That is wrong for proportional fonts, ligatures, emoji, combining marks, mixed
scripts, bidi text, browser zoom, and truncated text. It is also conceptually
wrong because the browser never got to place the caret on the input: the input
did not exist when the pointer gesture began.

## Design Principle

Use native browser caret placement when it is available. Use Pretext when the
browser cannot answer. Keep the simple linear estimate only as a final fallback.

The fallback chain should be:

1. Browser `caretPositionFromPoint` / `caretRangeFromPoint` against the display
   text.
2. Pretext-powered grapheme hit-test.
3. Existing linear ratio estimate.

This gives us the most native result where possible, a fast deterministic result
where native APIs are unavailable, and a tiny safe fallback for tests and unusual
environments.

## Ownership

### `json-table`

`json-table` should only capture the activation intent:

- field path
- pointer coordinates
- pointer detail
- keyboard key
- session identity

It should not know how text hit-testing works.

### `DataCellTextControl`

`DataCellTextControl` should:

- receive `activationIntent`
- mount and focus the input
- ask a small hit-test helper for the desired selection offset
- call `input.setSelectionRange(offset, offset)`

It should not contain Pretext-specific logic.

### `data-cell-text-hit-test`

A new internal module should own all caret hit-testing:

```ts
getDataCellTextSelectionOffset({
  input,
  value,
  clientX,
  clientY,
  displayElement,
}): number
```

The public return value is a JavaScript UTF-16 string offset suitable for
`HTMLInputElement.setSelectionRange`. Pretext cursors must not leak out of this
module.

## Browser Native Hit-Test

Before mounting the input, the display text is still in the DOM. The cleanest
answer is to ask the browser where the caret would be in that rendered text.

Candidate APIs:

```ts
document.caretPositionFromPoint(x, y)
document.caretRangeFromPoint(x, y)
```

Desired behavior:

- The table captures the pointer coordinates.
- The display cell records enough information for the helper to identify the
  display text node or display value span.
- The helper maps the browser-returned node/offset back to the cell string.
- If the browser result is outside the display value node, ignore it.
- If the cell is truncated, clamp to the visible text edge.

This is the highest-fidelity path because it uses the browser's real rendered
text layout. It should be tried first.

Risk: the API is browser-specific, not perfectly standardized, and may return
offsets into nested spans or text nodes that need careful mapping. It also will
not help in jsdom.

## Pretext Hit-Test

Pretext is the deterministic fallback for fast, proportional, grapheme-aware
single-line hit-testing.

### Inputs

The helper needs:

- `value`: the exact input string
- `clientX`: pointer x coordinate
- `inputRect`: mounted input bounds
- computed styles:
  - `font`
  - `letterSpacing`
  - `paddingLeft`
  - `paddingRight`
  - `direction`
  - `textAlign`

First pass can support LTR left-aligned text only and fall back for the rest.
That already covers the primary json-table path.

### Output

Return a UTF-16 offset:

```ts
0 <= offset <= value.length
```

Never return a Pretext `LayoutCursor` to callers.

### Algorithm

1. Convert `clientX` into content-space x:

   ```ts
   x = clientX - rect.left - paddingLeft + input.scrollLeft
   ```

2. Clamp x:

   ```ts
   x = Math.max(0, Math.min(x, measuredTextWidth))
   ```

3. Segment the value into grapheme boundaries:

   ```ts
   boundaries = [0, ...graphemeEndOffsets]
   ```

4. Define a prefix width function:

   ```ts
   widthAt(i) = measure(value.slice(0, boundaries[i]))
   ```

5. Binary-search for the first boundary where `widthAt(i) >= x`.

6. Compare the neighboring boundary distances:

   ```ts
   previousDistance = x - widthAt(i - 1)
   currentDistance = widthAt(i) - x
   ```

7. Return whichever boundary is closer.

This reproduces native midpoint behavior: clicking the left half of a glyph
lands before it; clicking the right half lands after it.

### Pretext Measurement

Use public Pretext APIs only.

Initial simple implementation:

```ts
const prepared = prepareWithSegments(prefix, font, {
  whiteSpace: "pre-wrap",
  letterSpacing,
})
const width = measureNaturalWidth(prepared)
```

That is enough for binary-search prefix measurement.

Later optimization:

- prepare once per full value
- derive prefix advances from prepared segments if a public API allows it
- otherwise cache prefix widths

## Cache

The hit-test cache should be small and boring.

Cache key:

```ts
font + "\n" + letterSpacing + "\n" + value
```

Cache value:

```ts
{
  boundaries: number[]
  widths: number[]
}
```

Eviction:

- fixed-size LRU
- start with 500 entries
- clear on locale/font cache reset if needed

Expected cost:

- Short text values: negligible.
- Repeated table values: mostly cache hits.
- Worst case: `O(log n)` prefix measurements on first activation.

## Direction, Alignment, And Truncation

Do not pretend to solve every text layout case in the first pass.

First pass:

- LTR
- single line
- left-aligned
- no text transform
- no custom letter-spacing beyond numeric px

Fallback to linear estimate when:

- `direction: rtl`
- `text-align` is not left/start
- `text-overflow: ellipsis` hides the clicked text range
- computed font cannot be converted into a stable canvas font shorthand
- Pretext throws or cannot initialize

Future passes can add:

- RTL support
- center/right alignment
- explicit truncation behavior
- browser-native hit-test over display text for all directions

## Integration Shape

Current:

```ts
focusDataCellTextInput(input, intent)
```

Target:

```ts
focusDataCellTextInput({
  input,
  intent,
  displayElement,
})
```

Inside:

```ts
input.focus({ preventScroll: true })

const offset =
  intent?.type === "pointer"
    ? getDataCellTextSelectionOffset({
        input,
        value: input.value,
        clientX: intent.clientX,
        clientY: intent.clientY,
        displayElement,
      })
    : input.value.length

input.setSelectionRange(offset, offset)
```

The hard part is preserving a reference to the display value element long enough
to use browser-native hit-testing. If React unmounts it before the helper runs,
there are two choices:

1. Capture the native caret offset synchronously in the table cell before
   starting the edit session.
2. Skip browser-native hit-testing and use Pretext from the mounted input.

The simpler first implementation can choose option 2. The ideal implementation
adds option 1 later.

## Testing Plan

### Unit Tests

Add tests for the hit-test helper with mocked measurement:

- empty string returns `0`
- click before text returns `0`
- click after text returns `value.length`
- proportional widths pick the nearest boundary
- emoji returns whole-grapheme offsets
- combining marks never split
- fallback returns current linear behavior

### Browser Tests

jsdom cannot validate visual caret placement. Add Playwright/browser coverage:

- click before `U` in `USD` -> offset `0`
- click between `U` and `S` -> offset `1`
- click between `S` and `D` -> offset `2`
- click after `D` -> offset `3`
- repeat with proportional text like `illWWW`
- repeat with emoji / combining mark text

The assertion should read:

```ts
input.selectionStart
input.selectionEnd
```

### Regression Tests

Keep the existing test that first click focuses the text input. Update it so it
does not encode jsdom's lack of layout as the product contract.

## Profiling Plan

Create a small benchmark for:

- current linear estimate
- Pretext cold hit-test
- Pretext warm hit-test
- browser-native caret-from-point path

Benchmark strings:

- short ASCII: `USD`
- medium vendor: `CHECKCARD PURCHASE 1234`
- proportional: `illWWWmmm`
- emoji: `Paid ✅`
- combining mark: `Cafe\u0301`
- mixed script: `AGI 春天到了`

Targets:

- warm hit-test under 0.1ms
- cold short-text hit-test under 1ms
- no measurable scroll jank in 1,000 visible cells
- no extra React mounts before activation

## Rollout

1. Implement the helper with current linear behavior moved behind the new API.
2. Add Pretext binary-search fallback.
3. Add browser-native hit-test if it can be captured cleanly.
4. Wire `DataCellTextControl` to the helper.
5. Add browser tests.
6. Profile before and after.
7. Remove dead caret code.

## Decision

The best strategy is not hover-mounting first.

Hover-mounting gives perfect native placement but changes lifecycle and mount
cost. Pretext lets us preserve the fast trompe-l'oeil model while making the
first click precise enough for real editing.

The platonic target:

- browser-native when the display text can answer
- Pretext-grapheme binary search when it cannot
- linear fallback only for hostile environments
- no Pretext details leaking outside DataCell internals
- no json-table involvement beyond activation intent
