import { describe, expect, it } from "vitest";

import {
  ResourceError,
  toViewerErrorInfo,
  ViewerFormatError,
  ViewerStateError,
  ViewerUnsupportedError,
} from "@/registry/new-york-v4/lib/viewer-errors";

describe("toViewerErrorInfo", () => {
  it("projects URL resource failures as retryable transport errors", () => {
    const info = toViewerErrorInfo(
      new ResourceError({
        kind: "http_error",
        message: "Request failed with status 503.",
        status: 503,
      }),
      { format: "pdf", sourceKind: "url" },
    );

    expect(info).toMatchObject({
      domain: "resource",
      format: "pdf",
      kind: "http_error",
      message: "Request failed with status 503.",
      status: 503,
      isRetryable: true,
      isDownloadUseful: true,
      userMessage: "Failed to load file: 503.",
    });
  });

  it("keeps local parse failures non-retryable but downloadable", () => {
    const info = toViewerErrorInfo(
      new ViewerFormatError({
        format: "xlsx",
        kind: "parse_failed",
        message: "Workbook parse failed.",
      }),
      { sourceKind: "blob" },
    );

    expect(info).toMatchObject({
      domain: "format",
      format: "xlsx",
      kind: "parse_failed",
      isRetryable: false,
      isDownloadUseful: true,
      userMessage: "Couldn't parse this spreadsheet.",
    });
  });

  it("maps text bounds failures to the precise bound message", () => {
    const boundsError = new ViewerFormatError({
      format: "text",
      kind: "bounds",
      message: "Text byte limit exceeded.",
    }) as ViewerFormatError & { reason: "bytes" };
    boundsError.reason = "bytes";

    const info = toViewerErrorInfo(boundsError, { sourceKind: "url" });

    expect(info).toMatchObject({
      domain: "format",
      format: "text",
      kind: "bounds",
      isRetryable: false,
      userMessage: "This text file is too large to preview.",
    });
  });

  it("projects viewer state errors separately from resource and format errors", () => {
    const info = toViewerErrorInfo(
      new ViewerStateError({
        format: "image",
        kind: "out_of_range",
        message: "Frame index 5 is outside the image.",
      }),
    );

    expect(info).toMatchObject({
      domain: "state",
      format: "image",
      kind: "out_of_range",
      isRetryable: false,
      userMessage: "The requested item is out of range.",
    });
  });

  it("keeps unsupported sources explicit", () => {
    const info = toViewerErrorInfo(
      new ViewerUnsupportedError({
        format: "file",
        sourceKind: "text",
        message: "Text sources cannot be downloaded.",
      }),
    );

    expect(info).toMatchObject({
      domain: "unsupported",
      format: "file",
      kind: "unsupported",
      isRetryable: false,
      userMessage: "This file cannot be previewed here.",
    });
  });

  it("uses the contextual fallback for unknown viewer failures", () => {
    const info = toViewerErrorInfo(new Error("render exploded"), {
      format: "pptx",
      sourceKind: "url",
    });

    expect(info).toMatchObject({
      domain: "unknown",
      format: "pptx",
      kind: "unknown",
      isRetryable: true,
      userMessage: "Couldn't load this presentation.",
    });
  });

  it("honors explicit retry and download projection policy", () => {
    const info = toViewerErrorInfo(
      new ViewerFormatError({
        format: "docx",
        kind: "render_failed",
        message: "render failed",
      }),
      {
        canDownload: false,
        retry: "never",
        sourceKind: "url",
      },
    );

    expect(info).toMatchObject({
      domain: "format",
      format: "docx",
      kind: "render_failed",
      isRetryable: false,
      isDownloadUseful: false,
    });
  });

  it("treats DOCX Blob render failures as retryable format errors", () => {
    const info = toViewerErrorInfo(
      new ViewerFormatError({
        format: "docx",
        kind: "render_failed",
        message: "render failed",
      }),
      { sourceKind: "blob" },
    );

    expect(info).toMatchObject({
      domain: "format",
      format: "docx",
      kind: "render_failed",
      isRetryable: true,
      userMessage: "Couldn't render this document.",
    });
  });

  it("labels text render failures as render failures", () => {
    const info = toViewerErrorInfo(
      new ViewerFormatError({
        format: "text",
        kind: "render_failed",
        message: "render failed",
      }),
      { sourceKind: "text" },
    );

    expect(info).toMatchObject({
      domain: "format",
      format: "text",
      kind: "render_failed",
      userMessage: "Couldn't render this text file.",
    });
  });

  it("treats unknown DOCX Blob failures as retryable read errors", () => {
    const info = toViewerErrorInfo(new Error("blob read failed"), {
      format: "docx",
      sourceKind: "blob",
    });

    expect(info).toMatchObject({
      domain: "unknown",
      format: "docx",
      kind: "unknown",
      isRetryable: true,
      userMessage: "Couldn't load this document.",
    });
  });

  it("keeps aborted DOCX Blob loads non-retryable", () => {
    const info = toViewerErrorInfo(
      new ResourceError({
        kind: "aborted",
        message: "Loading was cancelled.",
      }),
      { format: "docx", sourceKind: "blob" },
    );

    expect(info).toMatchObject({
      domain: "resource",
      format: "docx",
      kind: "aborted",
      isRetryable: false,
      isDownloadUseful: false,
      userMessage: "Loading was cancelled.",
    });
  });

  it("projects canonical worker failures without parsing messages", () => {
    const info = toViewerErrorInfo(
      new ViewerFormatError({
        format: "csv",
        kind: "worker_failed",
        message: "worker exploded with implementation detail",
      }),
      { sourceKind: "blob" },
    );

    expect(info).toMatchObject({
      domain: "format",
      format: "csv",
      kind: "worker_failed",
      message: "worker exploded with implementation detail",
      isRetryable: false,
      userMessage: "Couldn't parse this table.",
    });
  });

  it("recognizes type-erased error-like objects across module realms", () => {
    const info = toViewerErrorInfo(
      {
        name: "ViewerFormatError",
        domain: "format",
        format: "image",
        kind: "decode_failed",
        message: "decoded elsewhere",
      },
      { sourceKind: "url" },
    );

    expect(info).toMatchObject({
      domain: "format",
      format: "image",
      kind: "decode_failed",
      isRetryable: true,
      userMessage: "Couldn't decode this image.",
    });
  });
});
