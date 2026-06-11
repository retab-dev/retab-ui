import { JSONSchema7, JSONSchema7Definition } from "json-schema";
// Extend JSONSchema7 to include our custom properties
export interface ExtendedJSONSchema7 extends JSONSchema7 {
  "X-ReasoningPrompt"?: string;
  "X-Reasoning"?: boolean;
  "X-ComputedField"?: boolean;
}
