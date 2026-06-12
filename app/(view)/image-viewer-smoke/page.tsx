import { ImageViewer } from "@/components/ui/image-viewer"

export default function ImageViewerSmokePage() {
  return (
    <main className="h-svh min-h-0" data-testid="image-viewer-smoke">
      <ImageViewer
        src="/samples/nvidia-10q-scan.tiff"
        downloadFileName="nvidia-10q-scan.tiff"
        className="h-full"
      />
    </main>
  )
}
