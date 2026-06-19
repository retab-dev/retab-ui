"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";
import { createPortal } from "react-dom";

type JsonTableStyleProbeSurface =
  | "empty-portal"
  | "select-shell"
  | "picker-shell";

export function JsonTableStyleProbe() {
  const [surface, setSurface] =
    React.useState<JsonTableStyleProbeSurface | null>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (!surface) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSurface(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [surface]);

  return (
    <div
      aria-label="JSON table style probes"
      className="flex flex-wrap gap-2"
      data-slot="json-table-style-probe"
    >
      <ProbeButton
        label="Empty portal"
        name="empty-portal"
        setSurface={setSurface}
      />
      <ProbeButton
        label="Select shell"
        name="select-shell"
        setSurface={setSurface}
      />
      <ProbeButton
        label="Picker shell"
        name="picker-shell"
        setSurface={setSurface}
      />
      {isMounted && surface
        ? createPortal(<StyleProbePortal surface={surface} />, document.body)
        : null}
    </div>
  );
}

function ProbeButton({
  label,
  name,
  setSurface,
}: {
  label: string;
  name: JsonTableStyleProbeSurface;
  setSurface: (surface: JsonTableStyleProbeSurface) => void;
}) {
  return (
    <button
      className="h-7 border px-2 text-xs"
      data-json-table-style-probe={name}
      type="button"
      onClick={() => setSurface(name)}
    >
      {label}
    </button>
  );
}

function StyleProbePortal({
  surface,
}: {
  surface: JsonTableStyleProbeSurface;
}) {
  if (surface === "select-shell") {
    return (
      <div
        aria-label="Style probe select shell"
        className="bg-popover text-popover-foreground fixed top-4 left-4 z-50 min-h-10 w-48 border p-2 text-xs shadow-md"
        data-json-table-style-probe-surface={surface}
        data-slot="data-cell-select-popup"
        role="listbox"
      />
    );
  }

  if (surface === "picker-shell") {
    return (
      <div
        aria-label="Style probe picker shell"
        className="bg-popover text-popover-foreground fixed top-4 left-4 z-50 min-h-10 w-64 border p-2 text-xs shadow-md"
        data-json-table-style-probe-surface={surface}
        data-slot="data-cell-picker-popup"
        role="dialog"
      />
    );
  }

  return (
    <div
      aria-label="Style probe empty portal"
      className="bg-popover text-popover-foreground fixed top-4 left-4 z-50 min-h-10 w-48 border p-2 text-xs shadow-md"
      data-json-table-style-probe-surface={surface}
      data-slot="json-table-inert-popup"
    />
  );
}
