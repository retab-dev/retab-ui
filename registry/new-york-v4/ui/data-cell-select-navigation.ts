import type { DataCellSelectOption } from "@/registry/new-york-v4/ui/data-cell-types"

export function firstEnabledDataCellSelectOptionIndex(
  options: DataCellSelectOption[]
) {
  return options.findIndex((option) => !option.disabled)
}

export function lastEnabledDataCellSelectOptionIndex(
  options: DataCellSelectOption[]
) {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]?.disabled) return index
  }

  return -1
}

export function nextEnabledDataCellSelectOptionIndex({
  options,
  currentIndex,
  direction,
}: {
  options: DataCellSelectOption[]
  currentIndex: number
  direction: 1 | -1
}) {
  if (options.length === 0) return -1

  for (let offset = 1; offset <= options.length; offset += 1) {
    const index =
      (currentIndex + direction * offset + options.length) % options.length
    if (!options[index]?.disabled) return index
  }

  return -1
}

export function selectedDataCellSelectOptionIndex({
  options,
  value,
}: {
  options: DataCellSelectOption[]
  value: string | null
}) {
  const selectedIndex = options.findIndex((option) => option.value === value)
  if (selectedIndex >= 0 && !options[selectedIndex]?.disabled) {
    return selectedIndex
  }

  return firstEnabledDataCellSelectOptionIndex(options)
}
