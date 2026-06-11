import * as React from "react"

export function usePdfPageVirtualization({
  pageCount,
  viewportElement,
}: {
  pageCount: number
  viewportElement: HTMLDivElement | null
}) {
  const [visiblePages, setVisiblePages] = React.useState<ReadonlySet<number>>(
    () => new Set([1])
  )
  const observerRef = React.useRef<IntersectionObserver | null>(null)
  const slotElementsRef = React.useRef<Set<HTMLElement>>(new Set())

  React.useEffect(() => {
    setVisiblePages(new Set([1]))
  }, [pageCount])

  React.useEffect(() => {
    if (!viewportElement) return
    if (typeof IntersectionObserver === "undefined") {
      setVisiblePages(
        new Set(Array.from({ length: pageCount }, (_, index) => index + 1))
      )
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((previousVisiblePages) => {
          const nextVisiblePages = new Set(previousVisiblePages)
          let changed = false
          for (const entry of entries) {
            const pageNumber = Number(
              (entry.target as HTMLElement).dataset.pageNumber
            )
            if (!pageNumber) continue
            if (entry.isIntersecting) {
              if (!nextVisiblePages.has(pageNumber)) {
                nextVisiblePages.add(pageNumber)
                changed = true
              }
            } else if (nextVisiblePages.delete(pageNumber)) {
              changed = true
            }
          }
          return changed ? nextVisiblePages : previousVisiblePages
        })
      },
      { root: viewportElement, rootMargin: "100% 0px" }
    )

    observerRef.current = observer
    for (const slotElement of slotElementsRef.current) {
      observer.observe(slotElement)
    }

    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [pageCount, viewportElement])

  const registerPageSlot = React.useCallback((element: HTMLElement | null) => {
    if (!element) return
    slotElementsRef.current.add(element)
    observerRef.current?.observe(element)
    return () => {
      slotElementsRef.current.delete(element)
      observerRef.current?.unobserve(element)
    }
  }, [])

  return { visiblePages, registerPageSlot }
}
