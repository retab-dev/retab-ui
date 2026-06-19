"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { cn } from "@/lib/utils";
import {
  documentAiPageImages,
  OcrLayoutBlocks,
  type AzureDocument,
  type DocumentAiDocument,
  type OcrSource,
  type TextractDocument,
} from "@/components/ui/layout-blocks";

type ProviderId = OcrSource["provider"];
type ProviderSample = {
  output: unknown;
  pageImageOutput?: DocumentAiDocument;
};

/**
 * OCR block — a scanned document beside its detected text blocks, confidence,
 * and source polygons. The same viewer renders output from any supported OCR
 * provider; pick one to see its normalized layout.
 *
 * Samples are loaded on demand with dynamic imports (the Document AI sample is
 * ~21 MB) so they stay off the page's initial JavaScript.
 */
const PROVIDERS: {
  id: ProviderId;
  label: string;
  load: () => Promise<ProviderSample>;
}[] = [
  {
    id: "google-document-ai",
    label: "Google Document AI",
    load: async () => {
      const output = await import("@/sample/documentai-output.json");
      return { output: output.default };
    },
  },
  {
    id: "aws-textract",
    label: "AWS Textract",
    load: async () => {
      const [output, pageImageOutput] = await Promise.all([
        import("@/sample/textract-output.json"),
        import("@/sample/documentai-output.json"),
      ]);
      return {
        output: output.default,
        pageImageOutput: pageImageOutput.default as DocumentAiDocument,
      };
    },
  },
  {
    id: "azure-document-intelligence",
    label: "Azure Document Intelligence",
    load: async () => {
      const [output, pageImageOutput] = await Promise.all([
        import("@/sample/azure-output.json"),
        import("@/sample/documentai-output.json"),
      ]);
      return {
        output: output.default,
        pageImageOutput: pageImageOutput.default as DocumentAiDocument,
      };
    },
  },
];

export function OcrBlock() {
  const [provider, setProvider] =
    React.useState<ProviderId>("google-document-ai");
  const [outputs, setOutputs] = React.useState<
    Partial<Record<ProviderId, ProviderSample>>
  >({});

  useKeyedMountEffect(`ocr-provider:${provider}`, () => {
    if (outputs[provider]) return;
    let active = true;
    const entry = PROVIDERS.find((item) => item.id === provider);
    void entry?.load().then((sample) => {
      if (active) {
        setOutputs((current) => ({ ...current, [provider]: sample }));
      }
    });
    return () => {
      active = false;
    };
  });

  const sample = outputs[provider];
  const source = React.useMemo<OcrSource | null>(
    () => (sample ? toOcrSource(provider, sample) : null),
    [sample, provider],
  );

  return (
    <div className="bg-background flex h-full min-h-[680px] flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b p-2">
        {PROVIDERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setProvider(item.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              provider === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {source ? (
          <OcrLayoutBlocks heightClassName="h-full" source={source} />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Loading OCR sample…
          </div>
        )}
      </div>
    </div>
  );
}

function toOcrSource(provider: ProviderId, sample: ProviderSample): OcrSource {
  const pageImages = sample.pageImageOutput
    ? documentAiPageImages(sample.pageImageOutput)
    : undefined;

  switch (provider) {
    case "aws-textract":
      return {
        provider,
        output: sample.output as TextractDocument,
        pageImages,
      };
    case "azure-document-intelligence":
      return {
        provider,
        output: sample.output as AzureDocument,
        pageImages,
      };
    case "google-document-ai":
    default:
      return {
        provider: "google-document-ai",
        output: sample.output as DocumentAiDocument,
      };
  }
}
