export function scrollPageIntoView(
  root: HTMLElement | null,
  page: number
): void {
  root
    ?.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" })
}
