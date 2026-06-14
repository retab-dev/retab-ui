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

type PretextComponentPropSchema = {
  values?: readonly string[]
}

type PretextComponentRegistryEntry = {
  directiveName: string
  props: Record<string, PretextComponentPropSchema>
}

export const PRETEXT_COMPONENT_REGISTRY = {
  Badge: {
    directiveName: "badge",
    props: {
      label: {},
      tone: { values: ["danger", "info", "success", "warning"] },
      value: {},
    },
  },
  Metric: {
    directiveName: "metric",
    props: {
      label: {},
      value: {},
    },
  },
} as const satisfies Record<string, PretextComponentRegistryEntry>

export type PretextComponentKind = keyof typeof PRETEXT_COMPONENT_REGISTRY
type PretextComponentPropName = {
  [Kind in PretextComponentKind]: keyof (typeof PRETEXT_COMPONENT_REGISTRY)[Kind]["props"]
}[PretextComponentKind]
export type PretextComponentProps = Partial<
  Record<PretextComponentPropName, string>
>
export type PretextComponent = {
  name: PretextComponentKind
  props: PretextComponentProps
}

const EMOJI_SHORTCODES: Record<string, string> = {
  ":check:": "✓",
  ":sparkles:": "✨",
  ":warning:": "⚠",
  ":white_check_mark:": "✅",
  ":x:": "✕",
}

const URL_CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/
const URL_SCHEME_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*):/
const ALLOWED_LINK_PROTOCOLS = new Set(["http", "https", "mailto"])

export const PRETEXT_MARKDOWN_REHYPE_PLUGINS: PluggableList = [
  rehypeRaw,
  rehypePretextMarkdownInputPolicy,
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
    remarkPretextComponentDirectives,
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
  if (URL_CONTROL_CHARACTER_PATTERN.test(trimmed)) return ""

  const decoded = decodePretextMarkdownUrl(trimmed).trim()
  if (!decoded || URL_CONTROL_CHARACTER_PATTERN.test(decoded)) return ""

  const decodedScheme = getPretextMarkdownUrlScheme(decoded)
  const rawScheme = getPretextMarkdownUrlScheme(trimmed)
  if (decodedScheme && decodedScheme !== rawScheme) return ""
  if (decodedScheme && !ALLOWED_LINK_PROTOCOLS.has(decodedScheme)) return ""

  if (trimmed.startsWith("#")) return trimmed
  if (trimmed.startsWith("/")) return trimmed.startsWith("//") ? "" : trimmed

  try {
    const url = new URL(trimmed, "https://retab.local")
    if (ALLOWED_LINK_PROTOCOLS.has(url.protocol.slice(0, -1))) {
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

function decodePretextMarkdownUrl(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getPretextMarkdownUrlScheme(value: string) {
  return URL_SCHEME_PATTERN.exec(value)?.[1]?.toLowerCase() ?? null
}

function rehypePretextMarkdownInputPolicy() {
  return function transform(tree: unknown) {
    removeUnsafePretextMarkdownInputs(tree)
  }
}

function removeUnsafePretextMarkdownInputs(node: unknown) {
  if (!node || typeof node !== "object" || !("children" in node)) return

  const parent = node as { children?: unknown[] }
  if (!Array.isArray(parent.children)) return

  parent.children = parent.children.filter(
    (child) => !isUnsafePretextMarkdownInput(child)
  )
  for (const child of parent.children) {
    removeUnsafePretextMarkdownInputs(child)
  }
}

function isUnsafePretextMarkdownInput(node: unknown) {
  if (!node || typeof node !== "object") return false

  const element = node as {
    tagName?: string
    properties?: Record<string, unknown>
  }
  if (element.tagName !== "input") return false

  return !(
    element.properties?.type === "checkbox" &&
    element.properties.disabled === true
  )
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
  if (typeof name !== "string" || !isPretextComponentKind(name)) {
    return null
  }

  const serializedProps =
    properties.dataPretextComponentProps ??
    properties["data-pretext-component-props"]
  if (typeof serializedProps !== "string") return null

  try {
    const parsed = JSON.parse(serializedProps) as Record<string, unknown>
    const props = parsePretextComponentProps(name, parsed)
    if (!props) return null
    return {
      name,
      props,
    }
  } catch {
    return null
  }
}

export function createPretextMarkdownSanitizeSchema(): RehypeSanitizeOptions {
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
      "caption",
      "details",
      "figcaption",
      "figure",
      "kbd",
      "mark",
      "sub",
      "summary",
      "sup",
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
  if (!isPretextComponentKind(name)) return null

  const attributes = componentMatch[2] ?? ""
  const rawProps: Record<string, string> = {}
  const propPattern = /\s*([A-Za-z][A-Za-z0-9_]*)=(?:"([^"]*)"|'([^']*)')/gy
  let index = 0

  while (index < attributes.length) {
    if (attributes.slice(index).trim() === "") break

    propPattern.lastIndex = index
    const propMatch = propPattern.exec(attributes)
    if (!propMatch) return null

    const propName = propMatch[1]
    if (!isSafePretextComponentPropName(propName)) return null

    rawProps[propName] = propMatch[2] ?? propMatch[3] ?? ""
    index = propPattern.lastIndex
  }

  const props = parsePretextComponentProps(name, rawProps)
  if (!props) return null

  return {
    name,
    props,
  }
}

function parsePretextDirectiveComponent(node: any): PretextComponent | null {
  const name = normalizePretextDirectiveComponentName(node.name)
  if (!name) return null

  const props = parsePretextComponentAttributes(node.attributes)
  if (!props) return null

  if (node.type === "textDirective") {
    const label = extractPretextDirectiveText(node)
    if (label) props.label ??= label
  }

  const validatedProps = parsePretextComponentProps(name, props)
  if (!validatedProps) return null

  return { name, props: validatedProps }
}

function extractPretextDirectiveText(node: any) {
  if (typeof node.value === "string" && node.value.trim()) {
    return node.value.trim()
  }

  const children = Array.isArray(node.children) ? node.children : []
  const text = children
    .map((child: { value?: unknown }) =>
      typeof child.value === "string" ? child.value : ""
    )
    .join("")
    .trim()
  return text || null
}

function normalizePretextDirectiveComponentName(
  name: unknown
): PretextComponentKind | null {
  const normalized = String(name ?? "").toLowerCase()
  for (const [componentName, definition] of Object.entries(
    PRETEXT_COMPONENT_REGISTRY
  )) {
    if (definition.directiveName === normalized) {
      return componentName as PretextComponentKind
    }
  }
  return null
}

function isPretextDirectiveComponentName(name: unknown) {
  return normalizePretextDirectiveComponentName(name) != null
}

function parsePretextComponentAttributes(
  attributes: Record<string, unknown> | null | undefined
): PretextComponentProps | null {
  const props: PretextComponentProps = {}
  const parsedProps = props as Record<string, string>

  for (const [propName, propValue] of Object.entries(attributes ?? {})) {
    if (!isSafePretextComponentPropName(propName)) return null
    if (typeof propValue !== "string") return null
    parsedProps[propName] = propValue
  }

  return props
}

function parsePretextComponentProps(
  name: PretextComponentKind,
  props: Record<string, unknown>
): PretextComponentProps | null {
  const definition = PRETEXT_COMPONENT_REGISTRY[name]
  const parsed: PretextComponentProps = {}
  const parsedProps = parsed as Record<string, string>

  for (const [propName, propValue] of Object.entries(props)) {
    if (!isSafePretextComponentPropName(propName)) return null
    const propDefinition = (
      definition.props as Record<string, PretextComponentPropSchema>
    )[propName]
    if (!propDefinition) return null
    if (typeof propValue !== "string") return null
    if (propDefinition.values && !propDefinition.values.includes(propValue)) {
      return null
    }
    parsedProps[propName] = propValue
  }

  return parsed
}

function isPretextComponentKind(name: string): name is PretextComponentKind {
  return name in PRETEXT_COMPONENT_REGISTRY
}

function isSafePretextComponentPropName(propName: string) {
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

function remarkPretextComponentDirectives() {
  return function transform(tree: unknown) {
    visit(tree as any, ["leafDirective", "textDirective"], (node: any) => {
      const component = parsePretextDirectiveComponent(node)
      if (!component) {
        if (isPretextDirectiveComponentName(node.name)) {
          node.type = "text"
          node.value = serializePretextDirectiveFallback(node)
          node.children = []
          delete node.data
        }
        return
      }

      node.type = "pretextComponentDirective"
      node.data = {
        ...node.data,
        hName: "div",
        hProperties: {
          ...node.data?.hProperties,
          dataPretextComponentName: component.name,
          dataPretextComponentProps: JSON.stringify(component.props),
        },
      }
      node.children = []
      delete node.value
    })
  }
}

function serializePretextDirectiveFallback(node: any) {
  const prefix = node.type === "textDirective" ? ":" : "::"
  const text = extractPretextDirectiveText(node)
  const label = text ? `[${text}]` : ""
  return `${prefix}${node.name ?? ""}${label}${serializePretextDirectiveAttributes(
    node.attributes
  )}`
}

function serializePretextDirectiveAttributes(
  attributes: Record<string, unknown> | null | undefined
) {
  const entries = Object.entries(attributes ?? {})
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name, value]) => `${name}="${value.replace(/"/g, '\\"')}"`)

  return entries.length ? `{${entries.join(" ")}}` : ""
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
