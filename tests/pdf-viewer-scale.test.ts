import { describe, expect, it } from "vitest"

import {
  clampPdfScale,
  getPdfFitWidthScale,
  MAX_PDF_SCALE,
  MIN_PDF_SCALE,
  PDF_PAGE_HORIZONTAL_PADDING,
} from "@/registry/new-york-v4/ui/pdf-viewer-scale"

describe("pdf-viewer-scale", () => {
  it("clamps explicit scale values to the viewer bounds", () => {
    expect(clampPdfScale(0)).toBe(MIN_PDF_SCALE)
    expect(clampPdfScale(10)).toBe(MAX_PDF_SCALE)
    expect(clampPdfScale(Number.NaN)).toBe(1)
  })

  it("clamps fit-width scale with the same policy as manual zoom", () => {
    expect(getPdfFitWidthScale(0, 100)).toBe(1)
    expect(getPdfFitWidthScale(PDF_PAGE_HORIZONTAL_PADDING - 1, 100)).toBe(
      MIN_PDF_SCALE
    )
    expect(getPdfFitWidthScale(10000, 100)).toBe(MAX_PDF_SCALE)
  })
})
