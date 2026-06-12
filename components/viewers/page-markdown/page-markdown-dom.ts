export function scrollPageIntoView(
  root: HTMLElement | null,
  page: number
): void {
  const target = root?.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
  if (typeof target?.scrollIntoView !== "function") return

  target.scrollIntoView({ behavior: "smooth", block: "start" })
}
