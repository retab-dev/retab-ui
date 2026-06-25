"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";

import {
  getPdfThumbnailLayoutItem,
  normalizeThumbnailPage,
  type PdfThumbnailLayout,
} from "./pdf-thumbnail-layout";
import { joinEffectKey } from "@/lib/effect-key";

export const THUMBNAIL_FOLLOW_MARGIN = 24;
export const THUMBNAIL_PROGRAMMATIC_SCROLL_WINDOW_MS = 120;

type ThumbnailFollowSuspension = "none" | "pointer" | "user-scroll";

interface ThumbnailFollowState {
  suspension: ThumbnailFollowSuspension;
  currentPage: number | null;
  lastProgrammaticScrollAt: number;
}

export function useThumbnailRailFollow({
  currentPage,
  layout,
  viewportRef,
  resetKey,
}: {
  currentPage: number | null | undefined;
  layout: PdfThumbnailLayout;
  viewportRef: React.RefObject<HTMLElement | null>;
  resetKey: unknown;
}) {
  const stateRef = React.useRef<ThumbnailFollowState>({
    suspension: "none",
    currentPage: null,
    lastProgrammaticScrollAt: 0,
  });

  const scrollPageIntoView = React.useCallback(
    (page: number) => {
      const normalizedPage = normalizeThumbnailPage(page, layout.pageCount);
      if (normalizedPage == null) return;

      const viewport = viewportRef.current;
      if (!viewport) return;

      const item = getPdfThumbnailLayoutItem(layout, normalizedPage);
      if (!item) return;

      const top = item.top - viewport.scrollTop;
      const bottom = top + item.height;
      const minTop = THUMBNAIL_FOLLOW_MARGIN;
      const maxBottom = viewport.clientHeight - THUMBNAIL_FOLLOW_MARGIN;
      const isAtDocumentStart =
        item.top <= THUMBNAIL_FOLLOW_MARGIN &&
        viewport.scrollTop <= THUMBNAIL_FOLLOW_MARGIN;

      if ((top >= minTop || isAtDocumentStart) && bottom <= maxBottom) return;

      const maxScrollTop = Math.max(
        0,
        layout.totalHeight - viewport.clientHeight,
      );
      const targetTop = Math.min(
        maxScrollTop,
        Math.max(0, item.top - viewport.clientHeight / 2 + item.height / 2),
      );

      stateRef.current.lastProgrammaticScrollAt = performance.now();
      viewport.scrollTo?.({ top: targetTop, behavior: "smooth" });
    },
    [layout, viewportRef],
  );

  const followNow = React.useCallback(() => {
    const page = normalizeThumbnailPage(currentPage, layout.pageCount);
    if (page == null) return;

    const state = stateRef.current;
    if (state.suspension !== "none") return;

    scrollPageIntoView(page);
  }, [currentPage, layout.pageCount, scrollPageIntoView]);

  useKeyedMountEffect(joinEffectKey(["thumbnail-reset", resetKey]), () => {
    const state = stateRef.current;
    state.suspension = "none";
    state.currentPage = null;
    state.lastProgrammaticScrollAt = 0;
  });

  useKeyedMountEffect(
    joinEffectKey(["thumbnail-follow", followNow, resetKey]),
    () => {
      const page = normalizeThumbnailPage(currentPage, layout.pageCount);
      const state = stateRef.current;
      const pageChanged = state.currentPage !== page;

      state.currentPage = page;
      if (state.suspension === "user-scroll" && pageChanged) {
        state.suspension = "none";
      }

      followNow();
    },
  );

  const onPointerEnter = React.useCallback(() => {
    if (stateRef.current.suspension === "user-scroll") return;
    stateRef.current.suspension = "pointer";
  }, []);

  const onPointerLeave = React.useCallback(() => {
    if (stateRef.current.suspension !== "pointer") return;
    stateRef.current.suspension = "none";
    followNow();
  }, [followNow]);

  const onPageActivate = React.useCallback(
    (pageNumber: number) => {
      stateRef.current.suspension = "none";
      scrollPageIntoView(pageNumber);
    },
    [scrollPageIntoView],
  );

  const onScroll = React.useCallback(() => {
    const state = stateRef.current;
    const elapsed = performance.now() - state.lastProgrammaticScrollAt;
    if (elapsed < THUMBNAIL_PROGRAMMATIC_SCROLL_WINDOW_MS) return;

    state.suspension = "user-scroll";
  }, []);

  return {
    onPageActivate,
    onPointerEnter,
    onPointerLeave,
    onScroll,
  };
}
