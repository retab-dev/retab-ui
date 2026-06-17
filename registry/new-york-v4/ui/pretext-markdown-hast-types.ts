"use client"

export type PretextMarkdownPoint = {
  column?: number
  line?: number
  offset?: number
}

export type PretextMarkdownPosition = {
  end?: PretextMarkdownPoint
  start?: PretextMarkdownPoint
}

export type PretextMarkdownHastText = {
  position?: PretextMarkdownPosition
  type: "text"
  value: string
}

export type PretextMarkdownHastElement = {
  children: PretextMarkdownHastNode[]
  position?: PretextMarkdownPosition
  properties?: Record<string, unknown>
  tagName: string
  type: "element"
}

export type PretextMarkdownHastRoot = {
  children: PretextMarkdownHastNode[]
  type: "root"
}

export type PretextMarkdownHastNode =
  | PretextMarkdownHastElement
  | PretextMarkdownHastText
  | {
      children?: PretextMarkdownHastNode[]
      position?: PretextMarkdownPosition
      type: string
      value?: unknown
    }
