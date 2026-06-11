export const PAGE_MARKDOWN_VISIBLE_PAGE_MARKER_RATIO = 0.2

export function getVisiblePageFromViewport(
  viewport: HTMLElement,
  markerRatio = PAGE_MARKDOWN_VISIBLE_PAGE_MARKER_RATIO
): number {
  const viewportRect = viewport.getBoundingClientRect()
  const pageMarker = viewportRect.top + viewportRect.height * markerRatio
  const pageElements =
    viewport.querySelectorAll<HTMLElement>("[data-page-number]")
  let visiblePage = 1

  for (const pageElement of pageElements) {
    if (pageElement.getBoundingClientRect().top > pageMarker) break

    const page = Number(pageElement.dataset.pageNumber)
    if (Number.isFinite(page) && page > 0) {
      visiblePage = page
    }
  }

  return visiblePage
}
