"use client";

import Ajv, { AnySchema, ErrorObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

let ajvSingleton: Ajv | null = null;
const validatorCache = new WeakMap<object, ValidateFunction>();

export interface RuntimeSchemaValidationResult {
  isValid: boolean;
  errors: ErrorObject[] | null;
}

function getAjv(): Ajv {
  if (!ajvSingleton) {
    ajvSingleton = new Ajv({ allErrors: true, strict: false });
    addFormats(ajvSingleton);
  }

  return ajvSingleton;
}

function getValidator(schema: AnySchema): ValidateFunction {
  if (schema && typeof schema === "object") {
    const cachedValidator = validatorCache.get(schema as object);
    if (cachedValidator) {
      return cachedValidator;
    }

    const validator = getAjv().compile(schema);
    validatorCache.set(schema as object, validator);
    return validator;
  }

  return getAjv().compile(schema);
}

export function validateRuntimeSchema(
  schema: AnySchema,
  data: unknown,
): RuntimeSchemaValidationResult {
  try {
    const validator = getValidator(schema);
    const isValid = !!validator(data);

    return {
      isValid,
      errors: isValid ? null : (validator.errors ?? null),
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [
        {
          keyword: "compilation",
          instancePath: "",
          schemaPath: "",
          params: {},
          message:
            error instanceof Error
              ? error.message
              : "Unknown schema compilation error",
        },
      ],
    };
  }
}

export function summarizeRuntimeSchemaErrors(
  errors: ErrorObject[] | null,
  limit: number = 3,
): string {
  if (!errors || errors.length === 0) {
    return "";
  }

  return errors
    .slice(0, limit)
    .map((error) => {
      const path = error.instancePath || "root";
      return `${path}: ${error.message}`;
    })
    .join("; ");
}
