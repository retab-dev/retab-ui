import { materializeFieldPath } from "@/components/json-table/lib/document-patches"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import type {
  FieldPath,
  MaterializedFieldPath,
} from "@/components/json-table/lib/schema-inspection"

export interface ProjectedCell {
  key: FieldPath
  value: unknown
  templatePath: FieldPath
  materializedPath: MaterializedFieldPath
  arrayIndexes: number[]
  addArrayItemAtIndex?: number
}

export interface ProjectedRow {
  rowIndex: number
  cells: Array<ProjectedCell | undefined>
}

function joinPath(path: string[]) {
  return path.filter(Boolean).join(".")
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
  const templates = visiblePaths.map((path) => path.split("."))

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

      const templatePath = joinPath(template)
      ensureRow(rowOffset).cells[colOffset + colSpan] = {
        key: templatePath,
        value: node,
        templatePath,
        materializedPath: materializeFieldPath(templatePath, arrayIndexes),
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
      const childNode = (node as Record<string, unknown> | undefined)?.[
        property
      ]
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
