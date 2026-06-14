"use client"

import * as React from "react"
import {
  ArrowLeft,
  ArrowRight,
  Columns3,
  Grid3X3,
  List,
  Search,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type {
  FileSystemBrowserState,
  FileSystemHeaderState,
} from "./file-system-browser-state"
import { pathName } from "./file-system-index"
import { normalizeFileSystemSearch } from "./file-system-query"
import type { FileSystemSortKey, FileSystemView } from "./file-system-types"
import { ViewerSidebarTrigger } from "./viewer"

const VIEW_OPTIONS: Array<{
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: FileSystemView
}> = [
  { icon: List, label: "List", value: "list" },
  { icon: Grid3X3, label: "Grid", value: "grid" },
  { icon: Columns3, label: "Columns", value: "columns" },
]

const SORT_OPTIONS: Array<{
  label: string
  value: FileSystemSortKey
}> = [
  { label: "Name", value: "name" },
  { label: "Type", value: "kind" },
  { label: "Size", value: "size" },
  { label: "Modified", value: "updatedAt" },
]

export function FileSystemToolbar({
  canGoBack,
  canGoForward,
  currentPath,
  goBack,
  goForward,
  query,
  setSearch,
  setView,
  title,
  view,
}: {
  canGoBack: FileSystemHeaderState["canGoBack"]
  canGoForward: FileSystemHeaderState["canGoForward"]
  currentPath: FileSystemHeaderState["currentPath"]
  goBack: FileSystemHeaderState["goBack"]
  goForward: FileSystemHeaderState["goForward"]
  query: FileSystemHeaderState["query"]
  setSearch: FileSystemHeaderState["setSearch"]
  setView: FileSystemHeaderState["setView"]
  title: FileSystemHeaderState["title"]
  view: FileSystemHeaderState["view"]
}) {
  const currentFolderName =
    currentPath === "" ? title : pathName(currentPath) || title

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-muted/35 px-2">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <ViewerSidebarTrigger />
        <Button
          aria-label="Back"
          disabled={!canGoBack}
          onClick={goBack}
          size="icon-sm"
          variant="ghost"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <Button
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={goForward}
          size="icon-sm"
          variant="ghost"
        >
          <ArrowRight className="size-4" aria-hidden />
        </Button>
        <div className="min-w-0 px-1">
          <div className="truncate text-sm font-semibold">
            {currentFolderName}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {currentPath || "/"}
          </div>
        </div>
      </div>
      <Tabs
        value={view}
        onValueChange={(nextView) => setView(nextView as FileSystemView)}
        className="hidden gap-0 md:flex"
      >
        <TabsList className="h-8 p-0.5">
          {VIEW_OPTIONS.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              aria-label={`${option.label} view`}
              title={`${option.label} view`}
              className="h-7 px-2"
            >
              <option.icon className="size-4" aria-hidden />
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="relative w-52 min-w-0 max-sm:w-36">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          aria-label="Search files"
          className="[&_input]:pl-7"
          nativeInput
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          size="sm"
          type="search"
          value={query.search}
        />
      </div>
    </div>
  )
}

export function FileSystemCommandBar({
  controller,
}: {
  controller: FileSystemHeaderState
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1.5">
      <FileSystemSortControls controller={controller} />
    </div>
  )
}

export function FileSystemSortControls({
  controller,
}: {
  controller: FileSystemHeaderState
}) {
  return (
    <>
      {SORT_OPTIONS.map((option) => {
        const isActive = controller.query.sort.key === option.value

        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            onClick={() => controller.setSortKey(option.value)}
            className={cn(
              "flex h-6 shrink-0 items-center gap-1 rounded-sm border px-2 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-muted-foreground"
            )}
          >
            <span>{option.label}</span>
            {isActive ? (
              <span aria-hidden>
                {controller.query.sort.direction === "asc" ? "↑" : "↓"}
              </span>
            ) : null}
          </button>
        )
      })}
    </>
  )
}

export function FileSystemStatusBar({
  browser,
}: {
  browser: FileSystemBrowserState
}) {
  const itemCount = browser.entries.length
  const isSearching = normalizeFileSystemSearch(browser.query.search).length > 0
  const selectedEntry = browser.selection.selectedEntry

  return (
    <div
      aria-live="polite"
      className="flex h-8 shrink-0 items-center justify-between gap-3 border-t bg-muted/35 px-3 text-xs text-muted-foreground"
    >
      <span>
        {itemCount}{" "}
        {isSearching
          ? itemCount === 1
            ? "result"
            : "results"
          : itemCount === 1
            ? "item"
            : "items"}
      </span>
      {selectedEntry ? (
        <span className="min-w-0 truncate">{selectedEntry.name} selected</span>
      ) : null}
    </div>
  )
}
