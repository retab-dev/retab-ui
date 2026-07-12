// Metadata for the interactive component showcases shared by the homepage hero
// (app/(app)/(root)/showcase.tsx) and the "Document Analysis" section of the
// /examples page. The matching panel components live in
// components/showcase-panels.tsx, keyed by the same ids.

export const SHOWCASE_ITEMS = [
  {
    id: "sources-viewer",
    title: "Sources",
    description:
      "Field-to-source linking: hover a value to highlight where it came from in the document.",
  },
  {
    id: "file-thumbnail",
    title: "File Thumbnail",
    description:
      "Real first-page previews for PDFs, Office files, images, and text, rendered client-side.",
  },
  {
    id: "file-viewer",
    title: "File Viewer",
    description:
      "One viewer shell that switches between document, image, spreadsheet, text, code, and archive-backed formats.",
  },
  {
    id: "ocr",
    title: "OCR",
    description:
      "A scanned document beside detected text blocks, confidence, and source polygons.",
  },
  {
    id: "schema-builder",
    title: "Schema Builder",
    description:
      "Visual JSON Schema editing for shaping the structure your extractions follow.",
  },
  {
    id: "json-form",
    title: "JSON Form Field",
    description:
      "Schema-driven, virtualized form fields that stay responsive across thousands of fields.",
  },
  {
    id: "json-table",
    title: "JSON Table",
    description: "Renders JSON data inside virtualized, editable tables.",
  },
] as const;

export type ShowcaseItemId = (typeof SHOWCASE_ITEMS)[number]["id"];

export function getShowcaseItem(itemId: string) {
  return SHOWCASE_ITEMS.find((item) => item.id === itemId);
}
