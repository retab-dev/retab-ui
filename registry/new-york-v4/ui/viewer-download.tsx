"use client"

import * as React from "react"

import { type DownloadCapability } from "@/lib/viewer-resource"

export function useDownloadHref(download: DownloadCapability): string | null {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null)
  const downloadKind = download.kind
  const href = download.kind === "href" ? download.href : null
  const blob = download.kind === "blob" ? download.blob : null
  const text = download.kind === "text" ? download.text : null
  const mimeType = download.kind === "text" ? download.mimeType : null

  React.useEffect(() => {
    if (downloadKind === "href" || downloadKind === "none") {
      setObjectUrl(null)
      return
    }

    const url = URL.createObjectURL(
      blob ??
        new Blob([text ?? ""], {
          type: mimeType ?? "text/plain;charset=utf-8",
        })
    )
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [blob, downloadKind, mimeType, text])

  return href ?? objectUrl
}

export function ViewerDownloadAnchor({
  download,
  label = "Download",
}: {
  download: DownloadCapability
  label?: string
}) {
  const href = useDownloadHref(download)
  if (!href) return <a aria-label={label} aria-disabled="true" />
  return (
    <a
      href={href}
      download={download.fileName}
      aria-label={label}
      title={label}
    />
  )
}
