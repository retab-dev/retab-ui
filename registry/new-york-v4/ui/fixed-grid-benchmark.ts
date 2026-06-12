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

  let candidates: NodeListOf<HTMLElement>
  try {
    candidates = root.querySelectorAll<HTMLElement>(selector)
  } catch {
    return null
  }

  for (const candidate of candidates) {
    if (isScrollableViewport(candidate)) return candidate
  }

  return null
}

export function isScrollableViewport(scroller: HTMLElement | null) {
  return (
    !!scroller &&
    Number.isFinite(scroller.clientHeight) &&
    Number.isFinite(scroller.scrollHeight) &&
    scroller.clientHeight > 0 &&
    scroller.scrollHeight > scroller.clientHeight
  )
}
