"use client"

import * as React from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { visit } from "unist-util-visit"

import { cn } from "@/lib/utils"

import type { PretextMarkdownPage } from "./pretext-markdown-document-model"

const ALERT_LABELS = {
  caution: "Caution:",
  important: "Important:",
  note: "Note:",
  tip: "Tip:",
  warning: "Warning:",
} as const

type AlertKind = keyof typeof ALERT_LABELS

const EMOJI_SHORTCODES: Record<string, string> = {
  ":check:": "✓",
  ":sparkles:": "✨",
  ":warning:": "⚠",
  ":white_check_mark:": "✅",
  ":x:": "✕",
}

export function PretextMarkdownPageRenderer({
  page,
}: {
  page: PretextMarkdownPage
}) {
  const remarkPlugins = React.useMemo(
    () => [
      remarkPretextHeadingIds(page.headingIds),
      remarkPretextGithubAlerts,
      remarkPretextProseTransforms,
      remarkGfm,
    ],
    [page.headingIds]
  )

  if (page.kind === "frontmatter") {
    return (
      <section
        aria-label="Frontmatter"
        className="rounded-md border bg-muted/40 p-4 font-mono text-[13px] leading-6 text-muted-foreground"
        data-pretext-markdown-frontmatter=""
      >
        <pre className="m-0 whitespace-pre-wrap">
          <code>{page.markdown}</code>
        </pre>
      </section>
    )
  }

  return (
    <div className="pretext-markdown-page-content min-w-0 text-[16px] leading-7 text-foreground">
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={remarkPlugins}
      >
        {page.markdown}
      </ReactMarkdown>
    </div>
  )
}

const markdownComponents = {
  h1: ({ className, children, node: _node, ...props }) => (
    <h1
      className={cn(
        "mt-0 mb-5 text-3xl font-semibold tracking-normal text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ className, children, node: _node, ...props }) => (
    <h2
      className={cn(
        "mt-9 mb-4 text-2xl font-semibold tracking-normal text-foreground first:mt-0",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ className, children, node: _node, ...props }) => (
    <h3
      className={cn(
        "mt-7 mb-3 text-xl font-semibold tracking-normal text-foreground first:mt-0",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ className, children, node: _node, ...props }) => (
    <h4
      className={cn(
        "mt-6 mb-2 text-lg font-semibold tracking-normal text-foreground first:mt-0",
        className
      )}
      {...props}
    >
      {children}
    </h4>
  ),
  p: ({ className, node: _node, ...props }) => (
    <p className={cn("my-4 leading-7 first:mt-0", className)} {...props} />
  ),
  a: ({ className, href, node: _node, ...props }) => {
    const external = href && !href.startsWith("#")
    return (
      <a
        className={cn("font-medium underline underline-offset-4", className)}
        href={href}
        rel={external ? "noopener noreferrer" : undefined}
        target={external ? "_blank" : undefined}
        {...props}
      />
    )
  },
  blockquote: ({ className, node, children, ...props }) => {
    const kind = readAlertKind(node)
    if (kind) {
      return (
        <aside
          className={cn(
            "my-5 rounded-md border border-l-4 bg-muted/30 px-4 py-3",
            alertClassName(kind),
            className
          )}
          data-pretext-alert-kind={kind}
          {...props}
        >
          <p className="mb-2 font-semibold">{ALERT_LABELS[kind]}</p>
          <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {children}
          </div>
        </aside>
      )
    }

    return (
      <blockquote
        className={cn(
          "my-5 border-l-4 border-border pl-4 text-muted-foreground",
          className
        )}
        {...props}
      >
        {children}
      </blockquote>
    )
  },
  ul: ({ className, node: _node, ...props }) => (
    <ul className={cn("my-4 ml-6 list-disc space-y-1", className)} {...props} />
  ),
  ol: ({ className, node: _node, ...props }) => (
    <ol
      className={cn("my-4 ml-6 list-decimal space-y-1", className)}
      {...props}
    />
  ),
  li: ({ className, node: _node, ...props }) => (
    <li className={cn("pl-1 leading-7", className)} {...props} />
  ),
  table: ({ className, node: _node, ...props }) => (
    <div className="my-5 overflow-x-auto rounded-md border">
      <table
        className={cn("w-full border-collapse text-left text-sm", className)}
        {...props}
      />
    </div>
  ),
  thead: ({ className, node: _node, ...props }) => (
    <thead className={cn("bg-muted/60", className)} {...props} />
  ),
  tr: ({ className, node: _node, ...props }) => (
    <tr className={cn("border-b last:border-b-0", className)} {...props} />
  ),
  th: ({ className, node: _node, ...props }) => (
    <th
      className={cn("px-3 py-2 align-top font-semibold", className)}
      {...props}
    />
  ),
  td: ({ className, node: _node, ...props }) => (
    <td className={cn("px-3 py-2 align-top", className)} {...props} />
  ),
  pre: ({ className, children, node: _node, ...props }) => (
    <pre
      className={cn(
        "my-5 overflow-x-auto rounded-md border bg-muted/50 p-4 text-sm leading-6",
        className
      )}
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ className, children, node: _node, ...props }) => (
    <code
      className={cn(
        "rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]",
        className
      )}
      {...props}
    >
      {children}
    </code>
  ),
  hr: ({ className, node: _node, ...props }) => (
    <hr className={cn("my-8 border-border", className)} {...props} />
  ),
  img: ({ className, alt, node: _node, ...props }) => (
    <img
      className={cn("my-5 max-w-full rounded-md border", className)}
      alt={alt ?? ""}
      loading="lazy"
      {...props}
    />
  ),
} satisfies Components

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

function readAlertKind(node: unknown): AlertKind | null {
  const properties =
    node && typeof node === "object" && "properties" in node
      ? (node.properties as Record<string, unknown>)
      : null
  const value = properties?.dataPretextAlertKind
  return typeof value === "string" && value in ALERT_LABELS
    ? (value as AlertKind)
    : null
}

function alertClassName(kind: AlertKind) {
  switch (kind) {
    case "caution":
      return "border-l-red-500"
    case "important":
      return "border-l-violet-500"
    case "note":
      return "border-l-sky-500"
    case "tip":
      return "border-l-emerald-500"
    case "warning":
      return "border-l-amber-500"
  }
}
