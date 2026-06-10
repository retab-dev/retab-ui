"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const SplitPageContent = dynamic(
  () =>
    import("@/app/dashboard/playground/split/split-page-content").then(
      (module) => module.SplitPageContent,
    ),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  },
);

export function SplitPageClient() {
  return <SplitPageContent />;
}
