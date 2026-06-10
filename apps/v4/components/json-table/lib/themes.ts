export interface Theme {
  // Header colors
  headerBg: string;
  headerText: string;
  subHeaderBg: string;
  subHeaderHoverBg: string;
  // Border colors
  border: string;
  verticalLine: string;

  // Cell backgrounds
  tableContainerBg: string;
  tableRowBg: string;
  tableCellBg: string;
  forbiddenCellBg: string;

  selectedBg: string;
  selectedHoverBg: string;

  // Tooltip colors
  tooltipBg: string;
  tooltipText: string;

  // Text and opacity
  disabledOpacity: string;

  // Plus button icons
  plusButtonIcon: string;
}

export const playgroundTheme: Theme = {
  // Header colors
  headerBg: "bg-zinc-100 hover:bg-zinc-200",
  headerText: "text-zinc-800 hover:text-zinc-800",
  subHeaderBg: "bg-zinc-200",
  subHeaderHoverBg: "hover:bg-zinc-300",

  // Border colors
  border: "border-zinc-200",
  verticalLine: "bg-zinc-200",

  // Cell backgrounds
  tableContainerBg: "bg-white",
  tableRowBg: "bg-transparent hover:bg-zinc-100",
  tableCellBg: "bg-transparent hover:bg-zinc-50",
  forbiddenCellBg: "bg-zinc-100",

  // Interactive elements
  selectedBg: "bg-zinc-300",
  selectedHoverBg: "hover:bg-zinc-400",

  // Tooltip colors
  tooltipBg: "bg-gray-100",
  tooltipText: "text-gray-800",

  // Text and opacity
  disabledOpacity: "disabled:opacity-100 text-inherit",

  // Plus button icons
  plusButtonIcon: "text-gray-600",
};

export const reviewTheme: Theme = {
  // Header colors
  headerBg: "bg-violet-100/20 hover:bg-violet-200/20",
  headerText: "text-violet-800/20 hover:text-violet-800/20",
  subHeaderBg: "bg-violet-200/20 hover:bg-violet-300/20",
  subHeaderHoverBg: "hover:bg-violet-400/20",

  // Border colors
  border: "border-violet-200/20",
  verticalLine: "bg-violet-200/20",

  // Cell backgrounds
  tableContainerBg: "bg-violet-50/20",
  tableRowBg: "bg-transparent hover:bg-violet-100/20",
  tableCellBg: "bg-transparent hover:bg-violet-50/20",
  forbiddenCellBg: "bg-violet-100/20",

  // Interactive elements
  selectedBg: "bg-violet-300/20",
  selectedHoverBg: "hover:bg-violet-400/20",

  // Tooltip colors
  tooltipBg: "bg-violet-100/20",
  tooltipText: "text-violet-800/20",

  // Text and opacity
  disabledOpacity: "disabled:opacity-100 text-inherit",

  // Plus button icons
  plusButtonIcon: "text-violet-600/20",
};

// Vanilla / shadcn-token theme: follows the consumer's theme via semantic tokens
// instead of fixed dashboard gray. This is the default theme the table renders.
export const grayTheme: Theme = {
  // Header colors
  headerBg: "bg-muted hover:bg-muted/80",
  headerText: "text-foreground hover:text-foreground",
  subHeaderBg: "bg-muted",
  subHeaderHoverBg: "hover:bg-accent",
  // Border colors
  border: "border-border",
  verticalLine: "bg-border",

  // Cell backgrounds
  tableContainerBg: "bg-background",
  tableRowBg: "bg-transparent hover:bg-muted/50",
  tableCellBg: "bg-transparent hover:bg-muted/30",
  forbiddenCellBg: "bg-muted",

  // Interactive elements
  selectedBg: "bg-accent",
  selectedHoverBg: "hover:bg-accent/80",

  // Tooltip colors
  tooltipBg: "bg-popover",
  tooltipText: "text-popover-foreground",

  // Text and opacity
  disabledOpacity: "disabled:opacity-100 text-inherit",

  // Plus button icons
  plusButtonIcon: "text-muted-foreground",
};

export const neutralTheme: Theme = {
  // Header colors
  headerBg: "bg-neutral-100 hover:bg-neutral-200",
  headerText: "text-neutral-800 hover:text-neutral-800",
  subHeaderBg: "bg-neutral-200",
  subHeaderHoverBg: "hover:bg-neutral-300",
  // Border colors
  border: "border-neutral-200",
  verticalLine: "bg-neutral-200",

  // Cell backgrounds
  tableContainerBg: "bg-white",
  tableRowBg: "bg-transparent hover:bg-neutral-100",
  tableCellBg: "bg-transparent hover:bg-neutral-50",
  forbiddenCellBg: "bg-neutral-100",

  // Interactive elements
  selectedBg: "bg-neutral-300",
  selectedHoverBg: "hover:bg-neutral-400",

  // Tooltip colors
  tooltipBg: "bg-neutral-100",
  tooltipText: "text-neutral-800",

  // Text and opacity
  disabledOpacity: "disabled:opacity-100 text-inherit",

  // Plus button icons
  plusButtonIcon: "text-neutral-600",
};

export const lightTheme: Theme = {
  // Header colors
  headerBg: "bg-slate-100 hover:bg-slate-200",
  headerText: "text-slate-800 hover:text-slate-800",
  subHeaderBg: "bg-slate-200",
  subHeaderHoverBg: "hover:bg-slate-300",
  // Border colors
  border: "border-slate-200",
  verticalLine: "bg-slate-200",

  // Cell backgrounds
  tableContainerBg: "bg-white",
  tableRowBg: "bg-transparent hover:bg-slate-100",
  tableCellBg: "bg-transparent hover:bg-slate-50",
  forbiddenCellBg: "bg-slate-100",

  // Interactive elements
  selectedBg: "bg-slate-300",
  selectedHoverBg: "hover:bg-slate-400",

  // Tooltip colors
  tooltipBg: "bg-gray-100",
  tooltipText: "text-gray-800",

  // Text and opacity
  disabledOpacity: "disabled:opacity-100 text-inherit",

  // Plus button icons
  plusButtonIcon: "text-gray-600",
};

export const darkTheme: Theme = {
  // Header colors
  headerBg: "bg-stone-100 hover:bg-stone-200",
  headerText: "text-stone-800 hover:text-stone-800",
  subHeaderBg: "bg-stone-200",
  subHeaderHoverBg: "hover:bg-stone-300",
  // Border colors
  border: "border-stone-200",
  verticalLine: "bg-stone-200",

  // Cell backgrounds
  tableContainerBg: "bg-white",
  tableRowBg: "bg-transparent hover:bg-stone-100",
  tableCellBg: "bg-transparent hover:bg-stone-50",
  forbiddenCellBg: "bg-stone-100",

  // Interactive elements
  selectedBg: "bg-stone-300",
  selectedHoverBg: "hover:bg-stone-400",

  // Tooltip colors
  tooltipBg: "bg-gray-100",
  tooltipText: "text-gray-800",

  // Text and opacity
  disabledOpacity: "disabled:opacity-100 text-inherit",

  // Plus button icons
  plusButtonIcon: "text-gray-600",
};

export const veryDarkTheme: Theme = {
  // Header colors
  headerBg: "bg-stone-700 hover:bg-stone-600",
  headerText: "text-stone-100 hover:text-stone-100",
  subHeaderBg: "bg-stone-600",
  subHeaderHoverBg: "hover:bg-stone-500",
  // Border colors
  border: "border-stone-500",
  verticalLine: "bg-stone-500",

  // Cell backgrounds
  tableContainerBg: "bg-stone-800",
  tableRowBg: "bg-transparent hover:bg-stone-700",
  tableCellBg: "bg-transparent hover:bg-stone-700",
  forbiddenCellBg: "bg-stone-700",

  // Interactive elements
  selectedBg: "bg-stone-500",
  selectedHoverBg: "hover:bg-stone-400",

  // Tooltip colors
  tooltipBg: "bg-stone-700",
  tooltipText: "text-stone-100",

  // Text and opacity
  disabledOpacity: "disabled:opacity-100 text-inherit",

  // Plus button icons
  plusButtonIcon: "text-stone-300",
};

export const darkThemeOld: Theme = {
  // Header colors
  headerBg: "bg-slate-600",
  headerText: "text-slate-100 hover:text-slate-100",
  subHeaderBg: "bg-slate-700",
  subHeaderHoverBg: "hover:bg-slate-600",
  // Border colors
  border: "border-slate-500",
  verticalLine: "bg-slate-500",

  // Cell backgrounds
  tableContainerBg: "bg-slate-800",
  tableRowBg: "bg-transparent hover:bg-slate-700",
  tableCellBg: "bg-transparent hover:bg-slate-700",
  forbiddenCellBg: "bg-slate-800",

  // Interactive elements
  selectedBg: "bg-slate-700",
  selectedHoverBg: "hover:bg-slate-600",

  // Tooltip colors
  tooltipBg: "bg-slate-700",
  tooltipText: "text-slate-100",

  // Text and opacity
  disabledOpacity: "disabled:opacity-100 text-inherit",

  plusButtonIcon: "text-slate-300",
};

/**
 * Get the appropriate theme based on whether this is a dataset sheet (light) or iteration sheet (dark)
 * @param isDatasetSheet - true for dataset sheets (light theme), false for iteration sheets (dark theme)
 * @returns Theme object with all styling classes
 */
export function getTheme(currentIterationId: string): Theme {
  if (currentIterationId.includes("dataset")) {
    return lightTheme;
  } else if (currentIterationId.includes("builder")) {
    return playgroundTheme;
  } else if (currentIterationId === "review") {
    return neutralTheme;
  } else if (currentIterationId === "gray") {
    return grayTheme;
  } else {
    return grayTheme; //darkTheme;
  }
}
