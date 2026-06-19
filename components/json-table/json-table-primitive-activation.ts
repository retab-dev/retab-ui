import type * as React from "react";

import type { JsonTableActivationIntent } from "@/components/json-table/json-table-edit-session";

export function structuredPointerActivationIntent(
  event: React.PointerEvent<HTMLElement>,
): JsonTableActivationIntent {
  return {
    type: "pointer",
    clientX: event.clientX,
    clientY: event.clientY,
    detail: event.detail,
  };
}

function isAltGraphKey(event: React.KeyboardEvent<HTMLElement>): boolean {
  return (
    event.getModifierState("AltGraph") ||
    event.nativeEvent.getModifierState?.("AltGraph") ||
    (event.ctrlKey &&
      event.altKey &&
      event.key.length === 1 &&
      !/^[\x00-\x7F]$/.test(event.key))
  );
}

function isPlatformOrComposingKey(event: React.KeyboardEvent<HTMLElement>) {
  const isAltGraph = isAltGraphKey(event);
  return (
    event.defaultPrevented ||
    event.metaKey ||
    (event.ctrlKey && !isAltGraph) ||
    (event.altKey && !isAltGraph) ||
    event.nativeEvent.isComposing
  );
}

export function canActivateStructuredFromShellKey(
  event: React.KeyboardEvent<HTMLElement>,
) {
  return (
    !isPlatformOrComposingKey(event) &&
    (event.key === "Enter" || event.key === "F2" || event.key === " ")
  );
}

export function structuredKeyboardActivationIntent(
  event: React.KeyboardEvent<HTMLElement>,
): JsonTableActivationIntent {
  return {
    type: "keyboard",
    key: event.key,
  };
}
