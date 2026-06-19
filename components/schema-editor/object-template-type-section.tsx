"use client";

import * as React from "react";

import type { SchemaTypeMenuTrailingContent } from "@/components/schema-editor/primitives/schema-type-menu";

const LazyObjectTemplateSubmenu = React.lazy(() =>
  import(
    "@/components/schema-editor/optional/object-templates/object-template-menu"
  ).then((module) => ({
    default: module.ObjectTemplateSubmenu,
  })),
);

export function createObjectTemplateTypeTrailingContent({
  onSelectTemplate,
}: {
  onSelectTemplate: (templateName: string) => void;
}): SchemaTypeMenuTrailingContent {
  function ObjectTemplateTypeTrailingContent({
    editable,
  }: {
    editable: boolean;
  }) {
    return (
      <React.Suspense fallback={null}>
        <LazyObjectTemplateSubmenu
          onSelectTemplate={(templateName) => {
            if (!editable) return;
            onSelectTemplate(templateName);
          }}
        />
      </React.Suspense>
    );
  }

  ObjectTemplateTypeTrailingContent.displayName =
    "ObjectTemplateTypeTrailingContent";
  return ObjectTemplateTypeTrailingContent;
}
