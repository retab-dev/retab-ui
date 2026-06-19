"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

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

  React.useLayoutEffect(() => {
    callbacksRef.current = { onScrollStart, onScrollMove, onScrollEnd };
  }, [onScrollEnd, onScrollMove, onScrollStart]);

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

  React.useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.clearTimeout(scrollEndTimeoutRef.current);
      scrollElement.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll, scrollRef]);
}
