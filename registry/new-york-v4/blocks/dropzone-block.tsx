"use client"

import { DropzoneShowcase } from "./dropzone-showcase"

export function DropzoneBlock() {
  return (
    <div className="h-full min-h-[760px] overflow-auto bg-background p-5">
      <DropzoneShowcase />
    </div>
  )
}
