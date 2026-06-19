// @vitest-environment jsdom

import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttachmentSidebar } from "@/registry/new-york-v4/ui/attachment-sidebar";

vi.mock("@/registry/new-york-v4/ui/file-thumbnail", () => ({
  FileThumbnail: ({
    source,
    presentation,
  }: {
    source?: { fileName?: string };
    presentation?: string;
  }) => (
    <div data-presentation={presentation} data-testid="file-thumbnail">
      {source?.fileName ?? "file"}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function textSource(text: string, fileName: string) {
  return {
    kind: "text" as const,
    text,
    fileName,
    mimeType: "text/plain",
  };
}

describe("AttachmentSidebar", () => {
  it("renders selectable file attachments with sidebar semantics", () => {
    const handleSelect = vi.fn();

    const { container } = render(
      <AttachmentSidebar
        items={[
          {
            id: "brief",
            source: textSource("Brief", "brief.txt"),
            size: 1536,
          },
        ]}
        selectedId="brief"
        onSelect={handleSelect}
      />,
    );

    const sidebar = container.querySelector('[data-slot="attachment-sidebar"]');
    expect(sidebar).toBeTruthy();
    expect(container.querySelector('[data-slot="sidebar-wrapper"]')).toBeNull();
    expect(sidebar?.getAttribute("data-sidebar-list")).toBe("");

    const button = screen.getByRole("button", { name: /brief\.txt.*1\.5 KB/i });
    expect(button.getAttribute("aria-current")).toBe("page");
    expect(screen.getByTestId("file-thumbnail").dataset.presentation).toBe(
      "decorative",
    );

    fireEvent.click(button);
    expect(handleSelect).toHaveBeenCalledWith("brief");
  });

  it("renders a caller-provided domain group before the attachment group", () => {
    render(
      <AttachmentSidebar items={[]} emptyLabel="No regular attachments.">
        <div data-testid="domain-group">Message body</div>
      </AttachmentSidebar>,
    );

    expect(screen.getByTestId("domain-group")).toBeTruthy();
    expect(screen.getByText("No regular attachments.")).toBeTruthy();
  });
});
