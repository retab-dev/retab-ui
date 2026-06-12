import {
  materializeFieldPath,
  type FieldPath,
  type MaterializedFieldPath,
} from "@/components/json-table/lib/document-paths"
import type { TableDocument } from "@/components/json-table/lib/projects-types"

export interface ProjectedCell {
  key: FieldPath
  value: unknown
  templateFieldPath: FieldPath
  materializedFieldPath: MaterializedFieldPath
  arrayIndexes: number[]
  addArrayItemAtIndex?: number
}

export interface ProjectedRow {
  rowIndex: number
  cells: Array<ProjectedCell | undefined>
}

function joinTemplateFieldPath(templateFieldPathParts: string[]) {
  return templateFieldPathParts.filter(Boolean).join(".")
}

function getOwnObjectValue(node: unknown, property: string): unknown {
  if (node === null || typeof node !== "object") return undefined
  if (!Object.prototype.hasOwnProperty.call(node, property)) return undefined
  return (node as Record<string, unknown>)[property]
}

function countTemplateColumns(templateParts: string[][], depth: number): number {
  let colSpan = 0
  const remainingTemplates = templateParts.filter((template) => {
    if (template.length !== depth) return true
    colSpan++
    return false
  })

  if (remainingTemplates.length === 0) return colSpan

  const topProperties = new Set(
    remainingTemplates
      .filter((template) => template.length > depth)
      .map((template) => template[depth])
  )

  if (topProperties.has("*") && topProperties.size === 1) {
    return colSpan + countTemplateColumns(remainingTemplates, depth + 1)
  }

  if (topProperties.has("*")) {
    throw new Error("Wildcard '*' used along with other properties")
  }

  for (const property of topProperties) {
    colSpan += countTemplateColumns(
      remainingTemplates.filter((template) => template[depth] === property),
      depth + 1
    )
  }

  return colSpan
}

export function projectDocumentRows({
  document,
  visiblePaths,
  includeArrayAddRows = true,
}: {
  document: TableDocument
  visiblePaths: FieldPath[]
  includeArrayAddRows?: boolean
}): ProjectedRow[] {
  const rows: ProjectedRow[] = []
  const templates = visiblePaths.map((visibleFieldPath) =>
    visibleFieldPath.split(".")
  )

  function ensureRow(rowIndex: number): ProjectedRow {
    if (!rows[rowIndex]) {
      rows[rowIndex] = { rowIndex, cells: [] }
    }
    return rows[rowIndex]
  }

  function compile(
    node: unknown,
    templateParts: string[][],
    arrayIndexes: number[],
    depth: number,
    rowOffset: number,
    colOffset: number,
    addArrayItemAtIndex: number | undefined
  ): [number, number] {
    let rowSpan = 0
    let colSpan = 0

    templateParts = templateParts.filter((template) => {
      if (template.length !== depth) return true

      const templateFieldPath = joinTemplateFieldPath(template)
      ensureRow(rowOffset).cells[colOffset + colSpan] = {
        key: templateFieldPath,
        value: node,
        templateFieldPath,
        materializedFieldPath: materializeFieldPath(
          templateFieldPath,
          arrayIndexes
        ),
        arrayIndexes,
        addArrayItemAtIndex,
      }
      colSpan++
      rowSpan = 1
      return false
    })

    if (templateParts.length === 0) {
      return [rowSpan, colSpan]
    }

    const topProperties = new Set(
      templateParts
        .filter((template) => template.length > depth)
        .map((template) => template[depth])
    )

    if (topProperties.has("*") && topProperties.size === 1) {
      const arrayValue = Array.isArray(node) ? node : []
      for (let index = 0; index < arrayValue.length; index++) {
        const [childRows, childCols] = compile(
          arrayValue[index],
          templateParts,
          [...arrayIndexes, index],
          depth + 1,
          rowOffset + rowSpan,
          colOffset,
          addArrayItemAtIndex
        )
        rowSpan += childRows
        colSpan = Math.max(colSpan, childCols)
      }

      if (!includeArrayAddRows) {
        if (rowSpan === 0) {
          colSpan = Math.max(colSpan, countTemplateColumns(templateParts, depth + 1))
        }
        return [rowSpan, colSpan]
      }

      const [addRows, addCols] = compile(
        undefined,
        templateParts,
        [...arrayIndexes, arrayValue.length],
        depth + 1,
        rowOffset + rowSpan,
        colOffset,
        addArrayItemAtIndex ?? arrayIndexes.length
      )
      return [rowSpan + addRows, Math.max(colSpan, addCols)]
    }

    if (topProperties.has("*")) {
      throw new Error("Wildcard '*' used along with other properties")
    }

    for (const property of topProperties) {
      const childTemplates = templateParts.filter(
        (template) => template[depth] === property
      )
      const childNode = getOwnObjectValue(node, property)
      const [childRows, childCols] = compile(
        childNode,
        childTemplates,
        arrayIndexes,
        depth + 1,
        rowOffset,
        colOffset + colSpan,
        addArrayItemAtIndex
      )
      rowSpan = Math.max(rowSpan, childRows)
      colSpan += childCols
    }

    return [rowSpan, colSpan]
  }

  compile(document.data, templates, [], 0, 0, 0, undefined)

  return rows
}
