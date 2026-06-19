import type { EditViewerField } from "./edit-viewer-types";

export const EDIT_FIELD_ACCENTS: Record<
  EditViewerField["type"],
  { line: string; tint: string; text: string; badge: string }
> = {
  text: {
    line: "var(--color-chart-3)",
    tint: "color-mix(in oklab, var(--color-chart-3) 12%, transparent)",
    text: "var(--color-chart-4)",
    badge: "border-chart-3/30 bg-chart-3/10 text-chart-4 dark:text-chart-2",
  },
  checkbox: {
    line: "var(--color-amber-500)",
    tint: "color-mix(in oklab, var(--color-amber-500) 14%, transparent)",
    text: "var(--color-amber-600)",
    badge: "border-warning/30 bg-warning/10 text-warning-foreground",
  },
};
