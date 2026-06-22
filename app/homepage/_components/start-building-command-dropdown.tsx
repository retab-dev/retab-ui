"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { Check, ChevronDown, Copy, SquareTerminal } from "lucide-react";

import { cn } from "@/lib/utils";
import { KeyedRunner } from "@/hooks/KeyedRunner";
import { useMountEffect } from "@/hooks/use-mount-effect";

import {
  type StartBuildingCommandGroup,
  type StartBuildingCommandOption,
} from "./homepage-types";
import { focusRing } from "./primitives";
import { SkillsIcon } from "./skills-icon";

type CopyState = "idle" | "copied" | "failed";

const copyResetDelayMs = 1800;
function CommandIcon({ option }: { option: StartBuildingCommandOption }) {
  if (option.icon.kind === "skills") {
    return (
      <SkillsIcon
        aria-hidden="true"
        className={cn("size-4 shrink-0", option.icon.className)}
      />
    );
  }

  if (option.icon.kind === "square-terminal") {
    return (
      <SquareTerminal
        aria-hidden="true"
        className={cn("size-4 shrink-0", option.icon.className)}
      />
    );
  }

  return (
    <Image
      alt=""
      aria-hidden="true"
      className={cn("size-4 shrink-0 object-contain", option.icon.className)}
      height={option.icon.height}
      src={option.icon.src}
      width={option.icon.width}
    />
  );
}

export function StartBuildingCommandDropdown({
  group,
}: {
  group: StartBuildingCommandGroup;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimeoutRef = useRef<number | undefined>(undefined);
  const selectedOption =
    group.kind === "select"
      ? (group.options[selectedIndex] ?? group.options[0])
      : group.option;
  const commandPrompt = selectedOption.prompt ?? "$";
  const feedbackMessage =
    copyState === "copied"
      ? `Copied ${group.copyLabel}`
      : copyState === "failed"
        ? `Could not copy ${group.copyLabel}`
        : null;

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
    <div ref={rootRef} className="relative w-full max-w-lg">
      {isMenuOpen ? (
        <KeyedRunner
          key={`start-building-${group.id}-menu-open`}
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
      <div className="group/command bg-card text-card-foreground ring-border inline-flex min-h-10 w-full items-center gap-1 rounded-full px-2 py-1.5 shadow-sm ring-1">
        {group.kind === "select" ? (
          <button
            type="button"
            aria-label={`${group.label}: ${selectedOption.label}`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-controls={isMenuOpen ? menuId : undefined}
            onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
            className={cn(
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex min-h-7 shrink-0 cursor-pointer items-center rounded-l-full rounded-r-md px-2 py-1 text-sm font-medium transition-colors duration-150 ease-out motion-reduce:transition-none",
              focusRing,
            )}
          >
            <span className="flex items-center gap-2">
              <CommandIcon option={selectedOption} />
              {selectedOption.label}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "text-muted-foreground size-4 transition-transform duration-150 ease-out motion-reduce:transition-none",
                  isMenuOpen && "rotate-180",
                )}
              />
            </span>
          </button>
        ) : (
          <span className="text-foreground flex min-h-7 shrink-0 items-center rounded-l-full rounded-r-md px-2 py-1 text-sm font-medium select-none">
            <span className="flex items-center gap-2">
              <CommandIcon option={selectedOption} />
              {selectedOption.label}
            </span>
          </span>
        )}
        <span aria-hidden="true" className="bg-border h-6 w-px shrink-0" />
        <button
          type="button"
          aria-label={`Copy ${selectedOption.label} ${group.copyLabel}: ${selectedOption.command}`}
          onClick={copyCommand}
          className={cn(
            "flex min-w-0 flex-1 cursor-default items-center gap-3 rounded-md px-1 text-left transition-colors duration-150 ease-out motion-reduce:transition-none",
            focusRing,
          )}
        >
          <span aria-hidden="true" className="text-muted-foreground shrink-0">
            {commandPrompt}
          </span>
          <code className="text-foreground min-w-0 overflow-x-auto font-mono text-sm leading-5 whitespace-nowrap">
            {selectedOption.command}
          </code>
        </button>
        <button
          type="button"
          aria-label={`Copy ${selectedOption.label} ${group.copyLabel}`}
          onClick={copyCommand}
          className={cn(
            "text-muted-foreground group-hover/command:bg-accent hover:bg-accent hover:text-accent-foreground active:bg-accent/80 grid size-7 shrink-0 place-items-center rounded-full transition-colors duration-150 ease-out motion-reduce:transition-none",
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
      {group.kind === "select" && isMenuOpen ? (
        <div className="bg-popover text-popover-foreground ring-border absolute top-full left-2 z-50 mt-1 w-56 rounded-xl p-2 shadow-xl ring-1">
          <ul id={menuId} role="menu" aria-label={group.label}>
            {group.options.map((option, index) => (
              <li key={option.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => selectOption(index)}
                  className={cn(
                    "text-popover-foreground hover:bg-accent hover:text-accent-foreground flex min-h-10 w-full cursor-pointer items-center rounded-md px-2 text-left text-sm transition-colors duration-150 ease-out motion-reduce:transition-none",
                    focusRing,
                    index === selectedIndex &&
                      "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="mr-2 grid size-6 shrink-0 place-items-center">
                    <CommandIcon option={option} />
                  </span>
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
