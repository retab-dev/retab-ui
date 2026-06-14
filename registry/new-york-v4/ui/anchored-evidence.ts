import type { AnchoredItem } from "./anchored-document-viewer"
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

export function evidenceToAnchoredItem(item: EvidenceAnchor): AnchoredItem {
  return {
    id: item.id,
    anchor: item.anchor.status === "resolved" ? item.anchor.anchor : null,
    disabled: item.anchor.status === "invalid",
  }
}

export function evidenceItemsToAnchoredItems(
  items: readonly EvidenceAnchor[]
): AnchoredItem[] {
  return items.map(evidenceToAnchoredItem)
}
