"use client"

import type { Options as ReactMarkdownOptions } from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypePrettyCode from "rehype-pretty-code"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, {
  defaultSchema,
  type Options as RehypeSanitizeOptions,
} from "rehype-sanitize"
import remarkBreaks from "remark-breaks"
import remarkDirective from "remark-directive"
import remarkGemoji from "remark-gemoji"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkSmartypants from "remark-smartypants"
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
  type?: "boolean" | "display" | "number" | "string"
  values?: readonly string[]
}

type PretextComponentRegistryEntry = {
  directiveName: string
  props: Record<string, PretextComponentPropSchema>
}
type MarkdownPluginList = NonNullable<ReactMarkdownOptions["remarkPlugins"]>

export const PRETEXT_COMPONENT_REGISTRY = {
  Accordion: {
    directiveName: "accordion",
    props: {
      title: {},
    },
  },
  Badge: {
    directiveName: "badge",
    props: {
      label: {},
      tone: { values: ["danger", "info", "success", "warning"] },
      value: {},
    },
  },
  Callout: {
    directiveName: "callout",
    props: {
      kind: {
        values: [
          "caution",
          "danger",
          "important",
          "info",
          "note",
          "tip",
          "warning",
        ],
      },
      title: {},
    },
  },
  Image: {
    directiveName: "image",
    props: {
      alt: {},
      label: {},
      src: {},
      title: {},
    },
  },
  Diagram: {
    directiveName: "diagram",
    props: {
      caption: {},
      source: {},
      title: {},
      type: { values: ["mermaid"] },
    },
  },
  Metric: {
    directiveName: "metric",
    props: {
      label: {},
      value: { type: "display" },
    },
  },
  Tab: {
    directiveName: "tab",
    props: {
      title: {},
    },
  },
  Tabs: {
    directiveName: "tabs",
    props: {
      label: {},
    },
  },
  Video: {
    directiveName: "video",
    props: {
      controls: { type: "boolean" },
      label: {},
      loop: { type: "boolean" },
      muted: { type: "boolean" },
      src: {},
      title: {},
    },
  },
} as const satisfies Record<string, PretextComponentRegistryEntry>

export type PretextComponentKind = keyof typeof PRETEXT_COMPONENT_REGISTRY
type PretextComponentPropName = {
  [Kind in PretextComponentKind]: keyof (typeof PRETEXT_COMPONENT_REGISTRY)[Kind]["props"]
}[PretextComponentKind]
export type PretextComponentPropValue = boolean | number | string
export type PretextComponentProps = Partial<
  Record<PretextComponentPropName, PretextComponentPropValue>
>
export type PretextComponent = {
  name: PretextComponentKind
  props: PretextComponentProps
}

export type PretextComponentFallback = {
  componentName: string
  reason: string
  source: string
}

const URL_CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/
const URL_SCHEME_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*):/
const URL_BACKSLASH_PATTERN = /[\\\uFE68\uFF3C\u2216]/
const URL_CONFUSABLE_DELIMITER_PATTERN =
  /[\u02D0\u0589\u05C3\u0703\u0704\u16EC\u1803\u1809\u205A\u2236\uA789\uFE13\uFE55\uFF1A\u2044\u2215\u2571\u27CB\u29F8\uFF0F]/
const ALLOWED_LINK_PROTOCOLS = new Set(["http", "https", "mailto"])
export type PretextMarkdownSvgSanitizer = {
  sanitize: (
    source: string,
    options: typeof PRETEXT_MARKDOWN_SVG_SANITIZE_OPTIONS
  ) => string
}

export const PRETEXT_MARKDOWN_SVG_SANITIZE_OPTIONS = {
  ADD_ATTR: [
    "aria-label",
    "aria-labelledby",
    "data-source",
    "data-testid",
    "role",
  ],
  FORBID_TAGS: [
    "a",
    "animate",
    "audio",
    "canvas",
    "embed",
    "foreignObject",
    "iframe",
    "image",
    "link",
    "object",
    "set",
    "script",
    "style",
    "use",
    "video",
  ],
  FORBID_ATTR: ["href", "style", "xlink:href"],
  SANITIZE_NAMED_PROPS: true,
  USE_PROFILES: { svg: true, svgFilters: true },
} as const
export const PRETEXT_MARKDOWN_KATEX_OPTIONS = {
  maxExpand: 1000,
  maxSize: 10,
  strict: "ignore",
  trust: false,
} as const

export const PRETEXT_MARKDOWN_REHYPE_PLUGINS: MarkdownPluginList = [
  rehypeRaw,
  rehypePretextMarkdownInputPolicy,
  rehypePretextMarkdownCodeMeta,
  [rehypeSanitize, createPretextMarkdownSanitizeSchema()],
  [rehypeKatex, PRETEXT_MARKDOWN_KATEX_OPTIONS],
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

export const PRETEXT_MARKDOWN_SYNC_REHYPE_PLUGINS: MarkdownPluginList = [
  rehypeRaw,
  rehypePretextMarkdownInputPolicy,
  rehypePretextMarkdownCodeMeta,
  [rehypeSanitize, createPretextMarkdownSanitizeSchema()],
  [rehypeKatex, PRETEXT_MARKDOWN_KATEX_OPTIONS],
]

export function createPretextMarkdownRemarkPlugins(
  headingIds: readonly string[]
): MarkdownPluginList {
  return [
    remarkDirective,
    remarkPretextHeadingIds(headingIds),
    remarkPretextCodeMeta,
    remarkPretextStripRawInternalMetadata,
    remarkPretextComponentMarkdown,
    remarkPretextDefinitionLists,
    remarkSmartypants,
    remarkRestorePretextComponentMarkdownFallbacks,
    remarkPretextDirectiveCallouts,
    remarkPretextComponentDirectives,
    remarkPretextGithubAlerts,
    remarkPretextProseTransforms,
    remarkGemoji,
    remarkGfm,
    remarkBreaks,
    remarkMath,
  ]
}

export function sanitizePretextMarkdownUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (URL_CONTROL_CHARACTER_PATTERN.test(trimmed)) return ""
  if (URL_BACKSLASH_PATTERN.test(trimmed)) return ""
  if (URL_CONFUSABLE_DELIMITER_PATTERN.test(trimmed)) return ""

  const decoded = decodePretextMarkdownUrl(trimmed).trim()
  if (!decoded || URL_CONTROL_CHARACTER_PATTERN.test(decoded)) return ""
  if (URL_BACKSLASH_PATTERN.test(decoded)) return ""
  if (URL_CONFUSABLE_DELIMITER_PATTERN.test(decoded)) return ""

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
  if (isPretextMarkdownSvgResourceUrl(safeUrl)) return ""
  return safeUrl
}

export function sanitizePretextMarkdownMediaUrl(value: string) {
  const safeUrl = sanitizePretextMarkdownImageUrl(value)
  if (!safeUrl) return ""
  if (isPretextMarkdownSvgResourceUrl(safeUrl)) return ""
  return safeUrl
}

export function sanitizePretextMarkdownSvg(
  svg: string,
  sanitizer: PretextMarkdownSvgSanitizer
) {
  const sanitized = sanitizer
    .sanitize(svg, PRETEXT_MARKDOWN_SVG_SANITIZE_OPTIONS)
    .trim()

  return /^<svg(?:\s|>)/i.test(sanitized) ? sanitized : ""
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

function isPretextMarkdownSvgResourceUrl(value: string) {
  const decoded = decodePretextMarkdownUrl(value).trim()

  try {
    const url = new URL(decoded, "https://retab.local")
    return /\.(?:svg|svgz)$/i.test(url.pathname)
  } catch {
    const pathname = decoded.split(/[?#]/, 1)[0] ?? decoded
    return /\.(?:svg|svgz)$/i.test(pathname)
  }
}

function rehypePretextMarkdownInputPolicy() {
  return function transform(tree: unknown) {
    removeUnsafePretextMarkdownInputs(tree)
  }
}

function rehypePretextMarkdownCodeMeta() {
  return function transform(tree: unknown) {
    visit(tree as any, "element", (node: any) => {
      if (node.tagName !== "code") return
      if (typeof node.data?.meta !== "string") return
      node.properties = {
        ...node.properties,
        metastring: node.data.meta,
      }
    })
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

export function readPretextComponentFallback(
  node: unknown
): PretextComponentFallback | null {
  const properties =
    node && typeof node === "object" && "properties" in node
      ? (node.properties as Record<string, unknown>)
      : null
  if (!properties) return null

  const source =
    properties.dataPretextComponentFallbackSource ??
    properties["data-pretext-component-fallback-source"]
  if (typeof source !== "string" || !source.trim()) return null

  const componentName =
    properties.dataPretextComponentFallbackName ??
    properties["data-pretext-component-fallback-name"]
  const reason =
    properties.dataPretextComponentFallbackReason ??
    properties["data-pretext-component-fallback-reason"]

  return {
    componentName:
      typeof componentName === "string" && componentName.trim()
        ? componentName
        : "Component",
    reason:
      typeof reason === "string" && reason.trim()
        ? reason
        : "Unsupported component syntax",
    source,
  }
}

export function createPretextMarkdownSanitizeSchema(): RehypeSanitizeOptions {
  return {
    ...defaultSchema,
    clobberPrefix: "user-content-",
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
        "dataPretextComponentFallbackName",
        "dataPretextComponentFallbackReason",
        "dataPretextComponentFallbackSource",
        "dataPretextDefinitionList",
        "dataPretextDefinitionDescription",
        "dataPretextDefinitionTerm",
        "dataPretextHeadingId",
      ],
      abbr: ["title"],
      code: [...(defaultSchema.attributes?.code ?? []), "metastring"],
      dfn: ["title"],
      div: [
        ...(defaultSchema.attributes?.div ?? []),
        "dataPretextCalloutKind",
        "dataPretextCalloutTitle",
        "dataPretextComponentName",
        "dataPretextComponentProps",
        "dataPretextComponentFallbackName",
        "dataPretextComponentFallbackReason",
        "dataPretextComponentFallbackSource",
      ],
      mark: ["title"],
      time: ["dateTime", "title"],
    },
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      "abbr",
      "caption",
      "cite",
      "details",
      "dd",
      "dfn",
      "dl",
      "dt",
      "figcaption",
      "figure",
      "kbd",
      "mark",
      "small",
      "sub",
      "summary",
      "sup",
      "time",
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
  const componentMatch = parsePretextComponentTag(value, "selfClosing")
  if (!componentMatch) return null

  const { attributes, name } = componentMatch
  if (!isPretextComponentKind(name)) return null

  const rawProps = parsePretextComponentAttributeString(attributes)
  if (!rawProps) return null
  const props = parsePretextComponentProps(name, rawProps)
  if (!props) return null

  return {
    name,
    props,
  }
}

function parsePretextComponentOpeningMarkdown(
  value: string
): PretextComponent | null {
  const componentMatch = parsePretextComponentTag(value, "opening")
  if (!componentMatch) return null

  const { attributes, name } = componentMatch
  if (!isPretextComponentKind(name)) return null

  const rawProps = parsePretextComponentAttributeString(attributes)
  if (!rawProps) return null
  const props = parsePretextComponentProps(name, rawProps)
  if (!props) return null

  return {
    name,
    props,
  }
}

function readPretextComponentClosingMarkdown(value: string) {
  return /^<\/([A-Z][A-Za-z0-9]*)\s*>$/.exec(value.trim())?.[1] ?? null
}

function parsePretextComponentTag(
  value: string,
  mode: "opening" | "selfClosing"
) {
  const source = value.trim()
  const nameMatch = /^<([A-Z][A-Za-z0-9]*)/.exec(source)
  if (!nameMatch) return null

  let quote: '"' | "'" | null = null
  for (let index = nameMatch[0].length; index < source.length; index += 1) {
    const char = source[index]

    if (quote) {
      if (char === quote) quote = null
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === "<") return null

    if (mode === "selfClosing" && char === "/" && source[index + 1] === ">") {
      if (source.slice(index + 2).trim() !== "") return null
      return {
        attributes: source.slice(nameMatch[0].length, index),
        name: nameMatch[1]!,
      }
    }

    if (mode === "opening" && char === ">") {
      const attributes = source.slice(nameMatch[0].length, index)
      if (attributes.trim().endsWith("/")) return null
      if (source.slice(index + 1).trim() !== "") return null
      return {
        attributes,
        name: nameMatch[1]!,
      }
    }
  }

  return null
}

function parsePretextComponentAttributeString(attributes: string) {
  const rawProps: Record<string, PretextComponentPropValue> = {}
  const propPattern =
    /\s*([A-Za-z][A-Za-z0-9_]*)(?:=(?:"([^"]*)"|'([^']*)'|\{([^{}]*)\}))?/gy
  let index = 0

  while (index < attributes.length) {
    if (attributes.slice(index).trim() === "") break

    propPattern.lastIndex = index
    const propMatch = propPattern.exec(attributes)
    if (!propMatch) return null

    const propName = propMatch[1]
    if (!isSafePretextComponentPropName(propName)) return null

    const parsedValue = parsePretextComponentAttributeValue({
      doubleQuoted: propMatch[2],
      singleQuoted: propMatch[3],
      expression: propMatch[4],
      isBare:
        propMatch[2] == null && propMatch[3] == null && propMatch[4] == null,
    })
    if (parsedValue == null) return null

    rawProps[propName] = parsedValue
    index = propPattern.lastIndex
  }

  return rawProps
}

function parsePretextComponentAttributeValue({
  doubleQuoted,
  expression,
  isBare,
  singleQuoted,
}: {
  doubleQuoted: string | undefined
  expression: string | undefined
  isBare: boolean
  singleQuoted: string | undefined
}): PretextComponentPropValue | null {
  if (doubleQuoted != null) return doubleQuoted
  if (singleQuoted != null) return singleQuoted
  if (isBare) return true
  if (expression == null) return null

  const literal = expression.trim()
  if (literal === "true") return true
  if (literal === "false") return false
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(literal)) {
    const value = Number(literal)
    return Number.isFinite(value) ? value : null
  }
  return null
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
  const parsedProps = props as Record<string, PretextComponentPropValue>

  for (const [propName, propValue] of Object.entries(attributes ?? {})) {
    if (!isSafePretextComponentPropName(propName)) return null
    if (
      typeof propValue !== "string" &&
      typeof propValue !== "number" &&
      typeof propValue !== "boolean"
    ) {
      return null
    }
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
  const parsedProps = parsed as Record<string, PretextComponentPropValue>

  for (const [propName, propValue] of Object.entries(props)) {
    if (!isSafePretextComponentPropName(propName)) return null
    const propDefinition = (
      definition.props as Record<string, PretextComponentPropSchema>
    )[propName]
    if (!propDefinition) return null
    const parsedValue = parsePretextComponentPropValue(
      propDefinition,
      propValue
    )
    if (parsedValue == null) return null
    parsedProps[propName] = parsedValue
  }

  return parsed
}

function parsePretextComponentPropValue(
  propDefinition: PretextComponentPropSchema,
  propValue: unknown
): PretextComponentPropValue | null {
  switch (propDefinition.type ?? "string") {
    case "boolean":
      if (typeof propValue === "boolean") return propValue
      if (propValue === "true") return true
      if (propValue === "false") return false
      return null
    case "display":
      return typeof propValue === "string" ||
        (typeof propValue === "number" && Number.isFinite(propValue))
        ? propValue
        : null
    case "number":
      return typeof propValue === "number" && Number.isFinite(propValue)
        ? propValue
        : null
    case "string":
      if (typeof propValue !== "string") return null
      if (propDefinition.values && !propDefinition.values.includes(propValue)) {
        return null
      }
      return propValue
  }
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

function remarkPretextCodeMeta() {
  return function transform(tree: unknown) {
    visit(tree, "code", (node: any) => {
      if (typeof node.meta !== "string" || !node.meta.trim()) return
      node.data = {
        ...node.data,
        hProperties: {
          ...node.data?.hProperties,
          metastring: node.meta,
        },
      }
    })
  }
}

function remarkPretextStripRawInternalMetadata() {
  return function transform(tree: unknown) {
    visit(tree, "html", (node: any) => {
      if (typeof node.value !== "string") return
      node.value = stripPretextInternalRawHtmlAttributes(node.value)
    })
  }
}

function stripPretextInternalRawHtmlAttributes(value: string) {
  return value.replace(
    /\s+(?:data-pretext-[\w:-]+|datapretext[\w:-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/gi,
    ""
  )
}

function remarkPretextDefinitionLists() {
  return function transform(tree: any) {
    if (!Array.isArray(tree?.children)) return

    tree.children = tree.children.map((node: any) => {
      if (node?.type !== "paragraph") return node
      return createPretextDefinitionListNode(node) ?? node
    })
  }
}

function createPretextDefinitionListNode(node: any) {
  const children = Array.isArray(node.children) ? node.children : []
  const firstChild = children[0]
  if (firstChild?.type !== "text" || typeof firstChild.value !== "string") {
    return null
  }

  const match = /^([^\n:][^\n]*)\n:[ \t]*/.exec(firstChild.value)
  const term = match?.[1]?.trim()
  if (!match || !term) return null

  if (children.length === 1) {
    const descriptions = parsePlainPretextDefinitionDescriptions(
      firstChild.value
    )
    if (descriptions?.term === term) {
      return createPretextDefinitionListHastNode({
        descriptions: descriptions.descriptions.map((description) => [
          { type: "text", value: description },
        ]),
        position: node.position,
        term,
      })
    }
  }

  const descriptionChildren = clonePretextInlineChildrenAfterTextOffset(
    children,
    match[0].length
  )
  if (!hasPretextDefinitionDescriptionContent(descriptionChildren)) return null

  return createPretextDefinitionListHastNode({
    descriptions: [descriptionChildren],
    position: node.position,
    term,
  })
}

function parsePlainPretextDefinitionDescriptions(value: string) {
  const lines = value.split("\n")
  const term = lines[0]?.trim()
  if (!term || term.startsWith(":") || lines.length < 2) return null

  const descriptions: string[] = []
  for (const line of lines.slice(1)) {
    const match = /^:[ \t]*(.*)$/.exec(line)
    if (!match) return null
    const description = match[1]?.trim()
    if (!description) return null
    descriptions.push(description)
  }

  return { descriptions, term }
}

function clonePretextInlineChildrenAfterTextOffset(
  children: readonly any[],
  offset: number
) {
  const clonedChildren: any[] = []
  let remainingOffset = offset

  for (const child of children) {
    if (child.type === "text" && typeof child.value === "string") {
      if (remainingOffset >= child.value.length) {
        remainingOffset -= child.value.length
        continue
      }

      clonedChildren.push({
        ...child,
        value: child.value.slice(remainingOffset),
      })
      remainingOffset = 0
      continue
    }

    if (remainingOffset > 0) return []
    clonedChildren.push(clonePretextMarkdownAstNode(child))
  }

  return clonedChildren
}

function clonePretextMarkdownAstNode<T>(node: T): T {
  if (!node || typeof node !== "object") return node
  if (Array.isArray(node)) {
    return node.map((item) => clonePretextMarkdownAstNode(item)) as T
  }

  const cloned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    cloned[key] = clonePretextMarkdownAstNode(value)
  }
  return cloned as T
}

function hasPretextDefinitionDescriptionContent(children: readonly any[]) {
  return children.some((child) => {
    if (child.type === "text") return Boolean(String(child.value ?? "").trim())
    return true
  })
}

function createPretextDefinitionListHastNode({
  descriptions,
  position,
  term,
}: {
  descriptions: readonly (readonly any[])[]
  position: unknown
  term: string
}) {
  return {
    type: "pretextDefinitionList",
    data: {
      hName: "dl",
      hProperties: {
        dataPretextDefinitionList: "",
      },
    },
    children: [
      {
        type: "pretextDefinitionTerm",
        data: {
          hName: "dt",
          hProperties: {
            dataPretextDefinitionTerm: "",
          },
        },
        children: [{ type: "text", value: term }],
      },
      ...descriptions.map((children) => ({
        type: "pretextDefinitionDescription",
        data: {
          hName: "dd",
          hProperties: {
            dataPretextDefinitionDescription: "",
          },
        },
        children,
      })),
    ],
    position,
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
    visit(
      tree as any,
      ["containerDirective", "leafDirective", "textDirective"],
      (node: any) => {
        const keepsChildren = node.type === "containerDirective"
        const component = parsePretextDirectiveComponent(node)
        if (!component) {
          if (isPretextDirectiveComponentName(node.name)) {
            const fallback = createPretextComponentFallbackData({
              componentName:
                normalizePretextDirectiveComponentName(node.name) ??
                "Component",
              reason: "Unsupported component directive props",
              source: serializePretextDirectiveFallback(node),
            })
            node.type = "pretextComponentFallbackDirective"
            node.data = {
              ...node.data,
              hName: "div",
              hProperties: fallback,
            }
            node.children = []
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
        if (!keepsChildren) {
          node.children = []
        }
        delete node.value
      }
    )
  }
}

function serializePretextDirectiveFallback(node: any) {
  const prefix =
    node.type === "textDirective"
      ? ":"
      : node.type === "containerDirective"
        ? ":::"
        : "::"
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
    transformPretextComponentMarkdownChildren(tree)
  }
}

function transformPretextComponentMarkdownChildren(parent: any) {
  const children = Array.isArray(parent?.children) ? parent.children : null
  if (!children) return

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index]

    if (node?.type === "html" && typeof node.value === "string") {
      const component = parsePretextComponentMarkdown(node.value)
      if (component) {
        children[index] = createPretextComponentMarkdownNode(component, [])
        continue
      }

      const opening = parsePretextComponentOpeningMarkdown(node.value)
      if (opening) {
        const closingIndex = findPretextComponentClosingIndex(
          children,
          index + 1,
          opening.name
        )
        if (closingIndex !== -1) {
          const componentChildren = children.slice(index + 1, closingIndex)
          const componentNode = createPretextComponentMarkdownNode(
            opening,
            componentChildren
          )
          children.splice(index, closingIndex - index + 1, componentNode)
          transformPretextComponentMarkdownChildren(componentNode)
          continue
        }
      }

      if (isPretextMdxLikeHtml(node.value)) {
        children[index] = createPretextComponentMarkdownFallbackNode(node.value)
        continue
      }
    }

    transformPretextComponentMarkdownChildren(node)
  }
}

function findPretextComponentClosingIndex(
  siblings: any[],
  startIndex: number,
  name: PretextComponentKind
) {
  let depth = 0

  for (let index = startIndex; index < siblings.length; index += 1) {
    const sibling = siblings[index]
    if (sibling?.type !== "html" || typeof sibling.value !== "string") continue

    const opening = parsePretextComponentOpeningMarkdown(sibling.value)
    if (opening?.name === name) {
      depth += 1
      continue
    }

    if (readPretextComponentClosingMarkdown(sibling.value) === name) {
      if (depth === 0) return index
      depth -= 1
    }
  }

  return -1
}

function createPretextComponentMarkdownNode(
  component: PretextComponent,
  children: any[]
) {
  return {
    type: "pretextComponent",
    data: {
      hName: "div",
      hProperties: {
        dataPretextComponentName: component.name,
        dataPretextComponentProps: JSON.stringify(component.props),
      },
    },
    children,
  }
}

function createPretextComponentMarkdownFallbackNode(value: string) {
  const fallback = describePretextComponentMarkdownFallback(value)
  return {
    type: "pretextComponentFallback",
    data: {
      hName: "div",
      hProperties: createPretextComponentFallbackData(fallback),
    },
    children: [],
  }
}

function describePretextComponentMarkdownFallback(
  value: string
): PretextComponentFallback {
  const source = value.trim()
  const componentName = readPretextComponentTagName(source) ?? "Component"
  return {
    componentName,
    reason: getPretextComponentFallbackReason(source, componentName),
    source,
  }
}

function createPretextComponentFallbackData(
  fallback: PretextComponentFallback
) {
  return {
    dataPretextComponentFallbackName: fallback.componentName,
    dataPretextComponentFallbackReason: fallback.reason,
    dataPretextComponentFallbackSource: fallback.source,
  }
}

function readPretextComponentTagName(value: string) {
  return /^<\/?([A-Z][A-Za-z0-9.]*)/.exec(value.trim())?.[1] ?? null
}

function getPretextComponentFallbackReason(
  source: string,
  componentName: string
) {
  if (componentName.includes(".")) {
    return "Remote or namespaced components are not supported"
  }

  if (!isPretextComponentKind(componentName)) {
    return "Unsupported component"
  }

  if (/\s\w+=\{[^{}]*(?:\(|\)|\w)[^{}]*\}/.test(source)) {
    return "Component props must be literal values"
  }

  if (/\s\{\s*\.\.\./.test(source) || /\{\s*\.\.\./.test(source)) {
    return "Spread props are not supported"
  }

  if (/\son[A-Za-z0-9_]*\s*=/.test(source)) {
    return "Event handler props are not supported"
  }

  return "Unsupported component props"
}

function remarkRestorePretextComponentMarkdownFallbacks() {
  return function transform(_tree: unknown) {}
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
      if (node.data?.pretextSkipProseTransforms) return
      if (typeof node.value === "string") {
        node.value = transformMarkdownProseText(node.value)
      }
    })
  }
}

function transformMarkdownProseText(text: string) {
  return text
    .replace(/<->/g, "↔")
    .replace(/(?<!<)->/g, "→")
    .replace(/<-+/g, "←")
    .replace(/\b1\/2\b/g, "½")
    .replace(/\b1\/4\b/g, "¼")
    .replace(/\b3\/4\b/g, "¾")
}
