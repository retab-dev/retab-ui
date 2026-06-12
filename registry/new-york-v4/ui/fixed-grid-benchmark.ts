export interface FixedGridBenchmarkViewer {
  id: string
  label: string
  sample: string
  scrollerSelector: string
}

export function findFixedGridScroller({
  root,
  selector,
}: {
  root: HTMLElement | null
  selector: string
}) {
  if (!root) return null

  const candidates = root.querySelectorAll<HTMLElement>(selector)
  for (const candidate of candidates) {
    if (isScrollableViewport(candidate)) return candidate
  }

  return null
}

export function isScrollableViewport(scroller: HTMLElement | null) {
  return (
    !!scroller &&
    scroller.clientHeight > 0 &&
    scroller.scrollHeight > scroller.clientHeight
  )
}
