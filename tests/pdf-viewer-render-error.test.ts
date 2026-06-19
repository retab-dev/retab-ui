import { describe, expect, it } from "vitest";

import { ViewerFormatError } from "@/registry/new-york-v4/lib/viewer-errors";
import { toPdfRenderFailedError } from "@/registry/new-york-v4/ui/pdf-viewer-render-error";

describe("toPdfRenderFailedError", () => {
  it("wraps an arbitrary cause in a pdf render_failed format error", () => {
    const cause = new Error("canvas exploded");
    const error = toPdfRenderFailedError(cause);

    expect(error).toBeInstanceOf(ViewerFormatError);
    expect(error.format).toBe("pdf");
    expect(error.kind).toBe("render_failed");
    expect(error.message).toBe("Failed to render PDF page.");
    expect(error.cause).toBe(cause);
  });

  it("preserves non-error causes verbatim", () => {
    expect(toPdfRenderFailedError("string failure").cause).toBe(
      "string failure",
    );
    expect(toPdfRenderFailedError(undefined).cause).toBeUndefined();
    expect(toPdfRenderFailedError(null).cause).toBeNull();
  });

  it("does not unwrap an already-wrapped format error (always re-wraps)", () => {
    const inner = new ViewerFormatError({
      format: "pdf",
      kind: "parse_failed",
      message: "original",
      cause: "root",
    });
    const error = toPdfRenderFailedError(inner);

    // Render errors are intentionally always classified render_failed, with the
    // prior error retained as the cause chain.
    expect(error.kind).toBe("render_failed");
    expect(error.cause).toBe(inner);
  });
});
