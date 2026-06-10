import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const agentEditPlaygroundSource = readFileSync(
  new URL("./agent-edit-playground.tsx", import.meta.url),
  "utf8",
);

describe("Agent edit output viewer", () => {
  test("does not render the edit output subheader copy", () => {
    expect(agentEditPlaygroundSource).not.toContain('"Edit Output"');
    expect(agentEditPlaygroundSource).not.toContain('"No output yet"');
    // The view-tabs subheader was removed entirely; view mode is now driven by
    // `options?.viewMode` from the parent playground, not a local subheader gate.
    expect(agentEditPlaygroundSource).not.toContain(
      "isProcessing || isDetecting || hasViewTabs",
    );
    expect(agentEditPlaygroundSource).not.toContain("hasViewTabs");
  });
});
