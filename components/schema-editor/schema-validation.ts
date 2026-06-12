"use client";

import Ajv from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import ajvErrors from "ajv-errors";
import draft7MetaSchema from "ajv/dist/refs/json-schema-draft-07.json";

let ajvSingleton: Ajv | null = null;
let validateJsonSchemaSingleton: ValidateFunction | null = null;
type AjvFormatsInstance = Parameters<typeof addFormats>[0];
type AjvErrorsInstance = Parameters<typeof ajvErrors>[0];

function isMutableObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function injectConstraints(schema: unknown): void {
  if (!isMutableObject(schema)) return;

  if (schema.type === "object") {
    schema.propertyNames = {
      type: "string",
      pattern: "^(?![-+]?(\\d+(\\.\\d*)?|\\.\\d+)$).+",
    };
  }

  for (const value of Object.values(schema)) {
    if (isMutableObject(value)) {
      injectConstraints(value);
    }
  }
}

function buildEnrichedDraft7MetaSchema(): Record<string, unknown> {
  const schema = structuredClone(draft7MetaSchema) as Record<string, unknown>;
  schema.$id = "http://retab-json-schema.org/draft-07/enriched-schema#";
  injectConstraints(schema);

  if (!isMutableObject(schema.properties)) {
    schema.properties = {};
  }

  const properties = schema.properties;
  if (!isMutableObject(properties)) return schema;

  properties.additionalProperties = {
    const: false,
  };

  return schema;
}

function getAjv(): Ajv {
  if (!ajvSingleton) {
    ajvSingleton = new Ajv({
      allErrors: true,
      allowUnionTypes: true,
    });
    addFormats(ajvSingleton as unknown as AjvFormatsInstance);
    ajvErrors(ajvSingleton as unknown as AjvErrorsInstance);
  }

  return ajvSingleton;
}

function getValidator(): ValidateFunction {
  if (!validateJsonSchemaSingleton) {
    validateJsonSchemaSingleton = getAjv().compile(
      buildEnrichedDraft7MetaSchema(),
    );
  }

  return validateJsonSchemaSingleton;
}

export function validateJsonSchema(schema: unknown): boolean {
  return !!getValidator()(schema);
}

export function getJsonSchemaValidationErrors(): ErrorObject[] | null {
  return getValidator().errors ?? null;
}

export function errorsText(
  errors?: ErrorObject[] | null,
  options?: { separator?: string; dataVar?: string },
): string {
  return getAjv().errorsText(errors ?? undefined, options);
}
