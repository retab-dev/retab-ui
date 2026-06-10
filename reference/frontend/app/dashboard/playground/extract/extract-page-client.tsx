"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const ExtractPageContent = dynamic(
  () =>
    import("@/app/dashboard/playground/extract/extract-page-content").then(
      (module) => module.ExtractPageContent,
    ),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  },
);

export function ExtractPageClient() {
  return <ExtractPageContent />;
}
