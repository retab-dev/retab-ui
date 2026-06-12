export type DefinitionsKeyword = "$defs" | "definitions"

export function escapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1")
}

export function unescapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~")
}

export function decodeJsonPointerSegment(segment: string): string {
  return unescapeJsonPointerSegment(decodeUriComponentSafe(segment))
}

export function definitionRef(
  keyword: DefinitionsKeyword,
  name: string
): string {
  return `#/${keyword}/${escapeJsonPointerSegment(name)}`
}

export function definitionRefAliases(
  keyword: DefinitionsKeyword,
  name: string
): string[] {
  const pointerSegment = escapeJsonPointerSegment(name)
  const encodedSegment = encodeURIComponent(pointerSegment)
  const encodedNameSegment = encodeURIComponent(name)
  const encodedNameSegmentWithTilde = encodedNameSegment.replace(/~/g, "%7E")
  const lowerHexEncodedSegment = encodedSegment.replace(
    /%[0-9A-F]{2}/g,
    (escapeSequence) => escapeSequence.toLowerCase()
  )
  const lowerHexEncodedNameSegment = encodedNameSegmentWithTilde.replace(
    /%[0-9A-F]{2}/g,
    (escapeSequence) => escapeSequence.toLowerCase()
  )
  return [
    ...new Set([
      `#/${keyword}/${pointerSegment}`,
      `#/${keyword}/${encodedSegment}`,
      `#/${keyword}/${lowerHexEncodedSegment}`,
      ...encodedOriginalNameAliases(keyword, encodedNameSegment),
      ...encodedOriginalNameAliases(keyword, encodedNameSegmentWithTilde),
      ...encodedOriginalNameAliases(keyword, lowerHexEncodedNameSegment),
    ]),
  ]
}

function encodedOriginalNameAliases(
  keyword: DefinitionsKeyword,
  encodedSegment: string
): string[] {
  return encodedSegment.includes("%") ? [`#/${keyword}/${encodedSegment}`] : []
}

export function definitionNameFromRef(ref: string): string {
  const prefix = ref.startsWith("#/$defs/")
    ? "#/$defs/"
    : ref.startsWith("#/definitions/")
      ? "#/definitions/"
      : undefined
  return prefix
    ? decodeJsonPointerSegment(ref.slice(prefix.length))
    : ref
}

function decodeUriComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
