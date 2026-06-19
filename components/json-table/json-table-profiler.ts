"use client";

import type * as React from "react";

type ProfileValue = boolean | number | string | null | undefined;
type ProfileSnapshot = Record<string, ProfileValue>;

export interface JsonTableProfileEvent {
  at: number;
  type: "mark" | "render" | "react-commit";
  name: string;
  id?: string;
  detail?: Record<string, unknown>;
  changedProps?: string[];
}

export interface JsonTableRenderSummary {
  total: number;
  byComponent: Record<string, number>;
  byInstance: Record<string, number>;
  changedProps: Record<string, number>;
}

export interface JsonTableProfilerState {
  enabled: boolean;
  events: JsonTableProfileEvent[];
  renders: JsonTableRenderSummary;
  snapshots: Record<string, ProfileSnapshot>;
}

declare global {
  interface Window {
    __jsonTableProfiler?: JsonTableProfilerState;
  }
}

function profilerState(): JsonTableProfilerState | null {
  if (typeof window === "undefined") return null;
  const profiler = window.__jsonTableProfiler;
  return profiler?.enabled ? profiler : null;
}

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export function markJsonTableProfile(
  name: string,
  detail?: Record<string, unknown>,
) {
  const profiler = profilerState();
  if (!profiler) return;

  const markName = `json-table:${name}`;
  try {
    performance.mark(markName, detail ? { detail } : undefined);
  } catch {
    try {
      performance.mark(markName);
    } catch {}
  }

  profiler.events.push({
    at: now(),
    type: "mark",
    name,
    detail,
  });
}

export function recordJsonTableRender(
  component: string,
  id: string,
  snapshot: ProfileSnapshot = {},
) {
  const profiler = profilerState();
  if (!profiler) return;

  const instanceKey = `${component}:${id}`;
  const previous = profiler.snapshots[instanceKey];
  const changedProps = previous
    ? changedSnapshotKeys(previous, snapshot)
    : ["mount"];
  profiler.snapshots[instanceKey] = snapshot;

  profiler.renders.total += 1;
  profiler.renders.byComponent[component] =
    (profiler.renders.byComponent[component] ?? 0) + 1;
  profiler.renders.byInstance[instanceKey] =
    (profiler.renders.byInstance[instanceKey] ?? 0) + 1;

  for (const prop of changedProps) {
    const key = `${component}.${prop}`;
    profiler.renders.changedProps[key] =
      (profiler.renders.changedProps[key] ?? 0) + 1;
  }

  profiler.events.push({
    at: now(),
    type: "render",
    name: component,
    id,
    changedProps,
  });
}

export const recordJsonTableReactCommit: React.ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  const profiler = profilerState();
  if (!profiler) return;

  profiler.events.push({
    at: now(),
    type: "react-commit",
    name: id,
    detail: {
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
    },
  });
};

function changedSnapshotKeys(previous: ProfileSnapshot, next: ProfileSnapshot) {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (!Object.is(previous[key], next[key])) changed.push(key);
  }
  return changed.length ? changed : ["same-props"];
}
