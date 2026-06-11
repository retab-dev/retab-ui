import { useEffect } from "react";
import { JSONSchemaType } from "ajv";
import { ajvResolver } from "@hookform/resolvers/ajv";
import { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { useForm, type UseFormReturn } from "react-hook-form";
import { JsonForm } from "@/components/json-form/json-form";
import { resolveSchemaReference } from "@/components/json-table/lib/json-schema-utils";
import { getTheme } from "@/components/json-table/lib/themes";

// Kept for caller compatibility; the lightweight JsonForm renders no scalar
// value / consensus coloring, so this is unused beyond typing the prop.
export type ScalarValueType = "similarity" | "consensus" | "mismatch" | "none";

// Editor for an object cell: renders the property's schema as a form. Edits are
// persisted as they change (the popover has no explicit submit button).
export function ObjectEditor({
  property,
  currentValue,
  onSubmit,
  disabled = false,
}: {
  isOpen?: boolean;
  property: JSONSchema7;
  currentValue: any;
  onSubmit: (values: any) => void;
  likelihoods?: Record<string, any>;
  scalarValueType?: ScalarValueType;
  setSourcesFieldPath?: (fieldPath: string | null) => void;
  currentIterationId?: string;
  disabled?: boolean;
}) {
  const form = useForm({
    defaultValues: currentValue,
    resolver: ajvResolver(property as JSONSchemaType<any>, {
      strictSchema: false,
      allErrors: true,
    }),
  });

  useEffect(() => {
    const sub = form.watch((values) => onSubmit(values));
    return () => sub.unsubscribe();
  }, [form, onSubmit]);

  const theme = getTheme("gray");

  return (
    <div className="flex max-h-[60vh] flex-col space-y-4 overflow-y-auto">
      <fieldset disabled={disabled} className="min-w-0">
        <JsonForm
          form={form as UseFormReturn<Record<string, unknown>>}
          schema={property}
          onSubmit={onSubmit}
          className={`border ${theme.border} rounded-sm text-xs ${theme.tableContainerBg} ${theme.headerText}`}
        />
      </fieldset>
    </div>
  );
}

// Editor for an array cell: wraps the array under a single named property so the
// form renders an array field, then unwraps it on submit.
export function ArrayEditor({
  name,
  property,
  currentValue,
  onSubmit,
  disabled = false,
}: {
  name: string;
  property: JSONSchema7;
  currentValue: any;
  onSubmit: (values: any) => void;
  likelihoods?: Record<string, any>;
  scalarValueType?: ScalarValueType;
  setSourcesFieldPath?: (fieldPath: string | null) => void;
  currentIterationId?: string;
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

  const form = useForm({
    defaultValues: {
      [name]: Array.isArray(currentValue) ? currentValue : [],
    },
    resolver: ajvResolver(wrapperSchema as JSONSchemaType<any>, {
      strictSchema: false,
      allErrors: true,
    }),
  });

  useEffect(() => {
    const sub = form.watch((values) => onSubmit(values[name]));
    return () => sub.unsubscribe();
  }, [form, onSubmit, name]);

  const theme = getTheme("gray");

  return (
    <div className="flex max-h-[60vh] flex-col space-y-4 overflow-y-auto">
      <fieldset disabled={disabled} className="min-w-0">
        <JsonForm
          form={form as UseFormReturn<Record<string, unknown>>}
          schema={wrapperSchema}
          onSubmit={(values: any) => onSubmit(values[name])}
          className={`border ${theme.border} rounded-sm text-xs ${theme.tableContainerBg} ${theme.headerText}`}
        />
      </fieldset>
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
