"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Check, ChevronDown, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

import { type StartBuildingPluginOption } from "./homepage-types"
import { focusRing } from "./primitives"

type CopyState = "idle" | "copied" | "failed"

export function StartBuildingPluginCommand({
  options,
}: {
  options: readonly [StartBuildingPluginOption, ...StartBuildingPluginOption[]]
}) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [copyState, setCopyState] = useState<CopyState>("idle")
  const resetTimeoutRef = useRef<number | undefined>(undefined)
  const selectedOption = options[selectedIndex] ?? options[0]

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        window.clearTimeout(resetTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    function closeOnOutsidePress(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setIsMenuOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePress)
    document.addEventListener("keydown", closeOnEscape)

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [isMenuOpen])

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

      await navigator.clipboard.writeText(selectedOption.command)
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    } finally {
      resetCopyStateSoon()
    }
  }

  function selectOption(index: number) {
    setSelectedIndex(index)
    setIsMenuOpen(false)
    setCopyState("idle")
  }

  return (
    <div ref={rootRef} className="relative mt-14 max-w-full">
      <div className="inline-flex h-10 max-w-[calc(100vw-48px)] items-center gap-1 rounded-full bg-white px-2 py-1.5 text-black shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)]">
        <button
          type="button"
          aria-label="Command type"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-controls={isMenuOpen ? menuId : undefined}
          onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
          className={cn(
            "flex h-7 shrink-0 cursor-pointer items-center rounded-l-full rounded-r-md py-1 pr-1 pl-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-black focus-visible:bg-neutral-100 focus-visible:text-black motion-reduce:transition-none",
            focusRing,
            "focus-visible:ring-offset-0 focus-visible:ring-inset"
          )}
        >
          <span className="flex items-center gap-1.5">
            {selectedOption.label}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 text-neutral-500 transition-transform duration-150 motion-reduce:transition-none",
                isMenuOpen && "rotate-180"
              )}
            />
          </span>
        </button>
        <span aria-hidden="true" className="mx-1 h-6 w-px bg-neutral-200" />
        <span className="block pr-1 text-neutral-400">$</span>
        <code className="min-w-0 flex-1 overflow-x-auto px-3 font-mono text-sm leading-5 whitespace-nowrap text-neutral-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {selectedOption.command}
        </code>
        <button
          type="button"
          aria-label={`Copy ${selectedOption.label} command`}
          onClick={copyCommand}
          className={cn(
            "mr-0.5 grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black focus-visible:bg-neutral-100 focus-visible:text-black active:bg-neutral-200 motion-reduce:transition-none",
            focusRing,
            "focus-visible:ring-offset-0 focus-visible:ring-inset"
          )}
        >
          {copyState === "copied" ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      {isMenuOpen ? (
        <div className="absolute top-11 left-2 z-50 w-[220px] rounded-xl bg-white p-2 text-sm text-black shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_10px_30px_rgba(0,0,0,0.12)]">
          <ul id={menuId} role="menu" aria-label="Command type">
            {options.map((option, index) => (
              <li key={option.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => selectOption(index)}
                  className={cn(
                    "flex h-10 w-full cursor-pointer items-center rounded-md px-2 text-left text-sm text-neutral-900 transition-colors hover:bg-neutral-100 focus-visible:bg-neutral-100 motion-reduce:transition-none",
                    focusRing,
                    index === selectedIndex && "bg-neutral-100"
                  )}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {copyState === "copied" ? "Copied command" : null}
        {copyState === "failed" ? "Could not copy command" : null}
      </span>
    </div>
  )
}
