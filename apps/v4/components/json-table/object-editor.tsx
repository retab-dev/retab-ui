import { JSONSchemaType } from "ajv";
import { ajvResolver } from "@hookform/resolvers/ajv";
import { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { useForm } from "react-hook-form";
import { scalarValueType, UiForm, UiFormContent } from "@/components/json-form/json-form";
import { resolveSchemaReference } from "@/components/json-table/lib/json-schema-utils";
import { getTheme } from "@/components/json-table/lib/themes";

// New component for editing object properties
export function ObjectEditor({
  property,
  currentValue,
  onSubmit,
  likelihoods = {},
  scalarValueType,
  setSourcesFieldPath,
  currentIterationId,
  disabled = false,
}: {
  isOpen: boolean;
  property: JSONSchema7;
  currentValue: any;
  onSubmit: (values: any) => void;
  likelihoods: Record<string, any>;
  scalarValueType: scalarValueType;
  setSourcesFieldPath?: (fieldPath: string | null) => void;
  currentIterationId: string;
  disabled?: boolean;
}) {
  // This useForm hook is now correctly called inside a component
  const form = useForm({
    defaultValues: currentValue,
    // Add resolver for schema validation using ajvResolver
    resolver: ajvResolver(property as JSONSchemaType<any>, {
      strictSchema: false,
      allErrors: true,
    }),
  });

  const propertyEditorMode =
    currentIterationId !== "dataset" && currentIterationId !== "playground"
      ? "promptOnly"
      : "editable";

  const theme = getTheme("gray");

  return (
    <div className="flex max-h-[60vh] flex-col space-y-4 overflow-y-auto">
      {/*<h4 className="font-medium text-sm">{title}</h4>*/}
      <UiForm
        form={form}
        schema={property}
        variant="normal"
        config={{}}
        size="sm"
        className="w-full"
        disabled={disabled}
        isStreaming={false}
        isProcessing={false}
        scalarValueDisplay="outline-large"
        scalarValueType={scalarValueType}
        likelihoods={likelihoods}
        setLikelihoods={() => {}}
        onSubmit={onSubmit}
        titlePosition="object"
        setSourcesFieldPath={setSourcesFieldPath}
        propertyEditorMode={propertyEditorMode}
        showPropertyEditorPencil={
          currentIterationId === "dataset" ||
          currentIterationId === "playground"
        }
        validationFlags={{}}
        setValidationFlags={() => {}}
      >
        <UiFormContent
          className={`border ${theme.border} rounded-sm !text-xs ${theme.tableContainerBg} ${theme.headerText} disabled:opacity-100`}
        />
      </UiForm>
    </div>
  );
}

export function ArrayEditor({
  name,
  property,
  currentValue,
  onSubmit,
  likelihoods = {},
  scalarValueType,
  setSourcesFieldPath,
  currentIterationId,
  disabled = false,
}: {
  name: string;
  property: JSONSchema7;
  currentValue: any;
  onSubmit: (values: any) => void;
  likelihoods: Record<string, any>;
  scalarValueType: scalarValueType;
  setSourcesFieldPath?: (fieldPath: string | null) => void;
  currentIterationId: string;
  disabled?: boolean;
}) {
  const { $defs, ...restProperty } = property;
  const wrapperSchema: JSONSchema7 = {
    type: "object",
    $defs,
    properties: {
      [name]: restProperty,
    },
    required: [name],
  };

  // Use the dynamic name instead of hardcoding "name"
  const form = useForm({
    defaultValues: {
      [name]: Array.isArray(currentValue) ? currentValue : [],
    },
    // Add resolver for schema validation using ajvResolver correctly
    resolver: ajvResolver(wrapperSchema as JSONSchemaType<any>, {
      strictSchema: false,
      allErrors: true,
    }),
  });

  const handleSubmit = (values: any) => {
    onSubmit(values[name]);
  };

  const propertyEditorMode =
    currentIterationId !== "dataset" && currentIterationId !== "playground"
      ? "promptOnly"
      : "editable";

  const theme = getTheme("gray");

  return (
    <div className="flex max-h-[60vh] flex-col space-y-4 overflow-y-auto">
      <UiForm
        form={form}
        schema={wrapperSchema}
        variant="normal"
        config={{}}
        size="sm"
        className="w-full"
        disabled={disabled}
        isStreaming={false}
        isProcessing={false}
        scalarValueDisplay="outline-large"
        scalarValueType={scalarValueType}
        likelihoods={likelihoods}
        setLikelihoods={() => {}}
        onSubmit={handleSubmit}
        titlePosition="object"
        setSourcesFieldPath={setSourcesFieldPath}
        propertyEditorMode={propertyEditorMode}
        showPropertyEditorPencil={
          currentIterationId === "dataset" ||
          currentIterationId === "playground"
        }
        validationFlags={{}}
        setValidationFlags={() => {}}
      >
        <UiFormContent
          className={`border ${theme.border} rounded-sm !text-xs ${theme.tableContainerBg} ${theme.headerText} disabled:opacity-100`}
        />
      </UiForm>
    </div>
  );
}

// Make sure to export isArrayProperty from components.tsx as well
export function isArrayProperty(
  property: JSONSchema7Definition,
  schema: JSONSchema7,
): boolean {
  if (typeof property !== "object" || property === null) return false;

  if (property.type === "array") return true;

  const types = ["oneOf", "anyOf", "allOf"] as const;
  for (const type of types) {
    if (Array.isArray(property[type])) {
      for (const subSchema of property[type]) {
        if (typeof subSchema === "object" && subSchema?.type === "array") {
          return true;
        }
      }
    }
  }

  if (property.$ref && typeof property.$ref === "string") {
    const referenced = resolveSchemaReference(property, schema);
    if (referenced && referenced.type === "array") {
      return true;
    }
  }

  return false;
}
