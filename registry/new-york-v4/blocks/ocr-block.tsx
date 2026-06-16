"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  OcrLayoutBlocks,
  type AzureDocument,
  type DocumentAiDocument,
  type OcrSource,
  type TextractDocument,
} from "@/components/ui/layout-blocks"

type ProviderId = OcrSource["provider"]

/**
 * OCR block — a scanned document beside its detected text blocks, confidence,
 * and source polygons. The same viewer renders output from any supported OCR
 * provider; pick one to see its normalized layout.
 *
 * Samples are loaded on demand with dynamic imports (the Document AI sample is
 * ~21 MB) so they stay off the page's initial JavaScript.
 */
const PROVIDERS: {
  id: ProviderId
  label: string
  load: () => Promise<{ default: unknown }>
}[] = [
  {
    id: "google-document-ai",
    label: "Google Document AI",
    load: () => import("@/sample/documentai-output.json"),
  },
  {
    id: "aws-textract",
    label: "AWS Textract",
    load: () => import("@/sample/textract-output.json"),
  },
  {
    id: "azure-document-intelligence",
    label: "Azure Document Intelligence",
    load: () => import("@/sample/azure-output.json"),
  },
]

export function OcrBlock() {
  const [provider, setProvider] = React.useState<ProviderId>(
    "google-document-ai"
  )
  const [outputs, setOutputs] = React.useState<
    Partial<Record<ProviderId, unknown>>
  >({})

  React.useEffect(() => {
    if (outputs[provider]) return
    let active = true
    const entry = PROVIDERS.find((item) => item.id === provider)
    void entry?.load().then((module) => {
      if (active) {
        setOutputs((current) => ({ ...current, [provider]: module.default }))
      }
    })
    return () => {
      active = false
    }
  }, [outputs, provider])

  const output = outputs[provider]
  const source = React.useMemo<OcrSource | null>(
    () => (output ? toOcrSource(provider, output) : null),
    [output, provider]
  )

  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
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
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading OCR sample…
          </div>
        )}
      </div>
    </div>
  )
}

function toOcrSource(provider: ProviderId, output: unknown): OcrSource {
  switch (provider) {
    case "aws-textract":
      return { provider, output: output as TextractDocument }
    case "azure-document-intelligence":
      return { provider, output: output as AzureDocument }
    case "google-document-ai":
    default:
      return {
        provider: "google-document-ai",
        output: output as DocumentAiDocument,
      }
  }
}
