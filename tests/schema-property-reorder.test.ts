import { describe, expect, it } from "vitest"

import {
  getPropertyDropClasses,
  getPropertyDropIndicator,
  getPropertyDropTargetIndex,
} from "@/components/schema-editor/document-property-reorder"

describe("document property reorder helpers", () => {
  const propertyIds = ["prop_a", "prop_b", "prop_c"]

  it("returns before when the source is after the target", () => {
    expect(
      getPropertyDropIndicator({
        propertyIds,
        sourcePropertyId: "prop_c",
        targetPropertyId: "prop_a",
      })
    ).toBe("before")
  })

  it("returns after when the source is before the target", () => {
    expect(
      getPropertyDropIndicator({
        propertyIds,
        sourcePropertyId: "prop_a",
        targetPropertyId: "prop_c",
      })
    ).toBe("after")
  })

  it("returns null for same, missing, or unknown source", () => {
    expect(
      getPropertyDropIndicator({
        propertyIds,
        sourcePropertyId: "prop_b",
        targetPropertyId: "prop_b",
      })
    ).toBeNull()
    expect(
      getPropertyDropIndicator({
        propertyIds,
        sourcePropertyId: null,
        targetPropertyId: "prop_b",
      })
    ).toBeNull()
    expect(
      getPropertyDropIndicator({
        propertyIds,
        sourcePropertyId: "prop_x",
        targetPropertyId: "prop_b",
      })
    ).toBeNull()
  })

  it("maps indicators to stable CSS classes", () => {
    expect(getPropertyDropClasses("before")).toEqual([
      "border-t-2",
      "border-grey-700",
      "border-dashed",
    ])
    expect(getPropertyDropClasses("after")).toEqual([
      "border-b-2",
      "border-grey-700",
      "border-dashed",
    ])
    expect(getPropertyDropClasses(null)).toEqual([])
  })

  it("resolves target index by property id", () => {
    expect(
      getPropertyDropTargetIndex({
        propertyIds,
        targetPropertyId: "prop_b",
      })
    ).toBe(1)
  })
})
