"use client";

import Ajv, { ErrorObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import ajvErrors from "ajv-errors";
import draft7MetaSchema from "ajv/dist/refs/json-schema-draft-07.json";

let ajvSingleton: Ajv | null = null;
let validateJsonSchemaSingleton: ValidateFunction | null = null;

function injectConstraints(schema: any): void {
  if (schema && typeof schema === "object") {
    if (schema.type === "object") {
      schema.propertyNames = {
        type: "string",
        pattern: "^(?![-+]?(\\d+(\\.\\d*)?|\\.\\d+)$).+",
      };
    }

    for (const key of Object.keys(schema)) {
      if (typeof schema[key] === "object") {
        injectConstraints(schema[key]);
      }
    }
  }
}

function buildEnrichedDraft7MetaSchema(): Record<string, any> {
  const schema = structuredClone(draft7MetaSchema) as Record<string, any>;
  schema.$id = "http://retab-json-schema.org/draft-07/enriched-schema#";
  injectConstraints(schema);

  if (!schema.properties || typeof schema.properties !== "object") {
    schema.properties = {};
  }

  schema.properties.additionalProperties = {
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
    addFormats(ajvSingleton);
    ajvErrors(ajvSingleton);
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
