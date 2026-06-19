import { normalizeLayoutQuad, quadToRect } from "./layout-blocks-geometry";
import type {
  LayoutDocument,
  LayoutItem,
  LayoutKind,
  LayoutLevel,
  LayoutPage,
  LayoutQuad,
} from "./layout-blocks-types";

type TextractPoint = {
  X?: number;
  Y?: number;
};

type TextractBoundingBox = {
  Width?: number;
  Height?: number;
  Left?: number;
  Top?: number;
};

type TextractGeometry = {
  BoundingBox?: TextractBoundingBox;
  Polygon?: TextractPoint[];
};

type TextractRelationship = {
  Type?: string;
  Ids?: string[];
};

export type TextractBlock = {
  Id?: string;
  BlockType?: string;
  Text?: string;
  Confidence?: number;
  Page?: number;
  Geometry?: TextractGeometry;
  Relationships?: TextractRelationship[];
};

export type TextractDocument = {
  DocumentMetadata?: {
    Pages?: number;
    /**
     * Retab fixture extension: Textract geometry is normalized and the service
     * response does not include source page dimensions. Generated showcase
     * fixtures can carry page dimensions here so overlays keep the source aspect.
     */
    PageSizes?: Array<{ Page?: number; Width?: number; Height?: number }>;
  };
  Blocks?: TextractBlock[];
};

export type TextractAdapterOptions = {
  /**
   * Textract geometry is normalized to the page (0–1) and the response carries
   * no pixel dimensions, so we project boxes onto a synthetic page. Defaults to
   * a US-Letter aspect ratio.
   */
  pageSize?: { width: number; height: number };
};

const DEFAULT_PAGE_SIZE = { width: 1000, height: 1294 };

const LAYOUT_BLOCK_TYPES = new Set([
  "LAYOUT_TITLE",
  "LAYOUT_HEADER",
  "LAYOUT_FOOTER",
  "LAYOUT_SECTION_HEADER",
  "LAYOUT_PAGE_NUMBER",
  "LAYOUT_LIST",
  "LAYOUT_TABLE",
  "LAYOUT_FIGURE",
  "LAYOUT_KEY_VALUE",
  "LAYOUT_TEXT",
]);

export function textractToLayoutDocument(
  input: TextractDocument,
  options: TextractAdapterOptions = {},
): LayoutDocument {
  const blocks = input.Blocks ?? [];
  const blocksById = new Map<string, TextractBlock>();
  for (const block of blocks) {
    if (block.Id) blocksById.set(block.Id, block);
  }

  const pageNumbers = collectPageNumbers(blocks);
  const metadataPageSizes = collectMetadataPageSizes(input);
  const pages: LayoutPage[] = pageNumbers.map((pageNumber) => {
    const pageSize =
      options.pageSize ??
      metadataPageSizes.get(pageNumber) ??
      DEFAULT_PAGE_SIZE;
    return {
      pageNumber,
      width: pageSize.width,
      height: pageSize.height,
      rotation: 0,
    };
  });
  const pagesByNumber = new Map(pages.map((page) => [page.pageNumber, page]));

  // Reverse-index CHILD relationships so each block can find its parent.
  const parentByChildId = new Map<string, string>();
  for (const block of blocks) {
    if (!block.Id) continue;
    for (const relationship of block.Relationships ?? []) {
      if (relationship.Type !== "CHILD") continue;
      for (const childId of relationship.Ids ?? []) {
        parentByChildId.set(childId, block.Id);
      }
    }
  }

  const items: LayoutItem[] = [];
  const textParts: string[] = [];
  let cursor = 0;

  for (const block of blocks) {
    const level = textractLevel(block.BlockType);
    if (!level || !block.Id) continue;

    const page = pagesByNumber.get(block.Page ?? 1);
    if (!page) continue;

    const quad = textractQuad(block.Geometry, page);
    const normalizedQuad = normalizeLayoutQuad(quad, page);
    if (!normalizedQuad) continue;

    const text = textractBlockText(block, blocksById);
    const span =
      text.length > 0
        ? { start: cursor, end: cursor + text.length }
        : undefined;
    if (text.length > 0) {
      textParts.push(text);
      cursor += text.length + 1;
    }

    items.push({
      id: `textract:${block.Id}`,
      pageNumber: page.pageNumber,
      level,
      kind: textractKind(block.BlockType, text),
      text,
      confidence: normalizeConfidence(block.Confidence),
      quad: normalizedQuad,
      rect: quadToRect(normalizedQuad),
      span,
      parentId: textractParentId(block.Id, parentByChildId),
    });
  }

  return { text: textParts.join("\n"), pages, items };
}

function collectPageNumbers(blocks: TextractBlock[]): number[] {
  const numbers = new Set<number>();
  for (const block of blocks) {
    numbers.add(block.Page ?? 1);
  }
  if (numbers.size === 0) numbers.add(1);
  return [...numbers].sort((a, b) => a - b);
}

function collectMetadataPageSizes(
  input: TextractDocument,
): Map<number, { width: number; height: number }> {
  const pageSizes = new Map<number, { width: number; height: number }>();

  for (const pageSize of input.DocumentMetadata?.PageSizes ?? []) {
    const pageNumber = pageSize.Page;
    const width = finitePositiveNumber(pageSize.Width);
    const height = finitePositiveNumber(pageSize.Height);
    if (pageNumber == null || !width || !height) continue;
    pageSizes.set(pageNumber, { width, height });
  }

  return pageSizes;
}

function textractLevel(blockType: string | undefined): LayoutLevel | undefined {
  if (blockType === "LINE") return "line";
  if (blockType === "WORD") return "word";
  if (blockType && LAYOUT_BLOCK_TYPES.has(blockType)) return "block";
  return undefined;
}

function textractParentId(
  blockId: string,
  parentByChildId: Map<string, string>,
): string | undefined {
  const parentId = parentByChildId.get(blockId);
  return parentId ? `textract:${parentId}` : undefined;
}

function textractBlockText(
  block: TextractBlock,
  blocksById: Map<string, TextractBlock>,
): string {
  if (typeof block.Text === "string" && block.Text.length > 0) {
    return block.Text;
  }

  // LAYOUT_* blocks carry no Text — assemble it from their child lines.
  const childTexts: string[] = [];
  for (const relationship of block.Relationships ?? []) {
    if (relationship.Type !== "CHILD") continue;
    for (const childId of relationship.Ids ?? []) {
      const child = blocksById.get(childId);
      if (child?.Text) childTexts.push(child.Text);
    }
  }
  return childTexts.join(" ");
}

function textractQuad(
  geometry: TextractGeometry | undefined,
  page: LayoutPage,
): LayoutQuad | undefined {
  const polygon = geometry?.Polygon;
  if (polygon && polygon.length >= 4) {
    return polygon.slice(0, 4).map((point) => ({
      x: (point.X ?? 0) * page.width,
      y: (point.Y ?? 0) * page.height,
    })) as LayoutQuad;
  }

  const box = geometry?.BoundingBox;
  if (box) {
    const left = (box.Left ?? 0) * page.width;
    const top = (box.Top ?? 0) * page.height;
    const width = (box.Width ?? 0) * page.width;
    const height = (box.Height ?? 0) * page.height;
    return [
      { x: left, y: top },
      { x: left + width, y: top },
      { x: left + width, y: top + height },
      { x: left, y: top + height },
    ];
  }

  return undefined;
}

function textractKind(blockType: string | undefined, text: string): LayoutKind {
  switch (blockType) {
    case "LAYOUT_TITLE":
      return "title";
    case "LAYOUT_HEADER":
      return "header";
    case "LAYOUT_SECTION_HEADER":
      return "heading";
    case "LAYOUT_FOOTER":
      return "footer";
    case "LAYOUT_PAGE_NUMBER":
      return "pageNumber";
    case "LAYOUT_LIST":
      return "list";
    case "LAYOUT_TABLE":
      return "table";
    case "LAYOUT_FIGURE":
      return "figure";
    case "LAYOUT_TEXT":
    case "LAYOUT_KEY_VALUE":
      return "paragraph";
    default:
      return /^\d+$/.test(text.trim()) ? "pageNumber" : "other";
  }
}

function normalizeConfidence(confidence: number | undefined) {
  if (confidence == null || !Number.isFinite(confidence)) return undefined;
  // Textract reports confidence on a 0–100 scale.
  return Math.min(1, Math.max(0, confidence / 100));
}

function finitePositiveNumber(value: number | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined;
  return value;
}
