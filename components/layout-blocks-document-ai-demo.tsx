"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import {
  DocumentAiLayoutBlocks,
  type DocumentAiDocument,
} from "@/components/ui/layout-blocks";

export function DocumentAiLayoutBlocksDemo() {
  const [output, setOutput] = React.useState<DocumentAiDocument | null>(null);

  React.useEffect(() => {
    let active = true;
    void import("@/sample/documentai-output.json").then((module) => {
      if (active) setOutput(module.default as DocumentAiDocument);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!output) return null;
  return <DocumentAiLayoutBlocks output={output} />;
}
