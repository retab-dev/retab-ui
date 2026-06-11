import * as React from "react";

export type HoverInfo = { docId: string; fieldPath: string; rect: DOMRect };

export type HoverInfoContextValue = {
  hoverInfo: HoverInfo | null;
  setHoverInfo: React.Dispatch<React.SetStateAction<HoverInfo | null>>;
};

export const HoverInfoContext =
  React.createContext<HoverInfoContextValue | null>(null);

export function useHoverInfo(): HoverInfoContextValue {
  const ctx = React.useContext(HoverInfoContext);
  if (!ctx) {
    throw new Error(
      "useHoverInfo must be used within a HoverInfoContext.Provider",
    );
  }
  return ctx;
}
