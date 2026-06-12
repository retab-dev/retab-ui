export function buildVirtualGridTemplate({
  leadingWidth,
  leftPad,
  columnWidths,
  rightPad,
}: {
  leadingWidth: number
  leftPad: number
  columnWidths: readonly number[]
  rightPad: number
}) {
  const columns = columnWidths.map((width) => `${width}px`).join(" ")
  return [`${leadingWidth}px`, `${leftPad}px`, columns, `${rightPad}px`]
    .filter(Boolean)
    .join(" ")
}
