"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert";
import type { SchemaDocument } from "@/components/schema-editor/document/types";
import type {
  ExtendedJSONSchema7,
  SchemaBuilderState,
} from "@/components/schema-editor/schema-builder-types";
import { requireAllProperties } from "@/components/schema-editor/schema-required-policy";
import { validateProjectedSchema } from "@/components/schema-editor/validation";

export interface UseSchemaBuilderStateOptions {
  value: ExtendedJSONSchema7;
  onValueChange: (schema: ExtendedJSONSchema7) => void;
  readOnly?: boolean;
  onPersist?: (schema: ExtendedJSONSchema7) => Promise<void>;
}

export function schemaSignature(value: unknown): string {
  return JSON.stringify(value);
}

export function projectSchemaDocument(
  doc: SchemaDocument,
): ExtendedJSONSchema7 {
  return requireAllProperties(toJsonSchema(doc)) as ExtendedJSONSchema7;
}

export function useSchemaBuilderState({
  value,
  onValueChange,
  readOnly = false,
  onPersist,
}: UseSchemaBuilderStateOptions): SchemaBuilderState {
  const [initialSignature] = React.useState(() => schemaSignature(value));
  const [doc, setDoc] = React.useState<SchemaDocument>(() =>
    fromJsonSchema(value),
  );

  const lastImportedSignatureRef = React.useRef(initialSignature);
  const lastEmittedSignatureRef = React.useRef<string | null>(null);

  const propSignature = React.useMemo(() => schemaSignature(value), [value]);

  React.useLayoutEffect(() => {
    if (propSignature === lastEmittedSignatureRef.current) {
      lastImportedSignatureRef.current = propSignature;
      return;
    }

    if (propSignature !== lastImportedSignatureRef.current) {
      lastImportedSignatureRef.current = propSignature;
      setDoc(fromJsonSchema(value));
    }
  }, [propSignature, value]);

  const schema = React.useMemo(() => projectSchemaDocument(doc), [doc]);
  const validation = React.useMemo(
    () => validateProjectedSchema(schema),
    [schema],
  );

  const docRef = React.useRef(doc);
  React.useLayoutEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const schemaRef = React.useRef(schema);
  React.useLayoutEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  const emitSchema = React.useCallback(
    (nextDoc: SchemaDocument, persist: boolean | undefined) => {
      const nextSchema = projectSchemaDocument(nextDoc);
      const nextSignature = schemaSignature(nextSchema);
      lastEmittedSignatureRef.current = nextSignature;
      lastImportedSignatureRef.current = nextSignature;
      schemaRef.current = nextSchema;
      onValueChange(nextSchema);
      if ((persist ?? true) && onPersist) {
        void onPersist(nextSchema);
      }
    },
    [onPersist, onValueChange],
  );

  const dispatch = React.useCallback(
    (op: (doc: SchemaDocument) => SchemaDocument, persist?: boolean) => {
      if (readOnly) return;

      const previous = docRef.current;
      const next = op(previous);
      if (next === previous) return;

      docRef.current = next;
      setDoc(next);
      emitSchema(next, persist);
    },
    [emitSchema, readOnly],
  );

  const replaceSchema = React.useCallback(
    async (
      nextValue: React.SetStateAction<ExtendedJSONSchema7>,
      persist?: boolean,
    ) => {
      if (readOnly) return;

      const resolved = requireAllProperties(
        typeof nextValue === "function"
          ? nextValue(schemaRef.current)
          : nextValue,
      ) as ExtendedJSONSchema7;
      const nextSignature = schemaSignature(resolved);

      if (nextSignature === schemaSignature(schemaRef.current)) {
        if ((persist ?? true) && onPersist) {
          await onPersist(resolved);
        }
        return;
      }

      const nextDoc = fromJsonSchema(resolved);
      docRef.current = nextDoc;
      setDoc(nextDoc);
      lastEmittedSignatureRef.current = nextSignature;
      lastImportedSignatureRef.current = nextSignature;
      schemaRef.current = resolved;
      onValueChange(resolved);

      if ((persist ?? true) && onPersist) {
        await onPersist(resolved);
      }
    },
    [onPersist, onValueChange, readOnly],
  );

  return {
    doc,
    schema,
    validation,
    dispatch,
    replaceSchema,
  };
}
