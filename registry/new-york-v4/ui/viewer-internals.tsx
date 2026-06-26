"use client";

import * as React from "react";

import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

import type {
  ViewerDataAttributes,
  ViewerPortalContainmentAttributes,
  ViewerSidebarStateValue,
  ViewerSidebarLayoutSnapshot,
  ViewerSidebarLayoutStore,
  ViewerSidebarLayoutTarget,
  ViewerSidebarRegistrationState,
  ViewerSidebarRequestedMode,
  ViewerSidebarMode,
  ViewerStateAttributeNamespace,
  ViewerStateAttributeSlot,
  ViewerStateAttributeValues,
  ViewerSurfaceMeasurement,
} from "./viewer-types";

export const VIEWER_SIDEBAR_INLINE_BREAKPOINT = 768;
export const VIEWER_SIDEBAR_WIDTH = "10rem";
export const VIEWER_ROOT_ID_ATTRIBUTE = "data-viewer-root-id";
export const VIEWER_PORTAL_ROOT_ID_ATTRIBUTE = "data-viewer-portal-root-id";

const VIEWER_SIDEBAR_MODE_HYSTERESIS = 16;
const VIEWER_SIDEBAR_LAYOUT_TRANSITION_MS = 200;

const DEFAULT_VIEWER_SIDEBAR_LAYOUT_SNAPSHOT: ViewerSidebarLayoutSnapshot = {
  isTransitioning: false,
  mode: "overlay",
  open: false,
  progress: 0,
  sidebarGapTransition: "width",
  sidebarWidth: 0,
  side: "left",
  state: "collapsed",
};

const ViewerSidebarStateContext =
  React.createContext<ViewerSidebarStateValue | null>(null);
const ViewerSidebarRegistrationContext =
  React.createContext<ViewerSidebarRegistrationState | null>(null);
const ViewerSurfaceMeasurementContext =
  React.createContext<ViewerSurfaceMeasurement | null>(null);
const ViewerViewportPresenceContext = React.createContext(false);

export function ViewerSidebarStateProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ViewerSidebarStateValue;
}) {
  return React.createElement(
    ViewerSidebarStateContext.Provider,
    { value },
    children,
  );
}

export function ViewerSidebarRegistrationProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ViewerSidebarRegistrationState;
}) {
  return React.createElement(
    ViewerSidebarRegistrationContext.Provider,
    { value },
    children,
  );
}

export function ViewerSurfaceMeasurementProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ViewerSurfaceMeasurement;
}) {
  return React.createElement(
    ViewerSurfaceMeasurementContext.Provider,
    { value },
    children,
  );
}

export function ViewerViewportPresenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return React.createElement(
    ViewerViewportPresenceContext.Provider,
    { value: true },
    children,
  );
}

export function useOptionalViewerSidebarState(): ViewerSidebarStateValue | null {
  return React.useContext(ViewerSidebarStateContext);
}

export function useViewerSidebarState(
  consumer: string,
): ViewerSidebarStateValue {
  const context = useOptionalViewerSidebarState();
  if (!context) {
    throw new Error(`${consumer} must be used within a ViewerRoot.`);
  }
  return context;
}

export function useOptionalViewerSidebarRegistration(): ViewerSidebarRegistrationState | null {
  return React.useContext(ViewerSidebarRegistrationContext);
}

export function useOptionalViewerSurfaceMeasurementContext(): ViewerSurfaceMeasurement | null {
  return React.useContext(ViewerSurfaceMeasurementContext);
}

export function useViewerViewportPresence(): boolean {
  return React.useContext(ViewerViewportPresenceContext);
}

export function createViewerSidebarLayoutStore(): ViewerSidebarLayoutStore {
  const listeners = new Set<() => void>();
  let animationFrame = 0;
  let didInitialize = false;
  let snapshot = DEFAULT_VIEWER_SIDEBAR_LAYOUT_SNAPSHOT;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const commitSnapshot = (
    nextSnapshot: ViewerSidebarLayoutSnapshot,
    rootElement: HTMLElement | null,
  ) => {
    snapshot = nextSnapshot;
    writeViewerSidebarProgress(rootElement, nextSnapshot.progress);
    notify();
  };

  const stopAnimation = () => {
    if (!animationFrame) return;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };

  return {
    getSnapshot: () => snapshot,
    setTarget: (target) => {
      stopAnimation();

      const sidebarWidth = readViewerSidebarLayoutWidth(target);
      const targetProgress =
        target.mode === "inline" && target.open ? 1 : 0;
      const hasSidebarElement = target.sidebarElement !== null;
      const nextBaseSnapshot: ViewerSidebarLayoutSnapshot = {
        isTransitioning: false,
        mode: target.mode,
        open: target.open,
        progress: snapshot.progress,
        sidebarGapTransition: target.sidebarGapTransition,
        sidebarWidth,
        side: target.side,
        state: target.state,
      };
      if (!hasSidebarElement) {
        didInitialize = false;
        commitSnapshot(
          {
            ...nextBaseSnapshot,
            progress: targetProgress,
          },
          target.rootElement,
        );
        return;
      }

      const shouldAnimate =
        didInitialize &&
        snapshot.mode === target.mode &&
        target.mode === "inline" &&
        target.sidebarGapTransition === "width" &&
        snapshot.sidebarWidth > 0 &&
        sidebarWidth > 0 &&
        Math.abs(snapshot.progress - targetProgress) > 0.001;

      didInitialize = true;

      if (!shouldAnimate) {
        commitSnapshot(
          {
            ...nextBaseSnapshot,
            progress: targetProgress,
          },
          target.rootElement,
        );
        return;
      }

      const startProgress = snapshot.progress;
      const startedAt = readViewerNow();

      const tick = () => {
        animationFrame = 0;
        const elapsed = readViewerNow() - startedAt;
        const progressRatio = clampViewerRatio(
          elapsed / VIEWER_SIDEBAR_LAYOUT_TRANSITION_MS,
        );
        const progress =
          startProgress + (targetProgress - startProgress) * progressRatio;

        commitSnapshot(
          {
            ...nextBaseSnapshot,
            isTransitioning: progressRatio < 1,
            progress,
          },
          target.rootElement,
        );

        if (progressRatio < 1) {
          animationFrame = requestAnimationFrame(tick);
        }
      };

      commitSnapshot(
        {
          ...nextBaseSnapshot,
          isTransitioning: true,
        },
        target.rootElement,
      );
      animationFrame = requestAnimationFrame(tick);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function resolveSidebarMode({
  requestedMode,
  width,
  inlineBreakpoint,
}: {
  requestedMode: ViewerSidebarRequestedMode;
  width: number | null;
  inlineBreakpoint: number;
}): ViewerSidebarMode {
  if (requestedMode !== "auto") return requestedMode;
  if (width === null) return "overlay";
  return width >= inlineBreakpoint ? "inline" : "overlay";
}

export function resolveMeasuredSidebarMode({
  currentMode,
  hasMeasured,
  inlineBreakpoint,
  requestedMode,
  width,
}: {
  currentMode: ViewerSidebarMode;
  hasMeasured: boolean;
  inlineBreakpoint: number;
  requestedMode: ViewerSidebarRequestedMode;
  width: number;
}): ViewerSidebarMode {
  if (requestedMode !== "auto") return requestedMode;
  if (!hasMeasured) {
    return width >= inlineBreakpoint ? "inline" : "overlay";
  }

  if (currentMode === "inline") {
    return width < inlineBreakpoint - VIEWER_SIDEBAR_MODE_HYSTERESIS
      ? "overlay"
      : "inline";
  }

  return width > inlineBreakpoint + VIEWER_SIDEBAR_MODE_HYSTERESIS
    ? "inline"
    : "overlay";
}

export function isAriaDisabled(value: unknown): boolean {
  return value === true || value === "true";
}

export function pickCssCustomProperties(
  style: React.CSSProperties | undefined,
): React.CSSProperties {
  if (!style) return {};

  return Object.fromEntries(
    Object.entries(style).filter(([name]) => name.startsWith("--")),
  ) as React.CSSProperties;
}

function isViewerStateNamespaceEnabled(
  namespace: ViewerStateAttributeNamespace | undefined,
  slot: ViewerStateAttributeSlot,
): namespace is ViewerStateAttributeNamespace {
  if (!namespace) return false;
  return namespace.slots?.[slot] ?? true;
}

export function createViewerStateAttributes(
  namespace: ViewerStateAttributeNamespace | undefined,
  slot: ViewerStateAttributeSlot,
  values: ViewerStateAttributeValues,
): ViewerDataAttributes {
  if (!isViewerStateNamespaceEnabled(namespace, slot)) return {};

  const attributes: ViewerDataAttributes = {};
  const prefix = namespace.prefix;

  if (values.hasSidebar !== undefined) {
    attributes[`data-${prefix}-has-sidebar`] = values.hasSidebar
      ? "true"
      : "false";
  }
  if (values.sidebarCollapsible !== undefined) {
    attributes[`data-${prefix}-sidebar-collapsible`] =
      values.sidebarCollapsible;
  }
  if (values.sidebarMode !== undefined) {
    attributes[`data-${prefix}-sidebar-mode`] = values.sidebarMode;
  }
  if (values.sidebarOpen !== undefined) {
    attributes[`data-${prefix}-sidebar-open`] = values.sidebarOpen
      ? "true"
      : "false";
  }
  if (values.sidebarSide !== undefined) {
    attributes[`data-${prefix}-sidebar-side`] = values.sidebarSide;
  }
  if (values.sidebarState !== undefined) {
    attributes[`data-${prefix}-sidebar-state`] = values.sidebarState;
  }

  return attributes;
}

export function createViewerSlotAttributes(
  namespace: ViewerStateAttributeNamespace | undefined,
  slot: ViewerStateAttributeSlot,
  value: string | undefined,
): ViewerDataAttributes {
  if (!value || !isViewerStateNamespaceEnabled(namespace, slot)) return {};
  return {
    [`data-${namespace.prefix}-slot`]: value,
  };
}

export function createViewerPortalContainmentAttributes(
  rootId: string,
): ViewerPortalContainmentAttributes {
  return {
    [VIEWER_PORTAL_ROOT_ID_ATTRIBUTE]: rootId,
  };
}

export function readViewerElementSize(element: HTMLElement | null) {
  if (!element) return { height: 0, width: 0 };

  const rect =
    typeof element.getBoundingClientRect === "function"
      ? element.getBoundingClientRect()
      : null;
  return {
    height: rect?.height || element.clientHeight || 0,
    width: rect?.width || element.clientWidth || 0,
  };
}

function readViewerSidebarLayoutWidth({
  sidebarElement,
}: ViewerSidebarLayoutTarget) {
  const elementSize = readViewerElementSize(sidebarElement);
  return Number.isFinite(elementSize.width) && elementSize.width > 0
    ? elementSize.width
    : 0;
}

function writeViewerSidebarProgress(
  rootElement: HTMLElement | null,
  progress: number,
) {
  rootElement?.style.setProperty(
    "--viewer-sidebar-progress",
    String(clampViewerRatio(progress)),
  );
}

function readViewerNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function clampViewerRatio(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function elementContainsTarget(
  element: HTMLElement | null | undefined,
  target: unknown,
): boolean {
  if (!element || target === null || target === undefined) return false;
  if (element === target) return true;

  if (typeof element.contains === "function") {
    try {
      if (element.contains(target as Node)) return true;
    } catch {
      // Some test and embedded DOM hosts do not share a Node prototype chain.
    }
  }

  if (typeof target !== "object") return false;

  let current: unknown = (target as { parentNode?: unknown }).parentNode;
  while (current && typeof current === "object") {
    if (current === element) return true;
    current = (current as { parentNode?: unknown }).parentNode;
  }

  return false;
}

export function targetHasViewerPortalContainment({
  rootId,
  target,
}: {
  rootId: string;
  target: unknown;
}): boolean {
  if (!target || typeof target !== "object") return false;

  if (typeof (target as { closest?: unknown }).closest === "function") {
    try {
      const ownerElement = (
        target as {
          closest: (selector: string) => {
            getAttribute?: (attributeName: string) => string | null;
          } | null;
        }
      ).closest(`[${VIEWER_PORTAL_ROOT_ID_ATTRIBUTE}]`);

      if (
        ownerElement?.getAttribute?.(VIEWER_PORTAL_ROOT_ID_ATTRIBUTE) === rootId
      ) {
        return true;
      }
    } catch {
      // Some test and embedded DOM hosts do not support Element.closest.
    }
  }

  let current: unknown = target;
  while (current && typeof current === "object") {
    const getAttribute = (current as { getAttribute?: unknown }).getAttribute;
    if (
      typeof getAttribute === "function" &&
      getAttribute.call(current, VIEWER_PORTAL_ROOT_ID_ATTRIBUTE) === rootId
    ) {
      return true;
    }
    current = (current as { parentNode?: unknown }).parentNode;
  }

  return false;
}

export function targetViewerRootId(target: unknown): string | null {
  if (!target || typeof target !== "object") return null;

  if (typeof (target as { closest?: unknown }).closest === "function") {
    try {
      const rootElement = (
        target as {
          closest: (selector: string) => {
            getAttribute?: (attributeName: string) => string | null;
          } | null;
        }
      ).closest(`[${VIEWER_ROOT_ID_ATTRIBUTE}]`);
      const rootId = rootElement?.getAttribute?.(VIEWER_ROOT_ID_ATTRIBUTE);
      if (rootId) return rootId;
    } catch {
      // Some test and embedded DOM hosts do not support Element.closest.
    }
  }

  let current: unknown = target;
  while (current && typeof current === "object") {
    const getAttribute = (current as { getAttribute?: unknown }).getAttribute;
    if (typeof getAttribute === "function") {
      const rootId = getAttribute.call(current, VIEWER_ROOT_ID_ATTRIBUTE);
      if (typeof rootId === "string" && rootId) {
        return rootId;
      }
    }
    current = (current as { parentNode?: unknown }).parentNode;
  }

  return null;
}

export function findClosestViewerBody(
  element: HTMLDivElement | null,
): HTMLElement | null {
  if (!element || typeof element.closest !== "function") return null;
  return element.closest<HTMLElement>('[data-viewer-slot="body"]');
}

export function useViewerDevelopmentLayoutWarning({
  enabled = true,
  elements,
  inspect,
  keyParts,
}: {
  enabled?: boolean;
  elements: () => Array<HTMLElement | null>;
  inspect: () => void;
  keyParts: unknown[];
}) {
  useKeyedLayoutEffect(enabled ? joinEffectKey(keyParts) : null, () => {
    if (process.env.NODE_ENV === "production" || !enabled) return;

    const observedElements = elements().filter(
      (element): element is HTMLElement => Boolean(element),
    );

    let frame: number | null = null;
    const run = () => {
      frame = null;
      inspect();
    };
    const schedule = () => {
      if (frame !== null) return;

      if (typeof requestAnimationFrame === "function") {
        frame = requestAnimationFrame(run);
        return;
      }

      run();
    };

    schedule();

    const ResizeObserverConstructor = globalThis.ResizeObserver;
    if (
      observedElements.length === 0 ||
      typeof ResizeObserverConstructor === "undefined"
    ) {
      return () => {
        if (frame !== null && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(frame);
        }
      };
    }

    const observer = new ResizeObserverConstructor(schedule);
    for (const element of observedElements) {
      observer.observe(element);
    }

    return () => {
      if (frame !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frame);
      }
      observer.disconnect();
    };
  });
}

export function useViewerSidebarRegistrationContext(
  consumer: string,
): ViewerSidebarRegistrationState {
  const context = useOptionalViewerSidebarRegistration();
  if (!context) {
    throw new Error(`${consumer} must be used within a ViewerRoot.`);
  }
  return context;
}
