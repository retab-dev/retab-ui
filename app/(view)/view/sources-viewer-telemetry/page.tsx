import type { Metadata } from "next";

import { JsonFormSourcesBlock } from "@/registry/new-york-v4/blocks/json-form-sources-block";
import { FileViewerTelemetryWidget } from "@/components/file-viewer-telemetry-widget";

export const metadata: Metadata = {
  title: "Sources Viewer Telemetry",
  description:
    "The sources FileViewer with the sidebar-motion telemetry button and results popover.",
};

export default function SourcesViewerTelemetryPage() {
  return (
    <main className="h-dvh bg-black p-4">
      <div className="bg-background relative h-full overflow-hidden rounded-lg border">
        <JsonFormSourcesBlock />
        <FileViewerTelemetryWidget />
      </div>
    </main>
  );
}
