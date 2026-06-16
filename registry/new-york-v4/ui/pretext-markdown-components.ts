"use client"

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

export function normalizePretextCalloutKind(value: unknown): CalloutKind | null {
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

export function parsePretextComponentMarkdown(
  value: string,
  mode: "selfClosing" | "opening" = "selfClosing"
): PretextComponent | null {
  const componentMatch = parsePretextComponentTag(value, mode)
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

export function readPretextComponentClosingMarkdown(value: string) {
  return /^<\/([A-Z][A-Za-z0-9]*)\s*>$/.exec(value.trim())?.[1] ?? null
}

export function parsePretextComponentTag(
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

export function parsePretextComponentAttributeString(attributes: string) {
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

export function parsePretextComponentProps(
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

export function isPretextComponentKind(
  name: string
): name is PretextComponentKind {
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

export function remarkPretextComponentDirectives() {
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

export function remarkPretextComponentMarkdown() {
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

      const opening = parsePretextComponentMarkdown(node.value, "opening")
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

    const opening = parsePretextComponentMarkdown(sibling.value, "opening")
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

export function isPretextMdxLikeHtml(value: string) {
  const trimmed = value.trim()
  return (
    /^<\/?[A-Z][A-Za-z0-9.]*(?:\s|\/?>)/.test(trimmed) ||
    /\s\w+=\{/.test(trimmed)
  )
}
