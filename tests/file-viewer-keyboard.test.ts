// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  isFileViewerActiveElementInsideShell,
  shouldCloseFileViewerSidebarOnEscape,
} from "@/registry/new-york-v4/ui/file-viewer-keyboard";

describe("FileViewer keyboard contract", () => {
  it("closes an open toggleable sidebar on a fresh Escape event", () => {
    expect(
      shouldCloseFileViewerSidebarOnEscape({
        canToggleSidebar: true,
        event: new KeyboardEvent("keydown", { key: "Escape" }),
        isSidebarInteractive: true,
      }),
    ).toBe(true);
  });

  it("ignores Escape when the sidebar is already non-interactive or event is repeating", () => {
    expect(
      shouldCloseFileViewerSidebarOnEscape({
        canToggleSidebar: true,
        event: new KeyboardEvent("keydown", { key: "Escape" }),
        isSidebarInteractive: false,
      }),
    ).toBe(false);

    expect(
      shouldCloseFileViewerSidebarOnEscape({
        canToggleSidebar: true,
        event: new KeyboardEvent("keydown", { key: "Escape", repeat: true }),
        isSidebarInteractive: true,
      }),
    ).toBe(false);
  });

  it("checks focus containment through registered elements", () => {
    const viewerShellElement = document.createElement("div");
    const activeElement = document.createElement("button");
    viewerShellElement.append(activeElement);

    expect(
      isFileViewerActiveElementInsideShell({
        activeElement,
        viewerShellElement,
      }),
    ).toBe(true);

    expect(
      isFileViewerActiveElementInsideShell({
        activeElement: document.createElement("button"),
        viewerShellElement,
      }),
    ).toBe(false);
  });
});
