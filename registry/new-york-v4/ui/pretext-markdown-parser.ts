"use client"

import { marked, type Token } from "marked"

export type PretextMarkdownTokenKind =
  | "code"
  | "comment"
  | "definition"
  | "heading"
  | "hr"
  | "html"
  | "list"
  | "paragraph"
  | "space"
  | "table"
  | "other"

export interface PretextMarkdownToken {
  kind: PretextMarkdownTokenKind
  raw: string
  text: string
}

export interface PretextMarkdownParser {
  parse(markdown: string): PretextMarkdownToken[]
}

export const markedPretextMarkdownParser: PretextMarkdownParser = {
  parse(markdown) {
    return marked
      .lexer(markdown, { gfm: true })
      .map((token) => normalizeMarkedToken(token))
  },
}

export function parsePretextMarkdownTokens(markdown: string) {
  return markedPretextMarkdownParser.parse(markdown)
}

function normalizeMarkedToken(token: Token): PretextMarkdownToken {
  return {
    kind: normalizeMarkedTokenKind(token),
    raw: token.raw ?? "",
    text: "text" in token && typeof token.text === "string" ? token.text : "",
  }
}

function normalizeMarkedTokenKind(token: Token): PretextMarkdownTokenKind {
  switch (token.type) {
    case "code":
      return "code"
    case "def":
      return "definition"
    case "html":
      return isMarkdownHtmlComment(token.raw ?? "") ? "comment" : "html"
    case "heading":
    case "hr":
    case "list":
    case "paragraph":
    case "space":
    case "table":
      return token.type
    default:
      return "other"
  }
}

function isMarkdownHtmlComment(raw: string) {
  return /^<!--[\s\S]*-->$/.test(raw.trim())
}
