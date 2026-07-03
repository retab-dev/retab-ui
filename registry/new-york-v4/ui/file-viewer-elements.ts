"use client";

import type {
  FileViewerDocumentSurface,
  FileViewerMotionKernel,
} from "./file-viewer-motion-kernel";

export const FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT =
  "file-viewer:before-layout-motion";

export type FileViewerElements = {
  documentSurfaceElement: HTMLElement | null;
  sidebarElement: HTMLElement | null;
  sidebarGapElement: HTMLDivElement | null;
  sidebarTriggerElement: HTMLElement | null;
  viewerShellElement: HTMLDivElement | null;
};

export type FileViewerElementRegistry = {
  getElements: () => FileViewerElements;
  registerDocumentSurface: (surface: FileViewerDocumentSurface) => () => void;
  registerSidebarElement: (element: HTMLElement | null) => void;
  registerSidebarGapElement: (element: HTMLDivElement | null) => void;
  registerSidebarTriggerElement: (element: HTMLElement | null) => void;
  registerViewerShellElement: (element: HTMLDivElement | null) => void;
};

export function createFileViewerElementRegistry({
  motionKernel,
  onViewerShellElementChange,
}: {
  motionKernel: FileViewerMotionKernel;
  onViewerShellElementChange: (element: HTMLDivElement | null) => void;
}): FileViewerElementRegistry {
  const elements: FileViewerElements = {
    documentSurfaceElement: null,
    sidebarElement: null,
    sidebarGapElement: null,
    sidebarTriggerElement: null,
    viewerShellElement: null,
  };
  let documentSurfaceRegistration = 0;

  return {
    getElements: () => elements,
    registerDocumentSurface: (surface) => {
      documentSurfaceRegistration += 1;
      const registration = documentSurfaceRegistration;
      elements.documentSurfaceElement = surface.element;
      motionKernel.setDocumentSurface(surface);
      return () => {
        if (documentSurfaceRegistration !== registration) return;
        elements.documentSurfaceElement = null;
        motionKernel.setDocumentSurface(null);
      };
    },
    registerSidebarElement: (element) => {
      if (elements.sidebarElement === element) return;
      elements.sidebarElement = element;
    },
    registerSidebarGapElement: (element) => {
      if (elements.sidebarGapElement === element) return;
      elements.sidebarGapElement = element;
      motionKernel.setSidebarGapElement(element);
    },
    registerSidebarTriggerElement: (element) => {
      elements.sidebarTriggerElement = element;
    },
    registerViewerShellElement: (element) => {
      if (elements.viewerShellElement === element) return;
      elements.viewerShellElement = element;
      onViewerShellElementChange(element);
    },
  };
}
