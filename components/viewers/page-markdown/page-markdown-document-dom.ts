export function scrollDocumentPageIntoView(
  root: HTMLElement | null,
  pageNumber: number
): void {
  const target = root?.querySelector<HTMLElement>(
    `[data-page-number="${pageNumber}"]`
  )
  if (typeof target?.scrollIntoView !== "function") return

  target.scrollIntoView({ behavior: "smooth", block: "start" })
}
