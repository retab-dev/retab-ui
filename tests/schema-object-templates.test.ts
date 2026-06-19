import type { JSONSchema7 } from "json-schema";
import { describe, expect, it } from "vitest";

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert";
import { addObjectTemplateDefinitionsToDocument } from "@/components/schema-editor/optional/object-templates/object-template-reference";

describe("schema object templates", () => {
  it("installs template dependencies without emitting dependency metadata", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {},
    });

    const out = toJsonSchema(
      addObjectTemplateDefinitionsToDocument(doc, "Company"),
    );
    const defs = out.$defs as Record<
      string,
      JSONSchema7 & Record<string, unknown>
    >;

    expect(defs.Address).toBeTruthy();
    expect(defs.Company).toBeTruthy();
    expect(defs.Company.deps).toBeUndefined();
  });
});
