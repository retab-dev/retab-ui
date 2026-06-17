"use client"

import type * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { showMcpDocs } from "@/lib/flags"
import { getCurrentBase, getSidebarGroupsFromFolder } from "@/lib/page-tree"
import type { source } from "@/lib/source"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

const TOP_LEVEL_SECTIONS = [
  { name: "Introduction", href: "/docs" },
  {
    name: "Components",
    href: "/docs/components",
  },
]
const EXCLUDED_SECTIONS: string[] = []
const EXCLUDED_PAGES = ["/docs"]

export function DocsSidebar({
  tree,
  ...props
}: React.ComponentProps<typeof Sidebar> & { tree: typeof source.pageTree }) {
  const pathname = usePathname()
  const currentBase = getCurrentBase(pathname)

  return (
    <Sidebar
      className="sticky top-[calc(var(--header-height)+0.6rem)] z-30 hidden h-[calc(100svh-10rem)] overscroll-none bg-transparent [--sidebar-menu-width:--spacing(56)] lg:flex"
      collapsible="none"
      {...props}
    >
      <div className="h-9" />
      <div className="absolute top-8 z-10 h-8 w-(--sidebar-menu-width) shrink-0 bg-linear-to-b from-background via-background/80 to-background/50 blur-xs" />
      <div className="absolute top-12 right-2 bottom-0 hidden h-full w-px bg-linear-to-b from-transparent via-border to-transparent lg:flex" />
      <SidebarContent className="mx-auto no-scrollbar w-(--sidebar-menu-width) overflow-x-hidden px-2">
        <SidebarGroup className="pt-6">
          <SidebarGroupLabel className="font-medium text-muted-foreground">
            Sections
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {TOP_LEVEL_SECTIONS.map(({ name, href }) => {
                if (!showMcpDocs && href.includes("/mcp")) {
                  return null
                }
                return (
                  <SidebarMenuItem key={name}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        href === "/docs"
                          ? pathname === href
                          : pathname.startsWith(href)
                      }
                      className="relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent 3xl:fixed:w-full 3xl:fixed:max-w-48"
                    >
                      <Link href={href}>
                        <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
                        {name}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {tree.children.map((item) => {
          if (EXCLUDED_SECTIONS.includes(item.$id ?? "")) {
            return null
          }

          const groups =
            item.type === "folder"
              ? getSidebarGroupsFromFolder(item, currentBase)
                  .map((group) => ({
                    ...group,
                    pages: group.pages.filter((page) => {
                      if (!showMcpDocs && page.url.includes("/mcp")) {
                        return false
                      }

                      return !EXCLUDED_PAGES.includes(page.url)
                    }),
                  }))
                  .filter(
                    (group) =>
                      group.pages.length > 0 ||
                      (group.sections?.length ?? 0) > 0
                  )
              : []

          if (groups.length === 0) {
            return null
          }

          return groups.map((group) => (
            <SidebarGroup key={group.id}>
              {group.url ? (
                <SidebarGroupLabel
                  asChild
                  className={cn(
                    "font-medium text-muted-foreground",
                    "transition-colors hover:text-foreground data-[active=true]:text-foreground"
                  )}
                  data-active={pathname === group.url}
                >
                  <Link href={group.url}>{group.name}</Link>
                </SidebarGroupLabel>
              ) : (
                <SidebarGroupLabel className="font-medium text-muted-foreground">
                  {group.name}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                {item.type === "folder" ? (
                  <SidebarMenu className="gap-0.5">
                    {group.pages.map((page) => (
                      <DocsSidebarPageItem
                        key={page.url}
                        page={page}
                        pathname={pathname}
                      />
                    ))}
                    {group.sections?.map((section) => (
                      <SidebarMenuItem key={section.id} className="relative">
                        {section.url ? (
                          <SidebarMenuButton
                            asChild
                            isActive={section.url === pathname}
                            className={cn(
                              "relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent 3xl:fixed:w-full 3xl:fixed:max-w-48"
                            )}
                          >
                            <Link href={section.url}>
                              <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
                              {section.name}
                            </Link>
                          </SidebarMenuButton>
                        ) : (
                          <div className="flex h-[30px] items-center px-2 text-[0.8rem] font-medium text-muted-foreground">
                            {section.name}
                          </div>
                        )}
                        <SidebarMenuSub className="mx-0 ml-3 gap-0.5 py-0">
                          {section.pages.map((page) => (
                            <SidebarMenuSubItem
                              key={page.url}
                              className="relative"
                            >
                              <SidebarMenuSubButton
                                asChild
                                isActive={page.url === pathname}
                                className="relative h-[28px] w-fit overflow-visible border border-transparent text-[0.78rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent"
                              >
                                <Link href={page.url}>
                                  <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
                                  {page.name}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                ) : null}
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        })}
        <div className="sticky -bottom-1 z-10 h-16 shrink-0 bg-linear-to-t from-background via-background/80 to-background/50 blur-xs" />
      </SidebarContent>
    </Sidebar>
  )
}

function DocsSidebarPageItem({
  page,
  pathname,
}: {
  page: { name: React.ReactNode; url: string }
  pathname: string
}) {
  return (
    <SidebarMenuItem key={page.url} className="relative">
      <SidebarMenuButton
        asChild
        isActive={page.url === pathname}
        className={cn(
          "relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent 3xl:fixed:w-full 3xl:fixed:max-w-48"
        )}
      >
        <Link href={page.url}>
          <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
          {page.name}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
