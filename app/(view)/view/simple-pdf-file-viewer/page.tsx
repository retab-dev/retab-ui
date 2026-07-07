import type { Metadata } from "next";

import { SimplePdfFileViewer } from "@/components/simple-pdf-file-viewer";

export const metadata: Metadata = {
  title: "Simple PDF File Viewer",
  description:
    "Standalone PDF-only FileViewer playground without virtualization.",
};

export default function SimplePdfFileViewerPage() {
  return (
    <main className="h-dvh bg-black p-4 text-white">
      <SimplePdfFileViewer />
    </main>
  );
}
