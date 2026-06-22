"use client";

import { useId, useRef, useState } from "react";
import { Check, ChevronDown, Copy, SquareTerminal } from "lucide-react";

import { KeyedRunner } from "@/hooks/KeyedRunner";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { cn } from "@/lib/utils";

import { focusRing } from "./primitives";

type CopyState = "idle" | "copied" | "failed";

type HeroInstallOption = {
  readonly id: string;
  readonly label: string;
  readonly command: string;
};

const copyResetDelayMs = 1800;

const heroInstallOptions = [
  {
    id: "claude-cli",
    label: "Claude Code + CLI",
    command:
      "claude mcp add --transport http retab https://mcp.retab.com/mcp && curl -fsSL https://retab.com/install.sh | sh",
  },
  {
    id: "codex-cli",
    label: "Codex + CLI",
    command:
      "codex mcp add retab --url https://mcp.retab.com/mcp && curl -fsSL https://retab.com/install.sh | sh",
  },
  {
    id: "python",
    label: "Python",
    command: "pip install retab",
  },
  {
    id: "node",
    label: "Node",
    command: "npm install @retab/node",
  },
] as const satisfies readonly HeroInstallOption[];

async function writeClipboardText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall through to the textarea-based copy path.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const didCopy = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!didCopy) {
    throw new Error("Clipboard unavailable");
  }
}

export function HeroCompositeInstallDropdown({
  className,
}: {
  className?: string;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const resetTimeoutRef = useRef<number | undefined>(undefined);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");

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

  async function copyCommand(option: HeroInstallOption) {
    try {
      await writeClipboardText(option.command);
      setCopyState("copied");
      setIsMenuOpen(false);
    } catch {
      setCopyState("failed");
    } finally {
      resetCopyStateSoon();
    }
  }

  const triggerLabel =
    copyState === "copied"
      ? "Copied"
      : copyState === "failed"
        ? "Copy failed"
        : "Install";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {isMenuOpen ? (
        <KeyedRunner
          key="hero-composite-install-menu-open"
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
      <button
        type="button"
        aria-label="Choose install command"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-controls={isMenuOpen ? menuId : undefined}
        onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
        className={cn(
          "text-foreground hover:bg-accent hover:text-accent-foreground inline-flex min-h-10 w-full max-w-full items-center justify-center gap-2 rounded-full border border-transparent bg-transparent px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-out motion-reduce:transition-none sm:w-auto",
          focusRing,
        )}
      >
        {copyState === "copied" ? (
          <Check aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <SquareTerminal aria-hidden="true" className="size-4 shrink-0" />
        )}
        <span className="min-w-0 truncate">{triggerLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 transition-transform duration-150 ease-out motion-reduce:transition-none",
            isMenuOpen && "rotate-180",
          )}
        />
      </button>
      {isMenuOpen ? (
        <div className="bg-popover text-popover-foreground absolute top-full right-0 z-50 mt-2 w-[min(32rem,calc(100vw-3rem))] rounded-xl p-2 shadow-xl">
          <ul id={menuId} role="menu" aria-label="Install commands">
            {heroInstallOptions.map((option) => (
              <li key={option.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => copyCommand(option)}
                  className={cn(
                    "text-popover-foreground hover:bg-accent hover:text-accent-foreground flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left transition-colors duration-150 ease-out motion-reduce:transition-none",
                    focusRing,
                  )}
                >
                  <span className="min-w-24 shrink-0 text-sm font-medium">
                    {option.label}
                  </span>
                  <code className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">
                    {option.command}
                  </code>
                  <Copy
                    aria-hidden="true"
                    className="text-muted-foreground size-4 shrink-0"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {copyState === "copied"
          ? "Install command copied"
          : copyState === "failed"
            ? "Could not copy install command"
            : null}
      </span>
    </div>
  );
}
