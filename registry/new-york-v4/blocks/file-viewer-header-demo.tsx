"use client";

import {
  FileViewer,
  FileViewerContent,
  FileViewerDocument,
  FileViewerHeader,
  FileViewerTitle,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarTrigger,
  FileViewerInset,
  FileViewerControls,
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
        <FileViewer className="bg-background h-full">
          <FileViewerHeader>
              <FileViewerSidebarTrigger className="-ml-1" />
              <FileViewerTitle />
              <FileViewerControls />
          </FileViewerHeader>
          <FileViewerContent>
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
            <FileViewerInset>
              <FileViewerViewport>
                <FileViewerDocument />
              </FileViewerViewport>
            </FileViewerInset>
          </FileViewerContent>
        </FileViewer>
      </FileViewerProvider>
    </div>
  );
}
