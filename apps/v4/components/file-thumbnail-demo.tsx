"use client"

import * as React from "react"

import { FileThumbnail } from "@/components/ui/file-thumbnail"

// A self-contained "rendered page" image so the demo works offline.
const pagePreview =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='320'>
      <rect width='240' height='320' fill='white'/>
      <rect x='24' y='28' width='120' height='14' rx='3' fill='#111'/>
      <rect x='24' y='60' width='192' height='8' rx='3' fill='#cbd5e1'/>
      <rect x='24' y='78' width='192' height='8' rx='3' fill='#cbd5e1'/>
      <rect x='24' y='96' width='150' height='8' rx='3' fill='#cbd5e1'/>
      <rect x='24' y='140' width='192' height='8' rx='3' fill='#e2e8f0'/>
      <rect x='24' y='158' width='192' height='8' rx='3' fill='#e2e8f0'/>
      <rect x='24' y='176' width='110' height='8' rx='3' fill='#e2e8f0'/>
      <rect x='24' y='220' width='192' height='8' rx='3' fill='#e2e8f0'/>
      <rect x='24' y='238' width='168' height='8' rx='3' fill='#e2e8f0'/>
    </svg>`
  )

export function FileThumbnailDemo() {
  return (
    <div className="bg-card rounded-xl border p-6 sm:p-8">
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 sm:gap-x-8">
        <Cell label="Loaded" hint="previewImageUrl">
          <FileThumbnail
            file={{ name: "invoice.pdf", type: "application/pdf" }}
            previewImageUrl={pagePreview}
            previewAspectRatio={1}
            className="w-full bg-white shadow-sm ring-1 ring-black/5"
            previewClassName="object-top"
          />
        </Cell>
        <Cell label="Loading" hint="isLoading">
          <FileThumbnail
            file={{ name: "report.docx", type: "application/vnd.openxmlformats" }}
            isLoading
            previewAspectRatio={1}
            className="w-full"
          />
        </Cell>
        <Cell label="Fallback" hint="no preview">
          <FileThumbnail
            file={{ name: "data.xlsx", type: "application/vnd.ms-excel" }}
            previewAspectRatio={1}
            className="w-full"
          />
        </Cell>
        <Cell label="Custom content" hint="previewContent">
          <FileThumbnail
            file={{ name: "photo.png", type: "image/png" }}
            previewAspectRatio={1}
            className="w-full shadow-sm ring-1 ring-black/5"
            previewContent={
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-sky-400 to-indigo-500 text-xs font-medium text-white">
                640 × 480
              </div>
            }
          />
        </Cell>
      </div>
    </div>
  )
}

function Cell({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground text-base font-semibold tracking-tight">
          {label}
        </span>
        <code className="text-muted-foreground text-xs">{hint}</code>
      </div>
      {children}
    </div>
  )
}
