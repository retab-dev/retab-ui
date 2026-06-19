import * as React from "react";

import { useMountEffect } from "@/hooks/use-mount-effect";

export function useMounted() {
  const [mounted, setMounted] = React.useState(false);

  useMountEffect(() => {
    setMounted(true);
  });

  return mounted;
}
