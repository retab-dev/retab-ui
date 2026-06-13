import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const profileUrl =
  process.env.PROFILE_URL ?? "http://localhost:3100/json-table-profile"
const chromePort = Number(process.env.CHROME_PORT ?? 9333)
const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const outputPath = process.env.PROFILE_OUTPUT

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response.json()
}

async function waitForDevToolsEndpoint(endpoint) {
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

function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl)
  let nextId = 0
  const pending = new Map()
  const events = []

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data)
    if (payload.id && pending.has(payload.id)) {
      const request = pending.get(payload.id)
      pending.delete(payload.id)
      if (payload.error)
        request.reject(new Error(JSON.stringify(payload.error)))
      else request.resolve(payload.result)
      return
    }
    if (payload.method) events.push(payload)
  })

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        events,
        socket,
        send(method, params = {}) {
          const id = ++nextId
          socket.send(JSON.stringify({ id, method, params }))
          return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject })
          })
        },
        waitForEvent(method, timeoutMs = 30_000) {
          const startIndex = events.length
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error(`Timed out waiting for ${method}`)),
              timeoutMs
            )
            const interval = setInterval(() => {
              const event = events
                .slice(startIndex)
                .find((event) => event.method === method)
              if (!event) return
              clearTimeout(timeout)
              clearInterval(interval)
              resolve(event)
            }, 25)
          })
        },
      })
    })
    socket.addEventListener("error", reject)
  })
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails))
  }
  return result.result.value
}

async function mouseMove(send, point) {
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    button: "none",
  })
}

async function clickPoint(send, point) {
  await mouseMove(send, point)
  await sleep(40)
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  })
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  })
}

function performanceMetrics(metricsRaw) {
  const metrics = Object.fromEntries(
    metricsRaw.metrics.map((metric) => [metric.name, metric.value])
  )
  return {
    JSHeapUsedSize: metrics.JSHeapUsedSize,
    Nodes: metrics.Nodes,
    LayoutCount: metrics.LayoutCount,
    RecalcStyleCount: metrics.RecalcStyleCount,
    LayoutDurationMs: (metrics.LayoutDuration ?? 0) * 1000,
    RecalcStyleDurationMs: (metrics.RecalcStyleDuration ?? 0) * 1000,
    ScriptDurationMs: (metrics.ScriptDuration ?? 0) * 1000,
    TaskDurationMs: (metrics.TaskDuration ?? 0) * 1000,
  }
}

function metricDelta(before, after) {
  return Object.fromEntries(
    Object.keys(after).map((key) => [key, after[key] - before[key]])
  )
}

function summarizeTrace(events) {
  const completeEvents = events.filter((event) => event.ph === "X")

  function byName(name) {
    const matching = completeEvents.filter((event) => event.name === name)
    return {
      count: matching.length,
      totalMs:
        matching.reduce((total, event) => total + (event.dur ?? 0), 0) / 1000,
      maxMs: Math.max(0, ...matching.map((event) => (event.dur ?? 0) / 1000)),
    }
  }

  return {
    EventDispatch: byName("EventDispatch"),
    FunctionCall: byName("FunctionCall"),
    UpdateLayoutTree: byName("UpdateLayoutTree"),
    Layout: byName("Layout"),
    Paint: byName("Paint"),
    MinorGC: byName("MinorGC"),
    topEvents: completeEvents
      .filter((event) => (event.dur ?? 0) > 1_000)
      .sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))
      .slice(0, 24)
      .map((event) => ({
        name: event.name,
        ms: (event.dur ?? 0) / 1000,
        category: event.cat,
        type: event.args?.data?.type,
        url: event.args?.data?.url,
      })),
  }
}

function topEntries(record, limit = 16) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

function summarizeProfiler(profiler) {
  const events = profiler.events ?? []
  const reactCommits = events.filter((event) => event.type === "react-commit")
  const marks = events.filter((event) => event.type === "mark")

  return {
    renders: {
      total: profiler.renders?.total ?? 0,
      byComponent: topEntries(profiler.renders?.byComponent ?? {}),
      byInstance: topEntries(profiler.renders?.byInstance ?? {}),
      changedProps: topEntries(profiler.renders?.changedProps ?? {}, 24),
    },
    reactCommits: {
      count: reactCommits.length,
      totalActualDurationMs: reactCommits.reduce(
        (total, event) => total + (event.detail?.actualDuration ?? 0),
        0
      ),
      maxActualDurationMs: Math.max(
        0,
        ...reactCommits.map((event) => event.detail?.actualDuration ?? 0)
      ),
      commits: reactCommits.map((event) => ({
        phase: event.detail?.phase,
        actualDurationMs: event.detail?.actualDuration,
        baseDurationMs: event.detail?.baseDuration,
      })),
    },
    marks: marks.map((event) => ({
      at: event.at,
      name: event.name,
      detail: event.detail,
    })),
  }
}

function printScenarioSummary(scenario) {
  const renders = scenario.profiler.renders
  const commits = scenario.profiler.reactCommits
  const trace = scenario.trace
  console.log(`\n${scenario.name}`)
  console.log(
    `  wait: ${scenario.wait.ok ? "ok" : "timeout"} ${scenario.wait.elapsedMs.toFixed(1)} ms`
  )
  console.log(
    `  renders: ${renders.total}; commits: ${commits.count}; react actual: ${commits.totalActualDurationMs.toFixed(1)} ms`
  )
  console.log(
    `  trace: script ${scenario.metricsDelta.ScriptDurationMs.toFixed(1)} ms, style ${scenario.metricsDelta.RecalcStyleDurationMs.toFixed(1)} ms, layout ${scenario.metricsDelta.LayoutDurationMs.toFixed(1)} ms, task ${scenario.metricsDelta.TaskDurationMs.toFixed(1)} ms`
  )
  console.log(
    `  max: event ${trace.EventDispatch.maxMs.toFixed(1)} ms, function ${trace.FunctionCall.maxMs.toFixed(1)} ms, style ${trace.UpdateLayoutTree.maxMs.toFixed(1)} ms`
  )
  console.log(
    `  top renders: ${renders.byComponent
      .slice(0, 6)
      .map((entry) => `${entry.name}=${entry.count}`)
      .join(", ")}`
  )
  console.log(
    `  top prop changes: ${renders.changedProps
      .slice(0, 6)
      .map((entry) => `${entry.name}=${entry.count}`)
      .join(", ")}`
  )
}

function waitForProcessExit(process) {
  if (process.exitCode !== null || process.signalCode !== null) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    process.once("exit", resolve)
  })
}

async function removeChromeProfile(userDataDir) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await rm(userDataDir, { recursive: true, force: true })
      return
    } catch (error) {
      if (attempt === 4) throw error
      await sleep(200)
    }
  }
}

async function waitInPage(send, expression, timeoutMs = 5_000) {
  return evaluate(
    send,
    `(async () => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < ${timeoutMs}) {
        if (${expression}) {
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return { ok: true, elapsedMs: performance.now() - startedAt };
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return { ok: false, elapsedMs: performance.now() - startedAt };
    })()`
  )
}

async function resetScenario(send, name) {
  await evaluate(
    send,
    `(() => {
      const profiler = window.__jsonTableProfiler;
      if (profiler) {
        profiler.events = [];
        profiler.renders = {
          total: 0,
          byComponent: {},
          byInstance: {},
          changedProps: {}
        };
      }
      if (window.__jsonTablePerf) window.__jsonTablePerf.longTasks = [];
      performance.clearMarks();
      performance.clearMeasures();
      window.__jsonTableProfileMark?.("scenario-start", { name: ${JSON.stringify(
        name
      )} });
    })()`
  )
}

async function finishScenario(send, name) {
  return evaluate(
    send,
    `(() => {
      window.__jsonTableProfileMark?.("scenario-end", { name: ${JSON.stringify(
        name
      )} });
      const profiler = window.__jsonTableProfiler;
      return {
        profiler,
        longTasks: window.__jsonTablePerf?.longTasks ?? [],
        dom: {
          nodes: document.getElementsByTagName("*").length,
          rows: document.querySelectorAll("tr").length,
          editableCells: document.querySelectorAll('[data-json-table-editable-cell="true"]').length,
          activeCells: document.querySelectorAll('[data-json-table-editable-cell="true"][data-active="true"]').length,
          dataCells: document.querySelectorAll('[data-slot="data-cell"]').length,
          calendar: Boolean(document.querySelector('[data-slot="calendar"]')),
          popovers: document.querySelectorAll('[data-slot="popover-popup"], [data-slot="data-cell-picker-popup"]').length
        }
      };
    })()`
  )
}

async function runScenario(page, send, name, action, waitExpression) {
  console.error(`Running scenario: ${name}`)
  await resetScenario(send, name)
  page.events.length = 0

  const beforeMetrics = performanceMetrics(await send("Performance.getMetrics"))
  await send("Tracing.start", {
    transferMode: "ReportEvents",
    categories: [
      "devtools.timeline",
      "v8.execute",
      "blink.user_timing",
      "disabled-by-default-devtools.timeline",
    ].join(","),
  })

  const startedAt = await evaluate(send, "performance.now()")
  await action()
  const wait = waitExpression
    ? await waitInPage(send, waitExpression)
    : await waitInPage(send, "true", 100)
  const elapsedMs = await evaluate(
    send,
    `performance.now() - ${JSON.stringify(startedAt)}`
  )
  const finished = await finishScenario(send, name)
  const afterMetrics = performanceMetrics(await send("Performance.getMetrics"))

  await send("Tracing.end")
  await page.waitForEvent("Tracing.tracingComplete", 60_000)
  const traceEvents = page.events
    .filter((event) => event.method === "Tracing.dataCollected")
    .flatMap((event) => event.params?.value ?? [])

  const scenario = {
    name,
    elapsedMs,
    wait,
    dom: finished.dom,
    longTasks: finished.longTasks,
    metricsDelta: metricDelta(beforeMetrics, afterMetrics),
    profiler: summarizeProfiler(finished.profiler ?? {}),
    trace: summarizeTrace(traceEvents),
  }
  printScenarioSummary(scenario)
  return scenario
}

async function clickButtonByText(send, text) {
  const point = await evaluate(
    send,
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((button) => button.textContent === ${JSON.stringify(text)});
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  )
  if (!point) throw new Error(`Button not found: ${text}`)
  await clickPoint(send, point)
}

async function moveOutsideTable(send) {
  await mouseMove(send, { x: 8, y: 8 })
  await sleep(80)
}

async function activateFirstCellKind(send, kind) {
  const point = await evaluate(
    send,
    `(() => {
      const cell = [...document.querySelectorAll('[data-kind="${kind}"][data-mode="display"]')]
        .map((element) => element.closest('[data-json-table-editable-cell="true"]'))
        .find((cell) => {
          if (!cell) return false;
          const rect = cell.getBoundingClientRect();
          return rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
        });
      if (!cell) return null;
      const rect = cell.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  )
  if (!point) return false
  await clickPoint(send, point)
  const result = await waitInPage(
    send,
    `Boolean(document.querySelector('[data-kind="${kind}"][data-mode="edit"]'))`,
    3_000
  )
  return result.ok
}

async function firstCellPoint(send, selector) {
  return evaluate(
    send,
    `(() => {
      const element = [...document.querySelectorAll(${JSON.stringify(
        selector
      )})].find((element) => {
        const cell = element.closest('[data-json-table-editable-cell="true"]') ?? element;
        const rect = cell.getBoundingClientRect();
        return rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
      });
      const cell = element?.closest('[data-json-table-editable-cell="true"]') ?? element;
      if (!cell) return null;
      const rect = cell.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  )
}

async function firstEditableCellPoint(send, selector) {
  return evaluate(
    send,
    `(() => {
      let cell = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .map((element) => element.closest('[data-json-table-editable-cell="true"]'))
        .find((cell) => {
          if (!cell) return false;
          const rect = cell.getBoundingClientRect();
          return rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
        });
      if (!cell) {
        cell = [...document.querySelectorAll(${JSON.stringify(selector)})]
          .map((element) => element.closest('[data-json-table-editable-cell="true"]'))
          .find(Boolean);
        cell?.scrollIntoView({ block: "nearest", inline: "center" });
      }
      if (!cell) return null;
      const rect = cell.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  )
}

async function dispatchEditableCellClick(send, selector) {
  return evaluate(
    send,
    `(() => {
      let cell = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .map((element) => element.closest('[data-json-table-editable-cell="true"]'))
        .find((cell) => {
          if (!cell) return false;
          const rect = cell.getBoundingClientRect();
          return rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
        });
      if (!cell) {
        cell = [...document.querySelectorAll(${JSON.stringify(selector)})]
          .map((element) => element.closest('[data-json-table-editable-cell="true"]'))
          .find(Boolean);
        cell?.scrollIntoView({ block: "nearest", inline: "center" });
      }
      if (!cell) return false;
      for (const type of ["pointerover", "pointerenter", "pointermove", "pointerdown"]) {
        cell.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "mouse",
          button: 0,
          buttons: 1,
          view: window
        }));
      }
      cell.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, buttons: 1, view: window }));
      cell.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0, buttons: 0, view: window }));
      cell.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    })()`
  )
}

async function installPageHelpers(send) {
  await evaluate(
    send,
    `(() => {
      window.__jsonTableProfileMark = (name, detail) => {
        const profiler = window.__jsonTableProfiler;
        try {
          performance.mark("json-table:" + name, detail ? { detail } : undefined);
        } catch {
          try { performance.mark("json-table:" + name); } catch {}
        }
        if (!profiler?.enabled) return;
        profiler.events.push({
          at: performance.now(),
          type: "mark",
          name,
          detail
        });
      };

      if (!window.__jsonTableDomObserver) {
        window.__jsonTableDomObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === "attributes") {
              const target = mutation.target;
              if (target instanceof HTMLElement && target.getAttribute("role") === "checkbox") {
                window.__jsonTableProfileMark?.("checkbox-aria-change", {
                  checked: target.getAttribute("aria-checked")
                });
              }
              continue;
            }
            for (const node of mutation.addedNodes) {
              if (!(node instanceof HTMLElement)) continue;
              if (node.matches?.('[data-slot="calendar"]') || node.querySelector?.('[data-slot="calendar"]')) {
                window.__jsonTableProfileMark?.("calendar-mounted");
              }
              if (node.matches?.('[data-mode="edit"]') || node.querySelector?.('[data-mode="edit"]')) {
                window.__jsonTableProfileMark?.("edit-dom-mounted");
              }
            }
          }
        });
        window.__jsonTableDomObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["aria-checked", "data-mode", "data-active"],
          childList: true,
          subtree: true
        });
      }
    })()`
  )
}

async function loadEditableProfile(page, send) {
  await send("Page.navigate", { url: profileUrl })
  await sleep(500)
  await evaluate(
    send,
    `new Promise((resolve, reject) => {
      const deadline = performance.now() + 15000;
      const find = () => {
        const section = [...document.querySelectorAll("section")]
          .find((section) => section.textContent?.includes("JSON table"));
        const scroller = document.querySelector('[data-slot="json-table-scroll"]');
        if (section && scroller) {
          window.__jsonTableSection = section;
          window.__jsonTableScroller = scroller;
          resolve(true);
        } else if (performance.now() > deadline) {
          reject(new Error("JSON table section/scroller not found"));
        } else {
          setTimeout(find, 100);
        }
      };
      find();
    })`
  )
  await installPageHelpers(send)
  await clickButtonByText(send, "Editable")
  await waitInPage(
    send,
    `document.querySelectorAll('[data-json-table-editable-cell="true"]').length > 0`,
    5_000
  )
  await sleep(500)
}

const chromeEndpoint = `http://127.0.0.1:${chromePort}`
const userDataDir = await mkdtemp(join(tmpdir(), "json-table-chrome-"))
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore" }
)

try {
  console.error("Waiting for Chrome DevTools endpoint")
  await waitForDevToolsEndpoint(chromeEndpoint)
  console.error(`Opening ${profileUrl}`)
  const newTargetResponse = await fetch(
    `${chromeEndpoint}/json/new?about:blank`,
    { method: "PUT" }
  )
  if (!newTargetResponse.ok) {
    throw new Error(`/json/new failed: ${newTargetResponse.status}`)
  }

  const target = await newTargetResponse.json()
  const page = await connectCdp(target.webSocketDebuggerUrl)
  const send = (method, params = {}) => page.send(method, params)

  await send("Page.enable")
  await send("Runtime.enable")
  await send("Performance.enable")
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__jsonTableProfiler = {
        enabled: true,
        events: [],
        renders: {
          total: 0,
          byComponent: {},
          byInstance: {},
          changedProps: {}
        },
        snapshots: {}
      };
      window.__jsonTablePerf = { longTasks: [] };
      try {
        new PerformanceObserver((list) => {
          window.__jsonTablePerf.longTasks.push(
            ...list.getEntries().map((entry) => ({
              startTime: entry.startTime,
              duration: entry.duration
            }))
          );
        }).observe({ type: "longtask", buffered: true });
      } catch {}
    `,
  })

  const startedAt = Date.now()
  await loadEditableProfile(page, send)
  console.error("Page loaded")
  console.error("Switching JSON table to editable mode")
  console.error("Warm profile setup complete")

  const initial = await evaluate(
    send,
    `(() => {
      const scroller = window.__jsonTableScroller;
      const navigation = performance.getEntriesByType("navigation")[0];
      return {
        url: location.href,
        elapsedWallMs: ${Date.now()} - ${startedAt},
        navigation: navigation ? {
          domContentLoaded: navigation.domContentLoadedEventEnd,
          load: navigation.loadEventEnd,
          responseEnd: navigation.responseEnd,
          transferSize: navigation.transferSize,
          encodedBodySize: navigation.encodedBodySize,
        } : null,
        scroll: {
          scrollHeight: scroller.scrollHeight,
          clientHeight: scroller.clientHeight,
          scrollTop: scroller.scrollTop,
          scrollLeft: scroller.scrollLeft,
          scrollWidth: scroller.scrollWidth,
          clientWidth: scroller.clientWidth
        },
        mountedRows: document.querySelectorAll("tr").length,
        mountedEditableCells: document.querySelectorAll('[data-json-table-editable-cell="true"]').length,
        totalDomNodes: document.getElementsByTagName("*").length,
        warmRenderSnapshotCount: Object.keys(window.__jsonTableProfiler?.snapshots ?? {}).length
      };
    })()`
  )

  const scenarios = []
  const checkboxChangedExpression = `(() => {
    const fieldPath = window.__jsonTableCheckboxFieldPath;
    const selector = fieldPath
      ? '[data-field-path="' + CSS.escape(fieldPath) + '"] [data-kind="boolean"] [role="checkbox"]'
      : '[data-kind="boolean"] [role="checkbox"]';
    const checkbox = document.querySelector(selector);
    if (!checkbox) return false;
    const before = window.__jsonTableCheckboxBefore;
    return before === null || checkbox.getAttribute("aria-checked") !== before;
  })()`

  scenarios.push(
    await runScenario(
      page,
      send,
      "hover-date-cell",
      async () => {
        await moveOutsideTable(send)
        const point = await firstEditableCellPoint(
          send,
          '[data-kind="date"][data-mode="display"]'
        )
        if (!point) throw new Error("No display date cell found")
        await mouseMove(send, point)
      },
      `document.querySelectorAll('[data-json-table-editable-cell="true"][data-active="true"]').length === 0`
    )
  )

  scenarios.push(
    await runScenario(
      page,
      send,
      "hover-first-20-mounted-cells",
      async () => {
        await moveOutsideTable(send)
        const points = await evaluate(
          send,
          `(() => [...document.querySelectorAll('[data-json-table-editable-cell="true"]')]
            .slice(0, 20)
            .map((cell) => {
              const rect = cell.getBoundingClientRect();
              return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            }))()`
        )
        for (const point of points) {
          await mouseMove(send, point)
          await sleep(20)
        }
      },
      "true"
    )
  )

  scenarios.push(
    await runScenario(
      page,
      send,
      "open-date-picker",
      async () => {
        const didClick = await dispatchEditableCellClick(
          send,
          '[data-kind="date"][data-mode="display"]'
        )
        if (!didClick) throw new Error("No display date cell found")
      },
      `Boolean(document.querySelector('[data-slot="calendar"]'))`
    )
  )

  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  })
  await sleep(200)

  console.error("Reloading before checkbox scenario")
  await loadEditableProfile(page, send)
  await evaluate(
    send,
    `(() => { window.__jsonTableScroller.scrollLeft = window.__jsonTableScroller.scrollWidth; })()`
  )
  await sleep(200)
  scenarios.push(
    await runScenario(
      page,
      send,
      "toggle-checkbox",
      async () => {
        const didClickDisplay = await evaluate(
          send,
          `(() => {
            const displayCell = [...document.querySelectorAll('[data-kind="boolean"][data-mode="display"]')]
              .map((element) => element.closest('[data-json-table-editable-cell="true"]'))
              .find((cell) => {
                if (!cell) return false;
                const rect = cell.getBoundingClientRect();
                return rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
              });
            if (!displayCell) return false;
            const checkbox = displayCell.querySelector('[data-kind="boolean"] [role="checkbox"]');
            if (!checkbox) return null;
            window.__jsonTableCheckboxFieldPath = displayCell.dataset.fieldPath ?? null;
            window.__jsonTableCheckboxBefore = checkbox.getAttribute("aria-checked");
            for (const type of ["pointerover", "pointerenter", "pointermove", "pointerdown"]) {
              displayCell.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                pointerId: 1,
                pointerType: "mouse",
                button: 0,
                buttons: 1,
                view: window
              }));
            }
            displayCell.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, buttons: 1, view: window }));
            displayCell.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0, buttons: 0, view: window }));
            displayCell.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
            return true;
          })()`
        )
        if (!didClickDisplay) throw new Error("No display checkbox found")

        const changed = await waitInPage(send, checkboxChangedExpression, 250)
        if (changed.ok) return

        const activeCheckboxPoint = await evaluate(
          send,
          `(() => {
            const fieldPath = window.__jsonTableCheckboxFieldPath;
            const cell = fieldPath
              ? document.querySelector('[data-field-path="' + CSS.escape(fieldPath) + '"]')
              : document;
            const checkbox = cell?.querySelector('[data-kind="boolean"][data-mode="edit"] [role="checkbox"]');
            if (!checkbox) return false;
            checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
            return true;
          })()`
        )
        if (!activeCheckboxPoint) throw new Error("No active checkbox found")
      },
      checkboxChangedExpression
    )
  )

  const report = {
    measuredAt: new Date().toISOString(),
    route: profileUrl,
    mode: "headless Chrome CDP + json-table render profiler",
    initial,
    scenarios,
  }

  console.log("\nFull JSON report follows.")
  console.log(JSON.stringify(report, null, 2))

  if (outputPath) {
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
    console.error(`Wrote ${outputPath}`)
  }

  page.socket.close()
} finally {
  chrome.kill("SIGTERM")
  await waitForProcessExit(chrome)
  await removeChromeProfile(userDataDir)
}
