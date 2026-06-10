import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const classifierSource = readFileSync(
  new URL("./classifier-playground.tsx", import.meta.url),
  "utf8",
);

describe("ClassifierResultViewer chrome", () => {
  test("floats the classification badge without a separate white toolbar", () => {
    expect(classifierSource).toContain(
      "export function ClassifierResultViewer({",
    );
    expect(classifierSource).toMatch(
      /absolute (?=[^"]*left-4)(?=[^"]*top-4)(?=[^"]*z-20)/,
    );
    expect(classifierSource).toContain(
      '<span className="truncate">{classification}</span>',
    );
    expect(classifierSource).not.toContain("h-[39px] border-b border-gray-200");
    expect(classifierSource).not.toContain(
      '<h3 className="text-xs font-semibold text-gray-900">Classification</h3>',
    );
    expect(classifierSource).not.toContain("Document classified");
    expect(classifierSource).not.toContain("Result copied to clipboard");
    expect(classifierSource).not.toContain("Document downloaded");
    expect(classifierSource).not.toContain(
      "const handleDownload = useCallback",
    );
    expect(classifierSource).not.toContain("const [copied, setCopied]");
  });
});
