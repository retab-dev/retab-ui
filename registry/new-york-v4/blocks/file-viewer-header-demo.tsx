"use client"

import {
  FileViewer,
  FileViewerBody,
  FileViewerControls,
  FileViewerDocument,
  FileViewerHeader,
  FileViewerMeta,
  FileViewerSidebar,
  FileViewerSidebarTrigger,
  FileViewerSurface,
  FileViewerTitle,
} from "@/components/ui/file-viewer"
import {
  SidebarListButton,
  SidebarListContent,
  SidebarListGroup,
  SidebarListGroupContent,
  SidebarListGroupLabel,
  SidebarListHeader,
  SidebarListMenu,
  SidebarListMenuItem,
} from "@/components/ui/sidebar-list"

const source = {
  kind: "url" as const,
  url: "/samples/spacex-prospectus.pdf",
  fileName: "spacex-prospectus.pdf",
}

export function FileViewerHeaderExample() {
  return (
    <div className="not-prose h-[560px] overflow-hidden rounded-xl border bg-background">
      <FileViewer
        source={source}
        defaultOpen
        mode="inline"
        className="h-full bg-background"
      >
        <FileViewerHeader>
          <FileViewerSidebarTrigger className="-ml-1" />
          <FileViewerTitle />
          <FileViewerMeta />
          <FileViewerControls />
        </FileViewerHeader>
        <FileViewerBody>
          <FileViewerSidebar
            aria-label="Review sections"
            width="18rem"
            className="border-r bg-sidebar"
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
            <FileViewerDocument />
          </FileViewerSurface>
        </FileViewerBody>
      </FileViewer>
    </div>
  )
}
