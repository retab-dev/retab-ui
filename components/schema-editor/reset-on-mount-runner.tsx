"use client";

import { useMountEffect } from "@/hooks/use-mount-effect";

export function ResetOnMountRunner({ onReset }: { onReset: () => void }) {
  useMountEffect(() => {
    onReset();
  });

  return null;
}
