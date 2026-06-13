"use client"

import * as React from "react"
import { FileText, Mail } from "lucide-react"

import { cn } from "@/lib/utils"
import { createViewerResource } from "@/lib/viewer-resource"
import type { ViewerSource } from "@/lib/viewer-source"

import {
  AttachmentSidebar,
  type AttachmentSidebarItem,
} from "./attachment-sidebar"
import { FileViewer } from "./file-viewer"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./sidebar"
import { ViewerShell } from "./viewer-shell"

export interface EmailViewerAttachment {
  id: string
  source: ViewerSource
  contentId?: string | null
  contentDisposition?: "inline" | "attachment" | string | null
  isInline?: boolean
  size?: number | null
}

export interface EmailViewerMessage {
  id?: string
  subject?: string | null
  from?: string | null
  to?: string | readonly string[] | null
  sentAt?: string | Date | null
  htmlBody?: string | null
  textBody?: string | null
  attachments?: readonly EmailViewerAttachment[]
}

export interface EmailViewerProps {
  message: EmailViewerMessage
  className?: string
  bodyFileName?: string
}

type Selection = { kind: "body" } | { kind: "attachment"; attachmentId: string }

const EMPTY_ATTACHMENTS: readonly EmailViewerAttachment[] = []

export function EmailViewer({
  message,
  className,
  bodyFileName = "message",
}: EmailViewerProps) {
  const attachments = message.attachments ?? EMPTY_ATTACHMENTS
  const inlineAttachments = React.useMemo(
    () => attachments.filter(isInlineAttachment),
    [attachments]
  )
  const sidebarAttachments = React.useMemo(
    () => attachments.filter((attachment) => !isInlineAttachment(attachment)),
    [attachments]
  )
  const [selection, setSelection] = React.useState<Selection>({
    kind: "body",
  })

  React.useEffect(() => {
    if (selection.kind === "body") return
    if (
      sidebarAttachments.some(
        (attachment) => attachment.id === selection.attachmentId
      )
    ) {
      return
    }
    setSelection({ kind: "body" })
  }, [selection, sidebarAttachments])

  const inlineUrls = useInlineAttachmentUrls(inlineAttachments)
  const bodySource = React.useMemo(
    () =>
      createEmailBodySource({
        message,
        fileName: bodyFileName,
        inlineUrls,
      }),
    [bodyFileName, inlineUrls, message]
  )
  const attachmentItems = React.useMemo<AttachmentSidebarItem[]>(
    () =>
      sidebarAttachments.map((attachment) => ({
        id: attachment.id,
        source: attachment.source,
        size: attachment.size,
      })),
    [sidebarAttachments]
  )
  const selectedAttachment =
    selection.kind === "attachment"
      ? (sidebarAttachments.find(
          (attachment) => attachment.id === selection.attachmentId
        ) ?? null)
      : null
  const selectedSource = selectedAttachment?.source ?? bodySource.source
  const selectedCategory = selectedAttachment ? undefined : bodySource.category
  const title =
    selection.kind === "attachment" && selectedAttachment
      ? attachmentFileName(selectedAttachment)
      : "Message body"
  const bodyFormat = bodySource.category === "html" ? "HTML" : "Text"

  return (
    <div data-slot="email-viewer" className={cn("min-h-0", className)}>
      <ViewerShell
        className="h-full"
        bodyClassName="flex-col md:flex-row"
        contentClassName="min-h-[26rem] p-3 md:min-h-0"
        slots={{
          header: <EmailHeader message={message} title={title} />,
          right: (
            <AttachmentSidebar
              items={attachmentItems}
              selectedId={
                selection.kind === "attachment" ? selection.attachmentId : null
              }
              onSelect={(attachmentId) =>
                setSelection({ kind: "attachment", attachmentId })
              }
              emptyLabel="No regular attachments."
              providerClassName="h-72 md:h-full md:w-(--sidebar-width)"
              className="border-t md:border-t-0"
            >
              <EmailBodySidebarGroup
                bodyFormat={bodyFormat}
                isBodySelected={selection.kind === "body"}
                onSelectBody={() => setSelection({ kind: "body" })}
              />
            </AttachmentSidebar>
          ),
        }}
      >
        <FileViewer
          key={
            selectedAttachment
              ? `attachment:${selectedAttachment.id}`
              : bodySource.key
          }
          source={selectedSource}
          as={selectedCategory}
          bare
          className="h-full rounded-lg border"
        />
      </ViewerShell>
    </div>
  )
}

function EmailHeader({
  message,
  title,
}: {
  message: EmailViewerMessage
  title: string
}) {
  const subject = message.subject?.trim() || "(no subject)"
  const recipients = normalizeAddressList(message.to)
  const sentAt = formatSentAt(message.sentAt)

  return (
    <div className="flex min-h-0 flex-shrink-0 flex-col gap-1 border-b bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Mail className="size-4 flex-shrink-0 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
          {subject}
        </h2>
        <span className="min-w-0 flex-shrink truncate text-xs text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 pl-6 text-xs text-muted-foreground">
        {message.from ? (
          <span className="min-w-0 truncate">From {message.from}</span>
        ) : null}
        {recipients ? (
          <span className="min-w-0 truncate">To {recipients}</span>
        ) : null}
        {sentAt ? <span className="tabular-nums">{sentAt}</span> : null}
      </div>
    </div>
  )
}

function EmailBodySidebarGroup({
  bodyFormat,
  isBodySelected,
  onSelectBody,
}: {
  bodyFormat: string
  isBodySelected: boolean
  onSelectBody: () => void
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Message</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              aria-current={isBodySelected ? "page" : undefined}
              aria-label="Message body"
              className="border border-transparent data-[active=true]:border-sidebar-border"
              isActive={isBodySelected}
              onClick={onSelectBody}
            >
              <FileText className="text-sidebar-accent-foreground" />
              <span className="min-w-0 flex-1 truncate">Message body</span>
              <SidebarMenuBadge>{bodyFormat}</SidebarMenuBadge>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function useInlineAttachmentUrls(
  inlineAttachments: readonly EmailViewerAttachment[]
) {
  const [urls, setUrls] = React.useState<ReadonlyMap<string, string>>(
    () => new Map()
  )

  React.useEffect(() => {
    const nextUrls = new Map<string, string>()
    const objectUrls: string[] = []

    for (const attachment of inlineAttachments) {
      const cid = normalizeContentId(attachment.contentId)
      if (!cid) continue

      const source = attachment.source
      if (source.kind === "url") {
        nextUrls.set(cid, source.url)
      } else if (source.kind === "blob") {
        const url = URL.createObjectURL(source.blob)
        objectUrls.push(url)
        nextUrls.set(cid, url)
      } else {
        const blob = new Blob([source.text], {
          type: source.mimeType ?? "text/plain;charset=utf-8",
        })
        const url = URL.createObjectURL(blob)
        objectUrls.push(url)
        nextUrls.set(cid, url)
      }
    }

    setUrls(nextUrls)

    return () => {
      for (const url of objectUrls) URL.revokeObjectURL(url)
    }
  }, [inlineAttachments])

  return urls
}

function createEmailBodySource({
  message,
  fileName,
  inlineUrls,
}: {
  message: EmailViewerMessage
  fileName: string
  inlineUrls: ReadonlyMap<string, string>
}) {
  const baseIdentity = message.id ?? "message"
  const htmlBody = message.htmlBody?.trim() ? message.htmlBody : null

  if (htmlBody) {
    const html = replaceCidUrls(htmlBody, inlineUrls)
    return {
      key: `body:html:${baseIdentity}:${html.length}`,
      category: "html" as const,
      source: {
        kind: "text" as const,
        text: html,
        fileName: `${fileName}.html`,
        mimeType: "text/html",
        identityKey: `email:${baseIdentity}:html`,
      },
    }
  }

  const text = message.textBody ?? ""
  return {
    key: `body:text:${baseIdentity}:${text.length}`,
    category: "text" as const,
    source: {
      kind: "text" as const,
      text: text || "No message body.",
      fileName: `${fileName}.txt`,
      mimeType: "text/plain",
      identityKey: `email:${baseIdentity}:text`,
    },
  }
}

function replaceCidUrls(html: string, inlineUrls: ReadonlyMap<string, string>) {
  if (inlineUrls.size === 0) return html
  return html.replace(
    /\bcid:(?:<([^>"'\s)]+)>|([^"'\s>)]+))/gi,
    (match, bracketedContentId, plainContentId) => {
      const rawContentId = bracketedContentId ?? plainContentId
      const cid = normalizeContentId(decodeCid(rawContentId))
      return cid ? (inlineUrls.get(cid) ?? match) : match
    }
  )
}

function decodeCid(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isInlineAttachment(attachment: EmailViewerAttachment) {
  if (attachment.isInline != null) return attachment.isInline
  if (attachment.contentDisposition?.toLowerCase() === "attachment") {
    return false
  }
  if (attachment.contentDisposition?.toLowerCase() === "inline") return true
  return Boolean(attachment.contentId)
}

function normalizeContentId(contentId: string | null | undefined) {
  const trimmed = contentId?.trim()
  if (!trimmed) return null
  return trimmed.replace(/^<|>$/g, "").toLowerCase()
}

function attachmentFileName(attachment: EmailViewerAttachment) {
  return createViewerResource(attachment.source).fileName
}

function normalizeAddressList(
  value: string | readonly string[] | null | undefined
) {
  if (typeof value === "string") return value.trim() || null
  if (value) return value.filter(Boolean).join(", ")
  return null
}

function formatSentAt(value: string | Date | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
