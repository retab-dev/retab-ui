"use client"

import * as React from "react"
import { FileText, Layers3, Mail, Paperclip } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ViewerSource } from "@/lib/viewer-source"

import {
  buildMimeTree,
  collectInlineResourceParts,
  findMimeNodeByPath,
  getDefaultMimeSelectionPath,
  getInlineResourceScope,
  getMimeDisplayPart,
  messageIdentity,
  mimePartLabel,
  normalizeContentId,
} from "./email-viewer-model"
import type {
  EmailViewerMessage,
  EmailViewerProps,
  MimeDisplayPart,
  MimePartNode,
  MimePartPath,
} from "./email-viewer-types"
import { formatFileSize } from "./file-size-format"
import { FileThumbnail } from "./file-thumbnail"
import { FileViewer } from "./file-viewer"
import {
  EmbeddedSidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./sidebar"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "./viewer"

export type {
  EmailViewerMessage,
  EmailViewerProps,
  MimeDisplayPart,
  MimeHeader,
  MimeMessage,
  MimePart,
  MimePartDisposition,
  MimePartNode,
  MimePartPath,
} from "./email-viewer-types"

export {
  buildMimeTree,
  findMimeNodeByPath,
  getDefaultMimeSelectionPath,
  getInlineResourceScope,
  getMimeDisplayPart,
  replaceCidUrls,
} from "./email-viewer-model"

export interface EmailViewerProviderProps {
  message: EmailViewerMessage
  selectedPath?: MimePartPath | null
  defaultSelectedPath?: MimePartPath
  onSelectedPathChange?: (path: MimePartPath, node: MimePartNode) => void
  children: React.ReactNode
}

type EmailViewerContextValue = {
  display: MimeDisplayPart | null
  message: EmailViewerMessage
  rootNode: MimePartNode
  selectedNode: MimePartNode
  setSelectedNode: (node: MimePartNode) => void
}

const EmailViewerContext = React.createContext<EmailViewerContextValue | null>(
  null
)

export function useEmailViewer() {
  const context = React.useContext(EmailViewerContext)
  if (!context) {
    throw new Error("useEmailViewer must be used within EmailViewerProvider.")
  }
  return context
}

export function useEmailViewerHeader() {
  const { message } = useEmailViewer()
  return { message }
}

export function useEmailViewerPartsList() {
  const { rootNode, selectedNode, setSelectedNode } = useEmailViewer()
  return {
    rootNode,
    selectedPath: selectedNode.path,
    setSelectedNode,
  }
}

export function useEmailViewerSelectedPart() {
  const { display, message, selectedNode } = useEmailViewer()
  return {
    display,
    message,
    selectedNode,
  }
}

export function EmailViewerProvider({
  message,
  selectedPath,
  defaultSelectedPath,
  onSelectedPathChange,
  children,
}: EmailViewerProviderProps) {
  const rootNode = React.useMemo(
    () => buildMimeTree(message.root),
    [message.root]
  )
  const defaultPath = React.useMemo(
    () =>
      defaultSelectedPath && findMimeNodeByPath(rootNode, defaultSelectedPath)
        ? defaultSelectedPath
        : getDefaultMimeSelectionPath(rootNode),
    [defaultSelectedPath, rootNode]
  )
  const [internalSelectedPath, setInternalSelectedPath] =
    React.useState<MimePartPath>(defaultPath)
  const controlled = selectedPath !== undefined
  const activePath = controlled
    ? (selectedPath ?? defaultPath)
    : internalSelectedPath
  const selectedNode =
    findMimeNodeByPath(rootNode, activePath) ??
    findMimeNodeByPath(rootNode, defaultPath) ??
    rootNode

  React.useEffect(() => {
    if (controlled) return
    if (findMimeNodeByPath(rootNode, internalSelectedPath)) return
    setInternalSelectedPath(defaultPath)
  }, [controlled, defaultPath, internalSelectedPath, rootNode])

  const setSelectedNode = React.useCallback(
    (node: MimePartNode) => {
      if (!controlled) setInternalSelectedPath(node.path)
      onSelectedPathChange?.(node.path, node)
    },
    [controlled, onSelectedPathChange]
  )
  const inlineResourceUrls = useInlineMimeResourceUrls(
    getInlineResourceScope(selectedNode)
  )
  const display = React.useMemo(
    () => getMimeDisplayPart(selectedNode, inlineResourceUrls),
    [inlineResourceUrls, selectedNode]
  )
  const value = React.useMemo<EmailViewerContextValue>(
    () => ({
      display,
      message,
      rootNode,
      selectedNode,
      setSelectedNode,
    }),
    [display, message, rootNode, selectedNode, setSelectedNode]
  )

  return (
    <EmailViewerContext.Provider value={value}>
      {children}
    </EmailViewerContext.Provider>
  )
}

export function EmailViewer({
  message,
  selectedPath,
  defaultSelectedPath,
  onSelectedPathChange,
  className,
  bare = false,
}: EmailViewerProps) {
  return (
    <EmailViewerProvider
      message={message}
      selectedPath={selectedPath}
      defaultSelectedPath={defaultSelectedPath}
      onSelectedPathChange={onSelectedPathChange}
    >
      <div data-slot="email-viewer" className={cn("min-h-0", className)}>
        <ViewerRoot bare={bare} defaultSidebarOpen className="h-full">
          <EmailViewerHeader />
          <ViewerBody className="flex-col md:flex-row">
            <ViewerSurface className="min-h-[26rem] md:min-h-0">
              <EmailViewerSelectedPart />
            </ViewerSurface>
            <ViewerSidebar
              side="right"
              width="19rem"
              className="border-t md:border-t-0 md:border-l"
            >
              <EmailViewerPartsList />
            </ViewerSidebar>
          </ViewerBody>
        </ViewerRoot>
      </div>
    </EmailViewerProvider>
  )
}

export function EmailViewerHeader() {
  const { message } = useEmailViewerHeader()
  return <MimeMessageHeader message={message} />
}

export function EmailViewerPartsList() {
  const { rootNode, selectedPath, setSelectedNode } = useEmailViewerPartsList()
  return (
    <MimePartSidebar
      root={rootNode}
      selectedPath={selectedPath}
      onSelectNode={setSelectedNode}
    />
  )
}

export function EmailViewerSelectedPart() {
  const { display, message, selectedNode } = useEmailViewerSelectedPart()
  return (
    <MimeViewerContent
      message={message}
      selectedNode={selectedNode}
      display={display}
    />
  )
}

function MimeViewerContent({
  message,
  selectedNode,
  display,
}: {
  message: EmailViewerMessage
  selectedNode: MimePartNode
  display: MimeDisplayPart | null
}) {
  if (selectedNode.isMessage && selectedNode.children.length > 0) {
    return (
      <EmailViewer
        bare
        className="h-full"
        message={{
          id: `${messageIdentity(message)}:${selectedNode.part.id}`,
          headers: selectedNode.part.headers,
          subject: headerValue(selectedNode.part.headers, "subject"),
          from: headerValue(selectedNode.part.headers, "from"),
          to: headerValue(selectedNode.part.headers, "to"),
          sentAt: headerValue(selectedNode.part.headers, "date"),
          root: selectedNode.part,
        }}
      />
    )
  }

  if (!display) {
    return (
      <div className="flex size-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        This MIME part does not have a previewable body.
      </div>
    )
  }

  return (
    <FileViewer
      key={display.node.path.join("/")}
      source={display.source}
      as={display.category}
      bare
      className="size-full min-h-0"
    />
  )
}

function MimeMessageHeader({ message }: { message: EmailViewerMessage }) {
  const subject = message.subject?.trim() || "(no subject)"
  const recipients = normalizeAddressList(message.to)
  const sentAt = formatSentAt(message.sentAt)

  return (
    <ViewerHeader className="px-3 py-2">
      <div
        data-slot="email-message-header"
        className="flex min-h-0 flex-col gap-1"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Mail className="size-4 flex-shrink-0 text-muted-foreground" />
          <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
            {subject}
          </h2>
          <ViewerSidebarTrigger side="right" className="-mr-1" />
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
    </ViewerHeader>
  )
}

function MimePartSidebar({
  root,
  selectedPath,
  onSelectNode,
  className,
}: {
  root: MimePartNode
  selectedPath: MimePartPath
  onSelectNode: (node: MimePartNode) => void
  className?: string
}) {
  const { bodyNodes, attachmentNodes } = React.useMemo(
    () => getSidebarSections(root),
    [root]
  )
  const partCount = bodyNodes.length + attachmentNodes.length

  return (
    <EmbeddedSidebarProvider
      width="19rem"
      className="h-72 bg-transparent md:h-full md:w-(--sidebar-width)"
    >
      <Sidebar
        side="left"
        collapsible="none"
        data-slot="mime-part-sidebar"
        className={cn(
          "h-full w-full border-sidebar-border bg-background md:border-r",
          className
        )}
      >
        <SidebarHeader className="border-b px-3 py-2">
          <div className="flex h-6 items-center gap-2 text-xs font-medium text-sidebar-foreground">
            <Paperclip className="size-3.5 text-sidebar-accent-foreground" />
            <span>
              {partCount} item{partCount === 1 ? "" : "s"}
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Body</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {bodyNodes.map((node) => (
                  <MimePartSidebarItem
                    key={node.path.join("/")}
                    label="Body"
                    node={node}
                    selectedPath={selectedPath}
                    onSelectNode={onSelectNode}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="min-h-0 flex-1">
            <SidebarGroupLabel>Attachments</SidebarGroupLabel>
            <SidebarGroupContent>
              {attachmentNodes.length === 0 ? (
                <p className="px-2 py-3 text-xs text-sidebar-foreground/70">
                  No attachments.
                </p>
              ) : (
                <SidebarMenu className="gap-1">
                  {attachmentNodes.map((node) => (
                    <MimePartSidebarItem
                      key={node.path.join("/")}
                      node={node}
                      selectedPath={selectedPath}
                      onSelectNode={onSelectNode}
                    />
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </EmbeddedSidebarProvider>
  )
}

function getSidebarSections(root: MimePartNode): {
  bodyNodes: MimePartNode[]
  attachmentNodes: MimePartNode[]
} {
  const attachmentNodes: MimePartNode[] = []

  walkMimeNodes(root, (node) => {
    if (node.isMultipart) return
    if (node.isInlineResource) return
    if (node.isAttachment || node.isMessage) {
      attachmentNodes.push(node)
      return
    }
  })

  const bodyNode = getBodyNode(root)
  const bodyNodes = bodyNode ? [bodyNode] : [root]
  return { attachmentNodes, bodyNodes }
}

function getBodyNode(root: MimePartNode) {
  const candidates: MimePartNode[] = []

  walkMimeNodes(root, (node) => {
    if (!node.isRenderable) return
    if (node.isInlineResource || node.isAttachment || node.isMessage) return
    candidates.push(node)
  })

  return (
    candidates.find(
      (node) => normalizedMimeType(node.part.mimeType) === "text/html"
    ) ??
    candidates.find(
      (node) => normalizedMimeType(node.part.mimeType) === "text/plain"
    ) ??
    candidates[0] ??
    null
  )
}

function MimePartSidebarItem({
  label,
  node,
  selectedPath,
  onSelectNode,
}: {
  label?: string
  node: MimePartNode
  selectedPath: MimePartPath
  onSelectNode: (node: MimePartNode) => void
}) {
  const isSelected = pathsEqual(node.path, selectedPath)
  const canRenderThumbnail = Boolean(node.part.source && !node.isInlineResource)
  const meta = sidebarMeta(node)
  const title = label ?? mimePartLabel(node.part)

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-current={isSelected ? "page" : undefined}
          aria-label={`${title} ${meta}`}
          className="h-auto items-center gap-3 rounded-lg border border-transparent p-2 data-[active=true]:border-sidebar-border"
          isActive={isSelected}
          onClick={() => onSelectNode(node)}
        >
          {canRenderThumbnail && node.part.source ? (
            <FileThumbnail
              source={node.part.source}
              presentation="decorative"
              className="size-12 flex-shrink-0"
              previewAspectRatio={1}
            />
          ) : (
            <span className="flex size-12 flex-shrink-0 items-center justify-center rounded-md text-sidebar-accent-foreground">
              <PartIcon node={node} className="size-4" />
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm font-medium">{title}</span>
            <span className="truncate text-xs text-sidebar-foreground/70">
              {meta}
            </span>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  )
}

function PartIcon({
  node,
  className,
}: {
  node: MimePartNode
  className?: string
}) {
  if (node.isMultipart || node.isMessage) {
    return <Layers3 className={className} aria-hidden />
  }
  if (node.isAttachment) {
    return <Paperclip className={className} aria-hidden />
  }
  return <FileText className={className} aria-hidden />
}

function useInlineMimeResourceUrls(node: MimePartNode) {
  const inlineParts = React.useMemo(
    () => collectInlineResourceParts(node),
    [node]
  )
  const [urls, setUrls] = React.useState<ReadonlyMap<string, string>>(
    () => new Map()
  )

  React.useEffect(() => {
    const nextUrls = new Map<string, string>()
    const objectUrls: string[] = []

    for (const inlinePart of inlineParts) {
      const cid = normalizeContentId(inlinePart.part.contentId)
      const source = inlinePart.part.source
      if (!cid || !source) continue

      const url = sourceToInlineUrl(source, objectUrls)
      if (url) nextUrls.set(cid, url)
    }

    setUrls(nextUrls)

    return () => {
      for (const url of objectUrls) URL.revokeObjectURL(url)
    }
  }, [inlineParts])

  return urls
}

function sourceToInlineUrl(source: ViewerSource, objectUrls: string[]) {
  if (source.kind === "url") return source.url
  if (source.kind === "blob") {
    const url = URL.createObjectURL(source.blob)
    objectUrls.push(url)
    return url
  }

  return textSourceToDataUrl(source.text, source.mimeType)
}

function textSourceToDataUrl(text: string, mimeType: string | undefined) {
  const bytes = new TextEncoder().encode(text)
  const chunkSize = 0x8000
  let binary = ""
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return `data:${mimeType ?? "text/plain;charset=utf-8"};base64,${btoa(binary)}`
}

function sidebarMeta(node: MimePartNode) {
  if (node.part.size != null) {
    return `${node.part.mimeType} · ${formatFileSize(node.part.size)}`
  }
  if (node.isInlineResource) return `${node.part.mimeType} · inline`
  if (node.isAttachment) return `${node.part.mimeType} · attachment`
  return node.part.mimeType
}

function walkMimeNodes(
  node: MimePartNode,
  visit: (node: MimePartNode) => void
) {
  visit(node)
  for (const child of node.children) walkMimeNodes(child, visit)
}

function pathsEqual(left: MimePartPath, right: MimePartPath) {
  if (left.length !== right.length) return false
  return left.every((part, index) => part === right[index])
}

function normalizedMimeType(mimeType: string) {
  return mimeType.toLowerCase().split(";")[0].trim()
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

function headerValue(
  headers: readonly { name: string; value: string }[] | undefined,
  name: string
) {
  return (
    headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())
      ?.value ?? null
  )
}
