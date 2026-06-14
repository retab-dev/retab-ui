import {
  createDataCellPointerActivationSource,
  type DataCellActivationSource,
} from "@/registry/new-york-v4/ui/data-cell-activation"
import { getDataCellDisplayTextSelectionOffset } from "@/registry/new-york-v4/ui/data-cell-text-hit-test"

export function getDataCellTextPointerActivationSource({
  clientX,
  clientY,
  detail,
  displayElement,
  event,
  value,
}: {
  clientX: number
  clientY: number
  detail: number
  displayElement: HTMLElement | null
  event?: Event
  value: string | null | undefined
}): Extract<DataCellActivationSource, { kind: "pointer" }> {
  const activationSource = createDataCellPointerActivationSource({
    clientX,
    clientY,
    detail,
    event,
  })
  const textElement = displayElement?.querySelector<HTMLElement>(
    '[data-slot="data-cell-value"]'
  )
  if (!textElement) return activationSource
  activationSource.selectionOffset = getDataCellDisplayTextSelectionOffset({
    clientX,
    clientY,
    textElement,
    value: value === null || value === undefined ? "" : String(value),
  })
  return activationSource
}
