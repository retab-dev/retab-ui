import { type Metadata } from "next";

import { VercelHomepage } from "./_components/vercel-homepage";

const title = "Agentic Infrastructure";
const description =
  "A Vercel-inspired homepage reproduction built from explicit marketing primitives.";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
};

export default function HomepagePage() {
  return <VercelHomepage />;
}
