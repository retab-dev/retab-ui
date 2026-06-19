"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

import { focusRing } from "./primitives"

type CopyState = "idle" | "copied" | "failed"

export function StartBuildingPluginCommand({
  command,
  label,
}: {
  command: string
  label: string
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle")
  const resetTimeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        window.clearTimeout(resetTimeoutRef.current)
      }
    }
  }, [])

  function resetCopyStateSoon() {
    if (resetTimeoutRef.current) {
      window.clearTimeout(resetTimeoutRef.current)
    }

    resetTimeoutRef.current = window.setTimeout(() => {
      setCopyState("idle")
    }, 1800)
  }

  async function copyCommand() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable")
      }

      await navigator.clipboard.writeText(command)
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    } finally {
      resetCopyStateSoon()
    }
  }

  return (
    <div className="mt-8 max-w-full">
      <div className="inline-flex h-10 max-w-full items-center rounded-full bg-white text-black shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)]">
        <span className="flex h-full shrink-0 items-center border-r border-neutral-200 px-3 text-sm font-medium">
          {label}
        </span>
        <code className="min-w-0 flex-1 overflow-x-auto px-3 font-mono text-sm leading-5 whitespace-nowrap text-neutral-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-neutral-400">$</span> {command}
        </code>
        <button
          type="button"
          aria-label="Copy Vercel plugin install command"
          onClick={copyCommand}
          className={cn(
            "mr-0.5 grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black focus-visible:ring-inset focus-visible:ring-offset-0 motion-reduce:transition-none",
            focusRing
          )}
        >
          {copyState === "copied" ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copyState === "copied" ? "Copied command" : null}
        {copyState === "failed" ? "Could not copy command" : null}
      </span>
    </div>
  )
}
