"use client"

import * as React from "react"

export function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }

    const nextUrl = URL.createObjectURL(blob)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [blob])

  return url
}
