"use client"

import * as React from "react"
import { visit } from "unist-util-visit"

type MarkdownAstNode = Parameters<typeof visit>[0]

type MarkdownComponentName =
  | "accordion"
  | "accordion-item"
  | "badge"
  | "callout"
  | "diagram"
  | "image"
  | "metric"
  | "tab"
  | "tabs"
  | "unknown"
  | "video"

const COMPONENT_NAMES = new Set<MarkdownComponentName>([
  "accordion",
  "accordion-item",
  "badge",
  "callout",
  "diagram",
  "image",
  "metric",
  "tab",
  "tabs",
  "unknown",
  "video",
])

const HTML_ELEMENT_NAMES = new Set([
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "button",
  "caption",
  "cite",
  "code",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "script",
  "section",
  "span",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
])

export function remarkMarkdownComponents() {
  return (tree: unknown) => {
    visit(
      tree as MarkdownAstNode,
      ["containerDirective", "leafDirective", "textDirective"],
      (visitedNode) => {
        const node = visitedNode as {
          attributes?: Record<string, unknown>
          data?: Record<string, unknown>
          name?: string
        }
        const componentName = normalizeMarkdownComponentName(node.name)
        if (!componentName) return

        node.data ??= {}
        node.data.hName = "div"
        node.data.hProperties = markdownComponentProperties({
          attributes: node.attributes,
          name: componentName,
        })
      }
    )
  }
}

export function rehypeMarkdownComponents() {
  return (tree: unknown) => {
    visit(tree as MarkdownAstNode, "element", (visitedNode) => {
      const node = visitedNode as {
        properties?: Record<string, unknown>
        tagName?: string
      }
      const componentName = normalizeMarkdownComponentName(node.tagName)
      if (!componentName && !isUnknownMarkdownComponentTag(node.tagName)) return
      const originalName = node.tagName

      node.tagName = "div"
      node.properties = markdownComponentProperties({
        attributes: node.properties,
        name: componentName ?? "unknown",
        originalName,
      })
    })
  }
}

export function markdownComponentNameFromProps(props: Record<string, unknown>) {
  return normalizeMarkdownComponentName(props["data-component-name"])
}

export function MarkdownComponent({
  children,
  name,
  props,
  sourceLine,
}: {
  children: React.ReactNode
  name: MarkdownComponentName
  props: Record<string, unknown>
  sourceLine: number
}) {
  switch (name) {
    case "badge":
      return (
        <span
          className="inline-flex items-center rounded-md border bg-muted px-1.5 py-0.5 text-[0.78em] font-medium"
          data-component-name={name}
          data-source-line={sourceLine}
        >
          {componentText(props, "label") || children}
        </span>
      )
    case "metric":
      return (
        <div
          className="my-3 grid max-w-sm grid-cols-[1fr_auto] gap-3 rounded-lg border bg-muted/30 px-3 py-2"
          data-component-name={name}
          data-source-line={sourceLine}
        >
          <span className="text-sm text-muted-foreground">
            {componentText(props, "label") || "Metric"}
          </span>
          <span className="font-mono text-sm font-semibold">
            {componentText(props, "value") || children || "-"}
          </span>
        </div>
      )
    case "tabs":
    case "tab":
    case "accordion":
    case "accordion-item":
      return (
        <div
          className="my-3 rounded-lg border bg-muted/20 px-3 py-2"
          data-component-name={name}
          data-source-line={sourceLine}
        >
          <div className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {componentText(props, "label") ||
              componentText(props, "title") ||
              name}
          </div>
          <div className="[&>:first-child]:mt-0 [&>:last-child]:mb-0">
            {children}
          </div>
        </div>
      )
    case "callout":
    case "diagram":
    case "image":
    case "video":
      return (
        <div
          className="my-3 rounded-lg border bg-muted/20 px-3 py-2"
          data-component-name={name}
          data-source-line={sourceLine}
        >
          <div className="mb-1 text-sm font-semibold">
            {componentText(props, "title") || name}
          </div>
          <div className="[&>:first-child]:mt-0 [&>:last-child]:mb-0">
            {children}
          </div>
        </div>
      )
    case "unknown":
      return (
        <span
          className="my-1 inline-flex flex-wrap items-baseline gap-1 rounded-md border border-dashed bg-muted/20 px-2 py-1 text-sm"
          data-component-name={name}
          data-source-line={sourceLine}
        >
          <span className="font-medium text-muted-foreground">
            Unsupported component
            {componentText(props, "source")
              ? `: ${componentText(props, "source")}`
              : null}
          </span>
          {children ? <span>{children}</span> : null}
        </span>
      )
  }
}

function markdownComponentProperties({
  attributes,
  name,
  originalName,
}: {
  attributes?: Record<string, unknown>
  name: MarkdownComponentName
  originalName?: string
}) {
  return {
    dataComponentKind: componentAttribute(attributes, "kind"),
    dataComponentLabel: componentAttribute(attributes, "label"),
    dataComponentName: name,
    dataComponentSource: originalName,
    dataComponentTitle: componentAttribute(attributes, "title"),
    dataComponentValue: componentAttribute(attributes, "value"),
  }
}

function componentAttribute(
  attributes: Record<string, unknown> | undefined,
  key: string
) {
  const value = attributes?.[key]
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined
}

function componentText(props: Record<string, unknown>, key: string) {
  const value = props[`data-component-${key}`]
  return typeof value === "string" ? value : ""
}

function normalizeMarkdownComponentName(
  value: unknown
): MarkdownComponentName | null {
  const normalized = String(value ?? "").toLowerCase()
  return COMPONENT_NAMES.has(normalized as MarkdownComponentName)
    ? (normalized as MarkdownComponentName)
    : null
}

function isUnknownMarkdownComponentTag(value: unknown) {
  const normalized = String(value ?? "").toLowerCase()
  if (!normalized || HTML_ELEMENT_NAMES.has(normalized)) return false
  return /^[a-z][a-z0-9-]*$/.test(normalized)
}
