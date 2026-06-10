"use client";

import dynamic from "next/dynamic";

import type { TemplateEditorProps } from "./template-editor";

const TemplateEditorInner = dynamic(
  () =>
    import("./template-editor").then(
      (importedModule) => importedModule.TemplateEditor,
    ),
  {
    loading: () => (
      <div className="flex min-h-[420px] w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500">
        Loading template editor...
      </div>
    ),
  },
);

export function TemplateEditor(props: TemplateEditorProps) {
  return <TemplateEditorInner {...props} />;
}
