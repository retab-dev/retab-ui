// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FileViewerTelemetryWidget } from "@/components/file-viewer-telemetry-widget";

describe("FileViewerTelemetryWidget", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows rejected telemetry runs as panel errors", async () => {
    const runShellMotion = vi
      .fn()
      .mockRejectedValue(new Error("sampler exploded"));

    vi.stubGlobal("__pdfViewerTelemetry", { runShellMotion });

    render(<FileViewerTelemetryWidget />);

    fireEvent.click(screen.getByRole("button", { name: "Telemetry" }));

    expect(runShellMotion).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Telemetry unavailable")).toBeTruthy();
    expect(
      screen.getByText("Telemetry run failed: sampler exploded"),
    ).toBeTruthy();
  });
});
