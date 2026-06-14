"use client"

import * as React from "react"
import type { FileTree as PierreFileTreeModel } from "@pierre/trees"

import type { FileSystemPierreExpansion } from "./file-system-pierre-expansion"
import type { FileSystemPierreInput } from "./file-system-pierre-input"
import type { FileSystemPierreOrder } from "./file-system-pierre-order"
import {
  classifyFileSystemPierreResetTransition,
  createFileSystemPierreResetIdentity,
} from "./file-system-pierre-reset-identity"
import { scrollCurrentFileSystemEntryIntoView } from "./file-system-pierre-selection"

const useIsoLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

export function useResetFileSystemPierreModel({
  currentPath,
  decorationVersion,
  expansion,
  hasSemanticQuery,
  input,
  model,
  order,
  selectedPath,
}: {
  currentPath: string
  decorationVersion: string
  expansion: FileSystemPierreExpansion
  hasSemanticQuery: boolean
  input: FileSystemPierreInput
  model: PierreFileTreeModel
  order: FileSystemPierreOrder
  selectedPath: string | null
}) {
  const appliedIdentityRef = React.useRef(
    createFileSystemPierreResetIdentity({
      currentPath,
      decorationVersion,
      hasSemanticQuery,
      input,
    })
  )

  useIsoLayoutEffect(() => {
    const previousIdentity = appliedIdentityRef.current
    const nextIdentity = createFileSystemPierreResetIdentity({
      currentPath,
      decorationVersion,
      hasSemanticQuery,
      input,
    })

    const transition = classifyFileSystemPierreResetTransition(
      previousIdentity,
      nextIdentity
    )
    const plan = expansion.createResetPlan(transition)

    if (plan.kind === "none") {
      return
    }

    expansion.rememberBeforeReset(plan.transition.previous)
    appliedIdentityRef.current = nextIdentity
    order.reset(plan.nextPierrePaths)
    model.resetPaths(plan.nextPierrePaths, {
      initialExpandedPaths: plan.initialExpandedPaths,
      preparedInput: plan.transition.next.input.preparedInput,
    })
    scrollCurrentFileSystemEntryIntoView({
      input: plan.transition.next.input,
      model,
      selectedPath,
    })
  }, [
    currentPath,
    decorationVersion,
    expansion,
    hasSemanticQuery,
    input,
    model,
    order,
    selectedPath,
  ])
}
