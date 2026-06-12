export const PAGE_MARKDOWN_PAGE_WIDTH = 768
export const PAGE_MARKDOWN_PAGE_PADDING_X = 36
export const PAGE_MARKDOWN_PAGE_PADDING_Y = 28
export const PAGE_MARKDOWN_SCALE_MIN = 0.35
export const PAGE_MARKDOWN_SCALE_MAX = 3
export const PAGE_MARKDOWN_FIT_SCALE_MAX = 1.5
export const PAGE_MARKDOWN_FIT_HORIZONTAL_PADDING = 32
export const PAGE_MARKDOWN_COMPACT_ACTIONS_WIDTH = 460

export type PagePane = "markdown" | "document"

export interface PagePaneState {
  page: number
  pane: PagePane
  version: number
}

export interface PendingPageScroll {
  pane: PagePane
  page: number
  version: number
}

export interface PagePaneTransition {
  state: PagePaneState
  pending: PendingPageScroll | null
  scrollTarget: PendingPageScroll | null
  confirmed: boolean
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clampPageScale(scale: number): number {
  return clamp(scale, PAGE_MARKDOWN_SCALE_MIN, PAGE_MARKDOWN_SCALE_MAX)
}

export function fitPageScale(containerWidth: number | null): number {
  if (!containerWidth) return 1
  return clamp(
    (containerWidth - PAGE_MARKDOWN_FIT_HORIZONTAL_PADDING) /
      PAGE_MARKDOWN_PAGE_WIDTH,
    PAGE_MARKDOWN_SCALE_MIN,
    PAGE_MARKDOWN_FIT_SCALE_MAX
  )
}

export function zoomPageScale(scale: number, factor: number): number {
  return clampPageScale(scale * factor)
}

export function estimateMarkdownPageHeight(
  markdown: string,
  scale: number
): number {
  const lineCount = markdown.split("\n").length
  return Math.min(
    1800 * scale,
    Math.max(180 * scale, lineCount * 26 * scale + 80 * scale)
  )
}

export function joinMarkdownPages(pages: string[]): string {
  return pages.join("\n\n")
}

export function createPageMeasurementKey({
  markdown,
  mode,
  scale,
}: {
  markdown: string
  mode: string
  scale: number
}): string {
  return `${mode}:${scale.toFixed(3)}:${markdown.length}:${hashMarkdown(markdown)}`
}

function hashMarkdown(markdown: string): string {
  let hash = 2166136261
  for (let index = 0; index < markdown.length; index += 1) {
    hash ^= markdown.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function initialPagePaneState(): PagePaneState {
  return { page: 1, pane: "markdown", version: 0 }
}

export function resolvePagePaneReport({
  state,
  pending,
  pane,
  page,
}: {
  state: PagePaneState
  pending: PendingPageScroll | null
  pane: PagePane
  page: number
}): PagePaneTransition {
  const nextPage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1)

  if (pending?.pane === pane && pending.page === nextPage) {
    return {
      state: { page: nextPage, pane, version: state.version + 1 },
      pending: null,
      scrollTarget: null,
      confirmed: true,
    }
  }

  if (pending?.pane === pane) {
    return {
      state,
      pending,
      scrollTarget: null,
      confirmed: false,
    }
  }

  if (!pending && state.page === nextPage) {
    return {
      state,
      pending: null,
      scrollTarget: null,
      confirmed: false,
    }
  }

  const targetPane: PagePane = pane === "markdown" ? "document" : "markdown"
  const nextState = { page: nextPage, pane, version: state.version + 1 }
  const nextPending = {
    pane: targetPane,
    page: nextPage,
    version: nextState.version,
  }

  return {
    state: nextState,
    pending: nextPending,
    scrollTarget: nextPending,
    confirmed: false,
  }
}
