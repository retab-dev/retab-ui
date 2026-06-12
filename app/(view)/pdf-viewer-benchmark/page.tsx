import type { Metadata } from "next"

import { PdfViewerBenchmarkClient } from "./pdf-viewer-benchmark-client"

export const metadata: Metadata = {
  title: "PDF Viewer Benchmark",
  description: "Full-screen PDF viewer benchmark harness.",
}

export default function PdfViewerBenchmarkPage() {
  return <PdfViewerBenchmarkClient />
}
