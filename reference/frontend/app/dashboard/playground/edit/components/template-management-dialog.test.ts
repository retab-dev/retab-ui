import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const source = readFileSync(
  new URL("./template-management-dialog.tsx", import.meta.url),
  "utf8",
);

describe("TemplateManagementDialog source", () => {
  test("resets dialog state by remounting content instead of syncing from open with useEffect", () => {
    expect(source).toContain("function TemplateManagementDialogContent(");
    expect(source).toContain("{open ? (");
    expect(source).toContain("<TemplateManagementDialogContent");
    expect(source).not.toContain("useEffect(() => {\n        if (open) {");
  });
});
