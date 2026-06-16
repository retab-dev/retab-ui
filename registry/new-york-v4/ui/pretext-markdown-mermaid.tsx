"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  PretextMarkdownCopyButton,
  scrollPretextMarkdownHorizontalRegion,
} from "./pretext-markdown-controls"
import {
  PRETEXT_MARKDOWN_SVG_SANITIZE_OPTIONS,
  sanitizePretextMarkdownSvg,
  type PretextMarkdownSvgSanitizer,
} from "./pretext-markdown-sanitize"

const PRETEXT_MARKDOWN_MERMAID_CONFIG = {
  flowchart: {
    htmlLabels: false,
    useMaxWidth: true,
  },
  securityLevel: "strict",
  sequence: {
    useMaxWidth: true,
  },
  startOnLoad: false,
  suppressErrorRendering: true,
  theme: "default",
} as const
const PRETEXT_MARKDOWN_MERMAID_MAX_LINES = 160
const PRETEXT_MARKDOWN_MERMAID_MAX_SOURCE_LENGTH = 12_000

export function PretextMarkdownDiagram({
  caption,
  className,
  componentName,
  source,
  title,
}: {
  caption?: string
  className: string | undefined
  componentName?: string
  source: string
  title?: string
}) {
  const limitMessage = React.useMemo(
    () => readPretextMarkdownDiagramLimitMessage(source),
    [source]
  )
  const immediateState = React.useMemo(
    () => createInitialPretextMarkdownDiagramState({ limitMessage, source }),
    [limitMessage, source]
  )
  const bodyHeight = React.useMemo(
    () => estimatePretextMarkdownDiagramBodyHeight(source),
    [source]
  )
  const description = React.useMemo(
    () => describePretextMarkdownDiagram(source),
    [source]
  )
  const diagramStyle = {
    "--pretext-diagram-body-height": `${bodyHeight}px`,
  } as React.CSSProperties
  const [state, setState] = React.useState<
    | { status: "failed"; message: string }
    | { status: "loading" }
    | { status: "ready"; svg: string }
  >(immediateState)
  const diagramId = React.useId().replace(/:/g, "")
  const descriptionId = description
    ? `pretext-markdown-diagram-description-${diagramId}`
    : undefined
  const captionId = caption
    ? `pretext-markdown-diagram-caption-${diagramId}`
    : undefined
  const describedBy =
    [descriptionId, captionId].filter(Boolean).join(" ") || undefined

  React.useLayoutEffect(() => {
    setState(immediateState)
  }, [immediateState])

  React.useEffect(() => {
    if (limitMessage) return

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
  }, [diagramId, limitMessage, source])

  return (
    <figure
      aria-describedby={describedBy}
      aria-label={title || "Mermaid diagram"}
      className={cn(
        "group my-5 min-h-40 overflow-hidden rounded-md border bg-muted/30",
        className
      )}
      data-diagram-language="mermaid"
      data-diagram-reserved-height={bodyHeight}
      data-diagram-state={state.status}
      data-pretext-component={componentName}
      role="group"
      style={diagramStyle}
    >
      <div className="flex h-9 items-center gap-1 border-b bg-muted/60 px-3">
        <span className="text-xs font-medium text-muted-foreground">
          {title || "mermaid"}
        </span>
        <PretextMarkdownCopyButton
          ariaLabel="Copy diagram source"
          className="ml-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          text={source}
        />
        {state.status === "ready" ? (
          <PretextMarkdownCopyButton
            ariaLabel="Copy diagram SVG"
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            text={state.svg}
          />
        ) : null}
      </div>
      {description ? (
        <p
          className="sr-only"
          data-pretext-diagram-description=""
          id={descriptionId}
        >
          {description}
        </p>
      ) : null}
      {state.status === "ready" ? (
        <div
          aria-label="Mermaid diagram body"
          className="h-(--pretext-diagram-body-height) overflow-auto p-4"
          data-pretext-diagram-body=""
          dangerouslySetInnerHTML={{ __html: state.svg }}
          role="region"
          tabIndex={0}
          onKeyDown={scrollPretextMarkdownHorizontalRegion}
        />
      ) : (
        <div
          aria-label="Mermaid diagram body"
          className="h-(--pretext-diagram-body-height) overflow-auto p-4"
          data-pretext-diagram-body=""
          role="region"
          tabIndex={0}
          onKeyDown={scrollPretextMarkdownHorizontalRegion}
        >
          {state.status === "failed" ? (
            <p
              className="mb-3 rounded border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-pretext-diagram-error=""
              role="alert"
            >
              {state.message}
            </p>
          ) : null}
          <pre
            aria-label="Mermaid diagram source"
            className="m-0 overflow-x-auto font-mono text-[0.82em] leading-relaxed text-muted-foreground"
            tabIndex={0}
          >
            {source}
          </pre>
        </div>
      )}
      {caption ? (
        <figcaption
          className="border-t bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          data-pretext-diagram-caption=""
          id={captionId}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

function createInitialPretextMarkdownDiagramState({
  limitMessage,
  source,
}: {
  limitMessage: string | null
  source: string
}):
  | { status: "failed"; message: string }
  | { status: "loading" }
  | {
      status: "ready"
      svg: string
    } {
  if (limitMessage) return { status: "failed", message: limitMessage }

  const basicState = renderBasicMermaidDiagram(source)
  return basicState.status === "ready" ? basicState : { status: "loading" }
}

/**
 * One entry per typed Mermaid diagram. Each entry owns the full decision for
 * its type: how to summarize the content lines, how to phrase the a11y
 * sentence, and how many body pixels to reserve. Both
 * `describePretextMarkdownDiagram` and `estimatePretextMarkdownDiagramBodyHeight`
 * iterate this single registry instead of duplicating the cascade.
 *
 * Order is significant: the first entry whose `summarize` returns non-null
 * wins, matching the original hand-written `if (summary)` cascades.
 */
type PretextMarkdownDiagramTypeEntry<Summary> = {
  describe: (summary: Summary) => string
  estimateBodyHeight: (summary: Summary) => number
  summarize: (lines: readonly string[]) => Summary | null
}

function definePretextMarkdownDiagramType<Summary>(
  entry: PretextMarkdownDiagramTypeEntry<Summary>
): PretextMarkdownDiagramTypeEntry<unknown> {
  return entry as PretextMarkdownDiagramTypeEntry<unknown>
}

const PRETEXT_MARKDOWN_DIAGRAM_TYPES: ReadonlyArray<
  PretextMarkdownDiagramTypeEntry<unknown>
> = [
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid state diagram with ${summary.stateCount} ${pluralizePretextMarkdownWord(
        "state",
        summary.stateCount
      )} and ${summary.transitionCount} ${pluralizePretextMarkdownWord(
        "transition",
        summary.transitionCount
      )}.`,
    estimateBodyHeight: (summary) =>
      summary.stateCount * 44 + summary.transitionCount * 18 + 96,
    summarize: readPretextMarkdownStateDiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) => {
      const classLabel = summary.classCount === 1 ? "class" : "classes"
      return `Mermaid class diagram with ${summary.classCount} ${classLabel} and ${summary.relationCount} ${pluralizePretextMarkdownWord(
        "relationship",
        summary.relationCount
      )}.`
    },
    estimateBodyHeight: (summary) =>
      summary.classCount * 52 + summary.relationCount * 20 + 96,
    summarize: readPretextMarkdownClassDiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid entity relationship diagram with ${summary.entityCount} ${pluralizePretextMarkdownWord(
        "entity",
        summary.entityCount
      )} and ${summary.relationshipCount} ${pluralizePretextMarkdownWord(
        "relationship",
        summary.relationshipCount
      )}.`,
    estimateBodyHeight: (summary) =>
      summary.entityCount * 52 + summary.relationshipCount * 20 + 96,
    summarize: readPretextMarkdownErDiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid journey diagram with ${summary.sectionCount} ${pluralizePretextMarkdownWord(
        "section",
        summary.sectionCount
      )} and ${summary.taskCount} ${pluralizePretextMarkdownWord("task", summary.taskCount)}.`,
    estimateBodyHeight: (summary) =>
      summary.sectionCount * 36 + summary.taskCount * 34 + 96,
    summarize: readPretextMarkdownJourneyDiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid Gantt chart with ${summary.sectionCount} ${pluralizePretextMarkdownWord(
        "section",
        summary.sectionCount
      )} and ${summary.taskCount} ${pluralizePretextMarkdownWord("task", summary.taskCount)}.`,
    estimateBodyHeight: (summary) =>
      summary.sectionCount * 32 + summary.taskCount * 36 + 128,
    summarize: readPretextMarkdownGanttDiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid Git graph with ${summary.branchCount} ${pluralizePretextMarkdownWord(
        "branch",
        summary.branchCount
      )}, ${summary.commitCount} ${pluralizePretextMarkdownWord(
        "commit",
        summary.commitCount
      )}, and ${summary.mergeCount} ${pluralizePretextMarkdownWord("merge", summary.mergeCount)}.`,
    estimateBodyHeight: (summary) =>
      summary.commitCount * 34 +
      (summary.branchCount + summary.mergeCount) * 24 +
      96,
    summarize: readPretextMarkdownGitGraphDiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid timeline with ${summary.sectionCount} ${pluralizePretextMarkdownWord(
        "section",
        summary.sectionCount
      )} and ${summary.eventCount} ${pluralizePretextMarkdownWord("event", summary.eventCount)}.`,
    estimateBodyHeight: (summary) =>
      summary.sectionCount * 34 + summary.eventCount * 30 + 112,
    summarize: readPretextMarkdownTimelineDiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid mind map with ${summary.nodeCount} ${pluralizePretextMarkdownWord(
        "node",
        summary.nodeCount
      )}.`,
    estimateBodyHeight: (summary) => summary.nodeCount * 34 + 96,
    summarize: readPretextMarkdownMindMapDiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid quadrant chart with ${summary.pointCount} ${pluralizePretextMarkdownWord(
        "point",
        summary.pointCount
      )}.`,
    estimateBodyHeight: (summary) => summary.pointCount * 18 + 260,
    summarize: readPretextMarkdownQuadrantDiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid requirement diagram with ${summary.requirementCount} ${pluralizePretextMarkdownWord(
        "requirement",
        summary.requirementCount
      )}, ${summary.elementCount} ${pluralizePretextMarkdownWord(
        "element",
        summary.elementCount
      )}, and ${summary.relationshipCount} ${pluralizePretextMarkdownWord(
        "relationship",
        summary.relationshipCount
      )}.`,
    estimateBodyHeight: (summary) =>
      (summary.requirementCount + summary.elementCount) * 46 +
      summary.relationshipCount * 18 +
      120,
    summarize: readPretextMarkdownRequirementDiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid XY chart with ${summary.seriesCount} series and ${summary.valueCount} ${pluralizePretextMarkdownWord(
        "value",
        summary.valueCount
      )}.`,
    estimateBodyHeight: (summary) =>
      summary.valueCount * 12 + summary.seriesCount * 26 + 210,
    summarize: readPretextMarkdownXyChartDiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid Sankey diagram with ${summary.nodeCount} ${pluralizePretextMarkdownWord(
        "node",
        summary.nodeCount
      )} and ${summary.flowCount} ${pluralizePretextMarkdownWord("flow", summary.flowCount)}.`,
    estimateBodyHeight: (summary) =>
      summary.nodeCount * 34 + summary.flowCount * 18 + 120,
    summarize: readPretextMarkdownSankeyDiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid C4 diagram with ${summary.nodeCount} ${pluralizePretextMarkdownWord(
        "node",
        summary.nodeCount
      )} and ${summary.relationshipCount} ${pluralizePretextMarkdownWord(
        "relationship",
        summary.relationshipCount
      )}.`,
    estimateBodyHeight: (summary) =>
      summary.nodeCount * 54 + summary.relationshipCount * 18 + 110,
    summarize: readPretextMarkdownC4DiagramSummary,
  }),
  definePretextMarkdownDiagramType({
    describe: (summary) =>
      `Mermaid pie chart with ${summary.sliceCount} ${pluralizePretextMarkdownWord(
        "slice",
        summary.sliceCount
      )} and total value ${summary.totalValue}.`,
    estimateBodyHeight: (summary) => summary.sliceCount * 32 + 128,
    summarize: readPretextMarkdownPieDiagramSummary,
  }),
]

function matchPretextMarkdownDiagramType(lines: readonly string[]) {
  for (const entry of PRETEXT_MARKDOWN_DIAGRAM_TYPES) {
    const summary = entry.summarize(lines)
    if (summary != null) return { entry, summary } as const
  }
  return null
}

function estimatePretextMarkdownDiagramBodyHeight(source: string) {
  const lines = readPretextMarkdownDiagramContentLines(source)
  const header = lines[0]?.match(/^(?:graph|flowchart)\s+(TD|TB|BT|LR|RL)$/i)

  if (header) {
    const labels = new Set<string>()
    for (const line of lines.slice(1)) {
      const edge = line.match(/^(.+?)\s*(?:-->|---|==>|-.->)\s*(.+?)$/)
      if (!edge) continue
      labels.add(parsePretextMarkdownMermaidNode(edge[1]!).id)
      labels.add(parsePretextMarkdownMermaidNode(edge[2]!).id)
    }

    const direction = header[1]!.toUpperCase()
    if (direction === "LR" || direction === "RL") return 160

    const nodeCount = Math.max(2, labels.size)
    return clampPretextMarkdownDiagramBodyHeight(
      nodeCount * 42 + Math.max(0, nodeCount - 1) * 56 + 48
    )
  }

  const match = matchPretextMarkdownDiagramType(lines)
  if (match) {
    return clampPretextMarkdownDiagramBodyHeight(
      match.entry.estimateBodyHeight(match.summary)
    )
  }

  return clampPretextMarkdownDiagramBodyHeight(lines.length * 28 + 96)
}

function describePretextMarkdownDiagram(source: string) {
  const lines = readPretextMarkdownDiagramContentLines(source)
  const graphHeader = lines[0]?.match(
    /^(?:graph|flowchart)\s+(TD|TB|BT|LR|RL)$/i
  )

  if (graphHeader) {
    const labels = new Set<string>()
    let edgeCount = 0
    for (const line of lines.slice(1)) {
      const edge = line.match(/^(.+?)\s*(?:-->|---|==>|-.->)\s*(.+?)$/)
      if (!edge) continue
      labels.add(parsePretextMarkdownMermaidNode(edge[1]!).label)
      labels.add(parsePretextMarkdownMermaidNode(edge[2]!).label)
      edgeCount += 1
    }

    if (edgeCount > 0) {
      return `Mermaid graph diagram flowing ${describePretextMarkdownGraphDirection(
        graphHeader[1]!
      )}, with ${labels.size} ${pluralizePretextMarkdownWord("node", labels.size)} and ${edgeCount} ${pluralizePretextMarkdownWord("edge", edgeCount)}.`
    }
  }

  if (/^sequenceDiagram$/i.test(lines[0] ?? "")) {
    const participants = new Set<string>()
    let messageCount = 0
    for (const line of lines.slice(1)) {
      const declaration = line.match(
        /^(?:actor|participant)\s+([A-Za-z0-9_.-]+)(?:\s+as\s+(.+))?$/i
      )
      if (declaration) {
        participants.add((declaration[2] ?? declaration[1]!).trim())
        continue
      }

      const message = line.match(/^(.+?)\s*-{1,2}>>?\s*(.+?)(?::|$)/)
      if (!message) continue
      participants.add(message[1]!.trim())
      participants.add(message[2]!.trim())
      messageCount += 1
    }

    return `Mermaid sequence diagram with ${participants.size} ${pluralizePretextMarkdownWord(
      "participant",
      participants.size
    )} and ${messageCount} ${pluralizePretextMarkdownWord("message", messageCount)}.`
  }

  const match = matchPretextMarkdownDiagramType(lines)
  if (match) return match.entry.describe(match.summary)

  return `Mermaid diagram source with ${lines.length} ${pluralizePretextMarkdownWord(
    "line",
    lines.length
  )}.`
}

function readPretextMarkdownDiagramContentLines(source: string) {
  const rawLines = source.split(/\r?\n/).map((line) => line.trim())
  let startIndex = rawLines.findIndex(Boolean)
  if (startIndex < 0) return []

  if (rawLines[startIndex] === "---") {
    const frontmatterEndIndex = rawLines.findIndex(
      (line, index) => index > startIndex && line === "---"
    )
    if (frontmatterEndIndex > startIndex) {
      startIndex = frontmatterEndIndex + 1
    }
  }

  return rawLines
    .slice(startIndex)
    .filter((line) => line && !line.startsWith("%%"))
}

function readPretextMarkdownStateDiagramSummary(lines: readonly string[]) {
  if (!/^stateDiagram(?:-v2)?$/i.test(lines[0] ?? "")) return null

  const states = new Set<string>()
  let transitionCount = 0

  for (const line of lines.slice(1)) {
    const transition = line.match(/^(.+?)\s*-->\s*(.+?)(?::|$)/)
    if (transition) {
      addPretextMarkdownStateDiagramNode(states, transition[1]!)
      addPretextMarkdownStateDiagramNode(states, transition[2]!)
      transitionCount += 1
      continue
    }

    const declaration =
      line.match(/^state\s+"[^"]+"\s+as\s+([A-Za-z0-9_.-]+)/i) ??
      line.match(/^state\s+([A-Za-z0-9_.-]+)/i)
    if (declaration) addPretextMarkdownStateDiagramNode(states, declaration[1]!)
  }

  return {
    stateCount: states.size,
    transitionCount,
  }
}

function addPretextMarkdownStateDiagramNode(
  states: Set<string>,
  value: string
) {
  const state = normalizePretextMarkdownStateDiagramNode(value)
  if (state && state !== "[*]") states.add(state)
}

function readPretextMarkdownClassDiagramSummary(lines: readonly string[]) {
  if (!/^classDiagram(?:-v2)?$/i.test(lines[0] ?? "")) return null

  const classes = new Set<string>()
  let relationCount = 0

  for (const line of lines.slice(1)) {
    const declaration =
      line.match(/^class\s+([A-Za-z0-9_.-]+)/i) ??
      line.match(/^([A-Za-z0-9_.-]+)\s*:/)
    if (declaration) classes.add(declaration[1]!)

    const relation = line.match(
      /^([A-Za-z0-9_.-]+)\s+(?:<\|--|\*--|o--|-->|<--|\.\.>|<\.\.|--|\.\.)\s+([A-Za-z0-9_.-]+)/
    )
    if (relation) {
      classes.add(relation[1]!)
      classes.add(relation[2]!)
      relationCount += 1
    }
  }

  return {
    classCount: classes.size,
    relationCount,
  }
}

function readPretextMarkdownErDiagramSummary(lines: readonly string[]) {
  if (!/^erDiagram$/i.test(lines[0] ?? "")) return null

  const entities = new Set<string>()
  let relationshipCount = 0

  for (const line of lines.slice(1)) {
    const relationship = line.match(
      /^([A-Za-z0-9_.-]+)\s+[|o}{]+--[|o}{]+\s+([A-Za-z0-9_.-]+)(?:\s*:|$)/
    )
    if (relationship) {
      entities.add(relationship[1]!)
      entities.add(relationship[2]!)
      relationshipCount += 1
      continue
    }

    const declaration = line.match(/^([A-Za-z0-9_.-]+)\s+\{$/)
    if (declaration) entities.add(declaration[1]!)
  }

  return {
    entityCount: entities.size,
    relationshipCount,
  }
}

function readPretextMarkdownPieDiagramSummary(lines: readonly string[]) {
  if (!/^pie(?:\s+(?:showData|title\s+.+))?$/i.test(lines[0] ?? "")) {
    return null
  }

  let sliceCount = 0
  let totalValue = 0

  for (const line of lines.slice(1)) {
    if (/^title\s+/i.test(line)) continue

    const slice = line.match(/^"[^"]+"\s*:\s*(-?\d+(?:\.\d+)?)$/)
    if (!slice) continue
    sliceCount += 1
    totalValue += Number(slice[1])
  }

  return {
    sliceCount,
    totalValue: Number.isInteger(totalValue)
      ? String(totalValue)
      : String(Number(totalValue.toFixed(3))),
  }
}

function readPretextMarkdownJourneyDiagramSummary(lines: readonly string[]) {
  if (!/^journey$/i.test(lines[0] ?? "")) return null

  let sectionCount = 0
  let taskCount = 0

  for (const line of lines.slice(1)) {
    if (/^title\s+/i.test(line)) continue
    if (/^section\s+/i.test(line)) {
      sectionCount += 1
      continue
    }
    if (/^.+:\s*-?\d+(?:\s*:|$)/.test(line)) taskCount += 1
  }

  return {
    sectionCount,
    taskCount,
  }
}

function readPretextMarkdownGanttDiagramSummary(lines: readonly string[]) {
  if (!/^gantt$/i.test(lines[0] ?? "")) return null

  let sectionCount = 0
  let taskCount = 0

  for (const line of lines.slice(1)) {
    if (
      /^(?:dateFormat|axisFormat|excludes|inclusiveEndDates|tickInterval|title|todayMarker|weekday)\b/i.test(
        line
      )
    ) {
      continue
    }
    if (/^section\s+/i.test(line)) {
      sectionCount += 1
      continue
    }
    if (/^[^:]+:\s*\S+/.test(line)) taskCount += 1
  }

  return {
    sectionCount,
    taskCount,
  }
}

function readPretextMarkdownGitGraphDiagramSummary(lines: readonly string[]) {
  if (!/^gitGraph(?:\s+\w+)?$/i.test(lines[0] ?? "")) return null

  let branchCount = 0
  let commitCount = 0
  let mergeCount = 0

  for (const line of lines.slice(1)) {
    if (/^branch\s+/i.test(line)) branchCount += 1
    if (/^commit\b/i.test(line)) commitCount += 1
    if (/^merge\s+/i.test(line)) mergeCount += 1
  }

  return {
    branchCount,
    commitCount,
    mergeCount,
  }
}

function readPretextMarkdownTimelineDiagramSummary(lines: readonly string[]) {
  if (!/^timeline$/i.test(lines[0] ?? "")) return null

  let sectionCount = 0
  let eventCount = 0

  for (const line of lines.slice(1)) {
    if (/^title\s+/i.test(line)) continue
    if (/^section\s+/i.test(line)) {
      sectionCount += 1
      continue
    }
    eventCount += 1
  }

  return {
    sectionCount,
    eventCount,
  }
}

function readPretextMarkdownMindMapDiagramSummary(lines: readonly string[]) {
  if (!/^mindmap$/i.test(lines[0] ?? "")) return null

  return {
    nodeCount: lines.slice(1).length,
  }
}

function readPretextMarkdownQuadrantDiagramSummary(lines: readonly string[]) {
  if (!/^quadrantChart$/i.test(lines[0] ?? "")) return null

  let pointCount = 0
  for (const line of lines.slice(1)) {
    if (/^(?:title|x-axis|y-axis|quadrant-\d+)\b/i.test(line)) continue
    if (/^.+:\s*\[\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\]$/.test(line)) {
      pointCount += 1
    }
  }

  return { pointCount }
}

function readPretextMarkdownRequirementDiagramSummary(
  lines: readonly string[]
) {
  if (!/^requirementDiagram$/i.test(lines[0] ?? "")) return null

  let requirementCount = 0
  let elementCount = 0
  let relationshipCount = 0

  for (const line of lines.slice(1)) {
    if (/^requirement\s+[A-Za-z0-9_.-]+\s*\{$/i.test(line)) {
      requirementCount += 1
      continue
    }

    if (/^element\s+[A-Za-z0-9_.-]+\s*\{$/i.test(line)) {
      elementCount += 1
      continue
    }

    if (
      /^[A-Za-z0-9_.-]+\s+-\s+[A-Za-z]+\s+->\s+[A-Za-z0-9_.-]+$/i.test(line)
    ) {
      relationshipCount += 1
    }
  }

  return { elementCount, relationshipCount, requirementCount }
}

function readPretextMarkdownXyChartDiagramSummary(lines: readonly string[]) {
  if (!/^xychart(?:-beta)?$/i.test(lines[0] ?? "")) return null

  let seriesCount = 0
  let valueCount = 0
  for (const line of lines.slice(1)) {
    const series = line.match(/^(?:bar|line)\s*\[(.*)\]$/i)
    if (!series) continue
    seriesCount += 1
    valueCount += readPretextMarkdownNumberList(series[1]!).length
  }

  return { seriesCount, valueCount }
}

function readPretextMarkdownSankeyDiagramSummary(lines: readonly string[]) {
  if (!/^sankey-beta$/i.test(lines[0] ?? "")) return null

  const nodes = new Set<string>()
  let flowCount = 0
  for (const line of lines.slice(1)) {
    const flow = line.match(/^(.+?)\s*,\s*(.+?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
    if (!flow) continue
    nodes.add(flow[1]!.trim())
    nodes.add(flow[2]!.trim())
    flowCount += 1
  }

  return { flowCount, nodeCount: nodes.size }
}

function readPretextMarkdownC4DiagramSummary(lines: readonly string[]) {
  if (
    !/^C4(?:Context|Container|Component|Dynamic|Deployment)$/i.test(
      lines[0] ?? ""
    )
  ) {
    return null
  }

  const nodes = new Set<string>()
  let relationshipCount = 0
  for (const line of lines.slice(1)) {
    const node = line.match(
      /^(?:Person|Person_Ext|System|System_Ext|Container|ContainerDb|ContainerQueue|Container_Ext|Component|ComponentDb|ComponentQueue|Component_Ext|Boundary|System_Boundary|Container_Boundary|Enterprise_Boundary|Deployment_Node)\s*\(\s*([A-Za-z0-9_.-]+)\s*,/i
    )
    if (node) {
      nodes.add(node[1]!)
      continue
    }

    const relationship = line.match(
      /^Rel(?:_[A-Za-z]+)?\s*\(\s*([A-Za-z0-9_.-]+)\s*,\s*([A-Za-z0-9_.-]+)\s*,/i
    )
    if (relationship) {
      nodes.add(relationship[1]!)
      nodes.add(relationship[2]!)
      relationshipCount += 1
    }
  }

  return { nodeCount: nodes.size, relationshipCount }
}

function describePretextMarkdownGraphDirection(direction: string) {
  switch (direction.toUpperCase()) {
    case "BT":
      return "bottom to top"
    case "LR":
      return "left to right"
    case "RL":
      return "right to left"
    case "TB":
    case "TD":
    default:
      return "top down"
  }
}

function pluralizePretextMarkdownWord(word: string, count: number) {
  if (count !== 1 && /[^aeiou]y$/i.test(word)) {
    return `${word.slice(0, -1)}ies`
  }

  return count === 1 ? word : `${word}s`
}

function readPretextMarkdownDiagramLimitMessage(source: string) {
  if (source.length > PRETEXT_MARKDOWN_MERMAID_MAX_SOURCE_LENGTH) {
    return "Mermaid diagram too large to render safely. Copy the source and render it in a dedicated diagram tool."
  }

  const lineCount = source.split(/\r?\n/).length
  if (lineCount > PRETEXT_MARKDOWN_MERMAID_MAX_LINES) {
    return "Mermaid diagram has too many lines to render safely. Copy the source and render it in a dedicated diagram tool."
  }

  return null
}

function clampPretextMarkdownDiagramBodyHeight(height: number) {
  return Math.min(520, Math.max(160, Math.ceil(height)))
}

export function normalizePretextMarkdownDiagramSource(source: string) {
  return source
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n")
}

async function renderMermaidDiagram(
  source: string,
  id: string
): Promise<
  { status: "failed"; message: string } | { status: "ready"; svg: string }
> {
  try {
    const mermaidModule = await import("mermaid")
    const mermaid = mermaidModule.default
    if (!mermaid?.render) return renderBasicMermaidDiagram(source)

    mermaid.initialize?.(PRETEXT_MARKDOWN_MERMAID_CONFIG)
    const result = await mermaid.render(id, source)
    const svg = await sanitizePretextMarkdownMermaidSvg(result.svg)
    if (!svg) {
      return { status: "failed", message: "Mermaid produced invalid SVG." }
    }
    return { status: "ready", svg }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid diagram"
    return isRecoverablePretextMarkdownMermaidError(message)
      ? renderBasicMermaidDiagram(source)
      : { status: "failed", message }
  }
}

function isRecoverablePretextMarkdownMermaidError(message: string) {
  return (
    message.includes("Cannot find") ||
    message.includes("module") ||
    message.includes("getBBox") ||
    message.includes("getComputedTextLength")
  )
}

async function sanitizePretextMarkdownMermaidSvg(svg: string) {
  const domPurifyModule = await import("dompurify")
  const defaultExport = domPurifyModule.default as unknown
  const moduleExport = domPurifyModule as unknown
  const sanitizer = isPretextMarkdownSvgSanitizer(defaultExport)
    ? defaultExport
    : typeof defaultExport === "function"
      ? (
          defaultExport as (windowObject: Window) => PretextMarkdownSvgSanitizer
        )(window)
      : isPretextMarkdownSvgSanitizer(moduleExport)
        ? moduleExport
        : null

  if (!sanitizer?.sanitize) {
    throw new Error("DOMPurify sanitize unavailable")
  }

  return sanitizePretextMarkdownSvg(svg, sanitizer)
}

function isPretextMarkdownSvgSanitizer(
  value: unknown
): value is PretextMarkdownSvgSanitizer {
  return (
    typeof value === "object" &&
    value !== null &&
    "sanitize" in value &&
    typeof value.sanitize === "function"
  )
}

function renderBasicMermaidDiagram(
  source: string
): { status: "failed"; message: string } | { status: "ready"; svg: string } {
  const lines = readPretextMarkdownDiagramContentLines(source)
  const header = lines[0]?.match(/^(?:graph|flowchart)\s+(TD|TB|BT|LR|RL)$/i)
  if (!header) {
    const sequence = renderBasicMermaidSequenceDiagram(lines)
    if (sequence) return sequence

    const state = renderBasicMermaidStateDiagram(lines)
    if (state) return state

    const classDiagram = renderBasicMermaidClassDiagram(lines)
    if (classDiagram) return classDiagram

    const erDiagram = renderBasicMermaidErDiagram(lines)
    if (erDiagram) return erDiagram

    const journeyDiagram = renderBasicMermaidJourneyDiagram(lines)
    if (journeyDiagram) return journeyDiagram

    const ganttDiagram = renderBasicMermaidGanttDiagram(lines)
    if (ganttDiagram) return ganttDiagram

    const gitGraphDiagram = renderBasicMermaidGitGraphDiagram(lines)
    if (gitGraphDiagram) return gitGraphDiagram

    const timelineDiagram = renderBasicMermaidTimelineDiagram(lines)
    if (timelineDiagram) return timelineDiagram

    const mindMapDiagram = renderBasicMermaidMindMapDiagram(lines)
    if (mindMapDiagram) return mindMapDiagram

    const quadrantDiagram = renderBasicMermaidQuadrantDiagram(lines)
    if (quadrantDiagram) return quadrantDiagram

    const requirementDiagram = renderBasicMermaidRequirementDiagram(lines)
    if (requirementDiagram) return requirementDiagram

    const xyChartDiagram = renderBasicMermaidXyChartDiagram(lines)
    if (xyChartDiagram) return xyChartDiagram

    const sankeyDiagram = renderBasicMermaidSankeyDiagram(lines)
    if (sankeyDiagram) return sankeyDiagram

    const c4Diagram = renderBasicMermaidC4Diagram(lines)
    if (c4Diagram) return c4Diagram

    const pieDiagram = renderBasicMermaidPieDiagram(lines)
    if (pieDiagram) return pieDiagram

    return {
      status: "failed",
      message:
        "Unsupported Mermaid diagram. Only graph/flowchart, sequence, state, class, ER, journey, Gantt, Git graph, timeline, mind map, quadrant, requirement, XY chart, Sankey, C4, and pie diagrams are rendered by the fallback.",
    }
  }

  const direction = header[1]!.toUpperCase()
  const edges: Array<{ from: string; to: string }> = []
  const labels = new Map<string, string>()

  for (const line of lines.slice(1)) {
    const edge = line.match(/^(.+?)\s*(?:-->|---|==>|-.->)\s*(.+?)$/)
    if (!edge) continue
    const from = parsePretextMarkdownMermaidNode(edge[1]!)
    const to = parsePretextMarkdownMermaidNode(edge[2]!)
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
      return `<g><rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="var(--card)" stroke="currentColor" opacity="0.9" /><text x="${position.x + nodeWidth / 2}" y="${position.y + 26}" text-anchor="middle" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(labels.get(nodeId) ?? nodeId)}</text></g>`
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `${edgeSvg}${nodeSvg}`,
      defs: buildPretextMarkdownDiagramArrowDefs("arrow", 0.65),
      height,
      kind: "graph",
      width,
    }),
  }
}

function renderBasicMermaidSequenceDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^sequenceDiagram$/i.test(lines[0] ?? "")) return null

  const participantLabels = new Map<string, string>()
  const messages: Array<{ from: string; label: string; to: string }> = []
  const ensureParticipant = (id: string, label = id) => {
    const trimmedId = id.trim()
    if (!trimmedId) return
    if (!participantLabels.has(trimmedId)) {
      participantLabels.set(trimmedId, label.trim() || trimmedId)
    }
  }

  for (const line of lines.slice(1)) {
    const declaration = line.match(
      /^(?:actor|participant)\s+([A-Za-z0-9_.-]+)(?:\s+as\s+(.+))?$/i
    )
    if (declaration) {
      ensureParticipant(declaration[1]!, declaration[2] ?? declaration[1]!)
      continue
    }

    const message = line.match(
      /^(.+?)\s*(?:-{1,2}(?:>>?|x|\))|->>?)\s*(.+?)(?::\s*(.*))?$/
    )
    if (!message) continue
    const from = message[1]!.trim()
    const to = message[2]!.trim()
    ensureParticipant(from)
    ensureParticipant(to)
    messages.push({ from, label: message[3]?.trim() ?? "", to })
  }

  if (participantLabels.size === 0 || messages.length === 0) return null

  const participantIds = Array.from(participantLabels.keys())
  const laneWidth = 156
  const top = 20
  const headerHeight = 38
  const messageGap = 54
  const width = Math.max(360, participantIds.length * laneWidth + 48)
  const height = Math.max(
    150,
    top + headerHeight + messages.length * messageGap + 42
  )
  const positions = new Map(
    participantIds.map((id, index) => [
      id,
      24 + laneWidth / 2 + index * laneWidth,
    ])
  )

  const participantSvg = participantIds
    .map((id) => {
      const x = positions.get(id)!
      const label = participantLabels.get(id) ?? id
      return [
        `<rect x="${x - 56}" y="${top}" width="112" height="${headerHeight}" rx="8" fill="var(--card)" stroke="currentColor" opacity="0.9" />`,
        `<text x="${x}" y="${top + 24}" text-anchor="middle" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(label)}</text>`,
        `<line x1="${x}" y1="${top + headerHeight}" x2="${x}" y2="${height - 20}" stroke="currentColor" stroke-width="1" stroke-dasharray="4 4" opacity="0.35" />`,
      ].join("")
    })
    .join("")

  const messageSvg = messages
    .map((message, index) => {
      const y = top + headerHeight + 34 + index * messageGap
      const fromX = positions.get(message.from)!
      const toX = positions.get(message.to)!
      const labelX = (fromX + toX) / 2
      const label = message.label
        ? `<text x="${labelX}" y="${y - 8}" text-anchor="middle" font-size="12" fill="currentColor">${escapePretextMarkdownSvg(message.label)}</text>`
        : ""
      return `${label}<line x1="${fromX}" y1="${y}" x2="${toX}" y2="${y}" stroke="currentColor" stroke-width="1.5" marker-end="url(#sequence-arrow)" opacity="0.7" />`
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `${participantSvg}${messageSvg}`,
      defs: buildPretextMarkdownDiagramArrowDefs("sequence-arrow", 0.7),
      height,
      kind: "sequence",
      width,
    }),
  }
}

function renderBasicMermaidStateDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^stateDiagram(?:-v2)?$/i.test(lines[0] ?? "")) return null

  const labels = new Map<string, string>()
  const transitions: Array<{ from: string; label: string; to: string }> = []
  const ensureState = (id: string, label = id) => {
    const state = normalizePretextMarkdownStateDiagramNode(id)
    if (!state) return
    if (!labels.has(state)) labels.set(state, label.trim() || state)
  }

  for (const line of lines.slice(1)) {
    const declaration = line.match(/^state\s+"([^"]+)"\s+as\s+(.+)$/i)
    if (declaration) {
      ensureState(declaration[2]!, declaration[1]!)
      continue
    }

    const namedDeclaration = line.match(/^state\s+([A-Za-z0-9_.-]+)/i)
    if (namedDeclaration) {
      ensureState(namedDeclaration[1]!)
      continue
    }

    const transition = line.match(/^(.+?)\s*-->\s*(.+?)(?::\s*(.*))?$/)
    if (!transition) continue

    const from = normalizePretextMarkdownStateDiagramNode(transition[1]!)
    const to = normalizePretextMarkdownStateDiagramNode(transition[2]!)
    if (from) ensureState(from)
    if (to) ensureState(to)
    if (from && to) {
      transitions.push({ from, label: transition[3]?.trim() ?? "", to })
    }
  }

  if (labels.size === 0 || transitions.length === 0) return null

  const stateIds = Array.from(labels.keys())
  const nodeWidth = 156
  const nodeHeight = 42
  const gap = 58
  const width = 420
  const height =
    stateIds.length * nodeHeight + Math.max(0, stateIds.length - 1) * gap + 48
  const positions = new Map(
    stateIds.map((stateId, index) => [
      stateId,
      {
        x: (width - nodeWidth) / 2,
        y: 24 + index * (nodeHeight + gap),
      },
    ])
  )

  const transitionSvg = transitions
    .map((transition) => {
      const from = positions.get(transition.from)!
      const to = positions.get(transition.to)!
      const x1 = from.x + nodeWidth / 2
      const y1 = from.y + nodeHeight
      const x2 = to.x + nodeWidth / 2
      const y2 = to.y
      const label = transition.label
        ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" text-anchor="middle" font-size="12" fill="currentColor">${escapePretextMarkdownSvg(transition.label)}</text>`
        : ""
      return `${label}<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.5" marker-end="url(#state-arrow)" opacity="0.65" />`
    })
    .join("")
  const stateSvg = stateIds
    .map((stateId) => {
      const position = positions.get(stateId)!
      const label = labels.get(stateId) ?? stateId
      return `<g><rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="var(--card)" stroke="currentColor" opacity="0.9" /><text x="${position.x + nodeWidth / 2}" y="${position.y + 26}" text-anchor="middle" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(label)}</text></g>`
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `${transitionSvg}${stateSvg}`,
      defs: buildPretextMarkdownDiagramArrowDefs("state-arrow", 0.65),
      height,
      kind: "state",
      width,
    }),
  }
}

function normalizePretextMarkdownStateDiagramNode(value: string) {
  const state = value
    .trim()
    .replace(/\s*<<.+>>\s*$/, "")
    .replace(/\s*\{?\s*$/, "")
  return state && state !== "[*]" ? state : ""
}

function renderBasicMermaidClassDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^classDiagram(?:-v2)?$/i.test(lines[0] ?? "")) return null

  const classes = new Set<string>()
  const relations: Array<{ from: string; label: string; to: string }> = []

  for (const line of lines.slice(1)) {
    const declaration =
      line.match(/^class\s+([A-Za-z0-9_.-]+)/i) ??
      line.match(/^([A-Za-z0-9_.-]+)\s*:/)
    if (declaration) classes.add(declaration[1]!)

    const relation = line.match(
      /^([A-Za-z0-9_.-]+)\s+(?:<\|--|\*--|o--|-->|<--|\.\.>|<\.\.|--|\.\.)\s+([A-Za-z0-9_.-]+)(?:\s*:?\s*(.*))?$/
    )
    if (!relation) continue
    classes.add(relation[1]!)
    classes.add(relation[2]!)
    relations.push({
      from: relation[1]!,
      label: relation[3]?.trim() ?? "",
      to: relation[2]!,
    })
  }

  if (classes.size === 0 || relations.length === 0) return null

  const classIds = Array.from(classes)
  const nodeWidth = 142
  const nodeHeight = 44
  const columnGap = 84
  const rowGap = 78
  const columns = classIds.length > 2 ? 2 : classIds.length
  const rows = Math.ceil(classIds.length / columns)
  const width = Math.max(
    360,
    columns * nodeWidth + Math.max(0, columns - 1) * columnGap + 48
  )
  const height = rows * nodeHeight + Math.max(0, rows - 1) * rowGap + 48
  const gridWidth = columns * nodeWidth + Math.max(0, columns - 1) * columnGap
  const left = (width - gridWidth) / 2
  const positions = new Map(
    classIds.map((classId, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      return [
        classId,
        {
          x: left + column * (nodeWidth + columnGap),
          y: 24 + row * (nodeHeight + rowGap),
        },
      ] as const
    })
  )

  const relationSvg = relations
    .map((relation) => {
      const from = positions.get(relation.from)!
      const to = positions.get(relation.to)!
      const x1 = from.x + nodeWidth / 2
      const y1 = from.y + nodeHeight / 2
      const x2 = to.x + nodeWidth / 2
      const y2 = to.y + nodeHeight / 2
      const label = relation.label
        ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" text-anchor="middle" font-size="12" fill="currentColor">${escapePretextMarkdownSvg(relation.label)}</text>`
        : ""
      return `${label}<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.5" marker-end="url(#class-arrow)" opacity="0.55" />`
    })
    .join("")
  const classSvg = classIds
    .map((classId) => {
      const position = positions.get(classId)!
      return `<g><rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="var(--card)" stroke="currentColor" opacity="0.9" /><text x="${position.x + nodeWidth / 2}" y="${position.y + 27}" text-anchor="middle" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(classId)}</text></g>`
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `${relationSvg}${classSvg}`,
      defs: buildPretextMarkdownDiagramArrowDefs("class-arrow", 0.55),
      height,
      kind: "class",
      width,
    }),
  }
}

function renderBasicMermaidErDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^erDiagram$/i.test(lines[0] ?? "")) return null

  const entities = new Set<string>()
  const relationships: Array<{ from: string; label: string; to: string }> = []

  for (const line of lines.slice(1)) {
    const declaration = line.match(/^([A-Za-z0-9_.-]+)\s+\{$/)
    if (declaration) entities.add(declaration[1]!)

    const relationship = line.match(
      /^([A-Za-z0-9_.-]+)\s+[|o}{]+--[|o}{]+\s+([A-Za-z0-9_.-]+)(?:\s*:\s*(.*))?$/
    )
    if (!relationship) continue
    entities.add(relationship[1]!)
    entities.add(relationship[2]!)
    relationships.push({
      from: relationship[1]!,
      label: relationship[3]?.trim() ?? "",
      to: relationship[2]!,
    })
  }

  if (entities.size === 0 || relationships.length === 0) return null

  const entityIds = Array.from(entities)
  const nodeWidth = 150
  const nodeHeight = 44
  const columnGap = 92
  const rowGap = 78
  const columns = entityIds.length > 2 ? 2 : entityIds.length
  const rows = Math.ceil(entityIds.length / columns)
  const width = Math.max(
    380,
    columns * nodeWidth + Math.max(0, columns - 1) * columnGap + 48
  )
  const height = rows * nodeHeight + Math.max(0, rows - 1) * rowGap + 48
  const gridWidth = columns * nodeWidth + Math.max(0, columns - 1) * columnGap
  const left = (width - gridWidth) / 2
  const positions = new Map(
    entityIds.map((entityId, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      return [
        entityId,
        {
          x: left + column * (nodeWidth + columnGap),
          y: 24 + row * (nodeHeight + rowGap),
        },
      ] as const
    })
  )

  const relationshipSvg = relationships
    .map((relationship) => {
      const from = positions.get(relationship.from)!
      const to = positions.get(relationship.to)!
      const x1 = from.x + nodeWidth / 2
      const y1 = from.y + nodeHeight / 2
      const x2 = to.x + nodeWidth / 2
      const y2 = to.y + nodeHeight / 2
      const label = relationship.label
        ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" text-anchor="middle" font-size="12" fill="currentColor">${escapePretextMarkdownSvg(relationship.label)}</text>`
        : ""
      return `${label}<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.5" opacity="0.58" />`
    })
    .join("")
  const entitySvg = entityIds
    .map((entityId) => {
      const position = positions.get(entityId)!
      return `<g><rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="var(--card)" stroke="currentColor" opacity="0.9" /><text x="${position.x + nodeWidth / 2}" y="${position.y + 27}" text-anchor="middle" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(entityId)}</text></g>`
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `${relationshipSvg}${entitySvg}`,
      height,
      kind: "er",
      width,
    }),
  }
}

function renderBasicMermaidPieDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^pie(?:\s+(?:showData|title\s+.+))?$/i.test(lines[0] ?? "")) {
    return null
  }

  const slices: Array<{ label: string; value: number }> = []
  for (const line of lines.slice(1)) {
    if (/^title\s+/i.test(line)) continue
    const slice = line.match(/^"([^"]+)"\s*:\s*(-?\d+(?:\.\d+)?)$/)
    if (!slice) continue
    const value = Number(slice[2])
    if (value > 0) slices.push({ label: slice[1]!, value })
  }

  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (slices.length === 0 || total <= 0) return null

  const colors = [
    "hsl(210 86% 56%)",
    "hsl(156 64% 42%)",
    "hsl(38 92% 50%)",
    "hsl(346 77% 57%)",
    "hsl(262 70% 62%)",
    "hsl(185 76% 41%)",
  ]
  const width = 480
  const height = Math.max(220, 52 + slices.length * 26)
  const centerX = 118
  const centerY = 110
  const radius = 82
  let angle = -90

  const sliceSvg =
    slices.length === 1
      ? `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${colors[0]}" opacity="0.9" />`
      : slices
          .map((slice, index) => {
            const sweep = (slice.value / total) * 360
            const startAngle = angle
            const endAngle = angle + sweep
            angle = endAngle
            return `<path d="${describePretextMarkdownPieSlicePath({
              centerX,
              centerY,
              endAngle,
              radius,
              startAngle,
            })}" fill="${colors[index % colors.length]}" opacity="0.9" />`
          })
          .join("")

  const legendSvg = slices
    .map((slice, index) => {
      const y = 54 + index * 26
      const percent = `${Math.round((slice.value / total) * 100)}%`
      return `<g><rect x="242" y="${y - 11}" width="12" height="12" rx="3" fill="${colors[index % colors.length]}" /><text x="264" y="${y}" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(slice.label)}</text><text x="430" y="${y}" text-anchor="end" font-size="12" fill="currentColor" opacity="0.72">${escapePretextMarkdownSvg(formatPretextMarkdownPieNumber(slice.value))} (${percent})</text></g>`
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="currentColor" stroke-width="1" opacity="0.18" />${sliceSvg}${legendSvg}`,
      height,
      kind: "pie",
      width,
    }),
  }
}

function renderBasicMermaidJourneyDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^journey$/i.test(lines[0] ?? "")) return null

  const sections: Array<{
    tasks: Array<{ actors: string; label: string; score: string }>
    title: string
  }> = []
  let currentSection: (typeof sections)[number] | null = null

  const ensureSection = () => {
    if (!currentSection) {
      currentSection = { tasks: [], title: "Journey" }
      sections.push(currentSection)
    }
    return currentSection
  }

  for (const line of lines.slice(1)) {
    if (/^title\s+/i.test(line)) continue

    const section = line.match(/^section\s+(.+)$/i)
    if (section) {
      currentSection = { tasks: [], title: section[1]!.trim() }
      sections.push(currentSection)
      continue
    }

    const task = line.match(/^(.+?):\s*(-?\d+(?:\.\d+)?)(?:\s*:\s*(.*))?$/)
    if (!task) continue
    ensureSection().tasks.push({
      actors: task[3]?.trim() ?? "",
      label: task[1]!.trim(),
      score: task[2]!,
    })
  }

  const visibleSections = sections.filter((section) => section.tasks.length)
  const taskCount = visibleSections.reduce(
    (count, section) => count + section.tasks.length,
    0
  )
  if (taskCount === 0) return null

  const width = 560
  const sectionGap = 18
  const rowHeight = 36
  const height =
    28 +
    visibleSections.reduce(
      (sum, section) => sum + 26 + section.tasks.length * rowHeight,
      0
    ) +
    Math.max(0, visibleSections.length - 1) * sectionGap
  let y = 24
  const sectionSvg = visibleSections
    .map((section) => {
      const titleY = y
      y += 26
      const taskSvg = section.tasks
        .map((task) => {
          const rowY = y
          y += rowHeight
          const score = Math.max(0, Math.min(5, Number(task.score) || 0))
          const scoreWidth = 42 + score * 46
          const actors = task.actors
            ? `<text x="456" y="${rowY + 22}" text-anchor="end" font-size="12" fill="currentColor" opacity="0.66">${escapePretextMarkdownSvg(task.actors)}</text>`
            : ""
          return `<g><rect x="158" y="${rowY + 7}" width="260" height="14" rx="7" fill="currentColor" opacity="0.12" /><rect x="158" y="${rowY + 7}" width="${scoreWidth}" height="14" rx="7" fill="currentColor" opacity="0.42" /><text x="32" y="${rowY + 22}" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(task.label)}</text><text x="434" y="${rowY + 22}" font-size="12" fill="currentColor" opacity="0.72">${escapePretextMarkdownSvg(task.score)}</text>${actors}</g>`
        })
        .join("")
      const result = `<g><text x="24" y="${titleY}" font-size="13" font-weight="600" fill="currentColor">${escapePretextMarkdownSvg(section.title)}</text>${taskSvg}</g>`
      y += sectionGap
      return result
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: sectionSvg,
      height,
      kind: "journey",
      width,
    }),
  }
}

function renderBasicMermaidGanttDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^gantt$/i.test(lines[0] ?? "")) return null

  const sections: Array<{ tasks: string[]; title: string }> = []
  let currentSection: (typeof sections)[number] | null = null
  const ensureSection = () => {
    if (!currentSection) {
      currentSection = { tasks: [], title: "Schedule" }
      sections.push(currentSection)
    }
    return currentSection
  }

  for (const line of lines.slice(1)) {
    if (
      /^(?:dateFormat|axisFormat|excludes|inclusiveEndDates|tickInterval|title|todayMarker|weekday)\b/i.test(
        line
      )
    ) {
      continue
    }

    const section = line.match(/^section\s+(.+)$/i)
    if (section) {
      currentSection = { tasks: [], title: section[1]!.trim() }
      sections.push(currentSection)
      continue
    }

    const task = line.match(/^([^:]+):\s*\S+/)
    if (task) ensureSection().tasks.push(task[1]!.trim())
  }

  const visibleSections = sections.filter((section) => section.tasks.length)
  const taskCount = visibleSections.reduce(
    (count, section) => count + section.tasks.length,
    0
  )
  if (taskCount === 0) return null

  const width = 620
  const rowHeight = 34
  const sectionGap = 16
  const chartLeft = 176
  const chartWidth = 366
  const height =
    40 +
    visibleSections.reduce(
      (sum, section) => sum + 24 + section.tasks.length * rowHeight,
      0
    ) +
    Math.max(0, visibleSections.length - 1) * sectionGap
  let y = 26
  let taskIndex = 0
  const sectionSvg = visibleSections
    .map((section) => {
      const titleY = y
      y += 24
      const taskSvg = section.tasks
        .map((task) => {
          const rowY = y
          y += rowHeight
          const laneOffset = (taskIndex % 4) * 34
          const barWidth = Math.max(94, chartWidth - laneOffset - 42)
          taskIndex += 1
          return `<g><text x="32" y="${rowY + 21}" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(task)}</text><line x1="${chartLeft}" y1="${rowY + 15}" x2="${chartLeft + chartWidth}" y2="${rowY + 15}" stroke="currentColor" stroke-width="1" opacity="0.12" /><rect x="${chartLeft + laneOffset}" y="${rowY + 6}" width="${barWidth}" height="18" rx="5" fill="currentColor" opacity="0.34" /></g>`
        })
        .join("")
      const result = `<g><text x="24" y="${titleY}" font-size="13" font-weight="600" fill="currentColor">${escapePretextMarkdownSvg(section.title)}</text>${taskSvg}</g>`
      y += sectionGap
      return result
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: sectionSvg,
      height,
      kind: "gantt",
      width,
    }),
  }
}

function renderBasicMermaidGitGraphDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^gitGraph(?:\s+\w+)?$/i.test(lines[0] ?? "")) return null

  const lanes = new Map<string, number>([["main", 0]])
  let activeBranch = "main"
  const events: Array<{
    branch: string
    label: string
    mergeFrom?: string
    type: "commit" | "merge"
  }> = []

  const ensureLane = (branch: string) => {
    if (!lanes.has(branch)) lanes.set(branch, lanes.size)
  }

  for (const line of lines.slice(1)) {
    const branch = line.match(/^branch\s+([A-Za-z0-9_.-]+)/i)
    if (branch) {
      ensureLane(branch[1]!)
      continue
    }

    const checkout = line.match(/^checkout\s+([A-Za-z0-9_.-]+)/i)
    if (checkout) {
      activeBranch = checkout[1]!
      ensureLane(activeBranch)
      continue
    }

    const merge = line.match(/^merge\s+([A-Za-z0-9_.-]+)/i)
    if (merge) {
      const sourceBranch = merge[1]!
      ensureLane(sourceBranch)
      ensureLane(activeBranch)
      events.push({
        branch: activeBranch,
        label: `merge ${sourceBranch}`,
        mergeFrom: sourceBranch,
        type: "merge",
      })
      continue
    }

    if (/^commit\b/i.test(line)) {
      ensureLane(activeBranch)
      events.push({
        branch: activeBranch,
        label: "commit",
        type: "commit",
      })
    }
  }

  if (events.length === 0) return null

  const laneNames = Array.from(lanes.keys())
  const laneGap = 74
  const eventGap = 58
  const width = Math.max(360, 132 + events.length * eventGap)
  const height = 58 + laneNames.length * laneGap
  const laneY = (branch: string) => 48 + (lanes.get(branch) ?? 0) * laneGap
  const laneSvg = laneNames
    .map((branch) => {
      const y = laneY(branch)
      return `<g><text x="24" y="${y + 4}" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(branch)}</text><line x1="92" y1="${y}" x2="${width - 24}" y2="${y}" stroke="currentColor" stroke-width="1" opacity="0.18" /></g>`
    })
    .join("")
  const eventSvg = events
    .map((event, index) => {
      const x = 116 + index * eventGap
      const y = laneY(event.branch)
      const mergeLine = event.mergeFrom
        ? `<line x1="${x - 34}" y1="${laneY(event.mergeFrom)}" x2="${x}" y2="${y}" stroke="currentColor" stroke-width="1.5" opacity="0.46" />`
        : ""
      const radius = event.type === "merge" ? 7 : 6
      return `<g>${mergeLine}<circle cx="${x}" cy="${y}" r="${radius}" fill="var(--card)" stroke="currentColor" stroke-width="2" /><text x="${x}" y="${y + 24}" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.76">${escapePretextMarkdownSvg(event.label)}</text></g>`
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `${laneSvg}${eventSvg}`,
      height,
      kind: "gitGraph",
      width,
    }),
  }
}

function renderBasicMermaidTimelineDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^timeline$/i.test(lines[0] ?? "")) return null

  const sections: Array<{ events: string[]; title: string }> = []
  let currentSection: (typeof sections)[number] | null = null
  const ensureSection = () => {
    if (!currentSection) {
      currentSection = { events: [], title: "Timeline" }
      sections.push(currentSection)
    }
    return currentSection
  }

  for (const line of lines.slice(1)) {
    if (/^title\s+/i.test(line)) continue

    const section = line.match(/^section\s+(.+)$/i)
    if (section) {
      currentSection = { events: [], title: section[1]!.trim() }
      sections.push(currentSection)
      continue
    }

    ensureSection().events.push(line)
  }

  const visibleSections = sections.filter((section) => section.events.length)
  const eventCount = visibleSections.reduce(
    (count, section) => count + section.events.length,
    0
  )
  if (eventCount === 0) return null

  const width = 560
  const sectionGap = 18
  const rowHeight = 34
  const axisX = 142
  const height =
    34 +
    visibleSections.reduce(
      (sum, section) => sum + 24 + section.events.length * rowHeight,
      0
    ) +
    Math.max(0, visibleSections.length - 1) * sectionGap
  let y = 24
  const sectionSvg = visibleSections
    .map((section) => {
      const titleY = y
      y += 24
      const eventSvg = section.events
        .map((event) => {
          const rowY = y
          y += rowHeight
          return `<g><circle cx="${axisX}" cy="${rowY + 14}" r="5" fill="var(--card)" stroke="currentColor" stroke-width="2" /><line x1="${axisX}" y1="${rowY - 3}" x2="${axisX}" y2="${rowY + 31}" stroke="currentColor" stroke-width="1" opacity="0.2" /><text x="24" y="${rowY + 19}" font-size="12" fill="currentColor" opacity="0.72">${escapePretextMarkdownSvg(section.title)}</text><text x="${axisX + 24}" y="${rowY + 19}" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(event)}</text></g>`
        })
        .join("")
      const result = `<g><text x="24" y="${titleY}" font-size="13" font-weight="600" fill="currentColor">${escapePretextMarkdownSvg(section.title)}</text>${eventSvg}</g>`
      y += sectionGap
      return result
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: sectionSvg,
      height,
      kind: "timeline",
      width,
    }),
  }
}

function renderBasicMermaidMindMapDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^mindmap$/i.test(lines[0] ?? "")) return null

  const nodes = lines
    .slice(1)
    .map(readPretextMarkdownMindMapLabel)
    .filter(Boolean)
  if (nodes.length === 0) return null

  const [root = "Mind map", ...children] = nodes
  const width = 560
  const rowHeight = 38
  const height = Math.max(170, 92 + children.length * rowHeight)
  const rootX = 136
  const rootY = height / 2
  const childSvg = children
    .map((child, index) => {
      const y =
        children.length === 1
          ? rootY
          : 48 + index * ((height - 96) / Math.max(1, children.length - 1))
      return `<g><path d="M ${rootX + 72} ${rootY} C ${rootX + 130} ${rootY}, 300 ${y}, 352 ${y}" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.42" /><rect x="352" y="${y - 18}" width="146" height="36" rx="18" fill="var(--card)" stroke="currentColor" opacity="0.9" /><text x="425" y="${y + 5}" text-anchor="middle" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(child)}</text></g>`
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `<rect x="${rootX - 72}" y="${rootY - 22}" width="144" height="44" rx="22" fill="var(--card)" stroke="currentColor" opacity="0.95" /><text x="${rootX}" y="${rootY + 5}" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor">${escapePretextMarkdownSvg(root)}</text>${childSvg}`,
      height,
      kind: "mindmap",
      width,
    }),
  }
}

function readPretextMarkdownMindMapLabel(line: string) {
  const rootCircle = line.match(/^[A-Za-z0-9_.-]*\(\((.+)\)\)$/)
  if (rootCircle) return rootCircle[1]!.trim()

  return line
    .trim()
    .replace(/^[A-Za-z0-9_.-]+\(\((.+)\)\)$/, "$1")
    .replace(/\)+$/, "")
    .replace(/\(\(/g, "")
    .replace(/\)\)/g, "")
    .trim()
}

function renderBasicMermaidQuadrantDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^quadrantChart$/i.test(lines[0] ?? "")) return null

  const quadrants = new Map<number, string>()
  const points: Array<{ label: string; x: number; y: number }> = []
  let xStart = "Low X"
  let xEnd = "High X"
  let yStart = "Low Y"
  let yEnd = "High Y"

  for (const line of lines.slice(1)) {
    if (/^title\s+/i.test(line)) continue

    const xAxis = line.match(/^x-axis\s+(.+?)\s+-->\s+(.+)$/i)
    if (xAxis) {
      xStart = xAxis[1]!.trim()
      xEnd = xAxis[2]!.trim()
      continue
    }

    const yAxis = line.match(/^y-axis\s+(.+?)\s+-->\s+(.+)$/i)
    if (yAxis) {
      yStart = yAxis[1]!.trim()
      yEnd = yAxis[2]!.trim()
      continue
    }

    const quadrant = line.match(/^quadrant-(\d+)\s+(.+)$/i)
    if (quadrant) {
      quadrants.set(Number(quadrant[1]), quadrant[2]!.trim())
      continue
    }

    const point = line.match(
      /^(.+):\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]$/
    )
    if (!point) continue
    points.push({
      label: point[1]!.trim(),
      x: clampPretextMarkdownUnitInterval(Number(point[2])),
      y: clampPretextMarkdownUnitInterval(Number(point[3])),
    })
  }

  if (points.length === 0) return null

  const width = 560
  const height = 360
  const left = 82
  const top = 42
  const plotWidth = 380
  const plotHeight = 250
  const pointSvg = points
    .map((point) => {
      const x = left + point.x * plotWidth
      const y = top + (1 - point.y) * plotHeight
      return `<g><circle cx="${x}" cy="${y}" r="6" fill="var(--card)" stroke="currentColor" stroke-width="2" /><text x="${x + 10}" y="${y - 8}" font-size="12" fill="currentColor">${escapePretextMarkdownSvg(point.label)}</text></g>`
    })
    .join("")
  const quadrantSvg = [
    { label: quadrants.get(2) ?? "Quadrant 2", x: left + 16, y: top + 24 },
    {
      label: quadrants.get(1) ?? "Quadrant 1",
      x: left + plotWidth / 2 + 16,
      y: top + 24,
    },
    {
      label: quadrants.get(3) ?? "Quadrant 3",
      x: left + 16,
      y: top + plotHeight / 2 + 24,
    },
    {
      label: quadrants.get(4) ?? "Quadrant 4",
      x: left + plotWidth / 2 + 16,
      y: top + plotHeight / 2 + 24,
    },
  ]
    .map(
      (quadrant) =>
        `<text x="${quadrant.x}" y="${quadrant.y}" font-size="12" fill="currentColor" opacity="0.48">${escapePretextMarkdownSvg(quadrant.label)}</text>`
    )
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `<rect x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}" fill="var(--card)" opacity="0.35" /><line x1="${left + plotWidth / 2}" y1="${top}" x2="${left + plotWidth / 2}" y2="${top + plotHeight}" stroke="currentColor" opacity="0.22" /><line x1="${left}" y1="${top + plotHeight / 2}" x2="${left + plotWidth}" y2="${top + plotHeight / 2}" stroke="currentColor" opacity="0.22" /><rect x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}" fill="none" stroke="currentColor" opacity="0.45" />${quadrantSvg}${pointSvg}<text x="${left}" y="${height - 34}" font-size="12" fill="currentColor" opacity="0.72">${escapePretextMarkdownSvg(xStart)}</text><text x="${left + plotWidth}" y="${height - 34}" text-anchor="end" font-size="12" fill="currentColor" opacity="0.72">${escapePretextMarkdownSvg(xEnd)}</text><text x="24" y="${top + plotHeight}" font-size="12" fill="currentColor" opacity="0.72">${escapePretextMarkdownSvg(yStart)}</text><text x="24" y="${top + 10}" font-size="12" fill="currentColor" opacity="0.72">${escapePretextMarkdownSvg(yEnd)}</text>`,
      height,
      kind: "quadrantChart",
      width,
    }),
  }
}

function renderBasicMermaidRequirementDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^requirementDiagram$/i.test(lines[0] ?? "")) return null

  const requirements = new Map<string, string>()
  const elements = new Map<string, string>()
  const relationships: Array<{ from: string; label: string; to: string }> = []
  let currentBlock: {
    id: string
    kind: "element" | "requirement"
    label: string
  } | null = null

  const commitCurrentBlock = () => {
    if (!currentBlock) return
    const target = currentBlock.kind === "requirement" ? requirements : elements
    target.set(currentBlock.id, currentBlock.label || currentBlock.id)
    currentBlock = null
  }

  for (const line of lines.slice(1)) {
    const block = line.match(
      /^(requirement|element)\s+([A-Za-z0-9_.-]+)\s*\{$/i
    )
    if (block) {
      commitCurrentBlock()
      currentBlock = {
        id: block[2]!,
        kind:
          block[1]!.toLowerCase() === "requirement" ? "requirement" : "element",
        label: block[2]!,
      }
      continue
    }

    if (line === "}") {
      commitCurrentBlock()
      continue
    }

    const text = line.match(/^(?:text|type)\s*:\s*(.+)$/i)
    if (text && currentBlock) {
      currentBlock.label = text[1]!.replace(/^"|"$/g, "").trim()
      continue
    }

    const relationship = line.match(
      /^([A-Za-z0-9_.-]+)\s+-\s+([A-Za-z]+)\s+->\s+([A-Za-z0-9_.-]+)$/i
    )
    if (relationship) {
      commitCurrentBlock()
      relationships.push({
        from: relationship[1]!,
        label: relationship[2]!,
        to: relationship[3]!,
      })
    }
  }
  commitCurrentBlock()

  for (const relationship of relationships) {
    if (
      !requirements.has(relationship.from) &&
      !elements.has(relationship.from)
    ) {
      elements.set(relationship.from, relationship.from)
    }
    if (!requirements.has(relationship.to) && !elements.has(relationship.to)) {
      requirements.set(relationship.to, relationship.to)
    }
  }

  if (requirements.size === 0 && elements.size === 0) return null

  const requirementIds = Array.from(requirements.keys())
  const elementIds = Array.from(elements.keys())
  const rowCount = Math.max(requirementIds.length, elementIds.length, 1)
  const width = 620
  const rowHeight = 66
  const height = rowCount * rowHeight + 64
  const leftX = 46
  const rightX = 382
  const nodeWidth = 192
  const nodeHeight = 44
  const position = new Map<string, { x: number; y: number }>()

  const requirementSvg = requirementIds
    .map((id, index) => {
      const y = 42 + index * rowHeight
      position.set(id, { x: rightX, y })
      return `<g><rect x="${rightX}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="var(--card)" stroke="currentColor" opacity="0.92" /><text x="${rightX + 12}" y="${y + 18}" font-size="11" fill="currentColor" opacity="0.62">requirement</text><text x="${rightX + 12}" y="${y + 34}" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(shortenPretextMarkdownSvgLabel(requirements.get(id) ?? id, 36))}</text></g>`
    })
    .join("")
  const elementSvg = elementIds
    .map((id, index) => {
      const y = 42 + index * rowHeight
      position.set(id, { x: leftX, y })
      return `<g><rect x="${leftX}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="var(--card)" stroke="currentColor" opacity="0.72" /><text x="${leftX + 12}" y="${y + 18}" font-size="11" fill="currentColor" opacity="0.62">element</text><text x="${leftX + 12}" y="${y + 34}" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(shortenPretextMarkdownSvgLabel(elements.get(id) ?? id, 26))}</text></g>`
    })
    .join("")
  const relationshipSvg = relationships
    .map((relationship) => {
      const from = position.get(relationship.from)
      const to = position.get(relationship.to)
      if (!from || !to) return ""
      const x1 = from.x < to.x ? from.x + nodeWidth : from.x
      const x2 = from.x < to.x ? to.x : to.x + nodeWidth
      const y1 = from.y + nodeHeight / 2
      const y2 = to.y + nodeHeight / 2
      return `<g><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.4" opacity="0.48" /><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.72">${escapePretextMarkdownSvg(relationship.label)}</text></g>`
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `${relationshipSvg}${elementSvg}${requirementSvg}`,
      height,
      kind: "requirementDiagram",
      width,
    }),
  }
}

function renderBasicMermaidXyChartDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^xychart(?:-beta)?$/i.test(lines[0] ?? "")) return null

  const xLabels: string[] = []
  const series: Array<{ kind: "bar" | "line"; values: number[] }> = []
  for (const line of lines.slice(1)) {
    const xAxis = line.match(/^x-axis\s+\[(.*)\]$/i)
    if (xAxis) {
      xLabels.push(
        ...xAxis[1]!
          .split(",")
          .map((label) => label.trim().replace(/^"|"$/g, ""))
          .filter(Boolean)
      )
      continue
    }

    const values = line.match(/^(bar|line)\s*\[(.*)\]$/i)
    if (values) {
      series.push({
        kind: values[1]!.toLowerCase() === "bar" ? "bar" : "line",
        values: readPretextMarkdownNumberList(values[2]!),
      })
    }
  }

  const valueList = series.flatMap((entry) => entry.values)
  if (series.length === 0 || valueList.length === 0) return null

  const minValue = Math.min(0, ...valueList)
  const maxValue = Math.max(...valueList)
  const span = maxValue - minValue || 1
  const maxLength = Math.max(...series.map((entry) => entry.values.length))
  const width = 600
  const height = 330
  const left = 64
  const top = 34
  const chartWidth = 460
  const chartHeight = 220
  const readX = (index: number) =>
    left +
    (maxLength <= 1 ? chartWidth / 2 : (index / (maxLength - 1)) * chartWidth)
  const readY = (value: number) =>
    top + chartHeight - ((value - minValue) / span) * chartHeight
  const barSeries = series.filter((entry) => entry.kind === "bar")
  const lineSeries = series.filter((entry) => entry.kind === "line")
  const barWidth = Math.max(14, chartWidth / Math.max(1, maxLength) / 2.8)
  const barSvg = barSeries
    .flatMap((entry, seriesIndex) =>
      entry.values.map((value, index) => {
        const x = readX(index) - barWidth / 2 + seriesIndex * (barWidth + 3)
        const y = readY(value)
        return `<rect x="${x}" y="${y}" width="${barWidth}" height="${top + chartHeight - y}" rx="3" fill="currentColor" opacity="${0.34 + seriesIndex * 0.16}" />`
      })
    )
    .join("")
  const lineSvg = lineSeries
    .map((entry, seriesIndex) => {
      const points = entry.values
        .map((value, index) => `${readX(index)},${readY(value)}`)
        .join(" ")
      const circles = entry.values
        .map(
          (value, index) =>
            `<circle cx="${readX(index)}" cy="${readY(value)}" r="4" fill="var(--card)" stroke="currentColor" stroke-width="1.8" />`
        )
        .join("")
      return `<g opacity="${0.78 - seriesIndex * 0.12}"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" />${circles}</g>`
    })
    .join("")
  const xLabelSvg = Array.from({ length: maxLength }, (_, index) => {
    const label = xLabels[index] ?? String(index + 1)
    return `<text x="${readX(index)}" y="${height - 42}" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.68">${escapePretextMarkdownSvg(shortenPretextMarkdownSvgLabel(label, 10))}</text>`
  }).join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + chartHeight}" stroke="currentColor" opacity="0.45" /><line x1="${left}" y1="${top + chartHeight}" x2="${left + chartWidth}" y2="${top + chartHeight}" stroke="currentColor" opacity="0.45" /><text x="${left - 10}" y="${top + 5}" text-anchor="end" font-size="11" fill="currentColor" opacity="0.72">${escapePretextMarkdownSvg(formatPretextMarkdownPieNumber(maxValue))}</text><text x="${left - 10}" y="${top + chartHeight}" text-anchor="end" font-size="11" fill="currentColor" opacity="0.72">${escapePretextMarkdownSvg(formatPretextMarkdownPieNumber(minValue))}</text>${barSvg}${lineSvg}${xLabelSvg}`,
      height,
      kind: "xychart",
      width,
    }),
  }
}

function clampPretextMarkdownUnitInterval(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function readPretextMarkdownNumberList(value: string) {
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part))
}

function shortenPretextMarkdownSvgLabel(value: string, maxLength: number) {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1)}...`
    : value
}

function renderBasicMermaidSankeyDiagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (!/^sankey-beta$/i.test(lines[0] ?? "")) return null

  const flows: Array<{ from: string; to: string; value: number }> = []
  const leftNodes = new Map<string, number>()
  const rightNodes = new Map<string, number>()
  for (const line of lines.slice(1)) {
    const flow = line.match(/^(.+?)\s*,\s*(.+?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
    if (!flow) continue
    const value = Number(flow[3])
    if (!(value > 0)) continue
    const from = flow[1]!.trim()
    const to = flow[2]!.trim()
    flows.push({ from, to, value })
    leftNodes.set(from, (leftNodes.get(from) ?? 0) + value)
    rightNodes.set(to, (rightNodes.get(to) ?? 0) + value)
  }

  if (flows.length === 0) return null

  const width = 620
  const leftX = 74
  const rightX = 418
  const nodeWidth = 150
  const rowHeight = 54
  const leftNodeNames = Array.from(leftNodes.keys())
  const rightNodeNames = Array.from(rightNodes.keys())
  const rowCount = Math.max(leftNodeNames.length, rightNodeNames.length)
  const height = rowCount * rowHeight + 76
  const leftPosition = new Map(
    leftNodeNames.map((node, index) => [node, 42 + index * rowHeight] as const)
  )
  const rightPosition = new Map(
    rightNodeNames.map((node, index) => [node, 42 + index * rowHeight] as const)
  )
  const maxValue = Math.max(...flows.map((flow) => flow.value))
  const flowSvg = flows
    .map((flow) => {
      const y1 = (leftPosition.get(flow.from) ?? 42) + 18
      const y2 = (rightPosition.get(flow.to) ?? 42) + 18
      const strokeWidth = 2 + (flow.value / maxValue) * 10
      return `<path d="M ${leftX + nodeWidth} ${y1} C ${leftX + nodeWidth + 92} ${y1}, ${rightX - 92} ${y2}, ${rightX} ${y2}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" opacity="0.28" />`
    })
    .join("")
  const leftNodeSvg = leftNodeNames
    .map((node) => {
      const y = leftPosition.get(node)!
      return `<g><rect x="${leftX}" y="${y}" width="${nodeWidth}" height="36" rx="8" fill="var(--card)" stroke="currentColor" opacity="0.9" /><text x="${leftX + 12}" y="${y + 23}" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(shortenPretextMarkdownSvgLabel(node, 20))}</text></g>`
    })
    .join("")
  const rightNodeSvg = rightNodeNames
    .map((node) => {
      const y = rightPosition.get(node)!
      return `<g><rect x="${rightX}" y="${y}" width="${nodeWidth}" height="36" rx="8" fill="var(--card)" stroke="currentColor" opacity="0.9" /><text x="${rightX + 12}" y="${y + 23}" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(shortenPretextMarkdownSvgLabel(node, 20))}</text></g>`
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `${flowSvg}${leftNodeSvg}${rightNodeSvg}`,
      height,
      kind: "sankey",
      width,
    }),
  }
}

function renderBasicMermaidC4Diagram(
  lines: readonly string[]
): { status: "ready"; svg: string } | null {
  if (
    !/^C4(?:Context|Container|Component|Dynamic|Deployment)$/i.test(
      lines[0] ?? ""
    )
  ) {
    return null
  }

  const nodes = new Map<string, { kind: string; label: string }>()
  const relationships: Array<{ from: string; label: string; to: string }> = []
  for (const line of lines.slice(1)) {
    const node = line.match(
      /^(Person|Person_Ext|System|System_Ext|Container|ContainerDb|ContainerQueue|Container_Ext|Component|ComponentDb|ComponentQueue|Component_Ext|Boundary|System_Boundary|Container_Boundary|Enterprise_Boundary|Deployment_Node)\s*\(\s*([A-Za-z0-9_.-]+)\s*,\s*"([^"]+)"/i
    )
    if (node) {
      nodes.set(node[2]!, { kind: node[1]!, label: node[3]! })
      continue
    }

    const relationship = line.match(
      /^Rel(?:_[A-Za-z]+)?\s*\(\s*([A-Za-z0-9_.-]+)\s*,\s*([A-Za-z0-9_.-]+)\s*,\s*"([^"]*)"/i
    )
    if (!relationship) continue
    const from = relationship[1]!
    const to = relationship[2]!
    if (!nodes.has(from)) nodes.set(from, { kind: "Node", label: from })
    if (!nodes.has(to)) nodes.set(to, { kind: "Node", label: to })
    relationships.push({
      from,
      label: relationship[3]!,
      to,
    })
  }

  if (nodes.size === 0) return null

  const nodeIds = Array.from(nodes.keys())
  const nodeWidth = 150
  const nodeHeight = 50
  const columnGap = 86
  const rowGap = 70
  const columns = nodeIds.length > 2 ? 2 : nodeIds.length
  const rows = Math.ceil(nodeIds.length / columns)
  const width = Math.max(
    420,
    columns * nodeWidth + Math.max(0, columns - 1) * columnGap + 72
  )
  const height = rows * nodeHeight + Math.max(0, rows - 1) * rowGap + 72
  const gridWidth = columns * nodeWidth + Math.max(0, columns - 1) * columnGap
  const left = (width - gridWidth) / 2
  const positions = new Map(
    nodeIds.map((nodeId, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      return [
        nodeId,
        {
          x: left + column * (nodeWidth + columnGap),
          y: 36 + row * (nodeHeight + rowGap),
        },
      ] as const
    })
  )
  const relationshipSvg = relationships
    .map((relationship) => {
      const from = positions.get(relationship.from)!
      const to = positions.get(relationship.to)!
      const x1 = from.x + nodeWidth / 2
      const y1 = from.y + nodeHeight / 2
      const x2 = to.x + nodeWidth / 2
      const y2 = to.y + nodeHeight / 2
      const label = relationship.label
        ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.74">${escapePretextMarkdownSvg(shortenPretextMarkdownSvgLabel(relationship.label, 24))}</text>`
        : ""
      return `${label}<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.5" opacity="0.52" />`
    })
    .join("")
  const nodeSvg = nodeIds
    .map((nodeId) => {
      const position = positions.get(nodeId)!
      const node = nodes.get(nodeId)!
      return `<g><rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="var(--card)" stroke="currentColor" opacity="0.92" /><text x="${position.x + 12}" y="${position.y + 19}" font-size="11" fill="currentColor" opacity="0.62">${escapePretextMarkdownSvg(node.kind.replace(/_/g, " "))}</text><text x="${position.x + 12}" y="${position.y + 36}" font-size="13" fill="currentColor">${escapePretextMarkdownSvg(shortenPretextMarkdownSvgLabel(node.label, 20))}</text></g>`
    })
    .join("")

  return {
    status: "ready",
    svg: buildPretextMarkdownDiagramSvg({
      body: `${relationshipSvg}${nodeSvg}`,
      height,
      kind: "c4",
      width,
    }),
  }
}

function describePretextMarkdownPieSlicePath({
  centerX,
  centerY,
  endAngle,
  radius,
  startAngle,
}: {
  centerX: number
  centerY: number
  endAngle: number
  radius: number
  startAngle: number
}) {
  const start = readPretextMarkdownPolarPoint({
    angle: startAngle,
    centerX,
    centerY,
    radius,
  })
  const end = readPretextMarkdownPolarPoint({
    angle: endAngle,
    centerX,
    centerY,
    radius,
  })
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${centerX} ${centerY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

function readPretextMarkdownPolarPoint({
  angle,
  centerX,
  centerY,
  radius,
}: {
  angle: number
  centerX: number
  centerY: number
  radius: number
}) {
  const radians = (angle * Math.PI) / 180
  return {
    x: Number((centerX + radius * Math.cos(radians)).toFixed(3)),
    y: Number((centerY + radius * Math.sin(radians)).toFixed(3)),
  }
}

function formatPretextMarkdownPieNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(3)))
}

function parsePretextMarkdownMermaidNode(value: string) {
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

/**
 * Shared `<svg>` scaffolding for the basic (fallback) renderers. Every basic
 * renderer emits the identical root element — only the `data-pretext-basic-mermaid`
 * kind, the dimensions, the optional `<defs>`, and the body markup differ.
 */
function buildPretextMarkdownDiagramSvg({
  body,
  defs = "",
  height,
  kind,
  width,
}: {
  body: string
  defs?: string
  height: number
  kind: string
  width: number
}) {
  return `<svg role="img" aria-label="Mermaid diagram" data-pretext-basic-mermaid="${kind}" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">${defs}${body}</svg>`
}

/**
 * The arrow-head marker shared by the graph/sequence/state/class fallbacks. Only
 * the marker `id` (so each diagram references its own) and the opacity vary.
 */
function buildPretextMarkdownDiagramArrowDefs(id: string, opacity: number) {
  return `<defs><marker id="${id}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" opacity="${opacity}"/></marker></defs>`
}

function escapePretextMarkdownSvg(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
