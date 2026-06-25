"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";
import { cn } from "@/lib/utils";

import {
  createViewerStateAttributes,
  createViewerPortalContainmentAttributes,
  elementContainsTarget,
  readViewerElementSize,
  resolveMeasuredSidebarMode,
  resolveSidebarMode,
  targetHasViewerPortalContainment,
  targetViewerRootId,
  useOptionalViewerSidebarRegistration,
  useOptionalViewerSidebarState,
  useViewerSidebarState,
  VIEWER_SIDEBAR_INLINE_BREAKPOINT,
  VIEWER_SIDEBAR_WIDTH,
  ViewerSidebarRegistrationProvider,
  ViewerSidebarStateProvider,
} from "./viewer-internals";
import type {
  ViewerRootDiagnostics,
  ViewerPortalContainmentAttributes,
  ViewerRootProps,
  ViewerSidebarStateValue,
  ViewerSidebarMode,
  ViewerSidebarRegistration,
  ViewerSidebarRegistrationState,
  ViewerSidebarState,
} from "./viewer-types";

export function useViewerSidebar(): ViewerSidebarStateValue {
  return useViewerSidebarState("useViewerSidebar");
}

export function useOptionalViewerSidebar(): ViewerSidebarStateValue | null {
  return useOptionalViewerSidebarState();
}

export function useViewerPortalContainmentAttributes(): ViewerPortalContainmentAttributes {
  const context = useOptionalViewerSidebarRegistration();
  if (!context) {
    throw new Error(
      "useViewerPortalContainmentAttributes must be used within a ViewerRoot.",
    );
  }

  return React.useMemo(
    () => createViewerPortalContainmentAttributes(context.rootId),
    [context.rootId],
  );
}

export function useOptionalViewerRootDiagnostics(): ViewerRootDiagnostics | null {
  const context = useOptionalViewerSidebarRegistration();
  if (!context) return null;

  return {
    getRootElement: context.getRootElement,
    layoutSignature: [
      context.hasSidebar ? "sidebar" : "no-sidebar",
      context.sidebarSide,
      context.sidebarState.mode,
      context.sidebarState.open ? "open" : "closed",
      context.sidebarState.state,
    ].join(":"),
    rootId: context.rootId,
  };
}

export function ViewerRoot({
  className,
  style,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  mode = "auto",
  inlineBreakpoint = VIEWER_SIDEBAR_INLINE_BREAKPOINT,
  sidebarSide = "left",
  sidebarCollapsible = "offcanvas",
  stateNamespace,
  ...props
}: ViewerRootProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const reactId = React.useId();
  const rootId = `${reactId}-viewer-root`;
  const fallbackSidebarId = `${reactId}-viewer-sidebar`;
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const openRef = React.useRef(open);
  openRef.current = open;
  const hasMeasuredSidebarWidthRef = React.useRef(false);
  const lastTriggerElementRef = React.useRef<HTMLElement | null>(null);
  const registeredSidebarRef = React.useRef<ViewerSidebarRegistration | null>(
    null,
  );
  const [registeredSidebar, setRegisteredSidebar] =
    React.useState<ViewerSidebarRegistration | null>(null);
  const [resolvedSidebarMode, setResolvedSidebarMode] =
    React.useState<ViewerSidebarMode>(() =>
      resolveSidebarMode({
        requestedMode: mode,
        width: null,
        inlineBreakpoint,
      }),
    );

  useKeyedLayoutEffect(joinEffectKey([inlineBreakpoint, mode]), () => {
    if (mode !== "auto") {
      setResolvedSidebarMode((currentMode) =>
        currentMode === mode ? currentMode : mode,
      );
      return;
    }

    const element = rootRef.current;
    const ResizeObserverConstructor = globalThis.ResizeObserver;
    if (!element || typeof ResizeObserverConstructor === "undefined") return;

    const updateMode = () => {
      const nextWidth = readViewerElementSize(element).width;
      if (nextWidth === 0) return;

      setResolvedSidebarMode((currentMode) => {
        const nextMode = resolveMeasuredSidebarMode({
          currentMode,
          hasMeasured: hasMeasuredSidebarWidthRef.current,
          requestedMode: mode,
          width: nextWidth,
          inlineBreakpoint,
        });

        hasMeasuredSidebarWidthRef.current = true;
        return currentMode === nextMode ? currentMode : nextMode;
      });
    };

    updateMode();

    const observer = new ResizeObserverConstructor(updateMode);
    observer.observe(element);

    return () => observer.disconnect();
  });

  const setOpen = React.useCallback(
    (value: boolean | ((open: boolean) => boolean)) => {
      const previousOpen = isControlled ? open : openRef.current;
      const nextOpen =
        typeof value === "function" ? value(previousOpen) : value;

      if (nextOpen === previousOpen) {
        return;
      }

      if (!isControlled) {
        openRef.current = nextOpen;
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange, open],
  );

  const registerSidebar = React.useCallback(
    (registration: ViewerSidebarRegistration) => {
      const currentRegistration = registeredSidebarRef.current;

      if (
        currentRegistration &&
        currentRegistration.instanceId !== registration.instanceId
      ) {
        throw new Error(
          "ViewerRoot supports one primary ViewerSidebar. Use a nested ViewerRoot for a complete nested viewer, or put secondary content inside ViewerSurface.",
        );
      }

      registeredSidebarRef.current = registration;
      setRegisteredSidebar(registration);

      return () => {
        if (
          registeredSidebarRef.current?.instanceId !== registration.instanceId
        ) {
          return;
        }

        registeredSidebarRef.current = null;
        setRegisteredSidebar(null);
      };
    },
    [],
  );

  const toggleSidebar = React.useCallback(() => {
    setOpen((currentOpen) => !currentOpen);
  }, [setOpen]);

  const hasSidebar = registeredSidebar !== null;
  const effectiveOpen = registeredSidebar?.collapsible === "none" ? true : open;
  const state: ViewerSidebarState = effectiveOpen ? "expanded" : "collapsed";
  const canToggleSidebar =
    hasSidebar && registeredSidebar.collapsible !== "none";
  const sidebarId = registeredSidebar?.id ?? fallbackSidebarId;
  const resolvedSidebarSide = registeredSidebar?.side ?? sidebarSide;
  const sidebarWidth = registeredSidebar?.width ?? VIEWER_SIDEBAR_WIDTH;
  const namespacedRootStateAttributes = createViewerStateAttributes(
    stateNamespace,
    "root",
    {
      hasSidebar,
      sidebarCollapsible: registeredSidebar?.collapsible ?? sidebarCollapsible,
      sidebarMode: resolvedSidebarMode,
      sidebarOpen: effectiveOpen,
      sidebarSide: resolvedSidebarSide,
      sidebarState: state,
    },
  );
  const setLastTriggerElement = React.useCallback(
    (element: HTMLElement | null) => {
      lastTriggerElementRef.current = element;
    },
    [],
  );
  const getRootElement = React.useCallback(() => rootRef.current, []);

  useKeyedMountEffect(
    joinEffectKey([
      canToggleSidebar,
      open,
      registeredSidebar,
      resolvedSidebarMode,
      rootId,
      setOpen,
    ]),
    () => {
      if (
        !open ||
        !canToggleSidebar ||
        resolvedSidebarMode !== "overlay" ||
        typeof document === "undefined"
      ) {
        return;
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          if (event.defaultPrevented) {
            return;
          }

          const activeElement = document.activeElement;
          if (
            activeElement &&
            rootRef.current &&
            !elementContainsTarget(rootRef.current, activeElement) &&
            !elementContainsTarget(registeredSidebar?.element, activeElement) &&
            !targetHasViewerPortalContainment({
              rootId,
              target: activeElement,
            })
          ) {
            return;
          }

          setOpen(false);
          const triggerElement =
            lastTriggerElementRef.current?.isConnected === true
              ? lastTriggerElementRef.current
              : rootRef.current?.querySelector<HTMLElement>(
                  "[data-viewer-sidebar-trigger]",
                );
          if (typeof triggerElement?.focus === "function") {
            triggerElement.focus();
          }
        }
      };
      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target;

        if (elementContainsTarget(registeredSidebar?.element, target)) {
          return;
        }

        if (targetHasViewerPortalContainment({ rootId, target })) {
          return;
        }

        const targetRootId = targetViewerRootId(target);
        if (targetRootId && targetRootId !== rootId) {
          return;
        }

        if (
          target &&
          typeof (target as { closest?: unknown }).closest === "function"
        ) {
          const triggerElement = (
            target as unknown as {
              closest: (selector: string) => HTMLElement | null;
            }
          ).closest("[data-viewer-sidebar-trigger]");
          if (triggerElement?.dataset.viewerRootId === rootId) {
            return;
          }
        }

        setOpen(false);
      };

      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("pointerdown", handlePointerDown);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("pointerdown", handlePointerDown);
      };
    },
  );

  const sidebarStateContext = React.useMemo<ViewerSidebarStateValue>(
    () => ({
      state,
      open: effectiveOpen,
      setOpen,
      toggleSidebar,
      canToggleSidebar,
      mode: resolvedSidebarMode,
      side: resolvedSidebarSide,
    }),
    [
      state,
      effectiveOpen,
      setOpen,
      toggleSidebar,
      canToggleSidebar,
      resolvedSidebarMode,
      resolvedSidebarSide,
    ],
  );

  const sidebarRegistrationContext =
    React.useMemo<ViewerSidebarRegistrationState>(
      () => ({
        defaultSidebarCollapsible: sidebarCollapsible,
        defaultSidebarSide: sidebarSide,
        getRootElement,
        hasSidebar,
        sidebarState: sidebarStateContext,
        registerSidebar,
        rootId,
        sidebarId,
        sidebarSide: resolvedSidebarSide,
        setLastTriggerElement,
        stateNamespace,
      }),
      [
        hasSidebar,
        sidebarCollapsible,
        resolvedSidebarSide,
        sidebarStateContext,
        getRootElement,
        registerSidebar,
        rootId,
        sidebarId,
        sidebarSide,
        setLastTriggerElement,
        stateNamespace,
      ],
    );

  return (
    <ViewerSidebarStateProvider value={sidebarStateContext}>
      <ViewerSidebarRegistrationProvider value={sidebarRegistrationContext}>
        <div
          ref={rootRef}
          data-slot="viewer-root"
          data-viewer-root-id={rootId}
          data-viewer-has-sidebar={hasSidebar ? "true" : "false"}
          data-viewer-sidebar-collapsible={
            registeredSidebar?.collapsible ?? sidebarCollapsible
          }
          data-viewer-sidebar-mode={resolvedSidebarMode}
          data-viewer-sidebar-open={effectiveOpen ? "true" : "false"}
          data-viewer-sidebar-side={resolvedSidebarSide}
          data-viewer-sidebar-state={state}
          data-viewer-slot="root"
          {...namespacedRootStateAttributes}
          className={cn(
            "relative flex min-h-0 min-w-0 flex-col overflow-hidden",
            className,
          )}
          style={
            {
              ...style,
              "--viewer-sidebar-width": sidebarWidth,
            } as React.CSSProperties
          }
          {...props}
        />
      </ViewerSidebarRegistrationProvider>
    </ViewerSidebarStateProvider>
  );
}
