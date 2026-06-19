"use client";

import * as React from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

export function useIsClient(): boolean {
  const [isClient, setIsClient] = React.useState(false);

  useMountEffect(() => {
    setIsClient(true);
  });

  return isClient;
}
