// Split result shapes (the structural subset the viewer needs), mirrored from
// the Retab dashboard's SplitView.

import type { PartitionChunk } from "@/components/viewers/lib/partition-types";

export interface SplitResult {
  name: string;
  /** 1-indexed pages assigned to this subdocument. */
  pages: number[];
  /** Frontend-only overlay carried through by the split viewer. */
  partitions?: PartitionChunk[];
}

export interface SplitViewConsensus {
  choices?: SplitResult[][];
  likelihoods?: unknown[] | null;
}

export interface SplitView {
  output: SplitResult[];
  consensus?: SplitViewConsensus | null;
  usage?: { credits: number } | null;
}

export function asSplitView(
  payload:
    | { output?: unknown; consensus?: unknown; usage?: unknown }
    | null
    | undefined,
): SplitView | null {
  if (!payload || !Array.isArray(payload.output)) return null;
  return {
    output: payload.output as SplitResult[],
    consensus: (payload.consensus ?? null) as SplitViewConsensus | null,
    usage: (payload.usage ?? null) as SplitView["usage"],
  };
}

export function getSplitVotes(
  splitView: SplitView | null | undefined,
  splitIndex: number,
): SplitResult[] {
  const choices = splitView?.consensus?.choices;
  if (!choices?.length) return [];
  return choices.flatMap((choice) => {
    const split = choice[splitIndex];
    return split ? [split] : [];
  });
}
