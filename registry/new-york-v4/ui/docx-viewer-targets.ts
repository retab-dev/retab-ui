import type { DocxTarget } from "./docx-viewer-types"

export interface DocxRenderIndex {
  text: string
  positions: Array<{ node: Text; offset: number }>
  cells: Map<string, HTMLElement>
}

const INLINE_TAGS = new Set([
  "SPAN",
  "A",
  "B",
  "I",
  "EM",
  "STRONG",
  "U",
  "S",
  "STRIKE",
  "DEL",
  "INS",
  "SMALL",
  "BIG",
  "SUB",
  "SUP",
  "MARK",
  "FONT",
  "CODE",
  "ABBR",
  "CITE",
  "Q",
  "TIME",
  "BDI",
  "BDO",
  "WBR",
  "LABEL",
  "VAR",
  "SAMP",
  "KBD",
  "TT",
  "NOBR",
])

export function buildDocxRenderIndex(root: HTMLElement): DocxRenderIndex {
  const textIndex = buildDocxTextIndex(root)
  return {
    text: textIndex.text,
    positions: textIndex.positions,
    cells: buildDocxCellIndex(root),
  }
}

export function resolveDocxTarget(
  index: DocxRenderIndex,
  target: DocxTarget
): Range | null {
  if (target.kind === "cell") {
    const cell = index.cells.get(cellKey(target.table, target.row, target.column))
    if (!cell) return null
    const range = document.createRange()
    range.selectNodeContents(cell)
    return range
  }

  const needle = normalizeTextTarget(target.text)
  if (!needle) return null
  const idx = index.text.indexOf(needle)
  if (idx === -1) return null
  const start = index.positions[idx]
  const end = index.positions[idx + needle.length - 1]
  if (!start || !end) return null
  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset + 1)
  return range
}

export function targetKey(
  target: DocxTarget | null | undefined
): string | null {
  if (!target) return null
  return target.kind === "cell"
    ? `cell:${target.table}:${target.row}:${target.column}`
    : `text:${normalizeTextTarget(target.text)}`
}

export function normalizeTextTarget(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

function buildDocxCellIndex(root: HTMLElement) {
  const cells = new Map<string, HTMLElement>()
  const tables = root.querySelectorAll(".docx-wrapper > section.docx table")
  tables.forEach((table, tableIndex) => {
    Array.from((table as HTMLTableElement).rows).forEach((row, rowIndex) => {
      Array.from(row.cells).forEach((cell, columnIndex) => {
        if (!hasHiddenAncestor(cell, root)) {
          cells.set(cellKey(tableIndex, rowIndex, columnIndex), cell)
        }
      })
    })
  })
  return cells
}

function buildDocxTextIndex(root: HTMLElement) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
  )
  let normalized = ""
  const positions: { node: Text; offset: number }[] = []
  let prevSpace = false
  let prevBlock: HTMLElement | null = null
  let pendingBreak = false
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const tag = (n as HTMLElement).tagName
      if (
        (tag === "BR" || tag === "HR") &&
        isDocumentBreakElement(root, n as HTMLElement)
      ) {
        pendingBreak = true
      }
      continue
    }
    if (!isDocumentTextNode(root, n as Text)) continue
    const block = blockContainer((n as Text).parentElement, root)
    const broke = pendingBreak || (prevBlock !== null && block !== prevBlock)
    pendingBreak = false
    if (broke && !prevSpace && normalized) {
      prevSpace = true
      normalized += " "
      positions.push({ node: n as Text, offset: 0 })
    }
    prevBlock = block
    const data = (n as Text).data
    for (let i = 0; i < data.length; i++) {
      if (/\s/.test(data[i])) {
        if (prevSpace) continue
        prevSpace = true
        normalized += " "
      } else {
        prevSpace = false
        normalized += data[i]
      }
      positions.push({ node: n as Text, offset: i })
    }
  }
  return { text: normalized, positions }
}

function cellKey(table: number, row: number, column: number) {
  return `${table}:${row}:${column}`
}

function blockContainer(
  el: HTMLElement | null,
  root: HTMLElement
): HTMLElement {
  let cur = el
  while (cur && cur !== root && INLINE_TAGS.has(cur.tagName)) {
    cur = cur.parentElement
  }
  return cur ?? root
}

function isDocumentTextNode(root: HTMLElement, node: Text) {
  const parent = node.parentElement
  if (!parent || !root.contains(parent)) return false
  if (!parent.closest(".docx-wrapper > section.docx")) return false
  if (parent.closest("style, script, noscript, template")) return false
  return !hasHiddenAncestor(parent, root)
}

function isDocumentBreakElement(root: HTMLElement, el: HTMLElement) {
  if (!root.contains(el)) return false
  if (!el.closest(".docx-wrapper > section.docx")) return false
  return !hasHiddenAncestor(el, root)
}

function hasHiddenAncestor(element: HTMLElement, root: HTMLElement) {
  for (let el: HTMLElement | null = element; el; el = el.parentElement) {
    if (
      el.hidden ||
      el.getAttribute("aria-hidden")?.trim().toLowerCase() === "true"
    ) {
      return true
    }
    const style =
      typeof window !== "undefined" ? window.getComputedStyle(el) : el.style
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.getPropertyValue("content-visibility") === "hidden"
    ) {
      return true
    }
    if (el === root) break
  }
  return false
}
