import { spawn } from "node:child_process"

const requestedProfileUrl =
  process.env.PROFILE_URL ?? "http://localhost:3100/json-table-profile"
const profileOutput =
  process.env.PROFILE_OUTPUT ??
  "tmp/json-table-primitive-interactions-profile.fresh.json"
const budgetPath =
  process.env.JSON_TABLE_PERFORMANCE_BUDGET ??
  "components/json-table/json-table-performance-budget.json"
const reachabilityAttempts = Number(
  process.env.PROFILE_REACHABILITY_ATTEMPTS ?? 5
)
const reachabilityTimeoutMs = Number(
  process.env.PROFILE_REACHABILITY_TIMEOUT_MS ?? 5_000
)
const devServerTimeoutMs = Number(
  process.env.PROFILE_DEV_SERVER_TIMEOUT_MS ?? 60_000
)
const serverMode = process.env.PROFILE_SERVER_MODE ?? "auto"
const expectedProfileText = process.env.PROFILE_EXPECTED_TEXT ?? "JSON table"
const bodyPreviewLength = Number(
  process.env.PROFILE_ERROR_BODY_PREVIEW_LENGTH ?? 12_000
)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm"
}

function truncateBody(body) {
  if (body.length <= bodyPreviewLength) return body
  return `${body.slice(0, bodyPreviewLength)}\n... truncated ${
    body.length - bodyPreviewLength
  } chars`
}

function profileUrlForPort(profileUrl, port) {
  const parsed = new URL(profileUrl)
  parsed.hostname = "localhost"
  parsed.port = String(port)
  return parsed.toString()
}

function profilePort(profileUrl) {
  const parsed = new URL(profileUrl)
  if (parsed.port) return Number(parsed.port)
  return parsed.protocol === "https:" ? 443 : 80
}

function isReachabilityError(error) {
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return true
  }
  if (!(error instanceof Error)) return false

  const cause = error.cause
  return (
    error.name === "AbortError" ||
    error.name === "TypeError" ||
    (cause &&
      typeof cause === "object" &&
      "code" in cause &&
      ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH"].includes(
        String(cause.code)
      ))
  )
}

async function checkProfilePage(profileUrl) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), reachabilityTimeoutMs)

  try {
    const response = await fetch(profileUrl, {
      method: "GET",
      signal: controller.signal,
    })
    const body = await response.text()

    if (!response.ok) {
      return {
        ok: false,
        kind: "unhealthy",
        detail: `HTTP ${response.status}`,
        body: truncateBody(body),
      }
    }

    if (!body.includes(expectedProfileText)) {
      return {
        ok: false,
        kind: "unhealthy",
        detail: `response did not contain ${JSON.stringify(
          expectedProfileText
        )}`,
        body: truncateBody(body),
      }
    }

    return { ok: true, kind: "ok" }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      kind: isReachabilityError(error) ? "unreachable" : "unhealthy",
      detail,
      body: "",
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function assertProfilePageReachable(profileUrl) {
  let lastCheck = null

  for (let attempt = 1; attempt <= reachabilityAttempts; attempt += 1) {
    const check = await checkProfilePage(profileUrl)
    if (check.ok) return check

    lastCheck = check
    if (check.kind === "unhealthy") break
    if (attempt < reachabilityAttempts) await sleep(500 * attempt)
  }

  throw profileReachabilityError(
    profileUrl,
    lastCheck,
    await listeningProcessSummary(profileUrl)
  )
}

function profileReachabilityError(profileUrl, check, processSummary) {
  const detail = check?.detail ?? "unknown error"
  const lines = [
    `Profile page is not reachable at ${profileUrl} (${detail}).`,
    `Server mode: ${serverMode}`,
    processSummary ? `Listener: ${processSummary}` : null,
    `Profile output: ${profileOutput}`,
    `Budget file: ${budgetPath}`,
  ].filter(Boolean)

  if (check?.body) {
    lines.push("", "Response body preview:", check.body)
  }

  return new Error(lines.join("\n"))
}

function collectCommandOutput(command, args, timeoutMs = 2_000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    const timeout = setTimeout(() => {
      child.kill("SIGTERM")
    }, timeoutMs)

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.once("error", (error) => {
      clearTimeout(timeout)
      resolve({ code: 1, error, stderr, stdout })
    })
    child.once("exit", (code) => {
      clearTimeout(timeout)
      resolve({ code, error: null, stderr, stdout })
    })
  })
}

async function listeningProcessSummary(profileUrl) {
  const parsed = new URL(profileUrl)
  const port = profilePort(profileUrl)
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    return ""
  }

  return listeningProcessSummaryForPort(port)
}

async function listeningProcessSummaryForPort(port) {
  const result = await collectCommandOutput("lsof", [
    "-nP",
    `-iTCP:${port}`,
    "-sTCP:LISTEN",
    "-Fpnc",
  ])
  if (result.code !== 0 || !result.stdout.trim()) return ""

  const listeners = []
  let current = {}
  for (const line of result.stdout.trim().split("\n")) {
    const field = line.slice(0, 1)
    const value = line.slice(1)
    if (field === "p") {
      if (current.pid) listeners.push(current)
      current = { pid: value }
    } else if (field === "c") {
      current.command = value
    } else if (field === "n") {
      current.name = value
    }
  }
  if (current.pid) listeners.push(current)

  return listeners
    .map((listener) =>
      [
        `pid=${listener.pid}`,
        listener.command ? `command=${listener.command}` : null,
        listener.name ? `name=${listener.name}` : null,
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join("; ")
}

async function findAvailablePort(preferredPort) {
  for (let port = preferredPort; port < preferredPort + 100; port += 1) {
    if (await isPortAvailable(port)) return port
  }

  throw new Error(
    `Could not find an available profile dev-server port starting at ${preferredPort}`
  )
}

async function isPortAvailable(port) {
  return !(await listeningProcessSummaryForPort(port))
}

function startManagedDevServer(profileUrl) {
  const port = profilePort(profileUrl)
  const logs = []
  const child = spawn(
    pnpmCommand(),
    ["exec", "next", "dev", "--port", String(port)],
    {
      env: {
        ...process.env,
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  let spawnError = null

  function recordLog(chunk, stream) {
    const text = chunk.toString()
    logs.push(text)
    if (logs.length > 120) logs.splice(0, logs.length - 120)
    stream.write(text)
  }

  child.stdout.on("data", (chunk) => recordLog(chunk, process.stdout))
  child.stderr.on("data", (chunk) => recordLog(chunk, process.stderr))
  child.once("error", (error) => {
    spawnError = error
  })

  return {
    child,
    logs,
    get spawnError() {
      return spawnError
    },
    stop() {
      if (child.exitCode !== null || child.signalCode !== null) return
      child.kill("SIGTERM")
    },
  }
}

async function waitForManagedProfilePage(profileUrl, devServer) {
  const startedAt = Date.now()
  let lastCheck = null

  while (Date.now() - startedAt < devServerTimeoutMs) {
    if (devServer.spawnError) {
      throw new Error(
        [
          `Could not start managed Next dev server for ${profileUrl}.`,
          devServer.spawnError.message,
        ].join("\n")
      )
    }

    if (devServer.child.exitCode !== null || devServer.child.signalCode) {
      throw new Error(
        [
          `Managed Next dev server exited before ${profileUrl} became reachable.`,
          `Exit code: ${devServer.child.exitCode ?? "n/a"}`,
          `Signal: ${devServer.child.signalCode ?? "n/a"}`,
          "",
          "Dev server log tail:",
          devServer.logs.join(""),
        ].join("\n")
      )
    }

    const check = await checkProfilePage(profileUrl)
    if (check.ok) return
    lastCheck = check
    await sleep(500)
  }

  throw new Error(
    [
      `Managed Next dev server did not expose ${profileUrl} within ${devServerTimeoutMs}ms.`,
      `Last check: ${lastCheck?.detail ?? "none"}`,
      lastCheck?.body ? `\nResponse body preview:\n${lastCheck.body}` : "",
      "",
      "Dev server log tail:",
      devServer.logs.join(""),
    ].join("\n")
  )
}

async function resolveProfileUrl() {
  if (serverMode === "existing") {
    await assertProfilePageReachable(requestedProfileUrl)
    return { profileUrl: requestedProfileUrl, devServer: null }
  }

  if (serverMode !== "auto" && serverMode !== "managed") {
    throw new Error(
      `Unsupported PROFILE_SERVER_MODE=${JSON.stringify(
        serverMode
      )}; expected auto, existing, or managed`
    )
  }

  if (serverMode === "auto") {
    const check = await checkProfilePage(requestedProfileUrl)
    if (check.ok) {
      const processSummary = await listeningProcessSummary(requestedProfileUrl)
      console.log(
        [
          `Using existing JSON-table profile route: ${requestedProfileUrl}`,
          processSummary ? `Listener: ${processSummary}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      )
      return { profileUrl: requestedProfileUrl, devServer: null }
    }
    if (check.kind === "unhealthy") {
      throw profileReachabilityError(
        requestedProfileUrl,
        check,
        await listeningProcessSummary(requestedProfileUrl)
      )
    }
  }

  const port = await findAvailablePort(profilePort(requestedProfileUrl))
  const managedProfileUrl = profileUrlForPort(requestedProfileUrl, port)
  const devServer = startManagedDevServer(managedProfileUrl)
  await waitForManagedProfilePage(managedProfileUrl, devServer)
  return { profileUrl: managedProfileUrl, devServer }
}

function runNodeScript(scriptPath, args = [], profileUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      env: {
        ...process.env,
        PROFILE_URL: profileUrl,
        PROFILE_OUTPUT: profileOutput,
        JSON_TABLE_PERFORMANCE_REPORT:
          process.env.JSON_TABLE_PERFORMANCE_REPORT ?? profileOutput,
        JSON_TABLE_PERFORMANCE_BUDGET: budgetPath,
      },
      stdio: "inherit",
    })

    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(
        new Error(
          `${scriptPath} failed with ${
            signal ? `signal ${signal}` : `exit code ${code}`
          }`
        )
      )
    })
  })
}

async function main() {
  const { profileUrl, devServer } = await resolveProfileUrl()

  try {
    await runNodeScript(
      "scripts/profile-json-table-primitive-interactions.mjs",
      ["--assert"],
      profileUrl
    )
    await runNodeScript(
      "scripts/verify-json-table-performance-budget.mjs",
      [],
      profileUrl
    )
  } finally {
    devServer?.stop()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
