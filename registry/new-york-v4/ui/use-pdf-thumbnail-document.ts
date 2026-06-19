"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import {
  readPdfDocumentResource,
  releasePdfDocumentResource,
  retainPdfDocumentResource,
} from "@/lib/pdf-document-resource";
import type { ViewerResource } from "@/lib/viewer-resource";

export function usePdfThumbnailDocument(resource: ViewerResource) {
  const content = resource.content;
  const doc = readPdfDocumentResource(content);

  React.useEffect(() => {
    retainPdfDocumentResource(content, doc);
    return () => releasePdfDocumentResource(content, doc);
  }, [content, doc]);

  return doc;
}
