/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

// @vitest-environment jsdom

// Tests for the docx source adapter (registry/new-york-v4/ui/docx-source.tsx),
// which had no dedicated coverage. It turns a backend `Source` anchor into the
// viewer-ready `DocxTarget`, validating indices/ranges defensively. These probe
// the validation boundaries (negative/float indices, partial/inverted char
// ranges, empty content) plus the imperative scroll hook.

import * as React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Source, SourceAnchor } from "@/lib/document-source";
import {
  docxAnchorToTarget,
  sourceToDocxHighlight,
  useDocxSourceTarget,
} from "@/registry/new-york-v4/ui/docx-source";
import type { DocxViewerHandle } from "@/registry/new-york-v4/ui/docx-viewer";

afterEach(() => {
  cleanup();
});

function source(
  anchor: SourceAnchor,
  content = "Quarterly revenue increased",
): Source {
  return { content, anchor };
}

function textSpan(
  overrides: Partial<
    Omit<SourceAnchor & { kind: "docx_text_span" }, "kind">
  > = {},
): SourceAnchor {
  return { kind: "docx_text_span", paragraph: 3, ...overrides };
}

function tableCell(
  overrides: Partial<
    Omit<SourceAnchor & { kind: "docx_table_cell" }, "kind">
  > = {},
): SourceAnchor {
  return { kind: "docx_table_cell", table: 0, row: 1, column: 2, ...overrides };
}

describe("docxAnchorToTarget - non-docx and missing anchors", () => {
  it("returns null for an undefined anchor", () => {
    expect(docxAnchorToTarget(undefined)).toBeNull();
  });

  it("returns null for non-docx anchors", () => {
    const anchors: SourceAnchor[] = [
      { kind: "pdf_bbox", page: 1, left: 0, top: 0, width: 0.5, height: 0.5 },
      { kind: "image_bbox", left: 0, top: 0, width: 0.5, height: 0.5 },
      { kind: "csv_cell", row: 1, column: "A" },
      { kind: "spreadsheet_cell", row: 1, column: "A", sheet_index: 0 },
      { kind: "text_span", line_start: 1, line_end: 2 },
    ];
    for (const anchor of anchors) {
      expect(docxAnchorToTarget(anchor, source(anchor))).toBeNull();
    }
  });
});

describe("docxAnchorToTarget - docx_text_span", () => {
  it("resolves a valid text span to a trimmed text target", () => {
    const input = source(textSpan(), "  Quarterly revenue increased  ");
    expect(docxAnchorToTarget(input.anchor, input)).toEqual({
      kind: "text",
      text: "Quarterly revenue increased",
    });
  });

  it("accepts paragraph index 0", () => {
    const input = source(textSpan({ paragraph: 0 }));
    expect(docxAnchorToTarget(input.anchor, input)).toEqual({
      kind: "text",
      text: "Quarterly revenue increased",
    });
  });

  it("returns null when the quoted content is empty or whitespace-only", () => {
    const empty = source(textSpan(), "");
    const whitespace = source(textSpan(), "   \n\t ");
    expect(docxAnchorToTarget(empty.anchor, empty)).toBeNull();
    expect(docxAnchorToTarget(whitespace.anchor, whitespace)).toBeNull();
  });

  it("rejects a negative or non-integer paragraph index", () => {
    const negative = source(textSpan({ paragraph: -1 }));
    const float = source(textSpan({ paragraph: 1.5 }));
    const nan = source(textSpan({ paragraph: Number.NaN }));
    expect(docxAnchorToTarget(negative.anchor, negative)).toBeNull();
    expect(docxAnchorToTarget(float.anchor, float)).toBeNull();
    expect(docxAnchorToTarget(nan.anchor, nan)).toBeNull();
  });

  it("accepts a valid char range and an equal start/end range", () => {
    const range = source(textSpan({ char_start: 0, char_end: 10 }));
    const equalRange = source(textSpan({ char_start: 5, char_end: 5 }));
    expect(docxAnchorToTarget(range.anchor, range)).toEqual({
      kind: "text",
      text: "Quarterly revenue increased",
    });
    expect(docxAnchorToTarget(equalRange.anchor, equalRange)).toEqual({
      kind: "text",
      text: "Quarterly revenue increased",
    });
  });

  it("accepts a span with no char range", () => {
    const input = source(textSpan({}));
    expect(docxAnchorToTarget(input.anchor, input)).toEqual({
      kind: "text",
      text: "Quarterly revenue increased",
    });
  });

  it("rejects a partial char range (only one bound present)", () => {
    const startOnly = source(textSpan({ char_start: 3 }));
    const endOnly = source(textSpan({ char_end: 3 }));
    expect(docxAnchorToTarget(startOnly.anchor, startOnly)).toBeNull();
    expect(docxAnchorToTarget(endOnly.anchor, endOnly)).toBeNull();
  });

  it("rejects an inverted or negative char range", () => {
    const inverted = source(textSpan({ char_start: 8, char_end: 4 }));
    const negative = source(textSpan({ char_start: -1, char_end: 4 }));
    const float = source(textSpan({ char_start: 1.5, char_end: 4 }));
    expect(docxAnchorToTarget(inverted.anchor, inverted)).toBeNull();
    expect(docxAnchorToTarget(negative.anchor, negative)).toBeNull();
    expect(docxAnchorToTarget(float.anchor, float)).toBeNull();
  });
});

describe("docxAnchorToTarget - docx_table_cell", () => {
  it("resolves a valid table cell to a cell target", () => {
    const input = source(tableCell());
    expect(docxAnchorToTarget(input.anchor, input)).toEqual({
      kind: "cell",
      table: 0,
      row: 1,
      column: 2,
    });
  });

  it("resolves a cell target regardless of content (cells locate by index)", () => {
    const input = source(tableCell(), "");
    expect(docxAnchorToTarget(input.anchor, input)).toEqual({
      kind: "cell",
      table: 0,
      row: 1,
      column: 2,
    });
  });

  it("rejects negative or non-integer table/row/column indices", () => {
    const badTable = source(tableCell({ table: -1 }));
    const badRow = source(tableCell({ row: -1 }));
    const badColumn = source(tableCell({ column: -1 }));
    const floatColumn = source(tableCell({ column: 1.5 }));
    const nanTable = source(tableCell({ table: Number.NaN }));
    expect(docxAnchorToTarget(badTable.anchor, badTable)).toBeNull();
    expect(docxAnchorToTarget(badRow.anchor, badRow)).toBeNull();
    expect(docxAnchorToTarget(badColumn.anchor, badColumn)).toBeNull();
    expect(docxAnchorToTarget(floatColumn.anchor, floatColumn)).toBeNull();
    expect(docxAnchorToTarget(nanTable.anchor, nanTable)).toBeNull();
  });

  it("rejects an invalid char range on a cell anchor", () => {
    const inverted = source(tableCell({ char_start: 5, char_end: 1 }));
    const partial = source(tableCell({ char_start: 5 }));
    expect(docxAnchorToTarget(inverted.anchor, inverted)).toBeNull();
    expect(docxAnchorToTarget(partial.anchor, partial)).toBeNull();
  });
});

describe("sourceToDocxHighlight", () => {
  it("matches docxAnchorToTarget for text spans, cells, and non-docx anchors", () => {
    const text = source(textSpan());
    const cell = source(tableCell());
    const csv = source({ kind: "csv_cell", row: 1, column: "A" });
    expect(sourceToDocxHighlight(text)).toEqual(
      docxAnchorToTarget(text.anchor, text),
    );
    expect(sourceToDocxHighlight(cell)).toEqual(
      docxAnchorToTarget(cell.anchor, cell),
    );
    expect(sourceToDocxHighlight(csv)).toBeNull();
    expect(sourceToDocxHighlight(undefined)).toBeNull();
  });
});

describe("useDocxSourceTarget", () => {
  function renderTarget(handle: DocxViewerHandle | null) {
    const ref = { current: handle } as React.RefObject<DocxViewerHandle | null>;
    const targetRef: {
      current: ReturnType<typeof useDocxSourceTarget> | null;
    } = { current: null };
    function Harness() {
      const target = useDocxSourceTarget(ref);
      React.useEffect(() => {
        targetRef.current = target;
      }, [target]);
      return null;
    }
    const view = render(<Harness />);
    const target = targetRef.current;
    if (!target) throw new Error("useDocxSourceTarget did not initialize");
    return { target, ref, view };
  }

  function handle(scrollToTarget = vi.fn()): DocxViewerHandle {
    return { scrollToTarget, getViewportElement: () => null };
  }

  it("forwards a resolved docx target and options to the viewer handle", () => {
    const scrollToTarget = vi.fn();
    const { target } = renderTarget(handle(scrollToTarget));

    target.scrollTo?.(source(tableCell({ table: 1, row: 2, column: 3 })), {
      behavior: "auto",
    });

    expect(scrollToTarget).toHaveBeenCalledWith(
      { kind: "cell", table: 1, row: 2, column: 3 },
      { behavior: "auto" },
    );
  });

  it("forwards a resolved text target", () => {
    const scrollToTarget = vi.fn();
    const { target } = renderTarget(handle(scrollToTarget));

    target.scrollTo?.(source(textSpan(), "Find me"), { behavior: "smooth" });

    expect(scrollToTarget).toHaveBeenCalledWith(
      { kind: "text", text: "Find me" },
      { behavior: "smooth" },
    );
  });

  it("does not call the handle for a non-docx anchor", () => {
    const scrollToTarget = vi.fn();
    const { target } = renderTarget(handle(scrollToTarget));

    target.scrollTo?.(source({ kind: "csv_cell", row: 1, column: "A" }), {
      behavior: "auto",
    });

    expect(scrollToTarget).not.toHaveBeenCalled();
  });

  it("does not call the handle for a text span with empty content", () => {
    const scrollToTarget = vi.fn();
    const { target } = renderTarget(handle(scrollToTarget));

    target.scrollTo?.(source(textSpan(), "   "), { behavior: "auto" });

    expect(scrollToTarget).not.toHaveBeenCalled();
  });

  it("is a no-op when the viewer ref is empty", () => {
    const { target } = renderTarget(null);
    expect(() =>
      target.scrollTo?.(source(tableCell()), { behavior: "auto" }),
    ).not.toThrow();
  });

  it("returns a stable target object across re-renders for the same ref", () => {
    const ref = {
      current: handle(),
    } as React.RefObject<DocxViewerHandle | null>;
    const seen: ReturnType<typeof useDocxSourceTarget>[] = [];
    function Harness() {
      const target = useDocxSourceTarget(ref);
      React.useEffect(() => {
        seen.push(target);
      });
      return null;
    }
    const view = render(<Harness />);
    view.rerender(<Harness />);

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });
});
