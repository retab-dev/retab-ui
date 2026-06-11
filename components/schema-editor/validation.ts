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

const PROPERTY_LIMIT = 500;

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

  const countProperties = (
    node: ExtendedJSONSchema7,
    path: string = "",
  ): number => {
    if (!node || typeof node !== "object") return 0;

    let count = 0;

    if (node.$ref && typeof node.$ref === "string") {
      if (node.$ref.startsWith("#/")) {
        const refPath = node.$ref.substring(2).split("/");
        let refSchema: unknown = schema;
        for (const segment of refPath) {
          if (refSchema && typeof refSchema === "object") {
            refSchema = (refSchema as Record<string, unknown>)[segment];
          } else {
            refSchema = undefined;
            break;
          }
        }

        if (refSchema) {
          count += countProperties(
            refSchema as ExtendedJSONSchema7,
            `${path}>${node.$ref}`,
          );
        }
      }
    }

    if (node.properties && typeof node.properties === "object") {
      count += Object.keys(node.properties).length;
      Object.entries(node.properties).forEach(([propName, propSchema]) => {
        count += countProperties(
          propSchema as ExtendedJSONSchema7,
          `${path}/properties/${propName}`,
        );
      });
    }

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

    for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
      const compositionArray = (node as Record<string, unknown>)[keyword];
      if (Array.isArray(compositionArray)) {
        compositionArray.forEach((subSchema, index) => {
          count += countProperties(
            subSchema as ExtendedJSONSchema7,
            `${path}/${keyword}/${index}`,
          );
        });
      }
    }

    return count;
  };

  return countProperties(schema);
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
