import { describe, expect, it } from "vitest"

import {
  ResourceError,
  toViewerErrorInfo,
  ViewerFormatError,
  ViewerStateError,
  ViewerUnsupportedError,
} from "@/registry/new-york-v4/lib/viewer-errors"

describe("toViewerErrorInfo", () => {
  it("projects URL resource failures as retryable transport errors", () => {
    const info = toViewerErrorInfo(
      new ResourceError({
        kind: "http_error",
        message: "Request failed with status 503.",
        status: 503,
      }),
      { format: "pdf", sourceKind: "url" }
    )

    expect(info).toMatchObject({
      domain: "resource",
      format: "pdf",
      kind: "http_error",
      message: "Request failed with status 503.",
      status: 503,
      isRetryable: true,
      isDownloadUseful: true,
      userMessage: "Failed to load file: 503.",
    })
  })

  it("keeps local parse failures non-retryable but downloadable", () => {
    const info = toViewerErrorInfo(
      new ViewerFormatError({
        format: "xlsx",
        kind: "parse_failed",
        message: "Workbook parse failed.",
      }),
      { sourceKind: "blob" }
    )

    expect(info).toMatchObject({
      domain: "format",
      format: "xlsx",
      kind: "parse_failed",
      isRetryable: false,
      isDownloadUseful: true,
      userMessage: "Couldn't parse this spreadsheet.",
    })
  })

  it("maps text bounds failures to the precise bound message", () => {
    const boundsError = new ViewerFormatError({
      format: "text",
      kind: "bounds",
      message: "Text byte limit exceeded.",
    }) as ViewerFormatError & { reason: "bytes" }
    boundsError.reason = "bytes"

    const info = toViewerErrorInfo(boundsError, { sourceKind: "url" })

    expect(info).toMatchObject({
      domain: "format",
      format: "text",
      kind: "bounds",
      isRetryable: false,
      userMessage: "This text file is too large to preview.",
    })
  })

  it("projects viewer state errors separately from resource and format errors", () => {
    const info = toViewerErrorInfo(
      new ViewerStateError({
        format: "image",
        kind: "out_of_range",
        message: "Frame index 5 is outside the image.",
      })
    )

    expect(info).toMatchObject({
      domain: "state",
      format: "image",
      kind: "out_of_range",
      isRetryable: false,
      userMessage: "The requested item is out of range.",
    })
  })

  it("keeps unsupported sources explicit", () => {
    const info = toViewerErrorInfo(
      new ViewerUnsupportedError({
        format: "file",
        sourceKind: "text",
        message: "Text sources cannot be downloaded.",
      })
    )

    expect(info).toMatchObject({
      domain: "unsupported",
      format: "file",
      kind: "unsupported",
      isRetryable: false,
      userMessage: "This file cannot be previewed here.",
    })
  })

  it("uses the contextual fallback for unknown viewer failures", () => {
    const info = toViewerErrorInfo(new Error("render exploded"), {
      format: "pptx",
      sourceKind: "url",
    })

    expect(info).toMatchObject({
      domain: "unknown",
      format: "pptx",
      kind: "unknown",
      isRetryable: true,
      userMessage: "Couldn't load this presentation.",
    })
  })
})
