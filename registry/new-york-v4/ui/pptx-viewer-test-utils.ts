import { resetPptxRendererModules } from "./pptx-viewer-renderer";
import { disposePptxSourceCache } from "./pptx-viewer-source";

export function resetPptxViewerForTests() {
  disposePptxSourceCache();
  resetPptxRendererModules();
}
