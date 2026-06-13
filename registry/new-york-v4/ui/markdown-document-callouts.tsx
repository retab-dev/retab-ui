"use client"

import * as React from "react"
import type { Node } from "unist"
import { visit } from "unist-util-visit"

export type MarkdownCalloutKind =
  | "caution"
  | "danger"
  | "important"
  | "info"
  | "note"
  | "tip"
  | "warning"

export function remarkMarkdownCallouts() {
  return (tree: unknown) => {
    transformGithubAlertBlockquotes(tree)
    visit(
      tree as Node,
      ["containerDirective", "leafDirective"],
      (visitedNode) => {
        const node = visitedNode as {
          attributes?: Record<string, unknown>
          data?: Record<string, unknown>
          name?: string
        }
        const calloutKind = normalizeMarkdownCalloutKind(node.name)
        if (!calloutKind) return

        const calloutTitle =
          typeof node.attributes?.title === "string"
            ? node.attributes.title
            : markdownCalloutLabel(calloutKind)

        node.data ??= {}
        node.data.hName = "div"
        node.data.hProperties = {
          dataCalloutKind: calloutKind,
          dataCalloutTitle: calloutTitle,
        }
      }
    )
  }
}

function transformGithubAlertBlockquotes(tree: unknown) {
  visit(tree as Node, "blockquote", (visitedNode) => {
    const node = visitedNode as {
      children?: Array<{
        children?: Array<{ type?: string; value?: string }>
        type?: string
      }>
      data?: Record<string, unknown>
    }
    const firstParagraph = node.children?.[0]
    const firstText = firstParagraph?.children?.[0]
    if (firstParagraph?.type !== "paragraph" || firstText?.type !== "text") {
      return
    }

    const marker = firstText.value?.match(/^\[!(\w+)\][ \t]*(?:\r?\n)?/)
    const calloutKind = normalizeMarkdownCalloutKind(marker?.[1])
    if (!marker || !calloutKind || !firstText.value) return

    firstText.value = firstText.value.slice(marker[0].length)
    if (firstText.value.length === 0) {
      firstParagraph.children?.shift()
    }
    if (firstParagraph.children?.length === 0) {
      node.children?.shift()
    }

    node.data ??= {}
    node.data.hName = "div"
    node.data.hProperties = {
      dataCalloutKind: calloutKind,
      dataCalloutTitle: markdownCalloutLabel(calloutKind),
    }
  })
}

export function MarkdownCallout({
  children,
  className,
  kind,
  sourceLine,
  title,
}: {
  children: React.ReactNode
  className: string
  kind: MarkdownCalloutKind
  sourceLine: number
  title: string
}) {
  return (
    <aside
      className={`my-3 rounded-lg border px-3 py-2.5 ${markdownCalloutClassName(kind)}${className}`}
      data-callout-kind={kind}
      data-source-line={sourceLine}
    >
      <div className="mb-1 text-sm font-semibold">{title}</div>
      <div className="[&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
    </aside>
  )
}

export function normalizeMarkdownCalloutKind(
  value: unknown
): MarkdownCalloutKind | null {
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

export function markdownCalloutKindFromProps(props: Record<string, unknown>) {
  return normalizeMarkdownCalloutKind(props["data-callout-kind"])
}

export function markdownCalloutTitleFromProps(props: Record<string, unknown>) {
  const title = props["data-callout-title"]
  const calloutKind = markdownCalloutKindFromProps(props)
  return typeof title === "string" && title.trim()
    ? title
    : markdownCalloutLabel(calloutKind ?? "note")
}

export function markdownCalloutLabel(kind: MarkdownCalloutKind) {
  switch (kind) {
    case "caution":
      return "Caution"
    case "danger":
      return "Danger"
    case "important":
      return "Important"
    case "info":
      return "Info"
    case "note":
      return "Note"
    case "tip":
      return "Tip"
    case "warning":
      return "Warning"
  }
}

function markdownCalloutClassName(kind: MarkdownCalloutKind) {
  switch (kind) {
    case "caution":
      return "border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900/60 dark:bg-orange-950/25 dark:text-orange-100"
    case "danger":
      return "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-100"
    case "important":
      return "border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900/60 dark:bg-violet-950/25 dark:text-violet-100"
    case "info":
      return "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/25 dark:text-sky-100"
    case "note":
      return "border-border bg-muted/35 text-foreground"
    case "tip":
      return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100"
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100"
  }
}
