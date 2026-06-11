"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  errorsText,
  getJsonSchemaValidationErrors,
  validateJsonSchema,
} from "@/components/schema-editor/schema-validation";
import { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { isEqual } from "lodash";
import { useMountEffect } from "@/components/schema-editor/lib/use-mount-effect";
import {
  fromJsonSchema,
  toJsonSchema,
  type SchemaDocument,
} from "@/components/schema-editor/document";

/** Order-insensitive structural signature, to tell our own echo from a genuine
 *  external change to the controlled `jsonSchema` prop. */
function schemaSignature(value: unknown): string {
  const norm = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(norm)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v as Record<string, unknown>)
              .sort()
              .map((k) => [k, norm((v as Record<string, unknown>)[k])]),
          )
        : v;
  return JSON.stringify(norm(value));
}

interface JsonSchemaContextType {
  jsonSchema: ExtendedJSONSchema7;
  setJsonSchema: (
    value: React.SetStateAction<ExtendedJSONSchema7>,
    persist?: boolean,
  ) => Promise<void>;
  computedSchema: ExtendedJSONSchema7;
  isValidSchema: boolean;
  validationErrors?: string;
  /**
   * The editor's Document — the lossless, identity-bearing source of truth for
   * the migrated components (see `components/schema-editor/document`). Kept in
   * sync with `jsonSchema`; mutate it through `applyDocOp`.
   */
  doc: SchemaDocument;
  /**
   * Apply an immutable Document operation (from `document/operations`). Updates
   * the Document and projects it back out to `setJsonSchema` byte-faithfully.
   */
  applyDocOp: (
    op: (doc: SchemaDocument) => SchemaDocument,
    persist?: boolean,
  ) => void;
}

const JsonSchemaContext = createContext<JsonSchemaContextType | undefined>(
  undefined,
);

interface JsonSchemaEditorProviderProps {
  jsonSchema?: ExtendedJSONSchema7;
  setJsonSchema?: React.Dispatch<React.SetStateAction<ExtendedJSONSchema7>>;
  computedSchema?: ExtendedJSONSchema7;
  persistJsonSchemaCallback?: (newSchema: ExtendedJSONSchema7) => Promise<void>;
  children: ReactNode;
}

function JsonSchemaValidationRunner({
  jsonSchema,
  countSchemaProperties,
  processValidationErrors,
  setValidationErrors,
  setIsValidSchema,
}: {
  jsonSchema: ExtendedJSONSchema7;
  countSchemaProperties: (schema?: ExtendedJSONSchema7) => number;
  processValidationErrors: (errors: any[] | null | undefined) => any[];
  setValidationErrors: React.Dispatch<React.SetStateAction<string | undefined>>;
  setIsValidSchema: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  useMountEffect(() => {
    const propertiesCount = countSchemaProperties(jsonSchema);
    const propertiesOverflow = propertiesCount > 500;
    const isValid = validateJsonSchema(jsonSchema) && !propertiesOverflow;

    if (isValid) {
      setValidationErrors(undefined);
    } else if (propertiesOverflow) {
      setValidationErrors(
        `Schema has too many properties: ${propertiesCount}. Maximum accepted is 500. Please reduce the number of properties.`,
      );
    } else {
      setValidationErrors(
        errorsText(processValidationErrors(getJsonSchemaValidationErrors()), {
          separator: "\n\n",
        }),
      );
    }

    setIsValidSchema(isValid);
  });

  return null;
}

function JsonSchemaEditorProviderRaw({
  jsonSchema: initialJsonSchema,
  setJsonSchema: externalSetJsonSchema,
  computedSchema: providedComputedSchema,
  persistJsonSchemaCallback: persistJsonSchemaCallback,
  children,
}: JsonSchemaEditorProviderProps) {
  // SIMPLIFIED: No more dual state management!
  // jsonSchema is the single source of truth from props
  const jsonSchemaProp = initialJsonSchema!;

  const [validationErrors, setValidationErrors] = useState<string>();
  const [isValidSchema, setIsValidSchema] = useState(true);

  // --- Document is the source of truth; jsonSchema is its byte-faithful projection ---
  const [doc, setDoc] = useState<SchemaDocument>(() =>
    fromJsonSchema(jsonSchemaProp),
  );
  const syncedSignatureRef = useRef(schemaSignature(jsonSchemaProp));

  // Re-import only when the controlled prop changes from OUTSIDE (not our own
  // echo), so node ids stay stable across edits routed through applyDocOp.
  useEffect(() => {
    const sig = schemaSignature(jsonSchemaProp);
    if (sig !== syncedSignatureRef.current) {
      setDoc(fromJsonSchema(jsonSchemaProp));
      syncedSignatureRef.current = sig;
    }
  }, [jsonSchemaProp]);

  // Stage 0 guarantees toJsonSchema(fromJsonSchema(x)) === x byte-for-byte, so
  // exposing the projection is transparent to every existing reader.
  const jsonSchema = useMemo(
    () => toJsonSchema(doc) as ExtendedJSONSchema7,
    [doc],
  );
  const computedSchema = providedComputedSchema ?? jsonSchema;

  // Track current schema value for comparisons in the legacy setJsonSchema.
  const jsonSchemaRef = useRef(jsonSchema);
  jsonSchemaRef.current = jsonSchema;

  // Latest document, for side-effect-free reads inside applyDocOp.
  const docRef = useRef(doc);
  docRef.current = doc;

  const applyDocOp = useCallback(
    (op: (d: SchemaDocument) => SchemaDocument, persist?: boolean) => {
      const prev = docRef.current;
      const next = op(prev);
      if (next === prev) return;
      docRef.current = next; // keep ref current for sequential calls in one tick
      setDoc(next);
      const schema = toJsonSchema(next) as ExtendedJSONSchema7;
      syncedSignatureRef.current = schemaSignature(schema);
      if (externalSetJsonSchema) externalSetJsonSchema(schema);
      if ((persist ?? true) && persistJsonSchemaCallback) {
        void persistJsonSchemaCallback(schema);
      }
    },
    [externalSetJsonSchema, persistJsonSchemaCallback],
  );

  // Helper to check if property order has changed (recursively)
  const hasPropertyOrderChanged = useCallback(
    (oldSchema: any, newSchema: any): boolean => {

      if (!oldSchema || !newSchema) {
        return false;
      }
      if (typeof oldSchema !== "object" || typeof newSchema !== "object") {
        return false;
      }

      // Check if properties object exists and if the order of keys is different
      if (oldSchema.properties && newSchema.properties) {
        const oldKeys = Object.keys(oldSchema.properties);
        const newKeys = Object.keys(newSchema.properties);

        // If keys are in different order, property order changed
        if (oldKeys.length === newKeys.length) {
          for (let i = 0; i < oldKeys.length; i++) {
            if (oldKeys[i] !== newKeys[i]) {
              return true;
            }
          }
        } else {
        }

        // Recursively check nested objects and definitions
        for (const key of oldKeys) {
          if (
            newSchema.properties[key] &&
            hasPropertyOrderChanged(
              oldSchema.properties[key],
              newSchema.properties[key],
            )
          ) {
            return true;
          }
        }
      } else {
      }

      // Check $defs as well
      if (oldSchema.$defs && newSchema.$defs) {
        const oldDefKeys = Object.keys(oldSchema.$defs);
        for (const defKey of oldDefKeys) {
          if (
            newSchema.$defs[defKey] &&
            hasPropertyOrderChanged(
              oldSchema.$defs[defKey],
              newSchema.$defs[defKey],
            )
          ) {
            return true;
          }
        }
      }

      return false;
    },
    [],
  );

  // SIMPLIFIED: Single-pass setJsonSchema for controlled mode
  const setJsonSchema = useCallback(
    async (
      value: React.SetStateAction<ExtendedJSONSchema7>,
      persist?: boolean,
    ): Promise<void> => {
      if (process.env.NODE_ENV !== "production") {
      }

      // Resolve value once
      const newValue =
        typeof value === "function" ? value(jsonSchemaRef.current) : value;

      // Check if anything changed (values or property order)
      const orderChanged = hasPropertyOrderChanged(
        jsonSchemaRef.current,
        newValue,
      );
      const valuesChanged = !isEqual(jsonSchemaRef.current, newValue);


      // Skip if nothing changed
      if (!valuesChanged && !orderChanged) {
        // Still persist if explicitly requested (e.g., final chunk in streaming)
        if ((persist ?? true) && persistJsonSchemaCallback) {
          await persistJsonSchemaCallback(newValue);
        }
        return;
      }


      // For controlled mode: call external setter if provided
      if (externalSetJsonSchema) {
        externalSetJsonSchema(newValue);
      }

      // Always persist (triggers optimistic update in parent)
      if ((persist ?? true) && persistJsonSchemaCallback) {
        await persistJsonSchemaCallback(newValue);
      }

    },
    [externalSetJsonSchema, persistJsonSchemaCallback, hasPropertyOrderChanged],
  );

  // Enhanced function to count total properties in the schema (including nested, $ref and $defs)
  const countSchemaProperties = useCallback(
    (schema?: ExtendedJSONSchema7): number => {
      if (!schema || typeof schema !== "object") return 0;

      // Track processed paths to avoid infinite recursion from circular references
      // but still count each reference occurrence
      // const processedPaths = new Set<string>(); <-- REMOVED

      // Function to count properties in a schema node
      const countProperties = (
        node: ExtendedJSONSchema7,
        path: string = "",
      ): number => {
        if (!node || typeof node !== "object") return 0;

        // Prevent infinite recursion by tracking unique paths
        // if (processedPaths.has(path) && path !== '') { <-- REMOVED
        //   return 0;
        // }
        // if (path !== '') {
        //  processedPaths.add(path); <-- REMOVED
        // }

        let count = 0;

        // Handle $ref references
        if (node.$ref && typeof node.$ref === "string") {
          // Parse the reference path
          if (node.$ref.startsWith("#/")) {
            const refPath = node.$ref.substring(2).split("/");

            // Navigate to the referenced schema
            let refSchema: any = schema; // Start search from root schema
            for (const segment of refPath) {
              if (refSchema && typeof refSchema === "object") {
                refSchema = (refSchema as Record<string, any>)[segment];
              } else {
                refSchema = undefined;
                break;
              }
            }

            if (refSchema) {
              // Count properties in the referenced schema
              // Pass the *original* schema as the root for subsequent $ref lookups
              count += countProperties(
                refSchema as ExtendedJSONSchema7,
                `${path}>${node.$ref}`,
              );
            }
          }
          // DO NOT return here anymore, continue processing the current node
          // return count; <-- REMOVED
        }

        // Count immediate properties in the current object
        if (node.properties && typeof node.properties === "object") {
          count += Object.keys(node.properties).length;

          // Recursively count in nested properties, but DO NOT count special props here anymore
          Object.entries(node.properties).forEach(([propName, propSchema]) => {
            const propSchemaObj = propSchema as ExtendedJSONSchema7;
            // REMOVED special property counting from here
            // if (propSchemaObj["X-ReasoningPrompt"] !== undefined && ...)

            // Recursively count properties in nested objects
            count += countProperties(
              propSchemaObj,
              `${path}/properties/${propName}`,
            );
          });
        }

        // Handle arrays with items
        if (node.type === "array" && node.items) {
          if (Array.isArray(node.items)) {
            node.items.forEach((item, index) => {
              count += countProperties(
                item as ExtendedJSONSchema7,
                `${path}/items/${index}`,
              );
            });
          } else {
            count += countProperties(
              node.items as ExtendedJSONSchema7,
              `${path}/items`,
            );
          }
        }

        // Handle composition keywords (allOf, anyOf, oneOf)
        ["allOf", "anyOf", "oneOf"].forEach((keyword) => {
          const compositionArray = (node as Record<string, any>)[keyword];
          if (Array.isArray(compositionArray)) {
            compositionArray.forEach((subSchema: any, index: number) => {
              count += countProperties(
                subSchema as ExtendedJSONSchema7,
                `${path}/${keyword}/${index}`,
              );
            });
          }
        });

        return count;
      };

      // Start counting from the main schema
      const totalCount = countProperties(schema);

      ////console.log("Total properties count:", totalCount);
      return totalCount;
    },
    [],
  );

  // Custom error processing function that creates new ErrorObjects
  const processValidationErrors = useCallback(
    (errors: any[] | null | undefined): any[] => {
      if (!errors || errors.length === 0) return [];

      const processedErrors: any[] = [];
      const processedPropertyNames = new Set<string>();

      for (const error of errors) {
        // Handle pattern errors from propertyNames validation specifically
        if (
          error.keyword === "pattern" &&
          error.schemaPath?.includes("/propertyNames/pattern") &&
          error.data &&
          typeof error.data === "string"
        ) {
          const propertyName = error.data;
          if (!processedPropertyNames.has(propertyName)) {
            processedErrors.push({
              keyword: "propertyNames",
              instancePath: error.instancePath,
              schemaPath: error.schemaPath,
              params: { propertyName },
              message: `Property name "${propertyName}" must not be purely numeric`,
              data: error.data,
              schema: error.schema,
            });
            processedPropertyNames.add(propertyName);
          }
        }
        // Handle legacy propertyNames validation errors
        else if (
          error.keyword === "propertyNames" &&
          error.params?.propertyName
        ) {
          const propertyName = error.params.propertyName;
          if (!processedPropertyNames.has(propertyName)) {
            processedErrors.push({
              keyword: "propertyNames",
              instancePath: error.instancePath,
              schemaPath: error.schemaPath,
              params: { propertyName },
              message: `Property name "${propertyName}" must not be purely numeric`,
              data: error.data,
              schema: error.schema,
            });
            processedPropertyNames.add(propertyName);
          }
        }
        // Handle additionalProperties validation errors
        else if (
          error.keyword === "const" &&
          error.schemaPath?.includes("/additionalProperties/const")
        ) {
          processedErrors.push({
            keyword: "additionalProperties",
            instancePath: error.instancePath,
            schemaPath: error.schemaPath,
            params: error.params,
            message: `\`additionalProperties\` are forbidden, if present they MUST be false.`,
            data: error.data,
            schema: error.schema,
          });
        }
        // Handle other error types normally (but skip pattern errors and additionalProperties errors we've already processed)
        else if (
          error.keyword !== "propertyNames" &&
          !(
            error.keyword === "pattern" &&
            error.schemaPath?.includes("/propertyNames/pattern")
          ) &&
          !(
            error.keyword === "const" &&
            error.schemaPath?.includes("/additionalProperties/const")
          )
        ) {
          processedErrors.push(error);
        }
      }

      return processedErrors;
    },
    [],
  );

  const jsonSchemaValidationKey = useMemo(
    () => JSON.stringify(jsonSchema),
    [jsonSchema],
  );

  // Memoize context value
  const contextValue = useMemo<JsonSchemaContextType>(() => {
    return {
      jsonSchema,
      setJsonSchema,
      computedSchema,
      isValidSchema,
      validationErrors,
      doc,
      applyDocOp,
    };
  }, [
    jsonSchema,
    setJsonSchema,
    computedSchema,
    isValidSchema,
    validationErrors,
    doc,
    applyDocOp,
  ]);

  return (
    <JsonSchemaContext.Provider value={contextValue}>
      <JsonSchemaValidationRunner
        key={jsonSchemaValidationKey}
        jsonSchema={jsonSchema}
        countSchemaProperties={countSchemaProperties}
        processValidationErrors={processValidationErrors}
        setValidationErrors={setValidationErrors}
        setIsValidSchema={setIsValidSchema}
      />
      {children}
    </JsonSchemaContext.Provider>
  );
}

// Hook to consume context
export function useJsonSchema() {
  const context = useContext(JsonSchemaContext);
  if (context === undefined) {
    throw new Error("useJsonSchema must be used within a JsonSchemaProvider");
  }
  return context;
}

/** Non-throwing context access — returns undefined outside a provider. Used by
 *  components that opt into Document-routing only when a provider is present. */
export function useJsonSchemaOptional() {
  return useContext(JsonSchemaContext);
}

// Uncontrolled wrapper for backwards compatibility (no props required)
function UncontrolledJsonSchemaProvider({ children }: { children: ReactNode }) {
  const defaultSchema: ExtendedJSONSchema7 = {
    title: "",
    description: "",
    type: "object",
    properties: {},
    required: [],
  };

  const [schema, setSchema] = useState<ExtendedJSONSchema7>(defaultSchema);

  return (
    <JsonSchemaEditorProviderRaw
      jsonSchema={schema}
      setJsonSchema={setSchema}
      computedSchema={schema}
    >
      {children}
    </JsonSchemaEditorProviderRaw>
  );
}

// Smart wrapper: use uncontrolled if no props, otherwise use controlled
export const JsonSchemaEditorProvider = React.memo(
  function JsonSchemaEditorProvider({
    jsonSchema,
    setJsonSchema,
    computedSchema,
    persistJsonSchemaCallback,
    children,
  }: JsonSchemaEditorProviderProps) {
    // If no jsonSchema prop provided, use uncontrolled mode
    if (!jsonSchema && !computedSchema) {
      return (
        <UncontrolledJsonSchemaProvider>
          {children}
        </UncontrolledJsonSchemaProvider>
      );
    }

    // Otherwise use controlled mode
    return (
      <JsonSchemaEditorProviderRaw
        jsonSchema={jsonSchema}
        setJsonSchema={setJsonSchema}
        computedSchema={computedSchema}
        persistJsonSchemaCallback={persistJsonSchemaCallback}
      >
        {children}
      </JsonSchemaEditorProviderRaw>
    );
  },
);
