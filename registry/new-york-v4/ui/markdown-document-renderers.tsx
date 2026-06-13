"use client"

import * as React from "react"
import type { Components } from "react-markdown"

import {
  MarkdownCallout,
  markdownCalloutKindFromProps,
  markdownCalloutTitleFromProps,
} from "./markdown-document-callouts"
import {
  MarkdownComponent,
  markdownComponentNameFromProps,
} from "./markdown-document-components"
import {
  MarkdownCodeCopyButton,
  MarkdownTableCopyButton,
} from "./markdown-document-copy"
import {
  type MarkdownDocumentChunk,
  type MarkdownLineRange,
} from "./markdown-document-model"
import {
  sanitizeMarkdownImageUrl,
  sanitizeMarkdownUrl,
} from "./markdown-document-url-policy"

export function createMarkdownDocumentRenderers({
  headingIdsByLine,
  highlightRange,
  chunk,
}: {
  headingIdsByLine: ReadonlyMap<number, string>
  highlightRange: MarkdownLineRange | null
  chunk: MarkdownDocumentChunk
}): Components {
  const sourceLineFromNode = (node: unknown) =>
    absoluteSourceLine(chunk, relativeSourceLine(node))
  const highlightedClassName = (node: unknown) =>
    isSourceLineHighlighted(sourceLineFromNode(node), highlightRange)
      ? " bg-primary/12 ring-1 ring-primary/30 ring-inset"
      : ""
  const headingOrdinalBySlug = new Map<string, number>()
  const headingId = (node: unknown, children: React.ReactNode) =>
    headingIdForNode({ headingIdsByLine, node, chunk }) ??
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
      if (calloutKind) {
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
      }

      const componentName = markdownComponentNameFromProps(props)
      if (componentName) {
        return (
          <MarkdownComponent
            name={componentName}
            props={props}
            sourceLine={sourceLineFromNode(node)}
          >
            {children}
          </MarkdownComponent>
        )
      }

      return <div {...props}>{children}</div>
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
        className={`mt-4 mb-2 text-[1.55em] leading-tight font-semibold first:mt-0${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
        id={headingId(node, children)}
      >
        {children}
      </h1>
    ),
    h2: ({ node, children, ...props }) => (
      <h2
        className={`mt-4 mb-2 text-[1.3em] leading-snug font-semibold first:mt-0${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
        id={headingId(node, children)}
      >
        {children}
      </h2>
    ),
    h3: ({ node, children, ...props }) => (
      <h3
        className={`mt-3 mb-1.5 text-[1.1em] leading-snug font-semibold first:mt-0${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
        id={headingId(node, children)}
      >
        {children}
      </h3>
    ),
    h4: ({ node, children, ...props }) => (
      <h4
        className={`mt-3 mb-1.5 text-[1em] leading-snug font-medium first:mt-0${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
        id={headingId(node, children)}
      >
        {children}
      </h4>
    ),
    h5: ({ node, children, ...props }) => (
      <h5
        className={`mt-3 mb-1.5 text-[0.95em] leading-snug font-medium first:mt-0${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
        id={headingId(node, children)}
      >
        {children}
      </h5>
    ),
    h6: ({ node, children, ...props }) => (
      <h6
        className={`mt-3 mb-1.5 text-[0.9em] leading-snug font-medium text-muted-foreground first:mt-0${highlightedClassName(node)}`}
        data-source-line={sourceLineFromNode(node)}
        {...props}
        id={headingId(node, children)}
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
      if (language === "mermaid") {
        return (
          <MarkdownDiagram
            className={highlightedClassName(node)}
            source={text}
            sourceLine={sourceLine}
          />
        )
      }
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
        chunk.blocks.find(
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

function MarkdownDiagram({
  className,
  source,
  sourceLine,
}: {
  className: string
  source: string
  sourceLine: number
}) {
  const immediateState = React.useMemo(
    () => renderBasicMermaidDiagram(source),
    [source]
  )
  const [state, setState] = React.useState<
    | { status: "failed"; message: string }
    | { status: "ready"; svg: string }
    | { status: "unavailable" }
  >(immediateState)
  const diagramId = React.useId().replace(/:/g, "")

  React.useLayoutEffect(() => {
    setState(immediateState)
  }, [immediateState])

  React.useEffect(() => {
    let isMounted = true
    void renderMermaidDiagram(source, `markdown-diagram-${diagramId}`).then(
      (result) => {
        if (isMounted) setState(result)
      }
    )
    return () => {
      isMounted = false
    }
  }, [diagramId, source])

  return (
    <figure
      className={`my-3 min-h-40 overflow-hidden rounded-lg border bg-muted/30${className}`}
      data-diagram-language="mermaid"
      data-diagram-state={state.status}
      data-source-line={sourceLine}
    >
      <div className="flex h-8 items-center gap-2 border-b bg-muted/60 px-3">
        <span className="text-xs font-medium text-muted-foreground">
          mermaid
        </span>
        <MarkdownCodeCopyButton text={source} />
      </div>
      {state.status === "ready" ? (
        <div
          className="overflow-x-auto p-3"
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      ) : (
        <pre className="overflow-x-auto p-3 font-mono text-[0.82em] leading-relaxed text-muted-foreground">
          {state.status === "failed"
            ? state.message
            : source}
        </pre>
      )}
    </figure>
  )
}

async function renderMermaidDiagram(source: string, id: string): Promise<
  | { status: "failed"; message: string }
  | { status: "ready"; svg: string }
> {
  try {
    const loadMermaid = new Function(
      "specifier",
      "return import(specifier)"
    ) as (specifier: string) => Promise<{
      default?: {
        initialize?: (options: Record<string, unknown>) => void
        render?: (id: string, source: string) => Promise<{ svg: string }>
      }
    }>
    const mermaidModule = await loadMermaid("mermaid")
    const mermaid = mermaidModule.default
    if (!mermaid?.render) return renderBasicMermaidDiagram(source)

    mermaid.initialize?.({
      securityLevel: "strict",
      startOnLoad: false,
      theme: "default",
    })
    const result = await mermaid.render(id, source)
    return { status: "ready", svg: result.svg }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid diagram"
    return message.includes("Cannot find") || message.includes("module")
      ? renderBasicMermaidDiagram(source)
      : { status: "failed", message }
  }
}

function renderBasicMermaidDiagram(
  source: string
): { status: "failed"; message: string } | { status: "ready"; svg: string } {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%%"))
  const header = lines[0]?.match(/^(?:graph|flowchart)\s+(TD|TB|BT|LR|RL)$/i)
  if (!header) {
    return {
      status: "failed",
      message: "Unsupported Mermaid diagram. Only graph/flowchart diagrams are rendered.",
    }
  }

  const direction = header[1]!.toUpperCase()
  const edges: Array<{ from: string; to: string }> = []
  const labels = new Map<string, string>()

  for (const line of lines.slice(1)) {
    const edge = line.match(/^(.+?)\s*(?:-->|---|==>|-.->)\s*(.+?)$/)
    if (!edge) continue
    const from = parseMermaidNode(edge[1]!)
    const to = parseMermaidNode(edge[2]!)
    labels.set(from.id, from.label)
    labels.set(to.id, to.label)
    edges.push({ from: from.id, to: to.id })
  }

  if (edges.length === 0) {
    return {
      status: "failed",
      message: "Unsupported Mermaid diagram. Add at least one graph edge.",
    }
  }

  const nodeIds = Array.from(labels.keys())
  const isHorizontal = direction === "LR" || direction === "RL"
  const nodeWidth = 132
  const nodeHeight = 42
  const gap = 56
  const width = isHorizontal
    ? nodeIds.length * nodeWidth + Math.max(0, nodeIds.length - 1) * gap + 48
    : 420
  const height = isHorizontal
    ? 132
    : nodeIds.length * nodeHeight + Math.max(0, nodeIds.length - 1) * gap + 48
  const positions = new Map(
    nodeIds.map((nodeId, index) => {
      const orderedIndex =
        direction === "RL" || direction === "BT"
          ? nodeIds.length - index - 1
          : index
      return [
        nodeId,
        {
          x: isHorizontal
            ? 24 + orderedIndex * (nodeWidth + gap)
            : (width - nodeWidth) / 2,
          y: isHorizontal
            ? (height - nodeHeight) / 2
            : 24 + orderedIndex * (nodeHeight + gap),
        },
      ] as const
    })
  )

  const edgeSvg = edges
    .map((edge) => {
      const from = positions.get(edge.from)!
      const to = positions.get(edge.to)!
      const x1 = isHorizontal ? from.x + nodeWidth : from.x + nodeWidth / 2
      const y1 = isHorizontal ? from.y + nodeHeight / 2 : from.y + nodeHeight
      const x2 = isHorizontal ? to.x : to.x + nodeWidth / 2
      const y2 = isHorizontal ? to.y + nodeHeight / 2 : to.y
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)" opacity="0.65" />`
    })
    .join("")
  const nodeSvg = nodeIds
    .map((nodeId) => {
      const position = positions.get(nodeId)!
      return `<g><rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="var(--card)" stroke="currentColor" opacity="0.9" /><text x="${position.x + nodeWidth / 2}" y="${position.y + 26}" text-anchor="middle" font-size="13" fill="currentColor">${escapeSvg(labels.get(nodeId) ?? nodeId)}</text></g>`
    })
    .join("")

  return {
    status: "ready",
    svg: `<svg role="img" aria-label="Mermaid diagram" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" opacity="0.65"/></marker></defs>${edgeSvg}${nodeSvg}</svg>`,
  }
}

function parseMermaidNode(value: string) {
  const trimmed = value.trim()
  const match =
    trimmed.match(/^([A-Za-z0-9_-]+)\s*\["(.+)"\]$/) ??
    trimmed.match(/^([A-Za-z0-9_-]+)\s*\[(.+)\]$/) ??
    trimmed.match(/^([A-Za-z0-9_-]+)\s*\((.+)\)$/)
  if (match) {
    return { id: match[1]!, label: match[2]!.trim() }
  }

  const id = trimmed.replace(/[^A-Za-z0-9_-].*$/, "")
  return { id: id || trimmed, label: id || trimmed }
}

function escapeSvg(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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
  chunk,
}: {
  headingIdsByLine: ReadonlyMap<number, string>
  node: unknown
  chunk: MarkdownDocumentChunk
}) {
  return headingIdsByLine.get(
    absoluteSourceLine(chunk, relativeSourceLine(node))
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
    .replace(/[^\p{Letter}\p{Number}_\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
}

function relativeSourceLine(node: unknown) {
  const position = (node as { position?: { start?: { line?: number } } })
    ?.position
  const line = position?.start?.line
  return Number.isFinite(line) && line ? line : 1
}

function absoluteSourceLine(chunk: MarkdownDocumentChunk, relativeLine: number) {
  return (
    chunk.sourceLineByRenderedLine?.get(relativeLine) ??
    chunk.chunkStartLine + relativeLine - 1
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
