"use client";

import { useMountEffect } from "@/hooks/useMountEffect";

/**
 * Runs `effect` exactly once per mount. Parent supplies a `key` that changes
 * when the effect should re-run, so React remounts this component and fires
 * the mount effect with fresh closure values.
 *
 * Rule 4 + Rule 5 combined - the escape hatch for reactive post-commit side
 * effects without writing `useEffect` or `useLayoutEffect` directly.
 *
 * Usage:
 *   <KeyedRunner
 *     key={`fetch:${userId}`}
 *     effect={() => {
 *       const ctrl = new AbortController()
 *       void fetchProfile(userId, ctrl.signal).then(setProfile)
 *       return () => ctrl.abort()
 *     }}
 *   />
 */
export function KeyedRunner({ effect }: { effect: () => void | (() => void) }) {
  useMountEffect(effect);
  return null;
}
