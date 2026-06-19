"use client";

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { cn } from "@/lib/utils";
import { DisclosureHeader } from "@/components/json-form/disclosure";
import type { RenderJsonFormField } from "@/components/json-form/field-renderer";
import { AUTO_COLLAPSE_DEPTH } from "@/components/json-form/json-form-constants";
import { useJsonFormStartsOpen } from "@/components/json-form/open-paths";
import {
  dynamicPropertyEntries,
  joinJsonFormPath,
  joinJsonSourcePath,
  staticPropertyKeys,
} from "@/components/json-form/path-codec";
import type { JsonFormTextInput } from "@/components/json-form/scalar-control";
import {
  labelFor,
  schemaProperties,
  type Schema,
} from "@/components/json-form/schema-model";

export function JsonFormObject({
  name,
  sourcePath,
  schema,
  label,
  textInput,
  className,
  depth,
  renderField,
}: {
  name: string;
  sourcePath: string;
  schema: Schema;
  label: string;
  textInput?: JsonFormTextInput;
  className?: string;
  depth: number;
  renderField: RenderJsonFormField;
}) {
  const { control, getValues } = useFormContext();
  const properties = React.useMemo(() => schemaProperties(schema), [schema]);
  const required = React.useMemo(
    () => new Set(schema.required ?? []),
    [schema],
  );
  const entries = React.useMemo(() => Object.entries(properties), [properties]);
  const currentValue = useWatch({
    control,
    name,
    defaultValue: getValues(name),
  }) as unknown;
  const staticKeys = React.useMemo(() => staticPropertyKeys(schema), [schema]);
  const dynamicEntries = React.useMemo(
    () => dynamicPropertyEntries(schema, currentValue, staticKeys),
    [currentValue, schema, staticKeys],
  );
  const fieldCount = entries.length + dynamicEntries.length;
  const startsOpen = useJsonFormStartsOpen(
    sourcePath,
    depth < AUTO_COLLAPSE_DEPTH,
  );
  const [open, setOpen] = React.useState(startsOpen);

  return (
    <div className={cn("rounded-lg border", className)}>
      <DisclosureHeader
        open={open}
        onToggle={() => setOpen((o) => !o)}
        title={label}
        summary={`${fieldCount} field${fieldCount === 1 ? "" : "s"}`}
        description={schema.description}
      />
      {open ? (
        <div className="space-y-3 border-t p-3">
          {entries.map(([key, child]) =>
            typeof child === "object" ? (
              <React.Fragment key={key}>
                {renderField({
                  name: joinJsonFormPath(name, key),
                  sourcePath: joinJsonSourcePath(sourcePath, key),
                  schema: child,
                  required: required.has(key),
                  label: labelFor(key, child),
                  textInput,
                  depth: depth + 1,
                })}
              </React.Fragment>
            ) : null,
          )}
          {dynamicEntries.map(({ key, schema: child }) => (
            <React.Fragment key={key}>
              {renderField({
                name: joinJsonFormPath(name, key),
                sourcePath: joinJsonSourcePath(sourcePath, key),
                schema: child,
                label: key,
                textInput,
                depth: depth + 1,
              })}
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function JsonFormRootFields({
  schema,
  textInput,
  renderField,
}: {
  schema: Schema;
  textInput?: JsonFormTextInput;
  renderField: RenderJsonFormField;
}) {
  const { control, getValues } = useFormContext();
  const properties = schemaProperties(schema);
  const required = new Set(schema.required ?? []);
  const entries = Object.entries(properties);
  const currentValue = useWatch({
    control,
    defaultValue: getValues(),
  }) as unknown;
  const staticKeys = React.useMemo(() => staticPropertyKeys(schema), [schema]);
  const dynamicEntries = React.useMemo(
    () => dynamicPropertyEntries(schema, currentValue, staticKeys),
    [currentValue, schema, staticKeys],
  );

  return (
    <>
      {entries.map(([key, child]) =>
        typeof child === "object" ? (
          <React.Fragment key={key}>
            {renderField({
              name: joinJsonFormPath("", key),
              sourcePath: key,
              schema: child,
              required: required.has(key),
              label: labelFor(key, child),
              textInput,
              depth: 0,
            })}
          </React.Fragment>
        ) : null,
      )}
      {dynamicEntries.map(({ key, schema: child }) => (
        <React.Fragment key={key}>
          {renderField({
            name: joinJsonFormPath("", key),
            sourcePath: key,
            schema: child,
            label: key,
            textInput,
            depth: 0,
          })}
        </React.Fragment>
      ))}
    </>
  );
}
