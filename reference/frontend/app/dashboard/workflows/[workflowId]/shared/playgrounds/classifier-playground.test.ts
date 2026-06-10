import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const source = readFileSync(
  new URL("./classifier-playground.tsx", import.meta.url),
  "utf8",
);

describe("ClassifierPlayground source", () => {
  test("uses a large flex classification category editor dialog", () => {
    expect(source).toContain(
      "flex h-[90vh] max-h-[90vh] flex-col overflow-hidden sm:max-w-6xl",
    );
    expect(source).toContain(
      'div className="flex min-h-0 flex-1 flex-col overflow-hidden"',
    );
    expect(source).toContain('height="100%"');
  });
});
