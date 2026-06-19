"use client"

import { useState } from "react"
import { Check, ChevronDown, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

import { focusRing } from "./primitives"

export function StartBuildingPluginCommand({
  command,
  label,
}: {
  command: string
  label: string
}) {
  const [isCopied, setIsCopied] = useState(false)

  function copyCommand() {
    void navigator.clipboard.writeText(command).then(() => {
      setIsCopied(true)
      window.setTimeout(() => setIsCopied(false), 1800)
    })
  }

  return (
    <div className="mt-8 max-w-full">
      <div className="inline-flex h-12 max-w-full items-center overflow-hidden rounded-full border border-neutral-200 bg-white text-black shadow-[0_1px_1px_rgba(0,0,0,0.03)]">
        <span className="flex h-full shrink-0 items-center gap-1.5 border-r border-neutral-200 px-3 text-sm font-medium">
          {label}
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 text-neutral-500"
          />
        </span>
        <code className="min-w-0 flex-1 truncate px-3 font-mono text-xs leading-5 text-neutral-800">
          <span className="text-neutral-400">$</span> {command}
        </code>
        <button
          type="button"
          aria-label="Copy Vercel plugin install command"
          onClick={copyCommand}
          className={cn(
            "mr-1 grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black motion-reduce:transition-none",
            focusRing
          )}
        >
          {isCopied ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {isCopied ? "Copied command" : ""}
      </span>
    </div>
  )
}
