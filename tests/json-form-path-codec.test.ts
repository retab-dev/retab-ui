import type { JSONSchema7 } from "json-schema";
import { describe, expect, it } from "vitest";

import {
  decodeJsonFormKey,
  decodeJsonFormValue,
  emptyArrayItemFormValue,
  encodeJsonFormKey,
  encodeJsonFormValue,
  joinJsonFormPath,
  joinJsonSourcePath,
  schemaNeedsJsonFormPathEncoding,
} from "@/components/json-form/path-codec";

describe("json-form path codec", () => {
  it("encodes react-hook-form path metacharacters without changing source paths", () => {
    expect(encodeJsonFormKey(`line.items['0']`)).toBe(
      "line%2Eitems%5B%270%27%5D",
    );
    expect(decodeJsonFormKey("line%2Eitems%5B%270%27%5D")).toBe(
      `line.items['0']`,
    );
    expect(joinJsonFormPath("rows.0", "line.total")).toBe(
      "rows.0.line%2Etotal",
    );
    expect(joinJsonSourcePath("rows.0", "line.total")).toBe(
      "rows.0.line.total",
    );
  });

  it("round-trips static and dynamic object keys through encoded form values", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        "invoice.total": { type: "number" },
        metadata: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      },
    };
    const value = {
      "invoice.total": 12,
      metadata: {
        "bank.name": "Acme",
      },
    };

    expect(schemaNeedsJsonFormPathEncoding(schema)).toBe(true);
    expect(encodeJsonFormValue(schema, value)).toEqual({
      "invoice%2Etotal": 12,
      metadata: {
        "bank%2Ename": "Acme",
      },
    });
    expect(
      decodeJsonFormValue(schema, {
        "invoice%2Etotal": 12,
        metadata: {
          "bank%2Ename": "Acme",
        },
      }),
    ).toEqual(value);
  });

  it("creates encoded empty array items only when item keys need encoding", () => {
    expect(
      emptyArrayItemFormValue({
        type: "object",
        properties: {
          "line.total": { type: "number" },
          note: { type: "string" },
        },
      }),
    ).toEqual({
      "line%2Etotal": undefined,
      note: "",
    });
  });
});
