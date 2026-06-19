"use client";

import { validateName } from "@/components/schema-editor/lib/json-schema-utils";
import { SchemaInlineName } from "@/components/schema-editor/primitives/schema-inline-name";

interface DocumentNodeNameControlProps {
  editable: boolean;
  name: string;
  siblingNames: string[];
  canRename: boolean;
  isReference: boolean;
  refName?: string;
  onNameChange?: (newName: string) => void;
  onShowDefinition: (definitionName: string) => void;
}

export function DocumentNodeNameControl({
  editable,
  name,
  siblingNames,
  canRename,
  isReference,
  refName,
  onNameChange,
  onShowDefinition,
}: DocumentNodeNameControlProps) {
  return (
    <SchemaInlineName
      ariaLabel={`Field name ${name}`}
      value={name}
      editable={editable}
      canRename={canRename}
      validate={(value) => validateName(value, siblingNames, name, "property")}
      reference={
        isReference && refName
          ? {
              label: refName,
              onReveal: () => onShowDefinition(refName),
            }
          : undefined
      }
      onCommit={onNameChange}
    />
  );
}
