"use client"

import * as React from "react"
import { Fragment, jsx, jsxs } from "react/jsx-runtime"
import { toJsxRuntime } from "hast-util-to-jsx-runtime"
import {
  BadgeAlert,
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  Info,
  Lightbulb,
  Link2,
  TriangleAlert,
} from "lucide-react"

import { PretextMarkdownGreenfieldDiagram } from "./pretext-markdown-greenfield-diagram"
import type { PretextMarkdownGreenfieldChunk } from "./pretext-markdown-greenfield-document"
import type {
  PretextMarkdownHastElement,
  PretextMarkdownHastNode,
  PretextMarkdownHastRoot,
} from "./pretext-markdown-hast-types"
import {
  sanitizePretextMarkdownImageUrl,
  sanitizePretextMarkdownMediaUrl,
  sanitizePretextMarkdownUrl,
} from "./pretext-markdown-url-policy"

const PretextMarkdownContentReadyContext = React.createContext<
  (() => void) | null
>(null)

// The rendered body size at 100% zoom. Every other size (headings, code,
// tables, footnotes) is authored in `em` relative to this, so scaling this one
// value with the zoom `fontScale` resizes the whole document as one system.
export const PRETEXT_MARKDOWN_GREENFIELD_BASE_FONT_PX = 15.5

export function PretextMarkdownGreenfieldChunkRenderer({
  chunk,
  fontScale = 1,
  onContentReady,
  searchQuery,
}: {
  chunk: PretextMarkdownGreenfieldChunk
  fontScale?: number
  onContentReady?: () => void
  searchQuery?: string
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const notifyContentReady = React.useCallback(() => {
    onContentReady?.()
  }, [onContentReady])

  React.useLayoutEffect(() => {
    notifyContentReady()
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(notifyContentReady)
    observer.observe(element)
    return () => observer.disconnect()
  }, [chunk.id, notifyContentReady])

  if (chunk.isHostile) {
    return <PretextMarkdownGreenfieldHostileChunk chunk={chunk} />
  }

  return (
    <PretextMarkdownContentReadyContext.Provider value={notifyContentReady}>
      <div
        ref={ref}
        className="pretext-markdown-greenfield-content min-w-0 leading-relaxed text-foreground"
        data-slot="pretext-markdown-greenfield-content"
        style={{
          fontSize: `${PRETEXT_MARKDOWN_GREENFIELD_BASE_FONT_PX * fontScale}px`,
        }}
      >
        {renderHastChildren(chunk.hastChildren, searchQuery)}
      </div>
    </PretextMarkdownContentReadyContext.Provider>
  )
}

function renderHastChildren(
  children: readonly PretextMarkdownHastNode[],
  searchQuery?: string
) {
  const root: PretextMarkdownHastRoot = {
    type: "root",
    children: children.map(cloneHastNode),
  }

  const normalizedQuery = searchQuery?.trim().toLowerCase()
  if (normalizedQuery) {
    highlightPretextMarkdownSearchMatches(root.children, normalizedQuery)
  }

  return toJsxRuntime(root as never, {
    Fragment,
    components: markdownComponents,
    ignoreInvalidStyle: true,
    jsx,
    jsxs,
    passKeys: true,
    passNode: true,
  })
}

const markdownComponents = {
  a: ({
    children,
    href,
    node: _node,
    rel: _rel,
    target: _target,
    ...props
  }: any) => {
    const safeHref = sanitizePretextMarkdownUrl(href ?? "")
    if (!safeHref) return <span>{children}</span>
    const text = reactNodeText(children)
    const kind = linkKindForHref(safeHref)
    const form = linkFormForHref({
      href: safeHref,
      text,
    })
    const external = kind === "external"
    return (
      <a
        {...props}
        className={[
          "font-medium [overflow-wrap:anywhere] text-primary underline decoration-muted-foreground/50 underline-offset-4 visited:text-muted-foreground hover:decoration-current",
          kind === "fragment" ? "decoration-dotted" : "",
          form !== "inline" ? "font-mono" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-pretext-link-form={form}
        data-pretext-link-kind={kind}
        href={safeHref}
        aria-label={footnoteLabelForLink({
          href: safeHref,
          label: props["aria-label"],
          text,
        })}
        rel={external ? "noopener noreferrer" : undefined}
        target={external ? "_blank" : undefined}
      >
        {children}
        {external ? (
          <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
        ) : null}
      </a>
    )
  },
  br: ({ node: _node, ...props }: any) => (
    <br {...props} data-pretext-line-break="soft" />
  ),
  abbr: ({ node: _node, ...props }: any) => (
    <abbr
      {...props}
      className="cursor-help underline decoration-dotted"
      data-pretext-raw-inline=""
    />
  ),
  blockquote: ({ children, node, ...props }: any) => {
    const alertKind = readDataProperty(node, "dataPretextAlertKind")
    const alertTitle = readDataProperty(node, "dataPretextAlertTitle")
    if (alertKind) {
      const label = String(alertTitle || alertKind)
      const Icon = alertIconForKind(alertKind)
      const alertProps = withoutPretextAlertMetadata(props)
      return (
        <aside
          {...alertProps}
          aria-label={label}
          className="my-5 rounded-md border bg-muted/35 px-4 py-3"
          data-pretext-alert-kind={alertKind}
          role="note"
        >
          <div
            className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"
            data-pretext-alert-title=""
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </div>
          <div
            className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            data-pretext-alert-body=""
          >
            {children}
          </div>
        </aside>
      )
    }

    return (
      <blockquote
        {...props}
        className="my-4 border-l-2 border-border pl-4 text-muted-foreground italic [&_blockquote]:my-3 [&_ol]:list-[lower-alpha] [&>ul]:my-2"
      >
        {children}
      </blockquote>
    )
  },
  code: ({ children, className, node: _node, ...props }: any) => (
    <code
      {...props}
      className={[
        "rounded bg-muted px-1 py-0.5 font-mono text-[0.88em]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </code>
  ),
  caption: ({ node: _node, ...props }: any) => (
    <caption
      {...props}
      className="caption-top px-3 py-2 text-left text-sm font-medium text-muted-foreground"
    />
  ),
  del: ({ node: _node, ...props }: any) => (
    <del
      {...props}
      className="text-muted-foreground decoration-muted-foreground/70 decoration-2"
      data-pretext-strikethrough=""
    />
  ),
  details: ({ node: _node, ...props }: any) => (
    <details {...props} className="my-4 rounded-md border bg-muted/25 p-3" />
  ),
  dl: ({ node: _node, ...props }: any) => (
    <dl {...props} className="my-4 space-y-2" data-pretext-definition-list="" />
  ),
  dt: ({ node: _node, ...props }: any) => (
    <dt {...props} className="font-semibold" data-pretext-definition-term="" />
  ),
  dd: ({ node: _node, ...props }: any) => (
    <dd
      {...props}
      className="ml-4 text-muted-foreground"
      data-pretext-definition-description=""
    />
  ),
  div: ({ children, node, ...props }: any) => {
    const calloutKind = readTrustedDataProperty(node, "dataPretextCalloutKind")
    if (calloutKind) {
      const title =
        readTrustedDataProperty(node, "dataPretextCalloutTitle") ||
        calloutTitle(calloutKind)
      return (
        <aside
          aria-label={title}
          className="my-5 rounded-md border bg-muted/35 px-4 py-3"
          data-pretext-callout-kind={calloutKind}
          role="note"
        >
          <div className="mb-2 text-sm font-semibold">{title}</div>
          <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {children}
          </div>
        </aside>
      )
    }

    const componentName = readDataProperty(node, "dataPretextComponentName")
    const trusted = isTrustedPretextComponentNode(node)
    if (trusted && hasDataProperty(node, "dataPretextComponentFallback")) {
      return (
        <div
          data-pretext-component-fallback=""
          data-pretext-component-fallback-name={readDataProperty(
            node,
            "dataPretextComponentFallbackName"
          )}
          data-pretext-component-fallback-reason={readDataProperty(
            node,
            "dataPretextComponentFallbackReason"
          )}
          data-pretext-component-fallback-source={readDataProperty(
            node,
            "dataPretextComponentFallbackSource"
          )}
        >
          {children}
        </div>
      )
    }
    if (trusted && componentName === "Metric") {
      const componentProps = readComponentProps(
        readDataProperty(node, "dataPretextComponentProps")
      )
      return (
        <div
          className="my-4 w-fit max-w-full min-w-0 rounded-md border bg-muted/25 px-4 py-3"
          data-pretext-component="Metric"
        >
          <div className="text-sm [overflow-wrap:anywhere] text-muted-foreground">
            {readOptionalString(componentProps.label)}
          </div>
          <div className="text-2xl font-semibold [overflow-wrap:anywhere]">
            {readOptionalString(componentProps.value)}
          </div>
        </div>
      )
    }
    if (trusted && componentName === "Badge") {
      const componentProps = readComponentProps(
        readDataProperty(node, "dataPretextComponentProps")
      )
      return (
        <span
          className="inline-flex max-w-full items-center rounded-md border bg-muted/35 px-2 py-0.5 text-sm font-medium [overflow-wrap:anywhere]"
          data-pretext-component="Badge"
        >
          {readOptionalString(componentProps.label)}
        </span>
      )
    }
    if (trusted && componentName === "Callout") {
      const componentProps = readComponentProps(
        readDataProperty(node, "dataPretextComponentProps")
      )
      const kind = readOptionalString(componentProps.kind) ?? "note"
      const title =
        readOptionalString(componentProps.title) ?? calloutTitle(kind)
      return (
        <aside
          aria-label={title}
          className="my-5 rounded-md border bg-muted/35 px-4 py-3"
          data-pretext-callout-kind={kind}
          data-pretext-component="Callout"
          role="note"
        >
          <div className="mb-2 text-sm font-semibold">{title}</div>
          <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {children}
          </div>
        </aside>
      )
    }
    if (trusted && componentName === "Accordion") {
      const componentProps = readComponentProps(
        readDataProperty(node, "dataPretextComponentProps")
      )
      return (
        <details
          className="my-4 rounded-md border bg-muted/25 p-3"
          data-pretext-component="Accordion"
        >
          <summary className="cursor-pointer font-medium">
            {readOptionalString(componentProps.title)}
          </summary>
          <div className="mt-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {children}
          </div>
        </details>
      )
    }
    if (trusted && componentName === "Tabs") {
      return <PretextMarkdownTabs node={readHastElement(node)} />
    }
    if (trusted && componentName === "Image") {
      const componentProps = readComponentProps(
        readDataProperty(node, "dataPretextComponentProps")
      )
      return (
        <PretextMarkdownImageSurface
          alt={readOptionalString(componentProps.alt) ?? ""}
          componentName="Image"
          height={readOptionalNumber(componentProps.height)}
          src={readOptionalString(componentProps.src) ?? ""}
          title={readOptionalString(componentProps.title)}
          width={readOptionalNumber(componentProps.width)}
        />
      )
    }
    if (trusted && componentName === "Video") {
      const componentProps = readComponentProps(
        readDataProperty(node, "dataPretextComponentProps")
      )
      return (
        <PretextMarkdownVideoSurface
          controls={readOptionalBoolean(componentProps.controls) ?? true}
          label={readOptionalString(componentProps.label) ?? "Video"}
          loop={readOptionalBoolean(componentProps.loop) ?? false}
          muted={readOptionalBoolean(componentProps.muted) ?? false}
          src={readOptionalString(componentProps.src) ?? ""}
          title={readOptionalString(componentProps.title)}
        />
      )
    }
    if (trusted && componentName === "Diagram") {
      const componentProps = readComponentProps(
        readDataProperty(node, "dataPretextComponentProps")
      )
      if (
        componentProps.type === "mermaid" &&
        typeof componentProps.source === "string"
      ) {
        return (
          <PretextMarkdownMeasuredDiagram
            caption={readOptionalString(componentProps.caption)}
            componentName="Diagram"
            source={componentProps.source}
            title={readOptionalString(componentProps.title)}
          />
        )
      }
    }

    return <div {...withoutInternalPretextMetadata(props)}>{children}</div>
  },
  h1: headingComponent(
    "h1",
    "mt-6 mb-3 first:mt-0",
    "text-[1.55em] leading-tight font-semibold tracking-tight"
  ),
  h2: headingComponent(
    "h2",
    "mt-7 mb-3 first:mt-0",
    "text-[1.3em] leading-snug font-semibold tracking-tight"
  ),
  h3: headingComponent(
    "h3",
    "mt-5 mb-2 first:mt-0",
    "text-[1.1em] leading-snug font-semibold"
  ),
  h4: headingComponent(
    "h4",
    "mt-4 mb-2 first:mt-0",
    "text-[1em] leading-snug font-semibold"
  ),
  h5: headingComponent(
    "h5",
    "mt-4 mb-1.5 first:mt-0",
    "text-[0.95em] leading-snug font-semibold"
  ),
  h6: headingComponent(
    "h6",
    "mt-4 mb-1.5 first:mt-0",
    "text-[0.9em] leading-snug font-semibold text-muted-foreground"
  ),
  hr: ({ node: _node, ...props }: any) => (
    <hr
      {...props}
      className="my-10 border-0 border-t border-border"
      data-pretext-thematic-break=""
    />
  ),
  kbd: ({ node: _node, ...props }: any) => (
    <kbd
      {...props}
      className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.85em]"
      data-pretext-raw-inline=""
    />
  ),
  mark: ({ node: _node, ...props }: any) => (
    <mark
      {...props}
      className="rounded bg-yellow-200/70 px-1 text-foreground dark:bg-yellow-400/30"
      data-pretext-raw-inline=""
    />
  ),
  img: ({ alt, height, node: _node, src, title, width }: any) => (
    <PretextMarkdownImageSurface
      alt={alt ?? ""}
      height={readOptionalNumber(height)}
      src={src ?? ""}
      title={title}
      width={readOptionalNumber(width)}
    />
  ),
  input: ({ checked, node: _node, type, ...props }: any) => {
    if (type !== "checkbox") return null
    return (
      <input
        {...props}
        aria-label={checked ? "Completed task" : "Incomplete task"}
        aria-readonly="true"
        checked={checked}
        className="mr-2 size-3.5 rounded border-border align-[-0.15em] accent-primary"
        data-pretext-task-checkbox={checked ? "checked" : "unchecked"}
        disabled
        readOnly
        type="checkbox"
      />
    )
  },
  li: ({ children, className, node, ...props }: any) => {
    const isTask = hasDescendantElement(readHastElement(node), "input")
    return (
      <li
        {...props}
        className={[
          "leading-relaxed",
          isTask ? "list-none pl-0" : "",
          "[&>p]:my-1",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        data-pretext-task-list-item={isTask ? "" : undefined}
      >
        {children}
      </li>
    )
  },
  ol: ({ className, node: _node, ...props }: any) => (
    <ol
      {...props}
      className={[
        "my-3 ml-5 list-decimal space-y-1 [&_ol]:list-[lower-alpha]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  ),
  p: ({ node, ...props }: any) => {
    const element = readHastElement(node)
    const onlyImage =
      element?.children.filter((child) => !isWhitespaceText(child)).length ===
        1 &&
      readHastElement(
        element.children.find((child) => !isWhitespaceText(child))
      )?.tagName === "img"
    if (onlyImage) {
      return (
        <div
          {...props}
          className="my-3 min-w-0 leading-relaxed [overflow-wrap:anywhere]"
        />
      )
    }
    return (
      <p
        {...props}
        className="my-4 min-w-0 leading-7 [overflow-wrap:anywhere]"
      />
    )
  },
  span: ({ className, node: _node, ...props }: any) => {
    const classes = String(className ?? "")
    if (classes.includes("katex-display")) {
      return (
        <span
          {...props}
          aria-label="Math block"
          className={[classes, "block overflow-x-auto"]
            .filter(Boolean)
            .join(" ")}
          data-pretext-math-block=""
          role="region"
          tabIndex={0}
          onKeyDown={handleHorizontalScrollKeyDown}
        />
      )
    }
    return (
      <span
        {...props}
        className={classes || undefined}
        data-pretext-math-inline={classes.includes("katex") ? "" : undefined}
      />
    )
  },
  pre: ({ children, node, ...props }: any) => {
    const code = readPreCodeElement(node)
    if (
      hasDataProperty(node, "dataPretextMarkdownFrontmatterSource") ||
      hasDataProperty(code, "dataPretextMarkdownFrontmatterSource")
    ) {
      return (
        <pre
          {...props}
          className="my-4 overflow-x-auto rounded-md border bg-muted/25 p-4 font-mono text-sm leading-6 whitespace-pre"
          data-pretext-markdown-frontmatter-source=""
          role="region"
          tabIndex={0}
          onKeyDown={handleHorizontalScrollKeyDown}
        >
          <code>{extractHastNodeText(code).replace(/\n$/, "")}</code>
        </pre>
      )
    }

    const language = normalizeCodeLanguage(readCodeLanguage(code))
    if (language === "mermaid") {
      const metadata = readCodeMetadata(code)
      return (
        <PretextMarkdownMeasuredDiagram
          caption={metadata.caption}
          source={extractHastNodeText(code).replace(/\n$/, "")}
          title={metadata.title}
        />
      )
    }

    return (
      <PretextMarkdownCodeBlock
        language={language ?? "text"}
        metadata={readCodeMetadata(code)}
        source={extractHastNodeText(code).replace(/\n$/, "")}
      >
        {children}
      </PretextMarkdownCodeBlock>
    )
  },
  section: ({ children, className, node, ...props }: any) => {
    const isFootnotes = hasDataProperty(node, "dataFootnotes")
    return (
      <section
        {...props}
        aria-label={isFootnotes ? "Footnotes" : props["aria-label"]}
        className={[
          isFootnotes
            ? "mt-10 border-t pt-5 text-sm text-muted-foreground"
            : "my-5",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </section>
    )
  },
  strong: ({ node: _node, ...props }: any) => (
    <strong {...props} className="font-semibold" />
  ),
  summary: ({ node: _node, ...props }: any) => (
    <summary {...props} className="cursor-pointer font-medium" />
  ),
  q: ({ cite, node: _node, ...props }: any) => (
    <q
      {...props}
      cite={sanitizePretextMarkdownUrl(cite ?? "") || undefined}
      className="italic"
      data-pretext-raw-inline=""
    />
  ),
  ins: ({ cite, node: _node, ...props }: any) => (
    <ins
      {...props}
      cite={sanitizePretextMarkdownUrl(cite ?? "") || undefined}
      className="underline decoration-green-600/60"
      data-pretext-raw-inline=""
    />
  ),
  cite: ({ node: _node, ...props }: any) => (
    <cite {...props} className="italic" data-pretext-raw-inline="" />
  ),
  dfn: ({ node: _node, ...props }: any) => (
    <dfn {...props} className="italic" data-pretext-raw-inline="" />
  ),
  samp: ({ node: _node, ...props }: any) => (
    <samp {...props} className="font-mono" data-pretext-raw-inline="" />
  ),
  small: ({ node: _node, ...props }: any) => (
    <small
      {...props}
      className="text-[0.85em] text-muted-foreground"
      data-pretext-raw-inline=""
    />
  ),
  sub: ({ node: _node, ...props }: any) => (
    <sub {...props} className="align-sub" data-pretext-raw-inline="" />
  ),
  sup: ({ node: _node, ...props }: any) => (
    <sup {...props} className="align-super" data-pretext-raw-inline="" />
  ),
  time: ({ node: _node, ...props }: any) => (
    <time {...props} data-pretext-raw-inline="" />
  ),
  var: ({ node: _node, ...props }: any) => (
    <var {...props} className="font-mono italic" data-pretext-raw-inline="" />
  ),
  table: ({ node, style, ...props }: any) => {
    const table = readHastElement(node)
    const ariaColumnCount = tableColumnCount(table)
    const columnCount = ariaColumnCount ?? 0
    return (
      <div
        aria-label="Markdown table"
        className="group relative my-4 overflow-hidden rounded-lg border"
        data-pretext-markdown-table-region=""
        role="region"
        tabIndex={0}
        onKeyDown={handleHorizontalScrollKeyDown}
      >
        <TableCopyButton />
        <div className="overflow-x-auto" data-pretext-markdown-table-scroll="">
          <table
            {...props}
            aria-colcount={ariaColumnCount}
            aria-rowcount={tableRowCount(table)}
            className="w-full border-collapse text-[0.85em]"
            data-pretext-markdown-table=""
            style={{
              ...style,
              minWidth:
                columnCount >= 4
                  ? `${Math.max(640, columnCount * 160)}px`
                  : style?.minWidth,
            }}
          />
        </div>
      </div>
    )
  },
  tbody: ({ node: _node, ...props }: any) => <tbody {...props} />,
  td: ({ align, node, ...props }: any) => {
    const resolvedAlign = align ?? readHastElement(node)?.properties?.align
    return (
      <td
        {...props}
        align={typeof resolvedAlign === "string" ? resolvedAlign : undefined}
        className="border-t border-border px-3 py-1.5 align-top [overflow-wrap:break-word] [&[align=center]]:text-center [&[align=right]]:text-right [&[align=right]]:tabular-nums"
      />
    )
  },
  th: ({ align, node, ...props }: any) => {
    const resolvedAlign = align ?? readHastElement(node)?.properties?.align
    return (
      <th
        {...props}
        align={typeof resolvedAlign === "string" ? resolvedAlign : undefined}
        className="border-b border-border bg-muted/55 px-3 py-1.5 text-left align-top font-medium [overflow-wrap:break-word] [&[align=center]]:text-center [&[align=right]]:text-right [&[align=right]]:tabular-nums"
        scope="col"
      />
    )
  },
  thead: ({ node: _node, ...props }: any) => <thead {...props} />,
  tr: ({ node: _node, ...props }: any) => <tr {...props} />,
  ul: ({ className, node: _node, ...props }: any) => (
    <ul
      {...props}
      className={[
        "my-3 ml-5 list-disc space-y-1 [&_ul]:list-[circle]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  ),
}

function headingComponent(
  Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
  blockClassName: string,
  textClassName: string
) {
  return function Heading({ children, node, ...props }: any) {
    const id = typeof props.id === "string" ? props.id : ""
    const text =
      extractHastText(readHastElement(node)) || reactNodeText(children)
    if (!id) {
      return (
        <Tag {...props} className={`${blockClassName} ${textClassName}`}>
          {children}
        </Tag>
      )
    }
    return (
      <div className={`group/heading relative ${blockClassName}`}>
        <Tag {...props} className={textClassName}>
          {children}
        </Tag>
        <HeadingAnchor id={id} text={text} />
      </div>
    )
  }
}

// A GitHub-style anchor that appears in the left gutter on hover/focus and
// copies a deep link to the heading. Kept as a sibling of the heading (not a
// child) so it never leaks into the heading's accessible name.
function HeadingAnchor({ id, text }: { id: string; text: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      aria-label={`Copy link to ${text}`}
      className="absolute top-1/2 -left-7 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/heading:opacity-100 hover:text-foreground focus-visible:opacity-100"
      type="button"
      onClick={() => {
        copyHeadingLink(id)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Link2 className="size-4" aria-hidden="true" />
      )}
    </button>
  )
}

function PretextMarkdownGreenfieldHostileChunk({
  chunk,
}: {
  chunk: PretextMarkdownGreenfieldChunk
}) {
  const sourceLines = React.useMemo(
    () => chunk.sourceText.split(/\r\n|[\n\r\u2028\u2029]/),
    [chunk.sourceText]
  )
  const [scrollTop, setScrollTop] = React.useState(0)
  const lineHeight = 24
  const viewportHeight = 576
  const start = Math.max(0, Math.floor(scrollTop / lineHeight) - 12)
  const end = Math.min(
    sourceLines.length,
    Math.ceil((scrollTop + viewportHeight) / lineHeight) + 12
  )
  const mountedLines = sourceLines.slice(start, end)
  const omittedLines = Math.max(0, sourceLines.length - mountedLines.length)

  return (
    <section
      aria-label="Large Markdown block"
      className="overflow-hidden rounded-md border bg-muted/25 text-sm text-muted-foreground"
      data-pretext-markdown-hostile-fallback=""
      data-pretext-markdown-hostile-line-count={sourceLines.length}
      data-pretext-markdown-hostile-mounted-lines={mountedLines.length}
      data-pretext-markdown-hostile-omitted-lines={omittedLines}
      data-pretext-markdown-hostile-virtualized=""
    >
      <div className="flex items-center justify-between gap-3 border-b bg-muted/55 px-3 py-2 font-medium text-foreground">
        Large Markdown block
        <button
          aria-label="Copy large Markdown block source"
          className="text-xs text-muted-foreground underline underline-offset-4"
          type="button"
          onClick={() => void navigator.clipboard?.writeText(chunk.sourceText)}
        >
          Copy
        </button>
      </div>
      <pre
        aria-label="Large Markdown source preview"
        className="max-h-[36rem] overflow-auto bg-background/60 font-mono text-[13px] whitespace-pre"
        data-pretext-markdown-hostile-preview=""
        role="region"
        tabIndex={0}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <code
          className="relative block min-w-max"
          data-pretext-markdown-hostile-scroll-canvas=""
          style={{ height: Math.max(sourceLines.length, 1) * lineHeight }}
        >
          {mountedLines.map((line, index) => {
            const lineNumber = start + index + 1
            return (
              <span
                key={lineNumber}
                className="absolute inset-x-0 grid grid-cols-[4rem_minmax(0,1fr)] px-4"
                data-pretext-markdown-hostile-line={lineNumber}
                style={{
                  height: lineHeight,
                  lineHeight: `${lineHeight}px`,
                  top: (lineNumber - 1) * lineHeight,
                }}
              >
                <span
                  aria-hidden="true"
                  className="pr-4 text-right text-muted-foreground select-none"
                >
                  {lineNumber}
                </span>
                <span>{line || " "}</span>
              </span>
            )
          })}
        </code>
      </pre>
    </section>
  )
}

function PretextMarkdownCodeBlock({
  children: _children,
  language,
  metadata,
  source,
}: {
  children: React.ReactNode
  language: string
  metadata: ReturnType<typeof readCodeMetadata>
  source: string
}) {
  const [copyFailed, setCopyFailed] = React.useState(false)
  const title = metadata.title || language
  const sourceLines = source.split("\n")
  const shikiLines = useShikiCodeLines(source, language, sourceLines.length)
  const lineNumberStart = metadata.lineNumberStart ?? 1
  const lineNumberMaxDigits = String(
    lineNumberStart + Math.max(0, sourceLines.length - 1)
  ).length

  const copy = React.useCallback(
    async (selectedOnly: boolean) => {
      const selection = window.getSelection()
      const selectedText =
        selectedOnly && selection?.rangeCount
          ? selection.toString().trimEnd()
          : ""
      try {
        await navigator.clipboard?.writeText(selectedText || source)
        setCopyFailed(false)
      } catch {
        setCopyFailed(true)
      }
    },
    [source]
  )

  return (
    <figure
      aria-label={`${title} code block`}
      className="my-5 overflow-hidden rounded-md border bg-muted/25"
      data-pretext-code-language={language}
      data-rehype-pretty-code-figure=""
      role="group"
    >
      <figcaption className="flex items-center justify-between gap-3 border-b bg-muted/55 px-3 py-2 text-sm">
        <span
          className="font-mono text-xs font-medium text-muted-foreground"
          data-pretext-code-title={metadata.title || undefined}
        >
          {title}
        </span>
        <span className="flex items-center gap-2">
          {copyFailed ? (
            <span aria-label="Copy failed" className="text-xs text-destructive">
              Copy failed
            </span>
          ) : null}
          <button
            aria-label="Copy code block"
            className="text-xs text-muted-foreground underline underline-offset-4"
            type="button"
            onClick={() => void copy(false)}
          >
            Copy
          </button>
          <button
            aria-label="Copy selected code or block"
            className="sr-only"
            type="button"
            onClick={() => void copy(true)}
          />
        </span>
      </figcaption>
      <pre
        aria-label={`${language} code source`}
        className="overflow-x-auto p-3 [overflow-wrap:normal] [&_code]:min-w-max"
        data-pretext-code-source=""
        role="region"
        tabIndex={0}
        onKeyDown={handleHorizontalScrollKeyDown}
      >
        <code
          aria-label={
            metadata.showLineNumbers
              ? `${language} numbered code lines`
              : undefined
          }
          className={[
            "block font-mono text-sm leading-5",
            metadata.showLineNumbers
              ? "[counter-reset:line] before:content-[counter(line)]"
              : "",
            metadata.highlightedLines.size
              ? "[&>[data-highlighted-line]]:bg-primary/10"
              : "",
            metadata.highlightPattern
              ? "[&_[data-highlighted-chars]]:rounded [&_[data-highlighted-chars]]:bg-primary/20"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-language={language}
          data-line-numbers={metadata.showLineNumbers ? "" : undefined}
          data-line-numbers-max-digits={
            metadata.showLineNumbers ? lineNumberMaxDigits : undefined
          }
          role={metadata.showLineNumbers ? "list" : undefined}
          style={
            metadata.showLineNumbers
              ? { counterSet: `line ${lineNumberStart - 1}` }
              : undefined
          }
        >
          {sourceLines.map((line, index) => {
            const lineNumber = lineNumberStart + index
            const diffKind = diffLineKind(line)
            return (
              <span
                key={index}
                aria-label={
                  metadata.showLineNumbers ? `Line ${lineNumber}` : undefined
                }
                className={[
                  "block min-h-5 whitespace-pre",
                  diffKind === "add" ? "bg-emerald-500/10" : "",
                  diffKind === "remove" ? "bg-red-500/10" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-highlighted-line={
                  metadata.highlightedLines.has(index + 1) ? "" : undefined
                }
                data-line=""
                data-pretext-code-diff-line={diffKind ?? undefined}
                data-pretext-code-line-number={
                  metadata.showLineNumbers ? lineNumber : undefined
                }
                role={metadata.showLineNumbers ? "listitem" : undefined}
              >
                {renderCodeLine({
                  fallbackLanguage: language,
                  line,
                  pattern: metadata.highlightPattern,
                  shikiLine: shikiLines?.[index],
                })}
              </span>
            )
          })}
        </code>
      </pre>
      {metadata.caption ? (
        <figcaption
          className="border-t px-3 py-2 text-sm text-muted-foreground"
          data-pretext-code-caption=""
        >
          {metadata.caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

function PretextMarkdownMeasuredDiagram({
  caption,
  componentName,
  source,
  title,
}: {
  caption?: string
  componentName?: string
  source: string
  title?: string
}) {
  const notifyContentReady = React.useContext(
    PretextMarkdownContentReadyContext
  )
  return (
    <PretextMarkdownGreenfieldDiagram
      caption={caption}
      componentName={componentName}
      onContentReady={notifyContentReady ?? undefined}
      source={source}
      title={title}
    />
  )
}

function PretextMarkdownImageSurface({
  alt,
  componentName,
  height,
  src,
  title,
  width,
}: {
  alt: string
  componentName?: string
  height?: number
  src: string
  title?: string
  width?: number
}) {
  const notifyContentReady = React.useContext(
    PretextMarkdownContentReadyContext
  )
  const safeSrc = sanitizePretextMarkdownImageUrl(src)
  const explicitAspectRatio =
    width && height ? `${width} / ${height}` : undefined
  const [state, setState] = React.useState<
    "blocked" | "failed" | "loading" | "ready"
  >(safeSrc ? "loading" : "blocked")
  const [aspectRatio, setAspectRatio] = React.useState(
    () => explicitAspectRatio ?? ""
  )
  const captionId = React.useId()

  // Reset load state when the source/aspect-ratio inputs change by adjusting
  // state during render (React's prop-change pattern) instead of in an effect.
  const sourceResetKey = `${safeSrc} ${explicitAspectRatio ?? ""}`
  const [prevSourceResetKey, setPrevSourceResetKey] =
    React.useState(sourceResetKey)
  if (sourceResetKey !== prevSourceResetKey) {
    setPrevSourceResetKey(sourceResetKey)
    setState(safeSrc ? "loading" : "blocked")
    setAspectRatio(explicitAspectRatio ?? "")
  }

  React.useLayoutEffect(() => {
    notifyContentReady?.()
  }, [aspectRatio, notifyContentReady, state])

  return (
    <figure
      aria-label={
        state === "failed" ? `Image failed: ${alt}` : alt || title || "Image"
      }
      className="my-5 w-fit max-w-full"
      data-pretext-component={componentName}
      data-pretext-image-height={height}
      data-pretext-image-state={state}
      data-pretext-image-src={safeSrc || undefined}
      data-pretext-image-width={width}
      role="group"
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {safeSrc ? (
        <div
          className="relative flex min-h-48 max-w-full items-center justify-center overflow-hidden rounded-md border bg-muted/25"
          data-pretext-image-frame=""
          style={aspectRatio ? { aspectRatio } : undefined}
        >
          {state === "loading" ? (
            <span className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
              Loading image
            </span>
          ) : null}
          {state === "failed" ? (
            <div
              className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground"
              role="alert"
            >
              Could not load image{alt ? `: ${alt}` : ""}
            </div>
          ) : null}
          {state === "failed" ? (
            <div
              aria-label={alt || "Image"}
              className="text-sm text-muted-foreground"
              data-pretext-image-state="failed"
              role="img"
            >
              Image failed to load: {alt}
              <button
                className="ml-2 text-xs underline underline-offset-4"
                type="button"
                onClick={() => setState("loading")}
              >
                Retry image
              </button>
            </div>
          ) : (
            <img
              alt={alt}
              aria-describedby={title ? captionId : undefined}
              className={[
                "block max-h-[70vh] max-w-full object-contain transition-opacity",
                state === "loading" ? "opacity-0" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              decoding="async"
              loading="lazy"
              src={safeSrc}
              title={title}
              onError={(event) => {
                event.currentTarget.setAttribute(
                  "data-pretext-image-state",
                  "failed"
                )
                setState("failed")
              }}
              onLoad={(event) => {
                const image = event.currentTarget
                if (image.naturalWidth && image.naturalHeight) {
                  setAspectRatio(
                    `${image.naturalWidth} / ${image.naturalHeight}`
                  )
                }
                setState("ready")
              }}
            />
          )}
        </div>
      ) : (
        <span
          aria-label={alt || "Blocked image"}
          className="flex min-h-24 items-center rounded-md border border-dashed bg-muted/35 px-4 text-sm text-muted-foreground"
          role="img"
        >
          {alt || "Blocked image"}
        </span>
      )}
      {title ? (
        <figcaption
          id={captionId}
          className="mt-2 text-sm text-muted-foreground"
          data-pretext-image-caption=""
        >
          {title}
        </figcaption>
      ) : null}
    </figure>
  )
}

function PretextMarkdownVideoSurface({
  controls = true,
  label,
  loop = false,
  muted = false,
  src,
  title,
}: {
  controls?: boolean
  label: string
  loop?: boolean
  muted?: boolean
  src: string
  title?: string
}) {
  const notifyContentReady = React.useContext(
    PretextMarkdownContentReadyContext
  )
  const safeSrc = sanitizePretextMarkdownMediaUrl(src)
  const [failed, setFailed] = React.useState(false)
  React.useLayoutEffect(() => {
    notifyContentReady?.()
  }, [failed, notifyContentReady, safeSrc])
  if (!safeSrc) {
    return (
      <div
        aria-label={`Video blocked: ${label}`}
        className="my-5 rounded-md border border-dashed bg-muted/35 p-4 text-sm text-muted-foreground"
        data-pretext-component="Video"
        data-pretext-video-state="blocked"
        role="group"
      >
        {label}
      </div>
    )
  }
  return (
    <figure
      aria-label={failed ? `Video failed to load: ${label}` : label}
      className="my-5 max-w-full"
      data-pretext-component="Video"
      data-pretext-video-state={failed ? "failed" : "ready"}
      role="group"
    >
      <video
        className="block max-h-[70vh] max-w-full rounded-md border bg-muted"
        controls={controls}
        loop={loop}
        muted={muted}
        preload="metadata"
        src={safeSrc}
        title={title}
        onError={() => setFailed(true)}
      />
      {title ? (
        <figcaption className="mt-2 text-sm text-muted-foreground">
          {title}
        </figcaption>
      ) : null}
    </figure>
  )
}

function PretextMarkdownTabs({
  node,
}: {
  node: PretextMarkdownHastElement | null
}) {
  const props = readComponentProps(
    readDataProperty(node, "dataPretextComponentProps")
  )
  const tabs = (node?.children ?? [])
    .map(readHastElement)
    .filter((child): child is PretextMarkdownHastElement => {
      return (
        child?.tagName === "div" &&
        readDataProperty(child, "dataPretextComponentName") === "Tab"
      )
    })
  const [selected, setSelected] = React.useState(0)
  const baseId = React.useId()
  const label = readOptionalString(props.label) ?? "Tabs"

  const select = (index: number) =>
    setSelected((index + tabs.length) % tabs.length)

  return (
    <div className="my-5" data-pretext-component="Tabs">
      <div aria-label={label} className="flex gap-1 border-b" role="tablist">
        {tabs.map((tab, index) => {
          const tabProps = readComponentProps(
            readDataProperty(tab, "dataPretextComponentProps")
          )
          const title = readOptionalString(tabProps.title) ?? `Tab ${index + 1}`
          const active = selected === index
          return (
            <button
              key={index}
              aria-controls={`${baseId}-panel-${index}`}
              aria-selected={active}
              className="px-3 py-2 text-sm font-medium"
              id={`${baseId}-tab-${index}`}
              role="tab"
              tabIndex={active ? 0 : -1}
              type="button"
              onClick={() => select(index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault()
                  const nextIndex = (index + 1) % tabs.length
                  select(nextIndex)
                  document.getElementById(`${baseId}-tab-${nextIndex}`)?.focus()
                } else if (event.key === "End") {
                  event.preventDefault()
                  select(tabs.length - 1)
                  document
                    .getElementById(`${baseId}-tab-${tabs.length - 1}`)
                    ?.focus()
                } else if (event.key === "Home") {
                  event.preventDefault()
                  select(0)
                  document.getElementById(`${baseId}-tab-0`)?.focus()
                }
              }}
            >
              {title}
            </button>
          )
        })}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={index}
          aria-labelledby={`${baseId}-tab-${index}`}
          hidden={selected !== index}
          id={`${baseId}-panel-${index}`}
          className="pt-3"
          role="tabpanel"
        >
          {renderHastChildren(tab.children)}
        </div>
      ))}
    </div>
  )
}

// Tags whose text is verbatim source (code) or already a highlight; wrapping a
// match inside them would corrupt the rendered output, so they are skipped.
const PRETEXT_MARKDOWN_SEARCH_SKIP_TAGS = new Set([
  "code",
  "pre",
  "mark",
  "script",
  "style",
  "textarea",
])

// Browser-find-style highlighting for the in-app search: wraps every case-
// insensitive occurrence of the active query in a <mark> so matches are visible
// where the search navigates. Mutates the freshly cloned chunk tree in place,
// matching the same trimmed-substring semantics as the toolbar match count.
function highlightPretextMarkdownSearchMatches(
  nodes: PretextMarkdownHastNode[],
  lowerQuery: string
) {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (node.type === "text" && typeof node.value === "string") {
      const replacement = splitPretextMarkdownTextForSearch(
        node.value,
        lowerQuery
      )
      if (replacement) {
        nodes.splice(index, 1, ...replacement)
        index += replacement.length - 1
      }
      continue
    }
    if (node.type === "element" && Array.isArray(node.children)) {
      const tagName = (node as PretextMarkdownHastElement).tagName.toLowerCase()
      if (PRETEXT_MARKDOWN_SEARCH_SKIP_TAGS.has(tagName)) continue
      highlightPretextMarkdownSearchMatches(node.children, lowerQuery)
    }
  }
}

function splitPretextMarkdownTextForSearch(
  value: string,
  lowerQuery: string
): PretextMarkdownHastNode[] | null {
  const lowerValue = value.toLowerCase()
  let matchStart = lowerValue.indexOf(lowerQuery)
  if (matchStart === -1) return null

  const out: PretextMarkdownHastNode[] = []
  let cursor = 0
  while (matchStart !== -1) {
    if (matchStart > cursor) {
      out.push({ type: "text", value: value.slice(cursor, matchStart) })
    }
    const matchEnd = matchStart + lowerQuery.length
    out.push({
      type: "element",
      tagName: "mark",
      properties: { dataPretextSearchMatch: "" },
      children: [{ type: "text", value: value.slice(matchStart, matchEnd) }],
    })
    cursor = matchEnd
    matchStart = lowerValue.indexOf(lowerQuery, cursor)
  }
  if (cursor < value.length) {
    out.push({ type: "text", value: value.slice(cursor) })
  }
  return out
}

function cloneHastNode<T extends PretextMarkdownHastNode>(node: T): T {
  if (!("children" in node) || !Array.isArray(node.children)) {
    return { ...node }
  }

  return {
    ...node,
    children: node.children.map((child) =>
      cloneHastNode(child as PretextMarkdownHastNode)
    ),
    properties: readHastElement(node)?.properties
      ? { ...readHastElement(node)!.properties }
      : undefined,
  } as T
}

function readDataProperty(node: unknown, property: string) {
  const element = readHastElement(node)
  const value =
    element?.properties?.[property] ?? element?.properties?.[toKebab(property)]
  return typeof value === "string" ? value : ""
}

function readTrustedDataProperty(node: unknown, property: string) {
  if (!isTrustedPretextComponentNode(node)) return ""
  return readDataProperty(node, property)
}

function isTrustedPretextComponentNode(node: unknown) {
  return readHastElement(node)?.properties?.pretextComponentTrusted === true
}

function hasDataProperty(node: unknown, property: string) {
  const element = readHastElement(node)
  return (
    element?.properties != null &&
    (Object.hasOwn(element.properties, property) ||
      Object.hasOwn(element.properties, toKebab(property)))
  )
}

function withoutPretextAlertMetadata(props: Record<string, unknown>) {
  const next = { ...props }
  delete next.dataPretextAlertKind
  delete next.dataPretextAlertTitle
  delete next["data-pretext-alert-kind"]
  delete next["data-pretext-alert-title"]
  return next
}

function withoutInternalPretextMetadata(props: Record<string, unknown>) {
  const next = { ...props }
  for (const key of Object.keys(next)) {
    if (/^dataPretext(?:Component|Callout|Heading)/.test(key)) {
      delete next[key]
    }
    if (/^data-pretext-(?:component|callout|heading)/.test(key)) {
      delete next[key]
    }
    if (key === "pretextComponentTrusted") {
      delete next[key]
    }
  }
  return next
}

function readHastElement(node: unknown): PretextMarkdownHastElement | null {
  return node &&
    typeof node === "object" &&
    (node as PretextMarkdownHastElement).type === "element"
    ? (node as PretextMarkdownHastElement)
    : null
}

function readPreCodeElement(node: unknown): PretextMarkdownHastElement | null {
  const pre = readHastElement(node)
  if (pre?.tagName !== "pre") return null
  const code =
    pre.children
      .map(readHastElement)
      .find((child): child is PretextMarkdownHastElement =>
        Boolean(child && child.tagName === "code")
      ) ?? null
  return code
}

function readCodeLanguage(code: PretextMarkdownHastElement | null) {
  const className = code?.properties?.className
  const classes = Array.isArray(className) ? className : [className]
  const languageClass = classes.find(
    (value): value is string =>
      typeof value === "string" && value.startsWith("language-")
  )
  const language = languageClass?.slice("language-".length).toLowerCase()
  if (language === "mmd" || language === "mermaid-js") return "mermaid"
  return language ?? null
}

function readCodeMetadata(code: PretextMarkdownHastElement | null) {
  return parseCodeMetadata(readDataProperty(code, "dataPretextCodeMeta"))
}

function parseCodeMetadata(meta: string) {
  const result: {
    caption?: string
    highlightedLines: Set<number>
    highlightPattern: string
    lineNumberStart?: number
    showLineNumbers: boolean
    title?: string
  } = {
    highlightedLines: new Set<number>(),
    highlightPattern: "",
    showLineNumbers: false,
  }
  for (const match of meta.matchAll(
    /(?:^|\s)(title|caption)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g
  )) {
    const key = match[1] as "caption" | "title"
    result[key] = match[2] ?? match[3] ?? match[4] ?? ""
  }
  const lineNumbers = /(?:^|\s)showLineNumbers(?:\{(\d+)\})?(?=\s|$)/i.exec(
    meta
  )
  if (lineNumbers) {
    result.showLineNumbers = true
    result.lineNumberStart = lineNumbers[1] ? Number(lineNumbers[1]) : 1
  }
  for (const match of meta.matchAll(/\{(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)\}/g)) {
    for (const value of match[1]!.split(",")) {
      addHighlightedCodeLineSpec(result.highlightedLines, value)
    }
  }
  const highlightPattern = /\/([^/\n]+)\//.exec(meta)
  result.highlightPattern = highlightPattern?.[1] ?? ""
  return result
}

function addHighlightedCodeLineSpec(lines: Set<number>, spec: string) {
  const range = /^(\d+)-(\d+)$/.exec(spec)
  if (range) {
    const start = Number(range[1])
    const end = Number(range[2])
    if (!isSafeHighlightedCodeLine(start) || !isSafeHighlightedCodeLine(end)) {
      return
    }
    if (end < start || end - start > 500) return
    for (let line = start; line <= end; line += 1) lines.add(line)
    return
  }

  const line = Number(spec)
  if (isSafeHighlightedCodeLine(line)) lines.add(line)
}

function isSafeHighlightedCodeLine(line: number) {
  return Number.isInteger(line) && line > 0 && line <= 100_000
}

function normalizeCodeLanguage(language: string | null) {
  const value = (language ?? "text").toLowerCase()
  const aliases: Record<string, string> = {
    bash: "shell",
    docker: "dockerfile",
    javascript: "js",
    jsonc: "json",
    md: "markdown",
    patch: "diff",
    rb: "ruby",
    "shell-session": "shell",
    terminal: "shell",
    typescript: "ts",
    yml: "yaml",
  }
  return aliases[value] ?? value
}

function diffLineKind(line: string) {
  if (line.startsWith("+") && !line.startsWith("+++")) return "add"
  if (line.startsWith("-") && !line.startsWith("---")) return "remove"
  return null
}

function renderCodeLine({
  fallbackLanguage,
  line,
  pattern,
  shikiLine,
}: {
  fallbackLanguage: string
  line: string
  pattern: string
  shikiLine: readonly ShikiCodeToken[] | undefined
}) {
  if (shikiLine) {
    return renderShikiCodeLine({
      fallbackLanguage,
      line,
      pattern,
      tokens: shikiLine,
    })
  }
  if (!pattern) return renderFallbackCodeTokens(line || " ", fallbackLanguage)
  const index = line.indexOf(pattern)
  if (index < 0) return renderFallbackCodeTokens(line || " ", fallbackLanguage)
  return (
    <>
      {renderFallbackCodeTokens(line.slice(0, index), fallbackLanguage)}
      <span data-highlighted-chars="">{pattern}</span>
      {renderFallbackCodeTokens(
        line.slice(index + pattern.length),
        fallbackLanguage
      )}
    </>
  )
}

function renderShikiCodeLine({
  fallbackLanguage,
  line,
  pattern,
  tokens,
}: {
  fallbackLanguage: string
  line: string
  pattern: string
  tokens: readonly ShikiCodeToken[]
}) {
  if (!tokens.length) return " "
  if (!pattern) return renderShikiCodeTokens(tokens)

  const highlightStart = line.indexOf(pattern)
  if (highlightStart < 0) return renderShikiCodeTokens(tokens)

  return renderShikiCodeTokensWithHighlight({
    fallbackLanguage,
    highlightEnd: highlightStart + pattern.length,
    highlightStart,
    tokens,
  })
}

function renderShikiCodeTokens(tokens: readonly ShikiCodeToken[]) {
  return tokens.map((token, index) => (
    <span
      key={index}
      className="text-[var(--shiki-light)] dark:text-[var(--shiki-dark)]"
      data-pretext-code-token="shiki"
      data-shiki-token=""
      style={shikiTokenStyle(token)}
    >
      {token.content}
    </span>
  ))
}

function renderShikiCodeTokensWithHighlight({
  fallbackLanguage,
  highlightEnd,
  highlightStart,
  tokens,
}: {
  fallbackLanguage: string
  highlightEnd: number
  highlightStart: number
  tokens: readonly ShikiCodeToken[]
}) {
  const rendered: React.ReactNode[] = []
  let cursor = 0

  tokens.forEach((token, tokenIndex) => {
    const tokenStart = cursor
    const tokenEnd = cursor + token.content.length
    cursor = tokenEnd

    if (tokenEnd <= highlightStart || tokenStart >= highlightEnd) {
      rendered.push(
        <span
          key={tokenIndex}
          className="text-[var(--shiki-light)] dark:text-[var(--shiki-dark)]"
          data-pretext-code-token="shiki"
          data-shiki-token=""
          style={shikiTokenStyle(token)}
        >
          {token.content}
        </span>
      )
      return
    }

    const before = token.content.slice(
      0,
      Math.max(0, highlightStart - tokenStart)
    )
    const highlighted = token.content.slice(
      Math.max(0, highlightStart - tokenStart),
      Math.min(token.content.length, highlightEnd - tokenStart)
    )
    const after = token.content.slice(
      Math.min(token.content.length, highlightEnd - tokenStart)
    )

    if (before) {
      rendered.push(
        <span
          key={`${tokenIndex}-before`}
          className="text-[var(--shiki-light)] dark:text-[var(--shiki-dark)]"
          data-pretext-code-token="shiki"
          data-shiki-token=""
          style={shikiTokenStyle(token)}
        >
          {before}
        </span>
      )
    }
    if (highlighted) {
      rendered.push(
        <span key={`${tokenIndex}-highlight`} data-highlighted-chars="">
          <span
            className="text-[var(--shiki-light)] dark:text-[var(--shiki-dark)]"
            data-pretext-code-token="shiki"
            data-shiki-token=""
            style={shikiTokenStyle(token)}
          >
            {highlighted}
          </span>
        </span>
      )
    }
    if (after) {
      rendered.push(
        <span
          key={`${tokenIndex}-after`}
          className="text-[var(--shiki-light)] dark:text-[var(--shiki-dark)]"
          data-pretext-code-token="shiki"
          data-shiki-token=""
          style={shikiTokenStyle(token)}
        >
          {after}
        </span>
      )
    }
  })

  if (rendered.length) return rendered
  return renderFallbackCodeTokens(" ", fallbackLanguage)
}

function renderFallbackCodeTokens(line: string, language: string) {
  const tokens = tokenizeCodeLine(line, language)
  if (!tokens.length) return " "
  return tokens.map((token, index) =>
    token.kind === "plain" ? (
      <React.Fragment key={index}>{token.value}</React.Fragment>
    ) : (
      <span
        key={index}
        className={codeTokenClassName(token.kind)}
        data-pretext-code-token={token.kind}
      >
        {token.value}
      </span>
    )
  )
}

type ShikiCodeToken = {
  content: string
  darkColor: string
  fontStyle: number | undefined
  lightColor: string
}

type RawShikiToken = {
  content?: unknown
  variants?: {
    dark?: {
      color?: unknown
      fontStyle?: unknown
    }
    light?: {
      color?: unknown
      fontStyle?: unknown
    }
  }
}

const shikiCodeLineCache = new Map<string, Promise<ShikiCodeToken[][] | null>>()
const resolvedShikiCodeLines = new Map<string, ShikiCodeToken[][] | null>()
const shikiCodeLineSubscribers = new Set<() => void>()

function ensureShikiCodeLines(args: {
  cacheKey: string
  expectedLineCount: number
  language: string
  source: string
}) {
  if (resolvedShikiCodeLines.has(args.cacheKey)) return
  void getShikiCodeLines(args).then((lines) => {
    resolvedShikiCodeLines.set(args.cacheKey, lines)
    while (resolvedShikiCodeLines.size > 128) {
      const oldestKey = resolvedShikiCodeLines.keys().next().value
      if (oldestKey === undefined) break
      resolvedShikiCodeLines.delete(oldestKey)
    }
    for (const notify of shikiCodeLineSubscribers) notify()
  })
}

// Shiki tokenization is an asynchronous external system (a dynamically imported
// highlighter with a shared resolved-value cache). The viewer subscribes to
// that cache with useSyncExternalStore — the React-idiomatic way to read an
// external store — rather than driving the load from an effect. The snapshot
// returns a stable reference (the cached array, or null while pending) so
// rendering stays progressive: plain source first, highlighted once resolved.
function useShikiCodeLines(
  source: string,
  language: string,
  expectedLineCount: number
) {
  const cacheKey = `${language}\0${source}`
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      shikiCodeLineSubscribers.add(onStoreChange)
      ensureShikiCodeLines({ cacheKey, expectedLineCount, language, source })
      return () => {
        shikiCodeLineSubscribers.delete(onStoreChange)
      }
    },
    [cacheKey, expectedLineCount, language, source]
  )
  const getSnapshot = React.useCallback(
    () =>
      resolvedShikiCodeLines.has(cacheKey)
        ? (resolvedShikiCodeLines.get(cacheKey) ?? null)
        : null,
    [cacheKey]
  )
  return React.useSyncExternalStore(subscribe, getSnapshot, () => null)
}

function getShikiCodeLines({
  cacheKey,
  expectedLineCount,
  language,
  source,
}: {
  cacheKey: string
  expectedLineCount: number
  language: string
  source: string
}) {
  let cached = shikiCodeLineCache.get(cacheKey)
  if (!cached) {
    cached = loadShikiCodeLines({ expectedLineCount, language, source })
    shikiCodeLineCache.set(cacheKey, cached)
    trimShikiCodeLineCache()
  }
  return cached
}

async function loadShikiCodeLines({
  expectedLineCount,
  language,
  source,
}: {
  expectedLineCount: number
  language: string
  source: string
}) {
  try {
    const shiki = await import("shiki")
    const lines = (await (shiki.codeToTokensWithThemes as any)(source, {
      lang: shikiLanguageFor(language),
      themes: {
        dark: "github-dark",
        light: "github-light-default",
      },
    })) as RawShikiToken[][]

    return normalizeShikiCodeLines(lines, expectedLineCount)
  } catch {
    return null
  }
}

function normalizeShikiCodeLines(
  lines: RawShikiToken[][],
  expectedLineCount: number
) {
  return Array.from({ length: expectedLineCount }, (_, index) =>
    normalizeShikiCodeLine(lines[index] ?? [])
  )
}

function normalizeShikiCodeLine(tokens: RawShikiToken[]): ShikiCodeToken[] {
  return tokens
    .map((token) => {
      const content = typeof token.content === "string" ? token.content : ""
      const lightColor = readShikiTokenColor(token, "light")
      const darkColor = readShikiTokenColor(token, "dark")
      if (!content || !lightColor || !darkColor) return null
      return {
        content,
        darkColor,
        fontStyle: readShikiTokenFontStyle(token),
        lightColor,
      }
    })
    .filter((token): token is ShikiCodeToken => token != null)
}

function readShikiTokenColor(token: RawShikiToken, variant: "dark" | "light") {
  const color = token.variants?.[variant]?.color
  return typeof color === "string" && /^#[0-9a-f]{6,8}$/i.test(color)
    ? color
    : ""
}

function readShikiTokenFontStyle(token: RawShikiToken) {
  const fontStyle =
    typeof token.variants?.light?.fontStyle === "number"
      ? token.variants.light.fontStyle
      : undefined
  return fontStyle && Number.isFinite(fontStyle) ? fontStyle : undefined
}

function shikiTokenStyle(token: ShikiCodeToken) {
  return {
    "--shiki-dark": token.darkColor,
    "--shiki-light": token.lightColor,
    fontStyle: token.fontStyle === 1 ? "italic" : undefined,
  } as React.CSSProperties
}

function shikiLanguageFor(language: string) {
  const aliases: Record<string, string> = {
    dockerfile: "docker",
    js: "javascript",
    shell: "bash",
    ts: "typescript",
  }
  return aliases[language] ?? language
}

function trimShikiCodeLineCache() {
  while (shikiCodeLineCache.size > 64) {
    const oldestKey = shikiCodeLineCache.keys().next().value
    if (!oldestKey) break
    shikiCodeLineCache.delete(oldestKey)
  }
}

type CodeToken = {
  kind: "comment" | "keyword" | "literal" | "number" | "plain" | "string"
  value: string
}

function tokenizeCodeLine(line: string, language: string): CodeToken[] {
  if (!line) return []
  if (language === "diff") return tokenizeDiffLine(line)
  if (language === "json") return tokenizeJsonLikeLine(line)
  if (language === "yaml") return tokenizeYamlLine(line)
  if (
    language === "js" ||
    language === "jsx" ||
    language === "ts" ||
    language === "tsx"
  ) {
    return tokenizeCStyleLine(line)
  }
  if (
    language === "shell" ||
    language === "bash" ||
    language === "dockerfile"
  ) {
    return tokenizeShellLine(line)
  }
  return [{ kind: "plain", value: line }]
}

function tokenizeCStyleLine(line: string): CodeToken[] {
  const commentIndex = line.indexOf("//")
  const codePart = commentIndex >= 0 ? line.slice(0, commentIndex) : line
  const commentPart = commentIndex >= 0 ? line.slice(commentIndex) : ""
  return [
    ...tokenizeByPattern(
      codePart,
      /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:as|async|await|break|case|catch|class|const|continue|default|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|interface|let|new|null|of|return|satisfies|switch|throw|true|try|type|typeof|undefined|var|while|yield)\b|\b\d+(?:\.\d+)?\b)/g,
      classifyCStyleToken
    ),
    ...(commentPart ? [{ kind: "comment" as const, value: commentPart }] : []),
  ]
}

function classifyCStyleToken(value: string): CodeToken["kind"] {
  if (/^["'`]/.test(value)) return "string"
  if (/^\d/.test(value)) return "number"
  if (/^(?:true|false|null|undefined)$/.test(value)) return "literal"
  return "keyword"
}

function tokenizeJsonLikeLine(line: string): CodeToken[] {
  return tokenizeByPattern(
    line,
    /("(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)/gi,
    (value) => {
      if (/^"/.test(value)) return "string"
      if (/^(?:true|false|null)$/i.test(value)) return "literal"
      return "number"
    }
  )
}

function tokenizeYamlLine(line: string): CodeToken[] {
  const commentIndex = line.indexOf("#")
  const codePart = commentIndex >= 0 ? line.slice(0, commentIndex) : line
  const commentPart = commentIndex >= 0 ? line.slice(commentIndex) : ""
  return [
    ...tokenizeByPattern(
      codePart,
      /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b)/gi,
      (value) => {
        if (/^["']/.test(value)) return "string"
        if (/^(?:true|false|null)$/i.test(value)) return "literal"
        return "number"
      }
    ),
    ...(commentPart ? [{ kind: "comment" as const, value: commentPart }] : []),
  ]
}

function tokenizeShellLine(line: string): CodeToken[] {
  const commentIndex = line.search(/(^|\s)#/)
  const codePart = commentIndex >= 0 ? line.slice(0, commentIndex) : line
  const commentPart = commentIndex >= 0 ? line.slice(commentIndex) : ""
  return [
    ...tokenizeByPattern(
      codePart,
      /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:cd|cp|curl|echo|export|git|grep|mkdir|mv|node|npm|pnpm|rm|sed|test|yarn)\b)/g,
      (value) => (/^["']/.test(value) ? "string" : "keyword")
    ),
    ...(commentPart ? [{ kind: "comment" as const, value: commentPart }] : []),
  ]
}

function tokenizeDiffLine(line: string): CodeToken[] {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return [{ kind: "literal", value: line }]
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return [{ kind: "comment", value: line }]
  }
  return [{ kind: "plain", value: line }]
}

function tokenizeByPattern(
  line: string,
  pattern: RegExp,
  classify: (value: string) => CodeToken["kind"]
): CodeToken[] {
  const tokens: CodeToken[] = []
  let cursor = 0
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) {
      tokens.push({ kind: "plain", value: line.slice(cursor, index) })
    }
    const value = match[0]
    tokens.push({ kind: classify(value), value })
    cursor = index + value.length
  }
  if (cursor < line.length) {
    tokens.push({ kind: "plain", value: line.slice(cursor) })
  }
  return tokens
}

function codeTokenClassName(kind: CodeToken["kind"]) {
  switch (kind) {
    case "comment":
      return "text-muted-foreground italic"
    case "keyword":
      return "font-semibold text-sky-700 dark:text-sky-300"
    case "literal":
      return "text-purple-700 dark:text-purple-300"
    case "number":
      return "text-amber-700 dark:text-amber-300"
    case "string":
      return "text-emerald-700 dark:text-emerald-300"
    default:
      return ""
  }
}

function toKebab(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function alertIconForKind(kind: string) {
  switch (kind) {
    case "note":
      return Info
    case "tip":
      return Lightbulb
    case "warning":
      return TriangleAlert
    case "caution":
      return CircleAlert
    default:
      return BadgeAlert
  }
}

function calloutTitle(kind: string) {
  const titles: Record<string, string> = {
    caution: "Caution",
    important: "Important",
    note: "Note",
    tip: "Tip",
    warning: "Warning",
  }
  return titles[kind] ?? "Note"
}

function linkKindForHref(href: string) {
  if (href.startsWith("#")) return "fragment"
  if (href.startsWith("/")) return "root"
  if (/^mailto:/i.test(href)) return "email"
  if (/^(?:https?:)?\/\//i.test(href)) return "external"
  return "relative"
}

function linkFormForHref({ href, text }: { href: string; text: string }) {
  if (/^mailto:/i.test(href) && href.slice("mailto:".length) === text) {
    return "email-autolink"
  }
  if (
    /^https?:\/\/www\./i.test(href) &&
    href.replace(/^https?:\/\//i, "") === text
  ) {
    return "autolink"
  }
  if (href === text && /^(?:https?:)?\/\//i.test(href)) return "autolink"
  return "inline"
}

function footnoteLabelForLink({
  href,
  label,
  text,
}: {
  href: string
  label: unknown
  text: string
}) {
  const display = footnoteDisplayForHref(href, text)
  if (/^#(?:user-content-)?fnref-/i.test(href)) {
    return "Back to footnote reference ↩"
  }
  if (/^#(?:user-content-)?fn-/i.test(href)) {
    return `Footnote${display ? ` ${display}` : ""}`
  }
  if (typeof label === "string" && label) return label
  return undefined
}

function footnoteDisplayForHref(href: string, text: string) {
  const visibleText = text.trim().replace(/^\[|\]$/g, "")
  if (/^\d+[a-z]?$/i.test(visibleText)) return visibleText

  const match = /^#(?:user-content-)?fn(?:ref)?-([A-Za-z0-9_-]+)/i.exec(href)
  if (!match) return ""
  return match[1]!.replace(/-/g, " ")
}

function reactNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(reactNodeText).join("")
  return ""
}

function hasDescendantElement(
  element: PretextMarkdownHastElement | null,
  tagName: string
): boolean {
  if (!element) return false
  return element.children.some((child) => {
    const childElement = readHastElement(child)
    return (
      childElement?.tagName === tagName ||
      hasDescendantElement(childElement, tagName)
    )
  })
}

function isWhitespaceText(node: PretextMarkdownHastNode) {
  return (
    node.type === "text" &&
    typeof node.value === "string" &&
    node.value.trim() === ""
  )
}

function extractHastText(element: PretextMarkdownHastElement | null): string {
  return extractHastNodeText(element)
}

function extractHastNodeText(
  node: PretextMarkdownHastNode | null | undefined
): string {
  if (!node) return ""
  if (node.type === "text" && typeof node.value === "string") return node.value
  const element = readHastElement(node)
  if (!element) return ""
  return element.children.map(extractHastNodeText).join("")
}

function handleHorizontalScrollKeyDown(
  event: React.KeyboardEvent<HTMLElement>
) {
  const element =
    event.currentTarget.querySelector<HTMLElement>(
      "[data-pretext-markdown-table-scroll]"
    ) ?? event.currentTarget
  if (event.key === "ArrowRight") {
    element.scrollLeft += 50
    event.preventDefault()
  } else if (event.key === "ArrowLeft") {
    element.scrollLeft -= 50
    event.preventDefault()
  } else if (event.key === "End") {
    element.scrollLeft = Math.max(0, element.scrollWidth - element.clientWidth)
    event.preventDefault()
  } else if (event.key === "Home") {
    element.scrollLeft = 0
    event.preventDefault()
  }
}

function tableRowCount(table: PretextMarkdownHastElement | null) {
  if (!table) return undefined
  return countDescendantElements(table, "tr")
}

function tableColumnCount(table: PretextMarkdownHastElement | null) {
  const firstRow = findDescendantElement(table, "tr")
  if (!firstRow) return undefined
  return firstRow.children.filter((child) => {
    const element = readHastElement(child)
    return element?.tagName === "td" || element?.tagName === "th"
  }).length
}

function countDescendantElements(
  element: PretextMarkdownHastElement,
  tagName: string
): number {
  return element.children.reduce((sum, child) => {
    const childElement = readHastElement(child)
    if (!childElement) return sum
    return (
      sum +
      (childElement.tagName === tagName ? 1 : 0) +
      countDescendantElements(childElement, tagName)
    )
  }, 0)
}

function findDescendantElement(
  element: PretextMarkdownHastElement | null,
  tagName: string
): PretextMarkdownHastElement | null {
  if (!element) return null
  for (const child of element.children) {
    const childElement = readHastElement(child)
    if (!childElement) continue
    if (childElement.tagName === tagName) return childElement
    const found = findDescendantElement(childElement, tagName)
    if (found) return found
  }
  return null
}

// A subtle hover copy affordance in the table's top-right corner, replacing the
// persistent chrome bar so the table reads as a clean document table.
function TableCopyButton() {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      aria-label="Copy table as TSV"
      className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md border bg-background/90 px-2 py-1 text-xs font-medium text-muted-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
      type="button"
      onClick={(event) => {
        copyTable(event.currentTarget)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

function copyTable(button: HTMLButtonElement) {
  const region = button.closest('[role="region"]')
  const table = region?.querySelector("table")
  if (!table) return

  const selection = window.getSelection()
  const selectedText =
    selection &&
    selection.rangeCount > 0 &&
    table.contains(selection.anchorNode)
      ? selection.toString()
      : ""
  if (selectedText.trim()) {
    void navigator.clipboard?.writeText(selectedText.trim())
    return
  }

  void navigator.clipboard?.writeText(serializeTableAsTsv(table))
}

function serializeTableAsTsv(table: HTMLTableElement) {
  return Array.from(table.querySelectorAll("tr"))
    .map((row) =>
      Array.from(row.querySelectorAll("th,td"))
        .map((cell) => normalizeTableCellText(cell.textContent ?? ""))
        .join("\t")
    )
    .join("\n")
}

function normalizeTableCellText(value: string) {
  return value.trim().replace(/[\t\r\n ]+/g, " ")
}

function copyHeadingLink(id: string) {
  const base = `${window.location.origin}${window.location.pathname}${window.location.search}`
  void navigator.clipboard?.writeText(`${base}#${id}`)
}

function readComponentProps(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined
}

function readOptionalNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function readOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return undefined
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}
