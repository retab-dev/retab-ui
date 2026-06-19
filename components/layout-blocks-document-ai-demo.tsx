"use client";

import * as React from "react";

import { useMountEffect } from "@/hooks/use-mount-effect";
import {
  DocumentAiLayoutBlocks,
  type DocumentAiDocument,
} from "@/components/ui/layout-blocks";

export function DocumentAiLayoutBlocksDemo() {
  const [output, setOutput] = React.useState<DocumentAiDocument | null>(null);

  useMountEffect(() => {
    let active = true;
    void import("@/sample/documentai-output.json").then((module) => {
      if (active) setOutput(module.default as DocumentAiDocument);
    });
    return () => {
      active = false;
    };
  });

  if (!output) return null;
  return <DocumentAiLayoutBlocks output={output} />;
}
