"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { Button } from "./button"
import {
  type MarkdownDocumentPage,
  serializeMarkdownTableForClipboard,
} from "./markdown-document-model"

type CopyStatus = "copied" | "idle"

export function MarkdownDocumentPageContent({
  headingIdsByLine,
  highlightRange,
  page,
}: {
  headingIdsByLine: ReadonlyMap<number, string>
  highlightRange: { end: number; start: number } | null
  page: MarkdownDocumentPage
}) {
  const components = React.useMemo(
    () =>
      createMarkdownComponents({
        headingIdsByLine,
        highlightRange,
        page,
      }),
    [headingIdsByLine, highlightRange, page]
  )

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
      urlTransform={sanitizeMarkdownUrl}
    >
      {page.markdown}
    </ReactMarkdown>
  )
}

function createMarkdownComponents({
  headingIdsByLine,
  highlightRange,
  page,
}: {
  headingIdsByLine: ReadonlyMap<number, string>
  highlightRange: { end: number; start: number } | null
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
    nextHeadingId(extractText(children), headingOrdinalBySlug)

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
    li: ({ node, ...props }) => (
      <li
        className={`leading-relaxed${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
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
      const text = extractText(children).replace(/\n$/, "")
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
            <CodeCopyButton text={text} />
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-[0.85em] leading-relaxed">
            {children}
          </pre>
        </div>
      )
    },
    strong: ({ node: _node, ...props }) => (
      <strong className="font-semibold" {...props} />
    ),
    table: ({ node, ...props }) => {
      const sourceLine = sourceLineFromNode(node)
      const tableMarkdown =
        page.blocks.find(
          (block) =>
            block.kind === "table" &&
            sourceLine >= block.sourceStartLine &&
            sourceLine <= block.sourceEndLine
        )?.markdown ?? ""
      return (
        <div
          className={`group relative my-3 overflow-x-auto rounded-lg border${highlightedClassName(node)}`}
          data-source-line={sourceLine}
        >
          <TableCopyButton markdown={tableMarkdown} />
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
  const safeSrc = typeof src === "string" ? sanitizeImageUrl(src) : ""
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

function CodeCopyButton({ text }: { text: string }) {
  return (
    <CopyButton
      ariaLabel="Copy code block"
      copiedLabel="Copied"
      className="ml-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      text={text}
    />
  )
}

function TableCopyButton({ markdown }: { markdown: string }) {
  return (
    <CopyButton
      ariaLabel="Copy table"
      copiedLabel="Copied"
      className="absolute top-2 right-2 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      text={serializeMarkdownTableForClipboard(markdown)}
    />
  )
}

function CopyButton({
  ariaLabel,
  className,
  copiedLabel,
  text,
}: {
  ariaLabel: string
  className?: string
  copiedLabel: string
  text: string
}) {
  const [status, setStatus] = React.useState<CopyStatus>("idle")
  const timeoutRef = React.useRef<number | null>(null)

  React.useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    },
    []
  )

  const copy = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    void navigator.clipboard?.writeText(text).then(() => {
      setStatus("copied")
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null
        setStatus("idle")
      }, 1200)
    })
  }

  return (
    <Button
      aria-label={status === "copied" ? copiedLabel : ariaLabel}
      className={className}
      size="icon-sm"
      title={ariaLabel}
      type="button"
      variant="ghost"
      onClick={copy}
    >
      {status === "copied" ? <Check /> : <Copy />}
    </Button>
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
  return page.sourceStartLine + relativeLine - 1
}

function isSourceLineHighlighted(
  sourceLine: number,
  range: { end: number; start: number } | null
) {
  return Boolean(range && sourceLine >= range.start && sourceLine <= range.end)
}

function sanitizeMarkdownUrl(value: string) {
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

function sanitizeImageUrl(value: string) {
  const safeUrl = sanitizeMarkdownUrl(value)
  if (!safeUrl || safeUrl.startsWith("mailto:") || safeUrl.startsWith("#")) {
    return ""
  }
  return safeUrl
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children)
  }
  return ""
}

function codeLanguage(node: React.ReactNode): string | null {
  if (!React.isValidElement<{ className?: string }>(node)) {
    if (Array.isArray(node)) return node.map(codeLanguage).find(Boolean) ?? null
    return null
  }
  const className = node.props.className ?? ""
  return className.match(/language-([^\s]+)/)?.[1] ?? null
}
