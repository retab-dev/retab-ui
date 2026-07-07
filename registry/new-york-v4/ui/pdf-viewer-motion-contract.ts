"use client";

export const PDF_DOCUMENT_MOTION_SCALE_PROPERTY =
  "--pdf-viewer-document-motion-scale";

// Reading marker's offset (px) within the render window (readingBlock − window
// top). During a fit-width slide each page grows vertically (scaleY) from the
// window top, so page-slot projection offsets each page around this marker to
// hold the reading content in place without moving the surface box.
export const PDF_DOCUMENT_ANCHOR_WINDOW_BLOCK_PROPERTY =
  "--pdf-viewer-document-anchor-window-block";
