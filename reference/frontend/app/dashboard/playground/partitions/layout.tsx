import React from "react";
import { JsonSchemaEditorProvider } from "@/app/dashboard/shared/schema-editor/contexts/json-schema";
import { FileProvider } from "@/app/shared/contexts/file";

export default function PartitionPlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FileProvider>
      <JsonSchemaEditorProvider>{children}</JsonSchemaEditorProvider>
    </FileProvider>
  );
}
