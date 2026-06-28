import type * as React from "react";

export type ViewerSidebarMode = "inline" | "overlay";
export type ViewerSidebarRequestedMode = "auto" | ViewerSidebarMode;
export type ViewerSidebarGapTransition = "width" | "none";
export type ViewerSidebarState = "expanded" | "collapsed";
export type ViewerSidebarSide = "left" | "right";
export type ViewerSidebarCollapsible = "offcanvas" | "none";
export type ViewerDocumentFrameAlign = "start" | "center" | "end";
export type ViewerGeometryTransitionPhase = "idle" | "sliding";

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
  isTransitioning?: boolean;
};

export type ViewerDocumentPhysicalScrollPosition = {
  physicalScrollTop: number;
  scrollPageOffset: number;
};

export type ViewerDocumentResolvedScrollTarget = {
  left?: number;
  top: number;
};

export type ViewerDocumentScrollMapper = {
  getLogicalScrollTop: (input: {
    blockSize: number;
    physicalScrollTop: number;
    scrollPageOffset: number;
    viewportBlockSize: number;
  }) => number;
  getPhysicalScrollSize: (input: {
    blockSize: number;
    viewportBlockSize: number;
  }) => number;
  resolvePhysicalScrollPosition: (input: {
    blockSize: number;
    logicalScrollTop: number;
    scrollPageOffset: number;
    viewportBlockSize: number;
  }) => ViewerDocumentPhysicalScrollPosition;
};

export type ViewerDocumentScrollMetrics = {
  physicalScrollSize: number;
  physicalScrollTop: number;
  scrollPageOffset: number;
  scrollTop: number;
  viewportBlockSize: number;
};

export type ViewerDocumentScrollTargetResolver<Anchor, Target> = (input: {
  layout: ViewerDocumentLayoutModel<Anchor>;
  scrollTop: number;
  target: Target;
  viewportElement: HTMLDivElement;
}) => ViewerDocumentResolvedScrollTarget | null;

export type ViewerGeometrySnapshot = {
  bodyInlineSize: number;
  documentInlineSize: number;
  hasMeasuredBody: boolean;
  isTransitioning: boolean;
  mode: ViewerSidebarMode;
  open: boolean;
  progress: number;
  sidebarGapTransition: ViewerSidebarGapTransition;
  sidebarInlineSize: number;
  sidebarWidth: number;
  side: ViewerSidebarSide;
  state: ViewerSidebarState;
  transitionPhase: ViewerGeometryTransitionPhase;
};

export type ViewerGeometryStore = {
  getSnapshot: () => ViewerGeometrySnapshot;
  setTarget: (target: ViewerGeometryTarget) => void;
  subscribe: (listener: () => void) => () => void;
};

export type ViewerGeometryTarget = {
  bodyElement: HTMLElement | null;
  mode: ViewerSidebarMode;
  open: boolean;
  rootElement: HTMLElement | null;
  sidebarElement: HTMLElement | null;
  sidebarGapTransition: ViewerSidebarGapTransition;
  sidebarWidth: number;
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
  widthPixels: number;
};

export type ViewerPortalContainmentAttributes = {
  "data-viewer-portal-root-id": string;
};

export type ViewerSidebarRegistrationState = {
  defaultSidebarCollapsible: ViewerSidebarCollapsible;
  defaultSidebarSide: ViewerSidebarSide;
  geometryStore: ViewerGeometryStore;
  getRootElement: () => HTMLElement | null;
  hasSidebar: boolean;
  registerBody: (element: HTMLElement) => () => void;
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
