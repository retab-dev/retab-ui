// @vitest-environment jsdom

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  type RenderResult,
} from "@testing-library/react";
import type { JSONSchema7 } from "json-schema";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types";
import { createJsonTablePrimitiveEditStore } from "@/components/json-table/json-table-primitive-edit-store";
import { projectDocumentRows } from "@/components/json-table/lib/document-projection";
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes";
import type { TableDocument } from "@/components/json-table/lib/projects-types";
import {
  getFieldMetadata,
  type FieldMetadata,
} from "@/components/json-table/lib/schema-field-metadata";
import { SingleFileVirtualizedTable } from "@/components/json-table/single-file-virtualized-table";

import {
  createTestCellCommitBridge,
  primitiveEventTarget,
} from "./json-table-interaction-test-utils";
import { installJsonTableDom } from "./json-table-test-dom";

beforeAll(() => installJsonTableDom());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    vendor: { type: "string" },
    status: { type: "string", enum: ["draft", "paid"] },
    shipped_at: { type: "string", format: "date" },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          status: { type: "string", enum: ["draft", "paid"] },
          shipped_at: { type: "string", format: "date" },
        },
      },
    },
  },
};

const baseDocument: TableDocument = {
  id: "doc_1",
  data: {
    vendor: "ACME",
    status: "draft",
    shipped_at: "2024-01-02",
  },
};

function requireFieldMetadata(key: string): FieldMetadata {
  const fieldMetadata = getFieldMetadata(schema, key);
  if (!fieldMetadata) throw new Error(`Missing field metadata for ${key}`);
  return fieldMetadata;
}

function visibleColumn(key: string): VisibleColumn {
  return {
    key,
    widthPx: 160,
    fieldMetadata: requireFieldMetadata(key),
  };
}

function headerEffectiveType(fieldMetadata: FieldMetadata) {
  if (fieldMetadata.kind === "string") return "string";
  return fieldMetadata.kind;
}

function headerNode(key: string): JsonTableHeaderNode {
  const fieldMetadata = requireFieldMetadata(key);

  return {
    key,
    label: key,
    propName: key.split(".").at(-1) ?? key,
    parentPath: "",
    rawSchema: fieldMetadata.rawSchema,
    schema: fieldMetadata.schema,
    effectiveType: headerEffectiveType(fieldMetadata),
    isObject: fieldMetadata.kind === "object",
    isArray: fieldMetadata.kind === "array",
    canFold: false,
    isExpanded: true,
  };
}

function renderVirtualTable({
  tableDocument = baseDocument,
  visiblePaths,
  onUpdateDocument = vi.fn(),
  overscan = 12,
  strictMode = false,
}: {
  tableDocument?: TableDocument;
  visiblePaths: string[];
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>;
  overscan?: number;
  strictMode?: boolean;
}) {
  const projectedRows = projectDocumentRows({
    document: tableDocument,
    visiblePaths,
    includeArrayAddRows: false,
  });
  const primitiveEditStore = createJsonTablePrimitiveEditStore();
  const table = (
    <SingleFileVirtualizedTable
      headerNodes={visiblePaths.map(headerNode)}
      document={tableDocument}
      schema={schema}
      setSchema={vi.fn()}
      isPublished={false}
      stopAt={[]}
      setStopAt={vi.fn()}
      draggedItemKeyRef={{ current: null }}
      draggedItemParentPathRef={{ current: null }}
      jsonEditMode="editable"
      schemaEditMode="readOnly"
      projectedRows={projectedRows}
      visibleColumns={visiblePaths.map(visibleColumn)}
      rowCount={projectedRows.length}
      primitiveEditStore={primitiveEditStore}
      {...createTestCellCommitBridge({
        documentData: tableDocument.data,
        onUpdateDocument,
        primitiveEditStore,
      })}
      columnWidth="xxl"
      overscan={overscan}
      jumpOverscan={overscan}
    />
  );

  return render(
    strictMode ? <React.StrictMode>{table}</React.StrictMode> : table,
  );
}

function installSynchronousAnimationFrame() {
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  const previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const previousWindowRequestAnimationFrame = window.requestAnimationFrame;
  const previousWindowCancelAnimationFrame = window.cancelAnimationFrame;

  const requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  };
  const cancelAnimationFrame = vi.fn();

  globalThis.requestAnimationFrame = requestAnimationFrame;
  globalThis.cancelAnimationFrame = cancelAnimationFrame;
  window.requestAnimationFrame = requestAnimationFrame;
  window.cancelAnimationFrame = cancelAnimationFrame;

  return () => {
    globalThis.requestAnimationFrame = previousRequestAnimationFrame;
    globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
    window.requestAnimationFrame = previousWindowRequestAnimationFrame;
    window.cancelAnimationFrame = previousWindowCancelAnimationFrame;
  };
}

async function waitForEditableCells(container: HTMLElement, count: number) {
  await waitFor(() =>
    expect(
      container.querySelectorAll('[data-json-table-editable-cell="true"]'),
    ).toHaveLength(count),
  );
}

function cellByFieldPath(container: HTMLElement, fieldPath: string) {
  const cell = container.querySelector<HTMLElement>(
    `[data-field-path="${fieldPath}"]`,
  );
  if (!cell) throw new Error(`Missing cell ${fieldPath}`);
  return cell;
}

function activeCells(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-active="true"]'),
  );
}

function pickerPopup() {
  return globalThis.document.querySelector(
    '[data-slot="data-cell-picker-popup"]',
  );
}

function scrollViewport(container: HTMLElement) {
  const viewport = container.querySelector<HTMLElement>(
    '[data-slot="json-table-scroll"]',
  );
  if (!viewport) throw new Error("Missing json table viewport");
  return viewport;
}

async function activateCell(view: RenderResult, fieldPath: string) {
  const cell = cellByFieldPath(view.container, fieldPath);
  fireEvent.pointerDown(primitiveEventTarget(cell), {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  });
  return cell;
}

async function activateEnumCell(view: RenderResult, fieldPath: string) {
  const cell = cellByFieldPath(view.container, fieldPath);
  fireEvent.click(primitiveEventTarget(cell), {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  });
  return cell;
}

async function chooseOption(view: RenderResult, optionName: string) {
  const option = await view.findByRole("option", { name: optionName });
  fireEvent.pointerDown(option, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.pointerUp(option, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.click(option);
}

async function clickOutsideWithWindowNode() {
  const previousNode = globalThis.Node;
  Object.assign(globalThis, { Node: window.Node });
  try {
    fireEvent.pointerDown(globalThis.document.body);
  } finally {
    Object.assign(globalThis, { Node: previousNode });
  }
}

describe("json table session and overlay race interactions", () => {
  it("does not duplicate commits or leave a stuck active state when rapidly activating the same enum cell", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined);
    const view = renderVirtualTable({
      visiblePaths: ["status"],
      onUpdateDocument,
    });

    await waitForEditableCells(view.container, 1);
    const statusCell = cellByFieldPath(view.container, "status");

    fireEvent.click(primitiveEventTarget(statusCell), {
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
    });
    expect(await view.findByRole("option", { name: "paid" })).toBeTruthy();
    fireEvent.click(primitiveEventTarget(statusCell), {
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
    });

    await waitFor(() =>
      expect(activeCells(view.container).length).toBeLessThanOrEqual(1),
    );
    expect(onUpdateDocument).not.toHaveBeenCalled();

    if (!view.queryByRole("option", { name: "paid" })) {
      await activateEnumCell(view, "status");
      expect(await view.findByRole("option", { name: "paid" })).toBeTruthy();
    }

    await chooseOption(view, "paid");

    await waitFor(() => expect(onUpdateDocument).toHaveBeenCalledTimes(1));
    expect(onUpdateDocument).toHaveBeenCalledWith({
      data: { ...baseDocument.data, status: "paid" },
    });
    await waitFor(() => expect(activeCells(view.container)).toHaveLength(0));
    expect(view.queryByRole("option", { name: "paid" })).toBeNull();
  });

  it("closes an enum overlay and leaves one active session when switching to a text cell", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined);
    const view = renderVirtualTable({
      visiblePaths: ["status", "vendor"],
      onUpdateDocument,
    });

    await waitForEditableCells(view.container, 2);
    await activateEnumCell(view, "status");

    expect(await view.findByRole("option", { name: "paid" })).toBeTruthy();

    await activateCell(view, "vendor");

    await waitFor(() =>
      expect(view.queryByRole("option", { name: "paid" })).toBeNull(),
    );
    expect(view.getByRole("textbox")).toHaveProperty("value", "ACME");
    expect(activeCells(view.container)).toHaveLength(1);
    expect(cellByFieldPath(view.container, "vendor").dataset.active).toBe(
      "true",
    );
    expect(onUpdateDocument).not.toHaveBeenCalled();
  });

  it("closes a date picker and opens the enum dropdown when switching overlays", async () => {
    const view = renderVirtualTable({
      visiblePaths: ["shipped_at", "status"],
    });

    await waitForEditableCells(view.container, 2);
    await activateCell(view, "shipped_at");

    expect(await view.findByRole("dialog")).toBeTruthy();

    await activateEnumCell(view, "status");

    await waitFor(() => expect(pickerPopup()).toBeNull());
    expect(await view.findByRole("option", { name: "paid" })).toBeTruthy();
    expect(activeCells(view.container)).toHaveLength(1);
    expect(cellByFieldPath(view.container, "status").dataset.active).toBe(
      "true",
    );
  });

  it("keeps a repeatedly opened overlay visibly stable", async () => {
    const view = renderVirtualTable({
      visiblePaths: ["status"],
      strictMode: true,
    });

    await waitForEditableCells(view.container, 1);
    await activateEnumCell(view, "status");

    expect(await view.findByRole("option", { name: "paid" })).toBeTruthy();

    await act(async () => {
      const primitiveEditStore = createJsonTablePrimitiveEditStore();
      await Promise.resolve();
      view.rerender(
        <React.StrictMode>
          <SingleFileVirtualizedTable
            headerNodes={["status"].map(headerNode)}
            document={baseDocument}
            schema={schema}
            setSchema={vi.fn()}
            isPublished={false}
            stopAt={[]}
            setStopAt={vi.fn()}
            draggedItemKeyRef={{ current: null }}
            draggedItemParentPathRef={{ current: null }}
            jsonEditMode="editable"
            schemaEditMode="readOnly"
            projectedRows={projectDocumentRows({
              document: baseDocument,
              visiblePaths: ["status"],
              includeArrayAddRows: false,
            })}
            visibleColumns={["status"].map(visibleColumn)}
            rowCount={1}
            primitiveEditStore={primitiveEditStore}
            {...createTestCellCommitBridge({
              documentData: baseDocument.data,
              onUpdateDocument: vi.fn(),
              primitiveEditStore,
            })}
            columnWidth="xxl"
          />
        </React.StrictMode>,
      );
      await Promise.resolve();
    });

    expect(view.getByRole("combobox").getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(view.getByRole("option", { name: "paid" })).toBeTruthy();
    expect(activeCells(view.container)).toHaveLength(1);
    expect(cellByFieldPath(view.container, "status").dataset.active).toBe(
      "true",
    );
  });

  it("closes an open overlay on outside click without committing", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined);
    const view = renderVirtualTable({
      visiblePaths: ["shipped_at"],
      onUpdateDocument,
    });

    await waitForEditableCells(view.container, 1);
    await activateCell(view, "shipped_at");

    expect(await view.findByRole("dialog")).toBeTruthy();

    await clickOutsideWithWindowNode();

    await waitFor(() => expect(pickerPopup()).toBeNull());
    expect(activeCells(view.container)).toHaveLength(0);
    expect(onUpdateDocument).not.toHaveBeenCalled();
  });

  it("cleans up an active session when the active row is virtualized away", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame();
    const tableDocument: TableDocument = {
      id: "doc_lines",
      data: {
        lines: Array.from({ length: 40 }, (_, index) => ({
          name: `line ${index}`,
          status: "draft",
          shipped_at: "2024-01-02",
        })),
      },
    };
    const view = renderVirtualTable({
      tableDocument,
      visiblePaths: ["lines.*.name", "lines.*.status"],
      overscan: 1,
    });

    try {
      await waitFor(() =>
        expect(cellByFieldPath(view.container, "lines.0.name")).toBeTruthy(),
      );

      await activateCell(view, "lines.0.name");
      expect(view.getByRole("textbox")).toHaveProperty("value", "line 0");
      expect(activeCells(view.container)).toHaveLength(1);

      const viewport = scrollViewport(view.container);
      Object.defineProperty(viewport, "clientHeight", {
        configurable: true,
        value: 64,
      });

      await act(async () => {
        viewport.scrollTop = 32 * 12;
        fireEvent.scroll(viewport);
      });

      await waitFor(() =>
        expect(view.container.querySelector('[data-index="0"]')).toBeNull(),
      );
      expect(activeCells(view.container)).toHaveLength(0);
      expect(view.queryByRole("textbox")).toBeNull();
    } finally {
      restoreAnimationFrame();
    }
  });
});
