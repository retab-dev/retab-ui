import type { FileCategory, ViewerSource } from "@/lib/viewer-source"

import type {
  MimeDisplayPart,
  MimeMessage,
  MimePart,
  MimePartNode,
  MimePartPath,
} from "./email-viewer-types"

export function buildMimeTree(root: MimePart): MimePartNode {
  return buildMimeNode(root, [], null, 0)
}

export function findMimeNodeByPath(
  root: MimePartNode,
  path: MimePartPath
): MimePartNode | null {
  if (pathsEqual(root.path, path)) return root
  for (const child of root.children) {
    const match = findMimeNodeByPath(child, path)
    if (match) return match
  }
  return null
}

export function getDefaultMimeSelectionPath(root: MimePartNode): MimePartPath {
  return (findDefaultDisplayNode(root) ?? root).path
}

export function getMimeDisplayPart(
  node: MimePartNode,
  inlineResourceUrls: ReadonlyMap<string, string>
): MimeDisplayPart | null {
  const displayNode = findDefaultDisplayNode(node)
  if (!displayNode?.part.source) return null

  const source =
    displayNode.part.source.kind === "text" && isHtmlMime(displayNode.part)
      ? {
          ...displayNode.part.source,
          text: replaceCidUrls(
            displayNode.part.source.text,
            inlineResourceUrls
          ),
        }
      : displayNode.part.source

  return {
    category: categoryForMimePart(displayNode.part),
    inlineResourceUrls,
    node: displayNode,
    source,
  }
}

export function collectInlineResourceParts(
  node: MimePartNode
): readonly MimePartNode[] {
  const resources: MimePartNode[] = []
  walkMimeTree(node, (current) => {
    if (current.isInlineResource && current.part.source) {
      resources.push(current)
    }
  })
  return resources
}

export function getInlineResourceScope(node: MimePartNode): MimePartNode {
  let current: MimePartNode | null = node
  while (current) {
    if (isRelatedMultipart(current.part.mimeType)) return current
    current = current.parent
  }
  return node
}

export function normalizeContentId(contentId: string | null | undefined) {
  const trimmed = contentId?.trim()
  if (!trimmed) return null
  return trimmed.replace(/^<|>$/g, "").toLowerCase()
}

export function replaceCidUrls(
  html: string,
  inlineUrls: ReadonlyMap<string, string>
) {
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

export function mimePartLabel(part: MimePart): string {
  const fileName = part.fileName?.trim()
  if (fileName) return fileName
  if (isMultipartMime(part.mimeType)) return multipartLabel(part.mimeType)
  if (isMessageMime(part.mimeType)) return "Message"
  if (part.mimeType === "text/html") return "HTML body"
  if (part.mimeType === "text/plain") return "Text body"
  return part.mimeType || "MIME part"
}

export function mimePartDescription(part: MimePart): string {
  const pieces = [
    part.mimeType || null,
    part.disposition?.trim() || null,
    part.contentId ? `cid:${normalizeContentId(part.contentId)}` : null,
  ].filter(Boolean)
  return pieces.join(" · ")
}

export function categoryForMimePart(part: MimePart): FileCategory | undefined {
  const mime = normalizedMimeType(part.mimeType)
  if (mime === "text/html") return "html"
  if (mime === "text/plain") return "text"
  if (mime === "text/markdown") return "markdown"
  return undefined
}

export function messageIdentity(message: MimeMessage): string {
  return message.id ?? message.root.id
}

function buildMimeNode(
  part: MimePart,
  parentPath: readonly string[],
  parent: MimePartNode | null,
  depth: number
): MimePartNode {
  const path = [...parentPath, part.id]
  const disposition = part.disposition?.toLowerCase() ?? null
  const node: Omit<MimePartNode, "children"> = {
    depth,
    isAttachment: disposition === "attachment",
    isInlineResource: Boolean(
      part.contentId && disposition !== "attachment" && part.source
    ),
    isMessage: isMessageMime(part.mimeType),
    isMultipart: isMultipartMime(part.mimeType),
    isRenderable: Boolean(part.source),
    parent,
    part,
    path,
  }
  const fullNode: MimePartNode = {
    ...node,
    children: (part.children ?? []).map((child) =>
      buildMimeNode(child, path, null, depth + 1)
    ),
  }

  return {
    ...fullNode,
    children: fullNode.children.map((child) =>
      reparentMimeNode(child, fullNode)
    ),
  }
}

function reparentMimeNode(
  node: MimePartNode,
  parent: MimePartNode
): MimePartNode {
  const next: MimePartNode = {
    ...node,
    parent,
  }
  return {
    ...next,
    children: next.children.map((child) => reparentMimeNode(child, next)),
  }
}

function findDefaultDisplayNode(node: MimePartNode): MimePartNode | null {
  if (node.isRenderable && !node.isInlineResource) return node
  if (!node.children.length) return null

  const mime = normalizedMimeType(node.part.mimeType)
  if (mime === "multipart/alternative") {
    return (
      findFirstRenderableOfMime(node, "text/html") ??
      findFirstRenderableOfMime(node, "text/plain") ??
      findFirstRenderableChild(node)
    )
  }
  if (mime === "multipart/related") {
    return (
      findFirstRenderableOfMime(node, "text/html") ??
      findFirstRenderableOfMime(node, "text/plain") ??
      findFirstRenderableChild(node)
    )
  }
  if (node.isMessage) return findFirstRenderableChild(node)
  return findFirstRenderableChild(node)
}

function findFirstRenderableOfMime(
  node: MimePartNode,
  mimeType: string
): MimePartNode | null {
  for (const child of node.children) {
    if (
      normalizedMimeType(child.part.mimeType) === mimeType &&
      child.isRenderable &&
      !child.isInlineResource
    ) {
      return child
    }
    const match = findFirstRenderableOfMime(child, mimeType)
    if (match) return match
  }
  return null
}

function findFirstRenderableChild(node: MimePartNode): MimePartNode | null {
  for (const child of node.children) {
    const match = findDefaultDisplayNode(child)
    if (match) return match
  }
  return null
}

function walkMimeTree(node: MimePartNode, visit: (node: MimePartNode) => void) {
  visit(node)
  for (const child of node.children) walkMimeTree(child, visit)
}

function pathsEqual(left: MimePartPath, right: MimePartPath) {
  if (left.length !== right.length) return false
  return left.every((part, index) => part === right[index])
}

function decodeCid(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isHtmlMime(part: MimePart) {
  return normalizedMimeType(part.mimeType) === "text/html"
}

function isMultipartMime(mimeType: string) {
  return normalizedMimeType(mimeType).startsWith("multipart/")
}

function isRelatedMultipart(mimeType: string) {
  return normalizedMimeType(mimeType) === "multipart/related"
}

function isMessageMime(mimeType: string) {
  const mime = normalizedMimeType(mimeType)
  return mime === "message/rfc822" || mime === "message/global"
}

function normalizedMimeType(mimeType: string) {
  return mimeType.toLowerCase().split(";")[0].trim()
}

function multipartLabel(mimeType: string) {
  const subtype = normalizedMimeType(mimeType).split("/")[1]
  if (!subtype) return "Multipart"
  return `Multipart ${subtype}`
}
