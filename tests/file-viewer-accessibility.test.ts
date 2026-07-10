// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import {
  resolveFileViewerSidebarAccessibilityProps,
  resolveFileViewerSidebarTriggerAccessibilityProps,
  restoreFileViewerSidebarFocusOnClose,
} from "@/registry/new-york-v4/ui/file-viewer-accessibility";

describe("FileViewer accessibility contract", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("hides collapsible sidebars from the accessibility tree until interactive", () => {
    expect(
      resolveFileViewerSidebarAccessibilityProps({
        collapsible: "offcanvas",
        isSidebarInteractive: false,
      }),
    ).toEqual({
      "aria-hidden": true,
      inert: true,
    });
  });

  it("exposes interactive and non-collapsible sidebars without hiding them", () => {
    expect(
      resolveFileViewerSidebarAccessibilityProps({
        collapsible: "offcanvas",
        isSidebarInteractive: true,
      }),
    ).toEqual({});
    expect(
      resolveFileViewerSidebarAccessibilityProps({
        collapsible: "none",
        isSidebarInteractive: false,
      }),
    ).toEqual({});
  });

  it("links the trigger to interactive sidebar state only when the sidebar can toggle", () => {
    expect(
      resolveFileViewerSidebarTriggerAccessibilityProps({
        ariaLabel: "Toggle sources",
        canToggleSidebar: true,
        isDisabled: false,
        isSidebarInteractive: false,
        sidebarId: "sources",
      }),
    ).toEqual({
      "aria-controls": "sources",
      "aria-disabled": undefined,
      "aria-expanded": false,
      "aria-label": "Toggle sources",
    });

    expect(
      resolveFileViewerSidebarTriggerAccessibilityProps({
        ariaLabel: "Toggle sources",
        canToggleSidebar: false,
        isDisabled: true,
        isSidebarInteractive: true,
        sidebarId: "sources",
      }),
    ).toEqual({
      "aria-controls": undefined,
      "aria-disabled": true,
      "aria-expanded": undefined,
      "aria-label": "Toggle sources",
    });
  });

  it("restores focus to the registered trigger when a focused sidebar closes", () => {
    const sidebarElement = document.createElement("aside");
    const sidebarButton = document.createElement("button");
    const sidebarTriggerElement = document.createElement("button");
    sidebarElement.append(sidebarButton);
    document.body.append(sidebarTriggerElement, sidebarElement);

    sidebarButton.focus();

    restoreFileViewerSidebarFocusOnClose({
      elements: {
        documentSurfaceElement: null,
        getDocumentSurfaceMotionProbeElement: null,
        sidebarElement,
        sidebarGapElement: null,
        sidebarTriggerElement,
        viewerShellElement: null,
      },
      isSidebarInteractive: false,
      previousIsSidebarInteractive: true,
    });

    expect(document.activeElement).toBe(sidebarTriggerElement);
  });
});
