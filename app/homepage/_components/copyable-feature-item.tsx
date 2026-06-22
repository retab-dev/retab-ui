"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { useMountEffect } from "@/hooks/use-mount-effect";

import { type ProductFeatureContent } from "./homepage-types";
import { focusRing } from "./primitives";

type CopyState = "idle" | "copied" | "failed";
type CopyableFeature = Extract<ProductFeatureContent, { command: string }>;

const copyResetDelayMs = 1600;

export function CopyableFeatureItem({ feature }: { feature: CopyableFeature }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimeoutRef = useRef<number | undefined>(undefined);
  const isCopied = copyState === "copied";

  useMountEffect(() => () => {
    if (resetTimeoutRef.current !== undefined) {
      window.clearTimeout(resetTimeoutRef.current);
    }
  });

  function resetCopyStateSoon() {
    if (resetTimeoutRef.current !== undefined) {
      window.clearTimeout(resetTimeoutRef.current);
    }

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

      await navigator.clipboard.writeText(feature.command);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    } finally {
      resetCopyStateSoon();
    }
  }

  return (
    <li className="group/feature">
      <button
        type="button"
        aria-label={feature.copyLabel ?? `Copy ${feature.label} command`}
        onClick={copyCommand}
        className={cn(
          "text-foreground block w-full rounded-md text-left transition-colors motion-reduce:transition-none",
          focusRing,
        )}
      >
        <span className="flex min-w-0 items-center justify-between gap-3">
          <span className="min-w-0 truncate">{feature.label}</span>
          <span className="text-muted-foreground grid size-5 shrink-0 place-items-center opacity-0 transition-opacity group-focus-within/feature:opacity-100 group-hover/feature:opacity-100 motion-reduce:transition-none">
            {isCopied ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <Copy aria-hidden="true" className="size-3.5" />
            )}
          </span>
        </span>
        <span className="block max-h-0 overflow-hidden opacity-0 transition-all duration-200 ease-out group-focus-within/feature:max-h-20 group-focus-within/feature:opacity-100 group-hover/feature:max-h-20 group-hover/feature:opacity-100 motion-reduce:transition-none">
          <span className="border-border mt-2 flex min-w-0 items-center gap-2 rounded-sm border px-2 py-1.5">
            <span aria-hidden="true" className="text-muted-foreground shrink-0">
              $
            </span>
            <code className="text-foreground min-w-0 overflow-x-auto font-mono text-xs leading-5 whitespace-nowrap normal-case">
              {feature.command}
            </code>
          </span>
        </span>
      </button>
      <span className="sr-only" aria-live="polite">
        {copyState === "copied"
          ? `Copied ${feature.label} command`
          : copyState === "failed"
            ? `Could not copy ${feature.label} command`
            : null}
      </span>
    </li>
  );
}
