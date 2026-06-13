"use client"

import * as React from "react"

import {
  parseDropzoneAccept,
  validateDropzoneFiles,
  type DropzoneAcceptRule,
  type DropzoneFileRejection,
  type DropzoneIntake,
} from "@/components/ui/dropzone-core"

export {
  matchesDropzoneAccept,
  parseDropzoneAccept,
  validateDropzoneFile,
  validateDropzoneFiles,
  type DropzoneAcceptRule,
  type DropzoneFileRejection,
  type DropzoneIntake,
} from "@/components/ui/dropzone-core"

export type DropzoneFileItem = {
  id: string
  file: File
}

export type DropzoneDataAttributes = {
  [key: `data-${string}`]: string | undefined
}

export type DropzoneRootGetterProps<T extends HTMLElement> =
  React.HTMLAttributes<T> & Partial<DropzoneDataAttributes>

export type DropzoneInputGetterProps = React.ComponentPropsWithRef<"input"> &
  Partial<DropzoneDataAttributes>

export type DropzoneTriggerGetterProps<T extends HTMLElement> =
  React.HTMLAttributes<T> & Partial<DropzoneDataAttributes>

export type DropzoneButtonGetterProps = React.ComponentPropsWithRef<"button"> &
  Partial<DropzoneDataAttributes>

export type DropzoneState = {
  files: DropzoneFileItem[]
  lastIntake: DropzoneIntake
  fileRejections: DropzoneFileRejection[]
  isDragging: boolean
  isFocused: boolean
  isDisabled: boolean
}

export type UseDropzoneProps = {
  accept?: string
  disabled?: boolean
  files?: DropzoneFileItem[]
  defaultFiles?: DropzoneFileItem[]
  maxFiles?: number
  maxSize?: number
  multiple?: boolean
  onFilesChange?: (files: DropzoneFileItem[]) => void
  onIntake?: (intake: DropzoneIntake) => void
}

export type UseDropzoneReturn = DropzoneState & {
  clearFiles: () => void
  openFileDialog: () => void
  removeFile: (fileId: string) => void
  reset: () => void
  resetIntake: () => void
  getRootProps: <T extends HTMLElement>(
    props?: DropzoneRootGetterProps<T>
  ) => DropzoneRootGetterProps<T>
  getInputProps: (props?: DropzoneInputGetterProps) => DropzoneInputGetterProps
  getTriggerProps: <T extends HTMLElement>(
    props?: DropzoneTriggerGetterProps<T>
  ) => DropzoneTriggerGetterProps<T>
  getButtonProps: (
    props?: DropzoneButtonGetterProps
  ) => DropzoneButtonGetterProps
}

const EMPTY_INTAKE: DropzoneIntake = {
  acceptedFiles: [],
  fileRejections: [],
}

export function useDropzone({
  accept,
  defaultFiles = [],
  disabled = false,
  files,
  maxFiles,
  maxSize,
  multiple = true,
  onFilesChange,
  onIntake,
}: UseDropzoneProps = {}): UseDropzoneReturn {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const dragDepthRef = React.useRef(0)
  const isControlled = files !== undefined
  const acceptRules = React.useMemo<DropzoneAcceptRule[]>(
    () => parseDropzoneAccept(accept),
    [accept]
  )
  const [uncontrolledFiles, setUncontrolledFiles] =
    React.useState<DropzoneFileItem[]>(defaultFiles)
  const [lastIntake, setLastIntake] =
    React.useState<DropzoneIntake>(EMPTY_INTAKE)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isFocused, setIsFocused] = React.useState(false)
  const currentFiles = files ?? uncontrolledFiles
  const filesRef = React.useRef(currentFiles)

  React.useEffect(() => {
    filesRef.current = currentFiles
  }, [currentFiles])

  const commitFileTransition = React.useCallback(
    (transition: (files: DropzoneFileItem[]) => DropzoneFileItem[]) => {
      if (isControlled) {
        const nextFiles = transition(files ?? [])
        onFilesChange?.(nextFiles)
        return nextFiles
      }

      const nextFiles = transition(filesRef.current)
      filesRef.current = nextFiles
      setUncontrolledFiles(() => nextFiles)
      onFilesChange?.(nextFiles)
      return nextFiles
    },
    [files, isControlled, onFilesChange]
  )

  const resetDragState = React.useCallback(() => {
    dragDepthRef.current = 0
    setIsDragging(false)
  }, [])

  const resetIntake = React.useCallback(() => {
    setLastIntake(EMPTY_INTAKE)
  }, [])

  const clearFiles = React.useCallback(() => {
    if (disabled) return
    commitFileTransition(() => [])
  }, [commitFileTransition, disabled])

  const reset = React.useCallback(() => {
    if (disabled) return
    resetDragState()
    setIsFocused(false)
    resetIntake()
    commitFileTransition(() => [])
  }, [commitFileTransition, disabled, resetDragState, resetIntake])

  const removeFile = React.useCallback(
    (fileId: string) => {
      if (disabled) return
      commitFileTransition((previousFiles) =>
        previousFiles.filter((item) => item.id !== fileId)
      )
    },
    [commitFileTransition, disabled]
  )

  const commitFiles = React.useCallback(
    (nextFiles: FileList | File[]) => {
      if (disabled) return

      const incomingFiles = Array.from(nextFiles).slice(
        0,
        multiple ? undefined : 1
      )
      const baseFiles = multiple ? filesRef.current : []
      const intake = validateDropzoneFiles(incomingFiles, {
        accept: acceptRules,
        currentCount: baseFiles.length,
        maxFiles,
        maxSize,
      })

      setLastIntake(intake)
      onIntake?.(intake)
      if (intake.acceptedFiles.length === 0) return

      const acceptedItems = intake.acceptedFiles.map((file) => ({
        id: createDropzoneFileId(file),
        file,
      }))
      const nextItems = commitFileTransition((previousFiles) =>
        createNextDropzoneFiles({
          acceptedItems,
          multiple,
          previousFiles,
        })
      )

      return nextItems
    },
    [
      acceptRules,
      commitFileTransition,
      disabled,
      maxFiles,
      maxSize,
      multiple,
      onIntake,
    ]
  )

  const openFileDialog = React.useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  React.useEffect(() => {
    if (disabled) {
      resetDragState()
      setIsFocused(false)
    }
  }, [disabled, resetDragState])

  const getRootProps = React.useCallback(
    <T extends HTMLElement>(
      props: DropzoneRootGetterProps<T> = {}
    ): DropzoneRootGetterProps<T> => ({
      ...props,
      "aria-disabled": disabled || props["aria-disabled"] || undefined,
      "data-dragging": isDragging ? "" : undefined,
      "data-slot": props["data-slot"] ?? "dropzone",
      onDragEnter: composeEventHandlers(props.onDragEnter, (event) => {
        if (disabled || !hasDraggedFiles(event.dataTransfer)) return
        event.preventDefault()
        dragDepthRef.current += 1
        setIsDragging(true)
      }),
      onDragLeave: composeEventHandlers(props.onDragLeave, (event) => {
        if (disabled || !hasDraggedFiles(event.dataTransfer)) return
        event.preventDefault()
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
        if (dragDepthRef.current === 0) setIsDragging(false)
      }),
      onDragOver: composeEventHandlers(props.onDragOver, (event) => {
        if (disabled || !hasDraggedFiles(event.dataTransfer)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      }),
      onDrop: composeEventHandlers(props.onDrop, (event) => {
        if (disabled || !hasDraggedFiles(event.dataTransfer)) return
        event.preventDefault()
        resetDragState()
        if (event.dataTransfer.files.length > 0) {
          commitFiles(event.dataTransfer.files)
        }
      }),
    }),
    [commitFiles, disabled, isDragging, resetDragState]
  )

  const getInputProps = React.useCallback(
    (props: DropzoneInputGetterProps = {}): DropzoneInputGetterProps => ({
      ...props,
      accept,
      disabled,
      multiple,
      ref: composeRefs(inputRef, props.ref),
      type: "file",
      "data-slot": props["data-slot"] ?? "dropzone-input",
      onChange: composeEventHandlers(props.onChange, (event) => {
        if (disabled) return
        if (event.currentTarget.files) {
          commitFiles(event.currentTarget.files)
          event.currentTarget.value = ""
        }
      }),
    }),
    [accept, commitFiles, disabled, multiple]
  )

  const getTriggerProps = React.useCallback(
    <T extends HTMLElement>(
      props: DropzoneTriggerGetterProps<T> = {}
    ): DropzoneTriggerGetterProps<T> => ({
      ...props,
      "aria-disabled": disabled || props["aria-disabled"] || undefined,
      "data-focused": isFocused ? "" : undefined,
      "data-slot": props["data-slot"] ?? "dropzone-trigger",
      role: props.role ?? "button",
      tabIndex: disabled ? -1 : (props.tabIndex ?? 0),
      onBlur: composeEventHandlers(props.onBlur, () => {
        setIsFocused(false)
      }),
      onClick: composeEventHandlers(props.onClick, () => {
        openFileDialog()
      }),
      onFocus: composeEventHandlers(props.onFocus, () => {
        if (!disabled) setIsFocused(true)
      }),
      onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
        if (disabled) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          openFileDialog()
        }
      }),
    }),
    [disabled, isFocused, openFileDialog]
  )

  const getButtonProps = React.useCallback(
    (props: DropzoneButtonGetterProps = {}): DropzoneButtonGetterProps => ({
      ...props,
      disabled,
      "data-focused": isFocused ? "" : undefined,
      "data-slot": props["data-slot"] ?? "dropzone-trigger",
      type: props.type ?? "button",
      onBlur: composeEventHandlers(props.onBlur, () => {
        setIsFocused(false)
      }),
      onClick: composeEventHandlers(props.onClick, () => {
        openFileDialog()
      }),
      onFocus: composeEventHandlers(props.onFocus, () => {
        if (!disabled) setIsFocused(true)
      }),
    }),
    [disabled, isFocused, openFileDialog]
  )

  return {
    files: currentFiles,
    lastIntake,
    fileRejections: lastIntake.fileRejections,
    isDragging,
    isFocused,
    isDisabled: disabled,
    clearFiles,
    openFileDialog,
    removeFile,
    reset,
    resetIntake,
    getRootProps,
    getInputProps,
    getTriggerProps,
    getButtonProps,
  }
}

function createNextDropzoneFiles({
  acceptedItems,
  multiple,
  previousFiles,
}: {
  acceptedItems: DropzoneFileItem[]
  multiple: boolean
  previousFiles: DropzoneFileItem[]
}) {
  return multiple ? [...previousFiles, ...acceptedItems] : acceptedItems
}

function createDropzoneFileId(file: File): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return `${file.name}-${file.size}-${file.lastModified}-${uniqueId}`
}

function hasDraggedFiles(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false
  if (dataTransfer.items?.length) {
    return Array.from(dataTransfer.items).some((item) => item.kind === "file")
  }

  return Array.from(dataTransfer.types).includes("Files")
}

function composeEventHandlers<Event extends { defaultPrevented: boolean }>(
  externalHandler: ((event: Event) => void) | undefined,
  internalHandler: (event: Event) => void
) {
  return (event: Event) => {
    externalHandler?.(event)
    if (!event.defaultPrevented) internalHandler(event)
  }
}

function composeRefs<T>(
  internalRef: React.MutableRefObject<T | null>,
  externalRef: React.Ref<T> | undefined
) {
  return (node: T | null) => {
    internalRef.current = node
    if (!externalRef) return
    if (typeof externalRef === "function") {
      externalRef(node)
      return
    }
    externalRef.current = node
  }
}
