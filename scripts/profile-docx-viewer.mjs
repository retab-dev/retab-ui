import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { chromium } from "@playwright/test"

const profileUrl =
  process.env.PROFILE_URL ?? "http://localhost:3100/scrollbench?viewer=docx"
const outputPath = process.env.PROFILE_OUTPUT
const viewportWidth = Number(process.env.PROFILE_VIEWPORT_WIDTH ?? 1440)
const viewportHeight = Number(process.env.PROFILE_VIEWPORT_HEIGHT ?? 900)

async function performanceMetrics(cdp) {
  const raw = await cdp.send("Performance.getMetrics")
  return Object.fromEntries(
    raw.metrics.map((metric) => [metric.name, metric.value])
  )
}

function metricDelta(before, after) {
  return {
    JSHeapUsedSize: after.JSHeapUsedSize,
    Nodes: after.Nodes,
    LayoutCount: delta(before, after, "LayoutCount"),
    RecalcStyleCount: delta(before, after, "RecalcStyleCount"),
    LayoutDurationMs: delta(before, after, "LayoutDuration") * 1000,
    RecalcStyleDurationMs: delta(before, after, "RecalcStyleDuration") * 1000,
    ScriptDurationMs: delta(before, after, "ScriptDuration") * 1000,
    TaskDurationMs: delta(before, after, "TaskDuration") * 1000,
  }
}

function delta(before, after, key) {
  return (after[key] ?? 0) - (before[key] ?? 0)
}

async function runScenario(page, cdp, scenarioId) {
  const before = await performanceMetrics(cdp)
  const result = await page.evaluate(
    (id) => window.__scrollbench.runScenario(id),
    scenarioId
  )
  const after = await performanceMetrics(cdp)
  return {
    id: scenarioId,
    result,
    metricsDelta: metricDelta(before, after),
  }
}

async function writeReport(report) {
  const json = `${JSON.stringify(report, null, 2)}\n`
  if (!outputPath) {
    process.stdout.write(json)
    return
  }
  const absoluteOutputPath = resolve(outputPath)
  await mkdir(dirname(absoluteOutputPath), { recursive: true })
  await writeFile(absoluteOutputPath, json)
  process.stdout.write(`${absoluteOutputPath}\n`)
}

const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor: 1,
  })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Performance.enable")

  await page.addInitScript(() => {
    const original = Element.prototype.getBoundingClientRect
    window.__docxProfile = {
      rectReads: { total: 0, docxPages: 0 },
      readyAt: null,
    }
    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      window.__docxProfile.rectReads.total += 1
      if (
        this.matches?.('[data-slot="docx-viewer"] .docx-wrapper > section.docx')
      ) {
        window.__docxProfile.rectReads.docxPages += 1
      }
      return original.apply(this, arguments)
    }
  })

  const startedAt = Date.now()
  await page.goto(profileUrl, { waitUntil: "load" })
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        '[data-slot="docx-viewer"] .docx-wrapper > section.docx'
      ).length > 0,
    { timeout: 30_000 }
  )
  await page.evaluate(() => {
    window.__docxProfile.readyAt = Math.round(performance.now())
  })
  await page.waitForTimeout(250)

  const initialMetrics = await performanceMetrics(cdp)
  const initial = await page.evaluate((startedAt) => {
    const scroller = window.__scrollbench.getScroller()
    const navigation = performance.getEntriesByType("navigation")[0]
    const resources = performance
      .getEntriesByType("resource")
      .filter(
        (entry) =>
          entry.name.includes("docx") ||
          entry.name.includes("quarterly-business-review")
      )
      .map((entry) => ({
        name: entry.name.replace(location.origin, ""),
        initiatorType: entry.initiatorType,
        startTime: Math.round(entry.startTime),
        responseEnd: Math.round(entry.responseEnd),
        duration: Math.round(entry.duration),
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
      }))
    const wrapper = document.querySelector(
      '[data-slot="docx-viewer"] .docx-wrapper'
    )
    const pages = [
      ...document.querySelectorAll(
        '[data-slot="docx-viewer"] .docx-wrapper > section.docx'
      ),
    ]

    return {
      elapsedWallMs: Date.now() - startedAt,
      readyAtMs: window.__docxProfile.readyAt,
      navigation: navigation
        ? {
            responseEnd: Math.round(navigation.responseEnd),
            domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
            load: Math.round(navigation.loadEventEnd),
            transferSize: navigation.transferSize,
            encodedBodySize: navigation.encodedBodySize,
          }
        : null,
      resources,
      scroll: {
        scrollTop: scroller.scrollTop,
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
        maxScrollTop: scroller.scrollHeight - scroller.clientHeight,
      },
      docx: {
        pages: pages.length,
        wrapperNodes: wrapper?.querySelectorAll("*").length ?? 0,
        totalElements: document.getElementsByTagName("*").length,
        textLength: wrapper?.textContent?.length ?? 0,
      },
      rectReads: window.__docxProfile.rectReads,
    }
  }, startedAt)

  const scenarios = [
    await runScenario(page, cdp, "small"),
    await runScenario(page, cdp, "large"),
  ]

  await writeReport({
    measuredAt: new Date().toISOString(),
    route: profileUrl,
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
    },
    mode: "headless Chromium + ScrollBench DOCX profiler",
    initial,
    performanceMetrics: initialMetrics,
    scenarios,
  })
} finally {
  await browser.close()
}
