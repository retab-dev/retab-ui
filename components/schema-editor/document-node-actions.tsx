"use client";

import { SchemaRowActions } from "@/components/schema-editor/primitives/schema-row-actions";

interface DocumentNodeActionsProps {
  canDelete: boolean;
  mode: "descriptionOnly" | "readOnly" | "editable";
  editable: boolean;
  hidePencilButton: boolean;
  onDelete?: () => void;
  onOpenMetadata: () => void;
}

export function DocumentNodeActions(props: DocumentNodeActionsProps) {
  const details =
    props.hidePencilButton || !props.onOpenMetadata
      ? undefined
      : props.mode === "readOnly"
        ? {
            label: "View field properties",
            mode: "view" as const,
            onOpen: props.onOpenMetadata,
          }
        : {
            label: "Edit field properties",
            mode: "edit" as const,
            onOpen: props.onOpenMetadata,
          };

  return (
    <SchemaRowActions
      canDelete={props.canDelete}
      editable={props.editable}
      details={details}
      onDelete={props.onDelete}
    />
  );
}
