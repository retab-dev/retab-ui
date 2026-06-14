"use client"

import * as React from "react"
import { FileText, Layers3, Mail, Paperclip } from "lucide-react"

import { cn } from "@/lib/utils"

import { useEmailInlineResourceUrls } from "./email-viewer-inline-resources"
import {
  buildMimeTree,
  deriveEmailInlineResourceScope,
  deriveEmailViewerModel,
  findMimeNodeByPath,
  getDefaultMimeSelectionPath,
} from "./email-viewer-model"
import type {
  EmailAddress,
  EmailContentModel,
  EmailHeaderModel,
  EmailSidebarItem,
  EmailSidebarModel,
  EmailViewerMessage,
  EmailViewerModel,
  EmailViewerProps,
  EmailViewerProviderProps,
  MimePartNode,
  MimePartPath,
} from "./email-viewer-types"
import { FileThumbnail } from "./file-thumbnail"
import { FileViewer } from "./file-viewer"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "./viewer"

export type {
  EmailAddress,
  EmailAttachmentSidebarItem,
  EmailBodySelectionPolicy,
  EmailBodySidebarItem,
  EmailContentEmpty,
  EmailContentEmptyReason,
  EmailContentFile,
  EmailContentModel,
  EmailContentNestedMessage,
  EmailFilePayload,
  EmailHeaderModel,
  EmailInlineResource,
  EmailInlineResourceKey,
  EmailInlineResourceScope,
  EmailSidebarItemBase,
  EmailSidebarItem,
  EmailSidebarModel,
  EmailSidebarSection,
  EmailSidebarThumbnailModel,
  EmailViewerMessage,
  EmailViewerModel,
  EmailViewerProviderProps,
  EmailViewerProps,
  MimeHeader,
  MimeMessage,
  MimeMessageScope,
  MimePart,
  MimePartDisposition,
  MimePartFacts,
  MimePartKind,
  MimePartNode,
  MimePartPath,
  MimePreviewPolicy,
} from "./email-viewer-types"

export {
  buildMimeTree,
  categoryForMimeNode,
  createMimeMessageScope,
  DEFAULT_EMAIL_BODY_SELECTION_POLICY,
  deriveEmailContentModel,
  deriveEmailHeaderModel,
  deriveEmailInlineResourceScope,
  deriveEmailSidebarModel,
  deriveEmailViewerModel,
  findMimeNodeByPath,
  getDefaultMimeSelectionPath,
  getInlineResourceScope,
  inlineResourceKeyToString,
  isAttachmentNode,
  isInlineResourceNode,
  isMessageNode,
  isMultipartNode,
  isRenderableNode,
  normalizeContentId,
  normalizeContentLocation,
  pathsEqual,
  replaceCidUrls,
  replaceInlineResourceUrls,
} from "./email-viewer-model"

const DEFAULT_MAX_NESTED_MESSAGE_DEPTH = 8

type EmailViewerContextValue = {
  model: EmailViewerModel
  selectPart: (node: MimePartNode) => void
}

type EmailViewerProviderInternalProps = EmailViewerProviderProps & {
  nestedMessageDepth?: number
}

type EmailViewerInternalProps = EmailViewerProps & {
  nestedMessageDepth?: number
}

type EmailViewerChromeProps = Pick<EmailViewerInternalProps, "bare" | "className">

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

export function useEmailHeader(): EmailHeaderModel {
  return useEmailViewer().model.header
}

export function useEmailPartsSidebar(): {
  sidebar: EmailSidebarModel
  selectPart: (node: MimePartNode) => void
} {
  const { model, selectPart } = useEmailViewer()

  return {
    sidebar: model.sidebar,
    selectPart,
  }
}

export function useEmailContent(): EmailContentModel {
  return useEmailViewer().model.content
}

export function EmailViewerProvider(props: EmailViewerProviderProps) {
  return <EmailViewerProviderInternal {...props} nestedMessageDepth={0} />
}

function EmailViewerProviderInternal({
  message,
  selectedPath,
  defaultSelectedPath,
  onSelectedPathChange,
  maxNestedMessageDepth = DEFAULT_MAX_NESTED_MESSAGE_DEPTH,
  nestedMessageDepth = 0,
  children,
}: EmailViewerProviderInternalProps) {
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
  const inlineResourceScope = React.useMemo(
    () => deriveEmailInlineResourceScope(rootNode, selectedNode),
    [rootNode, selectedNode]
  )
  const inlineResourceUrls = useEmailInlineResourceUrls(inlineResourceScope)

  React.useEffect(() => {
    if (controlled) return
    if (findMimeNodeByPath(rootNode, internalSelectedPath)) return
    setInternalSelectedPath(defaultPath)
  }, [controlled, defaultPath, internalSelectedPath, rootNode])

  const selectPart = React.useCallback(
    (node: MimePartNode) => {
      if (!controlled) setInternalSelectedPath(node.path)
      onSelectedPathChange?.(node.path, node)
    },
    [controlled, onSelectedPathChange]
  )
  const model = React.useMemo(
    () =>
      deriveEmailViewerModel({
        inlineResourceUrls,
        maxNestedMessageDepth,
        message,
        nestedMessageDepth,
        rootNode,
        selectedNode,
      }),
    [
      inlineResourceUrls,
      maxNestedMessageDepth,
      message,
      nestedMessageDepth,
      rootNode,
      selectedNode,
    ]
  )
  const value = React.useMemo<EmailViewerContextValue>(
    () => ({ model, selectPart }),
    [model, selectPart]
  )

  return (
    <EmailViewerContext.Provider value={value}>
      {children}
    </EmailViewerContext.Provider>
  )
}

export function EmailViewer(props: EmailViewerProps) {
  return <EmailViewerInternal {...props} nestedMessageDepth={0} />
}

function EmailViewerInternal({
  message,
  selectedPath,
  defaultSelectedPath,
  onSelectedPathChange,
  maxNestedMessageDepth,
  nestedMessageDepth = 0,
  className,
  bare = false,
}: EmailViewerInternalProps) {
  if (nestedMessageDepth === 0) {
    return (
      <EmailViewerProvider
        message={message}
        selectedPath={selectedPath}
        defaultSelectedPath={defaultSelectedPath}
        onSelectedPathChange={onSelectedPathChange}
        maxNestedMessageDepth={maxNestedMessageDepth}
      >
        <EmailViewerChrome bare={bare} className={className} />
      </EmailViewerProvider>
    )
  }

  return (
    <EmailViewerProviderInternal
      message={message}
      selectedPath={selectedPath}
      defaultSelectedPath={defaultSelectedPath}
      onSelectedPathChange={onSelectedPathChange}
      maxNestedMessageDepth={maxNestedMessageDepth}
      nestedMessageDepth={nestedMessageDepth}
    >
      <EmailViewerChrome bare={bare} className={className} />
    </EmailViewerProviderInternal>
  )
}

function EmailViewerChrome({ bare = false, className }: EmailViewerChromeProps) {
  return (
    <div data-slot="email-viewer" className={cn("min-h-0", className)}>
      <ViewerRoot bare={bare} defaultOpen sidebarSide="right" className="h-full">
        <EmailHeader />
        <ViewerBody className="flex-col md:flex-row">
          <ViewerSurface className="min-h-[26rem] md:min-h-0">
            <EmailContent />
          </ViewerSurface>
          <ViewerSidebar
            aria-label="Email parts"
            width="19rem"
            className="border-t md:border-t-0 md:border-l"
          >
            <EmailPartsSidebar />
          </ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>
    </div>
  )
}

export function EmailHeader() {
  return <MimeMessageHeader header={useEmailHeader()} />
}

export function EmailPartsSidebar() {
  const { sidebar, selectPart } = useEmailPartsSidebar()

  return <MimePartSidebar sidebar={sidebar} onSelectPart={selectPart} />
}

export function EmailContent() {
  const content = useEmailContent()

  if (content.kind === "nested-message") {
    return (
      <EmailViewerInternal
        bare
        className="h-full"
        message={content.message}
        maxNestedMessageDepth={content.maxNestedMessageDepth}
        nestedMessageDepth={content.nestedMessageDepth}
      />
    )
  }

  if (content.kind === "empty") {
    return (
      <div className="flex size-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {content.message}
      </div>
    )
  }

  return (
    <FileViewer
      key={content.node.path.join("/")}
      source={content.file.source}
      as={content.file.category}
      bare
      className="size-full min-h-0"
    />
  )
}

function MimeMessageHeader({ header }: { header: EmailHeaderModel }) {
  const from = formatEmailAddresses(header.from)
  const to = formatEmailAddresses(header.to)

  return (
    <ViewerHeader className="px-3 py-2">
      <div
        data-slot="email-message-header"
        className="flex min-h-0 flex-col gap-1"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Mail className="size-4 flex-shrink-0 text-muted-foreground" />
          <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
            {header.subject}
          </h2>
          <ViewerSidebarTrigger className="-mr-1" />
        </div>
        <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 pl-6 text-xs text-muted-foreground">
          {from ? <span className="min-w-0 truncate">From {from}</span> : null}
          {to ? <span className="min-w-0 truncate">To {to}</span> : null}
          {header.sentAt ? (
            <span className="tabular-nums">{header.sentAt}</span>
          ) : null}
        </div>
      </div>
    </ViewerHeader>
  )
}

function MimePartSidebar({
  sidebar,
  onSelectPart,
  className,
}: {
  sidebar: EmailSidebarModel
  onSelectPart: (node: MimePartNode) => void
  className?: string
}) {
  return (
    <div
      data-slot="mime-part-sidebar"
      className={cn(
        "flex h-full min-h-0 flex-col bg-background text-foreground",
        className
      )}
    >
      <div className="flex-shrink-0 border-b px-3 py-2">
        <div className="flex h-6 items-center gap-2 text-xs font-medium">
          <Paperclip className="size-3.5 text-muted-foreground" />
          <span>
            {sidebar.attachmentCount} attachment
            {sidebar.attachmentCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
        {sidebar.sections.map((section) => (
          <MimePartSidebarSection key={section.id} title={section.title}>
            {section.items.length === 0 ? (
              section.emptyLabel ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  {section.emptyLabel}
                </p>
              ) : null
            ) : (
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <MimePartSidebarItem
                    key={item.id}
                    item={item}
                    onSelectPart={onSelectPart}
                  />
                ))}
              </ul>
            )}
          </MimePartSidebarSection>
        ))}
      </div>
    </div>
  )
}

function formatEmailAddresses(addresses: readonly EmailAddress[]) {
  return addresses.map((address) => address.display).join(", ") || null
}

function MimePartSidebarSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const titleId = React.useId()

  return (
    <section
      aria-labelledby={titleId}
      data-slot="mime-part-sidebar-section"
      className="min-w-0"
    >
      <h3
        id={titleId}
        className="flex h-8 shrink-0 items-center px-2 text-xs font-medium text-muted-foreground"
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

function MimePartSidebarItem({
  item,
  onSelectPart,
}: {
  item: EmailSidebarItem
  onSelectPart: (node: MimePartNode) => void
}) {
  return (
    <li data-slot="mime-part-sidebar-item">
      <button
        type="button"
        aria-current={item.isSelected ? "page" : undefined}
        aria-label={`${item.title} ${item.description}`}
        data-selected={item.isSelected ? "true" : "false"}
        className={cn(
          "flex h-auto w-full items-center gap-3 overflow-hidden rounded-lg border p-2 text-left text-sm outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring active:bg-accent",
          item.isSelected
            ? "border-border bg-accent text-accent-foreground"
            : "border-transparent"
        )}
        onClick={() => onSelectPart(item.node)}
      >
        <SidebarItemThumbnail item={item} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium">{item.title}</span>
          <span
            className={cn(
              "truncate text-xs",
              item.isSelected
                ? "text-accent-foreground/80"
                : "text-muted-foreground"
            )}
          >
            {item.description}
          </span>
        </span>
      </button>
    </li>
  )
}

function SidebarItemThumbnail({ item }: { item: EmailSidebarItem }) {
  if (item.thumbnail.kind === "file") {
    return (
      <FileThumbnail
        source={item.thumbnail.source}
        presentation="decorative"
        className="size-12 flex-shrink-0"
        previewAspectRatio={item.thumbnail.aspectRatio}
      />
    )
  }

  return (
    <span
      className={cn(
        "flex size-12 flex-shrink-0 items-center justify-center rounded-md bg-muted/60",
        item.isSelected ? "text-accent-foreground" : "text-muted-foreground"
      )}
    >
      <PartIcon icon={item.thumbnail.icon} className="size-4" />
    </span>
  )
}

function PartIcon({
  icon,
  className,
}: {
  icon: "file" | "layers" | "mail" | "paperclip"
  className?: string
}) {
  if (icon === "layers") return <Layers3 className={className} aria-hidden />
  if (icon === "mail") return <Mail className={className} aria-hidden />
  if (icon === "paperclip") {
    return <Paperclip className={className} aria-hidden />
  }
  return <FileText className={className} aria-hidden />
}
