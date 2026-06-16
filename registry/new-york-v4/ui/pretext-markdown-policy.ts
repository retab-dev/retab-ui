"use client"

import type { Options as ReactMarkdownOptions } from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypePrettyCode from "rehype-pretty-code"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import remarkBreaks from "remark-breaks"
import remarkDirective from "remark-directive"
import remarkGemoji from "remark-gemoji"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkSmartypants from "remark-smartypants"
import { visit } from "unist-util-visit"

import {
  ALERT_LABELS,
  CALLOUT_LABELS,
  isPretextComponentKind,
  normalizePretextCalloutKind,
  parsePretextComponentProps,
  remarkPretextComponentDirectives,
  remarkPretextComponentMarkdown,
  type AlertKind,
  type CalloutKind,
  type PretextComponent,
  type PretextComponentFallback,
} from "./pretext-markdown-components"
import {
  createPretextMarkdownSanitizeSchema,
  PRETEXT_MARKDOWN_KATEX_OPTIONS,
} from "./pretext-markdown-sanitize"

type MarkdownPluginList = NonNullable<ReactMarkdownOptions["remarkPlugins"]>

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

// A hast element's `properties` bag, or null for non-element nodes.
function getNodeProperties(node: unknown): Record<string, unknown> | null {
  return node && typeof node === "object" && "properties" in node
    ? (node.properties as Record<string, unknown>)
    : null
}

// hast lowercases data attributes to camelCase; read either spelling.
function readDataProp(properties: Record<string, unknown>, attribute: string) {
  const camelCase = attribute.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  )
  return properties[camelCase] ?? properties[attribute]
}

export function readPretextHeadingId(props: Record<string, unknown>) {
  const id = readDataProp(props, "data-pretext-heading-id")
  return typeof id === "string" ? id : undefined
}

export function readPretextAlertKind(node: unknown): AlertKind | null {
  const properties = getNodeProperties(node)
  const value = properties
    ? readDataProp(properties, "data-pretext-alert-kind")
    : null
  return typeof value === "string" && value in ALERT_LABELS
    ? (value as AlertKind)
    : null
}

export function readPretextCallout(
  node: unknown
): { kind: CalloutKind; title: string } | null {
  const properties = getNodeProperties(node)
  if (!properties) return null

  const kind = normalizePretextCalloutKind(
    readDataProp(properties, "data-pretext-callout-kind")
  )
  if (!kind) return null

  const title = readDataProp(properties, "data-pretext-callout-title")
  return {
    kind,
    title:
      typeof title === "string" && title.trim() ? title : CALLOUT_LABELS[kind],
  }
}

export function readPretextComponent(node: unknown): PretextComponent | null {
  const properties = getNodeProperties(node)
  if (!properties) return null

  const name = readDataProp(properties, "data-pretext-component-name")
  if (typeof name !== "string" || !isPretextComponentKind(name)) {
    return null
  }

  const serializedProps = readDataProp(
    properties,
    "data-pretext-component-props"
  )
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
  const properties = getNodeProperties(node)
  if (!properties) return null

  const source = readDataProp(
    properties,
    "data-pretext-component-fallback-source"
  )
  if (typeof source !== "string" || !source.trim()) return null

  const componentName = readDataProp(
    properties,
    "data-pretext-component-fallback-name"
  )
  const reason = readDataProp(
    properties,
    "data-pretext-component-fallback-reason"
  )

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
