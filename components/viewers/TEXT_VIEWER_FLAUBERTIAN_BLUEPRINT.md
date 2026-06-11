# Text Viewer Flaubertian Blueprint

This is the final-pass blueprint for `TextViewer`.

The component already has the right broad shape: range logic, layout logic,
resource loading, local errors, bounded loading, retry, generated registry
output, and focused tests. This document only covers the remaining details that
keep it from feeling inevitable.

## Goal

Make the implementation read as if no other shape was possible:

- exact reset identity, no hashes
- resource cache internals hidden from the component
- no test-only public cache-size helper
- naming that says why state changes
- tests that prove behavior instead of inspecting implementation state

## Current Non-Ideal Surface

### 1. Inline Reset Identity Uses A Hash

Current shape:

```ts
function textViewerResetKey(
  props: Pick<TextViewerProps, "src" | "value" | "maxBytes" | "maxLines">,
  resourceVersion: number
) {
  const boundsKey = `${String(props.maxBytes)}\0${String(props.maxLines)}`
  if (props.value !== undefined) {
    return `value\0${textViewerStringFingerprint(props.value)}\0${boundsKey}`
  }
  return `src\0${props.src ?? ""}\0${resourceVersion}\0${boundsKey}`
}
```

Problem:

- A hash is a pragmatic approximation, not exact identity.
- The fingerprint helper exists only to work around using a string reset key.
- A collision could theoretically keep an inline error boundary stale.

Ideal:

Use a structured reset token and compare exact fields.

```ts
type TextViewerResetToken =
  | {
      kind: "value"
      value: string
      maxBytes: number | undefined
      maxLines: number | undefined
    }
  | {
      kind: "src"
      src: string | undefined
      retryVersion: number
      maxBytes: number | undefined
      maxLines: number | undefined
    }

function textViewerResetTokenChanged(
  previous: TextViewerResetToken,
  next: TextViewerResetToken
) {
  if (previous.kind !== next.kind) return true
  if (previous.maxBytes !== next.maxBytes) return true
  if (previous.maxLines !== next.maxLines) return true
  if (previous.kind === "value") return previous.value !== next.value
  return (
    previous.src !== next.src || previous.retryVersion !== next.retryVersion
  )
}
```

Rules:

- Do not hash inline text.
- Do not concatenate reset keys.
- Do not copy the whole value into another string.
- Reset equality belongs next to the error boundary, not the resource module.

### 2. Retry Counter Name Is Too Generic

Current name:

```ts
const [resourceVersion, setResourceVersion] = React.useState(0)
```

Problem:

- It says what becomes different, not why it changes.
- The only reason it increments is retrying/reloading a `src`.

Ideal:

```ts
const [retryVersion, setRetryVersion] = React.useState(0)
```

Rules:

- Use `retryVersion` in `TextViewer`.
- If the resource module needs a more general name, use `loadVersion` there.
- Avoid `resourceVersion` unless the variable really represents all resource
  identity, not only retry identity.

### 3. Resource Key Leaks Across Module Boundary

Current component responsibility:

```ts
const resourceKey = textViewerResourceKey({ src, resourceVersion, ...bounds })
const text = readTextResource({ src, resourceKey, bounds })
```

Problem:

- The component knows that the cache has a key.
- The caller can pass a mismatched `src`, `bounds`, and `resourceKey`.
- Tests couple to key construction instead of observable loading behavior.

Ideal:

```ts
const text = readTextResource({
  src,
  retryVersion,
  bounds,
})
```

The resource module owns key construction:

```ts
export function readTextResource({
  src,
  retryVersion,
  bounds,
}: {
  src: string
  retryVersion: number
  bounds: Required<TextViewerBounds>
}) {
  const resourceKey = textViewerResourceKey({ src, retryVersion, bounds })
  const resource = getTextResource({ src, resourceKey, bounds })

  if (resource.status === "fulfilled") return resource.value
  if (resource.status === "rejected") throw resource.error
  throw resource.promise
}
```

Rules:

- `textViewerResourceKey` is private.
- `TextViewer` never imports or calls key construction.
- Resource tests prove cache behavior through fetch counts and retry behavior.

### 4. Test-Only Cache Size Export Leaks Implementation

Current surface:

```ts
export function textViewerResourceCacheSizeForTests() {
  return textResourceCache.size
}
```

Problem:

- It exposes cache structure just to test eviction.
- It encourages tests to assert implementation state instead of behavior.

Ideal:

Remove it. Test eviction by observing refetch:

1. Load `MAX_TEXT_RESOURCE_CACHE_ENTRIES + 1` distinct `src` values.
2. Read the first `src` again.
3. Assert fetch was called one extra time.

Rules:

- Keeping `clearTextViewerResourceCacheForTests` is acceptable because tests
  need isolation.
- Do not export cache size.
- Do not export the cache map.
- Do not expose cache keys.

## Target Module API

### `text-viewer-resource.ts`

Public exports:

```ts
export const DEFAULT_MAX_BYTES = 1_000_000
export const DEFAULT_MAX_LINES = 10_000
export const MAX_TEXT_RESOURCE_CACHE_ENTRIES = 64

export interface TextViewerBounds {
  maxBytes?: number
  maxLines?: number
}

export type TextViewerTooLargeReason = "bytes" | "lines"
export type TextViewerBoundName = "maxBytes" | "maxLines"

export class TextViewerTooLargeError extends Error {}
export class TextViewerInvalidBoundsError extends Error {}

export function clearTextViewerResourceCacheForTests(): void
export function resolvedTextViewerBounds(
  bounds?: TextViewerBounds
): Required<TextViewerBounds>
export function assertTextWithinBounds(
  text: string,
  bounds: Required<TextViewerBounds>
): void
export function readTextResource(args: {
  src: string
  retryVersion: number
  bounds: Required<TextViewerBounds>
}): string
```

Private functions:

- `textViewerResourceKey`
- `getTextResource`
- `fetchBoundedText`
- `readBoundedResponseText`
- `lineCountOf`
- `resolveTextViewerBound`
- `trimTextResourceCache`

### `text-viewer.tsx`

Owns:

- structured reset token
- reset token comparison
- retry-version state
- rendering composition

Does not own:

- cache key construction
- fetch details
- range math
- scroll geometry

## Implementation Plan

1. Replace `resourceVersion` with `retryVersion` in `TextViewer`.
2. Replace `resetKey: string` with `resetToken: TextViewerResetToken`.
3. Add `textViewerResetTokenChanged(previous, next)`.
4. Remove `textViewerStringFingerprint`.
5. Change `readTextResource` to accept `src`, `retryVersion`, and `bounds`.
6. Make `textViewerResourceKey` private.
7. Remove `textViewerResourceCacheSizeForTests`.
8. Update tests to assert eviction through refetch behavior.
9. Run focused tests, lint, filtered typecheck, and registry build.

## Required Tests

### Reset Token Tests

- Inline too-large error recovers when `value` changes.
- Inline invalid-bounds error recovers when bounds become valid.
- Same inline value and same invalid bounds do not reset accidentally.
- `src` error recovers when `src` changes.
- Same `src` retry increments `retryVersion` and reloads.

### Resource Tests

- First successful `src` load caches fulfilled text.
- Same `src` and same `retryVersion` does not refetch.
- Same `src` and incremented `retryVersion` refetches.
- More than `MAX_TEXT_RESOURCE_CACHE_ENTRIES` distinct reads evict the oldest
  entry, proven by refetching the first `src`.
- Invalid bounds throw `TextViewerInvalidBoundsError`.

### Regression Tests

- No test imports `textViewerResourceKey`.
- No test imports cache size helpers.
- `TextViewer` does not import resource-key helpers.
- `TextViewer` contains no `fingerprint` helper.
- `TextViewer` contains no `resourceVersion` identifier.

## Done Criteria

The final pass is done when:

- Reset identity is exact and collision-free.
- Retry naming explains intent.
- Resource keys are private to the resource module.
- Cache eviction is tested behaviorally.
- Generated registry output matches source.
- `vitest run tests/text-viewer.test.tsx` passes.
- ESLint passes on touched files.
- Filtered typecheck has no TextViewer diagnostics.
- The code contains no extra public surface used only to inspect internals.

At that point, the component is not just robust. It is quiet.
