"use client";

import type { ErrorObject } from "ajv";
import type { JSONSchema7Definition } from "json-schema";

import {
  errorsText,
  getJsonSchemaValidationErrors,
  validateJsonSchema,
} from "@/components/schema-editor/schema-validation";
import type {
  ExtendedJSONSchema7,
  SchemaValidationIssue,
  SchemaValidationResult,
} from "@/components/schema-editor/schema-builder-types";
import { decodeJsonPointerSegment } from "@/components/schema-editor/document/json-pointer";

const PROPERTY_LIMIT = 500;

const SCHEMA_VALUE_KEYS = [
  "additionalItems",
  "additionalProperties",
  "contains",
  "else",
  "if",
  "not",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
] as const;

const SCHEMA_MAP_KEYS = [
  "dependentSchemas",
  "dependencies",
  "patternProperties",
] as const;

export function validateProjectedSchema(
  schema: ExtendedJSONSchema7,
): SchemaValidationResult {
  const propertyCount = countSchemaProperties(schema);
  const isPropertyLimitExceeded = propertyCount > PROPERTY_LIMIT;
  const ajvValid = validateJsonSchema(schema);
  const ajvErrors = processValidationErrors(getJsonSchemaValidationErrors());
  const errors = ajvErrors.map(errorToIssue);

  if (isPropertyLimitExceeded) {
    errors.unshift({
      code: "property_limit_exceeded",
      path: "",
      message: `Schema has too many properties: ${propertyCount}. Maximum accepted is ${PROPERTY_LIMIT}. Please reduce the number of properties.`,
    });
  }

  return {
    isValid: ajvValid && !isPropertyLimitExceeded,
    errors,
    propertyCount,
    isPropertyLimitExceeded,
  };
}

export function validationErrorsText(
  validation: SchemaValidationResult,
): string | undefined {
  if (validation.isValid) return undefined;
  return validation.errors.map((issue) => issue.message).join("\n\n");
}

export function countSchemaProperties(schema?: ExtendedJSONSchema7): number {
  if (!schema || typeof schema !== "object") return 0;

  const resolveLocalRef = (ref: string): ExtendedJSONSchema7 | undefined => {
    if (!ref.startsWith("#/")) return undefined;

    const segments = ref
      .substring(2)
      .split("/")
      .map(decodeJsonPointerSegment);
    let refSchema: unknown = schema;
    for (const segment of segments) {
      if (refSchema && typeof refSchema === "object") {
        const record = refSchema as Record<string, unknown>;
        if (!Object.prototype.hasOwnProperty.call(record, segment)) {
          return undefined;
        }
        refSchema = record[segment];
      } else {
        return undefined;
      }
    }

    return refSchema && typeof refSchema === "object"
      ? (refSchema as ExtendedJSONSchema7)
      : undefined;
  };

  const countProperties = (
    node: ExtendedJSONSchema7,
    path: string = "",
    activeSchemas: Set<ExtendedJSONSchema7> = new Set(),
  ): number => {
    if (!node || typeof node !== "object") return 0;

    let count = 0;

    if (node.$ref && typeof node.$ref === "string") {
      const refSchema = resolveLocalRef(node.$ref);
      if (refSchema && !activeSchemas.has(refSchema)) {
        count += countProperties(
          refSchema,
          `${path}>${node.$ref}`,
          new Set([...activeSchemas, refSchema]),
        );
      }
    }

    if (node.properties && typeof node.properties === "object") {
      count += Object.keys(node.properties).length;
      Object.entries(node.properties).forEach(([propertyName, propSchema]) => {
        count += countProperties(
          propSchema as ExtendedJSONSchema7,
          `${path}/properties/${propertyName}`,
          activeSchemas,
        );
      });
    }

    if (node.items) {
      if (Array.isArray(node.items)) {
        node.items.forEach((item, index) => {
          count += countProperties(
            item as ExtendedJSONSchema7,
            `${path}/items/${index}`,
            activeSchemas,
          );
        });
      } else {
        count += countProperties(
          node.items as ExtendedJSONSchema7,
          `${path}/items`,
          activeSchemas,
        );
      }
    }

    const record = node as Record<string, unknown>;
    if (Array.isArray(record.prefixItems)) {
      record.prefixItems.forEach((item, index) => {
        count += countProperties(
          item as ExtendedJSONSchema7,
          `${path}/prefixItems/${index}`,
          activeSchemas,
        );
      });
    }

    for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
      const compositionArray = record[keyword];
      if (Array.isArray(compositionArray)) {
        compositionArray.forEach((subSchema, index) => {
          count += countProperties(
            subSchema as ExtendedJSONSchema7,
            `${path}/${keyword}/${index}`,
            activeSchemas,
          );
        });
      }
    }

    for (const keyword of SCHEMA_VALUE_KEYS) {
      const value = record[keyword];
      if (isSchemaObject(value)) {
        count += countProperties(
          value as ExtendedJSONSchema7,
          `${path}/${keyword}`,
          activeSchemas,
        );
      }
    }

    for (const keyword of SCHEMA_MAP_KEYS) {
      const value = record[keyword];
      if (!isSchemaObject(value)) continue;

      for (const [name, child] of Object.entries(value)) {
        count += countProperties(
          child as ExtendedJSONSchema7,
          `${path}/${keyword}/${name}`,
          activeSchemas,
        );
      }
    }

    return count;
  };

  return countProperties(schema);
}

function isSchemaObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function processValidationErrors(
  errors: ErrorObject[] | null | undefined,
): ErrorObject[] {
  if (!errors || errors.length === 0) return [];

  const processedErrors: ErrorObject[] = [];
  const processedPropertyNames = new Set<string>();

  for (const error of errors) {
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
    } else if (
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
    } else if (
      error.keyword === "const" &&
      error.schemaPath?.includes("/additionalProperties/const")
    ) {
      processedErrors.push({
        keyword: "additionalProperties",
        instancePath: error.instancePath,
        schemaPath: error.schemaPath,
        params: error.params,
        message: "`additionalProperties` are forbidden, if present they MUST be false.",
        data: error.data,
        schema: error.schema,
      });
    } else if (
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
}

function errorToIssue(error: ErrorObject): SchemaValidationIssue {
  if (error.keyword === "propertyNames") {
    return {
      code: "numeric_property_name",
      path: error.instancePath,
      message:
        error.message ??
        `Property name "${String(error.params?.propertyName ?? "")}" must not be purely numeric`,
      source: error,
    };
  }

  if (error.keyword === "additionalProperties") {
    return {
      code: "additional_properties_not_false",
      path: error.instancePath,
      message:
        error.message ??
        "`additionalProperties` are forbidden, if present they MUST be false.",
      source: error,
    };
  }

  return {
    code: "invalid_schema",
    path: error.instancePath,
    message:
      error.message ??
      errorsText([error], {
        separator: "\n\n",
      }),
    source: error,
  };
}

export function isJsonSchemaDefinition(
  value: unknown,
): value is JSONSchema7Definition {
  return (
    typeof value === "boolean" ||
    (typeof value === "object" && value !== null)
  );
}
