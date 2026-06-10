"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const EditPageContent = dynamic(
  () =>
    import("@/app/dashboard/playground/edit/edit-page-content").then(
      (module) => module.EditPageContent,
    ),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  },
);

export function EditPageClient() {
  return <EditPageContent />;
}
