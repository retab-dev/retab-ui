"use client";

import * as React from "react";

import { useMountEffect } from "@/hooks/use-mount-effect";

export type ArrayTableScrollHandlers = {
  onScrollStart: () => void;
  onScrollMove: () => void;
  onScrollEnd: () => void;
};

export function useArrayTableScrollActivity(
  scrollRef: React.RefObject<HTMLElement | null>,
  { onScrollStart, onScrollMove, onScrollEnd }: ArrayTableScrollHandlers,
) {
  const isScrollingRef = React.useRef(false);
  const scrollEndTimeoutRef = React.useRef(0);
  const callbacksRef = React.useRef({
    onScrollStart,
    onScrollMove,
    onScrollEnd,
  });
  callbacksRef.current = { onScrollStart, onScrollMove, onScrollEnd };

  const handleScroll = React.useCallback(() => {
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      callbacksRef.current.onScrollStart();
    }
    callbacksRef.current.onScrollMove();
    window.clearTimeout(scrollEndTimeoutRef.current);
    scrollEndTimeoutRef.current = window.setTimeout(() => {
      isScrollingRef.current = false;
      callbacksRef.current.onScrollEnd();
    }, 120);
  }, []);

  useMountEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.clearTimeout(scrollEndTimeoutRef.current);
      scrollElement.removeEventListener("scroll", handleScroll);
    };
  });
}
