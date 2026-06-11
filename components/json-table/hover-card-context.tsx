import * as React from "react";

export type HoverCardPortalControl = {
  setPortalOpen: (open: boolean) => void;
};

export const HoverCardPortalContext =
  React.createContext<HoverCardPortalControl | null>(null);

export function useHoverCardPortalControl(): HoverCardPortalControl | null {
  return React.useContext(HoverCardPortalContext);
}
