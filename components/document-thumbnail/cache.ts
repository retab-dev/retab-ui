// ---------------------------------------------------------------------------
// Concurrency gate — every renderer parses a heavy library and does synchronous
// CPU work (UTIF decode, XLSX parse, canvas paint), all on the main thread. A
// grid of thumbnails that mounts at once would fire these in a single burst and
// jank the page. Cap how many heavy decodes run concurrently; the rest queue
// and start as slots free, spreading the work across frames.
// ---------------------------------------------------------------------------

const MAX_CONCURRENT_DECODES = 3
let activeDecodes = 0
const decodeQueue: Array<() => void> = []

function acquireDecodeSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const grant = () => {
      activeDecodes++
      let released = false
      resolve(() => {
        if (released) return
        released = true
        activeDecodes--
        decodeQueue.shift()?.()
      })
    }
    if (activeDecodes < MAX_CONCURRENT_DECODES) grant()
    else decodeQueue.push(grant)
  })
}

/** Run `fn` once a decode slot is free, always releasing it afterward. */
export async function withDecodeSlot<T>(fn: () => Promise<T>): Promise<T> {
  const release = await acquireDecodeSlot()
  try {
    return await fn()
  } finally {
    release()
  }
}

/**
 * Profiling helper — logs `[thumb] <label> <ms>` when enabled. Gated on a global
 * so it costs nothing in normal use; the profiler sets it before navigation.
 */
export async function timed<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const on =
    typeof globalThis !== "undefined" &&
    (globalThis as { __THUMB_PROFILE__?: boolean }).__THUMB_PROFILE__
  if (!on) return fn()
  const t0 = performance.now()
  try {
    return await fn()
  } finally {
    // eslint-disable-next-line no-console
    console.log(`[thumb] ${label} ${(performance.now() - t0).toFixed(1)}ms`)
  }
}

export function shortName(src: string): string {
  return src.split("/").pop() ?? src
}

// A thumbnail only shows the head of a text document, so cap the download with
// a Range request — a 40 MB log costs the same as a small one. Servers that
// ignore Range just return the whole body (200), which still works.
const TEXT_HEAD_BYTES = 64 * 1024

const textCache = new Map<string, Promise<string>>()

export function getText(src: string, resourceKey = src): Promise<string> {
  let promise = textCache.get(resourceKey)
  if (!promise) {
    promise = timed(`text:fetch ${shortName(src)}`, async () => {
      const res = await fetch(src, {
        headers: { Range: `bytes=0-${TEXT_HEAD_BYTES - 1}` },
      })
      if (!res.ok) throw new Error(`Failed to load ${src}: ${res.status}`)
      return res.text()
    })
    textCache.set(resourceKey, promise)
  }
  return promise
}
