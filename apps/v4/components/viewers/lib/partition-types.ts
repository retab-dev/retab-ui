// Partition result shapes, mirrored from the Retab API / dashboard.

export interface PartitionChunk {
  key: string
  /** 1-indexed pages assigned to this chunk. */
  pages: number[]
}

export interface PartitionChunkLikelihood {
  key: number | null
  pages: number[]
}

export interface PartitionConsensus {
  choices: PartitionChunk[][]
  likelihoods: PartitionChunkLikelihood[] | null
}

export interface PartitionUsage {
  credits: number
}

export interface PartitionResult {
  output: PartitionChunk[]
  consensus: PartitionConsensus
  usage: PartitionUsage | null
}
