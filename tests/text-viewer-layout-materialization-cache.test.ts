import { beforeEach, describe, expect, it, vi } from "vitest";

const LINE_COUNT = 500;

const pretextMocks = vi.hoisted(() => ({
  layoutNextLineRange: vi.fn(),
  materializeLineRange: vi.fn(),
  measureLineStats: vi.fn(),
  measureNaturalWidth: vi.fn(),
  prepareWithSegments: vi.fn(),
}));

const richInlineMocks = vi.hoisted(() => ({
  layoutNextRichInlineLineRange: vi.fn(),
  materializeRichInlineLineRange: vi.fn(),
  measureRichInlineStats: vi.fn(),
  prepareRichInline: vi.fn(),
}));

vi.mock("@chenglou/pretext", () => pretextMocks);
vi.mock("@chenglou/pretext/rich-inline", () => richInlineMocks);

import {
  materializeCodeVisibleLines,
  materializeInlineVisibleLines,
  type CodeTextBlockFrame,
  type InlineTextBlockFrame,
  type InlineFragmentLayout,
  type PreparedCodeTextBlock,
  type PreparedInlineTextBlock,
} from "@/registry/new-york-v4/ui/text-viewer-layout";

type MockRichInlineFragmentRange = {
  end: { graphemeIndex: number; segmentIndex: number };
  gapBefore: number;
  itemIndex: number;
  occupiedWidth: number;
  start: { graphemeIndex: number; segmentIndex: number };
};

describe("text viewer layout materialization cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    pretextMocks.layoutNextLineRange.mockImplementation(
      (_prepared, start, maxWidth) => {
        const lineIndex = start.segmentIndex;
        if (lineIndex >= LINE_COUNT) return null;
        return {
          end: { graphemeIndex: 0, segmentIndex: lineIndex + 1 },
          start: { ...start },
          width: maxWidth,
        };
      },
    );
    pretextMocks.materializeLineRange.mockImplementation((_prepared, range) => {
      const lineIndex = range.start.segmentIndex;
      return {
        end: range.end,
        start: range.start,
        text: `code-${lineIndex}`,
        width: range.width,
      };
    });

    richInlineMocks.layoutNextRichInlineLineRange.mockImplementation(
      (_flow, maxWidth, start) => {
        const cursor = start ?? {
          graphemeIndex: 0,
          itemIndex: 0,
          segmentIndex: 0,
        };
        const lineIndex = cursor.itemIndex;
        if (lineIndex >= LINE_COUNT) return null;
        return {
          end: {
            graphemeIndex: 0,
            itemIndex: lineIndex + 1,
            segmentIndex: 0,
          },
          fragments: [
            {
              end: { graphemeIndex: 0, segmentIndex: lineIndex + 1 },
              gapBefore: 0,
              itemIndex: 0,
              occupiedWidth: maxWidth,
              start: { graphemeIndex: 0, segmentIndex: lineIndex },
            },
          ],
          width: maxWidth,
        };
      },
    );
    richInlineMocks.materializeRichInlineLineRange.mockImplementation(
      (_flow, range) => {
        return {
          end: range.end,
          fragments: range.fragments.map(
            (fragment: MockRichInlineFragmentRange) => ({
              ...fragment,
              text: `inline-${fragment.start.segmentIndex}`,
            }),
          ),
          width: range.width,
        };
      },
    );
  });

  it("reuses cached code materialization for nested and adjacent windows", () => {
    const block = codeBlock();
    const frame = codeFrame();

    const first = materializeCodeVisibleLines({
      block,
      contentWidth: 600,
      frame,
      lineWindow: { firstLine: 50, lastLine: 55 },
      viewportBottom: 0,
      viewportTop: 0,
    });
    expect(first.map((line) => line.line.text)).toEqual([
      "code-50",
      "code-51",
      "code-52",
      "code-53",
      "code-54",
      "code-55",
    ]);
    expect(pretextMocks.layoutNextLineRange).toHaveBeenCalledTimes(56);
    expect(pretextMocks.materializeLineRange).toHaveBeenCalledTimes(6);

    const nested = materializeCodeVisibleLines({
      block,
      contentWidth: 600,
      frame,
      lineWindow: { firstLine: 52, lastLine: 53 },
      viewportBottom: 0,
      viewportTop: 0,
    });
    expect(nested.map((line) => line.line.text)).toEqual([
      "code-52",
      "code-53",
    ]);
    expect(pretextMocks.layoutNextLineRange).toHaveBeenCalledTimes(56);
    expect(pretextMocks.materializeLineRange).toHaveBeenCalledTimes(6);

    const adjacent = materializeCodeVisibleLines({
      block,
      contentWidth: 600,
      frame,
      lineWindow: { firstLine: 56, lastLine: 58 },
      viewportBottom: 0,
      viewportTop: 0,
    });
    expect(adjacent.map((line) => line.line.text)).toEqual([
      "code-56",
      "code-57",
      "code-58",
    ]);
    expect(pretextMocks.layoutNextLineRange).toHaveBeenCalledTimes(59);
    expect(pretextMocks.materializeLineRange).toHaveBeenCalledTimes(9);
  });

  it("reuses cached inline materialization for nested and adjacent windows", () => {
    const block = inlineBlock();
    const frame = inlineFrame();

    const first = materializeInlineVisibleLines({
      block,
      frame,
      lineWindow: { firstLine: 70, lastLine: 72 },
      maxWidth: 600,
      viewportBottom: 0,
      viewportTop: 0,
    });
    expect(first.map(inlineLineText)).toEqual([
      "inline-70",
      "inline-71",
      "inline-72",
    ]);
    expect(richInlineMocks.layoutNextRichInlineLineRange).toHaveBeenCalledTimes(
      73,
    );
    expect(
      richInlineMocks.materializeRichInlineLineRange,
    ).toHaveBeenCalledTimes(3);

    const nested = materializeInlineVisibleLines({
      block,
      frame,
      lineWindow: { firstLine: 71, lastLine: 72 },
      maxWidth: 600,
      viewportBottom: 0,
      viewportTop: 0,
    });
    expect(nested.map(inlineLineText)).toEqual(["inline-71", "inline-72"]);
    expect(richInlineMocks.layoutNextRichInlineLineRange).toHaveBeenCalledTimes(
      73,
    );
    expect(
      richInlineMocks.materializeRichInlineLineRange,
    ).toHaveBeenCalledTimes(3);

    const adjacent = materializeInlineVisibleLines({
      block,
      frame,
      lineWindow: { firstLine: 73, lastLine: 75 },
      maxWidth: 600,
      viewportBottom: 0,
      viewportTop: 0,
    });
    expect(adjacent.map(inlineLineText)).toEqual([
      "inline-73",
      "inline-74",
      "inline-75",
    ]);
    expect(richInlineMocks.layoutNextRichInlineLineRange).toHaveBeenCalledTimes(
      76,
    );
    expect(
      richInlineMocks.materializeRichInlineLineRange,
    ).toHaveBeenCalledTimes(6);
  });
});

function inlineLineText(
  line: ReturnType<typeof materializeInlineVisibleLines>[number],
) {
  return line.fragments
    .map((fragment: InlineFragmentLayout) => fragment.text)
    .join("");
}

function inlineBlock() {
  return {
    ...blockBase(),
    classNames: ["body"],
    fallbackText: "",
    flow: {},
    fonts: ["font"],
    headingId: null,
    hrefs: [null],
    kind: "inline",
    lineHeight: 20,
    texts: [""],
    titles: [null],
    variant: "body",
  } as unknown as PreparedInlineTextBlock;
}

function codeBlock() {
  return {
    ...blockBase(),
    fallbackText: "",
    font: "font",
    kind: "code",
    language: null,
    lineHeight: 20,
    prepared: {},
  } as unknown as PreparedCodeTextBlock;
}

function inlineFrame() {
  return {
    ...frameBase(),
    kind: "inline",
    lineCount: LINE_COUNT,
    lineHeight: 20,
    usedWidth: 600,
  } as InlineTextBlockFrame;
}

function codeFrame() {
  return {
    ...frameBase(),
    kind: "code",
    language: null,
    lineCount: LINE_COUNT,
    lineHeight: 20,
    width: 600,
  } as CodeTextBlockFrame;
}

function blockBase() {
  return {
    contentLeft: 0,
    listDepth: 0,
    marginTop: 0,
    markerClassName: null,
    markerLeft: null,
    markerText: null,
    quoteDepth: 0,
    quoteRailLefts: [],
    sourceEndLine: 1,
    sourceStartLine: 1,
  };
}

function frameBase() {
  return {
    blockIndex: 0,
    bottom: LINE_COUNT * 20,
    contentLeft: 0,
    height: LINE_COUNT * 20,
    listDepth: 0,
    markerClassName: null,
    markerLeft: null,
    markerText: null,
    quoteDepth: 0,
    quoteRailLefts: [],
    scale: 1,
    sourceEndLine: 1,
    sourceStartLine: 1,
    top: 0,
  };
}
