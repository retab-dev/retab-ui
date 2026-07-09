"use client";

import * as React from "react";

import { restoreFileViewerSidebarFocusOnClose } from "./file-viewer-accessibility";
import {
  DEFAULT_FILE_VIEWER_SIDEBAR_WIDTH,
  useFileViewerContext,
  type FileViewerContextValue,
  type FileViewerSetSidebarRequestedOpen,
  type FileViewerShellStaticContextValue,
  type FileViewerSidebarCollapsible,
  type FileViewerSidebarDynamicContextValue,
  type FileViewerSidebarMode,
  type FileViewerSidebarOpenProps,
  type FileViewerSidebarRegistration,
  type FileViewerSidebarRequestedMode,
  type FileViewerSidebarSide,
  type FileViewerSidebarState,
} from "./file-viewer-context";
import { createFileViewerElementRegistry } from "./file-viewer-elements";
import { useFileViewerFrameKeyboard } from "./file-viewer-frame-keyboard";
import {
  createFileViewerMotionKernel,
  useFileViewerMotionFrame,
} from "./file-viewer-motion-kernel";
import { useFileViewerMotionTelemetry } from "./viewer-motion-telemetry";
import {
  FILE_VIEWER_MOTION_DURATION_MS,
  type FileViewerMotionTarget,
} from "./file-viewer-motion-plan";
import {
  readElementRectSnapshot,
  useStableElementSize,
} from "./viewer-measurement";

export const FILE_VIEWER_INLINE_BREAKPOINT = 768;

type FileViewerSidebarOpenController = {
  getSidebarRequestedOpen: () => boolean;
  isSidebarRequestedOpen: boolean;
  setSidebarRequestedOpen: (isSidebarRequestedOpen: boolean) => void;
};

// Bridges the controlled/uncontrolled `open` prop pair to real React state, so
// every toggle re-renders the tree and the declarative writers (data
// attributes, inert/aria, overlay translate classes) stay current.
function useFileViewerSidebarOpenController({
  collapsible,
  defaultOpen,
  onOpenChange,
  open,
}: FileViewerSidebarOpenProps & {
  collapsible: FileViewerSidebarCollapsible;
}): FileViewerSidebarOpenController {
  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? false,
  );
  const isSidebarRequestedOpen =
    collapsible === "none" ? true : (open ?? uncontrolledOpen);
  const openRef = React.useRef(isSidebarRequestedOpen);

  React.useLayoutEffect(() => {
    openRef.current = isSidebarRequestedOpen;
  }, [isSidebarRequestedOpen]);

  const getSidebarRequestedOpen = React.useCallback(() => openRef.current, []);

  const setSidebarRequestedOpen = React.useCallback(
    (nextIsSidebarRequestedOpen: boolean) => {
      openRef.current = nextIsSidebarRequestedOpen;
      if (!isControlled) {
        setUncontrolledOpen(nextIsSidebarRequestedOpen);
      }
      onOpenChange?.(nextIsSidebarRequestedOpen);
    },
    [isControlled, onOpenChange],
  );

  return React.useMemo(
    () => ({
      getSidebarRequestedOpen,
      isSidebarRequestedOpen,
      setSidebarRequestedOpen,
    }),
    [getSidebarRequestedOpen, isSidebarRequestedOpen, setSidebarRequestedOpen],
  );
}

type FileViewerSidebarRegistrationController = {
  canToggleSidebar: boolean;
  effectiveCollapsible: FileViewerSidebarCollapsible;
  registerSidebar: (registration: FileViewerSidebarRegistration) => () => void;
  side: FileViewerSidebarSide;
  sidebarId: string;
  sidebarWidth: string;
  sidebarWidthPixels: number;
};

// The mounted FileViewerSidebar is the single source of sidebar configuration
// (collapsible, side, width); the shell only holds neutral defaults until one
// registers. No sidebar registered means nothing to toggle and no motion, so
// no fallback width measurement is needed.
function useFileViewerSidebarRegistration({
  fallbackSidebarId,
}: {
  fallbackSidebarId: string;
}): FileViewerSidebarRegistrationController {
  const [sidebarRegistration, setSidebarRegistration] =
    React.useState<FileViewerSidebarRegistration | null>(null);
  const effectiveCollapsible = sidebarRegistration?.collapsible ?? "offcanvas";
  const side = sidebarRegistration?.side ?? "left";
  const sidebarId = sidebarRegistration?.id ?? fallbackSidebarId;
  const sidebarWidth =
    sidebarRegistration?.width ?? DEFAULT_FILE_VIEWER_SIDEBAR_WIDTH;
  const sidebarWidthPixels = sidebarRegistration?.widthPixels ?? 0;
  const canToggleSidebar =
    sidebarRegistration !== null && effectiveCollapsible !== "none";

  const registerSidebar = React.useCallback(
    (registration: FileViewerSidebarRegistration) => {
      setSidebarRegistration(registration);
      return () => {
        setSidebarRegistration((current) =>
          current?.id === registration.id ? null : current,
        );
      };
    },
    [],
  );

  return React.useMemo(
    () => ({
      canToggleSidebar,
      effectiveCollapsible,
      registerSidebar,
      side,
      sidebarId,
      sidebarWidth,
      sidebarWidthPixels,
    }),
    [
      canToggleSidebar,
      effectiveCollapsible,
      registerSidebar,
      side,
      sidebarId,
      sidebarWidth,
      sidebarWidthPixels,
    ],
  );
}

type FileViewerFrameControllerOptions = {
  inlineBreakpoint: number;
  sidebarMode: FileViewerSidebarRequestedMode;
};

export type FileViewerFrameController = {
  effectiveCollapsible: FileViewerSidebarCollapsible;
  headerMode: FileViewerContextValue["headerMode"];
  isSidebarRequestedOpen: boolean;
  mode: FileViewerSidebarMode;
  resourceCategory: FileViewerContextValue["resourceCategory"];
  rootId: string;
  setRootElement: (element: HTMLDivElement | null) => void;
  shellStaticContext: FileViewerShellStaticContextValue;
  side: FileViewerSidebarSide;
  sidebarDynamicContext: FileViewerSidebarDynamicContextValue;
  sidebarState: FileViewerSidebarState;
};

export function useFileViewerFrameController({
  inlineBreakpoint,
  sidebarMode,
}: FileViewerFrameControllerOptions): FileViewerFrameController {
  const context = useFileViewerContext();

  if (!context.isInsideFileViewer) {
    throw new Error("FileViewer must be rendered within FileViewerProvider.");
  }

  const rootId = React.useId();
  const fallbackSidebarId = `${rootId}-sidebar`;
  // The kernel owns time + style writes only; its settle-hold layout reads are
  // injected from the quarantined measurement module here at the controller
  // layer.
  const motionKernel = React.useMemo(
    () => createFileViewerMotionKernel({ readElementRectSnapshot }),
    [],
  );
  const size = useStableElementSize<HTMLDivElement>({
    retainLastNonZero: true,
  });
  const elementRegistry = React.useMemo(
    () =>
      createFileViewerElementRegistry({
        motionKernel,
        onViewerShellElementChange: size.setElement,
      }),
    [motionKernel, size.setElement],
  );
  const {
    canToggleSidebar,
    effectiveCollapsible,
    registerSidebar,
    side,
    sidebarId,
    sidebarWidth,
    sidebarWidthPixels,
  } = useFileViewerSidebarRegistration({
    fallbackSidebarId,
  });
  const openController = useFileViewerSidebarOpenController({
    ...context.sidebarOpenProps,
    collapsible: effectiveCollapsible,
  });
  const isSidebarRequestedOpen = openController.isSidebarRequestedOpen;
  const motionFrame = useFileViewerMotionFrame(motionKernel);
  const isSidebarTransitioning = motionFrame.phase === "sliding";
  const mode = resolveFileViewerSidebarMode({
    inlineBreakpoint,
    requestedMode: sidebarMode,
    width: size.width,
  });
  const isSidebarInteractive = resolveFileViewerSidebarInteractive({
    canToggleSidebar,
    collapsible: effectiveCollapsible,
    isSidebarRequestedOpen,
    isSidebarTransitioning,
    mode,
  });
  const sidebarState: FileViewerSidebarState = isSidebarRequestedOpen
    ? "expanded"
    : "collapsed";
  const motionTarget = React.useMemo<FileViewerMotionTarget>(
    () => ({
      shellInlineSize: size.width ?? 0,
      durationMs: FILE_VIEWER_MOTION_DURATION_MS,
      mode,
      open: isSidebarRequestedOpen,
      side,
      sidebarWidth: sidebarWidthPixels,
    }),
    [isSidebarRequestedOpen, mode, side, sidebarWidthPixels, size.width],
  );
  const motionTargetRef = React.useRef(motionTarget);

  const setRootElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      elementRegistry.registerViewerShellElement(element);
    },
    [elementRegistry],
  );

  React.useLayoutEffect(() => {
    motionTargetRef.current = motionTarget;
  }, [motionTarget]);

  // Adopt idle geometry (mount, resizes, mode flips) without animating. While
  // a motion is in flight the kernel owns the target — EXCEPT on a mode flip:
  // React renders the new mode immediately, so the kernel must be told (it
  // snaps the motion) or an inline slide keeps writing gap widths against
  // overlay DOM until settle.
  React.useLayoutEffect(() => {
    if (motionFrame.phase !== "idle" && motionFrame.mode === motionTarget.mode) {
      return;
    }
    motionKernel.syncTarget(motionTarget);
  }, [motionFrame.mode, motionFrame.phase, motionKernel, motionTarget]);

  // Single owner of focus restoration: when the sidebar stops being
  // interactive while focus is inside it, hand focus back to the trigger.
  const previousIsSidebarInteractiveRef = React.useRef(isSidebarInteractive);
  React.useLayoutEffect(() => {
    restoreFileViewerSidebarFocusOnClose({
      elements: elementRegistry.getElements(),
      isSidebarInteractive,
      previousIsSidebarInteractive: previousIsSidebarInteractiveRef.current,
    });
    previousIsSidebarInteractiveRef.current = isSidebarInteractive;
  }, [elementRegistry, isSidebarInteractive]);

  const setSidebarRequestedOpen =
    React.useCallback<FileViewerSetSidebarRequestedOpen>(
      (value) => {
        // Toggling requires a registered, collapsible sidebar; a non-collapsible
        // sidebar is pinned open and an unregistered one has nothing to move.
        if (!canToggleSidebar) return;

        const currentOpen = openController.getSidebarRequestedOpen();
        const nextOpen = typeof value === "function" ? value(currentOpen) : value;
        if (nextOpen === currentOpen) return;

        openController.setSidebarRequestedOpen(nextOpen);
        const nextTarget: FileViewerMotionTarget = {
          ...motionTargetRef.current,
          open: nextOpen,
        };
        motionTargetRef.current = nextTarget;
        motionKernel.startMotion(nextTarget);
      },
      [canToggleSidebar, motionKernel, openController],
    );
  const toggleSidebarRequestedOpen = React.useCallback(
    () => setSidebarRequestedOpen((open) => !open),
    [setSidebarRequestedOpen],
  );
  const closeSidebar = React.useCallback(
    () => setSidebarRequestedOpen(false),
    [setSidebarRequestedOpen],
  );

  useFileViewerFrameKeyboard({
    canToggleSidebar,
    closeSidebar,
    elementRegistry,
    isSidebarInteractive,
    isSidebarOverlayDismissible:
      mode === "overlay" && canToggleSidebar && isSidebarRequestedOpen,
    viewerShellElement: size.element,
  });

  useFileViewerMotionTelemetry({
    getElements: elementRegistry.getElements,
    getIsSidebarOpen: openController.getSidebarRequestedOpen,
    motionDurationMs: FILE_VIEWER_MOTION_DURATION_MS,
    motionKernel,
    toggleSidebar: toggleSidebarRequestedOpen,
  });

  const shellStaticContext = React.useMemo<FileViewerShellStaticContextValue>(
    () => ({
      canToggleSidebar,
      collapsible: effectiveCollapsible,
      elementRegistry,
      mode,
      motionDurationMs: FILE_VIEWER_MOTION_DURATION_MS,
      motionKernel,
      registerSidebar,
      rootId,
      setSidebarRequestedOpen,
      side,
      sidebarId,
      sidebarWidth,
      toggleSidebarRequestedOpen,
    }),
    [
      canToggleSidebar,
      effectiveCollapsible,
      elementRegistry,
      mode,
      motionKernel,
      registerSidebar,
      rootId,
      setSidebarRequestedOpen,
      side,
      sidebarId,
      sidebarWidth,
      toggleSidebarRequestedOpen,
    ],
  );
  const sidebarDynamicContext =
    React.useMemo<FileViewerSidebarDynamicContextValue>(
      () => ({
        isSidebarInteractive,
        isSidebarRequestedOpen,
        isSidebarTransitioning,
        sidebarState,
      }),
      [
        isSidebarInteractive,
        isSidebarRequestedOpen,
        isSidebarTransitioning,
        sidebarState,
      ],
    );

  return {
    effectiveCollapsible,
    headerMode: context.headerMode,
    isSidebarRequestedOpen,
    mode,
    resourceCategory: context.resourceCategory,
    rootId,
    setRootElement,
    shellStaticContext,
    side,
    sidebarDynamicContext,
    sidebarState,
  };
}

// An inline sidebar stays non-interactive while its geometry is in motion:
// closing makes it inert immediately, opening keeps it inert until the
// settle publish leaves the "sliding" phase.
function resolveFileViewerSidebarInteractive({
  canToggleSidebar,
  collapsible,
  isSidebarRequestedOpen,
  isSidebarTransitioning,
  mode,
}: {
  canToggleSidebar: boolean;
  collapsible: FileViewerSidebarCollapsible;
  isSidebarRequestedOpen: boolean;
  isSidebarTransitioning: boolean;
  mode: FileViewerSidebarMode;
}): boolean {
  if (collapsible === "none") return true;
  if (!isSidebarRequestedOpen) return false;
  return !(mode === "inline" && canToggleSidebar && isSidebarTransitioning);
}

function resolveFileViewerSidebarMode({
  inlineBreakpoint,
  requestedMode,
  width,
}: {
  inlineBreakpoint: number;
  requestedMode: FileViewerSidebarRequestedMode;
  width: number | null;
}): FileViewerSidebarMode {
  if (requestedMode !== "auto") return requestedMode;
  if (width === null) return "overlay";
  return width >= inlineBreakpoint ? "inline" : "overlay";
}
