"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"

import { PlainTextViewerShell } from "./plain-text-viewer-shell"
import { ScrollArea } from "./scroll-area"
import { TextViewerFrame, TextViewerToolbar } from "./text-viewer-chrome"
import {
  readTextResource,
  resolvedTextViewerBounds,
} from "./text-viewer-resource"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"
import {
  buildVanillaChengFrame,
  CODE_BLOCK_PADDING_X,
  CODE_BLOCK_PADDING_Y,
  CODE_LINE_HEIGHT,
  createPreparedVanillaChengTemplates,
  findVisibleRange,
  getMaxChatWidth,
  materializeTemplateBlocks,
  MESSAGE_SIDE_PADDING,
  type BlockLayout,
  type InlineFragmentLayout,
  type TemplateFrame,
  type VanillaChengFrame,
  type VanillaChengMessageInstance,
} from "./text-viewer-vanillacheng-model"

type CachedRow = {
  bubble: HTMLDivElement
  row: HTMLElement
}

type DomCache = {
  frame: VanillaChengFrame | null
  mountedEnd: number
  mountedStart: number
  rows: Array<CachedRow | undefined>
}

export const VanillaChengTextViewer = React.forwardRef<
  TextViewerHandle,
  TextViewerProps
>(function VanillaChengTextViewer(props, ref) {
  return (
    <PlainTextViewerShell
      props={props}
      forwardedRef={ref}
      clientFallbackPolicy="always"
      Fallback={VanillaChengFallback}
      Content={VanillaChengTextViewerContent}
    />
  )
})

function VanillaChengFallback() {
  return (
    <TextViewerFrame>
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading text...
      </div>
    </TextViewerFrame>
  )
}

function VanillaChengTextViewerContent({
  resource,
  className,
  toolbar = false,
  bare = false,
  maxBytes,
  maxLines,
  retryVersion,
  forwardedRef,
}: TextViewerProps & {
  resource: ViewerResource
  retryVersion: number
  forwardedRef?: React.ForwardedRef<TextViewerHandle>
}) {
  const bounds = React.useMemo(
    () => resolvedTextViewerBounds({ maxBytes, maxLines }),
    [maxBytes, maxLines]
  )
  const text = React.useMemo(
    () =>
      readTextResource({
        bounds,
        content: resource.content,
        retryVersion,
      }),
    [bounds, resource.content, retryVersion]
  )
  const templates = React.useMemo(
    () => createPreparedVanillaChengTemplates(text),
    [text]
  )
  const wordCount = React.useMemo(
    () => text.trim().split(/\s+/).filter(Boolean).length,
    [text]
  )
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const canvasRef = React.useRef<HTMLDivElement | null>(null)

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      getViewportElement: () => viewportRef.current,
      scrollToLineRange: () => {},
    }),
    []
  )

  React.useEffect(() => {
    const viewport = viewportRef.current
    const canvas = canvasRef.current
    if (!viewport || !canvas) return

    const cache: DomCache = {
      frame: null,
      mountedEnd: 0,
      mountedStart: 0,
      rows: [],
    }
    let scheduledRaf: number | null = null
    let isDisposed = false

    const scheduleRender = () => {
      if (scheduledRaf !== null || isDisposed) return
      scheduledRaf = requestAnimationFrame(() => {
        scheduledRaf = null
        renderVanillaChengFrame({
          cache,
          canvas,
          templates,
          viewport,
        })
      })
    }

    viewport.addEventListener("scroll", scheduleRender, { passive: true })
    window.addEventListener("resize", scheduleRender)
    void document.fonts.ready.then(scheduleRender)
    scheduleRender()

    return () => {
      isDisposed = true
      viewport.removeEventListener("scroll", scheduleRender)
      window.removeEventListener("resize", scheduleRender)
      if (scheduledRaf !== null) cancelAnimationFrame(scheduledRaf)
      canvas.replaceChildren()
    }
  }, [templates])

  return (
    <TextViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <TextViewerToolbar
          wordCount={wordCount}
          fontScale={1}
          downloadAction={resource.originalDownload}
          onZoomOut={() => {}}
          onZoomIn={() => {}}
          onResetZoom={() => {}}
        />
      ) : null}
      <style>{VANILLA_CHENG_STYLES}</style>
      <ScrollArea
        className="min-h-0 flex-1 bg-background"
        orientation="vertical"
        viewportClassName="bg-background"
        viewportRef={viewportRef}
      >
        <div
          className="vc-root relative min-w-0"
          style={{ minWidth: 360 }}
          data-slot="text-virtual-canvas"
          data-projection="vanillacheng"
          ref={canvasRef}
        />
      </ScrollArea>
    </TextViewerFrame>
  )
}

function renderVanillaChengFrame({
  cache,
  canvas,
  templates,
  viewport,
}: {
  cache: DomCache
  canvas: HTMLDivElement
  templates: readonly ReturnType<
    typeof createPreparedVanillaChengTemplates
  >[number][]
  viewport: HTMLDivElement
}) {
  const viewportWidth = viewport.clientWidth
  const viewportHeight = viewport.clientHeight
  const scrollTop = viewport.scrollTop
  const chatWidth = getMaxChatWidth(viewportWidth)
  const previousFrame = cache.frame
  const canReuseFrame =
    previousFrame !== null && previousFrame.chatWidth === chatWidth
  const frame = canReuseFrame
    ? previousFrame
    : buildVanillaChengFrame(templates, chatWidth)
  const needsRelayout = !canReuseFrame
  const { start, end } = findVisibleRange(frame, scrollTop, viewportHeight)

  cache.frame = frame
  canvas.style.height = `${frame.totalHeight}px`
  canvas.style.setProperty("--vc-chat-width", `${frame.chatWidth}px`)
  canvas.style.setProperty(
    "--vc-message-side-padding",
    `${MESSAGE_SIDE_PADDING}px`
  )

  projectVisibleRows({
    cache,
    canvas,
    end,
    frame,
    needsRelayout,
    start,
  })
}

function projectVisibleRows({
  cache,
  canvas,
  end,
  frame,
  needsRelayout,
  start,
}: {
  cache: DomCache
  canvas: HTMLDivElement
  end: number
  frame: VanillaChengFrame
  needsRelayout: boolean
  start: number
}) {
  const previousStart = cache.mountedStart
  const previousEnd = cache.mountedEnd
  const overlapStart = Math.max(start, previousStart)
  const overlapEnd = Math.min(end, previousEnd)

  for (
    let index = previousStart;
    index < Math.min(previousEnd, start);
    index++
  ) {
    const node = cache.rows[index]
    if (node === undefined) continue
    node.row.remove()
    cache.rows[index] = undefined
  }

  for (let index = Math.max(previousStart, end); index < previousEnd; index++) {
    const node = cache.rows[index]
    if (node === undefined) continue
    node.row.remove()
    cache.rows[index] = undefined
  }

  if (overlapStart >= overlapEnd) {
    for (let index = start; index < end; index++) {
      const message = frame.messages[index]!
      const cachedRow = prepareRow(cache, message, index, needsRelayout)
      projectMessageNode(cachedRow, message.frame, message.top)
      if (cachedRow.row.parentNode === null) canvas.append(cachedRow.row)
    }
  } else {
    let anchorRow = cache.rows[overlapStart]?.row ?? null
    for (let index = overlapStart - 1; index >= start; index--) {
      const message = frame.messages[index]!
      const cachedRow = prepareRow(cache, message, index, needsRelayout)
      projectMessageNode(cachedRow, message.frame, message.top)
      if (anchorRow === null) {
        if (cachedRow.row.parentNode === null) canvas.append(cachedRow.row)
      } else if (
        cachedRow.row.parentNode !== canvas ||
        cachedRow.row.nextSibling !== anchorRow
      ) {
        canvas.insertBefore(cachedRow.row, anchorRow)
      }
      anchorRow = cachedRow.row
    }

    for (let index = overlapStart; index < overlapEnd; index++) {
      const message = frame.messages[index]!
      const cachedRow = prepareRow(cache, message, index, needsRelayout)
      projectMessageNode(cachedRow, message.frame, message.top)
    }

    for (let index = overlapEnd; index < end; index++) {
      const message = frame.messages[index]!
      const cachedRow = prepareRow(cache, message, index, needsRelayout)
      projectMessageNode(cachedRow, message.frame, message.top)
      if (cachedRow.row.parentNode === null) canvas.append(cachedRow.row)
    }
  }

  cache.mountedStart = start
  cache.mountedEnd = end
}

function prepareRow(
  cache: DomCache,
  message: VanillaChengMessageInstance,
  index: number,
  needsRelayout: boolean
): CachedRow {
  let cachedRow = cache.rows[index]
  if (cachedRow === undefined) {
    cachedRow = createMessageShell(message.frame.role)
    cache.rows[index] = cachedRow
    renderMessageContents(cachedRow.bubble, message)
    return cachedRow
  }
  if (needsRelayout) renderMessageContents(cachedRow.bubble, message)
  return cachedRow
}

function createMessageShell(
  role: VanillaChengMessageInstance["frame"]["role"]
): CachedRow {
  const row = document.createElement("article")
  row.className = `vc-msg vc-msg--${role}`
  row.dataset.slot = "text-line"

  const bubble = document.createElement("div")
  bubble.className = "vc-msg-bubble"

  row.append(bubble)
  return { bubble, row }
}

function renderMessageContents(
  bubble: HTMLDivElement,
  message: VanillaChengMessageInstance
): void {
  const blocks = materializeTemplateBlocks(message)
  const fragment = document.createDocumentFragment()
  for (let index = 0; index < blocks.length; index++) {
    fragment.append(renderBlock(blocks[index]!, message.frame.contentInsetX))
  }
  bubble.replaceChildren(fragment)
}

function projectMessageNode(
  cachedRow: CachedRow,
  frame: TemplateFrame,
  top: number
): void {
  cachedRow.row.style.top = `${top}px`
  cachedRow.row.style.height = `${frame.totalHeight}px`
  cachedRow.bubble.style.width = `${frame.frameWidth}px`
  cachedRow.bubble.style.height = `${frame.bubbleHeight}px`
}

function renderBlock(block: BlockLayout, contentInsetX: number): HTMLElement {
  switch (block.kind) {
    case "inline":
      return renderInlineBlock(block, contentInsetX)
    case "code":
      return renderCodeBlock(block, contentInsetX)
    case "rule":
      return renderRuleBlock(block, contentInsetX)
  }
}

function renderInlineBlock(
  block: Extract<BlockLayout, { kind: "inline" }>,
  contentInsetX: number
): HTMLElement {
  const wrapper = createBlockShell(
    block,
    "vc-block vc-block--inline",
    contentInsetX
  )

  for (let lineIndex = 0; lineIndex < block.lines.length; lineIndex++) {
    const line = block.lines[lineIndex]!
    const row = document.createElement("div")
    row.className = "vc-line-row"
    row.style.height = `${block.lineHeight}px`
    row.style.left = `${contentInsetX + block.contentLeft}px`
    row.style.top = `${lineIndex * block.lineHeight}px`

    for (
      let fragmentIndex = 0;
      fragmentIndex < line.fragments.length;
      fragmentIndex++
    ) {
      row.append(renderInlineFragment(line.fragments[fragmentIndex]!))
    }
    wrapper.append(row)
  }

  return wrapper
}

function renderCodeBlock(
  block: Extract<BlockLayout, { kind: "code" }>,
  contentInsetX: number
): HTMLElement {
  const wrapper = createBlockShell(
    block,
    "vc-block vc-block--code-shell",
    contentInsetX
  )

  const codeBox = document.createElement("div")
  codeBox.className = "vc-code-box"
  codeBox.style.left = `${contentInsetX + block.contentLeft}px`
  codeBox.style.width = `${block.width}px`
  codeBox.style.height = `${block.height}px`

  for (let lineIndex = 0; lineIndex < block.lines.length; lineIndex++) {
    const line = block.lines[lineIndex]!
    const row = document.createElement("div")
    row.className = "vc-code-line"
    row.style.left = `${CODE_BLOCK_PADDING_X}px`
    row.style.top = `${CODE_BLOCK_PADDING_Y + lineIndex * CODE_LINE_HEIGHT}px`
    row.textContent = line.text
    codeBox.append(row)
  }

  wrapper.append(codeBox)
  return wrapper
}

function renderRuleBlock(
  block: Extract<BlockLayout, { kind: "rule" }>,
  contentInsetX: number
): HTMLElement {
  const wrapper = createBlockShell(
    block,
    "vc-block vc-block--rule-shell",
    contentInsetX
  )
  const rule = document.createElement("div")
  rule.className = "vc-rule-line"
  rule.style.left = `${contentInsetX + block.contentLeft}px`
  rule.style.top = `${Math.floor(block.height / 2)}px`
  rule.style.width = `${block.width}px`
  wrapper.append(rule)
  return wrapper
}

function createBlockShell(
  block: BlockLayout,
  className: string,
  contentInsetX: number
): HTMLDivElement {
  const wrapper = document.createElement("div")
  wrapper.className = className
  wrapper.style.top = `${block.top}px`
  wrapper.style.height = `${block.height}px`

  appendRails(wrapper, block, contentInsetX)
  appendMarker(wrapper, block, contentInsetX)
  return wrapper
}

function appendRails(
  wrapper: HTMLDivElement,
  block: BlockLayout,
  contentInsetX: number
): void {
  for (let index = 0; index < block.quoteRailLefts.length; index++) {
    const rail = document.createElement("div")
    rail.className = "vc-quote-rail"
    rail.style.left = `${contentInsetX + block.quoteRailLefts[index]!}px`
    wrapper.append(rail)
  }
}

function appendMarker(
  wrapper: HTMLDivElement,
  block: BlockLayout,
  contentInsetX: number
): void {
  if (
    block.markerText === null ||
    block.markerLeft === null ||
    block.markerClassName === null
  ) {
    return
  }

  const marker = document.createElement("span")
  marker.className = block.markerClassName
  marker.style.left = `${contentInsetX + block.markerLeft}px`
  marker.style.top = `${markerTop(block)}px`
  marker.textContent = block.markerText
  wrapper.append(marker)
}

function markerTop(block: BlockLayout): number {
  switch (block.kind) {
    case "code":
      return CODE_BLOCK_PADDING_Y
    case "inline":
      return Math.max(0, Math.round((block.lineHeight - 12) / 2))
    case "rule":
      return 0
  }
}

function renderInlineFragment(fragment: InlineFragmentLayout): HTMLElement {
  const node =
    fragment.href === null
      ? document.createElement("span")
      : document.createElement("a")

  node.className = fragment.className
  if (fragment.leadingGap > 0) {
    node.style.marginLeft = `${fragment.leadingGap}px`
  }
  node.textContent = fragment.text

  if (node instanceof HTMLAnchorElement && fragment.href !== null) {
    node.href = fragment.href
    node.target = "_blank"
    node.rel = "noreferrer"
  }

  return node
}

const VANILLA_CHENG_STYLES = `
.vc-root {
  color: hsl(var(--foreground));
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  margin-inline: auto;
  width: var(--vc-chat-width, min(860px, 100%));
}
.vc-msg {
  box-sizing: border-box;
  left: 0;
  padding-inline: var(--vc-message-side-padding, 22px);
  position: absolute;
  width: 100%;
}
.vc-msg-bubble {
  box-sizing: border-box;
  position: relative;
}
.vc-block {
  box-sizing: border-box;
  position: absolute;
  width: 100%;
}
.vc-line-row {
  align-items: center;
  display: flex;
  gap: 0;
  position: absolute;
  white-space: nowrap;
}
.vc-frag {
  box-sizing: border-box;
  letter-spacing: 0;
}
.vc-frag--body {
  font: 400 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.vc-frag--heading-1 {
  font: 700 20px "Iowan Old Style", Georgia, "Times New Roman", serif;
}
.vc-frag--heading-2 {
  font: 700 17px "Iowan Old Style", Georgia, "Times New Roman", serif;
}
.vc-frag.is-link {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 3px;
}
.vc-frag.is-strong {
  font-weight: 700;
}
.vc-frag.is-em {
  font-style: italic;
}
.vc-frag.is-del {
  text-decoration: line-through;
}
.vc-frag--code,
.vc-frag--chip {
  align-items: center;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  display: inline-flex;
  height: 18px;
  justify-content: center;
  padding-inline: 6px;
}
.vc-frag--code {
  font: 600 12px "SF Mono", ui-monospace, Menlo, Monaco, monospace;
}
.vc-frag--chip {
  font: 700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.vc-code-box {
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  box-sizing: border-box;
  color: hsl(var(--foreground));
  overflow: hidden;
  position: absolute;
}
.vc-code-line {
  font: 500 12px "SF Mono", ui-monospace, Menlo, Monaco, monospace;
  line-height: 18px;
  position: absolute;
  white-space: pre;
}
.vc-rule-line {
  background: hsl(var(--border));
  height: 1px;
  position: absolute;
}
.vc-quote-rail {
  background: hsl(var(--border));
  border-radius: 999px;
  bottom: 0;
  position: absolute;
  top: 0;
  width: 3px;
}
.vc-block-marker {
  color: hsl(var(--muted-foreground));
  font: 600 11px "SF Mono", ui-monospace, Menlo, Monaco, monospace;
  position: absolute;
  white-space: pre;
}
`
