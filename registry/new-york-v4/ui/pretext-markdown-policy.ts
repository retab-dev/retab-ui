"use client"

import rehypeKatex from "rehype-katex"
import rehypePrettyCode from "rehype-pretty-code"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, {
  defaultSchema,
  type Options as RehypeSanitizeOptions,
} from "rehype-sanitize"
import remarkBreaks from "remark-breaks"
import remarkDirective from "remark-directive"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import type { PluggableList } from "unified"
import { visit } from "unist-util-visit"

export const ALERT_LABELS = {
  caution: "Caution:",
  important: "Important:",
  note: "Note:",
  tip: "Tip:",
  warning: "Warning:",
} as const

export type AlertKind = keyof typeof ALERT_LABELS

export const CALLOUT_LABELS = {
  caution: "Caution",
  danger: "Danger",
  important: "Important",
  info: "Info",
  note: "Note",
  tip: "Tip",
  warning: "Warning",
} as const

export type CalloutKind = keyof typeof CALLOUT_LABELS

export type PretextComponentKind = "Badge" | "Metric"

export type PretextComponentProps = {
  label?: string
  tone?: string
  value?: string
}

export type PretextComponent = {
  name: PretextComponentKind
  props: PretextComponentProps
}

const PRETEXT_COMPONENT_KINDS = new Set<PretextComponentKind>([
  "Badge",
  "Metric",
])

const PRETEXT_COMPONENT_PROPS = new Set<keyof PretextComponentProps>([
  "label",
  "tone",
  "value",
])

const EMOJI_SHORTCODES: Record<string, string> = {
  ":check:": "✓",
  ":sparkles:": "✨",
  ":warning:": "⚠",
  ":white_check_mark:": "✅",
  ":x:": "✕",
}

export const PRETEXT_MARKDOWN_REHYPE_PLUGINS: PluggableList = [
  rehypeRaw,
  [rehypeSanitize, createPretextMarkdownSanitizeSchema()],
  rehypeKatex,
  [
    rehypePrettyCode,
    {
      keepBackground: false,
      theme: {
        dark: "github-dark",
        light: "github-light-default",
      },
    },
  ],
]

export function createPretextMarkdownRemarkPlugins(
  headingIds: readonly string[]
): PluggableList {
  return [
    remarkDirective,
    remarkPretextHeadingIds(headingIds),
    remarkPretextComponentMarkdown,
    remarkPretextDirectiveCallouts,
    remarkPretextGithubAlerts,
    remarkPretextProseTransforms,
    remarkGfm,
    remarkBreaks,
    remarkMath,
  ]
}

export function sanitizePretextMarkdownUrl(value: string) {
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

export function sanitizePretextMarkdownImageUrl(value: string) {
  const safeUrl = sanitizePretextMarkdownUrl(value)
  if (!safeUrl || safeUrl.startsWith("mailto:") || safeUrl.startsWith("#")) {
    return ""
  }
  return safeUrl
}

export function readPretextHeadingId(props: Record<string, unknown>) {
  const id = props.dataPretextHeadingId ?? props["data-pretext-heading-id"]
  return typeof id === "string" ? id : undefined
}

export function readPretextAlertKind(node: unknown): AlertKind | null {
  const properties =
    node && typeof node === "object" && "properties" in node
      ? (node.properties as Record<string, unknown>)
      : null
  const value = properties?.dataPretextAlertKind
  return typeof value === "string" && value in ALERT_LABELS
    ? (value as AlertKind)
    : null
}

export function readPretextCallout(
  node: unknown
): { kind: CalloutKind; title: string } | null {
  const properties =
    node && typeof node === "object" && "properties" in node
      ? (node.properties as Record<string, unknown>)
      : null
  if (!properties) return null

  const kind = normalizePretextCalloutKind(
    properties.dataPretextCalloutKind ?? properties["data-pretext-callout-kind"]
  )
  if (!kind) return null

  const title =
    properties.dataPretextCalloutTitle ??
    properties["data-pretext-callout-title"]
  return {
    kind,
    title:
      typeof title === "string" && title.trim() ? title : CALLOUT_LABELS[kind],
  }
}

export function readPretextComponent(node: unknown): PretextComponent | null {
  const properties =
    node && typeof node === "object" && "properties" in node
      ? (node.properties as Record<string, unknown>)
      : null
  if (!properties) return null

  const name =
    properties.dataPretextComponentName ??
    properties["data-pretext-component-name"]
  if (
    typeof name !== "string" ||
    !PRETEXT_COMPONENT_KINDS.has(name as PretextComponentKind)
  ) {
    return null
  }

  const serializedProps =
    properties.dataPretextComponentProps ??
    properties["data-pretext-component-props"]
  if (typeof serializedProps !== "string") return null

  try {
    const parsed = JSON.parse(serializedProps) as Record<string, unknown>
    const props: PretextComponentProps = {}
    for (const [propName, propValue] of Object.entries(parsed)) {
      if (
        isSafePretextComponentProp(propName) &&
        typeof propValue === "string"
      ) {
        props[propName] = propValue
      }
    }
    return {
      name: name as PretextComponentKind,
      props,
    }
  } catch {
    return null
  }
}

function createPretextMarkdownSanitizeSchema(): RehypeSanitizeOptions {
  return {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      "*": [
        ...(defaultSchema.attributes?.["*"] ?? []),
        "ariaDescribedBy",
        "ariaHidden",
        "ariaLabel",
        "ariaLabelledBy",
        "dataFootnoteBackref",
        "dataFootnoteRef",
        "dataPretextAlertKind",
        "dataPretextCalloutKind",
        "dataPretextCalloutTitle",
        "dataPretextComponentName",
        "dataPretextComponentProps",
        "dataPretextHeadingId",
      ],
      div: [
        ...(defaultSchema.attributes?.div ?? []),
        "dataPretextCalloutKind",
        "dataPretextCalloutTitle",
        "dataPretextComponentName",
        "dataPretextComponentProps",
      ],
      mark: ["title"],
    },
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      "details",
      "figcaption",
      "figure",
      "mark",
      "summary",
    ],
  }
}

function normalizePretextCalloutKind(value: unknown): CalloutKind | null {
  switch (String(value ?? "").toLowerCase()) {
    case "caution":
      return "caution"
    case "danger":
    case "error":
    case "failure":
      return "danger"
    case "important":
      return "important"
    case "info":
      return "info"
    case "note":
      return "note"
    case "success":
    case "tip":
      return "tip"
    case "warning":
      return "warning"
    default:
      return null
  }
}

function parsePretextComponentMarkdown(value: string): PretextComponent | null {
  const source = value.trim()
  const componentMatch = /^<([A-Z][A-Za-z0-9]*)\s*([^<>]*)\/>$/.exec(source)
  if (!componentMatch) return null

  const name = componentMatch[1]
  if (!PRETEXT_COMPONENT_KINDS.has(name as PretextComponentKind)) return null

  const attributes = componentMatch[2] ?? ""
  const props: PretextComponentProps = {}
  const propPattern = /\s*([A-Za-z][A-Za-z0-9_]*)=(?:"([^"]*)"|'([^']*)')/gy
  let index = 0

  while (index < attributes.length) {
    if (attributes.slice(index).trim() === "") break

    propPattern.lastIndex = index
    const propMatch = propPattern.exec(attributes)
    if (!propMatch) return null

    const propName = propMatch[1]
    if (!isSafePretextComponentProp(propName)) return null

    props[propName] = propMatch[2] ?? propMatch[3] ?? ""
    index = propPattern.lastIndex
  }

  return {
    name: name as PretextComponentKind,
    props,
  }
}

function isSafePretextComponentProp(
  propName: string
): propName is keyof PretextComponentProps {
  if (!PRETEXT_COMPONENT_PROPS.has(propName as keyof PretextComponentProps)) {
    return false
  }
  if (/^on/i.test(propName)) return false

  return ![
    "children",
    "component",
    "dangerouslySetInnerHTML",
    "render",
    "style",
  ].includes(propName)
}

function remarkPretextHeadingIds(headingIds: readonly string[]) {
  return function pretextHeadingIds() {
    return function transform(tree: unknown) {
      let index = 0
      visit(tree, "heading", (node: any) => {
        const id = headingIds[index]
        index += 1
        if (!id) return

        node.data = {
          ...node.data,
          hProperties: {
            ...node.data?.hProperties,
            id,
            dataPretextHeadingId: id,
          },
        }
      })
    }
  }
}

function remarkPretextGithubAlerts() {
  return function transform(tree: unknown) {
    visit(tree, "blockquote", (node: any) => {
      const paragraph = node.children?.[0]
      const firstChild = paragraph?.children?.[0]
      if (paragraph?.type !== "paragraph" || firstChild?.type !== "text") {
        return
      }

      const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(
        firstChild.value
      )
      if (!match) return

      const kind = match[1]!.toLowerCase() as AlertKind
      firstChild.value = firstChild.value.slice(match[0].length)
      if (!firstChild.value) {
        paragraph.children.shift()
      }
      if (paragraph.children.length === 0) {
        node.children.shift()
      }
      node.data = {
        ...node.data,
        hProperties: {
          ...node.data?.hProperties,
          dataPretextAlertKind: kind,
        },
      }
    })
  }
}

function remarkPretextDirectiveCallouts() {
  return function transform(tree: unknown) {
    visit(tree as any, ["containerDirective", "leafDirective"], (node: any) => {
      const kind = normalizePretextCalloutKind(node.name)
      if (!kind) return

      const title =
        typeof node.attributes?.title === "string" &&
        node.attributes.title.trim()
          ? node.attributes.title
          : CALLOUT_LABELS[kind]

      node.data = {
        ...node.data,
        hName: "div",
        hProperties: {
          ...node.data?.hProperties,
          dataPretextCalloutKind: kind,
          dataPretextCalloutTitle: title,
        },
      }
    })
  }
}

function remarkPretextComponentMarkdown() {
  return function transform(tree: any) {
    visit(tree, "html", (node: any) => {
      if (typeof node.value !== "string") return

      const component = parsePretextComponentMarkdown(node.value)
      if (!component) {
        if (isPretextMdxLikeHtml(node.value)) {
          node.type = "code"
          node.lang = "mdx"
          node.value = node.value.trim()
        }
        return
      }

      node.type = "pretextComponent"
      node.data = {
        hName: "div",
        hProperties: {
          dataPretextComponentName: component.name,
          dataPretextComponentProps: JSON.stringify(component.props),
        },
      }
      node.children = []
      delete node.value
    })
  }
}

function isPretextMdxLikeHtml(value: string) {
  const trimmed = value.trim()
  return (
    /^<\/?[A-Z][A-Za-z0-9.]*(?:\s|\/?>)/.test(trimmed) ||
    /\s\w+=\{/.test(trimmed)
  )
}

function remarkPretextProseTransforms() {
  return function transform(tree: unknown) {
    visit(tree, "text", (node: any) => {
      if (typeof node.value === "string") {
        node.value = transformMarkdownProseText(node.value)
      }
    })
  }
}

function transformMarkdownProseText(text: string) {
  let next = text
    .replace(/<->/g, "↔")
    .replace(/(?<!<)->/g, "→")
    .replace(/<-+/g, "←")
    .replace(/\.\.\./g, "…")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/\b1\/2\b/g, "½")
    .replace(/\b1\/4\b/g, "¼")
    .replace(/\b3\/4\b/g, "¾")

  next = next.replace(/(^|[\s([{])"([^"]+)"/g, "$1“$2”")
  next = next.replace(/(^|[\s([{])'([^']+)'/g, "$1‘$2’")
  next = next.replace(/(\w)'(\w)/g, "$1’$2")

  for (const [shortcode, emoji] of Object.entries(EMOJI_SHORTCODES)) {
    next = next.replaceAll(shortcode, emoji)
  }

  return next
}
