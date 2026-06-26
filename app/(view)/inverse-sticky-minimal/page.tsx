import type { Metadata } from "next";

import { MinimalInverseSticky } from "./minimal-inverse-sticky";

export const metadata: Metadata = {
  title: "Minimal Inverse Sticky",
  description: "A minimal native-scroll inverse sticky illustration.",
};

export default function MinimalInverseStickyPage() {
  return <MinimalInverseSticky />;
}
