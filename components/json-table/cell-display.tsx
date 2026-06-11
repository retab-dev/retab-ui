import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export const cellDisplayClass =
  "flex h-full w-full truncate px-2 text-xs leading-none"

export function CellDisplay({
  children,
  className,
  muted,
  onClick,
}: {
  children: ReactNode
  className?: string
  muted?: boolean
  onClick?: () => void
}) {
  return (
    <div
      className={cn(
        cellDisplayClass,
        className,
        muted && "text-muted-foreground"
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
