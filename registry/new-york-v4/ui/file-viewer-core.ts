import {
  detectCategory,
  extensionOf,
  extractName,
  resolveViewerDescriptor,
  type FileCategory,
  type ViewerDescriptor,
  type ViewerSource,
} from "@/lib/viewer-source"

import type { ViewerSlots } from "./viewer-slots"

export type { FileCategory, ViewerSource }

export interface FileViewerProps {
  source: ViewerSource
  as?: FileCategory
  className?: string
  bare?: boolean
  isolateStyles?: boolean
  slots?: ViewerSlots
}

export type FileDescriptor = ViewerDescriptor

export function resolveFileDescriptor({
  source,
  as,
}: FileViewerProps): FileDescriptor {
  return resolveViewerDescriptor({
    source,
    category: as,
  })
}

export function descriptorResetKey(descriptor: FileDescriptor): string {
  return [
    descriptor.identityKey,
    descriptor.displayName,
    descriptor.mimeType ?? "",
    descriptor.category,
  ].join("\u0000")
}

export function isProseTextDescriptor(descriptor: FileDescriptor): boolean {
  if (descriptor.category !== "text") return false

  const extension = extensionOf(descriptor.fileName)
  if (extension === "txt" || extension === "text") return true
  return !extension && descriptor.mimeType?.toLowerCase() === "text/plain"
}

export { detectCategory, extensionOf, extractName }

export async function timed<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const on =
    typeof globalThis !== "undefined" &&
    (globalThis as { __FILE_VIEWER_PROFILE__?: boolean })
      .__FILE_VIEWER_PROFILE__
  if (!on) return fn()
  const t0 = performance.now()
  try {
    return await fn()
  } finally {
    console.log(
      `[file-viewer] ${label} ${(performance.now() - t0).toFixed(1)}ms`
    )
  }
}
