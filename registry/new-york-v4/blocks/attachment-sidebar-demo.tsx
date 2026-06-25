"use client";

import * as React from "react";

import type { ViewerSource } from "@/lib/viewer-source";
import {
  AttachmentSidebar,
  type AttachmentSidebarItem,
} from "@/components/ui/attachment-sidebar";
import {
  FileViewer,
  FileViewerBody,
  FileViewerDocument,
  FileViewerHeader,
  FileViewerHeaderEnd,
  FileViewerHeaderStart,
  FileViewerIdentity,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarTrigger,
  FileViewerSurface,
  FileViewerToolbar,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import {
  SidebarListButton,
  SidebarListGroup,
  SidebarListGroupContent,
  SidebarListGroupLabel,
  SidebarListMenu,
  SidebarListMenuItem,
} from "@/components/ui/sidebar-list";

const attachments = [
  {
    id: "statement",
    source: {
      kind: "url",
      url: "/samples/jane-doe-bank-statement-5-pages.pdf",
      fileName: "jane-doe-bank-statement-5-pages.pdf",
    },
    label: "bank-statement.pdf",
    description: "PDF document",
    size: 812_000,
  },
  {
    id: "spreadsheet",
    source: {
      kind: "url",
      url: "/samples/nvidia-financials-fy2024.xlsx",
      fileName: "nvidia-financials-fy2024.xlsx",
    },
    label: "financials.xlsx",
    description: "Excel workbook",
    size: 142_000,
  },
  {
    id: "notes",
    source: {
      kind: "url",
      url: "/samples/release-notes.md",
      fileName: "release-notes.md",
    },
    label: "release-notes.md",
    description: "Markdown",
    size: 18_400,
  },
] satisfies readonly AttachmentSidebarItem[];

const messageBodySource = {
  kind: "text",
  fileName: "message-body.txt",
  mimeType: "text/plain",
  text: "Hi team,\n\nPlease review the attached statement, workbook, and notes before the closing call.\n\nThanks.",
} satisfies ViewerSource;

export function AttachmentSidebarExample() {
  const [selectedId, setSelectedId] = React.useState(attachments[0].id);
  const selected =
    attachments.find((attachment) => attachment.id === selectedId) ??
    attachments[0];
  const source = selectedId === "body" ? messageBodySource : selected.source;

  return (
    <div className="not-prose bg-background h-[620px] overflow-hidden rounded-xl border">
      <FileViewerProvider key={selectedId} source={source} defaultSidebarOpen>
        <FileViewer
          sidebarMode="inline"
          sidebarSide="right"
          className="bg-background h-full"
        >
          <FileViewerHeader>
            <FileViewerHeaderStart>
              <FileViewerSidebarTrigger className="-ml-1" />
              <FileViewerIdentity />
            </FileViewerHeaderStart>
            <FileViewerHeaderEnd>
              <FileViewerToolbar />
            </FileViewerHeaderEnd>
          </FileViewerHeader>
          <FileViewerBody>
            <FileViewerSurface>
              <FileViewerViewport>
                <FileViewerDocument />
              </FileViewerViewport>
            </FileViewerSurface>
            <FileViewerSidebar
              aria-label="Message attachments"
              side="right"
              width="20rem"
              className="border-l"
            >
              <AttachmentSidebar
                items={attachments}
                selectedId={selectedId}
                onSelect={setSelectedId}
                side="right"
                width="20rem"
                className="border-l-0"
              >
                <SidebarListGroup>
                  <SidebarListGroupLabel>Message</SidebarListGroupLabel>
                  <SidebarListGroupContent>
                    <SidebarListMenu>
                      <SidebarListMenuItem>
                        <SidebarListButton
                          isActive={selectedId === "body"}
                          onClick={() => {
                            setSelectedId("body");
                          }}
                        >
                          Body
                        </SidebarListButton>
                      </SidebarListMenuItem>
                    </SidebarListMenu>
                  </SidebarListGroupContent>
                </SidebarListGroup>
              </AttachmentSidebar>
            </FileViewerSidebar>
          </FileViewerBody>
        </FileViewer>
      </FileViewerProvider>
    </div>
  );
}
