import type { JSONSchema7 } from "json-schema";

/**
 * The schema editor works with standard JSON Schema (Draft 7). This is a plain
 * alias for `JSONSchema7` — no custom extensions — kept under a single shared
 * name so the editor's many imports stay stable.
 */
export type ExtendedJSONSchema7 = JSONSchema7;
