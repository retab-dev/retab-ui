import type { Metadata } from "next";

import { JsonFormRetabDemo } from "@/components/json-form-retab-demo";

export const metadata: Metadata = {
  title: "JSON Form (retab) — reasoning, consensus, confidence",
  description:
    "JsonFormRetab rendering a consensus extraction with per-field reasoning and confidence.",
};

export default function JsonFormRetabPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-3xl">
        <JsonFormRetabDemo />
      </div>
    </div>
  );
}
