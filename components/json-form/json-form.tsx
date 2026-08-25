"use client";

import * as React from "react";
import { type SubmitHandler, type UseFormReturn } from "react-hook-form";

import { cn } from "@/lib/utils";
import { JsonFormArray } from "@/components/json-form/array-fields";
import { WithDescription } from "@/components/json-form/disclosure";
import type { JsonFormFieldRenderProps } from "@/components/json-form/field-renderer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/json-form/form-primitives";
import {
  JsonFormObject,
  JsonFormRootFields,
} from "@/components/json-form/object-fields";
import { JsonFormOpenPathsContext } from "@/components/json-form/open-paths";
import {
  decodeJsonFormValue,
  encodeJsonFormValue,
  schemaNeedsJsonFormPathEncoding,
} from "@/components/json-form/path-codec";
import { JsonFormReadOnlyProvider } from "@/components/json-form/read-only";
import {
  BooleanControl,
  NullableBooleanControl,
  ScalarControl,
  type JsonFormTextInput,
} from "@/components/json-form/scalar-control";
import {
  expandRefs,
  fieldKind,
  labelFor,
  unwrapNullable,
  type Schema,
} from "@/components/json-form/schema-model";
import {
  JsonFormSourceLinkProvider,
  SourceLinkShell,
  type JsonFormSourceLink,
} from "@/components/json-form/source-link";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

export type { JsonFormTextInput } from "@/components/json-form/scalar-control";

/**
 * A JSON-Schema-driven form built entirely on shadcn's `FormField` abstraction.
 *
 * Each schema property is rendered through `<FormField>` →
 * `<FormItem>/<FormLabel>/<FormControl>/<FormDescription>/<FormMessage>`, so it
 * inherits shadcn's react-hook-form wiring, accessibility, and error display
 * with zero bespoke styling. Objects nest, arrays repeat, and scalars map to the
 * matching control. Drop it inside your own `useForm()` instance.
 *
 * Built to scale to deep, repetitive documents (e.g. an extraction with
 * `properties[] → production[] → line_items[]`):
 *
 *  - **Lazy mount.** Nested objects and arrays are collapsible; their children
 *    are only mounted in the DOM while expanded, so a 5,000-field tree boots as
 *    a handful of summary rows.
 *  - **Table mode.** An array whose items are flat objects of scalars renders as
 *    a dense editable table (one row per item, one column per field) instead of
 *    a stack of bordered cards.
 *  - **Virtualization.** Long arrays (card *or* table mode) window their rows
 *    through local row virtualizers, so only the visible items are in the DOM.
 *  - **Isolated re-renders.** Each row subscribes to its own field state, so a
 *    keystroke in one item never re-renders its siblings.
 */

// ---------------------------------------------------------------------------
// JsonFormField — the unit of composition
// ---------------------------------------------------------------------------

export type JsonFormFieldProps = JsonFormFieldRenderProps;

export function JsonFormField({
  name,
  sourcePath,
  schema: rawSchema,
  required = false,
  label,
  textInput,
  className,
  depth = 0,
}: JsonFormFieldProps) {
  const expandedSchema = React.useMemo(
    () => expandRefs(rawSchema),
    [rawSchema],
  );
  const { schema, nullable } = unwrapNullable(expandedSchema);
  const kind = fieldKind(schema);
  const heading = labelFor(name, schema, label);
  const resolvedSourcePath = sourcePath ?? name;

  if (kind === "object") {
    return (
      <JsonFormObject
        name={name}
        sourcePath={resolvedSourcePath}
        schema={schema}
        label={heading}
        textInput={textInput}
        className={className}
        depth={depth}
        renderField={renderJsonFormField}
      />
    );
  }

  if (kind === "array") {
    return (
      <JsonFormArray
        name={name}
        sourcePath={resolvedSourcePath}
        schema={schema}
        label={heading}
        textInput={textInput}
        className={className}
        depth={depth}
        renderField={renderJsonFormField}
      />
    );
  }

  if (kind === "boolean") {
    if (nullable) {
      return (
        <SourceLinkShell sourcePath={resolvedSourcePath}>
          <FormField
            name={name}
            render={({ field }) => (
              <FormItem className={className}>
                <WithDescription text={schema.description}>
                  <FormLabel>
                    {heading}
                    {required ? (
                      <span className="text-destructive"> *</span>
                    ) : null}
                  </FormLabel>
                </WithDescription>
                <FormControl>
                  <NullableBooleanControl
                    field={field}
                    label={`${heading}${required ? " *" : ""}`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SourceLinkShell>
      );
    }

    return (
      <SourceLinkShell sourcePath={resolvedSourcePath}>
        <FormField
          name={name}
          render={({ field }) => (
            <FormItem className={className}>
              <WithDescription text={schema.description}>
                <FormLabel>
                  {heading}
                  {required ? (
                    <span className="text-destructive"> *</span>
                  ) : null}
                </FormLabel>
              </WithDescription>
              <FormControl>
                <BooleanControl
                  field={field}
                  label={`${heading}${required ? " *" : ""}`}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </SourceLinkShell>
    );
  }

  return (
    <SourceLinkShell sourcePath={resolvedSourcePath}>
      <FormField
        name={name}
        render={({ field }) => (
          <FormItem className={className}>
            <WithDescription text={schema.description}>
              <FormLabel>
                {heading}
                {required ? <span className="text-destructive"> *</span> : null}
              </FormLabel>
            </WithDescription>
            <FormControl>
              <ScalarControl
                kind={kind}
                schema={schema}
                field={field}
                textInput={textInput}
                nullable={nullable}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </SourceLinkShell>
  );
}

function renderJsonFormField(props: JsonFormFieldRenderProps) {
  return <JsonFormField {...props} />;
}

// ---------------------------------------------------------------------------
// JsonForm — convenience wrapper over a whole schema
// ---------------------------------------------------------------------------

export interface JsonFormProps {
  form: UseFormReturn<Record<string, unknown>>;
  schema: Schema;
  onSubmit?: SubmitHandler<Record<string, unknown>>;
  className?: string;
  /** Force plain string fields to render as single-line inputs or textareas. */
  textInput?: JsonFormTextInput;
  /**
   * Opt into field-level source linking. When set, every scalar field becomes a
   * hoverable card that reports its path and highlights when active — wire it
   * straight from a source field link.
   */
  sourceLink?: JsonFormSourceLink;
  /**
   * Source/logical paths that should start expanded. Intended for controlled
   * demos and benchmarks that need a deep virtualized body mounted immediately.
   */
  defaultOpenPaths?: readonly string[];
  /**
   * Render every control inert. Values stay visible (and selectable) but
   * cannot be changed, and array add/remove affordances are dropped. Use it on
   * viewer surfaces that never submit the form.
   */
  readOnly?: boolean;
  /** Rendered after the fields, e.g. a submit button. */
  children?: React.ReactNode;
}

export function JsonForm({
  form,
  schema,
  onSubmit,
  className,
  textInput,
  sourceLink,
  defaultOpenPaths,
  readOnly = false,
  children,
}: JsonFormProps) {
  const expandedSchema = React.useMemo(() => expandRefs(schema), [schema]);
  const usesEncodedPaths = React.useMemo(
    () => schemaNeedsJsonFormPathEncoding(expandedSchema),
    [expandedSchema],
  );
  const defaultOpenPathSet = React.useMemo(
    () =>
      defaultOpenPaths && defaultOpenPaths.length > 0
        ? new Set(defaultOpenPaths)
        : null,
    [defaultOpenPaths],
  );
  const hasEncodedInitialValuesRef = React.useRef(false);

  useKeyedMountEffect(
    joinEffectKey([expandedSchema, form, usesEncodedPaths]),
    () => {
      if (!usesEncodedPaths || hasEncodedInitialValuesRef.current) {
        return;
      }
      hasEncodedInitialValuesRef.current = true;
      form.reset(
        encodeJsonFormValue(expandedSchema, form.getValues()) as Record<
          string,
          unknown
        >,
      );
    },
  );

  const handleSubmit = React.useCallback(
    (event: React.FormEvent) => {
      if (!onSubmit) {
        event.preventDefault();
        return;
      }
      const activeElement = event.currentTarget.ownerDocument.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        event.currentTarget.contains(activeElement)
      ) {
        activeElement.blur();
      }
      return form.handleSubmit((data, submitEvent) => {
        const decoded = usesEncodedPaths
          ? (decodeJsonFormValue(expandedSchema, data) as Record<
              string,
              unknown
            >)
          : data;
        return onSubmit(decoded, submitEvent);
      })(event);
    },
    [expandedSchema, form, onSubmit, usesEncodedPaths],
  );

  return (
    <JsonFormSourceLinkProvider sourceLink={sourceLink}>
      <JsonFormReadOnlyProvider readOnly={readOnly}>
        <JsonFormOpenPathsContext.Provider value={defaultOpenPathSet}>
          <Form {...form}>
            <form
              onSubmit={handleSubmit}
              className={cn("space-y-4", className)}
            >
              <JsonFormRootFields
                schema={expandedSchema}
                textInput={textInput}
                renderField={renderJsonFormField}
              />
              {children}
            </form>
          </Form>
        </JsonFormOpenPathsContext.Provider>
      </JsonFormReadOnlyProvider>
    </JsonFormSourceLinkProvider>
  );
}
