"use client"

import { FileSystem, type FileSystemItem } from "@/registry/new-york-v4/ui/file-system"

const ITEMS: FileSystemItem[] = [
  {
    kind: "folder",
    path: "financials/",
    updatedAt: "2026-04-11T15:20:00Z",
  },
  {
    kind: "folder",
    path: "research/",
    updatedAt: "2026-05-02T10:10:00Z",
  },
  {
    kind: "folder",
    path: "workspace/",
    updatedAt: "2026-05-14T08:30:00Z",
  },
  {
    kind: "file",
    path: "financials/nvidia-financials-fy2024.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 231_482,
    source: {
      kind: "url",
      url: "/samples/nvidia-financials-fy2024.xlsx",
      fileName: "nvidia-financials-fy2024.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    updatedAt: "2026-04-11T15:20:00Z",
  },
  {
    kind: "file",
    path: "financials/sales.csv",
    mimeType: "text/csv",
    size: 18_420,
    source: {
      kind: "url",
      url: "/samples/sales.csv",
      fileName: "sales.csv",
      mimeType: "text/csv",
    },
    updatedAt: "2026-04-08T09:12:00Z",
  },
  {
    kind: "file",
    path: "research/attention.pdf",
    mimeType: "application/pdf",
    previewImageUrl: "/samples/attention-page-1.png",
    size: 516_280,
    source: {
      kind: "url",
      url: "/samples/attention.pdf",
      fileName: "attention.pdf",
      mimeType: "application/pdf",
    },
    updatedAt: "2026-05-02T10:10:00Z",
  },
  {
    kind: "file",
    path: "research/an-image-is-worth-16x16-words.pdf",
    mimeType: "application/pdf",
    previewImageUrl: "/samples/an-image-is-worth-16x16-words-page-1.png",
    size: 298_114,
    source: {
      kind: "url",
      url: "/samples/an-image-is-worth-16x16-words.pdf",
      fileName: "an-image-is-worth-16x16-words.pdf",
      mimeType: "application/pdf",
    },
    updatedAt: "2026-04-19T13:45:00Z",
  },
  {
    kind: "file",
    path: "workspace/quarterly-business-review.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 129_030,
    source: {
      kind: "url",
      url: "/samples/quarterly-business-review.docx",
      fileName: "quarterly-business-review.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    updatedAt: "2026-05-14T08:30:00Z",
  },
  {
    kind: "file",
    path: "workspace/release-notes.md",
    mimeType: "text/markdown",
    size: 4_812,
    source: {
      kind: "url",
      url: "/samples/release-notes.md",
      fileName: "release-notes.md",
      mimeType: "text/markdown",
    },
    updatedAt: "2026-05-10T17:05:00Z",
  },
  {
    kind: "file",
    path: "workspace/use-debounced-value.ts",
    mimeType: "text/typescript",
    size: 2_190,
    source: {
      kind: "url",
      url: "/samples/use-debounced-value.ts",
      fileName: "use-debounced-value.ts",
      mimeType: "text/typescript",
    },
    updatedAt: "2026-05-09T11:15:00Z",
  },
]

export function FileSystemDemo() {
  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border bg-card shadow-sm">
      <FileSystem className="h-[680px] rounded-none border-0" items={ITEMS} />
    </div>
  )
}
