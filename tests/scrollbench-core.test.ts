import { describe, expect, it } from "vitest"

import {
  buildScrollTargets,
  DEFAULT_VIEWER,
  getScenarioStepPx,
  measuredScrollDistance,
  normalizeViewerId,
  SCENARIOS,
  summarizeFrameDurations,
} from "@/app/(view)/scrollbench/scrollbench-core"

describe("scrollbench core", () => {
  it("normalizes viewer ids", () => {
    expect(normalizeViewerId("csv")).toBe("csv")
    expect(normalizeViewerId("image")).toBe("image")
    expect(normalizeViewerId("missing")).toBe(DEFAULT_VIEWER)
    expect(normalizeViewerId(null)).toBe(DEFAULT_VIEWER)
  })

  it("resolves scenario steps from viewport height", () => {
    const small = SCENARIOS.find((scenario) => scenario.id === "small")
    const large = SCENARIOS.find((scenario) => scenario.id === "large")

    expect(small).toBeDefined()
    expect(large).toBeDefined()
    expect(getScenarioStepPx({ clientHeight: 640, scenario: small! })).toBe(64)
    expect(getScenarioStepPx({ clientHeight: 640, scenario: large! })).toBe(576)
    expect(getScenarioStepPx({ clientHeight: 10, scenario: small! })).toBe(16)
  })

  it("keeps scenario steps finite for malformed viewport heights", () => {
    const small = SCENARIOS[0]

    expect(
      getScenarioStepPx({ clientHeight: Number.NaN, scenario: small })
    ).toBe(16)
    expect(
      getScenarioStepPx({
        clientHeight: Number.POSITIVE_INFINITY,
        scenario: small,
      })
    ).toBe(16)
    expect(getScenarioStepPx({ clientHeight: -100, scenario: small })).toBe(16)
  })

  it("builds bounded bouncing targets for shallow scrollports", () => {
    const targets = buildScrollTargets({
      maxScrollTop: 461,
      stepPx: 568,
      frameCount: 8,
    })

    expect(targets).toEqual([354, 214, 140, 428, 74, 280, 288, 66])
    expect(new Set(targets).size).toBeGreaterThan(1)
    expect(targets.every((target) => target >= 0 && target <= 461)).toBe(true)
  })

  it("returns no scroll targets for malformed scroll geometry", () => {
    expect(
      buildScrollTargets({
        maxScrollTop: Number.NaN,
        stepPx: 16,
        frameCount: 8,
      })
    ).toEqual([])
    expect(
      buildScrollTargets({
        maxScrollTop: 400,
        stepPx: Number.POSITIVE_INFINITY,
        frameCount: 8,
      })
    ).toEqual([])
    expect(
      buildScrollTargets({
        maxScrollTop: 400,
        stepPx: 16,
        frameCount: 2.5,
      })
    ).toEqual([16, 32])
  })

  it("reports measured path distance", () => {
    expect(measuredScrollDistance([100, 200, 50])).toBe(350)
  })

  it("ignores malformed targets when reporting measured path distance", () => {
    expect(
      measuredScrollDistance([100, Number.NaN, 200, Number.POSITIVE_INFINITY, 50])
    ).toBe(350)
  })

  it("summarizes frame durations into fps and frame budget counts", () => {
    const scenario = SCENARIOS[0]
    const result = summarizeFrameDurations({
      scenario,
      frameDurations: [10, 20, 40, 30],
      stepPx: 64,
      distancePx: 256,
    })

    expect(result.fps).toBe(40)
    expect(result.averageFrameMs).toBe(25)
    expect(result.p50FrameMs).toBe(20)
    expect(result.p95FrameMs).toBe(30)
    expect(result.maxFrameMs).toBe(40)
    expect(result.over16).toBe(3)
    expect(result.over33).toBe(1)
    expect(result.frames).toBe(4)
  })

  it("summarizes only finite positive frame durations", () => {
    const scenario = SCENARIOS[0]
    const result = summarizeFrameDurations({
      scenario,
      frameDurations: [10, Number.NaN, -5, 20, Number.POSITIVE_INFINITY],
      stepPx: Number.NaN,
      distancePx: Number.POSITIVE_INFINITY,
    })

    expect(result.fps).toBeCloseTo(66.6666666667)
    expect(result.averageFrameMs).toBe(15)
    expect(result.p50FrameMs).toBe(10)
    expect(result.p95FrameMs).toBe(10)
    expect(result.maxFrameMs).toBe(20)
    expect(result.frames).toBe(2)
    expect(result.stepPx).toBe(0)
    expect(result.distancePx).toBe(0)
  })
})
