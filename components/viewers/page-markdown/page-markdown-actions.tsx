"use client"

import * as React from "react"
import { Check, Copy, Download, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type CopyStatus = "idle" | "copied" | "failed"

function scheduleCopyStatusReset(
  timeoutRef: React.MutableRefObject<number | null>,
  setStatus: React.Dispatch<React.SetStateAction<CopyStatus>>
) {
  timeoutRef.current = window.setTimeout(() => setStatus("idle"), 1200)
}

export function MarkdownActionButtons({
  text,
  fileName,
}: {
  text: string
  fileName: string
}) {
  return (
    <>
      <CopyMarkdownButton text={text} />
      <DownloadMarkdownButton text={text} fileName={fileName} />
    </>
  )
}

export function MarkdownActionsMenu({
  text,
  fileName,
}: {
  text: string
  fileName: string
}) {
  const copy = useCopyMarkdown(text)

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label="More markdown actions"
          title="More markdown actions"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={copy.write}>
          <Copy />
          {copy.status === "copied"
            ? "Copied"
            : copy.status === "failed"
              ? "Copy failed"
              : "Copy markdown"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadMarkdown(text, fileName)}>
          <Download />
          Download markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CopyMarkdownButton({ text }: { text: string }) {
  const copy = useCopyMarkdown(text)

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      aria-label={copy.status === "failed" ? "Copy failed" : "Copy markdown"}
      title={copy.status === "failed" ? "Copy failed" : "Copy all markdown"}
      onClick={copy.write}
    >
      {copy.status === "copied" ? (
        <Check className="text-emerald-600" />
      ) : (
        <Copy className={copy.status === "failed" ? "text-destructive" : ""} />
      )}
    </Button>
  )
}

function DownloadMarkdownButton({
  text,
  fileName,
}: {
  text: string
  fileName: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      aria-label="Download markdown"
      title="Download markdown"
      onClick={() => downloadMarkdown(text, fileName)}
    >
      <Download />
    </Button>
  )
}

function useCopyMarkdown(text: string) {
  const [status, setStatus] = React.useState<CopyStatus>("idle")
  const timeoutRef = React.useRef<number | null>(null)

  React.useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    },
    []
  )

  const write = React.useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)

    const writeText = navigator.clipboard?.writeText
    if (typeof writeText !== "function") {
      setStatus("failed")
      scheduleCopyStatusReset(timeoutRef, setStatus)
      return
    }

    try {
      Promise.resolve(writeText.call(navigator.clipboard, text)).then(
        () => {
          setStatus("copied")
          scheduleCopyStatusReset(timeoutRef, setStatus)
        },
        () => {
          setStatus("failed")
          scheduleCopyStatusReset(timeoutRef, setStatus)
        }
      )
    } catch {
      setStatus("failed")
      scheduleCopyStatusReset(timeoutRef, setStatus)
    }
  }, [text])

  return { status, write }
}

export function createMarkdownBlob(text: string): Blob {
  return new Blob([text], { type: "text/markdown;charset=utf-8" })
}

export function normalizeMarkdownFileName(fileName?: string): string {
  const trimmed = fileName?.trim()
  if (!trimmed) return "document.md"
  if (/\.(?:md|markdown)$/i.test(trimmed)) return trimmed

  const slashIndex = Math.max(
    trimmed.lastIndexOf("/"),
    trimmed.lastIndexOf("\\")
  )
  const dotIndex = trimmed.lastIndexOf(".")
  if (dotIndex > slashIndex + 1) return `${trimmed.slice(0, dotIndex)}.md`

  return `${trimmed}.md`
}

export function downloadMarkdown(text: string, fileName?: string) {
  const url = URL.createObjectURL(createMarkdownBlob(text))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = normalizeMarkdownFileName(fileName)
  try {
    document.body.append(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
