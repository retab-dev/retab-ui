import { apiClient } from "@/app/shared/api/client";
import type { Partition as StoredPartition } from "@/types";

export async function resolvePartitionHistorySelection(
  partition: StoredPartition,
): Promise<StoredPartition> {
  try {
    const { data, response } = await apiClient.GET(
      "/v1/partitions/{partition_id}",
      { params: { path: { partition_id: partition.id } } },
    );
    if (!response.ok || !data) {
      return partition;
    }

    // The playground consumes the Zod `StoredPartition` shape; the OpenAPI
    // contract types this as the generated `Partition`. Same wire JSON — cast
    // at the boundary, preserving the prior (unvalidated) behavior.
    return data as unknown as StoredPartition;
  } catch {
    return partition;
  }
}
