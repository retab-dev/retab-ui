import type { NodeId } from "./types";

/**
 * Monotonic id minting. Ids are minted exactly once per node — at creation, or at
 * the import boundary when an external JSON Schema first becomes a Document — and
 * are stable for the node's lifetime thereafter.
 *
 * A module-level counter (rather than a random uuid) keeps ids short and stable
 * for snapshot tests; it is process-local, which is all the editor needs since
 * ids never have to be reconstructed from a serialized form (JSON Schema carries
 * none — that asymmetry is the point).
 */
let counter = 0;

export function createId(prefix = "node"): NodeId {
  counter += 1;
  return `${prefix}-${counter}`;
}
