"use client"

import * as React from "react"
import {
  ArrowLeft,
  ArrowRight,
  Columns3,
  Filter,
  Grid3X3,
  Image,
  List,
  Search,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { FileSystemController } from "./file-system-controller"
import { pathName } from "./file-system-index"
import {
  dateModifiedFilterLabel,
  getFileSystemCategoryLabel,
  normalizeFileSystemSearch,
} from "./file-system-query"
import type { FileSystemView } from "./file-system-types"

const VIEW_OPTIONS: Array<{
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: FileSystemView
}> = [
  { icon: List, label: "List", value: "list" },
  { icon: Grid3X3, label: "Grid", value: "grid" },
  { icon: Columns3, label: "Columns", value: "columns" },
  { icon: Image, label: "Gallery", value: "gallery" },
]

export function FileSystemToolbar({
  controller,
  title,
}: {
  controller: FileSystemController
  title: string
}) {
  const currentFolderName =
    controller.currentPath === ""
      ? title
      : pathName(controller.currentPath) || title

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-muted/35 px-2">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Button
          aria-label="Back"
          disabled={!controller.canGoBack}
          onClick={controller.goBack}
          size="icon-sm"
          variant="ghost"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <Button
          aria-label="Forward"
          disabled={!controller.canGoForward}
          onClick={controller.goForward}
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
            {controller.currentPath || "/"}
          </div>
        </div>
      </div>
      <Tabs
        value={controller.view}
        onValueChange={(nextView) =>
          controller.setView(nextView as FileSystemView)
        }
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
          onChange={(event) => controller.setSearch(event.target.value)}
          placeholder="Search"
          size="sm"
          type="search"
          value={controller.query.search}
        />
      </div>
    </div>
  )
}

export function FileSystemFilterBar({
  controller,
}: {
  controller: FileSystemController
}) {
  const hasFilters = fileSystemHasFilters(controller)

  if (!controller.categories.length) return null

  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1.5">
      <Filter className="size-3.5 shrink-0 text-muted-foreground" />
      {controller.categories.map((category) => {
        const isActive = controller.query.filters.categories.includes(category)

        return (
          <button
            key={category}
            type="button"
            onClick={() => controller.toggleCategory(category)}
            className={cn(
              "h-6 shrink-0 rounded-md border px-2 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-muted-foreground"
            )}
          >
            {getFileSystemCategoryLabel(category)}
          </button>
        )
      })}
      {(["last7", "last30"] as const).map((preset) => {
        const isActive = controller.query.filters.updatedAfter === preset

        return (
          <button
            key={preset}
            type="button"
            onClick={() => controller.setModifiedAfter(preset)}
            className={cn(
              "h-6 shrink-0 rounded-md border px-2 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-muted-foreground"
            )}
          >
            {dateModifiedFilterLabel(preset)}
          </button>
        )
      })}
      {hasFilters ? (
        <Button size="xs" variant="ghost" onClick={controller.clearFilters}>
          <X className="size-3" aria-hidden />
          Clear
        </Button>
      ) : null}
    </div>
  )
}

export function FileSystemStatusBar({
  controller,
}: {
  controller: FileSystemController
}) {
  const itemCount = controller.currentEntries.length
  const isSearching =
    normalizeFileSystemSearch(controller.query.search).length > 0
  const hasFilters = fileSystemHasFilters(controller)

  return (
    <div
      aria-live="polite"
      className="flex h-8 shrink-0 items-center justify-between gap-3 border-t bg-muted/35 px-3 text-xs text-muted-foreground"
    >
      <span>
        {itemCount}{" "}
        {isSearching || hasFilters
          ? itemCount === 1
            ? "result"
            : "results"
          : itemCount === 1
            ? "item"
            : "items"}
      </span>
      {controller.selectedEntry ? (
        <span className="min-w-0 truncate">
          {controller.selectedEntry.name} selected
        </span>
      ) : null}
    </div>
  )
}

function fileSystemHasFilters(controller: FileSystemController) {
  return (
    controller.query.filters.categories.length > 0 ||
    controller.query.filters.updatedAfter !== null
  )
}
