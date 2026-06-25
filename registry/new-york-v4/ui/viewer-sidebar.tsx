"use client";

import * as React from "react";

import { useMountEffect } from "@/hooks/use-mount-effect";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";
import { cn } from "@/lib/utils";

import {
  createViewerSlotAttributes,
  createViewerStateAttributes,
  pickCssCustomProperties,
  readViewerElementSize,
  useViewerDevelopmentLayoutWarning,
  useViewerSidebarRegistrationContext,
  VIEWER_SIDEBAR_WIDTH,
} from "./viewer-internals";
import { warnViewerDevelopmentOnce } from "./viewer-diagnostics";
import type { ViewerSidebarProps, ViewerSidebarState } from "./viewer-types";

export function ViewerSidebar({
  children,
  className,
  innerClassName,
  namespacedSlot,
  namespacedSlotNames,
  side: sideProp,
  slotNames,
  collapsible: collapsibleProp,
  width = VIEWER_SIDEBAR_WIDTH,
  style,
  id: idProp,
  ...props
}: ViewerSidebarProps) {
  const registrationContext =
    useViewerSidebarRegistrationContext("ViewerSidebar");
  const {
    defaultSidebarCollapsible,
    defaultSidebarSide,
    getRootElement,
    registerSidebar,
    rootId,
    sidebarState,
  } = registrationContext;
  const reactId = React.useId();
  const instanceId = `${reactId}-viewer-sidebar-instance`;
  const generatedSidebarId = `${reactId}-viewer-sidebar`;
  const sidebarId = idProp ?? generatedSidebarId;
  const sidebarRef = React.useRef<HTMLElement | null>(null);
  const collapsible = collapsibleProp ?? defaultSidebarCollapsible;
  const side = sideProp ?? defaultSidebarSide;
  const open = collapsible === "none" ? true : sidebarState.open;
  const state: ViewerSidebarState = open ? "expanded" : "collapsed";
  const mode = sidebarState.mode;
  const isCollapsed = collapsible !== "none" && !open;
  const frameSlot = props["data-slot"] ?? "viewer-sidebar";
  const sidebarProps = { ...props };
  delete sidebarProps["data-slot"];
  const styleWithoutWidth: React.CSSProperties = { ...style };
  delete styleWithoutWidth.width;
  const customProperties = pickCssCustomProperties(style);
  const frameStyle = {
    ...customProperties,
    "--viewer-sidebar-width": width,
  } as React.CSSProperties;
  const ariaLabel = sidebarProps["aria-label"];
  const ariaLabelledBy = sidebarProps["aria-labelledby"];
  const hasAccessibleName =
    (typeof ariaLabel === "string"
      ? ariaLabel.trim().length > 0
      : Boolean(ariaLabel)) ||
    (typeof ariaLabelledBy === "string"
      ? ariaLabelledBy.trim().length > 0
      : Boolean(ariaLabelledBy));

  useViewerDevelopmentLayoutWarning({
    enabled: mode === "inline" && open,
    elements: () => [getRootElement(), sidebarRef.current],
    inspect: () => {
      const rootElement = getRootElement();
      const sidebarElement = sidebarRef.current;
      const rootSize = readViewerElementSize(rootElement);
      const sidebarSize = readViewerElementSize(sidebarElement);

      if (rootSize.width > 0 && sidebarSize.width > rootSize.width) {
        warnViewerDevelopmentOnce({
          code: "viewer_sidebar_wider_than_root",
          message: "inline viewer sidebar is wider than its root.",
          rootId,
          details: {
            rootSlot: rootElement?.dataset.slot,
            rootWidth: rootSize.width,
            sidebarMode: mode,
            sidebarOpen: open,
            sidebarSide: side,
            sidebarSlot: sidebarElement?.dataset.slot,
            sidebarWidth: sidebarSize.width,
          },
        });
      }
    },
    keyParts: [
      "viewer-sidebar-wider-than-root",
      rootId,
      mode,
      open,
      side,
      width,
      getRootElement(),
      sidebarRef.current,
    ],
  });

  useMountEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      sidebarRef.current?.setAttribute(
        "data-viewer-sidebar-transitions",
        "ready",
      );
      return;
    }
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        sidebarRef.current?.setAttribute(
          "data-viewer-sidebar-transitions",
          "ready",
        );
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  });

  useKeyedLayoutEffect(
    joinEffectKey([
      collapsible,
      instanceId,
      registerSidebar,
      side,
      sidebarId,
      width,
    ]),
    () => {
      const element = sidebarRef.current;

      if (!element) {
        return;
      }

      return registerSidebar({
        collapsible,
        element,
        id: sidebarId,
        instanceId,
        side,
        width,
      });
    },
  );

  useKeyedLayoutEffect(
    mode === "overlay" && open && !hasAccessibleName
      ? joinEffectKey([
          "viewer-overlay-sidebar-missing-accessible-name",
          rootId,
          sidebarId,
          side,
        ])
      : null,
    () => {
      warnViewerDevelopmentOnce({
        code: "viewer_overlay_sidebar_missing_accessible_name",
        message: "overlay viewer sidebar is missing an accessible name.",
        rootId,
        details: {
          sidebarId,
          sidebarMode: mode,
          sidebarSide: side,
        },
      });
    },
  );

  const hiddenProps = isCollapsed
    ? ({
        "aria-hidden": true,
        inert: true,
      } as React.HTMLAttributes<HTMLElement>)
    : {};
  const namespacedSidebarStateAttributes = createViewerStateAttributes(
    registrationContext.stateNamespace,
    "sidebar",
    {
      sidebarCollapsible: collapsible,
      sidebarMode: mode,
      sidebarOpen: open,
      sidebarSide: side,
      sidebarState: state,
    },
  );

  return (
    <div
      data-slot={frameSlot}
      data-collapsible={collapsible}
      data-mode={mode}
      data-side={side}
      data-state={state}
      data-viewer-sidebar-mode={mode}
      data-viewer-sidebar-open={open ? "true" : "false"}
      data-viewer-sidebar-state={state}
      data-viewer-slot="sidebar"
      {...createViewerSlotAttributes(
        registrationContext.stateNamespace,
        "sidebar",
        namespacedSlot,
      )}
      {...namespacedSidebarStateAttributes}
      className={cn(
        "group/viewer-sidebar relative z-30 min-h-0 flex-shrink-0",
        side === "right" && "order-last",
      )}
      style={frameStyle}
    >
      <div
        data-slot={slotNames?.gap ?? "viewer-sidebar-gap"}
        data-viewer-slot="sidebar-gap"
        {...createViewerSlotAttributes(
          registrationContext.stateNamespace,
          "sidebar",
          namespacedSlotNames?.gap,
        )}
        className={cn(
          "relative h-full w-(--viewer-sidebar-width) flex-shrink-0 transition-[width] duration-200 ease-out",
          collapsible === "offcanvas" && mode === "overlay" && "w-0",
          collapsible === "offcanvas" && mode === "inline" && !open && "w-0",
        )}
      />
      <aside
        ref={sidebarRef}
        id={sidebarId}
        data-slot={slotNames?.container ?? "viewer-sidebar-container"}
        data-collapsible={collapsible}
        data-mode={mode}
        data-side={side}
        data-state={state}
        data-viewer-sidebar-mode={mode}
        data-viewer-sidebar-open={open ? "true" : "false"}
        data-viewer-sidebar-state={state}
        data-viewer-slot="sidebar-container"
        {...createViewerSlotAttributes(
          registrationContext.stateNamespace,
          "sidebar",
          namespacedSlotNames?.container,
        )}
        {...namespacedSidebarStateAttributes}
        className={cn(
          "absolute inset-y-0 z-30 flex w-(--viewer-sidebar-width) min-w-0 overflow-hidden",
          "transition-none data-[viewer-sidebar-transitions=ready]:transition-[translate,width,border-color] data-[viewer-sidebar-transitions=ready]:duration-200 data-[viewer-sidebar-transitions=ready]:ease-out",
          side === "left" && "left-0",
          side === "right" && "right-0",
          collapsible === "offcanvas" && mode === "overlay" && "shadow-lg",
          collapsible === "offcanvas" &&
            !open &&
            side === "left" &&
            "pointer-events-none -translate-x-full border-transparent",
          collapsible === "offcanvas" &&
            !open &&
            side === "right" &&
            "pointer-events-none translate-x-full border-transparent",
          className,
        )}
        style={
          {
            ...styleWithoutWidth,
            "--viewer-sidebar-width": width,
          } as React.CSSProperties
        }
        {...sidebarProps}
        {...hiddenProps}
      >
        <div
          data-slot={slotNames?.inner ?? "viewer-sidebar-inner"}
          data-viewer-slot="sidebar-inner"
          {...createViewerSlotAttributes(
            registrationContext.stateNamespace,
            "sidebar",
            namespacedSlotNames?.inner,
          )}
          className={cn(
            "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden",
            innerClassName,
          )}
        >
          {children}
        </div>
      </aside>
    </div>
  );
}
