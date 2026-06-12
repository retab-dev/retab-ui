import type { Metadata } from "next"

import { PdfViewer } from "@/components/ui/pdf-viewer"

const BENCHMARK_PDF_SRC = "/samples/big-911-report.pdf"

export const metadata: Metadata = {
  title: "PDF Viewer Benchmark",
  description: "Full-screen PDF viewer benchmark harness.",
}

export default function PdfViewerBenchmarkPage() {
  return (
    <main className="h-svh min-h-0" data-testid="pdf-viewer-benchmark">
      <PdfViewer
        src={BENCHMARK_PDF_SRC}
        downloadFileName="big-911-report.pdf"
        className="h-full"
        bare
      />
    </main>
  )
}
