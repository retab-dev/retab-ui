"use client";

import { useId, useRef, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { KeyedRunner } from "@/hooks/KeyedRunner";
import { useMountEffect } from "@/hooks/use-mount-effect";

import { type StartBuildingPluginOption } from "./homepage-types";
import { focusRing } from "./primitives";

type CopyState = "idle" | "copied" | "failed";

const copyResetDelayMs = 1800;
const copyFeedbackMessage = {
  idle: null,
  copied: "Copied command",
  failed: "Could not copy command",
} satisfies Record<CopyState, string | null>;

export function StartBuildingPluginCommand({
  options,
}: {
  options: readonly [StartBuildingPluginOption, ...StartBuildingPluginOption[]];
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimeoutRef = useRef<number | undefined>(undefined);
  const selectedOption = options[selectedIndex] ?? options[0];
  const feedbackMessage = copyFeedbackMessage[copyState];

  function clearResetTimeout() {
    if (resetTimeoutRef.current !== undefined) {
      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = undefined;
    }
  }

  useMountEffect(() => clearResetTimeout);

  function resetCopyStateSoon() {
    clearResetTimeout();

    resetTimeoutRef.current = window.setTimeout(() => {
      setCopyState("idle");
      resetTimeoutRef.current = undefined;
    }, copyResetDelayMs);
  }

  async function copyCommand() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(selectedOption.command);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    } finally {
      resetCopyStateSoon();
    }
  }

  function selectOption(index: number) {
    setSelectedIndex(index);
    setIsMenuOpen(false);
    setCopyState("idle");
  }

  return (
    <div ref={rootRef} className="relative mt-8 w-full max-w-lg">
      {isMenuOpen ? (
        <KeyedRunner
          key="start-building-plugin-menu-open"
          effect={() => {
            function closeOnOutsidePress(event: PointerEvent) {
              if (
                event.target instanceof Node &&
                !rootRef.current?.contains(event.target)
              ) {
                setIsMenuOpen(false);
              }
            }

            function closeOnEscape(event: KeyboardEvent) {
              if (event.key === "Escape") {
                event.preventDefault();
                setIsMenuOpen(false);
              }
            }

            document.addEventListener("pointerdown", closeOnOutsidePress);
            document.addEventListener("keydown", closeOnEscape);

            return () => {
              document.removeEventListener("pointerdown", closeOnOutsidePress);
              document.removeEventListener("keydown", closeOnEscape);
            };
          }}
        />
      ) : null}
      <div className="inline-flex min-h-10 w-full items-center gap-1 rounded-full bg-white px-2 py-1.5 text-black shadow-sm ring-1 ring-black/10">
        <button
          type="button"
          aria-label={`Command type: ${selectedOption.label}`}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-controls={isMenuOpen ? menuId : undefined}
          onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
          className={cn(
            "flex min-h-7 shrink-0 cursor-pointer items-center rounded-l-full rounded-r-md px-2 py-1 text-sm font-medium text-neutral-700 transition-colors duration-150 ease-out hover:bg-neutral-100 hover:text-black motion-reduce:transition-none",
            focusRing,
          )}
        >
          <span className="flex items-center gap-1.5">
            {selectedOption.label}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 text-neutral-500 transition-transform duration-150 ease-out motion-reduce:transition-none",
                isMenuOpen && "rotate-180",
              )}
            />
          </span>
        </button>
        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-neutral-200" />
        <span className="shrink-0 text-neutral-400">$</span>
        <code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm leading-5 whitespace-nowrap text-neutral-800">
          {selectedOption.command}
        </code>
        <button
          type="button"
          aria-label={`Copy ${selectedOption.label} command`}
          onClick={copyCommand}
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors duration-150 ease-out hover:bg-neutral-100 hover:text-black active:bg-neutral-200 motion-reduce:transition-none",
            focusRing,
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
        <div className="absolute top-full left-2 z-50 mt-1 w-56 rounded-xl bg-white p-2 text-black shadow-xl ring-1 ring-black/10">
          <ul id={menuId} role="menu" aria-label="Command type">
            {options.map((option, index) => (
              <li key={option.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => selectOption(index)}
                  className={cn(
                    "flex min-h-10 w-full cursor-pointer items-center rounded-md px-2 text-left text-sm text-neutral-900 transition-colors duration-150 ease-out hover:bg-neutral-100 motion-reduce:transition-none",
                    focusRing,
                    index === selectedIndex && "bg-neutral-100",
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
        {feedbackMessage}
      </span>
    </div>
  );
}
