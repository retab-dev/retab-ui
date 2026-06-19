import type { Metadata } from "next";

import type { PdfViewerPerformanceOptions } from "@/components/ui/pdf-viewer";

import { PdfViewerBenchmarkClient } from "./pdf-viewer-benchmark-client";

export const metadata: Metadata = {
  title: "PDF Viewer Benchmark",
  description: "Full-screen PDF viewer benchmark harness.",
};

type PdfViewerBenchmarkPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PdfViewerBenchmarkPage({
  searchParams,
}: PdfViewerBenchmarkPageProps) {
  const params = (await searchParams) ?? {};
  const variant = normalizePdfBenchmarkVariant(
    readSearchParam(params, "variant") ?? readSearchParam(params, "pdfPerf"),
  );

  return (
    <PdfViewerBenchmarkClient
      performanceOptions={getPdfBenchmarkPerformanceOptions(variant)}
      variant={variant}
    />
  );
}

function readSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function normalizePdfBenchmarkVariant(value: string | undefined) {
  if (
    value === "baseline" ||
    value === "cache" ||
    value === "prerender" ||
    value === "imperative" ||
    value === "default"
  ) {
    return value;
  }
  return "default";
}

function getPdfBenchmarkPerformanceOptions(
  variant: ReturnType<typeof normalizePdfBenchmarkVariant>,
): PdfViewerPerformanceOptions {
  if (variant === "baseline") {
    return {
      renderedPageCache: false,
      directionAwarePreRender: false,
      imperativePageLayer: false,
    };
  }
  if (variant === "cache") {
    return {
      renderedPageCache: true,
      directionAwarePreRender: false,
      imperativePageLayer: false,
    };
  }
  if (variant === "prerender") {
    return {
      renderedPageCache: false,
      directionAwarePreRender: true,
      imperativePageLayer: false,
    };
  }
  if (variant === "imperative") {
    return {
      renderedPageCache: false,
      directionAwarePreRender: false,
      imperativePageLayer: true,
    };
  }
  return {
    renderedPageCache: true,
    directionAwarePreRender: true,
    imperativePageLayer: true,
  };
}
