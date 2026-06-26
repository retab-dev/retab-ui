import type * as React from "react";

export type ViewerSidebarMode = "inline" | "overlay";
export type ViewerSidebarRequestedMode = "auto" | ViewerSidebarMode;
export type ViewerSidebarGapTransition = "width" | "none";
export type ViewerSidebarState = "expanded" | "collapsed";
export type ViewerSidebarSide = "left" | "right";
export type ViewerSidebarCollapsible = "offcanvas" | "none";
export type ViewerDocumentFrameAlign = "start" | "center" | "end";

export type ViewerDocumentReadingAnchorInput = {
  scrollTop: number;
  viewportBlockSize: number;
};

export type ViewerDocumentReadingAnchorTarget<Anchor> = {
  anchor: Anchor;
  viewportBlockSize: number;
};

export type ViewerDocumentLayoutModel<Anchor> = {
  blockSize: number;
  captureReadingAnchor: (
    input: ViewerDocumentReadingAnchorInput,
  ) => Anchor | null;
  getReadingAnchorScrollTop: (
    target: ViewerDocumentReadingAnchorTarget<Anchor>,
  ) => number | null;
  inlineSize: number;
};

export type ViewerSidebarLayoutSnapshot = {
  isTransitioning: boolean;
  mode: ViewerSidebarMode;
  open: boolean;
  progress: number;
  sidebarGapTransition: ViewerSidebarGapTransition;
  sidebarWidth: number;
  side: ViewerSidebarSide;
  state: ViewerSidebarState;
};

export type ViewerSidebarLayoutStore = {
  getSnapshot: () => ViewerSidebarLayoutSnapshot;
  setTarget: (target: ViewerSidebarLayoutTarget) => void;
  subscribe: (listener: () => void) => () => void;
};

export type ViewerSidebarLayoutTarget = {
  mode: ViewerSidebarMode;
  open: boolean;
  rootElement: HTMLElement | null;
  sidebarElement: HTMLElement | null;
  sidebarGapTransition: ViewerSidebarGapTransition;
  side: ViewerSidebarSide;
  state: ViewerSidebarState;
};

export type ViewerSidebarStateValue = {
  state: ViewerSidebarState;
  open: boolean;
  setOpen: (value: boolean | ((open: boolean) => boolean)) => void;
  toggleSidebar: () => void;
  canToggleSidebar: boolean;
  mode: ViewerSidebarMode;
  side: ViewerSidebarSide;
};

export type ViewerRootProps = React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  inlineBreakpoint?: number;
  mode?: ViewerSidebarRequestedMode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  sidebarCollapsible?: ViewerSidebarCollapsible;
  sidebarGapTransition?: ViewerSidebarGapTransition;
  sidebarSide?: ViewerSidebarSide;
  stateNamespace?: ViewerStateAttributeNamespace;
};

export type ViewerFrameProps = React.ComponentProps<"div">;
export type ViewerHeaderProps = React.ComponentProps<"div">;
export type ViewerBodyProps = React.ComponentProps<"div">;
export type ViewerSurfaceProps = React.ComponentProps<"div">;
export type ViewerViewportProps = React.ComponentProps<"div">;
export type ViewerDocumentFrameProps = React.ComponentProps<"div"> & {
  align?: ViewerDocumentFrameAlign;
  maxInlineSize?: React.CSSProperties["maxInlineSize"];
};

export type ViewerStateAttributeNamespace = {
  prefix: string;
  slots?: {
    body?: boolean;
    root?: boolean;
    sidebar?: boolean;
  };
};

export type ViewerSidebarRegistration = {
  collapsible: ViewerSidebarCollapsible;
  element: HTMLElement;
  id: string;
  instanceId: string;
  side: ViewerSidebarSide;
  width: string;
};

export type ViewerPortalContainmentAttributes = {
  "data-viewer-portal-root-id": string;
};

export type ViewerSidebarRegistrationState = {
  defaultSidebarCollapsible: ViewerSidebarCollapsible;
  defaultSidebarSide: ViewerSidebarSide;
  getRootElement: () => HTMLElement | null;
  hasSidebar: boolean;
  layoutStore: ViewerSidebarLayoutStore;
  sidebarState: ViewerSidebarStateValue;
  registerSidebar: (registration: ViewerSidebarRegistration) => () => void;
  rootId: string;
  sidebarId: string;
  sidebarGapTransition: ViewerSidebarGapTransition;
  sidebarSide: ViewerSidebarSide;
  setLastTriggerElement: (element: HTMLElement | null) => void;
  stateNamespace?: ViewerStateAttributeNamespace;
};

export type ViewerRootDiagnostics = {
  getRootElement: () => HTMLElement | null;
  layoutSignature: string;
  rootId: string;
};

export type ViewerSurfaceMeasurement = {
  hasMeasured: boolean;
  setViewportElement: React.RefCallback<HTMLDivElement>;
  viewportElement: HTMLDivElement | null;
  viewportHeight: number | null;
  viewportWidth: number | null;
};

export type ViewerSidebarSlotNames = {
  container?: string;
  gap?: string;
  inner?: string;
};

export type ViewerStateAttributeSlot = "body" | "root" | "sidebar";
export type ViewerStateAttributeValues = {
  hasSidebar?: boolean;
  sidebarCollapsible?: ViewerSidebarCollapsible;
  sidebarMode?: ViewerSidebarMode;
  sidebarOpen?: boolean;
  sidebarSide?: ViewerSidebarSide;
  sidebarState?: ViewerSidebarState;
};
export type ViewerDataAttributes = Record<`data-${string}`, string | undefined>;

export type ViewerSidebarProps = React.ComponentProps<"aside"> &
  ViewerDataAttributes & {
    side?: ViewerSidebarSide;
    collapsible?: ViewerSidebarCollapsible;
    innerClassName?: string;
    namespacedSlot?: string;
    namespacedSlotNames?: ViewerSidebarSlotNames;
    slotNames?: ViewerSidebarSlotNames;
    width?: string;
  };
