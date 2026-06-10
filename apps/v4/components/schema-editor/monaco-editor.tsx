"use client";

import * as React from "react";

import { useMountEffect } from "@/components/schema-editor/lib/use-mount-effect";

import type { EditorProps } from "@monaco-editor/react";

export type { BeforeMount, EditorProps, OnMount } from "@monaco-editor/react";

const MonacoEditor = React.lazy(async () => {
  const importedModule = await import("@monaco-editor/react");
  return { default: importedModule.Editor };
});

function DefaultFallback() {
  return (
    <div className="h-full min-h-[120px] w-full animate-pulse rounded-md bg-muted" />
  );
}

export function Editor({ loading, ...props }: EditorProps) {
  const [isMounted, setIsMounted] = React.useState(false);

  useMountEffect(() => {
    setIsMounted(true);
  });

  const fallback = loading ?? <DefaultFallback />;

  if (!isMounted) {
    return <>{fallback}</>;
  }

  return (
    <React.Suspense fallback={fallback}>
      <MonacoEditor {...props} />
    </React.Suspense>
  );
}
