import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const source = readFileSync(
  new URL("./partition-playground.tsx", import.meta.url),
  "utf8",
);

describe("PartitionOutputViewer source", () => {
  test("exports a viewer wrapper around the partition output renderer", () => {
    expect(source).toContain("export function PartitionOutputViewer");
    expect(source).toContain("PartitionOutputRenderer(result, inputStates");
    expect(source).toContain("fileBuffer: fileBuffer ?? null");
    expect(source).toContain('fileName: fileName ?? "document"');
  });
});
