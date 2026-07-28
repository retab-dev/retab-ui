import type * as React from "react";

export type JsonFormTextInput = "input" | "textarea";
export type DateTimeControlKind = "date" | "time" | "date-time";

export interface ControlFieldApi {
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  name: string;
  ref?: React.Ref<HTMLElement>;
}

export type ScalarControlDomProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "data-slot"?: string;
};

export const compactJsonFormDataCellClass =
  "h-8 rounded-md border-transparent bg-transparent px-2 text-sm shadow-none transition-colors hover:border-border hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30";

export const compactJsonFormSelectDataCellClass =
  "h-8 rounded-md border-transparent bg-transparent px-2 text-sm shadow-none transition-colors hover:border-border hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30";
