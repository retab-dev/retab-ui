// Organizes the /examples tab navigation into labeled sections. "Fileviewer"
// lists the standalone viewer-block tabs; "Document Analysis" lists the
// component primitives (file-thumbnail, file-viewer, schema-builder, json-form,
// json-table). Both render through the same ViewerBlockPreview (Preview/Code).

import { getViewerBlock, VIEWER_BLOCK_TABS } from "./viewer-blocks";

export type ExampleTab = {
  id: string;
  title: string;
  href: string;
};

export type ExampleSection = {
  id: string;
  title: string;
  tabs: ExampleTab[];
};

const DOCUMENT_ANALYSIS_TAB_IDS = [
  "file-thumbnail",
  "file-viewer",
  "schema-builder",
  "json-form",
  "json-table",
] as const;

function exampleHref(id: string) {
  return `/examples/${id}`;
}

const fileviewerTabs: ExampleTab[] = VIEWER_BLOCK_TABS.map((block) => ({
  id: block.id,
  title: block.title,
  href: exampleHref(block.id),
}));

const documentAnalysisTabs: ExampleTab[] = DOCUMENT_ANALYSIS_TAB_IDS.map(
  (id) => {
    const block = getViewerBlock(id)!;
    return { id: block.id, title: block.title, href: exampleHref(block.id) };
  },
);

export const EXAMPLE_SECTIONS: readonly ExampleSection[] = [
  { id: "fileviewer", title: "Fileviewer", tabs: fileviewerTabs },
  {
    id: "document-analysis",
    title: "Document Analysis",
    tabs: documentAnalysisTabs,
  },
];

const EXAMPLE_TABS = EXAMPLE_SECTIONS.flatMap((section) => section.tabs);

export function getExampleTab(id: string): ExampleTab | undefined {
  return EXAMPLE_TABS.find((tab) => tab.id === id);
}

// Example tab ids that need their own /examples/<id> route but are not standalone
// viewer-block tabs (those are already generated from VIEWER_BLOCK_TABS).
export const DOCUMENT_ANALYSIS_EXAMPLE_IDS: readonly string[] =
  documentAnalysisTabs.map((tab) => tab.id);
