import { type Metadata } from "next";

import { VercelHomepage } from "./_components/vercel-homepage";

const title = "End-to-end automation for your hardest document workflows.";
const description =
  "Retab turns PDFs, emails, images, and spreadsheets into reliable document automation workflows with schemas, citations, confidence, and human review.";

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
