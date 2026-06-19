import * as React from "react";

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import type { SchemaEditorMode } from "@/components/schema-editor/schema-editor-mode";

export type TopLevelEditorProps = {
  node: ExtendedJSONSchema7;
  mode: SchemaEditorMode;
  showImportExportActions?: boolean;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onEraseAll: () => void;
  onEraseDescriptions: () => void;
  onReplaceRoot: (node: ExtendedJSONSchema7) => void;
};

export type TopLevelConfirmAction = "eraseAll" | "eraseDescriptions";

export function buildTopLevelMetadataValues(node: ExtendedJSONSchema7) {
  return {
    title: node.title || "",
    description: node.description || "",
  };
}

export function useTopLevelEditorController({
  node,
  onTitleChange,
  onDescriptionChange,
  onEraseAll,
  onEraseDescriptions,
}: Pick<
  TopLevelEditorProps,
  | "node"
  | "onTitleChange"
  | "onDescriptionChange"
  | "onEraseAll"
  | "onEraseDescriptions"
>) {
  const [metadataDialogOpen, setMetadataDialogOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] =
    React.useState<TopLevelConfirmAction | null>(null);
  const [metadataValues, setMetadataValues] = React.useState(() =>
    buildTopLevelMetadataValues(node),
  );
  const [draftTitle, setDraftTitle] = React.useState(node.title || "");
  const [isTitleDirty, setIsTitleDirty] = React.useState(false);
  const [draftDescription, setDraftDescription] = React.useState(
    node.description || "",
  );
  const [isDescriptionDirty, setIsDescriptionDirty] = React.useState(false);
  const [dialogPropertyName, setDialogPropertyName] = React.useState(
    node.title || "",
  );

  const currentTitle = isTitleDirty ? draftTitle : node.title || "";
  const currentDescription = isDescriptionDirty
    ? draftDescription
    : node.description || "";

  const commitTitle = React.useCallback(() => {
    if (currentTitle !== (node.title || "")) {
      onTitleChange(currentTitle || "");
    }
    setIsTitleDirty(false);
    setDraftTitle(node.title || "");
  }, [currentTitle, node.title, onTitleChange]);

  const commitDescription = React.useCallback(() => {
    if (currentDescription !== (node.description || "")) {
      onDescriptionChange(currentDescription);
    }
    setIsDescriptionDirty(false);
    setDraftDescription(node.description || "");
  }, [currentDescription, node.description, onDescriptionChange]);

  const openMetadataDialog = React.useCallback(() => {
    setMetadataValues(buildTopLevelMetadataValues(node));
    setDialogPropertyName(node.title || "");
    setMetadataDialogOpen(true);
  }, [node]);

  const confirmDestructiveAction = React.useCallback(() => {
    if (confirmAction === "eraseAll") onEraseAll();
    if (confirmAction === "eraseDescriptions") onEraseDescriptions();
    setConfirmAction(null);
  }, [confirmAction, onEraseAll, onEraseDescriptions]);

  return {
    metadataDialogOpen,
    setMetadataDialogOpen,
    confirmAction,
    setConfirmAction,
    metadataValues,
    setMetadataValues,
    draftTitle,
    setDraftTitle,
    setIsTitleDirty,
    draftDescription,
    setDraftDescription,
    setIsDescriptionDirty,
    dialogPropertyName,
    setDialogPropertyName,
    currentTitle,
    currentDescription,
    commitTitle,
    commitDescription,
    openMetadataDialog,
    confirmDestructiveAction,
  };
}
