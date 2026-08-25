"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DisclosureHeader } from "@/components/json-form-retab/disclosure";
import { JsonFormFieldMetadataBadges } from "@/components/json-form-retab/field-metadata";
import type { RenderJsonFormField } from "@/components/json-form-retab/field-renderer";
import {
  AUTO_COLLAPSE_DEPTH,
  CARD_VIRTUALIZE_THRESHOLD,
  LONG_ARRAY_THRESHOLD,
} from "@/components/json-form-retab/json-form-constants";
import { useJsonFormStartsOpen } from "@/components/json-form-retab/open-paths";
import { useJsonFormReadOnly } from "@/components/json-form-retab/read-only";
import {
  emptyArrayItemFormValue,
  joinJsonFormPath,
  joinJsonSourcePath,
} from "@/components/json-form-retab/path-codec";
import type { JsonFormTextInput } from "@/components/json-form-retab/scalar-control";
import {
  arrayItemSchemaAt,
  canAppendArrayItem,
  canRemoveArrayItem,
  hasDynamicObjectProperties,
  scalarObjectColumns,
  type Schema,
} from "@/components/json-form-retab/schema-model";
import { ArrayTable } from "@/components/json-form-retab/table/array-table";
import { VirtualList } from "@/components/json-form-retab/virtual-list";

export function JsonFormArray({
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
  const readOnly = useJsonFormReadOnly();
  const { control, getValues, setValue, unregister } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });
  const arrayValue = useWatch({ control, name });
  const renderedFields = React.useMemo(() => {
    // react-hook-form's useFieldArray compacts falsy primitive items (false,
    // 0, "") out of `fields`, so derive the rendered item count from the
    // watched array value instead of the compacted field list.
    if (!Array.isArray(arrayValue)) {
      return fields.map((field, index) => ({
        id: field.id ?? `${name}.${index}`,
      }));
    }
    return arrayValue.map((_, index) => ({
      id: fields[index]?.id ?? `${name}.${index}`,
    }));
  }, [arrayValue, fields, name]);
  const itemSchema = React.useMemo(
    () => arrayItemSchemaAt(schema, 0),
    [schema],
  );
  const isTupleArray = Array.isArray(schema.items);
  const hasDynamicItemProperties = React.useMemo(
    () => hasDynamicObjectProperties(itemSchema),
    [itemSchema],
  );
  const itemSchemaForIndex = React.useCallback(
    (index: number) => arrayItemSchemaAt(schema, index),
    [schema],
  );

  const columns = React.useMemo(
    () =>
      isTupleArray || hasDynamicItemProperties
        ? null
        : scalarObjectColumns(itemSchema),
    [hasDynamicItemProperties, isTupleArray, itemSchema],
  );

  const startsOpen = useJsonFormStartsOpen(
    sourcePath,
    depth < AUTO_COLLAPSE_DEPTH &&
      renderedFields.length <= LONG_ARRAY_THRESHOLD,
  );
  const [open, setOpen] = React.useState(startsOpen);
  const canAddItem =
    !readOnly && canAppendArrayItem(schema, renderedFields.length);
  const canRemoveItem =
    !readOnly && canRemoveArrayItem(schema, renderedFields.length);

  const add = React.useCallback(() => {
    const current = getValues(name);
    const nextIndex = Array.isArray(current)
      ? current.length
      : renderedFields.length;
    if (!canAppendArrayItem(schema, nextIndex)) return;
    const nextSchema = arrayItemSchemaAt(schema, nextIndex);
    const nextItem = emptyArrayItemFormValue(nextSchema);
    append(nextItem as never);
    if (Array.isArray(current)) {
      setValue(name, [...current, nextItem], { shouldDirty: true });
    }
    setOpen(true);
  }, [append, getValues, name, renderedFields.length, schema, setValue]);
  const removeAt = React.useCallback(
    (index: number) => {
      const current = getValues(name);
      if (Array.isArray(current)) {
        if (!canRemoveArrayItem(schema, current.length)) return;
        const next = current.slice();
        next.splice(index, 1);
        remove(index);
        setValue(name, next, { shouldDirty: true });
        unregister(`${name}.${next.length}`);
        return;
      }
      if (!canRemoveArrayItem(schema, renderedFields.length)) return;
      remove(index);
    },
    [
      getValues,
      name,
      remove,
      renderedFields.length,
      schema,
      setValue,
      unregister,
    ],
  );

  return (
    <div
      className={cn(
        "bg-background overflow-hidden rounded-lg border shadow-sm",
        className,
      )}
    >
      <DisclosureHeader
        open={open}
        onToggle={() => setOpen((o) => !o)}
        title={label}
        summary={`${renderedFields.length} item${renderedFields.length === 1 ? "" : "s"}`}
        description={schema.description}
        labelSuffix={
          <JsonFormFieldMetadataBadges
            name={name}
            sourcePath={sourcePath}
            value={arrayValue}
          />
        }
        actions={
          readOnly ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={add}
              disabled={!canAddItem}
            >
              <Plus className="size-4" />
              Add
            </Button>
          )
        }
      />
      {open ? (
        <div className={cn("border-t", columns ? "" : "p-3")}>
          {renderedFields.length === 0 ? (
            <p className="text-muted-foreground text-sm">No items.</p>
          ) : columns ? (
            <ArrayTable
              name={name}
              sourcePath={sourcePath}
              fields={renderedFields}
              remove={removeAt}
              canRemove={canRemoveItem}
              columns={columns}
            />
          ) : (
            <ArrayCards
              name={name}
              sourcePath={sourcePath}
              fields={renderedFields}
              remove={removeAt}
              canRemove={canRemoveItem}
              itemSchemaForIndex={itemSchemaForIndex}
              label={label}
              textInput={textInput}
              depth={depth}
              renderField={renderField}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

interface ArrayCardsProps {
  name: string;
  sourcePath: string;
  fields: { id: string }[];
  remove: (index: number) => void;
  canRemove: boolean;
  itemSchemaForIndex: (index: number) => Schema;
  label: string;
  textInput?: JsonFormTextInput;
  depth: number;
  renderField: RenderJsonFormField;
}

function ArrayCards({
  name,
  sourcePath,
  fields,
  remove,
  canRemove,
  itemSchemaForIndex,
  label,
  textInput,
  depth,
  renderField,
}: ArrayCardsProps) {
  const renderCard = React.useCallback(
    (index: number) => (
      <ArrayCard
        name={name}
        sourcePath={sourcePath}
        index={index}
        remove={remove}
        canRemove={canRemove}
        itemSchema={itemSchemaForIndex(index)}
        label={label}
        textInput={textInput}
        depth={depth}
        renderField={renderField}
      />
    ),
    [
      name,
      sourcePath,
      remove,
      canRemove,
      itemSchemaForIndex,
      label,
      textInput,
      depth,
      renderField,
    ],
  );

  if (fields.length > CARD_VIRTUALIZE_THRESHOLD) {
    return (
      <VirtualList
        fields={fields}
        estimateSize={64}
        renderItem={renderCard}
        gap={8}
      />
    );
  }

  return (
    <div className="space-y-2">
      {fields.map((entry, index) => (
        <React.Fragment key={entry.id}>{renderCard(index)}</React.Fragment>
      ))}
    </div>
  );
}

const ArrayCard = React.memo(function ArrayCard({
  name,
  sourcePath,
  index,
  remove,
  canRemove,
  itemSchema,
  label,
  textInput,
  depth,
  renderField,
}: {
  name: string;
  sourcePath: string;
  index: number;
  remove: (index: number) => void;
  canRemove: boolean;
  itemSchema: Schema;
  label: string;
  textInput?: JsonFormTextInput;
  depth: number;
  renderField: RenderJsonFormField;
}) {
  const readOnly = useJsonFormReadOnly();

  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        {renderField({
          name: joinJsonFormPath(name, index),
          sourcePath: joinJsonSourcePath(sourcePath, index),
          schema: itemSchema,
          label: `${label} ${index + 1}`,
          textInput,
          depth: depth + 1,
        })}
      </div>
      {readOnly ? null : (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-muted-foreground hover:border-border hover:text-destructive mt-1 border-transparent hover:bg-transparent"
          onClick={() => remove(index)}
          aria-label="Remove item"
          disabled={!canRemove}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
});
