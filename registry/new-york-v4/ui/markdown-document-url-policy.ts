export function sanitizeMarkdownUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) return trimmed

  try {
    const url = new URL(trimmed, "https://retab.local")
    if (
      url.protocol === "http:" ||
      url.protocol === "https:" ||
      url.protocol === "mailto:"
    ) {
      return trimmed
    }
  } catch {
    return ""
  }

  return ""
}

export function sanitizeMarkdownImageUrl(value: string) {
  const safeUrl = sanitizeMarkdownUrl(value)
  if (!safeUrl || safeUrl.startsWith("mailto:") || safeUrl.startsWith("#")) {
    return ""
  }
  return safeUrl
}
