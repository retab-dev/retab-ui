"use client";

import * as React from "react";
import {
  FileText,
  FolderOpen,
  Inbox,
  Lock,
  type LucideIcon,
} from "lucide-react";

import {
  SidebarListButton,
  SidebarListContent,
  SidebarListGroup,
  SidebarListGroupContent,
  SidebarListGroupLabel,
  SidebarListHeader,
  SidebarListMenu,
  SidebarListMenuItem,
  SidebarListRoot,
  SidebarListSeparator,
} from "@/components/ui/sidebar-list";

type SidebarListDemoItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
};

type SidebarListDemoGroup = {
  label: string;
  items: readonly SidebarListDemoItem[];
};

const groups: readonly SidebarListDemoGroup[] = [
  {
    label: "Inbox",
    items: [
      { id: "contracts", label: "Contracts", icon: Inbox },
      { id: "statements", label: "Bank statements", icon: FolderOpen },
      { id: "reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Archive",
    items: [
      { id: "locked", label: "Locked packet", icon: Lock, disabled: true },
    ],
  },
];

export function SidebarListExample() {
  const [activeId, setActiveId] = React.useState("statements");

  return (
    <div className="not-prose bg-background h-[420px] max-w-sm overflow-hidden rounded-xl border">
      <SidebarListRoot width="20rem">
        <SidebarListHeader className="border-b px-3 py-2">
          <div className="text-sm font-medium">Document workspace</div>
          <div className="text-muted-foreground text-xs">
            Providerless grouped rows for embedded rails.
          </div>
        </SidebarListHeader>
        <SidebarListContent>
          {groups.map((group, index) => (
            <React.Fragment key={group.label}>
              {index > 0 ? <SidebarListSeparator /> : null}
              <SidebarListGroup>
                <SidebarListGroupLabel>{group.label}</SidebarListGroupLabel>
                <SidebarListGroupContent>
                  <SidebarListMenu>
                    {group.items.map((item) => {
                      const Icon = item.icon;

                      return (
                        <SidebarListMenuItem key={item.id}>
                          <SidebarListButton
                            disabled={item.disabled}
                            isActive={activeId === item.id}
                            onClick={() => setActiveId(item.id)}
                          >
                            <Icon aria-hidden className="size-4" />
                            <span>{item.label}</span>
                          </SidebarListButton>
                        </SidebarListMenuItem>
                      );
                    })}
                  </SidebarListMenu>
                </SidebarListGroupContent>
              </SidebarListGroup>
            </React.Fragment>
          ))}
        </SidebarListContent>
      </SidebarListRoot>
    </div>
  );
}
