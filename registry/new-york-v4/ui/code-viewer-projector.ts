import {
  CODE_VIEWER_BLOCK_PADDING,
  CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT,
  CODE_VIEWER_OVERSCAN,
} from "./code-viewer-scale";
import type { CodeSyntax, CodeTokenLeaf } from "./code-viewer-syntax";
import {
  getCodeVirtualLines,
  getCodeVirtualTotalSize,
  type CodeVirtualLine,
} from "./code-viewer-virtualization";
import { isLineInRange, type NormalizedTextLineRange } from "./line-ranges";

// Opaque fills mixed from the theme's opaque `--foreground`/`--background`
// tokens (the `--muted`/`--accent` tokens are alpha-based, so they cannot mask
// scrolled content). Shared with the viewport's full-height gutter rail.
export const CODE_GUTTER_BACKGROUND =
  "color-mix(in oklab, var(--foreground) 3%, var(--background))";
const CODE_HIGHLIGHT_BACKGROUND =
  "color-mix(in oklab, var(--foreground) 8%, var(--background))";
const CODE_HIGHLIGHT_ACCENT_SHADOW = "inset 2px 0 0 0 var(--primary)";
const CODE_HIGHLIGHT_NUMBER_COLOR =
  "color-mix(in oklab, var(--foreground) 70%, transparent)";

export type CodeProjectionIdentity = {
  contentIdentity: string;
  layoutIdentity: string;
  syntaxIdentity: string;
};

export type CodeProjectionInput = CodeProjectionIdentity & {
  rowHost: HTMLPreElement;
  viewport: HTMLDivElement;
  textLines: readonly string[];
  lineHeight: number;
  gutterWidth: string;
  highlightRange: NormalizedTextLineRange | null;
  syntax: CodeSyntax;
};

export type CodeProjector = {
  project(input: CodeProjectionInput): void;
  destroy(): void;
};

type CodeRowCache = {
  contentIdentity: string;
  contentSpan: HTMLSpanElement;
  gutterSpan: HTMLSpanElement;
  layoutIdentity: string;
  row: HTMLDivElement;
};

type VisibleRange = {
  end: number;
  start: number;
};

type LastProjection = CodeProjectionIdentity & {
  highlightIdentity: string;
  totalHeight: string;
  visibleEnd: number;
  visibleStart: number;
};

const MAX_RECYCLED_CODE_ROWS = 512;

export function createCodeProjector(): CodeProjector {
  let identity: CodeProjectionIdentity | null = null;
  let lastProjection: LastProjection | null = null;
  let rowHost: HTMLPreElement | null = null;
  let recycledRows: CodeRowCache[] = [];
  let rows: Array<CodeRowCache | undefined> = [];
  let visibleRange: VisibleRange | null = null;

  return {
    project(input) {
      if (rowHost !== input.rowHost) {
        clearRows();
        rowHost = input.rowHost;
      }

      const nextIdentity = codeProjectionIdentity(input);
      if (
        !identity ||
        identity.contentIdentity !== nextIdentity.contentIdentity
      ) {
        identity = nextIdentity;
        clearRows();
      } else {
        identity = nextIdentity;
      }

      const totalHeight = `${getCodeVirtualTotalSize({
        lineCount: input.textLines.length,
        lineHeight: input.lineHeight,
      })}px`;

      const visibleLines = getCodeVirtualLines({
        lineCount: input.textLines.length,
        lineHeight: input.lineHeight,
        overscan: CODE_VIEWER_OVERSCAN,
        paddingStart: CODE_VIEWER_BLOCK_PADDING,
        scrollTop: input.viewport.scrollTop,
        viewportHeight:
          input.viewport.clientHeight || CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT,
      });
      const nextVisibleRange = codeVisibleRange(visibleLines);
      const nextProjection = codeLastProjection({
        input,
        totalHeight,
        visibleRange: nextVisibleRange,
      });
      if (
        lastProjection &&
        isSameCodeProjection(lastProjection, nextProjection)
      ) {
        return;
      }
      lastProjection = nextProjection;

      setStyleValue(input.rowHost.style, "height", totalHeight);

      removeRowsOutsideVisibleRange(nextVisibleRange);

      syncVisibleRowOrder({
        input,
        visibleLines,
      });
      visibleRange = nextVisibleRange;
    },
    destroy() {
      clearRows();
      recycledRows = [];
      rowHost = null;
      identity = null;
    },
  };

  function syncVisibleRowOrder({
    input,
    visibleLines,
  }: {
    input: CodeProjectionInput;
    visibleLines: readonly CodeVirtualLine[];
  }) {
    let cursor = input.rowHost.firstChild;

    for (const visibleLine of visibleLines) {
      const row = prepareCodeRow({
        input,
        visibleLine,
      });
      if (row !== cursor) {
        input.rowHost.insertBefore(row, cursor);
      }
      cursor = row.nextSibling;
    }

    while (cursor) {
      const nextCursor = cursor.nextSibling;
      cursor.parentNode?.removeChild(cursor);
      cursor = nextCursor;
    }
  }

  function clearRows() {
    for (const row of rows) {
      if (row) recycleCodeRow(row);
    }
    rowHost?.replaceChildren();
    rows = [];
    lastProjection = null;
    visibleRange = null;
  }

  function removeRowsOutsideVisibleRange(nextVisibleRange: VisibleRange) {
    if (!visibleRange) return;

    removeCodeRowRange(visibleRange.start, nextVisibleRange.start);
    removeCodeRowRange(nextVisibleRange.end, visibleRange.end);
  }

  function removeCodeRowRange(start: number, end: number) {
    for (
      let index = Math.max(0, start);
      index < Math.max(start, end);
      index++
    ) {
      const row = rows[index];
      if (!row) continue;
      row.row.remove();
      recycleCodeRow(row);
      rows[index] = undefined;
    }
  }

  function recycleCodeRow(row: CodeRowCache) {
    row.contentIdentity = "";
    row.layoutIdentity = "";
    if (recycledRows.length < MAX_RECYCLED_CODE_ROWS) {
      recycledRows.push(row);
    }
  }

  function prepareCodeRow({
    input,
    visibleLine,
  }: {
    input: CodeProjectionInput;
    visibleLine: CodeVirtualLine;
  }): HTMLDivElement {
    const lineNumber = visibleLine.index + 1;
    const text = input.textLines[visibleLine.index] ?? "";
    const isHighlighted = isLineInRange(lineNumber, input.highlightRange);
    const layoutIdentity = [
      lineNumber,
      input.layoutIdentity,
      isHighlighted ? "highlighted" : "",
    ].join("\u0000");
    const contentIdentity = [text, input.syntaxIdentity].join("\u0000");

    let row = rows[visibleLine.index];
    if (!row) {
      row = recycledRows.pop() ?? createCodeRow();
      rows[visibleLine.index] = row;
    }

    setStyleValue(row.row.style, "height", `${visibleLine.size}px`);
    setStyleValue(
      row.row.style,
      "transform",
      `translateY(${visibleLine.start}px)`,
    );

    if (row.layoutIdentity !== layoutIdentity) {
      row.layoutIdentity = layoutIdentity;
      patchCodeRowLayout({
        gutterWidth: input.gutterWidth,
        isHighlighted,
        lineNumber,
        row,
      });
    }

    if (row.contentIdentity !== contentIdentity) {
      row.contentIdentity = contentIdentity;
      patchCodeRowContent({
        row,
        syntax: input.syntax,
        text,
      });
    }

    return row.row;
  }
}

function codeLastProjection({
  input,
  totalHeight,
  visibleRange,
}: {
  input: CodeProjectionInput;
  totalHeight: string;
  visibleRange: VisibleRange;
}): LastProjection {
  return {
    contentIdentity: input.contentIdentity,
    highlightIdentity: codeHighlightIdentity(input.highlightRange),
    layoutIdentity: input.layoutIdentity,
    syntaxIdentity: input.syntaxIdentity,
    totalHeight,
    visibleEnd: visibleRange.end,
    visibleStart: visibleRange.start,
  };
}

function codeHighlightIdentity(range: NormalizedTextLineRange | null) {
  return range ? `${range.start}:${range.end}` : "";
}

function isSameCodeProjection(previous: LastProjection, next: LastProjection) {
  return (
    previous.contentIdentity === next.contentIdentity &&
    previous.highlightIdentity === next.highlightIdentity &&
    previous.layoutIdentity === next.layoutIdentity &&
    previous.syntaxIdentity === next.syntaxIdentity &&
    previous.totalHeight === next.totalHeight &&
    previous.visibleEnd === next.visibleEnd &&
    previous.visibleStart === next.visibleStart
  );
}

function codeProjectionIdentity({
  contentIdentity,
  layoutIdentity,
  syntaxIdentity,
}: CodeProjectionIdentity): CodeProjectionIdentity {
  return {
    contentIdentity,
    layoutIdentity,
    syntaxIdentity,
  };
}

function codeVisibleRange(
  visibleLines: readonly CodeVirtualLine[],
): VisibleRange {
  const start = visibleLines[0]?.index ?? 0;
  const end = visibleLines.length
    ? visibleLines[visibleLines.length - 1]!.index + 1
    : start;
  return { end, start };
}

function createCodeRow(): CodeRowCache {
  const row = document.createElement("div");
  const gutterSpan = document.createElement("span");
  const contentSpan = document.createElement("span");

  row.className = codeRowClassName();
  row.style.position = "absolute";
  row.style.top = "0";
  row.style.left = "0";

  gutterSpan.className =
    "sticky left-0 z-10 flex-shrink-0 border-r px-2 pr-3 text-right text-muted-foreground/60 select-none";
  // The gutter must paint an opaque background so horizontally-scrolled code
  // never shows through the sticky line-number column. The theme's `--muted`
  // token is alpha-based (translucent), so the fill is mixed from the opaque
  // `--foreground`/`--background` pair instead.
  gutterSpan.style.backgroundColor = CODE_GUTTER_BACKGROUND;
  gutterSpan.dataset.codeGutter = "";
  gutterSpan.setAttribute("aria-hidden", "true");
  contentSpan.className = "whitespace-pre px-2";

  row.append(gutterSpan, contentSpan);

  return {
    contentIdentity: "",
    contentSpan,
    gutterSpan,
    layoutIdentity: "",
    row,
  };
}

function patchCodeRowLayout({
  gutterWidth,
  isHighlighted,
  lineNumber,
  row,
}: {
  gutterWidth: string;
  isHighlighted: boolean;
  lineNumber: number;
  row: CodeRowCache;
}) {
  row.row.dataset.lineNumber = String(lineNumber);
  setStyleValue(row.gutterSpan.style, "width", gutterWidth);
  setTextContent(row.gutterSpan, String(lineNumber));

  // Highlighted range: a continuous opaque band (no per-row borders) with a
  // single left accent stripe on the gutter that merges across adjacent lines.
  setStyleValue(
    row.row.style,
    "background-color",
    isHighlighted ? CODE_HIGHLIGHT_BACKGROUND : "",
  );
  setStyleValue(
    row.gutterSpan.style,
    "background-color",
    isHighlighted ? CODE_HIGHLIGHT_BACKGROUND : CODE_GUTTER_BACKGROUND,
  );
  setStyleValue(
    row.gutterSpan.style,
    "box-shadow",
    isHighlighted ? CODE_HIGHLIGHT_ACCENT_SHADOW : "",
  );
  setStyleValue(
    row.gutterSpan.style,
    "color",
    isHighlighted ? CODE_HIGHLIGHT_NUMBER_COLOR : "",
  );
}

function patchCodeRowContent({
  row,
  syntax,
  text,
}: {
  row: CodeRowCache;
  syntax: CodeSyntax;
  text: string;
}) {
  patchCodeContent(row.contentSpan, syntax.getLineTokens(text), text);
}

function patchCodeContent(
  contentSpan: HTMLSpanElement,
  leaves: readonly CodeTokenLeaf[] | null,
  text: string,
) {
  if (text === "") {
    contentSpan.replaceChildren();
    contentSpan.textContent = " ";
    return;
  }
  if (!leaves) {
    setTextContent(contentSpan, text);
    return;
  }

  contentSpan.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const leaf of leaves) {
    if (!leaf.kind) {
      fragment.append(document.createTextNode(leaf.text));
      continue;
    }
    const span = document.createElement("span");
    span.className = "cv-token-" + leaf.kind;
    span.textContent = leaf.text;
    fragment.append(span);
  }
  contentSpan.append(fragment);
}

function codeRowClassName() {
  return "absolute top-0 left-0 flex min-w-full";
}

function setStyleValue(
  style: CSSStyleDeclaration,
  propertyName: string,
  value: string,
) {
  if (style.getPropertyValue(propertyName) !== value) {
    style.setProperty(propertyName, value);
  }
}

function setTextContent(element: HTMLElement, text: string) {
  if (element.textContent !== text) {
    element.textContent = text;
  }
}
