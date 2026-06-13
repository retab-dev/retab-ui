"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"
import { MarkdownHooks, type Components } from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypePrettyCode from "rehype-pretty-code"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, {
  defaultSchema,
  type Options as RehypeSanitizeOptions,
} from "rehype-sanitize"
import remarkBreaks from "remark-breaks"
import remarkDirective from "remark-directive"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import type { PluggableList } from "unified"
import { visit } from "unist-util-visit"

import { cn } from "@/lib/utils"

import { Button } from "./button"
import type { PretextMarkdownChunk } from "./pretext-markdown-document-model"

const ALERT_LABELS = {
  caution: "Caution:",
  important: "Important:",
  note: "Note:",
  tip: "Tip:",
  warning: "Warning:",
} as const

type AlertKind = keyof typeof ALERT_LABELS

const CALLOUT_LABELS = {
  caution: "Caution",
  danger: "Danger",
  important: "Important",
  info: "Info",
  note: "Note",
  tip: "Tip",
  warning: "Warning",
} as const

type CalloutKind = keyof typeof CALLOUT_LABELS

type PretextComponentKind = "Badge" | "Metric"

type PretextComponentProps = {
  label?: string
  tone?: string
  value?: string
}

type PretextComponent = {
  name: PretextComponentKind
  props: PretextComponentProps
}

const PRETEXT_COMPONENT_KINDS = new Set<PretextComponentKind>([
  "Badge",
  "Metric",
])

const PRETEXT_COMPONENT_PROPS = new Set<keyof PretextComponentProps>([
  "label",
  "tone",
  "value",
])

const EMOJI_SHORTCODES: Record<string, string> = {
  ":check:": "✓",
  ":sparkles:": "✨",
  ":warning:": "⚠",
  ":white_check_mark:": "✅",
  ":x:": "✕",
}

const PRETEXT_MARKDOWN_REHYPE_PLUGINS: PluggableList = [
  rehypeRaw,
  [rehypeSanitize, createPretextMarkdownSanitizeSchema()],
  rehypeKatex,
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

export function PretextMarkdownChunkRenderer({
  chunk,
}: {
  chunk: PretextMarkdownChunk
}) {
  const remarkPlugins = React.useMemo<PluggableList>(
    () => [
      remarkDirective,
      remarkPretextHeadingIds(chunk.headingIds),
      remarkPretextComponentMarkdown,
      remarkPretextDirectiveCallouts,
      remarkPretextGithubAlerts,
      remarkPretextProseTransforms,
      remarkGfm,
      remarkBreaks,
      remarkMath,
    ],
    [chunk.headingIds]
  )

  if (chunk.kind === "frontmatter") {
    return (
      <section
        aria-label="Frontmatter"
        className="rounded-md border bg-muted/40 p-4 font-mono text-[13px] leading-6 text-muted-foreground"
        data-pretext-markdown-frontmatter=""
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
        {chunk.markdown}
      </MarkdownHooks>
    </div>
  )
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
    <h1
      className={cn(
        "mt-0 mb-5 text-3xl font-semibold tracking-normal text-foreground",
        className
      )}
      {...props}
      id={readPretextHeadingId(props)}
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
      id={readPretextHeadingId(props)}
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
      id={readPretextHeadingId(props)}
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
      id={readPretextHeadingId(props)}
    >
      {children}
    </h4>
  ),
  h5: ({ className, children, node: _node, ...props }) => (
    <h5
      className={cn(
        "mt-5 mb-2 text-base font-semibold tracking-normal text-foreground first:mt-0",
        className
      )}
      {...props}
      id={readPretextHeadingId(props)}
    >
      {children}
    </h5>
  ),
  h6: ({ className, children, node: _node, ...props }) => (
    <h6
      className={cn(
        "mt-5 mb-2 text-sm font-semibold tracking-normal text-muted-foreground first:mt-0",
        className
      )}
      {...props}
      id={readPretextHeadingId(props)}
    >
      {children}
    </h6>
  ),
  p: ({ className, node: _node, ...props }) => (
    <p className={cn("my-4 leading-7 first:mt-0", className)} {...props} />
  ),
  a: ({ className, href, children, node: _node, ...props }) => {
    const safeHref = sanitizePretextMarkdownUrl(href ?? "")
    if (!safeHref) {
      return <span>{children}</span>
    }

    const external = !safeHref.startsWith("#")
    return (
      <a
        className={cn(
          "font-medium underline underline-offset-4",
          isPretextFootnoteRef(props) &&
            "ml-0.5 rounded px-1 text-[0.72em] leading-none",
          isPretextFootnoteBackref(props) &&
            "ml-1 text-muted-foreground no-underline",
          className
        )}
        href={safeHref}
        rel={external ? "noopener noreferrer" : undefined}
        target={external ? "_blank" : undefined}
        {...props}
      >
        {children}
      </a>
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
  table: ({ className, node: _node, ...props }) => (
    <PretextMarkdownTable className={className} {...props} />
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
  pre: ({ className, children, node: _node, ...props }) => {
    const language = codeLanguage(children)
    const text = extractReactText(children).replace(/\n$/, "")
    if (language === "mermaid") {
      return <PretextMarkdownDiagram className={className} source={text} />
    }

    return (
      <div
        className={cn(
          "group my-5 overflow-hidden rounded-md border bg-muted/50",
          className
        )}
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
        <pre className="overflow-x-auto p-4 text-sm leading-6" {...props}>
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
  section: ({ className, node: _node, ...props }) => (
    <section
      className={cn(
        "mt-8 border-t pt-4 text-sm leading-6 text-muted-foreground",
        className
      )}
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
      className={cn(
        "my-5 rounded-md border px-4 py-3",
        calloutClassName(callout.kind),
        className
      )}
      data-pretext-callout-kind={callout.kind}
    >
      <p className="mb-2 font-semibold">{callout.title}</p>
      <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </aside>
  )
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
      className="group relative my-5 overflow-x-auto rounded-md border"
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

function parsePretextComponentMarkdown(value: string): PretextComponent | null {
  const source = value.trim()
  const componentMatch = /^<([A-Z][A-Za-z0-9]*)\s*([^<>]*)\/>$/.exec(source)
  if (!componentMatch) return null

  const name = componentMatch[1]
  if (!PRETEXT_COMPONENT_KINDS.has(name as PretextComponentKind)) return null

  const attributes = componentMatch[2] ?? ""
  const props: PretextComponentProps = {}
  const propPattern = /\s*([A-Za-z][A-Za-z0-9_]*)=(?:"([^"]*)"|'([^']*)')/gy
  let index = 0

  while (index < attributes.length) {
    if (attributes.slice(index).trim() === "") break

    propPattern.lastIndex = index
    const propMatch = propPattern.exec(attributes)
    if (!propMatch) return null

    const propName = propMatch[1]
    if (!isSafePretextComponentProp(propName)) return null

    props[propName] = propMatch[2] ?? propMatch[3] ?? ""
    index = propPattern.lastIndex
  }

  return {
    name: name as PretextComponentKind,
    props,
  }
}

function isSafePretextComponentProp(
  propName: string
): propName is keyof PretextComponentProps {
  if (!PRETEXT_COMPONENT_PROPS.has(propName as keyof PretextComponentProps)) {
    return false
  }
  if (/^on/i.test(propName)) return false

  return ![
    "children",
    "component",
    "dangerouslySetInnerHTML",
    "render",
    "style",
  ].includes(propName)
}

function readPretextComponent(node: unknown): PretextComponent | null {
  const properties =
    node && typeof node === "object" && "properties" in node
      ? (node.properties as Record<string, unknown>)
      : null
  if (!properties) return null

  const name =
    properties.dataPretextComponentName ??
    properties["data-pretext-component-name"]
  if (
    typeof name !== "string" ||
    !PRETEXT_COMPONENT_KINDS.has(name as PretextComponentKind)
  ) {
    return null
  }

  const serializedProps =
    properties.dataPretextComponentProps ??
    properties["data-pretext-component-props"]
  if (typeof serializedProps !== "string") return null

  try {
    const parsed = JSON.parse(serializedProps) as Record<string, unknown>
    const props: PretextComponentProps = {}
    for (const [propName, propValue] of Object.entries(parsed)) {
      if (
        isSafePretextComponentProp(propName) &&
        typeof propValue === "string"
      ) {
        props[propName] = propValue
      }
    }
    return {
      name: name as PretextComponentKind,
      props,
    }
  } catch {
    return null
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
      className={cn(
        "my-5 min-h-40 overflow-hidden rounded-md border bg-muted/30",
        className
      )}
      data-diagram-language="mermaid"
      data-diagram-state={state.status}
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
        <pre className="overflow-x-auto p-4 font-mono text-[0.82em] leading-relaxed text-muted-foreground">
          {state.status === "failed" ? state.message : source}
        </pre>
      )}
    </figure>
  )
}

function PretextMarkdownCopyButton({
  ariaLabel,
  className,
  text,
}: {
  ariaLabel: string
  className?: string
  text: string
}) {
  const [isCopied, setIsCopied] = React.useState(false)
  const timeoutRef = React.useRef<number | null>(null)

  React.useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    },
    []
  )

  const copyText = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)

    try {
      const result = navigator.clipboard?.writeText(text)
      void Promise.resolve(result).then(() => {
        setIsCopied(true)
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = null
          setIsCopied(false)
        }, 1200)
      })
    } catch {
      setIsCopied(false)
    }
  }

  return (
    <Button
      aria-label={isCopied ? "Copied" : ariaLabel}
      className={className}
      size="icon-sm"
      title={ariaLabel}
      type="button"
      variant="ghost"
      onClick={copyText}
    >
      {isCopied ? <Check /> : <Copy />}
    </Button>
  )
}

function PretextMarkdownImage({
  alt,
  className,
  src,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [status, setStatus] = React.useState<"failed" | "idle">("idle")
  const safeSrc =
    typeof src === "string" ? sanitizePretextMarkdownImageUrl(src) : ""
  const label = alt || safeSrc || "Markdown image"

  if (!safeSrc || status === "failed") {
    return (
      <span
        className={cn(
          "my-5 flex min-h-20 items-center rounded-md border bg-muted/40 px-4 text-sm text-muted-foreground",
          className
        )}
        data-pretext-image-state={safeSrc ? "failed" : "blocked"}
        role="img"
        aria-label={label}
      >
        {label}
      </span>
    )
  }

  return (
    <img
      className={cn("my-5 max-w-full rounded-md border", className)}
      alt={alt ?? ""}
      loading="lazy"
      src={safeSrc}
      onError={() => setStatus("failed")}
      {...props}
    />
  )
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

function readPretextCallout(
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

function sanitizePretextMarkdownUrl(value: string) {
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

function sanitizePretextMarkdownImageUrl(value: string) {
  const safeUrl = sanitizePretextMarkdownUrl(value)
  if (!safeUrl || safeUrl.startsWith("mailto:") || safeUrl.startsWith("#")) {
    return ""
  }
  return safeUrl
}

function createPretextMarkdownSanitizeSchema(): RehypeSanitizeOptions {
  return {
    ...defaultSchema,
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
        "dataPretextHeadingId",
      ],
      div: [
        ...(defaultSchema.attributes?.div ?? []),
        "dataPretextCalloutKind",
        "dataPretextCalloutTitle",
        "dataPretextComponentName",
        "dataPretextComponentProps",
      ],
      mark: ["title"],
    },
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      "details",
      "figcaption",
      "figure",
      "mark",
      "summary",
    ],
  }
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
  return Boolean(props.dataFootnoteRef ?? props["data-footnote-ref"])
}

function isPretextFootnoteBackref(props: Record<string, unknown>) {
  return Boolean(props.dataFootnoteBackref ?? props["data-footnote-backref"])
}

function readPretextHeadingId(props: Record<string, unknown>) {
  const id = props.dataPretextHeadingId ?? props["data-pretext-heading-id"]
  return typeof id === "string" ? id : undefined
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

function remarkPretextComponentMarkdown() {
  return function transform(tree: any) {
    visit(tree, "html", (node: any) => {
      if (typeof node.value !== "string") return

      const component = parsePretextComponentMarkdown(node.value)
      if (!component) {
        if (isPretextMdxLikeHtml(node.value)) {
          node.type = "code"
          node.lang = "mdx"
          node.value = node.value.trim()
        }
        return
      }

      node.type = "pretextComponent"
      node.data = {
        hName: "div",
        hProperties: {
          dataPretextComponentName: component.name,
          dataPretextComponentProps: JSON.stringify(component.props),
        },
      }
      node.children = []
      delete node.value
    })
  }
}

function isPretextMdxLikeHtml(value: string) {
  const trimmed = value.trim()
  return /^<\/?[A-Z][A-Za-z0-9.]*(?:\s|\/?>)/.test(trimmed) || /\s\w+=\{/.test(trimmed)
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
