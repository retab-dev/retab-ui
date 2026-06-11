"use client"

import * as React from "react"

import { getText } from "@/components/document-thumbnail/cache"
import { IframeDoc } from "@/components/document-thumbnail/renderers/layout"

export function HtmlFirstPage({
  src,
  resourceKey,
}: {
  src: string
  resourceKey: string
}) {
  const html = React.use(getText(src, resourceKey))
  return <IframeDoc html={html} />
}
