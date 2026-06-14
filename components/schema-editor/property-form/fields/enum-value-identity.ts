"use client"

import * as React from "react"
import type { JSONSchema7Type } from "json-schema"

export function useEnumValueIdentity({
  resetKey,
  values,
}: {
  resetKey: string
  values: JSONSchema7Type[]
}) {
  const resetKeyRef = React.useRef(resetKey)
  const nextIdRef = React.useRef(0)
  const idsRef = React.useRef<string[]>([])

  if (resetKeyRef.current !== resetKey) {
    resetKeyRef.current = resetKey
    nextIdRef.current = 0
    idsRef.current = []
  }

  while (idsRef.current.length < values.length) {
    idsRef.current.push(createEnumValueId(nextIdRef.current))
    nextIdRef.current += 1
  }

  if (idsRef.current.length > values.length) {
    idsRef.current.length = values.length
  }

  return {
    ids: idsRef.current,
    removeId: (id: string) => {
      const index = idsRef.current.indexOf(id)
      if (index >= 0) {
        idsRef.current.splice(index, 1)
      }
    },
  }
}

function createEnumValueId(sequence: number) {
  return `enum-value-${sequence}`
}
