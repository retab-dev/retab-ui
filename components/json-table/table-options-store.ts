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
export const ACTION_COLUMN_WIDTH = 40;
