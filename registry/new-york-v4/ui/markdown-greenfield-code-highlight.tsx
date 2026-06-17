"use client"

import * as React from "react"

export function isSafeHighlightedCodeLine(line: number) {
  return Number.isInteger(line) && line > 0 && line <= 100_000
}

export function normalizeCodeLanguage(language: string | null) {
  const value = (language ?? "text").toLowerCase()
  const aliases: Record<string, string> = {
    bash: "shell",
    docker: "dockerfile",
    javascript: "js",
    jsonc: "json",
    md: "markdown",
    patch: "diff",
    rb: "ruby",
    "shell-session": "shell",
    terminal: "shell",
    typescript: "ts",
    yml: "yaml",
  }
  return aliases[value] ?? value
}

export function diffLineKind(line: string) {
  if (line.startsWith("+") && !line.startsWith("+++")) return "add"
  if (line.startsWith("-") && !line.startsWith("---")) return "remove"
  return null
}

export function renderCodeLine({
  fallbackLanguage,
  line,
  pattern,
  shikiLine,
}: {
  fallbackLanguage: string
  line: string
  pattern: string
  shikiLine: readonly ShikiCodeToken[] | undefined
}) {
  if (shikiLine) {
    return renderShikiCodeLine({
      fallbackLanguage,
      line,
      pattern,
      tokens: shikiLine,
    })
  }
  if (!pattern) return renderFallbackCodeTokens(line || " ", fallbackLanguage)
  const index = line.indexOf(pattern)
  if (index < 0) return renderFallbackCodeTokens(line || " ", fallbackLanguage)
  return (
    <>
      {renderFallbackCodeTokens(line.slice(0, index), fallbackLanguage)}
      <span data-highlighted-chars="">{pattern}</span>
      {renderFallbackCodeTokens(
        line.slice(index + pattern.length),
        fallbackLanguage
      )}
    </>
  )
}

function renderShikiCodeLine({
  fallbackLanguage,
  line,
  pattern,
  tokens,
}: {
  fallbackLanguage: string
  line: string
  pattern: string
  tokens: readonly ShikiCodeToken[]
}) {
  if (!tokens.length) return " "
  if (!pattern) return renderShikiCodeTokens(tokens)

  const highlightStart = line.indexOf(pattern)
  if (highlightStart < 0) return renderShikiCodeTokens(tokens)

  return renderShikiCodeTokensWithHighlight({
    fallbackLanguage,
    highlightEnd: highlightStart + pattern.length,
    highlightStart,
    tokens,
  })
}

function renderShikiCodeTokens(tokens: readonly ShikiCodeToken[]) {
  return tokens.map((token, index) => (
    <span
      key={index}
      className="text-[var(--shiki-light)] dark:text-[var(--shiki-dark)]"
      data-pretext-code-token="shiki"
      data-shiki-token=""
      style={shikiTokenStyle(token)}
    >
      {token.content}
    </span>
  ))
}

function renderShikiCodeTokensWithHighlight({
  fallbackLanguage,
  highlightEnd,
  highlightStart,
  tokens,
}: {
  fallbackLanguage: string
  highlightEnd: number
  highlightStart: number
  tokens: readonly ShikiCodeToken[]
}) {
  const rendered: React.ReactNode[] = []
  let cursor = 0

  tokens.forEach((token, tokenIndex) => {
    const tokenStart = cursor
    const tokenEnd = cursor + token.content.length
    cursor = tokenEnd

    if (tokenEnd <= highlightStart || tokenStart >= highlightEnd) {
      rendered.push(
        <span
          key={tokenIndex}
          className="text-[var(--shiki-light)] dark:text-[var(--shiki-dark)]"
          data-pretext-code-token="shiki"
          data-shiki-token=""
          style={shikiTokenStyle(token)}
        >
          {token.content}
        </span>
      )
      return
    }

    const before = token.content.slice(
      0,
      Math.max(0, highlightStart - tokenStart)
    )
    const highlighted = token.content.slice(
      Math.max(0, highlightStart - tokenStart),
      Math.min(token.content.length, highlightEnd - tokenStart)
    )
    const after = token.content.slice(
      Math.min(token.content.length, highlightEnd - tokenStart)
    )

    if (before) {
      rendered.push(
        <span
          key={`${tokenIndex}-before`}
          className="text-[var(--shiki-light)] dark:text-[var(--shiki-dark)]"
          data-pretext-code-token="shiki"
          data-shiki-token=""
          style={shikiTokenStyle(token)}
        >
          {before}
        </span>
      )
    }
    if (highlighted) {
      rendered.push(
        <span key={`${tokenIndex}-highlight`} data-highlighted-chars="">
          <span
            className="text-[var(--shiki-light)] dark:text-[var(--shiki-dark)]"
            data-pretext-code-token="shiki"
            data-shiki-token=""
            style={shikiTokenStyle(token)}
          >
            {highlighted}
          </span>
        </span>
      )
    }
    if (after) {
      rendered.push(
        <span
          key={`${tokenIndex}-after`}
          className="text-[var(--shiki-light)] dark:text-[var(--shiki-dark)]"
          data-pretext-code-token="shiki"
          data-shiki-token=""
          style={shikiTokenStyle(token)}
        >
          {after}
        </span>
      )
    }
  })

  if (rendered.length) return rendered
  return renderFallbackCodeTokens(" ", fallbackLanguage)
}

function renderFallbackCodeTokens(line: string, language: string) {
  const tokens = tokenizeCodeLine(line, language)
  if (!tokens.length) return " "
  return tokens.map((token, index) =>
    token.kind === "plain" ? (
      <React.Fragment key={index}>{token.value}</React.Fragment>
    ) : (
      <span
        key={index}
        className={codeTokenClassName(token.kind)}
        data-pretext-code-token={token.kind}
      >
        {token.value}
      </span>
    )
  )
}

type ShikiCodeToken = {
  content: string
  darkColor: string
  fontStyle: number | undefined
  lightColor: string
}

type RawShikiToken = {
  content?: unknown
  variants?: {
    dark?: {
      color?: unknown
      fontStyle?: unknown
    }
    light?: {
      color?: unknown
      fontStyle?: unknown
    }
  }
}

const shikiCodeLineCache = new Map<string, Promise<ShikiCodeToken[][] | null>>()
const resolvedShikiCodeLines = new Map<string, ShikiCodeToken[][] | null>()
const shikiCodeLineSubscribers = new Set<() => void>()

function ensureShikiCodeLines(args: {
  cacheKey: string
  expectedLineCount: number
  language: string
  source: string
}) {
  if (resolvedShikiCodeLines.has(args.cacheKey)) return
  void getShikiCodeLines(args).then((lines) => {
    resolvedShikiCodeLines.set(args.cacheKey, lines)
    while (resolvedShikiCodeLines.size > 128) {
      const oldestKey = resolvedShikiCodeLines.keys().next().value
      if (oldestKey === undefined) break
      resolvedShikiCodeLines.delete(oldestKey)
    }
    for (const notify of shikiCodeLineSubscribers) notify()
  })
}

// Shiki tokenization is an asynchronous external system (a dynamically imported
// highlighter with a shared resolved-value cache). The viewer subscribes to
// that cache with useSyncExternalStore — the React-idiomatic way to read an
// external store — rather than driving the load from an effect. The snapshot
// returns a stable reference (the cached array, or null while pending) so
// rendering stays progressive: plain source first, highlighted once resolved.
export function useShikiCodeLines(
  source: string,
  language: string,
  expectedLineCount: number
) {
  const cacheKey = `${language}\0${source}`
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      shikiCodeLineSubscribers.add(onStoreChange)
      ensureShikiCodeLines({ cacheKey, expectedLineCount, language, source })
      return () => {
        shikiCodeLineSubscribers.delete(onStoreChange)
      }
    },
    [cacheKey, expectedLineCount, language, source]
  )
  const getSnapshot = React.useCallback(
    () =>
      resolvedShikiCodeLines.has(cacheKey)
        ? (resolvedShikiCodeLines.get(cacheKey) ?? null)
        : null,
    [cacheKey]
  )
  return React.useSyncExternalStore(subscribe, getSnapshot, () => null)
}

function getShikiCodeLines({
  cacheKey,
  expectedLineCount,
  language,
  source,
}: {
  cacheKey: string
  expectedLineCount: number
  language: string
  source: string
}) {
  let cached = shikiCodeLineCache.get(cacheKey)
  if (!cached) {
    cached = loadShikiCodeLines({ expectedLineCount, language, source })
    shikiCodeLineCache.set(cacheKey, cached)
    trimShikiCodeLineCache()
  }
  return cached
}

async function loadShikiCodeLines({
  expectedLineCount,
  language,
  source,
}: {
  expectedLineCount: number
  language: string
  source: string
}) {
  try {
    const shiki = await import("shiki")
    const lines = (await (shiki.codeToTokensWithThemes as any)(source, {
      lang: shikiLanguageFor(language),
      themes: {
        dark: "github-dark",
        light: "github-light-default",
      },
    })) as RawShikiToken[][]

    return normalizeShikiCodeLines(lines, expectedLineCount)
  } catch {
    return null
  }
}

function normalizeShikiCodeLines(
  lines: RawShikiToken[][],
  expectedLineCount: number
) {
  return Array.from({ length: expectedLineCount }, (_, index) =>
    normalizeShikiCodeLine(lines[index] ?? [])
  )
}

function normalizeShikiCodeLine(tokens: RawShikiToken[]): ShikiCodeToken[] {
  return tokens
    .map((token) => {
      const content = typeof token.content === "string" ? token.content : ""
      const lightColor = readShikiTokenColor(token, "light")
      const darkColor = readShikiTokenColor(token, "dark")
      if (!content || !lightColor || !darkColor) return null
      return {
        content,
        darkColor,
        fontStyle: readShikiTokenFontStyle(token),
        lightColor,
      }
    })
    .filter((token): token is ShikiCodeToken => token != null)
}

function readShikiTokenColor(token: RawShikiToken, variant: "dark" | "light") {
  const color = token.variants?.[variant]?.color
  return typeof color === "string" && /^#[0-9a-f]{6,8}$/i.test(color)
    ? color
    : ""
}

function readShikiTokenFontStyle(token: RawShikiToken) {
  const fontStyle =
    typeof token.variants?.light?.fontStyle === "number"
      ? token.variants.light.fontStyle
      : undefined
  return fontStyle && Number.isFinite(fontStyle) ? fontStyle : undefined
}

function shikiTokenStyle(token: ShikiCodeToken) {
  return {
    "--shiki-dark": token.darkColor,
    "--shiki-light": token.lightColor,
    fontStyle: token.fontStyle === 1 ? "italic" : undefined,
  } as React.CSSProperties
}

function shikiLanguageFor(language: string) {
  const aliases: Record<string, string> = {
    dockerfile: "docker",
    js: "javascript",
    shell: "bash",
    ts: "typescript",
  }
  return aliases[language] ?? language
}

function trimShikiCodeLineCache() {
  while (shikiCodeLineCache.size > 64) {
    const oldestKey = shikiCodeLineCache.keys().next().value
    if (!oldestKey) break
    shikiCodeLineCache.delete(oldestKey)
  }
}

type CodeToken = {
  kind: "comment" | "keyword" | "literal" | "number" | "plain" | "string"
  value: string
}

function tokenizeCodeLine(line: string, language: string): CodeToken[] {
  if (!line) return []
  if (language === "diff") return tokenizeDiffLine(line)
  if (language === "json") return tokenizeJsonLikeLine(line)
  if (language === "yaml") return tokenizeYamlLine(line)
  if (
    language === "js" ||
    language === "jsx" ||
    language === "ts" ||
    language === "tsx"
  ) {
    return tokenizeCStyleLine(line)
  }
  if (
    language === "shell" ||
    language === "bash" ||
    language === "dockerfile"
  ) {
    return tokenizeShellLine(line)
  }
  return [{ kind: "plain", value: line }]
}

function tokenizeCStyleLine(line: string): CodeToken[] {
  const commentIndex = line.indexOf("//")
  const codePart = commentIndex >= 0 ? line.slice(0, commentIndex) : line
  const commentPart = commentIndex >= 0 ? line.slice(commentIndex) : ""
  return [
    ...tokenizeByPattern(
      codePart,
      /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:as|async|await|break|case|catch|class|const|continue|default|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|interface|let|new|null|of|return|satisfies|switch|throw|true|try|type|typeof|undefined|var|while|yield)\b|\b\d+(?:\.\d+)?\b)/g,
      classifyCStyleToken
    ),
    ...(commentPart ? [{ kind: "comment" as const, value: commentPart }] : []),
  ]
}

function classifyCStyleToken(value: string): CodeToken["kind"] {
  if (/^["'`]/.test(value)) return "string"
  if (/^\d/.test(value)) return "number"
  if (/^(?:true|false|null|undefined)$/.test(value)) return "literal"
  return "keyword"
}

function tokenizeJsonLikeLine(line: string): CodeToken[] {
  return tokenizeByPattern(
    line,
    /("(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)/gi,
    (value) => {
      if (/^"/.test(value)) return "string"
      if (/^(?:true|false|null)$/i.test(value)) return "literal"
      return "number"
    }
  )
}

function tokenizeYamlLine(line: string): CodeToken[] {
  const commentIndex = line.indexOf("#")
  const codePart = commentIndex >= 0 ? line.slice(0, commentIndex) : line
  const commentPart = commentIndex >= 0 ? line.slice(commentIndex) : ""
  return [
    ...tokenizeByPattern(
      codePart,
      /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b)/gi,
      (value) => {
        if (/^["']/.test(value)) return "string"
        if (/^(?:true|false|null)$/i.test(value)) return "literal"
        return "number"
      }
    ),
    ...(commentPart ? [{ kind: "comment" as const, value: commentPart }] : []),
  ]
}

function tokenizeShellLine(line: string): CodeToken[] {
  const commentIndex = line.search(/(^|\s)#/)
  const codePart = commentIndex >= 0 ? line.slice(0, commentIndex) : line
  const commentPart = commentIndex >= 0 ? line.slice(commentIndex) : ""
  return [
    ...tokenizeByPattern(
      codePart,
      /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:cd|cp|curl|echo|export|git|grep|mkdir|mv|node|npm|pnpm|rm|sed|test|yarn)\b)/g,
      (value) => (/^["']/.test(value) ? "string" : "keyword")
    ),
    ...(commentPart ? [{ kind: "comment" as const, value: commentPart }] : []),
  ]
}

function tokenizeDiffLine(line: string): CodeToken[] {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return [{ kind: "literal", value: line }]
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return [{ kind: "comment", value: line }]
  }
  return [{ kind: "plain", value: line }]
}

function tokenizeByPattern(
  line: string,
  pattern: RegExp,
  classify: (value: string) => CodeToken["kind"]
): CodeToken[] {
  const tokens: CodeToken[] = []
  let cursor = 0
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) {
      tokens.push({ kind: "plain", value: line.slice(cursor, index) })
    }
    const value = match[0]
    tokens.push({ kind: classify(value), value })
    cursor = index + value.length
  }
  if (cursor < line.length) {
    tokens.push({ kind: "plain", value: line.slice(cursor) })
  }
  return tokens
}

function codeTokenClassName(kind: CodeToken["kind"]) {
  switch (kind) {
    case "comment":
      return "text-muted-foreground italic"
    case "keyword":
      return "font-semibold text-sky-700 dark:text-sky-300"
    case "literal":
      return "text-purple-700 dark:text-purple-300"
    case "number":
      return "text-amber-700 dark:text-amber-300"
    case "string":
      return "text-emerald-700 dark:text-emerald-300"
    default:
      return ""
  }
}
