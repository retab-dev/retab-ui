"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { convertSchemaToLayout } from "@/components/schema-editor/lib/layout";
import {
  errorsText,
  getJsonSchemaValidationErrors,
  validateJsonSchema,
} from "@/components/schema-editor/schema-validation";
import { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { isEqual } from "lodash";
import { useMountEffect } from "@/components/schema-editor/lib/use-mount-effect";

interface JsonSchemaContextType {
  jsonSchema: ExtendedJSONSchema7;
  setJsonSchema: (
    value: React.SetStateAction<ExtendedJSONSchema7>,
    persist?: boolean,
  ) => Promise<void>;
  computedSchema: ExtendedJSONSchema7;
  isValidSchema: boolean;
  validationErrors?: string;
  layoutSchema: any;
  setLayoutSchema: React.Dispatch<React.SetStateAction<any>>;
}

const JsonSchemaContext = createContext<JsonSchemaContextType | undefined>(
  undefined,
);

interface JsonSchemaEditorProviderProps {
  jsonSchema?: ExtendedJSONSchema7;
  setJsonSchema?: React.Dispatch<React.SetStateAction<ExtendedJSONSchema7>>;
  computedSchema?: ExtendedJSONSchema7;
  layoutSchema?: any;
  persistJsonSchemaCallback?: (newSchema: ExtendedJSONSchema7) => Promise<void>;
  children: ReactNode;
}

function JsonSchemaValidationRunner({
  jsonSchema,
  countSchemaProperties,
  processValidationErrors,
  setValidationErrors,
  setLayoutSchema,
  setIsValidSchema,
}: {
  jsonSchema: ExtendedJSONSchema7;
  countSchemaProperties: (schema?: ExtendedJSONSchema7) => number;
  processValidationErrors: (errors: any[] | null | undefined) => any[];
  setValidationErrors: React.Dispatch<React.SetStateAction<string | undefined>>;
  setLayoutSchema: React.Dispatch<React.SetStateAction<any>>;
  setIsValidSchema: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  useMountEffect(() => {
    const propertiesCount = countSchemaProperties(jsonSchema);
    const propertiesOverflow = propertiesCount > 500;
    const isValid = validateJsonSchema(jsonSchema) && !propertiesOverflow;

    if (isValid) {
      setValidationErrors(undefined);
      setLayoutSchema(convertSchemaToLayout(jsonSchema));
    } else if (propertiesOverflow) {
      setValidationErrors(
        `Schema has too many properties: ${propertiesCount}. Maximum accepted is 500. Please reduce the number of properties.`,
      );
      setLayoutSchema(convertSchemaToLayout(jsonSchema));
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
  layoutSchema: initialLayoutSchema,
  persistJsonSchemaCallback: persistJsonSchemaCallback,
  children,
}: JsonSchemaEditorProviderProps) {
  // SIMPLIFIED: No more dual state management!
  // jsonSchema is the single source of truth from props
  const jsonSchema = initialJsonSchema!;
  const computedSchema = providedComputedSchema ?? initialJsonSchema!;

  const [validationErrors, setValidationErrors] = useState<string>();
  const [isValidSchema, setIsValidSchema] = useState(true);
  const [internalLayoutSchema, setInternalLayoutSchema] = useState<any>(
    initialLayoutSchema || convertSchemaToLayout(jsonSchema),
  );

  // Use ref to track current schema value for comparisons in setJsonSchema
  const jsonSchemaRef = useRef(jsonSchema);
  jsonSchemaRef.current = jsonSchema;

  // Helper to check if property order has changed (recursively)
  const hasPropertyOrderChanged = useCallback(
    (oldSchema: any, newSchema: any): boolean => {
      //console.log("[SCHEMA] hasPropertyOrderChanged CALLED");
      //console.log("[SCHEMA] oldSchema keys:", Object.keys(oldSchema?.properties || {}));
      //console.log("[SCHEMA] newSchema keys:", Object.keys(newSchema?.properties || {}));

      if (!oldSchema || !newSchema) {
        //console.log("[SCHEMA] Early return: schema is null");
        return false;
      }
      if (typeof oldSchema !== "object" || typeof newSchema !== "object") {
        //console.log("[SCHEMA] Early return: not an object");
        return false;
      }

      // Check if properties object exists and if the order of keys is different
      if (oldSchema.properties && newSchema.properties) {
        const oldKeys = Object.keys(oldSchema.properties);
        const newKeys = Object.keys(newSchema.properties);
        //console.log("[SCHEMA] Checking property order at root level");
        //console.log("[SCHEMA] Old keys:", oldKeys);
        //console.log("[SCHEMA] New keys:", newKeys);

        // If keys are in different order, property order changed
        if (oldKeys.length === newKeys.length) {
          //console.log("[SCHEMA] Same number of keys, comparing order...");
          for (let i = 0; i < oldKeys.length; i++) {
            if (oldKeys[i] !== newKeys[i]) {
              //console.log(`[SCHEMA] Property order CHANGED at index ${i}: old="${oldKeys[i]}" vs new="${newKeys[i]}"`);
              return true;
            }
          }
          //console.log("[SCHEMA] All keys in same order");
        } else {
          //console.log("[SCHEMA] Different number of keys");
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
        //console.log("[SCHEMA] No properties to compare");
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

      //console.log("[SCHEMA] hasPropertyOrderChanged returning FALSE - no changes detected");
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
      //console.log("[SCHEMA] setJsonSchema called with persist=", persist);
      if (process.env.NODE_ENV !== "production") {
        //console.log("[SCHEMA] value", value);
      }

      // Resolve value once
      const newValue =
        typeof value === "function" ? value(jsonSchemaRef.current) : value;
      //console.log("[SCHEMA] Resolved value properties:", Object.keys(newValue?.properties || {}));

      // Check if anything changed (values or property order)
      const orderChanged = hasPropertyOrderChanged(
        jsonSchemaRef.current,
        newValue,
      );
      const valuesChanged = !isEqual(jsonSchemaRef.current, newValue);

      //console.log("[SCHEMA] orderChanged:", orderChanged, "valuesChanged:", valuesChanged);

      // Skip if nothing changed
      if (!valuesChanged && !orderChanged) {
        //console.log("[SCHEMA] No changes detected, skipping");
        // Still persist if explicitly requested (e.g., final chunk in streaming)
        if ((persist ?? true) && persistJsonSchemaCallback) {
          //console.log("[SCHEMA] Persisting unchanged value");
          await persistJsonSchemaCallback(newValue);
        }
        return;
      }

      //console.log("[SCHEMA] Changes detected. Old properties:", Object.keys(jsonSchemaRef.current?.properties || {}), "New properties:", Object.keys(newValue?.properties || {}));

      // For controlled mode: call external setter if provided
      if (externalSetJsonSchema) {
        //console.log("[SCHEMA] Using external setJsonSchema (controlled mode)");
        externalSetJsonSchema(newValue);
      }

      // Always persist (triggers optimistic update in parent)
      if ((persist ?? true) && persistJsonSchemaCallback) {
        //console.log("[SCHEMA] Persisting new value");
        await persistJsonSchemaCallback(newValue);
      }

      //console.log("[SCHEMA] setJsonSchema completed");
    },
    [externalSetJsonSchema, persistJsonSchemaCallback, hasPropertyOrderChanged],
  );

  // Same for layout
  const layoutSchema = internalLayoutSchema;
  const setLayoutSchema = setInternalLayoutSchema;

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

        // Count special properties directly on the current node
        if (
          node["X-Reasoning"] === true ||
          (node["X-ReasoningPrompt"] !== undefined &&
            node["X-ReasoningPrompt"] !== null &&
            node["X-ReasoningPrompt"] !== "")
        ) {
          count += 1;
        }

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
    //console.log("[SCHEMA] Context value recomputed. computedSchema keys:", Object.keys(computedSchema?.properties || {}));
    return {
      jsonSchema,
      setJsonSchema,
      computedSchema,
      isValidSchema,
      validationErrors,
      layoutSchema,
      setLayoutSchema,
    };
  }, [
    jsonSchema,
    setJsonSchema,
    computedSchema,
    isValidSchema,
    validationErrors,
    layoutSchema,
    setLayoutSchema,
  ]);

  return (
    <JsonSchemaContext.Provider value={contextValue}>
      <JsonSchemaValidationRunner
        key={jsonSchemaValidationKey}
        jsonSchema={jsonSchema}
        countSchemaProperties={countSchemaProperties}
        processValidationErrors={processValidationErrors}
        setValidationErrors={setValidationErrors}
        setLayoutSchema={setLayoutSchema}
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
    layoutSchema,
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
        layoutSchema={layoutSchema}
        persistJsonSchemaCallback={persistJsonSchemaCallback}
      >
        {children}
      </JsonSchemaEditorProviderRaw>
    );
  },
);
