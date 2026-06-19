"use client";

import { ImageViewer } from "@/components/ui/image-viewer";

export function ImageViewerDemo() {
  return (
    <div className="h-[600px] min-h-0">
      <ImageViewer
        source={{
          kind: "url",
          url: "/samples/entropy.tiff",
          fileName: "entropy.tiff",
        }}
        fallbackFrameSize={{ width: 1275, height: 1650 }}
        bare
        className="h-full"
      />
    </div>
  );
}
