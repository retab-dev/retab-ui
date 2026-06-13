import type { FileCategory, ViewerSource } from "@/lib/viewer-source"

export type MimePartDisposition = "inline" | "attachment" | string

export type MimeHeader = {
  name: string
  value: string
}

export type MimePart = {
  id: string
  mimeType: string
  headers?: readonly MimeHeader[]
  fileName?: string | null
  disposition?: MimePartDisposition | null
  contentId?: string | null
  size?: number | null
  source?: ViewerSource
  children?: readonly MimePart[]
}

export type MimeMessage = {
  id?: string
  headers?: readonly MimeHeader[]
  subject?: string | null
  from?: string | null
  to?: string | readonly string[] | null
  cc?: string | readonly string[] | null
  bcc?: string | readonly string[] | null
  sentAt?: string | Date | null
  root: MimePart
}

export type MimePartPath = readonly string[]

export type MimePartNode = {
  part: MimePart
  path: MimePartPath
  depth: number
  parent: MimePartNode | null
  children: readonly MimePartNode[]
  isMultipart: boolean
  isMessage: boolean
  isRenderable: boolean
  isAttachment: boolean
  isInlineResource: boolean
}

export type MimeDisplayPart = {
  node: MimePartNode
  source: ViewerSource
  category?: FileCategory
  inlineResourceUrls?: ReadonlyMap<string, string>
}

export type EmailViewerMessage = MimeMessage

export type EmailViewerProps = {
  message: EmailViewerMessage
  selectedPath?: MimePartPath
  defaultSelectedPath?: MimePartPath
  onSelectedPathChange?: (path: MimePartPath, node: MimePartNode) => void
  className?: string
  bare?: boolean
}
