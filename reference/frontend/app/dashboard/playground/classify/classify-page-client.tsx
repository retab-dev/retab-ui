"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const ClassifyPageContent = dynamic(
  () =>
    import("@/app/dashboard/playground/classify/classify-page-content").then(
      (module) => module.ClassifyPageContent,
    ),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  },
);

export function ClassifyPageClient() {
  return <ClassifyPageContent />;
}
