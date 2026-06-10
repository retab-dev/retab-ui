"use client";

// Minimal stand-in for the dashboard's UiForm (purify later). The full UiForm
// is a heavy extraction-display component; the table view's object-editor only
// needs these three exports to compile.
import * as React from "react";

export type scalarValueType = "similarity" | "consensus" | "mismatch" | "none";

export function UiForm({
  children,
}: { children?: React.ReactNode } & Record<string, unknown>): React.ReactElement {
  return <div data-slot="uiform">{children}</div>;
}

export function UiFormContent(
  props: { children?: React.ReactNode } & Record<string, unknown>,
): React.ReactElement {
  return <div data-slot="uiform-content">{props.children}</div>;
}
