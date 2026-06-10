"use client";

import { useMountEffect } from "@/components/schema-editor/lib/use-mount-effect";

export function ResetOnMountRunner({ onReset }: { onReset: () => void }) {
  useMountEffect(() => {
    onReset();
  });

  return null;
}
