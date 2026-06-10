import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { apiClient } from "@/app/shared/api/client";
import type { Partition as StoredPartition } from "@/types";

import { resolvePartitionHistorySelection } from "./history-hydration";

function makePartition(
  overrides: Partial<StoredPartition> = {},
): StoredPartition {
  return {
    id: "prtn_123",
    file: {
      id: "file_from_list",
      filename: "list.pdf",
      mime_type: "application/pdf",
    },
    model: "retab-small",
    key: "invoice_number",
    instructions: "partition by invoice number",
    allow_overlap: true,
    n_consensus: 1,
    output: [],
    status: "completed",
    consensus: {
      choices: [],
      likelihoods: [],
    },
    usage: null,
    created_at: "2026-04-20T10:00:00Z",
    ...overrides,
  };
}

// The openapi-fetch result `resolvePartitionHistorySelection` consumes — it only
// reads `data` and `response`, so a minimal stand-in is enough.
function apiResult(data: unknown, response: Response) {
  return Promise.resolve({ data, error: undefined, response });
}

describe("resolvePartitionHistorySelection", () => {
  afterEach(() => {
    // spyOn mutates the apiClient namespace import; restore so the spy does not
    // leak into other tests sharing this process.
    (apiClient.GET as ReturnType<typeof spyOn>).mockRestore?.();
  });

  test("prefers the latest partition detail payload when available", async () => {
    const listedPartition = makePartition();
    const detailedPartition = makePartition({
      file: {
        id: "file_from_detail",
        filename: "detail.pdf",
        mime_type: "application/pdf",
      },
      output: [{ key: "INV-001", pages: [1] }],
    });

    const getSpy = spyOn(apiClient, "GET").mockImplementation(((
      path: string,
      init: { params: { path: { partition_id: string } } },
    ) => {
      expect(path).toBe("/v1/partitions/{partition_id}");
      expect(init.params.path.partition_id).toBe("prtn_123");
      return apiResult(detailedPartition, Response.json(detailedPartition));
    }) as unknown as typeof apiClient.GET);

    const resolved = await resolvePartitionHistorySelection(listedPartition);

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(resolved.file.id).toBe("file_from_detail");
    expect(resolved.output).toEqual(detailedPartition.output);
  });

  test("falls back to the selected history row when the detail lookup fails", async () => {
    const listedPartition = makePartition({
      file: {
        id: "file_from_list",
        filename: "list.pdf",
        mime_type: "application/pdf",
      },
    });

    const getSpy = spyOn(apiClient, "GET").mockImplementation((() =>
      apiResult(
        undefined,
        new Response(null, { status: 500 }),
      )) as unknown as typeof apiClient.GET);

    const resolved = await resolvePartitionHistorySelection(listedPartition);

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(listedPartition);
  });
});
