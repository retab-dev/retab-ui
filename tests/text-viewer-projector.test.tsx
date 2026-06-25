// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
  createTextProjectionCache,
  createTextProjectionMetrics,
  projectRows,
} from "@/registry/new-york-v4/ui/text-viewer-chenglou-content";
import type {
  PreparedRuleTextBlock,
  PreparedTableCell,
  PreparedTableTextBlock,
  RuleTextBlockFrame,
  TableTextBlockFrame,
  TextBlockFrame,
  TextDocumentFrame,
} from "@/registry/new-york-v4/ui/text-viewer-layout";

const CONTENT_WIDTH = 360;

type PreparedDocument = Parameters<typeof projectRows>[0]["preparedDocument"];

function project({
  canvas,
  frame,
  preparedDocument,
  scrollTop = 0,
  viewportHeight = 40,
}: {
  canvas: HTMLDivElement;
  frame: TextDocumentFrame;
  preparedDocument: PreparedDocument;
  scrollTop?: number;
  viewportHeight?: number;
}) {
  const metrics = createTextProjectionMetrics();
  const cache = createTextProjectionCache({ metrics });
  projectRows({
    cache,
    canvas,
    contentWidth: CONTENT_WIDTH,
    frame,
    highlightRange: null,
    preparedDocument,
    scrollTop,
    viewportHeight,
  });
  return { cache, metrics };
}

function projectAgain({
  cache,
  canvas,
  frame,
  preparedDocument,
  scrollTop = 0,
  viewportHeight = 40,
}: {
  cache: ReturnType<typeof createTextProjectionCache>;
  canvas: HTMLDivElement;
  frame: TextDocumentFrame;
  preparedDocument: PreparedDocument;
  scrollTop?: number;
  viewportHeight?: number;
}) {
  projectRows({
    cache,
    canvas,
    contentWidth: CONTENT_WIDTH,
    frame,
    highlightRange: null,
    preparedDocument,
    scrollTop,
    viewportHeight,
  });
}

function ruleDocument(count: number) {
  const rowHeight = 24;
  const blocks: PreparedRuleTextBlock[] = [];
  const frames: RuleTextBlockFrame[] = [];

  for (let index = 0; index < count; index++) {
    const sourceLine = index + 1;
    const top = index * rowHeight;
    blocks.push({
      ...preparedBlockBase(sourceLine),
      height: rowHeight,
      kind: "rule",
    });
    frames.push({
      ...frameBase({ height: rowHeight, index, sourceLine, top }),
      kind: "rule",
      width: CONTENT_WIDTH,
    });
  }

  return {
    frame: textDocumentFrame(frames),
    preparedDocument: preparedDocument(blocks),
  };
}

function tableDocument(rowCount: number) {
  const headerHeight = 28;
  const rowHeight = 20;
  const rowHeights = Array.from({ length: rowCount }, () => rowHeight);
  const rowOffsets = [0];
  for (const height of rowHeights) {
    rowOffsets.push(rowOffsets[rowOffsets.length - 1]! + height);
  }
  const rowSourceStartLines = Array.from(
    { length: rowCount },
    (_, index) => index + 3,
  );
  const rows = Array.from({ length: rowCount }, (_, index) => [
    tableCell(`row-${String(index + 1).padStart(3, "0")}`),
  ]);
  const bodyHeight = rowOffsets[rowOffsets.length - 1] ?? 0;
  const height = headerHeight + bodyHeight;
  const block: PreparedTableTextBlock = {
    ...preparedBlockBase(1, rowCount + 2),
    alignments: ["left"],
    columnWidths: [160],
    header: [tableCell("Value")],
    kind: "table",
    rowSourceStartLines,
    rows,
  };
  const tableFrame: TableTextBlockFrame = {
    ...frameBase({ height, index: 0, sourceEndLine: rowCount + 2 }),
    columnWidths: [160],
    headerHeight,
    kind: "table",
    rowCount,
    rowHeights,
    rowOffsets,
    rowSourceStartLines,
    tableWidth: 160,
  };

  return {
    frame: textDocumentFrame([tableFrame]),
    preparedDocument: preparedDocument([block]),
    tableFrame,
  };
}

function preparedBlockBase(
  sourceStartLine: number,
  sourceEndLine = sourceStartLine,
) {
  return {
    contentLeft: 0,
    listDepth: 0,
    marginTop: 0,
    markerClassName: null,
    markerLeft: null,
    markerText: null,
    quoteDepth: 0,
    quoteRailLefts: [],
    sourceEndLine,
    sourceStartLine,
  };
}

function frameBase({
  height,
  index,
  sourceEndLine,
  sourceLine = 1,
  top = 0,
}: {
  height: number;
  index: number;
  sourceEndLine?: number;
  sourceLine?: number;
  top?: number;
}) {
  return {
    blockIndex: index,
    bottom: top + height,
    contentLeft: 0,
    height,
    listDepth: 0,
    markerClassName: null,
    markerLeft: null,
    markerText: null,
    quoteDepth: 0,
    quoteRailLefts: [],
    scale: 1,
    sourceEndLine: sourceEndLine ?? sourceLine,
    sourceStartLine: sourceLine,
    top,
  };
}

function tableCell(text: string): PreparedTableCell {
  return {
    className: "",
    href: null,
    text,
    title: null,
  };
}

function preparedDocument(
  blocks: PreparedDocument["blocks"],
): PreparedDocument {
  return {
    blocks,
    mode: "markdown",
    sourceLineCount: blocks.at(-1)?.sourceEndLine ?? 0,
    wordCount: 0,
  };
}

function textDocumentFrame(frames: TextBlockFrame[]): TextDocumentFrame {
  return {
    frames,
    totalHeight: frames.at(-1)?.bottom ?? 0,
    width: CONTENT_WIDTH,
  };
}

function stickyContent(canvas: HTMLDivElement) {
  const content = canvas.querySelector<HTMLDivElement>(
    '[data-slot="text-sticky-content"]',
  );
  expect(content).toBeTruthy();
  return content as HTMLDivElement;
}

function projectedRows(canvas: HTMLDivElement) {
  return Array.from(stickyContent(canvas).children);
}

describe("text-viewer chenglou projector", () => {
  it("records metrics and skips unchanged mounted windows", () => {
    const canvas = document.createElement("div");
    const { frame, preparedDocument } = ruleDocument(100);
    const { cache, metrics } = project({ canvas, frame, preparedDocument });
    const firstRows = projectedRows(canvas);
    const replaceChildren = vi.spyOn(Element.prototype, "replaceChildren");
    const insertBefore = vi.spyOn(Node.prototype, "insertBefore");
    const append = vi.spyOn(Element.prototype, "append");

    projectAgain({ cache, canvas, frame, preparedDocument });

    expect(metrics.projections).toBe(2);
    expect(metrics.noops).toBe(1);
    expect(metrics.rowsCreated).toBe(firstRows.length);
    expect(metrics.visibleStart).toBe(0);
    expect(metrics.visibleEnd).toBe(35);
    expect(metrics.visibleEnd).toBe(firstRows.length);
    expect(projectedRows(canvas)).toEqual(firstRows);
    expect(replaceChildren).not.toHaveBeenCalled();
    expect(insertBefore).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it("keeps leading document padding visible in the first projected window", () => {
    const canvas = document.createElement("div");
    const { frame, preparedDocument } = ruleDocument(10);
    const leadingPadding = 16;
    const paddedFrame = textDocumentFrame(
      frame.frames.map((item) => ({
        ...item,
        bottom: item.bottom + leadingPadding,
        top: item.top + leadingPadding,
      })),
    );

    project({
      canvas,
      frame: paddedFrame,
      preparedDocument,
      scrollTop: 0,
      viewportHeight: 40,
    });

    const before = canvas.querySelector<HTMLElement>(
      '[data-slot="text-sticky-before-buffer"]',
    );
    const firstRow = projectedRows(canvas)[0] as HTMLElement | undefined;

    expect(before?.style.height).toBe("0px");
    expect(firstRow?.style.transform).toBe("translateY(16px)");
  });

  it("mounts projected rows inside an inverse sticky rendered window", () => {
    const canvas = document.createElement("div");
    const { frame, preparedDocument } = ruleDocument(100);

    project({
      canvas,
      frame,
      preparedDocument,
      scrollTop: 1200,
      viewportHeight: 40,
    });

    const stickyWindow = canvas.querySelector<HTMLElement>(
      '[data-slot="text-sticky-window"]',
    );
    const before = canvas.querySelector<HTMLElement>(
      '[data-slot="text-sticky-before-buffer"]',
    );
    const after = canvas.querySelector<HTMLElement>(
      '[data-slot="text-sticky-after-buffer"]',
    );
    const firstRow = projectedRows(canvas)[0] as HTMLElement | undefined;

    expect(stickyWindow?.style.position).toBe("sticky");
    expect(stickyWindow?.style.contain).toBe("layout style inline-size");
    expect(stickyWindow?.style.display).toBe("flex");
    expect(stickyWindow?.style.flexDirection).toBe("column");
    expect(stickyWindow?.style.isolation).toBe("isolate");
    expect(stickyWindow?.style.top).toBe(stickyWindow?.style.bottom);
    expect(stickyWindow?.style.top).toMatch(/^-/);
    expect(before?.style.height).not.toBe("0px");
    expect(before?.style.contain).toBe("layout size");
    expect(after?.style.height).not.toBe("0px");
    expect(after?.style.contain).toBe("layout size");
    expect(firstRow?.style.transform).toBe("translateY(0px)");
  });

  it("reuses detached row shells after a far window jump", () => {
    const canvas = document.createElement("div");
    const { frame, preparedDocument } = ruleDocument(220);
    const { cache, metrics } = project({ canvas, frame, preparedDocument });
    const firstCreated = metrics.rowsCreated;
    const targetIndex = 140;

    projectAgain({
      cache,
      canvas,
      frame,
      preparedDocument,
      scrollTop: frame.frames[targetIndex]!.top,
    });

    expect(metrics.rowsRemoved).toBeGreaterThan(0);
    expect(metrics.rowsReused).toBeGreaterThan(0);
    expect(metrics.rowsCreated).toBeLessThanOrEqual(
      Math.max(firstCreated, projectedRows(canvas).length),
    );
    expect(metrics.rowPoolSize).toBeLessThanOrEqual(512);
    expect(metrics.visibleStart).toBeLessThanOrEqual(targetIndex);
    expect(metrics.visibleEnd).toBeGreaterThan(targetIndex);
  });

  it("patches a long block subwindow without replacing the row shell", () => {
    const canvas = document.createElement("div");
    const { frame, preparedDocument, tableFrame } = tableDocument(140);
    const { cache, metrics } = project({ canvas, frame, preparedDocument });
    const row = stickyContent(canvas).firstElementChild;
    const firstContentPatches = metrics.rowContentPatches;
    const firstCreated = metrics.rowsCreated;
    const firstRemoved = metrics.rowsRemoved;
    const insertBefore = vi.spyOn(stickyContent(canvas), "insertBefore");

    projectAgain({
      cache,
      canvas,
      frame,
      preparedDocument,
      scrollTop: tableFrame.headerHeight + tableFrame.rowHeights[0]! * 80,
    });

    expect(stickyContent(canvas).firstElementChild).toBe(row);
    expect(canvas.textContent).toContain("row-081");
    expect(canvas.textContent).not.toContain("row-001");
    expect(metrics.rowContentPatches).toBeGreaterThan(firstContentPatches);
    expect(metrics.rowsCreated).toBe(firstCreated);
    expect(metrics.rowsRemoved).toBe(firstRemoved);
    expect(insertBefore).not.toHaveBeenCalled();
  });
});
