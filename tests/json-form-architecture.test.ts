import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function fileContent(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("json-form architecture", () => {
  it("keeps array table implementation details out of the table shell", () => {
    expect(
      existsSync(join(repoRoot, "components/json-form/array-table.tsx")),
    ).toBe(false);

    const tableShell = fileContent(
      "components/json-form/table/array-table.tsx",
    );
    const forbiddenShellDetails = [
      "useWatch",
      "useController",
      "DataCell",
      "ScalarControl",
      "useArrayTableScrollActivity",
      "function ArrayTableCellEditor",
      "function formatTableCellValue",
      "TABLE_MAX_HEIGHT",
    ];

    for (const forbidden of forbiddenShellDetails) {
      expect(
        tableShell,
        `array-table shell must not contain ${forbidden}`,
      ).not.toContain(forbidden);
    }

    expect(tableShell).toContain("ArrayTableRow");
    expect(tableShell).toContain("StaticArrayTableBody");
    expect(tableShell).toContain("FixedArrayTableBody");
  });

  it("keeps table-cell commit and prop policy out of the cell renderer", () => {
    const cellRenderer = fileContent(
      "components/json-form/table/array-table-cell.tsx",
    );
    const tableRow = fileContent(
      "components/json-form/table/array-table-row.tsx",
    );

    expect(cellRenderer).toContain("ArrayTableCell");
    expect(cellRenderer).toContain("commitArrayTableCellValue");
    expect(tableRow).toContain("createArrayTableCellModel");
    expect(cellRenderer).not.toContain("const NO_CELL_COMMIT");
    expect(cellRenderer).not.toContain("NO_ARRAY_TABLE_CELL_COMMIT");
    expect(cellRenderer).not.toContain("function normalizeArrayTableCellValue");
    expect(cellRenderer).not.toContain("function editableCellProps");
    expect(cellRenderer).not.toContain("shouldDirty: true");
    expect(tableRow).not.toContain("labelFor(");
    expect(tableRow).not.toContain("formatArrayTableCellValue");
    expect(tableRow).not.toContain("dataCellKindForColumn");
    expect(
      existsSync(
        join(repoRoot, "components/json-form/table/array-table-cell-commit.ts"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(repoRoot, "components/json-form/table/array-table-cell-props.ts"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          repoRoot,
          "components/json-form/table/array-table-data-cell-props.ts",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(repoRoot, "components/json-form/table/array-table-cell-model.ts"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          repoRoot,
          "components/json-form/table/array-table-active-cell-store.ts",
        ),
      ),
    ).toBe(true);
  });

  it("keeps table hover internals out while scalar source shells own stable source attrs", () => {
    const sourceLink = fileContent("components/json-form/source-link.tsx");

    expect(sourceLink).toContain("useSourceTableHoverController");
    expect(sourceLink).toContain("data-source-active");
    expect(sourceLink).toContain("data-source-path");
    expect(sourceLink).toContain("shouldPreviewSourceFromPointerMove");
    expect(sourceLink).not.toContain("elementFromPoint");
    expect(sourceLink).not.toContain("requestAnimationFrame");
    expect(sourceLink).not.toContain("hoverStateRef");
    expect(
      existsSync(
        join(repoRoot, "components/json-form/source-link-table-hover.ts"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(repoRoot, "components/json-form/source-link-focus-intent.ts"),
      ),
    ).toBe(true);
  });

  it("keeps scalar-control as a dispatcher over scalar families", () => {
    const scalarControl = fileContent(
      "components/json-form/scalar-control.tsx",
    );
    const familyFiles = [
      "components/json-form/scalar/boolean-control.tsx",
      "components/json-form/scalar/date-time-control.tsx",
      "components/json-form/scalar/enum-control.tsx",
      "components/json-form/scalar/number-control.tsx",
      "components/json-form/scalar/text-control.tsx",
    ];

    for (const familyFile of familyFiles) {
      expect(
        existsSync(join(repoRoot, familyFile)),
        `${familyFile} exists`,
      ).toBe(true);
    }

    expect(scalarControl).not.toContain("Popover");
    expect(scalarControl).not.toContain("Calendar");
    expect(scalarControl).not.toContain("Textarea");
    expect(scalarControl).not.toContain("parseDataCellNumberInput");
    expect(scalarControl).not.toContain("SelectContent");
    expect(scalarControl).toContain("export function ScalarControl");
  });
});
