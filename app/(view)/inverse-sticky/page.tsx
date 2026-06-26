import type { Metadata } from "next";

import { InverseStickyIllustration } from "./inverse-sticky-illustration";

const title = "Inverse Sticky Technique";
const description =
  "A native-scroll illustration of the inverse sticky virtualization technique.";

export const metadata: Metadata = {
  title,
  description,
};

export default function InverseStickyPage() {
  return <InverseStickyIllustration />;
}
