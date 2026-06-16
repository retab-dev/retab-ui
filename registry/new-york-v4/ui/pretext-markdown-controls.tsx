"use client"

import * as React from "react"
import { AlertCircle, Check, Copy } from "lucide-react"

import { Button } from "./button"
import { useViewerClipboardCopy } from "./text-viewer-chrome"

export function scrollPretextMarkdownHorizontalRegion(
  event: React.KeyboardEvent<HTMLElement>
) {
  let nextScrollLeft: number | null = null
  const element = event.currentTarget
  const step = Math.max(48, element.clientWidth * 0.25)

  switch (event.key) {
    case "ArrowLeft":
      nextScrollLeft = element.scrollLeft - step
      break
    case "ArrowRight":
      nextScrollLeft = element.scrollLeft + step
      break
    case "End":
      nextScrollLeft = element.scrollWidth - element.clientWidth
      break
    case "Home":
      nextScrollLeft = 0
      break
    default:
      return
  }

  event.preventDefault()
  element.scrollLeft = Math.max(0, nextScrollLeft)
}

export function PretextMarkdownCopyButton({
  ariaLabel,
  className,
  idleIcon,
  text,
}: {
  ariaLabel: string
  className?: string
  idleIcon?: React.ReactNode
  text: string | (() => string)
}) {
  const { copy, status } = useViewerClipboardCopy()

  const copyText = () => {
    const resolvedText = typeof text === "function" ? text() : text
    copy(resolvedText)
  }

  const label =
    status === "copied"
      ? "Copied"
      : status === "failed"
        ? "Copy failed"
        : ariaLabel

  return (
    <Button
      aria-label={label}
      className={className}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
      onClick={copyText}
    >
      {status === "copied" ? (
        <Check />
      ) : status === "failed" ? (
        <AlertCircle />
      ) : (
        (idleIcon ?? <Copy />)
      )}
    </Button>
  )
}

export function readPretextMarkdownSelectedText(root: HTMLElement | null) {
  if (!root || typeof window === "undefined") return null
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null
  }

  const selectedText = selection.toString().replace(/\n$/, "")
  if (!selectedText) return null

  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index)
    if (rangeIntersectsElement(range, root)) return selectedText
  }

  return null
}

function rangeIntersectsElement(range: Range, element: HTMLElement) {
  try {
    return range.intersectsNode(element)
  } catch {
    const container = range.commonAncestorContainer
    return element.contains(
      container.nodeType === Node.ELEMENT_NODE
        ? (container as Element)
        : container.parentElement
    )
  }
}
