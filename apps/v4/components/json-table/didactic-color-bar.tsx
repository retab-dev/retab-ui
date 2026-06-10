/* -------------------------------------------------------------------------
 *  DidacticColorBar – Radix-based replacement for the old component
 * -------------------------------------------------------------------------
 *  ‣ Drop-in API-compatibility with the previous <DidacticColorBar />
 *  ‣ Built on top of @radix-ui/react-progress primitives for a11y semantics.
 *  ‣ Fully themeable via Tailwind & className prop.
 *
 *  Usage -------------------------------------------------------------------
 *    <DidacticColorBar
 *        colorState="consensus"
 *        size="md"
 *        value={0.42}
 *        className="w-32"
 *    />
 * -------------------------------------------------------------------------*/

"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ---- Colormap helpers -----------------------------------------------------
// Re-export or import these from wherever you keep them ---------------------
import {
  getColor,
  CONSENSUS_COLORMAP,
  DISTANCES_COLORMAP,
  CONSENSUS_INVERSE,
  DISTANCES_INVERSE,
  type ColormapName,
} from "@/components/json-table/lib/colors";

/* -------------------------------------------------------------------------
 *  Size tokens – bar height, tick height, label size, etc.
 * -------------------------------------------------------------------------*/
const sizeTokens = {
  sm: {
    bar: "h-1",
    tick: "h-1 w-1",
    text: "text-[10px]",
    gap: "gap-1",
    knob: "h-3 w-3",
  },
  md: {
    bar: "h-2",
    tick: "h-2 w-2",
    text: "text-xs",
    gap: "gap-1.5",
    knob: "h-4 w-4",
  },
  lg: {
    bar: "h-3",
    tick: "h-3 w-3",
    text: "text-sm",
    gap: "gap-2",
    knob: "h-5 w-5",
  },
} as const;

/* -------------------------------------------------------------------------
 *  Variant-driven styling for the gradient track (Progress.Root)
 * -------------------------------------------------------------------------*/
const _trackVariants = cva(
  "relative w-full rounded-full overflow-hidden", // base - removed border
  {
    variants: {
      size: {
        sm: sizeTokens.sm.bar,
        md: sizeTokens.md.bar,
        lg: sizeTokens.lg.bar,
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

/* -------------------------------------------------------------------------
 *  Props --------------------------------------------------------------------*/
export interface DidacticColorBarProps {
  /**
   * Select which colormap & labelling preset to use.
   *  • "consensus"  – red → yellow → white (low→high consensus)
   *  • "similarity"  – red → yellow → green (low→high accuracy)
   */
  colorState: "consensus" | "similarity";
  /** Optional utility classes applied to the outer wrapper */
  className?: string;
  /** Size preset — controls bar height, tick height, label font-size */
  size?: keyof typeof sizeTokens;
  /** Cursor position in [0,1]. Undefined → no cursor shown. */
  value?: number;
}

/* -------------------------------------------------------------------------
 *  Build a "clamped" gradient that cuts off cleanly at the current value
 * -------------------------------------------------------------------------*/
function buildClampedGradient(
  map: ColormapName,
  reverse: boolean,
  fraction = 1, // 0 ─► 1   (same as `clamped`)
  steps = 120,
) {
  // --- ramp part -----------------------------------------------------------
  const ramp = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1); // 0 ─► 1 along *visible* bar
    const c = getColor(map, t * fraction, reverse);
    const pos = t * fraction * 100; // …but capped at `fraction`
    return `${c} ${pos}%`;
  }).join(", ");

  // --- flat tail (constant colour after the clamp) -------------------------
  const tailColour = getColor(map, fraction, reverse);
  const tail = `${tailColour} ${fraction * 100}%, ${tailColour} 100%`;

  return `linear-gradient(to right, ${ramp}, ${tail})`;
}

/* -------------------------------------------------------------------------
 *  Component ----------------------------------------------------------------
 * -------------------------------------------------------------------------*/
export const DidacticColorBar: React.FC<DidacticColorBarProps> = ({
  colorState,
  className,
  size = "md",
  value,
}) => {
  // Map selection -----------------------------------------------------------
  const isConsensus = colorState === "consensus";
  const map: ColormapName = isConsensus
    ? CONSENSUS_COLORMAP
    : DISTANCES_COLORMAP;
  const reverse = isConsensus ? CONSENSUS_INVERSE : DISTANCES_INVERSE;

  // Build gradient ----------------------------------------------------------
  const STEPS = 120; // plenty for smoothness
  const gradientStops = Array.from({ length: STEPS }, (_, i) =>
    getColor(map, i / (STEPS - 1), reverse),
  )
    .map((c, i) => `${c} ${(i * 100) / (STEPS - 1)}%`)
    .join(", ");
  const _gradient = `linear-gradient(to right, ${gradientStops})`;

  // Build less opaque gradient (opacity 0.4)
  const OPACITY = 0.4;
  const gradientStopsLessOpaque = Array.from({ length: STEPS }, (_, i) =>
    getColor(map, i / (STEPS - 1), reverse, OPACITY),
  )
    .map((c, i) => `${c} ${(i * 100) / (STEPS - 1)}%`)
    .join(", ");
  const gradientLessOpaque = `linear-gradient(to right, ${gradientStopsLessOpaque})`;

  // Labels ------------------------------------------------------------------
  const labels = { low: "Low", high: "High" };

  // Clamp & derive tick position -------------------------------------------
  const clamped = value !== undefined ? Math.min(Math.max(value, 0), 1) : 1;
  const formattedValue = clamped.toFixed(2);

  // Build clamped gradient --------------------------------------------------
  const clampedGradient = buildClampedGradient(map, reverse, clamped);

  return (
    <div className={cn("flex flex-col", sizeTokens[size].gap, className)}>
      <div className="flex w-full items-center justify-between">
        <span className={cn("font-medium text-black", sizeTokens[size].text)}>
          {"Score"}
        </span>
        <span
          className={cn(
            "text-muted-foreground rounded-md border p-1 font-medium ring ring-gray-100",
            sizeTokens[size].text,
          )}
          style={{ borderColor: getColor(map, value || 0, reverse) }}
        >
          {formattedValue}
        </span>
      </div>

      <div className="relative w-full">
        <ProgressPrimitive.Root
          data-slot="progress"
          className={cn("h-2 w-full overflow-hidden rounded-full", className)}
          style={{ backgroundImage: gradientLessOpaque }}
          value={clamped !== undefined ? clamped * 100 : undefined}
          max={100}
        >
          <ProgressPrimitive.Indicator
            data-slot="progress-indicator"
            className="relative h-full transition-all"
            style={{
              width: `${clamped * 100}%`,
              backgroundImage: clampedGradient,
            }}
          />
          {value !== undefined && (
            <div
              aria-hidden
              className={cn(
                "bg-background ring-border pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm ring-1",
                sizeTokens[size].knob,
              )}
              style={{ left: `${clamped * 100}%` }}
            />
          )}
        </ProgressPrimitive.Root>
      </div>
      <div className="flex w-full items-center justify-between">
        <span
          className={cn(
            "text-muted-foreground font-normal",
            sizeTokens[size].text,
          )}
        >
          {labels.low}
        </span>
        <span
          className={cn(
            "text-muted-foreground font-normal",
            sizeTokens[size].text,
          )}
        >
          {labels.high}
        </span>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------
 *  Re-exports for convenience ----------------------------------------------*/
export default DidacticColorBar;
