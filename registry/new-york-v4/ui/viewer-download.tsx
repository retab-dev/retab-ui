"use client"

import * as React from "react"
import { Download } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  ViewerDownloadError,
  type ViewerDownloadAction,
  type ViewerDownloadPayload,
} from "@/lib/viewer-download"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export async function triggerViewerDownload(
  action: ViewerDownloadAction,
  options?: { signal?: AbortSignal }
): Promise<void> {
  if (action.isDisabled) {
    throw new ViewerDownloadError({
      actionId: action.id,
      kind: "disabled",
      message: "This download is disabled.",
    })
  }

  let payload: ViewerDownloadPayload
  try {
    payload = await action.getPayload(options)
  } catch (error) {
    if (isAbortError(error)) {
      throw new ViewerDownloadError({
        actionId: action.id,
        kind: "aborted",
        message: "Download was cancelled.",
        cause: error,
      })
    }
    throw new ViewerDownloadError({
      actionId: action.id,
      kind: "payload_failed",
      message: "Could not prepare this download.",
      cause: error,
    })
  }

  if (payload.kind === "none") return
  if (payload.kind === "href") {
    clickDownload(payload.href, action.fileName)
    return
  }

  const blob =
    payload.kind === "blob"
      ? payload.blob
      : new Blob([payload.text], {
          type: payload.mimeType ?? "text/plain;charset=utf-8",
        })
  const url = URL.createObjectURL(blob)
  try {
    clickDownload(url, action.fileName)
  } finally {
    URL.revokeObjectURL(url)
  }
}

type ViewerDownloadErrorHandler = (
  error: ViewerDownloadError,
  action: ViewerDownloadAction
) => void

export function useViewerDownloadHref(
  action: ViewerDownloadAction | null
): string | null {
  const shouldCreateHref = action?.origin !== "derived"
  const payload = shouldCreateHref ? getSynchronousPayload(action) : null

  return shouldCreateHref && payload?.kind === "href" ? payload.href : null
}

export function ViewerDownloadControl({
  actions,
  variant = "ghost",
  size = "icon-sm",
  className = "size-7",
  showLabel = false,
  onError,
}: {
  actions: Array<ViewerDownloadAction | null | undefined>
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
  showLabel?: boolean
  onError?: ViewerDownloadErrorHandler
}) {
  const enabledActions = actions.filter(
    (action): action is ViewerDownloadAction => Boolean(action)
  )

  if (enabledActions.length <= 1) {
    return (
      <ViewerDownloadButton
        action={enabledActions[0] ?? null}
        variant={variant}
        size={size}
        className={className}
        showLabel={showLabel}
        onError={onError}
      />
    )
  }

  return (
    <ViewerDownloadMenu
      actions={enabledActions}
      variant={variant}
      size={size}
      className={className}
      showLabel={showLabel}
      onError={onError}
    />
  )
}

export function ViewerDownloadButton({
  action,
  variant = "ghost",
  size = "icon-sm",
  className = "size-7",
  showLabel = false,
  onError,
}: {
  action: ViewerDownloadAction | null
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
  showLabel?: boolean
  onError?: ViewerDownloadErrorHandler
}) {
  const [isPending, setIsPending] = React.useState(false)
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const href = useViewerDownloadHref(action)
  const label = action?.label ?? "Download"
  const disabled = !action || action.isDisabled
  const hasDownloadHref = Boolean(href)

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
    }
  }, [action])

  const handleClick = React.useCallback(() => {
    if (!action || hasDownloadHref) return
    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setIsPending(true)
    void triggerViewerDownload(action, { signal: abortController.signal })
      .catch((error) => {
        reportDownloadError(error, action, onError)
      })
      .finally(() => {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
          setIsPending(false)
        }
      })
  }, [action, hasDownloadHref, onError])

  if (href) {
    return (
      <a
        href={href}
        download={action?.fileName}
        className={cn(buttonVariants({ variant, size }), className)}
        aria-label={label}
        title={label}
        data-slot="button"
      >
        <Download className={showLabel ? "mr-1.5 size-4" : undefined} />
        {showLabel ? label : null}
      </a>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      aria-label={label}
      title={label}
      disabled={disabled}
      loading={isPending}
      onClick={handleClick}
    >
      <Download className={showLabel ? "mr-1.5 size-4" : undefined} />
      {showLabel ? label : null}
    </Button>
  )
}

export function ViewerDownloadMenu({
  actions,
  variant = "ghost",
  size = "icon-sm",
  className = "size-7",
  showLabel = false,
  onError,
}: {
  actions: ViewerDownloadAction[]
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
  showLabel?: boolean
  onError?: ViewerDownloadErrorHandler
}) {
  const [pendingActionId, setPendingActionId] = React.useState<string | null>(
    null
  )
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const actionSetKey = actions.map((action) => action.id).join("\u0000")
  const label = "Download"

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
    }
  }, [actionSetKey])

  const trigger = (action: ViewerDownloadAction) => {
    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setPendingActionId(action.id)
    void triggerViewerDownload(action, { signal: abortController.signal })
      .catch((error) => {
        reportDownloadError(error, action, onError)
      })
      .finally(() => {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
          setPendingActionId(null)
        }
      })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant}
            size={size}
            className={className}
            aria-label={label}
            title={label}
            loading={pendingActionId != null}
          >
            <Download className={showLabel ? "mr-1.5 size-4" : undefined} />
            {showLabel ? label : null}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            disabled={action.isDisabled || pendingActionId != null}
            onClick={() => trigger(action)}
          >
            <Download />
            <span>{action.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function clickDownload(href: string, fileName: string) {
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.download = fileName
  anchor.rel = "noreferrer"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function getSynchronousPayload(
  action: ViewerDownloadAction | null
): ViewerDownloadPayload | null {
  if (!action || action.isDisabled) return null
  const payload = action.getPayload()
  return payload instanceof Promise ? null : payload
}

function reportDownloadError(
  error: unknown,
  action: ViewerDownloadAction,
  onError: ViewerDownloadErrorHandler | undefined
) {
  if (!(error instanceof ViewerDownloadError)) return
  if (error.kind === "aborted") return
  onError?.(error, action)
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}
