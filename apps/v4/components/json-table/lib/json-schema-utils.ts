import { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { ExtendedJSONSchema7 } from "@/components/json-table/lib/json-schema-types";
import { AnySchema, ErrorObject } from "ajv";
import { validateRuntimeSchema } from "@/components/schema-editor/lib/json-schema-runtime-validation";

// Pydantic reserved names that actually break model creation
export const PYDANTIC_RESERVED = [
  "__root__",
  "model_config",
  "model_post_init",
  "model_validate",
  "model_dump",
];

// Generic name validator for Pydantic compatible field and definition names
export function validateName(
  name: string,
  existingNames: string[] = [],
  currentName?: string,
  entityType: string = "name",
): string | null {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(name)) {
    return "Name must start with a letter or underscore, contain only letters, numbers, or underscores, and be at most 64 characters long";
  }

  if (PYDANTIC_RESERVED.includes(name)) {
    return `"${name}" is a Pydantic reserved name`;
  }

  const namesToCheck = currentName
    ? existingNames.filter((n) => n.toLowerCase() !== currentName.toLowerCase())
    : existingNames;

  if (namesToCheck.some((n) => n.toLowerCase() === name.toLowerCase())) {
    return `A ${entityType} with the name "${name}" already exists (names are case-insensitive)`;
  }

  return null;
}

/**
 * Utility function to recursively strip reasoning fields from extraction data.
 * Removes all keys starting with "reasoning___".
 */
export function stripReasoningFields(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => stripReasoningFields(item));
  } else if (data !== null && typeof data === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (!key.startsWith("reasoning___")) {
        cleaned[key] = stripReasoningFields(value);
      }
    }
    return cleaned;
  }
  return data;
}

export interface DataValidationResult {
  isValid: boolean;
  errors: ErrorObject[] | null;
}

/**
 * Validates a JSON object against a JSON Schema.
 *
 * @param data - The JSON data to validate
 * @param schema - The JSON Schema object
 * @param stripReasoning - Whether to strip reasoning fields before validation (default: true)
 * @returns DataValidationResult - Contains isValid boolean and any validation errors
 */
export function validateDataAgainstSchema(
  data: unknown,
  schema: AnySchema,
  stripReasoning: boolean = true,
): DataValidationResult {
  try {
    // Strip reasoning fields if requested
    const dataToValidate = stripReasoning ? stripReasoningFields(data) : data;
    const result = validateRuntimeSchema(schema, dataToValidate);

    return {
      isValid: result.isValid,
      errors: result.errors,
    };
  } catch (error) {
    console.error("Schema compilation error:", error);
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

/**
 * Format AJV validation errors into a human-readable string with detailed information.
 */
export function formatValidationErrors(errors: ErrorObject[] | null): string {
  if (!errors || errors.length === 0) return "";

  return errors
    .map((err, index) => {
      const path = err.instancePath || "(root)";
      const lines: string[] = [];

      // Error header with index
      lines.push(`[${index + 1}] ${path}`);

      // Main error message
      lines.push(`   → ${err.message || "Unknown error"}`);

      // Add details based on error keyword
      switch (err.keyword) {
        case "type":
          if (err.params?.type) {
            lines.push(`   Expected type: ${err.params.type}`);
          }
          break;
        case "required":
          if (err.params?.missingProperty) {
            lines.push(`   Missing property: "${err.params.missingProperty}"`);
          }
          break;
        case "additionalProperties":
          if (err.params?.additionalProperty) {
            lines.push(
              `   Unexpected property: "${err.params.additionalProperty}"`,
            );
          }
          break;
        case "enum":
          if (err.params?.allowedValues) {
            lines.push(
              `   Allowed values: ${JSON.stringify(err.params.allowedValues)}`,
            );
          }
          break;
        case "minimum":
        case "maximum":
        case "exclusiveMinimum":
        case "exclusiveMaximum":
          if (err.params?.limit !== undefined) {
            lines.push(`   Limit: ${err.params.limit}`);
          }
          break;
        case "minLength":
        case "maxLength":
          if (err.params?.limit !== undefined) {
            lines.push(`   Length limit: ${err.params.limit}`);
          }
          break;
        case "pattern":
          if (err.params?.pattern) {
            lines.push(`   Pattern: ${err.params.pattern}`);
          }
          break;
        case "format":
          if (err.params?.format) {
            lines.push(`   Expected format: ${err.params.format}`);
          }
          break;
        case "minItems":
        case "maxItems":
          if (err.params?.limit !== undefined) {
            lines.push(`   Items limit: ${err.params.limit}`);
          }
          break;
        case "const":
          if (err.params?.allowedValue !== undefined) {
            lines.push(
              `   Expected value: ${JSON.stringify(err.params.allowedValue)}`,
            );
          }
          break;
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

export function emptyFromSchema(schema: any): any {
  if (schema.type === "object" && schema.properties) {
    const result: Record<string, any> = {};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      result[key] = emptyFromSchema(propSchema);
    }
    return result;
  } else if (schema.type === "array") {
    return [];
  } else {
    return null;
  }
}

export function isValidProperty(
  p: JSONSchema7Definition | undefined,
): p is JSONSchema7 {
  return (
    typeof p === "object" &&
    p !== null &&
    ("type" in p || "$ref" in p || "anyOf" in p || "oneOf" in p || "allOf" in p)
  );
}

export function resolveSchemaReference(
  refSchema: JSONSchema7Definition,
  schema: JSONSchema7,
): JSONSchema7 {
  if (
    typeof refSchema !== "object" ||
    refSchema === null ||
    !("$ref" in refSchema)
  ) {
    throw new Error("Schema is not a valid reference schema.");
  }

  const ref = refSchema.$ref;
  if (!ref || !ref.startsWith("#/")) {
    throw new Error("Only internal references are supported.");
  }

  const path = ref.substring(2).split("/");
  let resolved: any = schema;
  for (const part of path) {
    resolved = resolved[part];
    if (resolved === undefined) {
      throw new Error(`Unable to resolve schema reference: ${ref}`);
    }
  }

  return resolved as JSONSchema7;
}

export function isObjectProperty(
  property: JSONSchema7Definition,
  schema: JSONSchema7,
): boolean {
  if (typeof property !== "object" || property === null) return false;

  // Direct object type
  if (
    property.type === "object" ||
    (property.properties && Object.keys(property.properties).length > 0)
  ) {
    return true;
  }

  // Reference to object type
  if ("$ref" in property) {
    const resolvedProperty = resolveSchemaReference(property, schema);
    // Recursively check if the resolved schema is object
    return isObjectProperty(resolvedProperty, schema);
  }

  return false;
}

// Helper function to create empty objects from schema (doesn't use hooks)
export const initializeEmptyObject = (
  property: JSONSchema7,
  schema: JSONSchema7,
): any => {
  // If it's a reference, resolve it first
  if ("$ref" in property) {
    try {
      property = resolveSchemaReference(property, schema);
    } catch {
      return {};
    }
  }

  if (!property.properties) return {};

  // Create an empty object with all property keys initialized
  return Object.keys(property.properties).reduce(
    (obj, key) => {
      const propDef = property.properties![key];

      // Recursively initialize nested objects
      if (typeof propDef === "object" && propDef !== null) {
        if (propDef.type === "object" || "$ref" in propDef) {
          obj[key] = initializeEmptyObject(
            "$ref" in propDef
              ? resolveSchemaReference(propDef, schema)
              : propDef,
            schema,
          );
        } else if (propDef.type === "boolean") {
          obj[key] = false;
        } else if (propDef.type === "number") {
          obj[key] = 0;
        } else {
          obj[key] = "";
        }
      } else {
        obj[key] = "";
      }

      return obj as Record<string, any>;
    },
    {} as Record<string, any>,
  );
};

export function unflattenToGrid(flatObj: Record<string, any>) {
  const result: any[] = [];
  Object.keys(flatObj).forEach((flatKey) => {
    const value = flatObj[flatKey];
    const keys = flatKey.split(".");
    let current: any = result;

    keys.forEach((key, index) => {
      // Check if the key is a number (array index)
      const _isArrayIndex =
        !isNaN(Number(key)) && Number.isInteger(Number(key));

      // If it's the last key in the path, set the value
      if (index === keys.length - 1) {
        current[key] = value;
        return;
      }

      // Check if the next key is an array index
      const nextKey = keys[index + 1];
      const nextIsArrayIndex =
        !isNaN(Number(nextKey)) && Number.isInteger(Number(nextKey));

      // Create the intermediate object or array if it doesn't exist
      if (nextIsArrayIndex) {
        // Next is array index, so current key needs to point to an array
        if (!current[key] || !Array.isArray(current[key])) {
          current[key] = [];
        }
      } else {
        // Next is object key, so current key needs to point to an object
        if (
          !current[key] ||
          typeof current[key] !== "object" ||
          Array.isArray(current[key])
        ) {
          current[key] = {};
        }
      }

      // Move to the next level
      current = current[key];
    });
  });
  const cleanedRows = result.filter(Boolean);
  const columnsStartIndexes = cleanedRows.flatMap((row) =>
    row.map((subRow: any) =>
      [...subRow].findIndex((cell) => cell !== undefined),
    ),
  );
  const minColumnsStartIndex = Math.min(
    ...columnsStartIndexes.filter((index) => index !== -1),
  );
  const cleanedColums = cleanedRows.flatMap((row) =>
    row.map((subRow: any) => [...subRow].slice(minColumnsStartIndex)),
  );
  return cleanedColums;
}

export function compute_score_from_likelihood_and_dot_notation_path(
  likelihoods: unknown,
  path: string | undefined,
): number {
  // ---------- tiny utility helpers ----------
  const isNumber = (v: unknown): v is number => typeof v === "number";

  const collectNumbers = (v: unknown): number[] => {
    if (isNumber(v)) return [v];
    if (v === null || v === undefined) return [];
    if (Array.isArray(v)) return v.flatMap(collectNumbers);
    if (typeof v === "object") return Object.values(v).flatMap(collectNumbers);
    return [];
  };
  // ------------------------------------------

  // special‑case: empty path ⇒ average of *all* numbers in the structure
  if (!path || path.trim() === "") {
    const nums = collectNumbers(likelihoods);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  }

  const segments = path.split(".");

  /**
   * Depth‑first traversal that respects "*" wildcards.
   * Returns every numeric value that matches the path.
   */
  const dfs = (node: unknown, idx: number): number[] => {
    if (idx === segments.length) return collectNumbers(node);
    if (node === null || node === undefined) return [];

    const seg = segments[idx];

    // wildcard – iterate over everything at this level
    if (seg === "*") {
      if (Array.isArray(node))
        return node.flatMap((child) => dfs(child, idx + 1));

      if (typeof node === "object")
        return Object.values(node).flatMap((child) => dfs(child, idx + 1));

      return []; // non‑iterable reached with "*"
    }

    // normal segment (object key OR array index)
    const next =
      Array.isArray(node) && !Number.isNaN(Number(seg))
        ? node[Number(seg)]
        : (node as Record<string, unknown>)[seg];

    return dfs(next, idx + 1);
  };

  const numbers = dfs(likelihoods, 0);
  return numbers.length
    ? numbers.reduce((a, b) => a + b, 0) / numbers.length
    : 0;
}

/**
 * Gets a value from a row array using a dot notation path.
 * Supports wildcards (*) to traverse arrays and objects.
 *
 * @param data - The data object to traverse
 * @param path - The dot notation path (e.g., "items.0.name" or "items.*.name")
 * @returns The value at the specified path, or undefined if not found
 */
export function get_value_from_row_array_and_dot_notation_path(
  data: unknown,
  path: string | undefined,
): unknown {
  // Special case: empty path
  if (!path || path.trim() === "") {
    return data;
  }

  const segments = path.split(".");

  //console.log("Getting value from row array and dot notation path", path)

  /**
   * Depth‑first traversal that respects "*" wildcards.
   * Returns the first value that matches the path.
   */
  const dfs = (node: unknown, idx: number): unknown => {
    if (idx === segments.length) return node;
    if (node === null || node === undefined) return undefined;

    const seg = segments[idx];

    // Wildcard – iterate over everything at this level
    if (seg === "*") {
      if (Array.isArray(node) && node.length > 0) {
        // For arrays, return the first matching value
        for (const child of node) {
          const result = dfs(child, idx + 1);
          if (result !== undefined) return result;
        }
        return undefined;
      }

      if (typeof node === "object") {
        // For objects, return the first matching value
        for (const child of Object.values(node)) {
          const result = dfs(child, idx + 1);
          if (result !== undefined) return result;
        }
        return undefined;
      }

      return undefined; // Non‑iterable reached with "*"
    }

    // Normal segment (object key OR array index)
    const next =
      Array.isArray(node) && !Number.isNaN(Number(seg))
        ? node[Number(seg)]
        : (node as Record<string, unknown>)[seg];

    return dfs(next, idx + 1);
  };

  return dfs(data, 0);
}

export function getConsensusData(data: any[], path: string): any[] {
  return data
    ?.map((item) => {
      const consensusPath = item?.key_mapping?.[path] ?? path;
      if (!consensusPath) {
        return undefined;
      }
      const reasoningPath =
        consensusPath && consensusPath.split(".").length > 1
          ? consensusPath.split(".").slice(0, -1).join(".") +
            ".reasoning___" +
            consensusPath.split(".").slice(-1)[0]
          : "reasoning___" + consensusPath;
      return {
        data: get_value_from_row_array_and_dot_notation_path(
          item.data,
          consensusPath,
        ),
        field_locations: item.field_locations?.[consensusPath] || [],
        reasoning: get_value_from_row_array_and_dot_notation_path(
          item.data,
          reasoningPath,
        ),
      };
    })
    .filter((item) => item) as any[];
}

export function getEffectiveNode(
  node: ExtendedJSONSchema7,
): ExtendedJSONSchema7 {
  if (node.anyOf && Array.isArray(node.anyOf)) {
    const nonNull = node.anyOf.find(
      (b: JSONSchema7Definition) =>
        typeof b === "object" && (b.type !== "null" || b.$ref),
    );
    return nonNull && typeof nonNull === "object" ? nonNull : node;
  }
  return node;
}

/**
 * Resolve a node ($ref and nullable anyOf) so that we can inspect it
 * safely.  The function is internal to `countArrayFieldsRecursive`.
 */
function _resolveNode(
  node: ExtendedJSONSchema7,
  root: ExtendedJSONSchema7,
): ExtendedJSONSchema7 {
  // 1‑ $ref
  while (node.$ref) {
    try {
      node = resolveSchemaReference(node, root) as ExtendedJSONSchema7;
    } catch {
      break; // unresolved => keep original
    }
  }

  // 2‑ unwrap nullable anyOf
  return getEffectiveNode(node);
}

/**
 * Return true when the schema node actually represents an array.
 */
function _isArray(node: ExtendedJSONSchema7): boolean {
  const t = node.type;
  return (
    t === "array" ||
    (Array.isArray(t) && t.includes("array")) || // union ["array","null"]
    (t === undefined && node.items !== undefined) // author omitted "type"
  );
}

/**
 * Recursively walk a JSON‑Schema document and count array fields.
 *
 * @param node    Current node (start with root)
 * @param root    Root schema (needed to resolve $ref)
 * @param path    Dot‑notation path for the current node
 * @param stopAt  Path prefixes that should be ignored
 */
function _walk(
  node: ExtendedJSONSchema7,
  root: ExtendedJSONSchema7,
  path: string,
  stopAt: string[],
): number {
  // stop‑fold check
  if (stopAt.some((p) => path.startsWith(p))) return 0;

  // we always work on the *resolved* node
  const n = _resolveNode(node, root);

  // 1‑  count this node itself (if array)
  let count = _isArray(n) ? 1 : 0;

  // 2‑  recurse into object properties
  if (n.type === "object" && n.properties) {
    for (const [key, child] of Object.entries(n.properties)) {
      if (isValidProperty(child)) {
        count += _walk(
          child as ExtendedJSONSchema7,
          root,
          `${path}${path ? "." : ""}${key}`,
          stopAt,
        );
      }
    }
  }

  // 3‑  recurse into array items (for nested arrays → delete column too)
  if (n.type === "array" && n.items && !Array.isArray(n.items)) {
    count += _walk(n.items as ExtendedJSONSchema7, root, `${path}.*`, stopAt);
  }

  return count;
}

/**
 * Public, *pure* API:  How many array‑type fields are in `schema`?
 *
 * @param schema  Full JSON‑Schema document (root)
 * @param stopAt  Optional list of path prefixes you want to fold/ignore
 */
export function countArrayFields(
  schema: ExtendedJSONSchema7 | null,
  stopAt: string[] = [],
): number {
  if (!schema) return 0;
  return _walk(schema, schema, "", stopAt);
}

/**
 * Check if a schema is an array schema
 * @param schema - The schema to check
 * @returns True if the schema is an array schema, false otherwise
 */

export function isArraySchema(schema: JSONSchema7): boolean {
  return (
    schema.type === "object" &&
    schema.properties !== undefined &&
    Object.keys(schema.properties).length === 1 &&
    (schema.properties[Object.keys(schema.properties)[0]] as JSONSchema7)
      ?.type === "array"
  );
}
