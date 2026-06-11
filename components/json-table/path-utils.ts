import { useCallback, useEffect, useRef } from "react"

import type { BuilderDocument } from "@/components/json-table/lib/projects-types"

/* --------------------------------------------------------------------
 *  PathInfo – metadata we keep per cell
 * ------------------------------------------------------------------*/
export interface PathInfo {
  value: unknown // leaf value
  tpl: string // e.g. "items.*.name"
  idx: number[] // all array indices on the path   [outer , inner , …]
  plusPathIdx?: number // at which index of the idx array to add an element when the plus is clicked
}

/* Replace every "*" in the template with the recorded indices */
export function materialize(tpl: string, idx: number[]): string {
  for (const id of idx) {
    if (tpl.includes("*")) {
      tpl = tpl.replace("*", id.toString())
    }
  }
  return tpl
}

function joinPath(path: (string | "*")[]) {
  return path.filter(Boolean).join(".")
}

/* --------------------------------------------------------------------
 *  objectToTable2D
 *  –  keeps the header order given in tplOrder
 *  –  repeats “outer” values only on the first sub‑row
 * ------------------------------------------------------------------*/
export function objectToTable2D(
  data: BuilderDocument,
  tplOrder: string[] = [],
  options: { includeArrayAddRows?: boolean } = {}
): { table: unknown[][]; paths: (PathInfo | undefined)[][] } {
  const table: unknown[][] = []
  const paths: (PathInfo | undefined)[][] = []
  const includeArrayAddRows = options.includeArrayAddRows ?? true

  function compileTable(
    obj: unknown,
    tpl: string[][],
    idx: number[],
    depth: number,
    rowOffset: number,
    colOffset: number,
    plusIdx: number | undefined
  ): [number, number] /* [rows, cols] taken by the compiled table */ {
    let rows = 0
    let cols = 0
    tpl = tpl.filter((t) => {
      if (t.length !== depth) return true
      if (!table[rowOffset]) {
        table[rowOffset] = []
      }
      if (!paths[rowOffset]) {
        paths[rowOffset] = []
      }
      table[rowOffset][colOffset + cols] = obj
      paths[rowOffset][colOffset + cols] = {
        value: obj,
        tpl: joinPath(t),
        idx,
        plusPathIdx: plusIdx,
      }
      cols++
      rows = 1
      return false
    })

    if (tpl.length === 0) {
      return [rows, cols]
    }

    const topProperties = new Set(
      tpl.filter((t) => t.length > depth).map((t) => t[depth])
    )
    if (topProperties.has("*") && topProperties.size === 1) {
      const arr = (Array.isArray(obj) ? obj : []) as unknown[]
      for (let i = 0; i < arr.length; i++) {
        const e = arr[i]
        const [subRows, subCols] = compileTable(
          e,
          tpl,
          [...idx, i],
          depth + 1,
          rowOffset + rows,
          colOffset,
          plusIdx
        )
        rows += subRows
        cols = Math.max(cols, subCols)
      }
      if (!includeArrayAddRows) {
        return [rows, cols]
      }

      const [plusRows, plusCols] = compileTable(
        undefined,
        tpl,
        [...idx, arr.length],
        depth + 1,
        rowOffset + rows,
        colOffset,
        plusIdx ?? idx.length
      )

      return [rows + plusRows, Math.max(cols, plusCols)]
    }
    if (topProperties.has("*")) {
      throw new Error("Wildcard '*' used along with other properties")
    }
    for (const prop of topProperties) {
      const newTpl = tpl.filter((t) => t[depth] === prop)
      const newObj = (obj as Record<string, unknown> | undefined)?.[prop]
      const [subRows, subCols] = compileTable(
        newObj,
        newTpl,
        idx,
        depth + 1,
        rowOffset,
        colOffset + cols,
        plusIdx
      )
      rows = Math.max(rows, subRows)
      cols += subCols
    }
    return [rows, cols]
  }

  const root =
    data && typeof data === "object" && "prediction_data" in data
      ? ((data as BuilderDocument).prediction_data?.prediction ?? {})
      : {}

  compileTable(
    root,
    tplOrder.map((t) => t.split(".")),
    [],
    0,
    0,
    0,
    undefined
  )

  return { table, paths }
}

export function useRefCallback<TArgs extends unknown[], TResult>(
  callback: (...args: TArgs) => TResult
): (...args: TArgs) => TResult {
  const ref = useRef(callback)
  useEffect(() => {
    ref.current = callback
  }, [callback])
  return useCallback((...args: TArgs) => ref.current(...args), [])
}

export function cmp<T>(
  a: T,
  b: T,
  options?: {
    deep?: string[]
    shallow?: string[]
  },
  curKey: string = ""
): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a !== "object" || a == null || b == null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (
    options?.shallow?.includes(curKey) ||
    (!options?.shallow?.length &&
      options?.deep?.length &&
      !options?.deep?.find((k) => k.startsWith(curKey)))
  ) {
    return Object.is(a, b)
  }

  const objA = a as Record<string, unknown>
  const objB = b as Record<string, unknown>
  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false
    const nextKey = curKey ? curKey + "." + key : key
    if (!cmp(objA[key], objB[key], options, nextKey)) return false
  }
  return true
}

export function assignObjectKey(
  obj: unknown,
  key: string[],
  value: unknown | ((arg0: unknown) => unknown)
): unknown {
  if (key.length === 0) {
    return typeof value === "function" ? value(obj) : value
  }

  const [rawSeg, ...rest] = key
  const isIndex = /^\d+$/.test(rawSeg)

  // Ensure we always have a valid container to work with at this depth
  const current = obj == null ? (isIndex ? [] : {}) : obj

  if (isIndex) {
    const index = parseInt(rawSeg, 10)
    const baseArr: unknown[] = Array.isArray(current) ? current : []
    const existingChild = Array.isArray(current) ? current[index] : undefined
    const updatedChild = assignObjectKey(existingChild, rest, value)
    const newArr = baseArr.slice()
    newArr[index] = updatedChild
    return newArr
  }

  const seg = rawSeg
  const baseObj: Record<string, unknown> =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {}
  const existingChild = baseObj[seg]
  return {
    ...baseObj,
    [seg]: assignObjectKey(existingChild, rest, value),
  }
}
