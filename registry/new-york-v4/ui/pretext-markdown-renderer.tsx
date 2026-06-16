"use client"

import * as React from "react"
import {
  AlertCircle,
  BadgeAlert,
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  Info,
  Lightbulb,
  Link,
  RefreshCcw,
  TriangleAlert,
} from "lucide-react"
import Markdown, { MarkdownHooks, type Components } from "react-markdown"

import { cn } from "@/lib/utils"

import { Button } from "./button"
import type { PretextMarkdownChunk } from "./pretext-markdown-document-model"
import {
  ALERT_LABELS,
  CALLOUT_LABELS,
  type AlertKind,
  type CalloutKind,
  type PretextComponent,
  type PretextComponentFallback,
} from "./pretext-markdown-components"
import {
  createPretextMarkdownRemarkPlugins,
  PRETEXT_MARKDOWN_REHYPE_PLUGINS,
  PRETEXT_MARKDOWN_SYNC_REHYPE_PLUGINS,
  readPretextAlertKind,
  readPretextCallout,
  readPretextComponent,
  readPretextComponentFallback,
  readPretextHeadingId,
} from "./pretext-markdown-policy"
import {
  sanitizePretextMarkdownSvg,
  type PretextMarkdownSvgSanitizer,
} from "./pretext-markdown-sanitize"
import {
  sanitizePretextMarkdownImageUrl,
  sanitizePretextMarkdownMediaUrl,
  sanitizePretextMarkdownUrl,
} from "./pretext-markdown-url-policy"
import { useViewerClipboardCopy } from "./text-viewer-chrome"
import {
  PretextMarkdownCopyButton,
  readPretextMarkdownSelectedText,
  scrollPretextMarkdownHorizontalRegion,
} from "./pretext-markdown-controls"
import {
  normalizePretextMarkdownDiagramSource,
  PretextMarkdownDiagram,
} from "./pretext-markdown-mermaid"

export function PretextMarkdownChunkRenderer({
  chunk,
  footnoteDefinitionsMarkdown = "",
  referenceDefinitionsMarkdown = "",
}: {
  chunk: PretextMarkdownChunk
  footnoteDefinitionsMarkdown?: string
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
        className="overflow-hidden rounded-md border bg-muted/35 text-sm text-muted-foreground"
        data-pretext-markdown-frontmatter={language}
      >
        <div className="flex min-h-9 items-center border-b bg-muted/55 px-3">
          <span className="text-xs font-medium tracking-normal uppercase">
            {language} frontmatter
          </span>
        </div>
        {chunk.frontmatterEntries?.length ? (
          <dl
            aria-label={`${language.toUpperCase()} frontmatter metadata`}
            className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[max-content_minmax(0,1fr)]"
            data-pretext-markdown-frontmatter-metadata=""
          >
            {chunk.frontmatterEntries.map((entry) => (
              <React.Fragment key={entry.key}>
                <dt className="font-medium text-foreground">{entry.key}</dt>
                <dd
                  className="min-w-0 [overflow-wrap:anywhere]"
                  data-frontmatter-value-kind={entry.valueKind}
                >
                  {entry.value}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        ) : null}
        <pre className="m-0 border-t bg-background/55 p-4 font-mono text-[13px] leading-6 whitespace-pre-wrap">
          <code>{chunk.markdown}</code>
        </pre>
      </section>
    )
  }

  if (chunk.isHostile) {
    return <PretextMarkdownHostileChunk markdown={chunk.markdown} />
  }

  const markdownSource = createPretextMarkdownRenderSource({
    footnoteDefinitionsMarkdown,
    markdown: chunk.markdown,
    referenceDefinitionsMarkdown,
  })

  return (
    <div className="pretext-markdown-chunk-content min-w-0 text-[16px] leading-7 text-foreground">
      {typeof window === "undefined" ? (
        <Markdown
          components={markdownComponents}
          rehypePlugins={PRETEXT_MARKDOWN_SYNC_REHYPE_PLUGINS}
          remarkRehypeOptions={{ allowDangerousHtml: true }}
          remarkPlugins={remarkPlugins}
          urlTransform={sanitizePretextMarkdownUrl}
        >
          {markdownSource}
        </Markdown>
      ) : (
        <MarkdownHooks
          components={markdownComponents}
          rehypePlugins={PRETEXT_MARKDOWN_REHYPE_PLUGINS}
          remarkRehypeOptions={{ allowDangerousHtml: true }}
          remarkPlugins={remarkPlugins}
          urlTransform={sanitizePretextMarkdownUrl}
        >
          {markdownSource}
        </MarkdownHooks>
      )}
    </div>
  )
}

function PretextMarkdownHostileChunk({ markdown }: { markdown: string }) {
  const preview = createPretextMarkdownHostilePreview(markdown)

  return (
    <section
      aria-label="Large Markdown block"
      className="overflow-hidden rounded-md border bg-muted/25 text-sm text-muted-foreground"
      data-pretext-markdown-hostile-fallback=""
      data-pretext-markdown-hostile-line-count={preview.lineCount}
      data-pretext-markdown-hostile-omitted-lines={preview.omittedLineCount}
    >
      <div className="flex min-h-9 items-center gap-3 border-b bg-muted/55 px-3">
        <span className="font-medium text-foreground">
          Large Markdown block
        </span>
        <span className="text-xs">
          {preview.lineCount} source{" "}
          {preview.lineCount === 1 ? "line" : "lines"}
        </span>
        <PretextMarkdownCopyButton
          ariaLabel="Copy large Markdown block source"
          className="ml-auto"
          text={markdown}
        />
      </div>
      <pre
        aria-label="Large Markdown block source preview"
        className="max-h-[36rem] overflow-auto p-4 font-mono text-[13px] leading-6 whitespace-pre"
        data-pretext-markdown-hostile-preview=""
        tabIndex={0}
      >
        <code>{preview.text}</code>
      </pre>
    </section>
  )
}

function createPretextMarkdownHostilePreview(markdown: string) {
  const lines = splitPretextMarkdownSourceLines(markdown || " ")
  const lineCount = lines.length
  const previewLineLimit =
    PRETEXT_MARKDOWN_HOSTILE_PREVIEW_HEAD_LINES +
    PRETEXT_MARKDOWN_HOSTILE_PREVIEW_TAIL_LINES

  if (lineCount <= previewLineLimit + 1) {
    return {
      lineCount,
      omittedLineCount: 0,
      text: lines.join("\n"),
    }
  }

  const omittedLineCount = Math.max(0, lineCount - previewLineLimit)
  return {
    lineCount,
    omittedLineCount,
    text: [
      ...lines.slice(0, PRETEXT_MARKDOWN_HOSTILE_PREVIEW_HEAD_LINES),
      `... ${omittedLineCount} source lines omitted ...`,
      ...lines.slice(-PRETEXT_MARKDOWN_HOSTILE_PREVIEW_TAIL_LINES),
    ].join("\n"),
  }
}

function splitPretextMarkdownSourceLines(text: string) {
  return text.split(/\r\n|[\n\r\u2028\u2029]/)
}

function createPretextMarkdownRenderSource({
  footnoteDefinitionsMarkdown,
  markdown,
  referenceDefinitionsMarkdown,
}: {
  footnoteDefinitionsMarkdown: string
  markdown: string
  referenceDefinitionsMarkdown: string
}) {
  const renderMarkdown = stripPretextMarkdownFootnoteDefinitions(markdown)
  const prefixes = [
    referenceDefinitionsMarkdown,
    hasPretextMarkdownFootnoteReference(renderMarkdown)
      ? footnoteDefinitionsMarkdown
      : "",
  ]
    .map((prefix) => prefix.trimEnd())
    .filter(Boolean)

  return [...prefixes, renderMarkdown].filter(Boolean).join("\n\n")
}

function stripPretextMarkdownFootnoteDefinitions(markdown: string) {
  return markdown
    .split(/\r\n|[\n\r\u2028\u2029]/)
    .filter((line) => !isPretextMarkdownFootnoteDefinitionLine(line))
    .join("\n")
    .trim()
}

function hasPretextMarkdownFootnoteReference(markdown: string) {
  return /(^|[^\[])\[\^[^\]\r\n]+\]/u.test(markdown)
}

function isPretextMarkdownFootnoteDefinitionLine(line: string) {
  return /^\s{0,3}\[\^[^\]\r\n]+\]:[ \t]?/u.test(line)
}

const PRETEXT_MARKDOWN_WRAP_CLASS_NAME =
  "min-w-0 [overflow-wrap:anywhere] [word-break:normal]"
const PRETEXT_MARKDOWN_CODE_SOURCE_CLASS_NAME =
  "max-w-full overflow-x-auto p-4 text-sm leading-6 [overflow-wrap:normal] [&_code]:inline-block [&_code]:min-w-max"
const PRETEXT_MARKDOWN_CODE_LINE_NUMBERS_CLASS_NAME =
  "[counter-reset:line] [&>[data-line]::before]:mr-6 [&>[data-line]::before]:inline-block [&>[data-line]::before]:w-5 [&>[data-line]::before]:select-none [&>[data-line]::before]:text-right [&>[data-line]::before]:text-muted-foreground/70 [&>[data-line]::before]:[counter-increment:line] [&>[data-line]::before]:content-[counter(line)] [&[data-line-numbers-max-digits='2']>[data-line]::before]:w-7 [&[data-line-numbers-max-digits='3']>[data-line]::before]:w-9 [&[data-line-numbers-max-digits='4']>[data-line]::before]:w-11"
const PRETEXT_MARKDOWN_CODE_HIGHLIGHT_CLASS_NAME =
  "[&>[data-highlighted-line]]:bg-muted-foreground/10 [&_[data-highlighted-chars]]:rounded [&_[data-highlighted-chars]]:bg-muted-foreground/15 [&_[data-highlighted-chars]]:px-0.5"
const PRETEXT_MARKDOWN_CODE_LANGUAGE_ALIASES: Record<string, string> = {
  bash: "shell",
  "bash-session": "shell",
  cjs: "js",
  console: "shell",
  docker: "dockerfile",
  htm: "html",
  javascript: "js",
  javascriptreact: "jsx",
  jsonc: "json",
  "mermaid-js": "mermaid",
  md: "markdown",
  mjs: "js",
  mmd: "mermaid",
  patch: "diff",
  py: "python",
  rb: "ruby",
  sh: "shell",
  "shell-session": "shell",
  shellscript: "shell",
  terminal: "shell",
  typescript: "ts",
  typescriptreact: "tsx",
  yml: "yaml",
  zsh: "shell",
}
const PRETEXT_MARKDOWN_HOSTILE_PREVIEW_HEAD_LINES = 36
const PRETEXT_MARKDOWN_HOSTILE_PREVIEW_TAIL_LINES = 12

type PretextMarkdownTabRegistration = {
  id: string
  title: string
}

type PretextMarkdownTabsContextValue = {
  selectedId: string | null
  registerTab: (tab: PretextMarkdownTabRegistration) => () => void
  selectTab: (id: string) => void
}

const PretextMarkdownTabsContext =
  React.createContext<PretextMarkdownTabsContextValue | null>(null)

const PretextMarkdownCodeBlockContext = React.createContext<{
  language: string | null
} | null>(null)

const markdownComponents = {
  figure: ({ className, children, node, ...props }) => {
    if (isPretextMarkdownCodeFigure(node)) {
      return (
        <PretextMarkdownCodeBlock className={className} node={node} {...props}>
          {children}
        </PretextMarkdownCodeBlock>
      )
    }

    return (
      <figure className={className} {...props}>
        {children}
      </figure>
    )
  },
  div: ({ className, children, node, ...props }) => {
    const callout = readPretextCallout(node)
    if (callout) {
      return (
        <PretextMarkdownCallout callout={callout} className={className}>
          {children}
        </PretextMarkdownCallout>
      )
    }

    const fallback = readPretextComponentFallback(node)
    if (fallback) {
      return (
        <PretextMarkdownComponentFallback
          className={className}
          fallback={fallback}
        />
      )
    }

    const component = readPretextComponent(node)
    if (component) {
      return (
        <PretextMarkdownComponent component={component}>
          {children}
        </PretextMarkdownComponent>
      )
    }

    return (
      <div className={className} {...props}>
        {children}
      </div>
    )
  },
  h1: ({ className, children, node, ...props }) => (
    <PretextMarkdownHeading
      className={className}
      level={1}
      node={node}
      textClassName="mt-0 mb-5 text-3xl font-semibold tracking-normal text-foreground"
      {...props}
    >
      {children}
    </PretextMarkdownHeading>
  ),
  h2: ({ className, children, node, ...props }) => (
    <PretextMarkdownHeading
      className={className}
      level={2}
      node={node}
      textClassName="mt-9 mb-4 text-2xl font-semibold tracking-normal text-foreground first:mt-0"
      {...props}
    >
      {children}
    </PretextMarkdownHeading>
  ),
  h3: ({ className, children, node, ...props }) => (
    <PretextMarkdownHeading
      className={className}
      level={3}
      node={node}
      textClassName="mt-7 mb-3 text-xl font-semibold tracking-normal text-foreground first:mt-0"
      {...props}
    >
      {children}
    </PretextMarkdownHeading>
  ),
  h4: ({ className, children, node, ...props }) => (
    <PretextMarkdownHeading
      className={className}
      level={4}
      node={node}
      textClassName="mt-6 mb-2 text-lg font-semibold tracking-normal text-foreground first:mt-0"
      {...props}
    >
      {children}
    </PretextMarkdownHeading>
  ),
  h5: ({ className, children, node, ...props }) => (
    <PretextMarkdownHeading
      className={className}
      level={5}
      node={node}
      textClassName="mt-5 mb-2 text-base font-semibold tracking-normal text-foreground first:mt-0"
      {...props}
    >
      {children}
    </PretextMarkdownHeading>
  ),
  h6: ({ className, children, node, ...props }) => (
    <PretextMarkdownHeading
      className={className}
      level={6}
      node={node}
      textClassName="mt-5 mb-2 text-sm font-semibold tracking-normal text-muted-foreground first:mt-0"
      {...props}
    >
      {children}
    </PretextMarkdownHeading>
  ),
  p: ({ className, node: _node, ...props }) => (
    <p
      className={cn(
        "my-4 leading-7 first:mt-0",
        PRETEXT_MARKDOWN_WRAP_CLASS_NAME,
        className
      )}
      {...props}
    />
  ),
  a: ({ className, href, children, node: _node, title, ...props }) => {
    const safeHref = sanitizePretextMarkdownUrl(href ?? "")
    if (!safeHref) {
      return <span>{children}</span>
    }

    const linkKind = getPretextMarkdownLinkKind(safeHref)
    const external = linkKind === "external"
    const linkTitle = normalizePretextMarkdownLinkTitle(title)
    const linkText = extractReactText(children).trim()
    const linkForm = getPretextMarkdownLinkForm(safeHref, linkText)
    const footnoteRef =
      isPretextFootnoteRef(props) || isPretextFootnoteRefHref(safeHref)
    const footnoteBackref =
      isPretextFootnoteBackref(props) || isPretextFootnoteBackrefHref(safeHref)
    const ariaLabel = footnoteRef
      ? `Footnote ${linkText || "reference"}`
      : footnoteBackref
        ? `Back to footnote reference${linkText ? ` ${linkText}` : ""}`
        : undefined
    return (
      <a
        className={cn(
          "font-medium underline decoration-muted-foreground/45 underline-offset-4 transition-colors visited:text-muted-foreground hover:decoration-current",
          PRETEXT_MARKDOWN_WRAP_CLASS_NAME,
          linkKind === "fragment" &&
            "decoration-muted-foreground/70 decoration-dotted",
          linkForm !== "inline" && "font-mono text-[0.95em]",
          footnoteRef && "ml-0.5 rounded px-1 text-[0.72em] leading-none",
          footnoteBackref && "ml-1 text-muted-foreground no-underline",
          className
        )}
        {...props}
        data-pretext-link-form={linkForm}
        data-pretext-link-kind={linkKind}
        href={safeHref}
        rel={external ? "noopener noreferrer" : undefined}
        target={external ? "_blank" : undefined}
        title={linkTitle}
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
        <PretextMarkdownAlert className={className} kind={kind} {...props}>
          {children}
        </PretextMarkdownAlert>
      )
    }

    return (
      <blockquote
        className={cn(
          "my-5 border-l-4 border-border pl-4 text-muted-foreground [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&>ol]:my-2 [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:my-2",
          PRETEXT_MARKDOWN_WRAP_CLASS_NAME,
          className
        )}
        {...props}
      >
        {children}
      </blockquote>
    )
  },
  br: ({ node: _node, ...props }) => (
    <br {...props} data-pretext-line-break="soft" />
  ),
  del: ({ className, node: _node, ...props }) => (
    <del
      className={cn(
        "text-muted-foreground decoration-muted-foreground/70 decoration-2",
        className
      )}
      {...props}
      data-pretext-strikethrough=""
    />
  ),
  abbr: ({ className, node: _node, ...props }) => (
    <abbr
      className={cn(
        "cursor-help decoration-dotted underline-offset-3",
        className
      )}
      {...props}
      data-pretext-raw-inline=""
    />
  ),
  cite: ({ className, node: _node, ...props }) => (
    <cite
      className={cn("text-foreground italic", className)}
      {...props}
      data-pretext-raw-inline=""
    />
  ),
  dfn: ({ className, node: _node, ...props }) => (
    <dfn
      className={cn("font-medium text-foreground italic", className)}
      {...props}
      data-pretext-raw-inline=""
    />
  ),
  ins: ({ className, node: _node, ...props }) => (
    <ins
      className={cn(
        "underline decoration-border underline-offset-2",
        className
      )}
      {...props}
      data-pretext-raw-inline=""
    />
  ),
  details: ({ className, node: _node, ...props }) => (
    <details
      className={cn("my-5 rounded-md border bg-muted/25 px-4 py-3", className)}
      {...props}
    />
  ),
  dl: ({ className, node: _node, ...props }) => (
    <dl className={cn("my-5 space-y-2", className)} {...props} />
  ),
  dt: ({ className, node: _node, ...props }) => (
    <dt
      className={cn(
        "font-semibold text-foreground",
        PRETEXT_MARKDOWN_WRAP_CLASS_NAME,
        className
      )}
      {...props}
    />
  ),
  dd: ({ className, node: _node, ...props }) => (
    <dd
      className={cn(
        "ml-5 text-muted-foreground",
        PRETEXT_MARKDOWN_WRAP_CLASS_NAME,
        className
      )}
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
      data-pretext-raw-inline=""
    />
  ),
  kbd: ({ className, node: _node, ...props }) => (
    <kbd
      className={cn(
        "rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] shadow-xs",
        className
      )}
      {...props}
      data-pretext-raw-inline=""
    />
  ),
  q: ({ className, node: _node, ...props }) => (
    <q
      className={cn("text-foreground italic", className)}
      {...props}
      data-pretext-raw-inline=""
    />
  ),
  samp: ({ className, node: _node, ...props }) => (
    <samp
      className={cn(
        "rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]",
        PRETEXT_MARKDOWN_WRAP_CLASS_NAME,
        className
      )}
      {...props}
      data-pretext-raw-inline=""
    />
  ),
  var: ({ className, node: _node, ...props }) => (
    <var
      className={cn("font-medium text-foreground italic", className)}
      {...props}
      data-pretext-raw-inline=""
    />
  ),
  small: ({ className, node: _node, ...props }) => (
    <small
      className={cn("text-[0.875em] text-muted-foreground", className)}
      {...props}
      data-pretext-raw-inline=""
    />
  ),
  time: ({ className, node: _node, ...props }) => (
    <time
      className={cn("font-medium text-foreground", className)}
      {...props}
      data-pretext-raw-inline=""
    />
  ),
  ul: ({ className, node: _node, ...props }) => (
    <ul
      className={cn(
        "my-4 ml-6 list-disc space-y-1 marker:text-muted-foreground [&_ul]:my-1 [&_ul]:list-[circle] [&_ul_ul]:list-[square]",
        className
      )}
      {...props}
    />
  ),
  ol: ({ className, node: _node, ...props }) => (
    <ol
      className={cn(
        "my-4 ml-6 list-decimal space-y-1 marker:text-muted-foreground [&_ol]:my-1 [&_ol]:list-[lower-alpha] [&_ol_ol]:list-[lower-roman]",
        className
      )}
      {...props}
    />
  ),
  li: ({ children, className, node, ...props }) => {
    const taskListItem =
      isPretextTaskListItem(children) ||
      isPretextTaskListItemNode(node) ||
      /\btask-list-item\b/.test(className ?? "")

    return (
      <li
        className={cn(
          "pl-1 leading-7 [&>ol]:mt-1 [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:mt-1",
          taskListItem && "list-none pl-0",
          PRETEXT_MARKDOWN_WRAP_CLASS_NAME,
          className
        )}
        data-pretext-task-list-item={taskListItem ? "" : undefined}
        {...props}
      >
        {children}
      </li>
    )
  },
  input: ({ className, checked, node: _node, type, ...props }) => {
    if (type !== "checkbox") {
      return <input className={className} type={type} {...props} />
    }

    return (
      <input
        {...props}
        aria-label={checked ? "Completed task" : "Incomplete task"}
        aria-readonly="true"
        checked={checked}
        className={cn(
          "mr-2 size-3.5 rounded border-border align-[-0.15em] accent-primary disabled:cursor-default disabled:opacity-100",
          className
        )}
        data-pretext-task-checkbox={checked ? "checked" : "unchecked"}
        disabled
        readOnly
        type="checkbox"
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
    const resolvedAlign = resolvePretextMarkdownTableCellAlignment({ align, style })
    return (
      <th
        className={cn(
          "px-3 py-2 align-top font-semibold",
          pretextMarkdownTableCellAlignmentClassName(resolvedAlign),
          PRETEXT_MARKDOWN_WRAP_CLASS_NAME,
          className
        )}
        align={resolvedAlign}
        {...props}
      />
    )
  },
  td: ({ align, className, node: _node, style, ...props }) => {
    const resolvedAlign = resolvePretextMarkdownTableCellAlignment({ align, style })
    return (
      <td
        className={cn(
          "px-3 py-2 align-top",
          pretextMarkdownTableCellAlignmentClassName(resolvedAlign),
          PRETEXT_MARKDOWN_WRAP_CLASS_NAME,
          className
        )}
        align={resolvedAlign}
        {...props}
      />
    )
  },
  pre: ({ className, children, node: _node, ...props }) => {
    const language = readPretextMarkdownCodeElementLanguage(children)
    if (language === "mermaid") {
      return (
        <pre
          aria-label="mermaid code source"
          className={cn(PRETEXT_MARKDOWN_CODE_SOURCE_CLASS_NAME, className)}
          data-pretext-code-source=""
          role="region"
          tabIndex={0}
          {...props}
        >
          {children}
        </pre>
      )
    }

    return (
      <pre
        aria-label={`${language ? `${language} ` : ""}code source`}
        className={cn(PRETEXT_MARKDOWN_CODE_SOURCE_CLASS_NAME, className)}
        data-pretext-code-source=""
        role="region"
        tabIndex={0}
        {...props}
      >
        {children}
      </pre>
    )
  },
  code: ({ className, children, node: _node, ...props }) => {
    const codeProps = props as typeof props & {
      "data-line-numbers"?: unknown
    }
    const lineNumbers = codeProps["data-line-numbers"] != null
    return (
      <code
        className={cn(
          "rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]",
          PRETEXT_MARKDOWN_WRAP_CLASS_NAME,
          PRETEXT_MARKDOWN_CODE_HIGHLIGHT_CLASS_NAME,
          lineNumbers && PRETEXT_MARKDOWN_CODE_LINE_NUMBERS_CLASS_NAME,
          className
        )}
        {...props}
      >
        {children}
      </code>
    )
  },
  span: PretextMarkdownSpan,
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
      data-pretext-raw-inline=""
    />
  ),
  sup: ({ className, node: _node, ...props }) => (
    <sup
      className={cn("align-super text-[0.72em] leading-none", className)}
      {...props}
      data-pretext-raw-inline=""
    />
  ),
  hr: ({ className, node: _node, ...props }) => (
    <hr
      className={cn("my-10 border-0 border-t border-border/80", className)}
      data-pretext-thematic-break=""
      {...props}
    />
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
  node: _node,
  textClassName,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  level: 1 | 2 | 3 | 4 | 5 | 6
  node: unknown
  textClassName: string
}) {
  const id = readPretextHeadingId(props)
  const HeadingTag = `h${level}` as const
  const headingText = extractReactText(children).trim() || "heading"
  const headingProps = omitPretextInternalReactProps(props)

  return (
    <div className="group flex min-w-0 items-baseline gap-1.5">
      <HeadingTag
        className={cn(textClassName, "min-w-0", className)}
        {...headingProps}
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

function omitPretextInternalReactProps<Props extends Record<string, unknown>>(
  props: Props
) {
  const safeProps: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (/^dataPretext/.test(key) || /^data-pretext-/.test(key)) continue
    safeProps[key] = value
  }
  return safeProps as Props
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
  componentName,
}: {
  callout: {
    kind: CalloutKind
    title: string
  }
  children: React.ReactNode
  className: string | undefined
  componentName?: string
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
      data-pretext-component={componentName}
      role="note"
    >
      <p className="mb-2 font-semibold">{callout.title}</p>
      <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </aside>
  )
}

function PretextMarkdownAlert({
  children,
  className,
  kind,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  kind: AlertKind
}) {
  const titleId = React.useId()
  const title = ALERT_LABELS[kind].replace(/:$/, "")

  return (
    <aside
      aria-labelledby={titleId}
      className={cn(
        "my-5 rounded-md border px-4 py-3",
        ALERT_STYLES[kind].container,
        className
      )}
      data-pretext-alert-kind={kind}
      role="note"
      {...props}
    >
      <div
        className={cn(
          "mb-2 flex items-center gap-2 font-semibold",
          ALERT_STYLES[kind].title
        )}
        data-pretext-alert-title=""
        id={titleId}
      >
        {ALERT_STYLES[kind].icon}
        <span>{title}</span>
      </div>
      <div
        className="min-w-0 pl-6 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
        data-pretext-alert-body=""
      >
        {children}
      </div>
    </aside>
  )
}

function PretextMarkdownSpan({
  className,
  children,
  node: _node,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { node?: unknown }) {
  const isMathBlock = isPretextMarkdownMathBlockClassName(className)
  const isMathInline =
    !isMathBlock && isPretextMarkdownMathInlineClassName(className)
  const spanProps = props as typeof props & {
    "data-line"?: unknown
  }
  const codeBlockContext = React.useContext(PretextMarkdownCodeBlockContext)
  const diffLineKind =
    codeBlockContext?.language === "diff" && spanProps["data-line"] != null
      ? readPretextMarkdownDiffLineKind(extractReactText(children))
      : null

  if (isMathBlock) {
    return (
      <span
        {...props}
        aria-label="Math block"
        className={cn(
          "my-5 block max-w-full overflow-x-auto rounded-md bg-muted/25 px-4 py-3",
          className
        )}
        data-pretext-math-block=""
        role="region"
        tabIndex={0}
        onKeyDown={scrollPretextMarkdownHorizontalRegion}
      >
        {children}
      </span>
    )
  }

  return (
    <span
      {...props}
      className={cn(
        diffLineKind === "add" &&
          "-mx-4 block border-l-2 border-emerald-500 bg-emerald-500/10 px-4",
        diffLineKind === "remove" &&
          "-mx-4 block border-l-2 border-red-500 bg-red-500/10 px-4",
        className
      )}
      data-pretext-code-diff-line={diffLineKind ?? undefined}
      data-pretext-math-inline={isMathInline ? "" : undefined}
    >
      {children}
    </span>
  )
}

function isPretextMarkdownMathBlockClassName(className: string | undefined) {
  return /\bkatex-display\b/.test(className ?? "")
}

function isPretextMarkdownMathInlineClassName(className: string | undefined) {
  return /\bkatex\b/.test(className ?? "")
}

function isPretextMarkdownExternalLink(href: string) {
  return /^https?:/i.test(href)
}

function getPretextMarkdownLinkKind(href: string) {
  if (isPretextMarkdownExternalLink(href)) {
    return "external"
  }
  if (href.startsWith("#")) {
    return "fragment"
  }
  if (/^mailto:/i.test(href)) {
    return "email"
  }
  if (href.startsWith("/")) {
    return "root"
  }
  return "relative"
}

function getPretextMarkdownLinkForm(href: string, text: string) {
  if (/^mailto:/i.test(href) && href.slice("mailto:".length) === text) {
    return "email-autolink"
  }

  if (
    isPretextMarkdownExternalLink(href) &&
    (href === text || href.replace(/^https?:\/\//i, "") === text)
  ) {
    return "autolink"
  }

  return "inline"
}

function normalizePretextMarkdownLinkTitle(title: unknown) {
  return typeof title === "string" && title.trim() ? title : undefined
}

type PretextTableCellAlignment = "center" | "left" | "right" | undefined

function resolvePretextMarkdownTableCellAlignment({
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

function pretextMarkdownTableCellAlignmentClassName(align: PretextTableCellAlignment) {
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
      onKeyDown={scrollPretextMarkdownHorizontalRegion}
      onMouseEnter={updateCopyText}
    >
      <PretextMarkdownCopyButton
        ariaLabel="Copy table"
        className="absolute top-2 right-2 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        text={() =>
          readPretextMarkdownSelectedText(tableRef.current) ??
          (tableRef.current
            ? serializePretextMarkdownTable(tableRef.current)
            : copyText)
        }
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
  children,
  component,
}: {
  children?: React.ReactNode
  component: PretextComponent
}) {
  switch (component.name) {
    case "Accordion":
      return (
        <details
          className="my-5 rounded-md border bg-muted/20"
          data-pretext-component="Accordion"
        >
          <summary
            className={cn(
              "cursor-pointer px-4 py-3 font-medium text-foreground",
              PRETEXT_MARKDOWN_WRAP_CLASS_NAME
            )}
          >
            {readPretextComponentStringProp(component.props.title) ?? "Details"}
          </summary>
          <div className="border-t px-4 py-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {children}
          </div>
        </details>
      )
    case "Badge": {
      const label =
        readPretextComponentDisplayProp(component.props.label) ??
        readPretextComponentDisplayProp(component.props.value) ??
        "Badge"
      return (
        <span
          className={cn(
            "my-3 inline-flex max-w-full items-center rounded-md border px-2 py-1 text-sm font-medium",
            PRETEXT_MARKDOWN_WRAP_CLASS_NAME,
            componentToneClassName(
              readPretextComponentStringProp(component.props.tone)
            )
          )}
          data-pretext-component="Badge"
        >
          {label}
        </span>
      )
    }
    case "Callout": {
      const kind = readPretextComponentCalloutKind(component)
      return (
        <PretextMarkdownCallout
          callout={{
            kind,
            title:
              readPretextComponentStringProp(component.props.title) ??
              CALLOUT_LABELS[kind],
          }}
          className={undefined}
          componentName="Callout"
        >
          {children}
        </PretextMarkdownCallout>
      )
    }
    case "Image":
      return (
        <PretextMarkdownImage
          alt={
            readPretextComponentStringProp(component.props.alt) ??
            readPretextComponentStringProp(component.props.label) ??
            ""
          }
          componentName="Image"
          src={readPretextComponentStringProp(component.props.src) ?? ""}
          title={readPretextComponentStringProp(component.props.title)}
        />
      )
    case "Diagram":
      return (
        <PretextMarkdownDiagram
          caption={readPretextComponentStringProp(component.props.caption)}
          className={undefined}
          componentName="Diagram"
          source={normalizePretextMarkdownDiagramSource(
            readPretextComponentStringProp(component.props.source) ?? ""
          )}
          title={readPretextComponentStringProp(component.props.title)}
        />
      )
    case "Metric":
      return (
        <div
          className="my-5 flex max-w-lg min-w-0 items-center justify-between gap-4 rounded-md border bg-muted/20 px-4 py-3"
          data-pretext-component="Metric"
        >
          <span
            className={cn(
              "min-w-0 text-muted-foreground",
              PRETEXT_MARKDOWN_WRAP_CLASS_NAME
            )}
          >
            {readPretextComponentDisplayProp(component.props.label) ?? "Metric"}
          </span>
          <span
            className={cn(
              "min-w-0 text-right text-2xl font-semibold tracking-normal",
              PRETEXT_MARKDOWN_WRAP_CLASS_NAME
            )}
          >
            {readPretextComponentDisplayProp(component.props.value) ?? "-"}
          </span>
        </div>
      )
    case "Tab":
      return (
        <PretextMarkdownTab
          title={readPretextComponentStringProp(component.props.title) ?? "Tab"}
        >
          {children}
        </PretextMarkdownTab>
      )
    case "Tabs":
      return (
        <PretextMarkdownTabs
          label={
            readPretextComponentStringProp(component.props.label) ?? "Tabs"
          }
        >
          {children}
        </PretextMarkdownTabs>
      )
    case "Video":
      return (
        <PretextMarkdownVideo
          controls={readPretextComponentBooleanProp(
            component.props.controls,
            true
          )}
          label={readPretextComponentStringProp(component.props.label)}
          loop={readPretextComponentBooleanProp(component.props.loop, false)}
          muted={readPretextComponentBooleanProp(component.props.muted, false)}
          src={readPretextComponentStringProp(component.props.src) ?? ""}
          title={readPretextComponentStringProp(component.props.title)}
        />
      )
  }
}

function PretextMarkdownComponentFallback({
  className,
  fallback,
}: {
  className: string | undefined
  fallback: PretextComponentFallback
}) {
  return (
    <aside
      aria-label={`Unsupported Markdown component: ${fallback.componentName}`}
      className={cn(
        "my-5 overflow-hidden rounded-md border border-dashed bg-muted/20 text-sm",
        className
      )}
      data-pretext-component-fallback=""
      data-pretext-component-fallback-name={fallback.componentName}
      data-pretext-component-fallback-reason={fallback.reason}
      role="note"
    >
      <div className="border-b bg-muted/45 px-4 py-3">
        <p className="font-medium text-foreground">
          Unsupported Markdown component
        </p>
        <p className="mt-1 text-muted-foreground">{fallback.reason}</p>
      </div>
      <pre className="m-0 overflow-x-auto p-4 font-mono text-xs leading-5 whitespace-pre text-muted-foreground">
        <code>{fallback.source}</code>
      </pre>
    </aside>
  )
}

function readPretextComponentStringProp(value: unknown) {
  return typeof value === "string" ? value : undefined
}

function readPretextComponentDisplayProp(value: unknown) {
  return typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
    ? String(value)
    : undefined
}

function readPretextComponentBooleanProp(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function PretextMarkdownCodeBlock({
  children,
  className,
  node,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode
  className: string | undefined
  node: unknown
}) {
  const language = readPretextMarkdownCodeFigureLanguage(node)
  const title = readPretextMarkdownCodeFigureTitle(node)
  const caption = readPretextMarkdownCodeFigureCaption(node)
  const text = readPretextMarkdownCodeFigureSource(node).replace(/\n$/, "")
  const renderedPre = findPretextMarkdownRenderedPre(children)
  const figureRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    annotatePretextMarkdownCodeLineNumbers(figureRef.current, language)
  }, [language, renderedPre])

  if (language === "mermaid") {
    return (
      <PretextMarkdownDiagram
        caption={caption ?? undefined}
        className={className}
        source={text}
        title={title ?? undefined}
      />
    )
  }

  const label = title
    ? `${title} code block`
    : `${language ? `${language} ` : ""}code block`

  return (
    <figure
      aria-label={label}
      className={cn(
        "group my-5 overflow-hidden rounded-md border bg-muted/50",
        className
      )}
      data-pretext-code-language={language ?? undefined}
      data-pretext-code-title={title ?? undefined}
      ref={figureRef}
      role="group"
      {...props}
    >
      <div className="flex min-h-9 items-center gap-2 border-b bg-muted/60 px-3 py-1.5">
        <div className="min-w-0">
          {title ? (
            <div className="truncate text-sm font-medium text-foreground">
              {title}
            </div>
          ) : null}
          {language ? (
            <div className="text-xs font-medium text-muted-foreground">
              {language}
            </div>
          ) : null}
        </div>
        <PretextMarkdownCopyButton
          ariaLabel="Copy code block"
          className="ml-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          text={text}
        />
        <PretextMarkdownCopyButton
          ariaLabel="Copy selected code or block"
          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          text={() =>
            readPretextMarkdownSelectedText(figureRef.current) ?? text
          }
        />
      </div>
      <PretextMarkdownCodeBlockContext.Provider value={{ language }}>
        {renderedPre ?? (
          <PretextMarkdownCodeSourceFallback language={language} text={text} />
        )}
      </PretextMarkdownCodeBlockContext.Provider>
      {caption ? (
        <figcaption
          className={cn(
            "border-t bg-muted/30 px-3 py-2 text-sm text-muted-foreground",
            PRETEXT_MARKDOWN_WRAP_CLASS_NAME
          )}
          data-pretext-code-caption=""
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

function PretextMarkdownCodeSourceFallback({
  language,
  text,
}: {
  language: string | null
  text: string
}) {
  return (
    <pre
      aria-label={`${language ? `${language} ` : ""}code source`}
      className={PRETEXT_MARKDOWN_CODE_SOURCE_CLASS_NAME}
      data-pretext-code-source=""
      role="region"
      tabIndex={0}
    >
      <code>{text}</code>
    </pre>
  )
}

function annotatePretextMarkdownCodeLineNumbers(
  figure: HTMLElement | null,
  language: string | null
) {
  const code = figure?.querySelector<HTMLElement>("code[data-line-numbers]")
  if (!code) return

  const start = readPretextMarkdownCodeLineNumberStart(code)
  code.setAttribute("role", "list")
  code.setAttribute(
    "aria-label",
    `${language ? `${language} ` : ""}numbered code lines`
  )

  const lines = Array.from(
    code.querySelectorAll<HTMLElement>("span[data-line]")
  )
  for (const [index, line] of lines.entries()) {
    const lineNumber = start + index
    line.setAttribute("role", "listitem")
    line.setAttribute("aria-label", `Line ${lineNumber}`)
    line.setAttribute("data-pretext-code-line-number", String(lineNumber))
  }
}

function readPretextMarkdownCodeLineNumberStart(code: HTMLElement) {
  const style = code.getAttribute("style") ?? ""
  const counterSet = style.match(/(?:^|;)\s*counter-set\s*:\s*line\s+(-?\d+)/i)
  if (!counterSet) return 1

  return Number(counterSet[1]!) + 1
}

function PretextMarkdownTabs({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  const [tabs, setTabs] = React.useState<PretextMarkdownTabRegistration[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const tabButtonRefs = React.useRef(new Map<string, HTMLButtonElement>())

  const registerTab = React.useCallback(
    (tab: PretextMarkdownTabRegistration) => {
      setTabs((current) => {
        if (current.some((item) => item.id === tab.id)) return current
        return [...current, tab]
      })
      setSelectedId((current) => current ?? tab.id)

      return () => {
        setTabs((current) => current.filter((item) => item.id !== tab.id))
        setSelectedId((current) => (current === tab.id ? null : current))
      }
    },
    []
  )

  React.useEffect(() => {
    if (!tabs.length) {
      setSelectedId(null)
      return
    }

    if (selectedId === null || tabs.some((tab) => tab.id === selectedId)) {
      return
    }

    setSelectedId(tabs[0].id)
  }, [selectedId, tabs])

  const activeTabId = selectedId ?? tabs[0]?.id ?? null

  const selectTab = React.useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const selectAndFocusTab = React.useCallback((id: string) => {
    setSelectedId(id)
    tabButtonRefs.current.get(id)?.focus()
  }, [])

  const handleTabListKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!tabs.length) return

      const activeIndex = Math.max(
        0,
        tabs.findIndex((tab) => tab.id === activeTabId)
      )
      let nextIndex: number | null = null

      switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
          nextIndex = (activeIndex + 1) % tabs.length
          break
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex = (activeIndex - 1 + tabs.length) % tabs.length
          break
        case "End":
          nextIndex = tabs.length - 1
          break
        case "Home":
          nextIndex = 0
          break
        default:
          return
      }

      event.preventDefault()
      selectAndFocusTab(tabs[nextIndex].id)
    },
    [activeTabId, selectAndFocusTab, tabs]
  )

  const contextValue = React.useMemo<PretextMarkdownTabsContextValue>(
    () => ({
      selectedId: activeTabId,
      registerTab,
      selectTab,
    }),
    [activeTabId, registerTab, selectTab]
  )

  return (
    <PretextMarkdownTabsContext.Provider value={contextValue}>
      <div
        aria-label={label}
        className="my-5 rounded-md border bg-muted/15"
        data-pretext-component="Tabs"
        role="group"
      >
        {tabs.length ? (
          <div
            aria-label={label}
            className="flex flex-wrap gap-1 border-b bg-muted/30 p-1"
            onKeyDown={handleTabListKeyDown}
            role="tablist"
          >
            {tabs.map((tab) => {
              const selected = tab.id === activeTabId
              return (
                <button
                  key={tab.id}
                  aria-controls={`${tab.id}-panel`}
                  aria-selected={selected}
                  className={cn(
                    "rounded px-3 py-1.5 text-sm font-medium",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    selected
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  )}
                  id={`${tab.id}-tab`}
                  ref={(node) => {
                    if (node) {
                      tabButtonRefs.current.set(tab.id, node)
                    } else {
                      tabButtonRefs.current.delete(tab.id)
                    }
                  }}
                  role="tab"
                  tabIndex={selected ? 0 : -1}
                  type="button"
                  onClick={() => setSelectedId(tab.id)}
                >
                  {tab.title}
                </button>
              )
            })}
          </div>
        ) : null}
        <div className="px-4 py-3">{children}</div>
      </div>
    </PretextMarkdownTabsContext.Provider>
  )
}

function PretextMarkdownTab({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  const tabsContext = React.useContext(PretextMarkdownTabsContext)
  const registerTab = tabsContext?.registerTab
  const reactId = React.useId()
  const id = `pretext-markdown-tab-${reactId.replace(/:/g, "")}`

  React.useEffect(() => {
    return registerTab?.({ id, title })
  }, [id, registerTab, title])

  if (!tabsContext) {
    return (
      <section
        aria-label={title}
        className="my-5 rounded-md border bg-muted/15 px-4 py-3"
        data-pretext-component="Tab"
      >
        <p className="mb-2 font-medium">{title}</p>
        <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {children}
        </div>
      </section>
    )
  }

  const selected =
    tabsContext.selectedId === null || tabsContext.selectedId === id
  return (
    <section
      aria-labelledby={`${id}-tab`}
      className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      data-pretext-component="Tab"
      hidden={!selected}
      id={`${id}-panel`}
      role="tabpanel"
    >
      {children}
    </section>
  )
}

function readPretextComponentCalloutKind(component: PretextComponent) {
  switch (component.props.kind) {
    case "caution":
    case "danger":
    case "important":
    case "info":
    case "note":
    case "tip":
    case "warning":
      return component.props.kind
    default:
      return "note"
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

function PretextMarkdownImage({
  alt,
  className,
  componentName,
  title,
  src,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  componentName?: string
}) {
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
  const reactId = React.useId()
  const captionId = caption
    ? `pretext-markdown-image-caption-${reactId.replace(/:/g, "")}`
    : undefined

  React.useEffect(() => {
    setState({ height: null, status: "loading", width: null })
  }, [safeSrc])

  if (!safeSrc) {
    return (
      <PretextMarkdownImagePlaceholder
        className={className}
        componentName={componentName}
        label={label}
        state="blocked"
      />
    )
  }

  if (state.status === "failed") {
    return (
      <PretextMarkdownImagePlaceholder
        className={className}
        componentName={componentName}
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
      data-pretext-component={componentName}
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
          aria-describedby={captionId}
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
        <span
          className="block border-t bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          data-pretext-image-caption=""
          id={captionId}
        >
          {caption}
        </span>
      ) : null}
    </span>
  )
}

function PretextMarkdownImagePlaceholder({
  className,
  componentName,
  label,
  onRetry,
  state,
}: {
  className: string | undefined
  componentName?: string
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
        data-pretext-component={componentName}
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
      data-pretext-component={componentName}
      data-pretext-image-state={state}
      role="img"
    >
      {label}
    </span>
  )
}

function PretextMarkdownVideo({
  controls,
  label,
  loop,
  muted,
  src,
  title,
}: {
  controls: boolean
  label: string | undefined
  loop: boolean
  muted: boolean
  src: string
  title: string | undefined
}) {
  const safeSrc = sanitizePretextMarkdownMediaUrl(src)
  const [state, setState] = React.useState<"failed" | "ready">("ready")
  const previousSafeSrcRef = React.useRef(safeSrc)
  const videoLabel = label || title || safeSrc || "Markdown video"

  React.useEffect(() => {
    if (previousSafeSrcRef.current === safeSrc) return
    previousSafeSrcRef.current = safeSrc
    setState("ready")
  }, [safeSrc])

  if (!safeSrc) {
    return (
      <PretextMarkdownVideoPlaceholder label={videoLabel} state="blocked" />
    )
  }

  if (state === "failed") {
    return <PretextMarkdownVideoPlaceholder label={videoLabel} state="failed" />
  }

  return (
    <figure
      aria-label={videoLabel}
      className="my-5 overflow-hidden rounded-md border bg-muted/20"
      data-pretext-component="Video"
      data-pretext-video-state="ready"
      role="group"
    >
      <video
        aria-label={videoLabel}
        className="block max-h-[70vh] w-full bg-card"
        controls={controls}
        loop={loop}
        muted={muted}
        preload="metadata"
        src={safeSrc}
        title={title}
        onError={() => setState("failed")}
      />
      {title ? (
        <figcaption className="border-t bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {title}
        </figcaption>
      ) : null}
    </figure>
  )
}

function PretextMarkdownVideoPlaceholder({
  label,
  state,
}: {
  label: string
  state: "blocked" | "failed"
}) {
  const message =
    state === "failed"
      ? `Video failed to load: ${label}`
      : `Video blocked: ${label}`

  return (
    <div
      aria-label={message}
      className="my-5 flex min-h-28 max-w-full items-center rounded-md border border-dashed bg-muted/40 px-4 text-sm text-muted-foreground"
      data-pretext-component="Video"
      data-pretext-video-state={state}
      role="group"
    >
      {message}
    </div>
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

function isPretextTaskListItem(children: React.ReactNode) {
  return React.Children.toArray(children).some((child) => {
    if (
      !React.isValidElement<{ children?: React.ReactNode; type?: unknown }>(
        child
      )
    )
      return false

    if (child.type === "input" && child.props.type === "checkbox") return true
    if (child.type !== "p") return false

    return React.Children.toArray(child.props.children).some(
      (paragraphChild) =>
        React.isValidElement<{ type?: unknown }>(paragraphChild) &&
        paragraphChild.type === "input" &&
        paragraphChild.props.type === "checkbox"
    )
  })
}

function isPretextTaskListItemNode(node: unknown) {
  const properties =
    node && typeof node === "object" && "properties" in node
      ? (node.properties as Record<string, unknown>)
      : null
  const className = properties?.className

  return Array.isArray(className) && className.includes("task-list-item")
}

function extractReactText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractReactText).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractReactText(node.props.children)
  }
  return ""
}

function readPretextMarkdownDiffLineKind(text: string) {
  const trimmedStart = text.trimStart()
  if (trimmedStart.startsWith("+++") || trimmedStart.startsWith("---")) {
    return null
  }
  if (trimmedStart.startsWith("+")) return "add"
  if (trimmedStart.startsWith("-")) return "remove"
  return null
}

function isPretextMarkdownCodeFigure(node: unknown) {
  const element = readPretextMarkdownHastElement(node)
  return Boolean(
    element?.tagName === "figure" &&
      element.properties?.["data-rehype-pretty-code-figure"] != null
  )
}

function readPretextMarkdownCodeFigureLanguage(node: unknown) {
  const pre = readPretextMarkdownCodeFigurePre(node)
  const preLanguage = readPretextMarkdownHastStringProperty(
    pre,
    "data-language"
  )
  if (preLanguage) return normalizePretextMarkdownCodeLanguage(preLanguage)

  const code = readPretextMarkdownHastElement(pre?.children?.[0])
  const readPretextMarkdownCodeElementLanguage = readPretextMarkdownHastStringProperty(
    code,
    "data-language"
  )
  if (readPretextMarkdownCodeElementLanguage) return normalizePretextMarkdownCodeLanguage(readPretextMarkdownCodeElementLanguage)

  return normalizePretextMarkdownCodeLanguage(
    readPretextMarkdownHastClassLanguage(code)
  )
}

function readPretextMarkdownCodeFigureTitle(node: unknown) {
  return readPretextMarkdownCodeFigureCaptionText(
    node,
    "data-rehype-pretty-code-title"
  )
}

function readPretextMarkdownCodeFigureCaption(node: unknown) {
  return readPretextMarkdownCodeFigureCaptionText(
    node,
    "data-rehype-pretty-code-caption"
  )
}

function readPretextMarkdownCodeFigureCaptionText(
  node: unknown,
  propertyName: string
) {
  const figure = readPretextMarkdownHastElement(node)
  const caption = figure?.children
    ?.map(readPretextMarkdownHastElement)
    .find((child) => child?.properties?.[propertyName] != null)
  const text = extractPretextMarkdownHastText(caption).trim()
  return text || null
}

function readPretextMarkdownCodeFigureSource(node: unknown) {
  return extractPretextMarkdownHastText(readPretextMarkdownCodeFigurePre(node))
}

function readPretextMarkdownCodeFigurePre(node: unknown) {
  const figure = readPretextMarkdownHastElement(node)
  return figure?.children
    ?.map(readPretextMarkdownHastElement)
    .find((child) => child?.tagName === "pre")
}

function findPretextMarkdownRenderedPre(
  children: React.ReactNode
): React.ReactElement | null {
  for (const child of React.Children.toArray(children)) {
    if (
      !React.isValidElement<{ children?: React.ReactNode; node?: unknown }>(
        child
      )
    )
      continue
    if (isPretextMarkdownRenderedPreElement(child)) return child

    const nestedPre = findPretextMarkdownRenderedPre(child.props.children)
    if (nestedPre) return nestedPre
  }

  return null
}

function isPretextMarkdownRenderedPreElement(
  child: React.ReactElement<{ node?: unknown }>
) {
  return (
    child.type === "pre" ||
    readPretextMarkdownHastElement(child.props.node)?.tagName === "pre"
  )
}

function readPretextMarkdownHastElement(node: unknown):
  | {
      children?: unknown[]
      properties?: Record<string, unknown>
      tagName?: string
      type?: string
    }
  | undefined {
  if (!node || typeof node !== "object") return undefined
  const element = node as {
    children?: unknown[]
    properties?: Record<string, unknown>
    tagName?: string
    type?: string
  }
  return element.type === "element" ? element : undefined
}

function readPretextMarkdownHastStringProperty(
  node: unknown,
  propertyName: string
) {
  const value = readPretextMarkdownHastElement(node)?.properties?.[propertyName]
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.filter(Boolean).join(" ")
  return undefined
}

function readPretextMarkdownHastClassLanguage(node: unknown) {
  const className = readPretextMarkdownHastStringProperty(node, "className")
  return className?.match(/language-([^\s]+)/)?.[1]
}

function extractPretextMarkdownHastText(node: unknown): string {
  if (!node || typeof node !== "object") return ""
  const typed = node as { children?: unknown[]; type?: string; value?: unknown }
  if (typed.type === "text" && typeof typed.value === "string") {
    return typed.value
  }
  if (!Array.isArray(typed.children)) return ""
  return typed.children.map(extractPretextMarkdownHastText).join("")
}

function readPretextMarkdownCodeElementLanguage(node: React.ReactNode): string | null {
  if (
    !React.isValidElement<{
      className?: string
      "data-language"?: string
    }>(node)
  ) {
    if (Array.isArray(node)) return node.map(readPretextMarkdownCodeElementLanguage).find(Boolean) ?? null
    return null
  }

  const className = node.props.className ?? ""
  return normalizePretextMarkdownCodeLanguage(
    node.props["data-language"] ?? className.match(/language-([^\s]+)/)?.[1]
  )
}

function normalizePretextMarkdownCodeLanguage(value: string | undefined) {
  const language = value
    ?.trim()
    .replace(/^language-/i, "")
    .split(/\s+/)[0]
    ?.toLowerCase()
  if (!language) return null
  return PRETEXT_MARKDOWN_CODE_LANGUAGE_ALIASES[language] ?? language
}

const ALERT_STYLES: Record<
  AlertKind,
  { container: string; icon: React.ReactNode; title: string }
> = {
  caution: {
    container:
      "border-red-200 bg-red-50/70 dark:border-red-500/40 dark:bg-red-950/20",
    icon: <CircleAlert aria-hidden="true" className="size-4 shrink-0" />,
    title: "text-red-700 dark:text-red-300",
  },
  important: {
    container:
      "border-violet-200 bg-violet-50/70 dark:border-violet-500/40 dark:bg-violet-950/20",
    icon: <BadgeAlert aria-hidden="true" className="size-4 shrink-0" />,
    title: "text-violet-700 dark:text-violet-300",
  },
  note: {
    container:
      "border-sky-200 bg-sky-50/70 dark:border-sky-500/40 dark:bg-sky-950/20",
    icon: <Info aria-hidden="true" className="size-4 shrink-0" />,
    title: "text-sky-700 dark:text-sky-300",
  },
  tip: {
    container:
      "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/40 dark:bg-emerald-950/20",
    icon: <Lightbulb aria-hidden="true" className="size-4 shrink-0" />,
    title: "text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    container:
      "border-amber-200 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-950/20",
    icon: <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />,
    title: "text-amber-700 dark:text-amber-300",
  },
}
