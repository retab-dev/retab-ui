"use client";

import * as React from "react";

import { useMountEffect } from "@/hooks/use-mount-effect";

type SourceLinkFocusModality = "none" | "keyboard" | "pointer";
type SourceLinkFocusIntentState = {
  modality: SourceLinkFocusModality;
};

const sourceLinkFocusIntentByDocument = new WeakMap<
  Document,
  SourceLinkFocusIntentState
>();

function isKeyboardFocusNavigation(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return false;
  }
  return (
    event.key === "Tab" ||
    event.key === "ArrowDown" ||
    event.key === "ArrowLeft" ||
    event.key === "ArrowRight" ||
    event.key === "ArrowUp" ||
    event.key === "End" ||
    event.key === "Home" ||
    event.key === "PageDown" ||
    event.key === "PageUp"
  );
}

function getSourceLinkFocusIntentState(
  ownerDocument: Document,
): SourceLinkFocusIntentState {
  const existingState = sourceLinkFocusIntentByDocument.get(ownerDocument);
  if (existingState) return existingState;

  const state: SourceLinkFocusIntentState = { modality: "none" };
  sourceLinkFocusIntentByDocument.set(ownerDocument, state);

  ownerDocument.addEventListener(
    "keydown",
    (event) => {
      if (isKeyboardFocusNavigation(event)) state.modality = "keyboard";
    },
    true,
  );
  ownerDocument.addEventListener(
    "pointerdown",
    () => {
      state.modality = "pointer";
    },
    true,
  );
  ownerDocument.addEventListener(
    "mousedown",
    () => {
      state.modality = "pointer";
    },
    true,
  );
  ownerDocument.addEventListener(
    "touchstart",
    () => {
      state.modality = "pointer";
    },
    true,
  );

  return state;
}

export function useSourceLinkFocusPreviewIntent() {
  useMountEffect(() => {
    getSourceLinkFocusIntentState(document).modality = "none";
  });

  return React.useCallback((event: React.FocusEvent<HTMLElement>): boolean => {
    if (event.defaultPrevented) return false;
    return (
      getSourceLinkFocusIntentState(event.currentTarget.ownerDocument)
        .modality === "keyboard"
    );
  }, []);
}
