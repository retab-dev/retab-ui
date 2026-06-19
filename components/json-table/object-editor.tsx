import * as React from "react";
import { ajvResolver } from "@hookform/resolvers/ajv";
import type { JSONSchemaType } from "ajv";
import type { JSONSchema7 } from "json-schema";
import { useForm, type UseFormReturn } from "react-hook-form";

import { JsonForm } from "@/components/json-form/json-form";
import { useMountEffect } from "@/hooks/use-mount-effect";

type FormValues = Record<string, unknown>;

function objectValue(value: unknown): FormValues {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as FormValues)
    : {};
}

export function ObjectEditor({
  property,
  currentValue,
  onSubmit,
  disabled = false,
}: {
  property: JSONSchema7;
  currentValue: unknown;
  onSubmit: (values: unknown) => void;
  disabled?: boolean;
}) {
  const form = useForm<FormValues>({
    defaultValues: objectValue(currentValue),
    resolver: ajvResolver(property as JSONSchemaType<FormValues>, {
      strictSchema: false,
      allErrors: true,
    }),
  });
  const onSubmitRef = React.useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  useMountEffect(() => {
    const sub = form.watch((values) => onSubmitRef.current(values));
    return () => sub.unsubscribe();
  });

  return (
    <div className="flex max-h-[60vh] flex-col space-y-4 overflow-y-auto">
      <fieldset disabled={disabled} className="min-w-0">
        <JsonForm
          form={form as UseFormReturn<Record<string, unknown>>}
          schema={property}
          onSubmit={(values) => onSubmit(values)}
          className="border-border bg-background text-muted-foreground rounded-sm border text-xs"
        />
      </fieldset>
    </div>
  );
}

export function ArrayEditor({
  name,
  property,
  currentValue,
  onSubmit,
  disabled = false,
}: {
  name: string;
  property: JSONSchema7;
  currentValue: unknown;
  onSubmit: (values: unknown) => void;
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

  const form = useForm<FormValues>({
    defaultValues: {
      [name]: Array.isArray(currentValue) ? currentValue : [],
    },
    resolver: ajvResolver(wrapperSchema as JSONSchemaType<FormValues>, {
      strictSchema: false,
      allErrors: true,
    }),
  });
  const nameRef = React.useRef(name);
  nameRef.current = name;
  const onSubmitRef = React.useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  useMountEffect(() => {
    const sub = form.watch((values) => {
      onSubmitRef.current(values[nameRef.current]);
    });
    return () => sub.unsubscribe();
  });

  return (
    <div className="flex max-h-[60vh] flex-col space-y-4 overflow-y-auto">
      <fieldset disabled={disabled} className="min-w-0">
        <JsonForm
          form={form as UseFormReturn<Record<string, unknown>>}
          schema={wrapperSchema}
          onSubmit={(values) => onSubmit(values[name])}
          className="border-border bg-background text-muted-foreground rounded-sm border text-xs"
        />
      </fieldset>
    </div>
  );
}
