"use client";

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
  SidebarListContent,
  SidebarListGroup,
  SidebarListGroupContent,
  SidebarListGroupLabel,
  SidebarListHeader,
  SidebarListMenu,
  SidebarListMenuItem,
} from "@/components/ui/sidebar-list";

const source = {
  kind: "url" as const,
  url: "/samples/spacex-prospectus.pdf",
  fileName: "spacex-prospectus.pdf",
};

export function FileViewerHeaderExample() {
  return (
    <div className="not-prose bg-background h-[560px] overflow-hidden rounded-xl border">
      <FileViewerProvider source={source} defaultSidebarOpen>
        <FileViewer sidebarMode="inline" className="bg-background h-full">
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
            <FileViewerSidebar
              aria-label="Review sections"
              width="18rem"
              className="bg-sidebar border-r"
            >
              <SidebarListHeader className="border-b px-3 py-2 text-xs font-medium">
                Review queue
              </SidebarListHeader>
              <SidebarListContent>
                <SidebarListGroup>
                  <SidebarListGroupLabel>Sections</SidebarListGroupLabel>
                  <SidebarListGroupContent>
                    <SidebarListMenu>
                      <SidebarListMenuItem>
                        <SidebarListButton isActive>
                          Executive summary
                        </SidebarListButton>
                      </SidebarListMenuItem>
                      <SidebarListMenuItem>
                        <SidebarListButton>Risk factors</SidebarListButton>
                      </SidebarListMenuItem>
                      <SidebarListMenuItem>
                        <SidebarListButton>Financials</SidebarListButton>
                      </SidebarListMenuItem>
                    </SidebarListMenu>
                  </SidebarListGroupContent>
                </SidebarListGroup>
              </SidebarListContent>
            </FileViewerSidebar>
            <FileViewerSurface>
              <FileViewerViewport>
                <FileViewerDocument />
              </FileViewerViewport>
            </FileViewerSurface>
          </FileViewerBody>
        </FileViewer>
      </FileViewerProvider>
    </div>
  );
}
