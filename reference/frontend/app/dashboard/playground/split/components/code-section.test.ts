import { describe, expect, test } from "bun:test";

import {
  generateCurlCode,
  generateRetabSplitCode,
  generateTypeScriptCode,
} from "./code-section";

const config = {
  model: "retab-small",
  subdocuments: [
    {
      name: "Invoice",
      description: "Invoice pages",
      allow_multiple_instances: true,
    },
    {
      name: "Contract",
      description: "Contract pages",
    },
  ],
};

describe("split playground code generation", () => {
  test("includes allow_multiple_instances when a subdocument allows repeats", () => {
    expect(generateRetabSplitCode(config)).toContain(
      '"allow_multiple_instances": true',
    );
    expect(generateTypeScriptCode(config)).toContain(
      "allow_multiple_instances: true",
    );
    expect(generateCurlCode(config)).toContain(
      '"allow_multiple_instances": true',
    );
  });
});
