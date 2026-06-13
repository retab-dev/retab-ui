"use client"

import * as React from "react"

export type DropzoneFileRejection = {
  file: File
  reason: "file-invalid-type" | "file-too-large" | "too-many-files"
  message: string
}

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

export type DropzoneState = {
  files: DropzoneFileItem[]
  acceptedFiles: File[]
  rejectedFiles: DropzoneFileRejection[]
  isDragging: boolean
  isFocused: boolean
  isDisabled: boolean
  hasFiles: boolean
}

export type UseDropzoneProps = {
  accept?: string
  disabled?: boolean
  files?: DropzoneFileItem[]
  defaultFiles?: DropzoneFileItem[]
  maxFiles?: number
  maxSize?: number
  multiple?: boolean
  onFilesAccepted?: (files: File[]) => void
  onFilesChange?: (files: DropzoneFileItem[]) => void
  onFilesRejected?: (rejections: DropzoneFileRejection[]) => void
}

export type UseDropzoneReturn = DropzoneState & {
  clearFiles: () => void
  openFileDialog: () => void
  removeFile: (fileId: string) => void
  getRootProps: <T extends HTMLElement>(
    props?: DropzoneRootGetterProps<T>
  ) => DropzoneRootGetterProps<T>
  getInputProps: (props?: DropzoneInputGetterProps) => DropzoneInputGetterProps
  getTriggerProps: <T extends HTMLElement>(
    props?: DropzoneRootGetterProps<T>
  ) => DropzoneRootGetterProps<T>
}

export type DropzoneRootProps = UseDropzoneProps &
  Omit<React.ComponentPropsWithoutRef<"div">, "children" | "onDrop"> & {
    children?:
      | React.ReactNode
      | ((dropzone: UseDropzoneReturn) => React.ReactNode)
  }

type DropzoneContextValue = UseDropzoneReturn

const DropzoneContext = React.createContext<DropzoneContextValue | null>(null)

export function useDropzone({
  accept,
  defaultFiles = [],
  disabled = false,
  files,
  maxFiles,
  maxSize,
  multiple = true,
  onFilesAccepted,
  onFilesChange,
  onFilesRejected,
}: UseDropzoneProps = {}): UseDropzoneReturn {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const dragDepthRef = React.useRef(0)
  const isControlled = files !== undefined
  const [uncontrolledFiles, setUncontrolledFiles] =
    React.useState<DropzoneFileItem[]>(defaultFiles)
  const [acceptedFiles, setAcceptedFiles] = React.useState<File[]>([])
  const [rejectedFiles, setRejectedFiles] = React.useState<
    DropzoneFileRejection[]
  >([])
  const [isDragging, setIsDragging] = React.useState(false)
  const [isFocused, setIsFocused] = React.useState(false)
  const currentFiles = files ?? uncontrolledFiles

  const commitFileItems = React.useCallback(
    (nextFiles: DropzoneFileItem[]) => {
      if (!isControlled) setUncontrolledFiles(nextFiles)
      onFilesChange?.(nextFiles)
    },
    [isControlled, onFilesChange]
  )

  const resetDragState = React.useCallback(() => {
    dragDepthRef.current = 0
    setIsDragging(false)
  }, [])

  const commitFiles = React.useCallback(
    (nextFiles: FileList | File[]) => {
      if (disabled) return

      const incomingFiles = Array.from(nextFiles).slice(
        0,
        multiple ? undefined : 1
      )
      const currentCount = multiple ? currentFiles.length : 0
      const { accepted, rejected } = validateDropzoneFiles(incomingFiles, {
        accept,
        currentCount,
        maxFiles,
        maxSize,
      })

      setAcceptedFiles(accepted)
      setRejectedFiles(rejected)
      if (rejected.length > 0) onFilesRejected?.(rejected)
      if (accepted.length === 0) return

      const acceptedItems = accepted.map((file) => ({
        id: createDropzoneFileId(file),
        file,
      }))
      const nextItems = multiple
        ? [...currentFiles, ...acceptedItems]
        : acceptedItems

      commitFileItems(nextItems)
      onFilesAccepted?.(accepted)
    },
    [
      accept,
      commitFileItems,
      currentFiles,
      disabled,
      maxFiles,
      maxSize,
      multiple,
      onFilesAccepted,
      onFilesRejected,
    ]
  )

  const clearFiles = React.useCallback(() => {
    if (disabled) return
    commitFileItems([])
  }, [commitFileItems, disabled])

  const removeFile = React.useCallback(
    (fileId: string) => {
      if (disabled) return
      commitFileItems(currentFiles.filter((item) => item.id !== fileId))
    },
    [commitFileItems, currentFiles, disabled]
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
      props: DropzoneRootGetterProps<T> = {}
    ): DropzoneRootGetterProps<T> => ({
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

  return {
    files: currentFiles,
    acceptedFiles,
    rejectedFiles,
    isDragging,
    isFocused,
    isDisabled: disabled,
    hasFiles: currentFiles.length > 0,
    clearFiles,
    openFileDialog,
    removeFile,
    getRootProps,
    getInputProps,
    getTriggerProps,
  }
}

export function DropzoneRoot({
  accept,
  children,
  defaultFiles,
  disabled,
  files,
  maxFiles,
  maxSize,
  multiple,
  onFilesAccepted,
  onFilesChange,
  onFilesRejected,
  ...props
}: DropzoneRootProps) {
  const dropzone = useDropzone({
    accept,
    defaultFiles,
    disabled,
    files,
    maxFiles,
    maxSize,
    multiple,
    onFilesAccepted,
    onFilesChange,
    onFilesRejected,
  })

  return (
    <DropzoneContext.Provider value={dropzone}>
      <div {...dropzone.getRootProps(props)}>
        {typeof children === "function" ? children(dropzone) : children}
      </div>
    </DropzoneContext.Provider>
  )
}

export function Dropzone(props: DropzoneRootProps) {
  return <DropzoneRoot {...props} />
}

export function DropzoneInput(props: DropzoneInputGetterProps = {}) {
  const dropzone = useDropzoneContext()
  return <input {...dropzone.getInputProps(props)} />
}

export function DropzoneTrigger({
  children,
  ...props
}: DropzoneRootGetterProps<HTMLDivElement> & {
  children?: React.ReactNode
}) {
  const dropzone = useDropzoneContext()
  return <div {...dropzone.getTriggerProps(props)}>{children}</div>
}

export function useDropzoneContext() {
  const context = React.useContext(DropzoneContext)
  if (!context) {
    throw new Error("useDropzoneContext must be used within DropzoneRoot.")
  }
  return context
}

export function validateDropzoneFile(
  file: File,
  {
    accept,
    maxSize,
  }: {
    accept?: string
    maxSize?: number
  }
): DropzoneFileRejection | null {
  if (!matchesDropzoneAccept(file, accept)) {
    return {
      file,
      reason: "file-invalid-type",
      message: "This file type is not supported here.",
    }
  }

  if (maxSize !== undefined && file.size > maxSize) {
    return {
      file,
      reason: "file-too-large",
      message: `File must be ${formatDropzoneBytes(maxSize)} or smaller.`,
    }
  }

  return null
}

export function validateDropzoneFiles(
  files: File[],
  {
    accept,
    currentCount = 0,
    maxFiles,
    maxSize,
  }: {
    accept?: string
    currentCount?: number
    maxFiles?: number
    maxSize?: number
  }
): {
  accepted: File[]
  rejected: DropzoneFileRejection[]
} {
  const accepted: File[] = []
  const rejected: DropzoneFileRejection[] = []
  const availableSlots =
    maxFiles === undefined ? Number.POSITIVE_INFINITY : maxFiles - currentCount

  for (const file of files) {
    const rejection = validateDropzoneFile(file, { accept, maxSize })
    if (rejection) {
      rejected.push(rejection)
      continue
    }

    if (accepted.length >= availableSlots) {
      rejected.push({
        file,
        reason: "too-many-files",
        message:
          maxFiles === 1
            ? "Only one file can be selected."
            : `Only ${maxFiles} files can be selected.`,
      })
      continue
    }

    accepted.push(file)
  }

  return { accepted, rejected }
}

export function matchesDropzoneAccept(file: File, accept?: string): boolean {
  if (!accept) return true

  return accept.split(",").some((rawToken) => {
    const token = rawToken.trim().toLowerCase()

    if (!token) return false
    if (token.startsWith(".")) return file.name.toLowerCase().endsWith(token)
    if (token.endsWith("/*")) {
      return file.type.toLowerCase().startsWith(token.slice(0, -1))
    }

    return file.type.toLowerCase() === token
  })
}

export function formatDropzoneBytes(bytes: number): string {
  if (bytes === 0) return "0 B"

  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )

  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${
    units[index]
  }`
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
