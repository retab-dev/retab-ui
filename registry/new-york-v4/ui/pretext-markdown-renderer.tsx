"use client"

import * as React from "react"
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Link,
  RefreshCcw,
} from "lucide-react"
import { MarkdownHooks, type Components } from "react-markdown"

import { cn } from "@/lib/utils"

import { Button } from "./button"
import type { PretextMarkdownChunk } from "./pretext-markdown-document-model"
import {
  ALERT_LABELS,
  createPretextMarkdownRemarkPlugins,
  PRETEXT_MARKDOWN_REHYPE_PLUGINS,
  readPretextAlertKind,
  readPretextCallout,
  readPretextComponent,
  readPretextHeadingId,
  sanitizePretextMarkdownImageUrl,
  sanitizePretextMarkdownUrl,
  type AlertKind,
  type CalloutKind,
  type PretextComponent,
} from "./pretext-markdown-policy"

export function PretextMarkdownChunkRenderer({
  chunk,
  referenceDefinitionsMarkdown = "",
}: {
  chunk: PretextMarkdownChunk
  referenceDefinitionsMarkdown?: string
}) {
  const remarkPlugins = React.useMemo(
    () => createPretextMarkdownRemarkPlugins(chunk.headingIds),
    [chunk.headingIds]
  )

  if (chunk.kind === "frontmatter") {
    const language = chunk.frontmatterLanguage ?? "yaml"
    return (
      <section
        aria-label={`${language.toUpperCase()} frontmatter`}
        className="rounded-md border bg-muted/40 p-4 font-mono text-[13px] leading-6 text-muted-foreground"
        data-pretext-markdown-frontmatter={language}
      >
        <pre className="m-0 whitespace-pre-wrap">
          <code>{chunk.markdown}</code>
        </pre>
      </section>
    )
  }

  return (
    <div className="pretext-markdown-chunk-content min-w-0 text-[16px] leading-7 text-foreground">
      <MarkdownHooks
        components={markdownComponents}
        rehypePlugins={PRETEXT_MARKDOWN_REHYPE_PLUGINS}
        remarkRehypeOptions={{ allowDangerousHtml: true }}
        remarkPlugins={remarkPlugins}
        urlTransform={sanitizePretextMarkdownUrl}
      >
        {createPretextMarkdownRenderSource({
          markdown: chunk.markdown,
          referenceDefinitionsMarkdown,
        })}
      </MarkdownHooks>
    </div>
  )
}

function createPretextMarkdownRenderSource({
  markdown,
  referenceDefinitionsMarkdown,
}: {
  markdown: string
  referenceDefinitionsMarkdown: string
}) {
  if (!referenceDefinitionsMarkdown.trim()) return markdown
  return `${referenceDefinitionsMarkdown.trimEnd()}\n\n${markdown}`
}

const markdownComponents = {
  div: ({ className, children, node, ...props }) => {
    const callout = readPretextCallout(node)
    if (callout) {
      return (
        <PretextMarkdownCallout callout={callout} className={className}>
          {children}
        </PretextMarkdownCallout>
      )
    }

    const component = readPretextComponent(node)
    if (component) {
      return <PretextMarkdownComponent component={component} />
    }

    return (
      <div className={className} {...props}>
        {children}
      </div>
    )
  },
  h1: ({ className, children, node: _node, ...props }) => (
    <PretextMarkdownHeading
      className={className}
      level={1}
      textClassName="mt-0 mb-5 text-3xl font-semibold tracking-normal text-foreground"
      {...props}
    >
      {children}
    </PretextMarkdownHeading>
  ),
  h2: ({ className, children, node: _node, ...props }) => (
    <PretextMarkdownHeading
      className={className}
      level={2}
      textClassName="mt-9 mb-4 text-2xl font-semibold tracking-normal text-foreground first:mt-0"
      {...props}
    >
      {children}
    </PretextMarkdownHeading>
  ),
  h3: ({ className, children, node: _node, ...props }) => (
    <PretextMarkdownHeading
      className={className}
      level={3}
      textClassName="mt-7 mb-3 text-xl font-semibold tracking-normal text-foreground first:mt-0"
      {...props}
    >
      {children}
    </PretextMarkdownHeading>
  ),
  h4: ({ className, children, node: _node, ...props }) => (
    <PretextMarkdownHeading
      className={className}
      level={4}
      textClassName="mt-6 mb-2 text-lg font-semibold tracking-normal text-foreground first:mt-0"
      {...props}
    >
      {children}
    </PretextMarkdownHeading>
  ),
  h5: ({ className, children, node: _node, ...props }) => (
    <PretextMarkdownHeading
      className={className}
      level={5}
      textClassName="mt-5 mb-2 text-base font-semibold tracking-normal text-foreground first:mt-0"
      {...props}
    >
      {children}
    </PretextMarkdownHeading>
  ),
  h6: ({ className, children, node: _node, ...props }) => (
    <PretextMarkdownHeading
      className={className}
      level={6}
      textClassName="mt-5 mb-2 text-sm font-semibold tracking-normal text-muted-foreground first:mt-0"
      {...props}
    >
      {children}
    </PretextMarkdownHeading>
  ),
  p: ({ className, node: _node, ...props }) => (
    <p className={cn("my-4 leading-7 first:mt-0", className)} {...props} />
  ),
  a: ({ className, href, children, node: _node, title, ...props }) => {
    const safeHref = sanitizePretextMarkdownUrl(href ?? "")
    if (!safeHref) {
      return <span>{children}</span>
    }

    const external = isPretextMarkdownExternalLink(safeHref)
    const linkTitle = normalizePretextMarkdownLinkTitle(title)
    const footnoteRef =
      isPretextFootnoteRef(props) || isPretextFootnoteRefHref(safeHref)
    const footnoteBackref =
      isPretextFootnoteBackref(props) || isPretextFootnoteBackrefHref(safeHref)
    const footnoteText = extractReactText(children).trim()
    const ariaLabel = footnoteRef
      ? `Footnote ${footnoteText || "reference"}`
      : footnoteBackref
        ? `Back to footnote reference${footnoteText ? ` ${footnoteText}` : ""}`
        : undefined
    return (
      <a
        className={cn(
          "font-medium underline underline-offset-4",
          footnoteRef && "ml-0.5 rounded px-1 text-[0.72em] leading-none",
          footnoteBackref && "ml-1 text-muted-foreground no-underline",
          className
        )}
        href={safeHref}
        rel={external ? "noopener noreferrer" : undefined}
        target={external ? "_blank" : undefined}
        title={linkTitle}
        {...props}
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      >
        {children}
        {external ? (
          <ExternalLink
            aria-hidden="true"
            className="ml-1 inline size-3 align-[-0.1em]"
            focusable="false"
          />
        ) : null}
      </a>
    )
  },
  blockquote: ({ className, node, children, ...props }) => {
    const kind = readPretextAlertKind(node)
    if (kind) {
      return (
        <aside
          aria-label={ALERT_LABELS[kind].replace(/:$/, "")}
          className={cn(
            "my-5 rounded-md border border-l-4 bg-muted/30 px-4 py-3",
            alertClassName(kind),
            className
          )}
          data-pretext-alert-kind={kind}
          role="note"
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
  br: ({ node: _node, ...props }) => <br {...props} />,
  del: ({ className, node: _node, ...props }) => (
    <del className={cn("text-muted-foreground", className)} {...props} />
  ),
  details: ({ className, node: _node, ...props }) => (
    <details
      className={cn("my-5 rounded-md border bg-muted/25 px-4 py-3", className)}
      {...props}
    />
  ),
  summary: ({ className, node: _node, ...props }) => (
    <summary
      className={cn("cursor-pointer font-medium text-foreground", className)}
      {...props}
    />
  ),
  mark: ({ className, node: _node, ...props }) => (
    <mark
      className={cn("rounded bg-yellow-200/70 px-1 text-foreground", className)}
      {...props}
    />
  ),
  kbd: ({ className, node: _node, ...props }) => (
    <kbd
      className={cn(
        "rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] shadow-xs",
        className
      )}
      {...props}
    />
  ),
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
  input: ({ className, checked, node: _node, type, ...props }) => {
    if (type !== "checkbox") {
      return <input className={className} type={type} {...props} />
    }

    return (
      <input
        aria-label={checked ? "Completed task" : "Incomplete task"}
        checked={checked}
        className={cn(
          "mr-2 size-3.5 rounded border-border align-[-0.15em]",
          className
        )}
        readOnly
        type="checkbox"
        {...props}
      />
    )
  },
  caption: ({ className, node: _node, ...props }) => (
    <caption
      className={cn(
        "caption-top px-3 py-2 text-left text-sm font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  ),
  table: ({ className, node: _node, ...props }) => (
    <PretextMarkdownTable className={className} {...props} />
  ),
  thead: ({ className, node: _node, ...props }) => (
    <thead className={cn("bg-muted/60", className)} {...props} />
  ),
  tr: ({ className, node: _node, ...props }) => (
    <tr className={cn("border-b last:border-b-0", className)} {...props} />
  ),
  th: ({ align, className, node: _node, style, ...props }) => {
    const resolvedAlign = resolveTableCellAlignment({ align, style })
    return (
      <th
        className={cn(
          "px-3 py-2 align-top font-semibold",
          tableCellAlignmentClassName(resolvedAlign),
          className
        )}
        align={resolvedAlign}
        {...props}
      />
    )
  },
  td: ({ align, className, node: _node, style, ...props }) => {
    const resolvedAlign = resolveTableCellAlignment({ align, style })
    return (
      <td
        className={cn(
          "px-3 py-2 align-top",
          tableCellAlignmentClassName(resolvedAlign),
          className
        )}
        align={resolvedAlign}
        {...props}
      />
    )
  },
  pre: ({ className, children, node: _node, ...props }) => {
    const language = codeLanguage(children)
    const text = extractReactText(children).replace(/\n$/, "")
    if (language === "mermaid") {
      return <PretextMarkdownDiagram className={className} source={text} />
    }

    return (
      <div
        aria-label={`${language ? `${language} ` : ""}code block`}
        className={cn(
          "group my-5 overflow-hidden rounded-md border bg-muted/50",
          className
        )}
        role="group"
      >
        <div className="flex h-9 items-center gap-2 border-b bg-muted/60 px-3">
          {language ? (
            <span className="text-xs font-medium text-muted-foreground">
              {language}
            </span>
          ) : null}
          <PretextMarkdownCopyButton
            ariaLabel="Copy code block"
            className="ml-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            text={text}
          />
        </div>
        <pre
          aria-label={`${language ? `${language} ` : ""}code source`}
          className="overflow-x-auto p-4 text-sm leading-6"
          tabIndex={0}
          {...props}
        >
          {children}
        </pre>
      </div>
    )
  },
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
  section: ({ className, node: _node, ...props }) => {
    const footnoteSection = isPretextFootnoteSection(props)
    return (
      <section
        className={cn(
          "mt-8 border-t pt-4 text-sm leading-6 text-muted-foreground",
          className
        )}
        {...props}
        {...(footnoteSection ? { "aria-label": "Footnotes" } : {})}
      />
    )
  },
  sub: ({ className, node: _node, ...props }) => (
    <sub
      className={cn("align-sub text-[0.72em] leading-none", className)}
      {...props}
    />
  ),
  sup: ({ className, node: _node, ...props }) => (
    <sup
      className={cn("align-super text-[0.72em] leading-none", className)}
      {...props}
    />
  ),
  hr: ({ className, node: _node, ...props }) => (
    <hr className={cn("my-8 border-border", className)} {...props} />
  ),
  img: ({ className, alt, node: _node, src, ...props }) => (
    <PretextMarkdownImage
      className={className}
      alt={alt ?? ""}
      src={src ?? ""}
      {...props}
    />
  ),
} satisfies Components

function PretextMarkdownHeading({
  children,
  className,
  level,
  textClassName,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  level: 1 | 2 | 3 | 4 | 5 | 6
  textClassName: string
}) {
  const id = readPretextHeadingId(props)
  const HeadingTag = `h${level}` as const
  const headingText = extractReactText(children).trim() || "heading"

  return (
    <div className="group flex min-w-0 items-baseline gap-1.5">
      <HeadingTag
        className={cn(textClassName, "min-w-0", className)}
        {...props}
        id={id}
      >
        {children}
      </HeadingTag>
      {id ? (
        <PretextMarkdownCopyButton
          ariaLabel={`Copy link to ${headingText}`}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          idleIcon={<Link />}
          text={createPretextMarkdownHeadingUrl(id)}
        />
      ) : null}
    </div>
  )
}

function createPretextMarkdownHeadingUrl(id: string) {
  if (typeof window === "undefined") return `#${id}`
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}#${encodeURIComponent(id)}`
}

function PretextMarkdownCallout({
  callout,
  children,
  className,
}: {
  callout: {
    kind: CalloutKind
    title: string
  }
  children: React.ReactNode
  className: string | undefined
}) {
  return (
    <aside
      aria-label={callout.title}
      className={cn(
        "my-5 rounded-md border px-4 py-3",
        calloutClassName(callout.kind),
        className
      )}
      data-pretext-callout-kind={callout.kind}
      role="note"
    >
      <p className="mb-2 font-semibold">{callout.title}</p>
      <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </aside>
  )
}

function isPretextMarkdownExternalLink(href: string) {
  return /^https?:/i.test(href)
}

function normalizePretextMarkdownLinkTitle(title: unknown) {
  return typeof title === "string" && title.trim() ? title : undefined
}

type PretextTableCellAlignment = "center" | "left" | "right" | undefined

function resolveTableCellAlignment({
  align,
  style,
}: {
  align: React.ThHTMLAttributes<HTMLTableCellElement>["align"]
  style: React.CSSProperties | undefined
}): PretextTableCellAlignment {
  if (align === "center" || align === "left" || align === "right") return align

  const textAlign = style?.textAlign
  return textAlign === "center" || textAlign === "left" || textAlign === "right"
    ? textAlign
    : undefined
}

function tableCellAlignmentClassName(align: PretextTableCellAlignment) {
  switch (align) {
    case "center":
      return "text-center"
    case "right":
      return "text-right tabular-nums"
    default:
      return "text-left"
  }
}

function PretextMarkdownTable({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  const tableRef = React.useRef<HTMLTableElement | null>(null)
  const [copyText, setCopyText] = React.useState("")

  const updateCopyText = () => {
    const table = tableRef.current
    setCopyText(table ? serializePretextMarkdownTable(table) : "")
  }

  React.useLayoutEffect(() => {
    updateCopyText()
  })

  return (
    <div
      aria-label="Markdown table"
      className="group relative my-5 overflow-x-auto rounded-md border"
      role="region"
      tabIndex={0}
      onFocusCapture={updateCopyText}
      onMouseEnter={updateCopyText}
    >
      <PretextMarkdownCopyButton
        ariaLabel="Copy table"
        className="absolute top-2 right-2 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        text={copyText}
      />
      <table
        ref={tableRef}
        className={cn("w-full border-collapse text-left text-sm", className)}
        data-pretext-markdown-table=""
        {...props}
      />
    </div>
  )
}

function PretextMarkdownComponent({
  component,
}: {
  component: PretextComponent
}) {
  switch (component.name) {
    case "Badge": {
      const label = component.props.label ?? component.props.value ?? "Badge"
      return (
        <span
          className={cn(
            "my-3 inline-flex w-fit items-center rounded-md border px-2 py-1 text-sm font-medium",
            componentToneClassName(component.props.tone)
          )}
          data-pretext-component="Badge"
        >
          {label}
        </span>
      )
    }
    case "Metric":
      return (
        <div
          className="my-5 flex max-w-lg items-center justify-between rounded-md border bg-muted/20 px-4 py-3"
          data-pretext-component="Metric"
        >
          <span className="text-muted-foreground">
            {component.props.label ?? "Metric"}
          </span>
          <span className="text-2xl font-semibold tracking-normal">
            {component.props.value ?? "-"}
          </span>
        </div>
      )
  }
}

function componentToneClassName(tone: string | undefined) {
  switch (tone) {
    case "danger":
      return "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
    case "info":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200"
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
    default:
      return "border-border bg-muted/30 text-foreground"
  }
}

function PretextMarkdownDiagram({
  className,
  source,
}: {
  className: string | undefined
  source: string
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
    void renderMermaidDiagram(source, `pretext-markdown-diagram-${diagramId}`)
      .then((result) => {
        if (isMounted) setState(result)
      })
      .catch((error: unknown) => {
        if (!isMounted) return
        setState({
          status: "failed",
          message: error instanceof Error ? error.message : "Invalid diagram",
        })
      })
    return () => {
      isMounted = false
    }
  }, [diagramId, source])

  return (
    <figure
      aria-label="Mermaid diagram"
      className={cn(
        "my-5 min-h-40 overflow-hidden rounded-md border bg-muted/30",
        className
      )}
      data-diagram-language="mermaid"
      data-diagram-state={state.status}
      role="group"
    >
      <div className="flex h-9 items-center border-b bg-muted/60 px-3">
        <span className="text-xs font-medium text-muted-foreground">
          mermaid
        </span>
        <PretextMarkdownCopyButton
          ariaLabel="Copy diagram source"
          className="ml-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          text={source}
        />
      </div>
      {state.status === "ready" ? (
        <div
          className="overflow-x-auto p-4"
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      ) : (
        <pre
          aria-label="Mermaid diagram source"
          className="overflow-x-auto p-4 font-mono text-[0.82em] leading-relaxed text-muted-foreground"
          tabIndex={0}
        >
          {state.status === "failed" ? state.message : source}
        </pre>
      )}
    </figure>
  )
}

function PretextMarkdownCopyButton({
  ariaLabel,
  className,
  idleIcon,
  text,
}: {
  ariaLabel: string
  className?: string
  idleIcon?: React.ReactNode
  text: string
}) {
  const [status, setStatus] = React.useState<"copied" | "failed" | "idle">(
    "idle"
  )
  const timeoutRef = React.useRef<number | null>(null)

  React.useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    },
    []
  )

  const copyText = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)

    const resetStatus = () => {
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null
        setStatus("idle")
      }, 1200)
    }

    try {
      const result = navigator.clipboard?.writeText(text)
      void Promise.resolve(result)
        .then(() => {
          setStatus("copied")
          resetStatus()
        })
        .catch(() => {
          setStatus("failed")
          resetStatus()
        })
    } catch {
      setStatus("failed")
      resetStatus()
    }
  }

  const label =
    status === "copied"
      ? "Copied"
      : status === "failed"
        ? "Copy failed"
        : ariaLabel

  return (
    <Button
      aria-label={label}
      className={className}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
      onClick={copyText}
    >
      {status === "copied" ? (
        <Check />
      ) : status === "failed" ? (
        <AlertCircle />
      ) : (
        (idleIcon ?? <Copy />)
      )}
    </Button>
  )
}

function PretextMarkdownImage({
  alt,
  className,
  title,
  src,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const safeSrc =
    typeof src === "string" ? sanitizePretextMarkdownImageUrl(src) : ""
  const [state, setState] = React.useState<{
    height: number | null
    status: "failed" | "loading" | "ready"
    width: number | null
  }>({ height: null, status: "loading", width: null })
  const [retryVersion, setRetryVersion] = React.useState(0)
  const label = alt || safeSrc || "Markdown image"
  const caption = title || null

  React.useEffect(() => {
    setState({ height: null, status: "loading", width: null })
  }, [safeSrc])

  if (!safeSrc) {
    return (
      <PretextMarkdownImagePlaceholder
        className={className}
        label={label}
        state="blocked"
      />
    )
  }

  if (state.status === "failed") {
    return (
      <PretextMarkdownImagePlaceholder
        className={className}
        label={label}
        state="failed"
        onRetry={() => {
          setState({ height: null, status: "loading", width: null })
          setRetryVersion((version) => version + 1)
        }}
      />
    )
  }

  const aspectRatio =
    state.width && state.height ? `${state.width} / ${state.height}` : undefined

  return (
    <span
      className={cn(
        "my-5 inline-block w-fit max-w-full overflow-hidden rounded-md border bg-muted/20 align-top",
        className
      )}
      data-pretext-image-state={state.status}
      style={{ aspectRatio }}
    >
      <span className="relative block max-w-full">
        {state.status === "loading" ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 block min-h-32 animate-pulse bg-muted/45"
          />
        ) : null}
        <img
          key={`${safeSrc}:${retryVersion}`}
          {...props}
          alt={alt ?? ""}
          className={cn(
            "block max-h-[70vh] max-w-full bg-card object-contain",
            state.status === "loading" && "min-h-32 opacity-0"
          )}
          loading="lazy"
          src={safeSrc}
          title={title}
          onError={() =>
            setState((current) => ({ ...current, status: "failed" }))
          }
          onLoad={(event) => {
            const image = event.currentTarget
            setState({
              height: image.naturalHeight || null,
              status: "ready",
              width: image.naturalWidth || null,
            })
          }}
        />
      </span>
      {caption ? (
        <span className="block border-t bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {caption}
        </span>
      ) : null}
    </span>
  )
}

function PretextMarkdownImagePlaceholder({
  className,
  label,
  onRetry,
  state,
}: {
  className: string | undefined
  label: string
  onRetry?: () => void
  state: "blocked" | "failed"
}) {
  if (state === "failed") {
    return (
      <span
        aria-label={`Image failed: ${label}`}
        className={cn(
          "my-5 flex min-h-24 max-w-full items-center justify-between gap-3 rounded-md border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground",
          className
        )}
        data-pretext-image-state="failed"
        role="group"
      >
        <span aria-label={label} data-pretext-image-state="failed" role="img">
          Image failed to load: {label}
        </span>
        {onRetry ? (
          <Button
            aria-label="Retry image"
            size="xs"
            type="button"
            variant="outline"
            onClick={onRetry}
          >
            <RefreshCcw />
            Retry
          </Button>
        ) : null}
      </span>
    )
  }

  return (
    <span
      aria-label={label}
      className={cn(
        "my-5 flex min-h-24 max-w-full items-center rounded-md border border-dashed bg-muted/40 px-4 text-sm text-muted-foreground",
        className
      )}
      data-pretext-image-state={state}
      role="img"
    >
      {label}
    </span>
  )
}

function calloutClassName(kind: CalloutKind) {
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

async function renderMermaidDiagram(
  source: string,
  id: string
): Promise<
  { status: "failed"; message: string } | { status: "ready"; svg: string }
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
      message:
        "Unsupported Mermaid diagram. Only graph/flowchart diagrams are rendered.",
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

function serializePretextMarkdownTable(table: HTMLTableElement) {
  return Array.from(table.rows)
    .map((row) =>
      Array.from(row.cells)
        .map((cell) => cell.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .join("\t")
    )
    .join("\n")
}

function isPretextFootnoteRef(props: Record<string, unknown>) {
  return props.dataFootnoteRef != null || props["data-footnote-ref"] != null
}

function isPretextFootnoteBackref(props: Record<string, unknown>) {
  return (
    props.dataFootnoteBackref != null || props["data-footnote-backref"] != null
  )
}

function isPretextFootnoteSection(props: Record<string, unknown>) {
  return props.dataFootnotes != null || props["data-footnotes"] != null
}

function isPretextFootnoteRefHref(href: string) {
  return /^#(?:user-content-)?fn-[^#]+$/i.test(href)
}

function isPretextFootnoteBackrefHref(href: string) {
  return /^#(?:user-content-)?fnref-[^#]+$/i.test(href)
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
