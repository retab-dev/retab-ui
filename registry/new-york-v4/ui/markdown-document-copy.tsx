"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "./button"
import { serializeMarkdownTableForClipboard } from "./markdown-document-model"

type CopyStatus = "copied" | "idle"

export function MarkdownCodeCopyButton({ text }: { text: string }) {
  return (
    <MarkdownCopyButton
      ariaLabel="Copy code block"
      copiedLabel="Copied"
      className="ml-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      text={text}
    />
  )
}

export function MarkdownTableCopyButton({ markdown }: { markdown: string }) {
  return (
    <MarkdownCopyButton
      ariaLabel="Copy table"
      copiedLabel="Copied"
      className="absolute top-2 right-2 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      text={serializeMarkdownTableForClipboard(markdown)}
    />
  )
}

export function MarkdownCopyButton({
  ariaLabel,
  className,
  copiedLabel,
  text,
}: {
  ariaLabel: string
  className?: string
  copiedLabel: string
  text: string
}) {
  const [status, setStatus] = React.useState<CopyStatus>("idle")
  const timeoutRef = React.useRef<number | null>(null)

  React.useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    },
    []
  )

  const copy = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    void navigator.clipboard?.writeText(text).then(() => {
      setStatus("copied")
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null
        setStatus("idle")
      }, 1200)
    })
  }

  return (
    <Button
      aria-label={status === "copied" ? copiedLabel : ariaLabel}
      className={className}
      size="icon-sm"
      title={ariaLabel}
      type="button"
      variant="ghost"
      onClick={copy}
    >
      {status === "copied" ? <Check /> : <Copy />}
    </Button>
  )
}
