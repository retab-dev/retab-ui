"use client"

import * as React from "react"
import type { Components } from "react-markdown"

import {
  MarkdownCallout,
  markdownCalloutKindFromProps,
  markdownCalloutTitleFromProps,
} from "./markdown-document-callouts"
import {
  MarkdownCodeCopyButton,
  MarkdownTableCopyButton,
} from "./markdown-document-copy"
import {
  type MarkdownDocumentPage,
  type MarkdownLineRange,
} from "./markdown-document-model"
import {
  sanitizeMarkdownImageUrl,
  sanitizeMarkdownUrl,
} from "./markdown-document-url-policy"

export function createMarkdownDocumentRenderers({
  headingIdsByLine,
  highlightRange,
  page,
}: {
  headingIdsByLine: ReadonlyMap<number, string>
  highlightRange: MarkdownLineRange | null
  page: MarkdownDocumentPage
}): Components {
  const sourceLineFromNode = (node: unknown) =>
    absoluteSourceLine(page, relativeSourceLine(node))
  const highlightedClassName = (node: unknown) =>
    isSourceLineHighlighted(sourceLineFromNode(node), highlightRange)
      ? " bg-primary/12 ring-1 ring-primary/30 ring-inset"
      : ""
  const headingOrdinalBySlug = new Map<string, number>()
  const headingId = (node: unknown, children: React.ReactNode) =>
    headingIdForNode({ headingIdsByLine, node, page }) ??
    nextHeadingId(extractReactText(children), headingOrdinalBySlug)

  return {
    a: ({ node: _node, href, children, ...props }) => {
      const safeHref = sanitizeMarkdownUrl(href ?? "")
      if (!safeHref) return <span>{children}</span>
      const isFragment = safeHref.startsWith("#")
      return (
        <a
          className="font-medium text-primary underline underline-offset-2"
          {...props}
          href={safeHref}
          rel={isFragment ? undefined : "noopener noreferrer"}
          target={isFragment ? undefined : "_blank"}
        >
          {children}
        </a>
      )
    },
    br: ({ node: _node, ...props }) => <br {...props} />,
    blockquote: ({ node, ...props }) => (
      <blockquote
        className={`my-3 border-l-2 border-border pl-3 text-muted-foreground italic${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      />
    ),
    code: ({ node: _node, className, children, ...props }) => (
      <code
        className={`rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] ${className ?? ""}`}
        {...props}
      >
        {children}
      </code>
    ),
    del: ({ node: _node, ...props }) => (
      <del className="text-muted-foreground" {...props} />
    ),
    details: ({ node, ...props }) => (
      <details
        className={`my-3 rounded-lg border bg-muted/20 px-3 py-2${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      />
    ),
    div: ({ node, children, ...props }) => {
      const calloutKind = markdownCalloutKindFromProps(props)
      if (!calloutKind) {
        return <div {...props}>{children}</div>
      }
      return (
        <MarkdownCallout
          kind={calloutKind}
          title={markdownCalloutTitleFromProps(props)}
          className={highlightedClassName(node)}
          sourceLine={sourceLineFromNode(node)}
        >
          {children}
        </MarkdownCallout>
      )
    },
    figure: ({ node, ...props }) => (
      <figure
        className={`my-3 overflow-hidden rounded-lg border bg-muted/50${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      />
    ),
    h1: ({ node, children, ...props }) => (
      <h1
        id={headingId(node, children)}
        className={`mt-4 mb-2 text-[1.55em] leading-tight font-semibold first:mt-0${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ node, children, ...props }) => (
      <h2
        id={headingId(node, children)}
        className={`mt-4 mb-2 text-[1.3em] leading-snug font-semibold first:mt-0${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ node, children, ...props }) => (
      <h3
        id={headingId(node, children)}
        className={`mt-3 mb-1.5 text-[1.1em] leading-snug font-semibold first:mt-0${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      >
        {children}
      </h3>
    ),
    h4: ({ node, children, ...props }) => (
      <h4
        id={headingId(node, children)}
        className={`mt-3 mb-1.5 text-[1em] leading-snug font-medium first:mt-0${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      >
        {children}
      </h4>
    ),
    h5: ({ node, children, ...props }) => (
      <h5
        id={headingId(node, children)}
        className={`mt-3 mb-1.5 text-[0.95em] leading-snug font-medium first:mt-0${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      >
        {children}
      </h5>
    ),
    h6: ({ node, children, ...props }) => (
      <h6
        id={headingId(node, children)}
        className={`mt-3 mb-1.5 text-[0.9em] leading-snug font-medium text-muted-foreground first:mt-0${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      >
        {children}
      </h6>
    ),
    hr: ({ node, ...props }) => (
      <hr
        className={`my-4 border-border${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      />
    ),
    img: ({ node, alt, src, title, ...props }) => (
      <MarkdownImage
        alt={alt ?? ""}
        className={highlightedClassName(node)}
        sourceLine={sourceLineFromNode(node)}
        src={src ?? ""}
        title={title}
        {...props}
      />
    ),
    input: ({ node: _node, ...props }) => (
      <input
        className="mr-2 size-3.5 rounded border-border align-[-0.15em]"
        readOnly
        {...props}
      />
    ),
    kbd: ({ node: _node, ...props }) => (
      <kbd
        className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.78em] shadow-xs"
        {...props}
      />
    ),
    li: ({ node, ...props }) => (
      <li
        className={`leading-relaxed${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      />
    ),
    mark: ({ node: _node, ...props }) => (
      <mark
        className="rounded bg-yellow-200/70 px-1 text-foreground"
        {...props}
      />
    ),
    ol: ({ node, ...props }) => (
      <ol
        className={`my-2 ml-5 list-decimal space-y-1${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      />
    ),
    p: ({ node, ...props }) => (
      <p
        className={`my-2 leading-relaxed${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      />
    ),
    pre: ({ node, children }) => {
      const sourceLine = sourceLineFromNode(node)
      const text = extractReactText(children).replace(/\n$/, "")
      const language = codeLanguage(children)
      return (
        <div
          className={`group relative my-3 overflow-hidden rounded-lg border bg-muted/50${highlightedClassName(node)}`}
          data-source-line={sourceLine}
        >
          <div className="flex h-8 items-center gap-2 border-b bg-muted/60 px-3">
            {language ? (
              <span className="text-xs font-medium text-muted-foreground">
                {language}
              </span>
            ) : null}
            <MarkdownCodeCopyButton text={text} />
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-[0.85em] leading-relaxed">
            {children}
          </pre>
        </div>
      )
    },
    section: ({ node, className, ...props }) => (
      <section
        className={`mt-6 border-t pt-4 text-[0.9em] text-muted-foreground ${className ?? ""}${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      />
    ),
    strong: ({ node: _node, ...props }) => (
      <strong className="font-semibold" {...props} />
    ),
    summary: ({ node: _node, ...props }) => (
      <summary className="cursor-pointer font-medium" {...props} />
    ),
    sup: ({ node: _node, ...props }) => (
      <sup className="text-[0.72em] leading-none" {...props} />
    ),
    table: ({ node, ...props }) => {
      const sourceLine = sourceLineFromNode(node)
      const tableMarkdown =
        page.blocks.find(
          (block) =>
            block.kind === "table" &&
            sourceLine >= block.blockStartLine &&
            sourceLine <= block.blockEndLine
        )?.markdown ?? ""
      return (
        <div
          className={`group relative my-3 overflow-x-auto rounded-lg border${highlightedClassName(node)}`}
          data-source-line={sourceLine}
        >
          <MarkdownTableCopyButton markdown={tableMarkdown} />
          <table
            className="w-full border-collapse text-[0.85em]"
            data-markdown-table
            {...props}
          />
        </div>
      )
    },
    tbody: ({ node: _node, ...props }) => <tbody {...props} />,
    td: ({ node: _node, ...props }) => (
      <td
        className="border-b border-border px-3 py-1.5 align-top tabular-nums [&[align=right]]:text-right"
        {...props}
      />
    ),
    th: ({ node: _node, ...props }) => (
      <th
        className="border-b border-border px-3 py-1.5 text-left font-medium [&[align=right]]:text-right"
        scope="col"
        {...props}
      />
    ),
    thead: ({ node: _node, ...props }) => (
      <thead className="bg-muted/60" {...props} />
    ),
    tr: ({ node: _node, ...props }) => <tr {...props} />,
    ul: ({ node, ...props }) => (
      <ul
        className={`my-2 ml-5 list-disc space-y-1${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
      />
    ),
  }
}

function MarkdownImage({
  alt,
  className,
  sourceLine,
  src,
  title,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  sourceLine: number
}) {
  const [status, setStatus] = React.useState<"failed" | "idle">("idle")
  const safeSrc = typeof src === "string" ? sanitizeMarkdownImageUrl(src) : ""
  const label = alt || safeSrc || "Markdown image"

  if (!safeSrc || status === "failed") {
    return (
      <span
        className={`my-3 flex min-h-20 items-center rounded-lg border bg-muted/40 px-4 text-sm text-muted-foreground ${className}`}
        data-image-state={safeSrc ? "failed" : "blocked"}
        data-source-line={sourceLine}
        role="img"
        aria-label={label}
      >
        {label}
      </span>
    )
  }

  return (
    <img
      alt={alt}
      className={`my-3 max-h-[480px] rounded-lg border bg-muted object-contain ${className}`}
      data-image-state="idle"
      data-source-line={sourceLine}
      src={safeSrc}
      title={title}
      onError={() => setStatus("failed")}
      {...props}
    />
  )
}

function headingIdForNode({
  headingIdsByLine,
  node,
  page,
}: {
  headingIdsByLine: ReadonlyMap<number, string>
  node: unknown
  page: MarkdownDocumentPage
}) {
  return headingIdsByLine.get(
    absoluteSourceLine(page, relativeSourceLine(node))
  )
}

function nextHeadingId(text: string, registry: Map<string, number>) {
  const base = slugifyHeading(text) || "section"
  const count = registry.get(base) ?? 0
  registry.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
}

function relativeSourceLine(node: unknown) {
  const position = (node as { position?: { start?: { line?: number } } })
    ?.position
  const line = position?.start?.line
  return Number.isFinite(line) && line ? line : 1
}

function absoluteSourceLine(page: MarkdownDocumentPage, relativeLine: number) {
  return (
    page.sourceLineByRenderedLine?.get(relativeLine) ??
    page.pageStartLine + relativeLine - 1
  )
}

function isSourceLineHighlighted(
  sourceLine: number,
  range: MarkdownLineRange | null
) {
  return Boolean(range && sourceLine >= range.start && sourceLine <= range.end)
}

function extractReactText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractReactText).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractReactText(node.props.children)
  }
  return ""
}

function codeLanguage(node: React.ReactNode): string | null {
  if (
    !React.isValidElement<{
      className?: string
      "data-language"?: string
    }>(node)
  ) {
    if (Array.isArray(node)) return node.map(codeLanguage).find(Boolean) ?? null
    return null
  }
  const className = node.props.className ?? ""
  return (
    node.props["data-language"] ??
    className.match(/language-([^\s]+)/)?.[1] ??
    null
  )
}
