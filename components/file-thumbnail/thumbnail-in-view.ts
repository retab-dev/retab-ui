"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

export function useThumbnailInView() {
  const [seen, setSeen] = React.useState(false);
  const [node, setNode] = React.useState<HTMLElement | null>(null);
  const seenRef = React.useRef(false);
  const ref = React.useCallback((el: HTMLElement | null) => setNode(el), []);

  React.useEffect(() => {
    if (!node || seenRef.current) return;
    if (typeof IntersectionObserver === "undefined") {
      seenRef.current = true;
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          seenRef.current = true;
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref, seen };
}
