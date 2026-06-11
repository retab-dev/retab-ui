import { useEffect } from "react";
import { JSONSchemaType } from "ajv";
import { ajvResolver } from "@hookform/resolvers/ajv";
import { JSONSchema7 } from "json-schema";
import { useForm, type UseFormReturn } from "react-hook-form";
import { JsonForm } from "@/components/json-form/json-form";

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
  setSourcesFieldPath?: (fieldPath: string | null) => void;
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


  return (
    <div className="flex max-h-[60vh] flex-col space-y-4 overflow-y-auto">
      <fieldset disabled={disabled} className="min-w-0">
        <JsonForm
          form={form as UseFormReturn<Record<string, unknown>>}
          schema={property}
          onSubmit={onSubmit}
          className="border border-border rounded-sm text-xs bg-background text-muted-foreground"
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
  setSourcesFieldPath?: (fieldPath: string | null) => void;
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


  return (
    <div className="flex max-h-[60vh] flex-col space-y-4 overflow-y-auto">
      <fieldset disabled={disabled} className="min-w-0">
        <JsonForm
          form={form as UseFormReturn<Record<string, unknown>>}
          schema={wrapperSchema}
          onSubmit={(values: any) => onSubmit(values[name])}
          className="border border-border rounded-sm text-xs bg-background text-muted-foreground"
        />
      </fieldset>
    </div>
  );
}
