// @vitest-environment jsdom
import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  JsonFormSourceLinkProvider,
  SourceLinkShell,
  useSourceLinkedTableCells,
} from "@/components/json-form/source-link";

afterEach(cleanup);

describe("json-form source link", () => {
  it("previews on keyboard focus and selects on Enter without hijacking text input Space", () => {
    const onSourceHover = vi.fn();
    const selectSourcePath = vi.fn();

    render(
      <JsonFormSourceLinkProvider
        sourceLink={{ activeSourcePath: null, onSourceHover, selectSourcePath }}
      >
        <SourceLinkShell sourcePath="customer.name">
          <label>
            Customer
            <input aria-label="Customer" />
          </label>
        </SourceLinkShell>
      </JsonFormSourceLinkProvider>,
    );

    const input = screen.getByLabelText("Customer");
    const shell = input.closest("[data-source-path]");
    expect(shell?.getAttribute("data-source-path")).toBe("customer.name");

    fireEvent.pointerMove(input, { pointerType: "mouse" });
    expect(onSourceHover).toHaveBeenCalledWith("customer.name");
    fireEvent.pointerLeave(shell!);
    expect(onSourceHover).toHaveBeenCalledWith(null);

    onSourceHover.mockClear();
    fireEvent.keyDown(document, { key: "Tab" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: " " });
    fireEvent.blur(input);

    expect(onSourceHover).toHaveBeenCalledWith("customer.name");
    expect(onSourceHover).toHaveBeenCalledWith(null);
    expect(selectSourcePath).toHaveBeenCalledTimes(1);
    expect(selectSourcePath).toHaveBeenCalledWith("customer.name");
  });

  it("does not preview scalar fields on touch pointer movement", () => {
    const onSourceHover = vi.fn();
    const selectSourcePath = vi.fn();

    render(
      <JsonFormSourceLinkProvider
        sourceLink={{ activeSourcePath: null, onSourceHover, selectSourcePath }}
      >
        <SourceLinkShell sourcePath="customer.name">
          <label>
            Customer
            <input aria-label="Customer" />
          </label>
        </SourceLinkShell>
      </JsonFormSourceLinkProvider>,
    );

    fireEvent.pointerMove(screen.getByLabelText("Customer"), {
      pointerType: "touch",
    });

    expect(onSourceHover).not.toHaveBeenCalled();
    expect(selectSourcePath).not.toHaveBeenCalled();
  });

  it("does not preview on programmatic scalar focus", () => {
    const onSourceHover = vi.fn();
    const selectSourcePath = vi.fn();

    render(
      <JsonFormSourceLinkProvider
        sourceLink={{ activeSourcePath: null, onSourceHover, selectSourcePath }}
      >
        <SourceLinkShell sourcePath="customer.name">
          <label>
            Customer
            <input aria-label="Customer" />
          </label>
        </SourceLinkShell>
      </JsonFormSourceLinkProvider>,
    );

    const input = screen.getByLabelText("Customer");
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(onSourceHover).not.toHaveBeenCalled();
    expect(selectSourcePath).not.toHaveBeenCalled();
  });

  it("owns table-cell active state, hover preview, and selection", async () => {
    const onSourceHover = vi.fn();
    const selectSourcePath = vi.fn();

    function TableSourceHarness() {
      const tableRef = React.useRef<HTMLDivElement>(null);
      const sourceTable = useSourceLinkedTableCells({
        tableRef,
        refreshKey: 1,
      });

      return (
        <div
          ref={tableRef}
          onPointerMove={
            sourceTable.sourceLinked ? sourceTable.handlePointerMove : undefined
          }
          onFocus={sourceTable.handleFocus}
          onBlur={sourceTable.handleBlur}
        >
          <button
            type="button"
            data-table-cell=""
            data-source-path="rows.0.value"
            onClick={(event) =>
              sourceTable.selectCellSource(
                sourceTable.getCellFromTarget(event.target),
              )
            }
          >
            Value
          </button>
        </div>
      );
    }

    render(
      <JsonFormSourceLinkProvider
        sourceLink={{
          activeSourcePath: "rows.0.value",
          onSourceHover,
          selectSourcePath,
        }}
      >
        <TableSourceHarness />
      </JsonFormSourceLinkProvider>,
    );

    const cell = screen.getByRole("button", { name: "Value" });
    await waitFor(() =>
      expect(cell.getAttribute("data-source-active")).toBe("true"),
    );

    fireEvent.pointerMove(cell, { clientX: 12, clientY: 16 });
    await waitFor(() =>
      expect(onSourceHover).toHaveBeenCalledWith("rows.0.value"),
    );

    fireEvent.click(cell);
    expect(selectSourcePath).toHaveBeenCalledWith("rows.0.value");

    fireEvent.keyDown(document, { key: "Tab" });
    fireEvent.focus(cell);
    fireEvent.blur(cell);
    expect(onSourceHover).toHaveBeenCalledWith(null);
  });

  it("does not preview on programmatic table-cell focus", async () => {
    const onSourceHover = vi.fn();
    const selectSourcePath = vi.fn();

    function TableSourceHarness() {
      const tableRef = React.useRef<HTMLDivElement>(null);
      const sourceTable = useSourceLinkedTableCells({
        tableRef,
        refreshKey: 3,
      });

      return (
        <div
          ref={tableRef}
          onFocus={sourceTable.handleFocus}
          onBlur={sourceTable.handleBlur}
        >
          <button
            type="button"
            data-table-cell=""
            data-source-path="rows.0.value"
          >
            Value
          </button>
        </div>
      );
    }

    render(
      <JsonFormSourceLinkProvider
        sourceLink={{ activeSourcePath: null, onSourceHover, selectSourcePath }}
      >
        <TableSourceHarness />
      </JsonFormSourceLinkProvider>,
    );

    const cell = screen.getByRole("button", { name: "Value" });
    fireEvent.focus(cell);
    fireEvent.blur(cell);

    await waitFor(() => expect(onSourceHover).not.toHaveBeenCalled());
    expect(selectSourcePath).not.toHaveBeenCalled();
    expect(cell.hasAttribute("data-source-active")).toBe(false);
  });

  it("updates table-cell source hover during scroll without clearing it", async () => {
    const onSourceHover = vi.fn();
    const selectSourcePath = vi.fn();

    function TableSourceHarness() {
      const tableRef = React.useRef<HTMLDivElement>(null);
      const sourceTable = useSourceLinkedTableCells({
        tableRef,
        refreshKey: 2,
      });

      return (
        <div
          ref={tableRef}
          onPointerMove={
            sourceTable.sourceLinked ? sourceTable.handlePointerMove : undefined
          }
          onScroll={() => {
            sourceTable.handleScrollStart();
            sourceTable.handleScrollMove();
          }}
        >
          <button
            type="button"
            data-table-cell=""
            data-source-path="rows.0.value"
          >
            Row 1
          </button>
          <button
            type="button"
            data-table-cell=""
            data-source-path="rows.1.value"
          >
            Row 2
          </button>
        </div>
      );
    }

    render(
      <JsonFormSourceLinkProvider
        sourceLink={{ activeSourcePath: null, onSourceHover, selectSourcePath }}
      >
        <TableSourceHarness />
      </JsonFormSourceLinkProvider>,
    );

    const firstCell = screen.getByRole("button", { name: "Row 1" });
    const secondCell = screen.getByRole("button", { name: "Row 2" });
    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => secondCell),
    });

    try {
      fireEvent.pointerMove(firstCell, { clientX: 12, clientY: 16 });
      await waitFor(() =>
        expect(onSourceHover).toHaveBeenCalledWith("rows.0.value"),
      );

      onSourceHover.mockClear();
      fireEvent.scroll(firstCell.parentElement!);

      await waitFor(() =>
        expect(onSourceHover).toHaveBeenCalledWith("rows.1.value"),
      );
      expect(onSourceHover).not.toHaveBeenCalledWith(null);
    } finally {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: originalElementFromPoint,
      });
    }
  });
});
