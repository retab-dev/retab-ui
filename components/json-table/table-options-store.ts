import { create } from "zustand";

export type RowHeight = "small" | "medium" | "large" | "xl" | "xxl";
export type ColumnWidth = "small" | "medium" | "large" | "xl" | "xxl";

export interface SheetOptionsState {
  rowHeight: RowHeight;
  columnWidth: ColumnWidth;
  setRowHeight: (height: RowHeight) => void;
  setColumnWidth: (width: ColumnWidth) => void;
}

export const useSheetOptionsStore = create<SheetOptionsState>((set) => ({
  rowHeight: "medium",
  columnWidth: "large",
  setRowHeight: (height) => set({ rowHeight: height }),
  setColumnWidth: (width) => set({ columnWidth: width }),
}));

// Utility functions for calculating dimensions
export const getRowHeightClass = (height: RowHeight): string => {
  switch (height) {
    case "small":
      return "h-6";
    case "medium":
      return "h-8";
    case "large":
      return "h-10";
    case "xl":
      return "h-12";
    case "xxl":
      return "h-14";
    default:
      return "h-8";
  }
};

export const getColumnWidthClass = (width: ColumnWidth): string => {
  switch (width) {
    case "small":
      return "w-12";
    case "medium":
      return "w-16";
    case "large":
      return "w-24";
    case "xl":
      return "w-32";
    case "xxl":
      return "w-40";
    default:
      return "w-16";
  }
};

// Get pixel values for calculations
export const getColumnWidthPx = (width: ColumnWidth): number => {
  switch (width) {
    case "small":
      return 48; // 12 * 4px
    case "medium":
      return 64; // 16 * 4px
    case "large":
      return 96; // 24 * 4px
    case "xl":
      return 128; // 32 * 4px
    case "xxl":
      return 160; // 40 * 4px
    default:
      return 64; // 16 * 4px
  }
};

export const getRowHeightPx = (height: RowHeight): number => {
  switch (height) {
    case "small":
      return 24; // 6 * 4px
    case "medium":
      return 32; // 8 * 4px
    case "large":
      return 40; // 10 * 4px
    case "xl":
      return 48; // 12 * 4px
    case "xxl":
      return 64; // 16 * 4px
    default:
      return 32; // 8 * 4px
  }
};
// Fixed column widths
export const CHECKBOX_COLUMN_WIDTH = 40;
export const FILE_COLUMN_WIDTH = 120;
export const ACTION_COLUMN_WIDTH = 40;
