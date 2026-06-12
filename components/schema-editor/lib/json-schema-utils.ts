import type { JSONSchema7Definition } from "json-schema";
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";

// Pydantic reserved names that actually break model creation
const PYDANTIC_RESERVED = [
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
 * Unwrap a nullable `anyOf` node (e.g. `{ anyOf: [<schema>, { type: "null" }] }`)
 * down to its underlying non-null schema so it can be inspected directly.
 */
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
