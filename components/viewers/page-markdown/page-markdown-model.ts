export const PAGE_MARKDOWN_COMPACT_ACTIONS_WIDTH = 460

export {
  createPageMeasurementKey,
  estimateMarkdownPageHeight,
  PAGE_MARKDOWN_PAGE_GAP,
  PAGE_MARKDOWN_PAGE_PADDING,
  PAGE_MARKDOWN_PAGE_PADDING_X,
  PAGE_MARKDOWN_PAGE_PADDING_Y,
  PAGE_MARKDOWN_PAGE_WIDTH,
} from "./page-markdown-layout"
export {
  clamp,
  clampPageScale,
  fitPageScale,
  PAGE_MARKDOWN_FIT_HORIZONTAL_PADDING,
  PAGE_MARKDOWN_FIT_SCALE_MAX,
  PAGE_MARKDOWN_SCALE_MAX,
  PAGE_MARKDOWN_SCALE_MIN,
  zoomPageScale,
} from "./page-markdown-scale"

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

export function joinMarkdownPages(pages: string[]): string {
  return pages.join("\n\n")
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

  if (!pending && state.page === nextPage && state.pane === pane) {
    return {
      state,
      pending: null,
      scrollTarget: null,
      confirmed: false,
    }
  }

  if (!pending && state.page === nextPage) {
    return {
      state: { page: nextPage, pane, version: state.version + 1 },
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
