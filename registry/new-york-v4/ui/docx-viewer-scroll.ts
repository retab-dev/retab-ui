import * as React from "react";

import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useMountEffect } from "@/hooks/use-mount-effect";

import { clamp } from "./docx-viewer-core";
import {
  captureDocxReadingAnchorFromLayout,
  findDocxPageByMarker,
  restoreDocxReadingAnchorFromLayout,
  type DocxPageLayout,
  type DocxReadingAnchor,
} from "./docx-viewer-layout";
import { joinEffectKey } from "@/lib/effect-key";

export function useDocxViewerScroll({
  layoutKey,
  pageLayout,
  onScrollProgressChange,
  onVisiblePageChange,
  ready,
  scale,
}: {
  layoutKey: unknown;
  pageLayout: DocxPageLayout | null;
  onScrollProgressChange?: (progress: number) => void;
  onVisiblePageChange?: (page: number) => void;
  ready: boolean;
  scale: number;
}) {
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null);
  const lastReported = React.useRef(0);
  const latestAnchorRef = React.useRef<DocxReadingAnchor>({ kind: "top" });
  const committedLayoutKeyRef = React.useRef(layoutKey);
  const [currentPage, setCurrentPage] = React.useState(1);
  const scrollFrame = React.useRef(0);

  const resetScroll = React.useCallback(() => {
    setCurrentPage(1);
    lastReported.current = 0;
    latestAnchorRef.current = { kind: "top" };
    if (scrollViewportRef.current) scrollViewportRef.current.scrollTop = 0;
  }, []);

  const measureScroll = React.useCallback(() => {
    scrollFrame.current = 0;
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    const scrollable = viewport.scrollHeight - viewport.clientHeight;
    onScrollProgressChange?.(
      scrollable > 0 ? clamp(viewport.scrollTop / scrollable, 0, 1) : 0,
    );
    const current =
      findDocxPageByMarker({
        layout: pageLayout,
        scale,
        scrollTop: viewport.scrollTop,
        viewportHeight: viewport.clientHeight,
      })?.pageNumber ?? 1;
    latestAnchorRef.current = captureDocxReadingAnchorFromLayout({
      layout: pageLayout,
      scale,
      scrollTop: viewport.scrollTop,
      viewportHeight: viewport.clientHeight,
    });
    if (current && current !== lastReported.current) {
      lastReported.current = current;
      setCurrentPage(current);
      onVisiblePageChange?.(current);
    }
  }, [onScrollProgressChange, onVisiblePageChange, pageLayout, scale]);

  const handleScroll = React.useCallback(() => {
    if (scrollFrame.current) return;
    scrollFrame.current = -1;
    const requestedFrame = requestAnimationFrame(measureScroll);
    if (scrollFrame.current === -1) scrollFrame.current = requestedFrame;
  }, [measureScroll]);

  useKeyedMountEffect(
    joinEffectKey(["docx-measure", measureScroll, ready]),
    () => {
      if (ready) measureScroll();
    },
  );

  useKeyedLayoutEffect(
    joinEffectKey([
      "docx-layout",
      layoutKey,
      measureScroll,
      pageLayout,
      ready,
      scale,
    ]),
    () => {
      const previousLayoutKey = committedLayoutKeyRef.current;
      committedLayoutKeyRef.current = layoutKey;
      if (!ready) return;
      if (Object.is(previousLayoutKey, layoutKey)) return;

      const viewport = scrollViewportRef.current;
      if (!viewport) return;

      const maxScrollTop = Math.max(
        0,
        viewport.scrollHeight - viewport.clientHeight,
      );
      const restored = restoreDocxReadingAnchorFromLayout({
        anchor: latestAnchorRef.current,
        layout: pageLayout,
        maxScrollTop,
        scale,
        viewportHeight: viewport.clientHeight,
      });
      if (restored != null) viewport.scrollTop = restored;
      measureScroll();
    },
  );

  useMountEffect(() => {
    return () => {
      if (scrollFrame.current > 0) cancelAnimationFrame(scrollFrame.current);
    };
  });

  return {
    currentPage,
    handleScroll,
    measureScroll,
    resetScroll,
    scrollViewportRef,
  };
}
