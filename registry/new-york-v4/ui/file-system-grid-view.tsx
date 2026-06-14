"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Folder } from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

import type { FileSystemBrowserController } from "./file-system-browser-controller"
import { FileSystemThumbnail } from "./file-system-thumbnail"
import type { FileSystemEntry } from "./file-system-types"
import { useFileSystemRovingFocus } from "./use-file-system-roving-focus"

const TILE_MIN_WIDTH = 124
const TILE_HEIGHT = 132
const GRID_PADDING = 12

export function FileSystemGridView({
  controller,
}: {
  controller: FileSystemBrowserController
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const [columnCount, setColumnCount] = React.useState(1)
  const { browser, fileActions } = controller
  const entries = browser.entries

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === "undefined") return

    const update = () => {
      const available = Math.max(1, viewport.clientWidth - GRID_PADDING * 2)
      setColumnCount(Math.max(1, Math.floor(available / TILE_MIN_WIDTH)))
    }
    const observer = new ResizeObserver(update)

    update()
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const rowCount = Math.ceil(entries.length / columnCount)
  const virtualizer = useVirtualizer({
    count: rowCount,
    estimateSize: () => TILE_HEIGHT,
    getScrollElement: () => viewportRef.current,
    overscan: 5,
  })
  const virtualRows = virtualizer.getVirtualItems()
  const renderedRows = virtualRows.length
    ? virtualRows.map((row) => ({ index: row.index, start: row.start }))
    : Array.from({ length: rowCount }, (_, index) => ({
        index,
        start: index * TILE_HEIGHT,
      }))
  const totalSize = virtualRows.length
    ? virtualizer.getTotalSize()
    : rowCount * TILE_HEIGHT
  const rovingFocus = useFileSystemRovingFocus({
    entries,
    getScrollIndex: (entry) => {
      const index = entries.findIndex(
        (candidate) => candidate.path === entry.path
      )

      return index === -1 ? -1 : Math.floor(index / columnCount)
    },
    onSelect: browser.selectEntry,
    scrollToIndex: (index) => {
      if (index !== -1) virtualizer.scrollToIndex(index)
    },
    selectedPath: browser.selectedPath,
  })
  const openEntry = React.useCallback(
    (entry: FileSystemEntry) => {
      if (entry.kind === "folder") {
        browser.navigateTo(entry.path)
      } else {
        fileActions.openPreview(entry)
      }
    },
    [browser.navigateTo, fileActions]
  )
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      rovingFocus.selectByOffset(event.key === "ArrowRight" ? 1 : -1)
      event.preventDefault()
      return
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      rovingFocus.selectByOffset(
        event.key === "ArrowDown" ? columnCount : -columnCount
      )
      event.preventDefault()
      return
    }
    if (event.key === "Home" || event.key === "End") {
      rovingFocus.selectBoundary(event.key === "Home" ? "first" : "last")
      event.preventDefault()
      return
    }
    if (event.key === "Enter" && browser.selectedEntry) {
      openEntry(browser.selectedEntry)
      event.preventDefault()
      return
    }

    rovingFocus.selectTypeAhead(event)
  }

  if (!entries.length) {
    return (
      <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
        This folder is empty
      </div>
    )
  }

  return (
    <ScrollArea
      orientation="vertical"
      viewportRef={viewportRef}
      viewportClassName="p-3"
      viewportProps={{
        onKeyDown: handleKeyDown,
        role: "listbox",
        tabIndex: 0,
        "aria-label": "Files",
      }}
    >
      <div className="relative" style={{ height: totalSize }}>
        {renderedRows.map((row) => {
          const rowEntries = entries.slice(
            row.index * columnCount,
            row.index * columnCount + columnCount
          )

          return (
            <div
              key={row.index}
              className="absolute inset-x-0 grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                transform: `translateY(${row.start}px)`,
              }}
            >
              {rowEntries.map((entry) => (
                <FileSystemGridTile
                  key={entry.path}
                  controller={controller}
                  entry={entry}
                  ref={(element) => {
                    rovingFocus.registerEntryRef(entry.path, element)
                  }}
                />
              ))}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

const FileSystemGridTile = React.forwardRef<
  HTMLButtonElement,
  {
    controller: FileSystemBrowserController
    entry: FileSystemEntry
  }
>(function FileSystemGridTile({ controller, entry }, ref) {
  const { browser, fileActions } = controller
  const selectedPath = browser.selectedPath
  const isSelected = entry.path === selectedPath

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={isSelected}
      tabIndex={isSelected || !selectedPath ? 0 : -1}
      onClick={() => browser.selectEntry(entry)}
      onDoubleClick={() => {
        if (entry.kind === "folder") {
          browser.navigateTo(entry.path)
        } else {
          fileActions.openPreview(entry)
        }
      }}
      className="group flex h-[124px] min-w-0 flex-col items-center gap-2 rounded-sm p-2 text-center outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "flex size-16 shrink-0 items-center justify-center rounded-sm",
          isSelected && "bg-accent"
        )}
      >
        {entry.kind === "folder" ? (
          <Folder className="size-11 text-muted-foreground" aria-hidden />
        ) : (
          <FileSystemThumbnail
            file={entry}
            resolveFileSource={fileActions.resolveFileSource}
            className="size-16"
          />
        )}
      </span>
      <span
        className={cn(
          "line-clamp-2 max-w-full rounded px-1 text-xs leading-tight break-words",
          isSelected && "bg-primary text-primary-foreground"
        )}
      >
        {entry.name}
      </span>
    </button>
  )
})
