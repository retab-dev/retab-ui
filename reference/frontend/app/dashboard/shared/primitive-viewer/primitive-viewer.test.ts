import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const primitiveViewerSource = readFileSync(
  new URL("./primitive-viewer.tsx", import.meta.url),
  "utf8",
);

describe("shared primitive viewer system", () => {
  test("exports the shell, header, body, and download action contract", () => {
    expect(primitiveViewerSource).toContain(
      "export interface PrimitiveViewerDownloadAction",
    );
    expect(primitiveViewerSource).toContain(
      "export function PrimitiveViewerShell",
    );
    expect(primitiveViewerSource).toContain(
      "export function PrimitiveViewerHeader",
    );
    expect(primitiveViewerSource).toContain(
      "export function PrimitiveViewerBody",
    );
  });

  test("defines metadata for every primitive operation", () => {
    expect(primitiveViewerSource).toContain(
      "export const PRIMITIVE_OPERATION_METADATA",
    );
    for (const operation of [
      "extract",
      "parse",
      "edit",
      "split",
      "classify",
      "partition",
    ]) {
      expect(primitiveViewerSource).toContain(`${operation}: {`);
    }
    for (const label of [
      "Extract",
      "Parse",
      "Edit",
      "Split",
      "Classify",
      "Partition",
    ]) {
      expect(primitiveViewerSource).toContain(`label: "${label}"`);
    }
    for (const color of [
      "#8b5cf6",
      "#06b6d4",
      "#10b981",
      "#f59e0b",
      "#14b8a6",
      "#6366f1",
    ]) {
      expect(primitiveViewerSource).toContain(`color: "${color}"`);
    }
    expect(primitiveViewerSource).toContain(
      "style={{ color: metadata.color }}",
    );
  });

  test("renders an ellipsis action menu for downloads", () => {
    expect(primitiveViewerSource).toContain("<MoreHorizontal");
    expect(primitiveViewerSource).toContain("Open primitive viewer actions");
    expect(primitiveViewerSource).toContain("<DropdownMenu");
    expect(primitiveViewerSource).toContain("Downloads");
    expect(primitiveViewerSource).toContain("action.run()");
  });

  test("uses the compact run-details header spacing", () => {
    expect(primitiveViewerSource).toContain(
      "flex h-[39px] flex-shrink-0 items-center border-b border-gray-200 bg-white pr-1 pl-4",
    );
  });

  test("provides file, JSON, and Markdown download helpers", () => {
    expect(primitiveViewerSource).toContain("export function downloadBuffer");
    expect(primitiveViewerSource).toContain("export function downloadJson");
    expect(primitiveViewerSource).toContain("export function downloadMarkdown");
    expect(primitiveViewerSource).toContain(
      "export function buildMarkdownFromPages",
    );
  });
});
