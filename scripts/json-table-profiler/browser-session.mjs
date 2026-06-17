export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response.json()
}

export async function waitForDevToolsEndpoint(endpoint) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 15_000) {
    try {
      return await fetchJson(`${endpoint}/json/version`)
    } catch {
      await sleep(100)
    }
  }
  throw new Error(`Chrome DevTools endpoint did not start at ${endpoint}`)
}

export async function closeChromeTarget(chromeEndpoint, targetId) {
  if (!targetId) return

  try {
    await fetch(`${chromeEndpoint}/json/close/${encodeURIComponent(targetId)}`)
  } catch {}
}

function isProfileTarget(target, profileUrl) {
  if (!target?.url) return false

  try {
    const targetUrl = new URL(target.url)
    const configuredUrl = new URL(profileUrl)
    return targetUrl.pathname === configuredUrl.pathname
  } catch {
    return false
  }
}

export async function closeProfileTargets(chromeEndpoint, profileUrl) {
  let targets = []
  try {
    targets = await fetchJson(`${chromeEndpoint}/json/list`)
  } catch {
    return
  }

  for (const target of targets) {
    if (isProfileTarget(target, profileUrl)) {
      await closeChromeTarget(chromeEndpoint, target.id)
    }
  }
}

export function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl)
  let nextId = 0
  const pending = new Map()
  const listeners = new Map()

  function emit(method, params) {
    for (const listener of listeners.get(method) ?? []) listener(params)
  }

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data)
    if (!payload.id) {
      if (payload.method) emit(payload.method, payload.params ?? {})
      return
    }
    if (!pending.has(payload.id)) return

    const request = pending.get(payload.id)
    pending.delete(payload.id)
    if (payload.error) request.reject(new Error(JSON.stringify(payload.error)))
    else request.resolve(payload.result)
  })

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        socket,
        send(method, params = {}) {
          const id = ++nextId
          socket.send(JSON.stringify({ id, method, params }))
          return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject })
          })
        },
        on(method, listener) {
          const methodListeners = listeners.get(method) ?? new Set()
          methodListeners.add(listener)
          listeners.set(method, methodListeners)
          return () => methodListeners.delete(listener)
        },
      })
    })
    socket.addEventListener("error", reject)
  })
}

export async function evaluate(send, expression) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const result = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
      if (result.exceptionDetails) {
        throw new Error(JSON.stringify(result.exceptionDetails))
      }
      return result.result.value
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isTransientContextError =
        message.includes("Cannot find default execution context") ||
        message.includes("Inspected target navigated") ||
        message.includes("Execution context was destroyed")
      if (!isTransientContextError || attempt === 49) throw error
      await sleep(100)
    }
  }

  throw new Error("Runtime.evaluate did not complete")
}

export async function waitInPage(send, expression, timeoutMs = 5_000) {
  return evaluate(
    send,
    `(async () => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < ${timeoutMs}) {
        if (${expression}) {
          await new Promise((resolve) => setTimeout(resolve, 32));
          return { ok: true, elapsedMs: performance.now() - startedAt };
        }
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
      return { ok: false, elapsedMs: performance.now() - startedAt };
    })()`
  )
}
