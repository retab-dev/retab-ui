"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import { getEffectiveType } from "@/components/schema-editor/draft/draft-node-edits";
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { createPropertyTypeFieldWithObjectTemplates } from "@/components/schema-editor/property-form/fields/property-object-template-type-field";
import { resolvePropertyCapabilities } from "@/components/schema-editor/property-form/model/property-capabilities";
import { createPropertySchemaPlan } from "@/components/schema-editor/property-form/model/property-schema-plan";
import { normalizeValidationForCapabilities } from "@/components/schema-editor/property-form/model/property-validation";
import { propertyDraftReducer } from "@/components/schema-editor/property-form/reducer";
import { usePropertyFormSubmit } from "@/components/schema-editor/property-form/property-form-submit";
import type {
  PropertyDraftOperation,
  PropertyFormMode,
  PropertyFormProps,
  PropertyFormViewModel,
} from "@/components/schema-editor/property-form/types";
import { validatePropertyDraft } from "@/components/schema-editor/property-form/validation";

type PropertyFormControllerInput = Omit<
  PropertyFormProps,
  "mode" | "submitLabel"
> & {
  mode: PropertyFormMode;
  submitLabel: string;
  canDelete: boolean;
};

export function usePropertyFormController({
  propertyDraft: initialPropertyDraft,
  schemaContext,
  capabilities: capabilitiesProp,
  validation: validationProp,
  mode,
  submitLabel,
  canDelete,
  onPropertyDraftChange,
  onCommitPropertyDraft,
  onCancel,
  onDelete,
}: PropertyFormControllerInput): PropertyFormViewModel {
  const [propertyDraft, setPropertyDraft] =
    React.useState(initialPropertyDraft);
  const propertyDraftRef = React.useRef(initialPropertyDraft);
  const [draftResetVersion, setDraftResetVersion] = React.useState(0);

  React.useEffect(() => {
    propertyDraftRef.current = initialPropertyDraft;
    setPropertyDraft(initialPropertyDraft);
    setDraftResetVersion((version) => version + 1);
  }, [initialPropertyDraft]);

  const capabilities = React.useMemo(() => {
    if (mode !== "editable") {
      return resolvePropertyCapabilities({
        mode,
        canDelete,
      });
    }

    const nextCapabilities =
      capabilitiesProp ??
      resolvePropertyCapabilities({
        mode,
        canDelete,
      });

    return {
      ...nextCapabilities,
      mode,
    };
  }, [canDelete, capabilitiesProp, mode]);

  const validation = normalizeValidationForCapabilities({
    validation:
      validationProp ??
      validatePropertyDraft({
        propertyDraft,
        schemaContext,
      }),
    capabilities,
  });
  const effectiveType = getEffectiveType(propertyDraft.schemaNode);
  const schemaPlanContext = React.useMemo(
    () => ({
      ...schemaContext,
      resetKey: [
        schemaContext.resetKey ??
          schemaContext.fieldPath ??
          schemaContext.originalName,
        draftResetVersion,
      ].join(":"),
    }),
    [draftResetVersion, schemaContext],
  );

  const updatePropertyDraft = React.useCallback(
    (operation: PropertyDraftOperation) => {
      const nextPropertyDraft = propertyDraftReducer(
        propertyDraftRef.current,
        operation,
      );
      propertyDraftRef.current = nextPropertyDraft;
      setPropertyDraft(nextPropertyDraft);
      onPropertyDraftChange?.(nextPropertyDraft);
    },
    [onPropertyDraftChange],
  );

  const { commitPropertyDraft, isSubmitting } = usePropertyFormSubmit({
    capabilities,
    propertyDraftRef,
    schemaContext,
    validation: validationProp,
    onCommitPropertyDraft,
  });

  const keyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.nativeEvent.isComposing) return;
      if (event.target instanceof HTMLButtonElement) return;
      if (event.target instanceof HTMLTextAreaElement) {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          void commitPropertyDraft();
        }
        return;
      }
      event.preventDefault();
      void commitPropertyDraft();
    },
    [commitPropertyDraft],
  );

  const schemaPlan = createPropertySchemaPlan({
    schemaNode: propertyDraft.schemaNode,
    schemaContext: schemaPlanContext,
    mode: capabilities.mode,
    access: {
      arrayItems: capabilities.canEditArrayItems,
      enumValues: capabilities.canEditEnumValues,
      objectProperties: capabilities.canEditNestedObject,
      type: capabilities.canEditType,
    },
    editable:
      capabilities.canEditEnumValues ||
      capabilities.canEditNestedObject ||
      capabilities.canEditArrayItems,
    showTypeSelector: false,
    onChange: (schemaNode) =>
      updatePropertyDraft({
        type: "replacePropertySchemaNode",
        schemaNode,
      }),
  });
  const hasSchemaPlan = schemaPlan.items.length > 0;
  const { description } = propertyDraft.schemaNode;

  return {
    validation,
    capabilities,
    fields: {
      name: {
        value: propertyDraft.name,
        validation: validation.name,
        disabled: !capabilities.canEditName,
        onChange: (name) =>
          updatePropertyDraft({
            type: "renameProperty",
            name,
          }),
      },
      type: createPropertyTypeFieldWithObjectTemplates({
        schemaNode: propertyDraft.schemaNode,
        schemaContext,
        editable: capabilities.canEditType,
        onChange: (schemaNode: ExtendedJSONSchema7) =>
          updatePropertyDraft({
            type: "replacePropertySchemaNode",
            schemaNode,
          }),
      }),
      nullable: {
        isNullable: effectiveType.isNullable,
        disabled: !capabilities.canEditNullable,
        onChange: (isNullable) =>
          updatePropertyDraft({
            type: "setPropertyNullable",
            isNullable,
          }),
      },
      description: {
        value: description || "",
        disabled: !capabilities.canEditDescription,
        onChange: (description) =>
          updatePropertyDraft({
            type: "setPropertyDescription",
            description,
          }),
      },
      schemaPlan: hasSchemaPlan ? schemaPlan : undefined,
    },
    footer: {
      canDelete: capabilities.canDelete,
      isSubmitting,
      isSubmitDisabled: !validation.canCommit,
      submitLabel,
      onCancel,
      onDelete,
    },
    events: {
      submit: commitPropertyDraft,
      keyDown,
    },
  };
}
