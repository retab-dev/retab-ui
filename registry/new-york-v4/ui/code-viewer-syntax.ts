import Prism from "prismjs"

import type { ViewerResource } from "@/lib/viewer-resource"

Prism.manual = true

export type CodeTokenLeaf = {
  kind: string
  text: string
}

export type CodeSyntax = {
  identity: string
  getLineTokens(line: string): readonly CodeTokenLeaf[] | null
}

const JSON_LINE_MAX = 2000

const JSON_LANGUAGE: Prism.Grammar = {
  property: {
    pattern: /"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
    greedy: true,
  },
  string: {
    pattern: /"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
    greedy: true,
  },
  number: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,
  punctuation: /[{}[\],]/,
  operator: /:/,
  boolean: /\b(?:false|true)\b/,
  null: { pattern: /\bnull\b/, alias: "keyword" },
}

export const CODE_VIEWER_SYNTAX_STYLE = `
.cv-token-property { color: var(--cv-token-property, #0550ae); }
.cv-token-string { color: var(--cv-token-string, #0a7d33); }
.cv-token-number { color: var(--cv-token-number, #b5690c); }
.cv-token-keyword { color: var(--cv-token-keyword, #8250df); }
.cv-token-punctuation { color: var(--cv-token-punctuation, color-mix(in oklab, var(--foreground) 55%, transparent)); }
.dark .cv-token-property { color: var(--cv-token-property, #6cb6ff); }
.dark .cv-token-string { color: var(--cv-token-string, #8ddb8c); }
.dark .cv-token-number { color: var(--cv-token-number, #e3b341); }
.dark .cv-token-keyword { color: var(--cv-token-keyword, #dcbdfb); }
`

export function createCodeSyntax(resource: ViewerResource): CodeSyntax {
  const prismLanguage = codeSyntaxLanguage(resource)
  if (!prismLanguage) {
    return {
      identity: "plain",
      getLineTokens: () => null,
    }
  }

  const tokenCache = new Map<string, readonly CodeTokenLeaf[]>()

  return {
    identity: "json:v1",
    getLineTokens: (line) => {
      if (line.length === 0 || line.length > JSON_LINE_MAX) return null

      const cachedTokens = tokenCache.get(line)
      if (cachedTokens) return cachedTokens

      const tokens = flattenCodeTokens(Prism.tokenize(line, prismLanguage))
      tokenCache.set(line, tokens)
      return tokens
    },
  }
}

function codeSyntaxLanguage(resource: ViewerResource): Prism.Grammar | null {
  const fileName = resource.fileName.toLowerCase()
  const mimeType = resource.content.mimeType?.toLowerCase().split(";")[0].trim()
  if (
    fileName.endsWith(".json") ||
    fileName.endsWith(".json5") ||
    mimeType === "application/json"
  ) {
    return JSON_LANGUAGE
  }
  return null
}

function flattenCodeTokens(
  tokens: Array<string | Prism.Token>,
  parentKind = "",
  leaves: CodeTokenLeaf[] = []
): readonly CodeTokenLeaf[] {
  for (const token of tokens) {
    if (typeof token === "string") {
      leaves.push({ kind: parentKind, text: token })
    } else if (Array.isArray(token.content)) {
      flattenCodeTokens(
        token.content as Array<string | Prism.Token>,
        token.type,
        leaves
      )
    } else if (typeof token.content === "string") {
      leaves.push({ kind: token.type, text: token.content })
    } else {
      flattenCodeTokens([token.content as Prism.Token], token.type, leaves)
    }
  }
  return leaves
}
