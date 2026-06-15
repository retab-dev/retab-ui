import type { DocumentAnchor } from "./document-anchor"

export type AnchorResolution =
  | { status: "resolved"; anchor: DocumentAnchor }
  | { status: "missing" }
  | { status: "invalid"; reason: string }

export type EvidenceAnchor = {
  id: string
  anchor: AnchorResolution
}

export type EvidenceItem<Payload> = EvidenceAnchor & {
  payload: Payload
}

export function resolvedEvidenceAnchor(
  anchor: DocumentAnchor
): AnchorResolution {
  return { status: "resolved", anchor }
}

export function missingEvidenceAnchor(): AnchorResolution {
  return { status: "missing" }
}

export function invalidEvidenceAnchor(reason: string): AnchorResolution {
  return { status: "invalid", reason }
}
